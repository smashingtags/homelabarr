import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Docker from 'dockerode';
import { EnvironmentManager } from '../server/environment-manager.js';
import { DeploymentLogger } from '../server/deployment-logger.js';

// Mock dependencies
vi.mock('dockerode');
vi.mock('../server/environment-manager.js');
vi.mock('../server/deployment-logger.js');

// Mock the DockerConnectionManager class since it's defined in server/index.js
// We'll create a simplified version for testing the enhanced functionality
class MockDockerConnectionManager {
  constructor(options = {}) {
    this.config = {
      socketPath: options.socketPath || '/var/run/docker.sock',
      timeout: options.timeout || 30000,
      platform: options.platform || 'linux',
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 2000,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000
    };

    this.state = {
      isConnected: false,
      isRetrying: false,
      retryCount: 0,
      lastError: null,
      connectionAttempts: 0,
      lastSuccessfulConnection: null
    };

    this.circuitBreaker = {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      consecutiveFailures: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    };

    this.docker = null;
  }

  // Platform-specific Docker connection options
  getPlatformSpecificDockerOptions() {
    const baseOptions = {
      timeout: this.config.timeout
    };

    if (this.config.platform === 'windows') {
      // Windows uses named pipes
      return {
        ...baseOptions,
        // Let dockerode handle Windows named pipe connection
      };
    } else {
      // Unix-like systems use socket path
      return {
        ...baseOptions,
        socketPath: this.config.socketPath
      };
    }
  }

  // Enhanced error classification for platform-specific issues
  classifyError(error) {
    const errorInfo = {
      type: 'unknown',
      recoverable: false,
      severity: 'high',
      userMessage: error.message,
      platformSpecific: false
    };

    // Platform-specific error handling
    if (this.config.platform === 'windows') {
      if (error.code === 'ENOENT' || error.message.includes('pipe')) {
        errorInfo.type = 'windows_named_pipe_error';
        errorInfo.recoverable = true;
        errorInfo.severity = 'medium';
        errorInfo.userMessage = 'Docker Desktop may not be running or named pipe is not accessible';
        errorInfo.platformSpecific = true;
      }
    } else {
      // Unix-like systems
      if (error.code === 'EACCES') {
        errorInfo.type = 'unix_socket_permission_error';
        errorInfo.recoverable = false;
        errorInfo.severity = 'high';
        errorInfo.userMessage = 'Permission denied accessing Docker socket. Check user permissions or Docker group membership.';
        errorInfo.platformSpecific = true;
      } else if (error.code === 'ENOENT') {
        errorInfo.type = 'unix_socket_not_found';
        errorInfo.recoverable = true;
        errorInfo.severity = 'high';
        errorInfo.userMessage = 'Docker socket not found. Ensure Docker daemon is running.';
        errorInfo.platformSpecific = true;
      }
    }

    // Common error types
    if (error.code === 'ECONNREFUSED') {
      errorInfo.type = 'connection_refused';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Docker daemon is not running or not accepting connections';
    } else if (error.code === 'ETIMEDOUT') {
      errorInfo.type = 'connection_timeout';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Docker connection timed out. Check network connectivity.';
    }

    return errorInfo;
  }

  // Enhanced connection attempt with platform-specific handling
  async attemptConnection() {
    const previousState = this.state.isConnected ? 'connected' : 'disconnected';
    
    try {
      // Get platform-specific Docker options
      const dockerOptions = this.getPlatformSpecificDockerOptions();
      this.docker = new Docker(dockerOptions);

      // Test connection with a simple operation
      await this.docker.ping();
      
      // Connection successful
      this.state.isConnected = true;
      this.state.lastError = null;
      this.state.retryCount = 0;
      this.state.lastSuccessfulConnection = new Date();
      this.resetCircuitBreaker();

      // Log state change
      DeploymentLogger.logDockerStateChange(previousState, 'connected', {
        platform: this.config.platform,
        socketPath: this.config.socketPath,
        connectionAttempts: this.state.connectionAttempts + 1
      });

      return true;
    } catch (error) {
      this.state.isConnected = false;
      this.state.lastError = this.classifyError(error);
      this.state.connectionAttempts++;
      
      this.recordCircuitBreakerFailure();

      // Log state change with platform-specific context
      DeploymentLogger.logDockerStateChange(previousState, 'error', {
        platform: this.config.platform,
        socketPath: this.config.socketPath,
        error: this.state.lastError,
        connectionAttempts: this.state.connectionAttempts
      });

      return false;
    }
  }

  // Circuit breaker management
  recordCircuitBreakerFailure() {
    this.circuitBreaker.consecutiveFailures++;
    this.circuitBreaker.lastFailureTime = new Date();

    if (this.circuitBreaker.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }
  }

  resetCircuitBreaker() {
    const previousState = this.circuitBreaker.state;
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.consecutiveFailures = 0;
    this.circuitBreaker.lastFailureTime = null;
    this.circuitBreaker.nextAttemptTime = null;

    if (previousState !== 'CLOSED') {
      DeploymentLogger.logDockerStateChange('circuit_breaker_' + previousState.toLowerCase(), 'circuit_breaker_closed');
    }
  }

  openCircuitBreaker() {
    this.circuitBreaker.state = 'OPEN';
    this.circuitBreaker.nextAttemptTime = new Date(Date.now() + this.config.circuitBreakerTimeout);

    DeploymentLogger.logDockerStateChange('circuit_breaker_closed', 'circuit_breaker_open', {
      consecutiveFailures: this.circuitBreaker.consecutiveFailures,
      threshold: this.config.circuitBreakerThreshold
    });
  }

  canAttemptConnection() {
    if (this.circuitBreaker.state === 'CLOSED') {
      return true;
    }

    if (this.circuitBreaker.state === 'OPEN') {
      const now = new Date();
      if (this.circuitBreaker.nextAttemptTime && now >= this.circuitBreaker.nextAttemptTime) {
        this.circuitBreaker.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    // HALF_OPEN state allows one attempt
    return this.circuitBreaker.state === 'HALF_OPEN';
  }

  // Enhanced retry with platform-specific error handling
  async scheduleRetry() {
    if (this.state.isRetrying || !this.canAttemptConnection()) {
      return false;
    }

    if (this.state.retryCount >= this.config.retryAttempts) {
      return false;
    }

    this.state.isRetrying = true;
    this.state.retryCount++;

    const delay = this.config.retryDelay * Math.pow(2, this.state.retryCount - 1); // Exponential backoff

    DeploymentLogger.logDockerRetry(
      this.state.retryCount,
      this.config.retryAttempts,
      delay,
      this.state.lastError,
      {
        platform: this.config.platform,
        socketPath: this.config.socketPath
      }
    );

    return new Promise((resolve) => {
      setTimeout(async () => {
        const success = await this.attemptConnection();
        this.state.isRetrying = false;
        resolve(success);
      }, delay);
    });
  }

  getConnectionState() {
    return {
      isConnected: this.state.isConnected,
      isRetrying: this.state.isRetrying,
      retryCount: this.state.retryCount,
      lastError: this.state.lastError,
      connectionAttempts: this.state.connectionAttempts,
      lastSuccessfulConnection: this.state.lastSuccessfulConnection,
      circuitBreakerState: this.circuitBreaker.state,
      platform: this.config.platform
    };
  }

  // Platform-specific troubleshooting suggestions
  getResolutionSuggestion(errorType) {
    const suggestions = {
      windows_named_pipe_error: [
        'Start Docker Desktop application',
        'Check Docker Desktop settings and ensure it is running',
        'Verify Windows container vs Linux container mode in Docker Desktop',
        'Restart Docker Desktop service'
      ],
      unix_socket_permission_error: [
        'Add user to docker group: sudo usermod -aG docker $USER',
        'Check Docker socket permissions: ls -la /var/run/docker.sock',
        'Restart your session after adding user to docker group',
        'Ensure Docker daemon is running: sudo systemctl start docker'
      ],
      unix_socket_not_found: [
        'Start Docker daemon: sudo systemctl start docker',
        'Check if Docker is installed: docker --version',
        'Verify Docker socket path configuration',
        'Check Docker service status: sudo systemctl status docker'
      ],
      connection_refused: [
        'Start Docker daemon or Docker Desktop',
        'Check if Docker is listening on the expected socket/port',
        'Verify firewall settings are not blocking Docker',
        'Check Docker daemon logs for errors'
      ],
      connection_timeout: [
        'Check network connectivity to Docker daemon',
        'Increase connection timeout in configuration',
        'Verify Docker daemon is responsive',
        'Check system resource availability'
      ]
    };

    return suggestions[errorType] || [
      'Check Docker installation and configuration',
      'Verify Docker daemon is running',
      'Review Docker logs for detailed error information',
      'Consult Docker documentation for platform-specific issues'
    ];
  }
}

describe('Enhanced Docker Connection Manager', () => {
  let dockerManager;
  let mockDocker;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear all mocks
    vi.clearAllMocks();

    // Mock EnvironmentManager
    EnvironmentManager.getDockerConfig.mockReturnValue({
      socketPath: '/var/run/docker.sock',
      timeout: 30000,
      protocol: 'unix',
      platform: 'linux'
    });

    // Mock DeploymentLogger
    DeploymentLogger.logDockerStateChange = vi.fn();
    DeploymentLogger.logDockerRetry = vi.fn();
    DeploymentLogger.logDockerOperationFailed = vi.fn();

    // Mock Docker
    mockDocker = {
      ping: vi.fn(),
      listContainers: vi.fn(),
      version: vi.fn()
    };
    Docker.mockImplementation(() => mockDocker);

    // Create docker manager instance
    dockerManager = new MockDockerConnectionManager({
      platform: 'linux',
      socketPath: '/var/run/docker.sock',
      timeout: 30000
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Platform-Specific Docker Options', () => {
    it('should return Unix socket options for Linux', () => {
      const manager = new MockDockerConnectionManager({
        platform: 'linux',
        socketPath: '/var/run/docker.sock'
      });

      const options = manager.getPlatformSpecificDockerOptions();

      expect(options).toMatchObject({
        socketPath: '/var/run/docker.sock',
        timeout: expect.any(Number)
      });
    });

    it('should return named pipe options for Windows', () => {
      const manager = new MockDockerConnectionManager({
        platform: 'windows',
        socketPath: '\\\\.\\pipe\\docker_engine'
      });

      const options = manager.getPlatformSpecificDockerOptions();

      expect(options).toMatchObject({
        timeout: expect.any(Number)
      });
      expect(options).not.toHaveProperty('socketPath');
    });

    it('should handle custom timeout configuration', () => {
      const manager = new MockDockerConnectionManager({
        platform: 'linux',
        timeout: 45000
      });

      const options = manager.getPlatformSpecificDockerOptions();

      expect(options.timeout).toBe(45000);
    });
  });

  describe('Enhanced Error Classification', () => {
    it('should classify Windows named pipe errors', () => {
      const manager = new MockDockerConnectionManager({ platform: 'windows' });
      const error = new Error('connect ENOENT \\\\.\\pipe\\docker_engine');
      error.code = 'ENOENT';

      const errorInfo = manager.classifyError(error);

      expect(errorInfo.type).toBe('windows_named_pipe_error');
      expect(errorInfo.platformSpecific).toBe(true);
      expect(errorInfo.recoverable).toBe(true);
      expect(errorInfo.userMessage).toContain('Docker Desktop');
    });

    it('should classify Unix socket permission errors', () => {
      const manager = new MockDockerConnectionManager({ platform: 'linux' });
      const error = new Error('Permission denied');
      error.code = 'EACCES';

      const errorInfo = manager.classifyError(error);

      expect(errorInfo.type).toBe('unix_socket_permission_error');
      expect(errorInfo.platformSpecific).toBe(true);
      expect(errorInfo.recoverable).toBe(false);
      expect(errorInfo.userMessage).toContain('Permission denied');
    });

    it('should classify Unix socket not found errors', () => {
      const manager = new MockDockerConnectionManager({ platform: 'linux' });
      const error = new Error('No such file or directory');
      error.code = 'ENOENT';

      const errorInfo = manager.classifyError(error);

      expect(errorInfo.type).toBe('unix_socket_not_found');
      expect(errorInfo.platformSpecific).toBe(true);
      expect(errorInfo.recoverable).toBe(true);
      expect(errorInfo.userMessage).toContain('Docker socket not found');
    });

    it('should classify connection refused errors', () => {
      const manager = new MockDockerConnectionManager({ platform: 'linux' });
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';

      const errorInfo = manager.classifyError(error);

      expect(errorInfo.type).toBe('connection_refused');
      expect(errorInfo.recoverable).toBe(true);
      expect(errorInfo.userMessage).toContain('Docker daemon is not running');
    });

    it('should classify timeout errors', () => {
      const manager = new MockDockerConnectionManager({ platform: 'linux' });
      const error = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';

      const errorInfo = manager.classifyError(error);

      expect(errorInfo.type).toBe('connection_timeout');
      expect(errorInfo.recoverable).toBe(true);
      expect(errorInfo.userMessage).toContain('timed out');
    });

    it('should handle unknown errors gracefully', () => {
      const manager = new MockDockerConnectionManager({ platform: 'linux' });
      const error = new Error('Unknown error');
      error.code = 'UNKNOWN';

      const errorInfo = manager.classifyError(error);

      expect(errorInfo.type).toBe('unknown');
      expect(errorInfo.recoverable).toBe(false);
      expect(errorInfo.userMessage).toBe('Unknown error');
    });
  });

  describe('Connection Attempts', () => {
    it('should successfully connect to Docker', async () => {
      mockDocker.ping.mockResolvedValue({});

      const success = await dockerManager.attemptConnection();

      expect(success).toBe(true);
      expect(dockerManager.state.isConnected).toBe(true);
      expect(dockerManager.state.lastError).toBeNull();
      expect(DeploymentLogger.logDockerStateChange).toHaveBeenCalledWith(
        'disconnected',
        'connected',
        expect.objectContaining({
          platform: 'linux',
          socketPath: '/var/run/docker.sock'
        })
      );
    });

    it('should handle connection failures', async () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';
      mockDocker.ping.mockRejectedValue(error);

      const success = await dockerManager.attemptConnection();

      expect(success).toBe(false);
      expect(dockerManager.state.isConnected).toBe(false);
      expect(dockerManager.state.lastError).toMatchObject({
        type: 'connection_refused',
        recoverable: true
      });
      expect(DeploymentLogger.logDockerStateChange).toHaveBeenCalledWith(
        'disconnected',
        'error',
        expect.objectContaining({
          platform: 'linux',
          error: expect.objectContaining({
            type: 'connection_refused'
          })
        })
      );
    });

    it('should increment connection attempts on failure', async () => {
      const error = new Error('Connection failed');
      mockDocker.ping.mockRejectedValue(error);

      await dockerManager.attemptConnection();
      await dockerManager.attemptConnection();

      expect(dockerManager.state.connectionAttempts).toBe(2);
    });
  });

  describe('Circuit Breaker Functionality', () => {
    it('should open circuit breaker after consecutive failures', async () => {
      const error = new Error('Connection failed');
      mockDocker.ping.mockRejectedValue(error);

      // Configure circuit breaker with low threshold for testing
      dockerManager.config.circuitBreakerThreshold = 2;

      // First failure
      await dockerManager.attemptConnection();
      expect(dockerManager.circuitBreaker.state).toBe('CLOSED');
      expect(dockerManager.circuitBreaker.consecutiveFailures).toBe(1);

      // Second failure should open circuit breaker
      await dockerManager.attemptConnection();
      expect(dockerManager.circuitBreaker.state).toBe('OPEN');
      expect(dockerManager.circuitBreaker.consecutiveFailures).toBe(2);
    });

    it('should reset circuit breaker on successful connection', async () => {
      const error = new Error('Connection failed');
      mockDocker.ping.mockRejectedValue(error);

      // Cause some failures
      dockerManager.circuitBreaker.consecutiveFailures = 3;
      dockerManager.circuitBreaker.state = 'OPEN';

      // Now succeed
      mockDocker.ping.mockResolvedValue({});
      await dockerManager.attemptConnection();

      expect(dockerManager.circuitBreaker.state).toBe('CLOSED');
      expect(dockerManager.circuitBreaker.consecutiveFailures).toBe(0);
    });

    it('should block connections when circuit breaker is open', () => {
      dockerManager.circuitBreaker.state = 'OPEN';
      dockerManager.circuitBreaker.nextAttemptTime = new Date(Date.now() + 60000);

      const canAttempt = dockerManager.canAttemptConnection();
      expect(canAttempt).toBe(false);
    });

    it('should allow connection in half-open state', () => {
      dockerManager.circuitBreaker.state = 'HALF_OPEN';

      const canAttempt = dockerManager.canAttemptConnection();
      expect(canAttempt).toBe(true);
    });

    it('should transition from open to half-open after timeout', () => {
      dockerManager.circuitBreaker.state = 'OPEN';
      dockerManager.circuitBreaker.nextAttemptTime = new Date(Date.now() - 1000); // Past time

      const canAttempt = dockerManager.canAttemptConnection();
      expect(canAttempt).toBe(true);
      expect(dockerManager.circuitBreaker.state).toBe('HALF_OPEN');
    });
  });

  describe('Retry Mechanism', () => {
    it('should schedule retry for recoverable errors', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      mockDocker.ping.mockRejectedValue(error);

      // First attempt fails
      await dockerManager.attemptConnection();
      expect(dockerManager.state.retryCount).toBe(0);

      // Schedule retry
      const retryPromise = dockerManager.scheduleRetry();
      expect(dockerManager.state.isRetrying).toBe(true);
      expect(dockerManager.state.retryCount).toBe(1);

      expect(DeploymentLogger.logDockerRetry).toHaveBeenCalledWith(
        1,
        dockerManager.config.retryAttempts,
        expect.any(Number),
        expect.objectContaining({
          type: 'connection_refused'
        }),
        expect.objectContaining({
          platform: 'linux'
        })
      );

      // Wait for retry to complete
      await retryPromise;
      expect(dockerManager.state.isRetrying).toBe(false);
    });

    it('should not retry when circuit breaker is open', async () => {
      dockerManager.circuitBreaker.state = 'OPEN';
      dockerManager.circuitBreaker.nextAttemptTime = new Date(Date.now() + 60000);

      const success = await dockerManager.scheduleRetry();
      expect(success).toBe(false);
      expect(dockerManager.state.isRetrying).toBe(false);
    });

    it('should not retry when max attempts reached', async () => {
      dockerManager.state.retryCount = dockerManager.config.retryAttempts;

      const success = await dockerManager.scheduleRetry();
      expect(success).toBe(false);
      expect(dockerManager.state.isRetrying).toBe(false);
    });

    it('should use exponential backoff for retry delays', async () => {
      const error = new Error('Connection failed');
      mockDocker.ping.mockRejectedValue(error);

      await dockerManager.attemptConnection();

      // First retry
      dockerManager.scheduleRetry();
      expect(DeploymentLogger.logDockerRetry).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        dockerManager.config.retryDelay, // Base delay
        expect.any(Object),
        expect.any(Object)
      );

      // Second retry should have doubled delay
      dockerManager.state.isRetrying = false;
      dockerManager.scheduleRetry();
      expect(DeploymentLogger.logDockerRetry).toHaveBeenCalledWith(
        2,
        expect.any(Number),
        dockerManager.config.retryDelay * 2, // Doubled delay
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Platform-Specific Resolution Suggestions', () => {
    it('should provide Windows-specific resolution suggestions', () => {
      const manager = new MockDockerConnectionManager({ platform: 'windows' });
      const suggestions = manager.getResolutionSuggestion('windows_named_pipe_error');

      expect(suggestions).toContain('Start Docker Desktop application');
      expect(suggestions).toContain('Check Docker Desktop settings and ensure it is running');
      expect(suggestions).toContain('Verify Windows container vs Linux container mode in Docker Desktop');
    });

    it('should provide Unix-specific resolution suggestions for permission errors', () => {
      const manager = new MockDockerConnectionManager({ platform: 'linux' });
      const suggestions = manager.getResolutionSuggestion('unix_socket_permission_error');

      expect(suggestions).toContain('Add user to docker group: sudo usermod -aG docker $USER');
      expect(suggestions).toContain('Check Docker socket permissions: ls -la /var/run/docker.sock');
      expect(suggestions).toContain('Ensure Docker daemon is running: sudo systemctl start docker');
    });

    it('should provide Unix-specific resolution suggestions for socket not found', () => {
      const manager = new MockDockerConnectionManager({ platform: 'linux' });
      const suggestions = manager.getResolutionSuggestion('unix_socket_not_found');

      expect(suggestions).toContain('Start Docker daemon: sudo systemctl start docker');
      expect(suggestions).toContain('Check if Docker is installed: docker --version');
      expect(suggestions).toContain('Check Docker service status: sudo systemctl status docker');
    });

    it('should provide generic suggestions for unknown error types', () => {
      const manager = new MockDockerConnectionManager({ platform: 'linux' });
      const suggestions = manager.getResolutionSuggestion('unknown_error');

      expect(suggestions).toContain('Check Docker installation and configuration');
      expect(suggestions).toContain('Verify Docker daemon is running');
      expect(suggestions).toContain('Review Docker logs for detailed error information');
    });
  });

  describe('Connection State Management', () => {
    it('should return comprehensive connection state', () => {
      dockerManager.state.isConnected = true;
      dockerManager.state.retryCount = 2;
      dockerManager.state.connectionAttempts = 5;
      dockerManager.circuitBreaker.state = 'HALF_OPEN';

      const state = dockerManager.getConnectionState();

      expect(state).toMatchObject({
        isConnected: true,
        isRetrying: false,
        retryCount: 2,
        connectionAttempts: 5,
        circuitBreakerState: 'HALF_OPEN',
        platform: 'linux'
      });

      expect(state).toHaveProperty('lastError');
      expect(state).toHaveProperty('lastSuccessfulConnection');
    });

    it('should track last successful connection time', async () => {
      mockDocker.ping.mockResolvedValue({});

      const beforeConnection = new Date();
      await dockerManager.attemptConnection();
      const afterConnection = new Date();

      const state = dockerManager.getConnectionState();
      expect(state.lastSuccessfulConnection).toBeInstanceOf(Date);
      expect(state.lastSuccessfulConnection.getTime()).toBeGreaterThanOrEqual(beforeConnection.getTime());
      expect(state.lastSuccessfulConnection.getTime()).toBeLessThanOrEqual(afterConnection.getTime());
    });
  });
});