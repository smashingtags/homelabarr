#!/usr/bin/env node

// Test script for Docker connection retry mechanism with circuit breaker
import Docker from 'dockerode';

// Mock logger for testing
const logger = {
  info: (message, ...args) => console.log(`ℹ️  ${message}`, ...args),
  warn: (message, ...args) => console.warn(`⚠️  ${message}`, ...args),
  error: (message, ...args) => console.error(`❌ ${message}`, ...args),
  debug: (message, ...args) => console.log(`🐛 ${message}`, ...args),
  
  dockerConnection: (level, message, context = {}) => {
    const formattedMessage = `🐳 [Docker] ${message}`;
    const contextStr = Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '';
    
    switch (level) {
      case 'info':
        console.log(`ℹ️  ${formattedMessage}`, contextStr ? '\n' + contextStr : '');
        break;
      case 'warn':
        console.warn(`⚠️  ${formattedMessage}`, contextStr ? '\n' + contextStr : '');
        break;
      case 'error':
        console.error(`❌ ${formattedMessage}`, contextStr ? '\n' + contextStr : '');
        break;
      case 'debug':
        console.log(`🐛 ${formattedMessage}`, contextStr ? '\n' + contextStr : '');
        break;
    }
  },
  
  dockerStateChange: (fromState, toState, context = {}) => {
    console.log(`🔄 State change: ${fromState} → ${toState}`, context);
  },
  
  dockerRetry: (attempt, maxAttempts, delay, error, context = {}) => {
    console.log(`🔄 Retry ${attempt}/${maxAttempts} in ${delay}ms`, { error: error.message, ...context });
  },
  
  dockerOperationFailed: (operation, error, troubleshooting = {}) => {
    console.error(`❌ Operation '${operation}' failed:`, error.message);
  }
};

// Simplified DockerConnectionManager for testing
class TestDockerConnectionManager {
  constructor(options = {}) {
    this.config = {
      socketPath: '/invalid/socket/path', // Force failures for testing
      timeout: 1000,
      retryAttempts: 3,
      retryDelay: 100,
      maxRetryDelay: 1000,
      circuitBreakerThreshold: 2,
      circuitBreakerTimeout: 2000
    };

    this.state = {
      isConnected: false,
      lastError: null,
      lastSuccessfulConnection: null,
      retryCount: 0,
      nextRetryAt: null,
      isRetrying: false
    };

    this.circuitBreaker = {
      state: 'CLOSED',
      consecutiveFailures: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    };

    this.docker = null;
    this.retryTimer = null;
  }

  async connect() {
    if (!this.canAttemptConnection()) {
      const timeUntilNextAttempt = this.circuitBreaker.nextAttemptTime ? 
        this.circuitBreaker.nextAttemptTime.getTime() - Date.now() : 0;
      
      logger.dockerConnection('warn', 'Connection attempt blocked by circuit breaker', {
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        timeUntilNextAttempt
      });
      
      return false;
    }
    
    try {
      logger.dockerConnection('debug', 'Attempting Docker connection', {
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
      });
      
      this.docker = new Docker({
        socketPath: this.config.socketPath,
        timeout: this.config.timeout
      });

      await this.docker.listContainers({ limit: 1 });
      
      this.state.isConnected = true;
      this.state.lastError = null;
      this.state.lastSuccessfulConnection = new Date();
      this.state.retryCount = 0;
      this.state.nextRetryAt = null;
      this.state.isRetrying = false;

      this.updateCircuitBreakerOnSuccess();
      
      logger.dockerConnection('info', 'Docker connection established successfully');
      return true;
    } catch (error) {
      logger.dockerConnection('debug', 'Docker connection attempt failed', {
        errorCode: error.code,
        errorMessage: error.message
      });
      
      this.handleConnectionError(error);
      return false;
    }
  }

  handleConnectionError(error) {
    this.state.isConnected = false;
    this.state.lastError = this.classifyError(error);
    this.docker = null;

    this.updateCircuitBreakerOnFailure();

    logger.dockerConnection('error', 'Docker connection failed', {
      errorType: this.state.lastError.type,
      circuitBreakerState: this.circuitBreaker.state,
      consecutiveFailures: this.circuitBreaker.consecutiveFailures
    });

    if (this.circuitBreaker.state === 'OPEN') {
      logger.dockerConnection('warn', 'Circuit breaker is OPEN, blocking retry attempts', {
        consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        threshold: this.config.circuitBreakerThreshold
      });
      this.state.isRetrying = false;
      return;
    }

    if (this.state.lastError.recoverable && this.state.retryCount < this.config.retryAttempts) {
      this.scheduleRetry();
    } else {
      logger.dockerConnection('error', 'Docker connection failed permanently');
      this.state.isRetrying = false;
    }
  }

  updateCircuitBreakerOnFailure() {
    this.circuitBreaker.consecutiveFailures++;
    this.circuitBreaker.lastFailureTime = new Date();

    logger.dockerConnection('debug', 'Circuit breaker failure recorded', {
      consecutiveFailures: this.circuitBreaker.consecutiveFailures,
      threshold: this.config.circuitBreakerThreshold,
      currentState: this.circuitBreaker.state
    });

    // Check if we should open the circuit breaker
    if (this.circuitBreaker.state === 'CLOSED' && 
        this.circuitBreaker.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    } else if (this.circuitBreaker.state === 'HALF_OPEN') {
      // In HALF_OPEN state, any failure should immediately open the circuit
      logger.dockerConnection('warn', 'Circuit breaker reopened after failure in HALF_OPEN state', {
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
      });
      this.openCircuitBreaker();
    }
  }

  updateCircuitBreakerOnSuccess() {
    const previousState = this.circuitBreaker.state;
    const previousFailures = this.circuitBreaker.consecutiveFailures;

    this.circuitBreaker.consecutiveFailures = 0;
    this.circuitBreaker.lastFailureTime = null;
    this.circuitBreaker.nextAttemptTime = null;
    this.circuitBreaker.state = 'CLOSED';

    if (previousState !== 'CLOSED' || previousFailures > 0) {
      logger.dockerConnection('info', 'Circuit breaker reset after successful connection', {
        previousState,
        previousConsecutiveFailures: previousFailures
      });
    }
  }

  openCircuitBreaker() {
    this.circuitBreaker.state = 'OPEN';
    this.circuitBreaker.nextAttemptTime = new Date(Date.now() + this.config.circuitBreakerTimeout);

    logger.dockerConnection('warn', 'Circuit breaker OPENED due to consecutive failures', {
      consecutiveFailures: this.circuitBreaker.consecutiveFailures,
      threshold: this.config.circuitBreakerThreshold,
      nextAttemptTime: this.circuitBreaker.nextAttemptTime.toISOString()
    });

    setTimeout(() => {
      if (this.circuitBreaker.state === 'OPEN') {
        this.circuitBreaker.state = 'HALF_OPEN';
        logger.dockerConnection('info', 'Circuit breaker transitioned to HALF_OPEN');
      }
    }, this.config.circuitBreakerTimeout);
  }

  canAttemptConnection() {
    const now = new Date();

    switch (this.circuitBreaker.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (this.circuitBreaker.nextAttemptTime && now >= this.circuitBreaker.nextAttemptTime) {
          this.circuitBreaker.state = 'HALF_OPEN';
          logger.dockerConnection('info', 'Circuit breaker transitioned to HALF_OPEN after timeout');
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return true;
      default:
        return false;
    }
  }

  classifyError(error) {
    return {
      type: 'socket_not_found',
      code: error.code || 'ENOENT',
      message: error.message,
      recoverable: true,
      severity: 'high',
      userMessage: 'Docker socket not found',
      occurredAt: new Date().toISOString()
    };
  }

  calculateRetryDelay() {
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, this.state.retryCount);
    const delay = Math.min(exponentialDelay, this.config.maxRetryDelay);
    return Math.floor(delay);
  }

  scheduleRetry() {
    if (this.state.isRetrying) {
      return;
    }

    if (!this.canAttemptConnection()) {
      logger.dockerConnection('warn', 'Retry blocked by circuit breaker');
      this.state.isRetrying = false;
      return;
    }

    const delay = this.calculateRetryDelay();
    this.state.nextRetryAt = new Date(Date.now() + delay);
    this.state.isRetrying = true;

    logger.dockerRetry(
      this.state.retryCount + 1, 
      this.config.retryAttempts, 
      delay, 
      this.state.lastError,
      {
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
      }
    );

    this.retryTimer = setTimeout(async () => {
      this.state.retryCount++;
      
      logger.dockerConnection('info', `Executing retry attempt ${this.state.retryCount}/${this.config.retryAttempts}`);
      
      const success = await this.connect();
      
      if (!success && this.state.retryCount < this.config.retryAttempts && this.canAttemptConnection()) {
        this.scheduleRetry();
      } else if (!success) {
        const failureReason = !this.canAttemptConnection() ? 'circuit_breaker_open' : 'max_retries_exceeded';
        logger.dockerConnection('error', 'Retry attempts stopped', { failureReason });
        this.state.isRetrying = false;
      }
    }, delay);
  }

  getCircuitBreakerStatus() {
    return {
      state: this.circuitBreaker.state,
      consecutiveFailures: this.circuitBreaker.consecutiveFailures,
      threshold: this.config.circuitBreakerThreshold,
      lastFailureTime: this.circuitBreaker.lastFailureTime,
      nextAttemptTime: this.circuitBreaker.nextAttemptTime,
      canAttempt: this.canAttemptConnection()
    };
  }

  destroy() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}

// Test the circuit breaker functionality
async function testCircuitBreaker() {
  console.log('🧪 Testing Docker Connection Retry Mechanism with Circuit Breaker\n');
  
  const manager = new TestDockerConnectionManager();
  
  console.log('📋 Test Configuration:');
  console.log(`   - Retry Attempts: ${manager.config.retryAttempts}`);
  console.log(`   - Circuit Breaker Threshold: ${manager.config.circuitBreakerThreshold}`);
  console.log(`   - Circuit Breaker Timeout: ${manager.config.circuitBreakerTimeout}ms`);
  console.log(`   - Socket Path: ${manager.config.socketPath} (intentionally invalid)\n`);
  
  console.log('🔄 Starting connection attempts...\n');
  
  // Attempt initial connection (should fail and trigger retries)
  await manager.connect();
  
  // Wait for retries to complete and circuit breaker to potentially open
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n📊 Final Circuit Breaker Status:');
  const status = manager.getCircuitBreakerStatus();
  console.log(JSON.stringify(status, null, 2));
  
  // Test circuit breaker blocking additional attempts
  console.log('\n🚫 Testing circuit breaker blocking...');
  const blockedResult = await manager.connect();
  console.log(`Connection attempt result: ${blockedResult ? 'SUCCESS' : 'BLOCKED'}`);
  
  // Wait for circuit breaker to transition to HALF_OPEN
  console.log('\n⏳ Waiting for circuit breaker to transition to HALF_OPEN...');
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  console.log('🔄 Testing HALF_OPEN state...');
  const halfOpenResult = await manager.connect();
  console.log(`Half-open connection attempt result: ${halfOpenResult ? 'SUCCESS' : 'FAILED'}`);
  
  console.log('\n📊 Final Circuit Breaker Status:');
  const finalStatus = manager.getCircuitBreakerStatus();
  console.log(JSON.stringify(finalStatus, null, 2));
  
  manager.destroy();
  
  console.log('\n✅ Circuit breaker test completed!');
  console.log('\n📝 Expected behavior:');
  console.log('   1. Initial connection fails');
  console.log('   2. Retries are attempted with exponential backoff');
  console.log('   3. After threshold failures, circuit breaker opens');
  console.log('   4. Additional attempts are blocked while circuit is open');
  console.log('   5. After timeout, circuit transitions to half-open');
  console.log('   6. Next attempt is allowed in half-open state');
}

// Run the test
testCircuitBreaker().catch(console.error);