import { EnvironmentManager } from './environment-manager.js';
import { NetworkManager } from './network-manager.js';

/**
 * Comprehensive Deployment Logging Manager
 * Provides structured logging for startup, CORS, and network activities
 */
export class DeploymentLogger {
  static #initialized = false;
  static #config = null;

  /**
   * Reset internal state for testing
   * @private
   */
  static _resetForTesting() {
    this.#initialized = false;
    this.#config = null;
  }

  /**
   * Initialize the deployment logger
   */
  static initialize() {
    if (this.#initialized) return;

    this.#config = {
      environment: EnvironmentManager.detectEnvironment(),
      platform: EnvironmentManager.detectPlatform(),
      logLevel: EnvironmentManager.getConfiguration().logLevel,
      enableDetailedLogging: EnvironmentManager.getConfiguration().features.detailedLogging,
      timestamp: new Date().toISOString()
    };

    this.#initialized = true;
  }

  /**
   * Get current configuration
   * @private
   */
  static #getConfig() {
    if (!this.#initialized) {
      this.initialize();
    }
    return this.#config;
  }

  /**
   * Create a structured log entry
   * @private
   */
  static #createLogEntry(level, component, message, context = {}) {
    const config = this.#getConfig();
    
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      component,
      message,
      platform: config.platform,
      environment: config.environment,
      processId: process.pid,
      ...context
    };
  }

  /**
   * Format and output a log entry
   * @private
   */
  static #outputLog(logEntry, emoji = '') {
    const { level, component, message, timestamp, ...context } = logEntry;
    
    // Create formatted message
    const formattedMessage = `${emoji} [${component}] ${message}`;
    
    // Create context string if context exists
    const contextStr = Object.keys(context).length > 0 ? 
      '\n' + JSON.stringify(context, null, 2) : '';

    // Output based on log level
    switch (level.toLowerCase()) {
      case 'info':
        console.log(`ℹ️  ${formattedMessage}${contextStr}`);
        break;
      case 'warn':
        console.warn(`⚠️  ${formattedMessage}${contextStr}`);
        break;
      case 'error':
        console.error(`❌ ${formattedMessage}${contextStr}`);
        break;
      case 'debug':
        if (this.#getConfig().environment === 'development' || this.#getConfig().logLevel === 'debug') {
          console.log(`🐛 ${formattedMessage}${contextStr}`);
        }
        break;
      default:
        console.log(`📝 ${formattedMessage}${contextStr}`);
    }

    return logEntry;
  }

  /**
   * Log environment detection results at application startup
   */
  static logStartupInfo() {
    const config = this.#getConfig();
    const envConfig = EnvironmentManager.getConfiguration();
    const networkConfig = NetworkManager.getConfiguration();
    const envValidation = EnvironmentManager.validateConfiguration();
    const networkValidation = NetworkManager.validateNetworkConfiguration();

    const startupContext = {
      startup: {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: {
          os: config.platform,
          arch: process.arch,
          nodeArch: process.arch,
          isContainerized: EnvironmentManager.isContainerized()
        },
        environment: {
          mode: config.environment,
          nodeEnv: envConfig.nodeEnv,
          logLevel: config.logLevel,
          detailedLogging: config.enableDetailedLogging
        },
        server: {
          bindAddress: networkConfig.bindAddress,
          port: networkConfig.port,
          authEnabled: envConfig.authEnabled
        },
        docker: {
          socketPath: networkConfig.dockerSocket,
          socketType: config.platform === 'windows' ? 'named_pipe' : 'unix_socket',
          timeout: networkConfig.timeouts.connection
        },
        cors: {
          origin: envConfig.corsOrigin,
          mode: config.environment === 'development' ? 'development_wildcard' : 'production_strict',
          loggingEnabled: config.environment === 'development'
        },
        validation: {
          environment: {
            isValid: envValidation.isValid,
            errorCount: envValidation.errors.length,
            warningCount: envValidation.warnings.length
          },
          network: {
            isValid: networkValidation.isValid,
            errorCount: networkValidation.errors.length,
            warningCount: networkValidation.warnings.length
          }
        }
      }
    };

    // Add validation details if there are issues
    if (envValidation.errors.length > 0 || envValidation.warnings.length > 0) {
      startupContext.startup.validation.environment.details = {
        errors: envValidation.errors,
        warnings: envValidation.warnings
      };
    }

    if (networkValidation.errors.length > 0 || networkValidation.warnings.length > 0) {
      startupContext.startup.validation.network.details = {
        errors: networkValidation.errors,
        warnings: networkValidation.warnings
      };
    }

    const logEntry = this.#createLogEntry(
      'info',
      'DeploymentStartup',
      `Application startup completed - Platform: ${config.platform}, Environment: ${config.environment}`,
      startupContext
    );

    return this.#outputLog(logEntry, '🚀');
  }

  /**
   * Log CORS request/response activity for development mode debugging
   */
  static logCorsActivity(req, res, details = {}) {
    const config = this.#getConfig();
    
    // Only log CORS activity in development mode
    if (config.environment !== 'development') {
      return null;
    }

    const corsContext = {
      cors: {
        timestamp: new Date().toISOString(),
        request: {
          method: req.method,
          url: req.url,
          origin: req.headers.origin || 'no-origin',
          userAgent: req.headers['user-agent'] || 'unknown',
          referer: req.headers.referer || 'none',
          host: req.headers.host || 'unknown'
        },
        headers: {
          request: this.#extractCorsHeaders(req.headers),
          response: res ? this.#extractCorsHeaders(res.getHeaders()) : {}
        },
        preflight: {
          isPreflight: req.method === 'OPTIONS',
          requestedMethod: req.headers['access-control-request-method'] || null,
          requestedHeaders: req.headers['access-control-request-headers'] || null
        },
        response: res ? {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage || 'OK'
        } : null,
        ...details
      }
    };

    const message = req.method === 'OPTIONS' ? 
      `CORS preflight request from ${corsContext.cors.request.origin}` :
      `CORS request: ${req.method} ${req.url} from ${corsContext.cors.request.origin}`;

    const logEntry = this.#createLogEntry(
      'debug',
      'CORSActivity',
      message,
      corsContext
    );

    return this.#outputLog(logEntry, '🔗');
  }

  /**
   * Extract CORS-related headers from headers object
   * @private
   */
  static #extractCorsHeaders(headers) {
    const corsHeaders = {};
    
    if (!headers) return corsHeaders;

    Object.keys(headers).forEach(header => {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes('cors') || 
          lowerHeader.includes('origin') ||
          lowerHeader.includes('access-control')) {
        corsHeaders[header] = headers[header];
      }
    });

    return corsHeaders;
  }

  /**
   * Log network connection attempts with timestamps and detailed context
   */
  static logNetworkActivity(operation, details = {}) {
    const config = this.#getConfig();
    const networkConfig = NetworkManager.getConfiguration();

    const networkContext = {
      network: {
        timestamp: new Date().toISOString(),
        operation,
        platform: config.platform,
        configuration: {
          bindAddress: networkConfig.bindAddress,
          port: networkConfig.port,
          dockerSocket: networkConfig.dockerSocket,
          socketType: config.platform === 'windows' ? 'named_pipe' : 'unix_socket'
        },
        connection: {
          timeout: networkConfig.timeouts.connection,
          requestTimeout: networkConfig.timeouts.request,
          healthCheckTimeout: networkConfig.timeouts.healthCheck
        },
        ...details
      }
    };

    // Determine log level based on operation type and success
    let level = 'info';
    let emoji = '🌐';
    
    if (details.error) {
      level = 'error';
      emoji = '❌';
      
      // Add error classification
      networkContext.network.error = {
        message: details.error.message || details.error,
        code: details.error.code || 'UNKNOWN',
        type: details.error.type || 'network_error',
        severity: details.error.severity || 'medium',
        recoverable: details.error.recoverable !== false,
        stack: config.enableDetailedLogging ? details.error.stack : undefined
      };
    } else if (details.warning || operation.toLowerCase().includes('retry')) {
      level = 'warn';
      emoji = '⚠️';
    } else if (operation.toLowerCase().includes('success') || operation.toLowerCase().includes('connected')) {
      emoji = '✅';
    }

    const logEntry = this.#createLogEntry(
      level,
      'NetworkActivity',
      `Network operation: ${operation}`,
      networkContext
    );

    return this.#outputLog(logEntry, emoji);
  }

  /**
   * Log Docker connection state changes with detailed context
   */
  static logDockerStateChange(fromState, toState, context = {}) {
    const config = this.#getConfig();
    
    const stateContext = {
      docker: {
        timestamp: new Date().toISOString(),
        stateTransition: {
          from: fromState,
          to: toState,
          duration: context.duration || null,
          reason: context.reason || 'state_change'
        },
        platform: config.platform,
        socketInfo: {
          path: context.socketPath || NetworkManager.getConfiguration().dockerSocket,
          type: config.platform === 'windows' ? 'named_pipe' : 'unix_socket',
          accessible: context.socketAccessible || null
        },
        connection: {
          retryCount: context.retryCount || 0,
          lastError: context.lastError || null,
          nextRetryAt: context.nextRetryAt || null,
          isRetrying: context.isRetrying || false
        },
        ...context
      }
    };

    // Determine appropriate emoji and level
    let emoji = '🐳';
    let level = 'info';
    
    if (toState === 'connected') {
      emoji = '✅';
    } else if (toState === 'error' || toState === 'failed') {
      emoji = '❌';
      level = 'error';
    } else if (toState === 'retrying' || toState === 'degraded') {
      emoji = '⚠️';
      level = 'warn';
    }

    const logEntry = this.#createLogEntry(
      level,
      'DockerConnection',
      `Docker connection state changed: ${fromState} → ${toState}`,
      stateContext
    );

    return this.#outputLog(logEntry, emoji);
  }

  /**
   * Log Docker retry attempts with detailed context
   */
  static logDockerRetry(attempt, maxAttempts, delay, error, context = {}) {
    const config = this.#getConfig();
    
    const retryContext = {
      docker: {
        timestamp: new Date().toISOString(),
        retry: {
          attempt,
          maxAttempts,
          delayMs: delay,
          nextRetryAt: new Date(Date.now() + delay).toISOString(),
          progress: `${attempt}/${maxAttempts}`,
          remainingAttempts: maxAttempts - attempt
        },
        error: {
          type: error.type || 'unknown',
          code: error.code || 'UNKNOWN',
          message: error.message,
          severity: error.severity || 'medium',
          recoverable: error.recoverable !== false,
          userMessage: error.userMessage || error.message,
          stack: config.enableDetailedLogging ? error.stack : undefined
        },
        platform: config.platform,
        socketPath: context.socketPath || NetworkManager.getConfiguration().dockerSocket,
        ...context
      }
    };

    const logEntry = this.#createLogEntry(
      'warn',
      'DockerRetry',
      `Docker retry attempt ${attempt}/${maxAttempts} scheduled in ${delay}ms`,
      retryContext
    );

    return this.#outputLog(logEntry, '🔄');
  }

  /**
   * Log Docker operation failures with troubleshooting information
   */
  static logDockerOperationFailed(operation, error, troubleshooting = {}) {
    const config = this.#getConfig();
    const networkConfig = NetworkManager.getConfiguration();
    
    const operationContext = {
      docker: {
        timestamp: new Date().toISOString(),
        operation,
        platform: config.platform,
        error: {
          type: error.type || 'unknown',
          code: error.code || 'UNKNOWN',
          message: error.message,
          severity: error.severity || 'medium',
          recoverable: error.recoverable !== false,
          userMessage: error.userMessage || error.message,
          stack: config.enableDetailedLogging ? error.stack : undefined
        },
        configuration: {
          socketPath: networkConfig.dockerSocket,
          socketType: config.platform === 'windows' ? 'named_pipe' : 'unix_socket',
          timeout: networkConfig.timeouts.connection,
          isContainerized: EnvironmentManager.isContainerized()
        },
        troubleshooting: {
          possibleCauses: troubleshooting.possibleCauses || this.#getDefaultTroubleshootingCauses(config.platform),
          suggestedActions: troubleshooting.suggestedActions || this.#getDefaultTroubleshootingActions(config.platform),
          documentationLinks: troubleshooting.documentationLinks || []
        }
      }
    };

    const logEntry = this.#createLogEntry(
      'error',
      'DockerOperation',
      `Docker operation '${operation}' failed: ${error.message}`,
      operationContext
    );

    return this.#outputLog(logEntry, '💥');
  }

  /**
   * Get default troubleshooting causes based on platform
   * @private
   */
  static #getDefaultTroubleshootingCauses(platform) {
    if (platform === 'windows') {
      return [
        'Docker Desktop not running',
        'Named pipe access permissions',
        'Windows container mode vs Linux container mode',
        'Docker Desktop service not started'
      ];
    } else {
      return [
        'Docker daemon not running',
        'Docker socket file permissions',
        'User not in docker group',
        'Docker socket not mounted in container',
        'Docker service not started'
      ];
    }
  }

  /**
   * Get default troubleshooting actions based on platform
   * @private
   */
  static #getDefaultTroubleshootingActions(platform) {
    if (platform === 'windows') {
      return [
        'Start Docker Desktop application',
        'Check Docker Desktop settings and permissions',
        'Verify Windows container vs Linux container mode',
        'Restart Docker Desktop service',
        'Check Windows named pipe permissions'
      ];
    } else {
      return [
        'Start Docker daemon: sudo systemctl start docker',
        'Add user to docker group: sudo usermod -aG docker $USER',
        'Check Docker socket permissions: ls -la /var/run/docker.sock',
        'Mount Docker socket in container: -v /var/run/docker.sock:/var/run/docker.sock',
        'Restart Docker service: sudo systemctl restart docker'
      ];
    }
  }

  /**
   * Log application configuration summary
   */
  static logConfigurationSummary() {
    const config = this.#getConfig();
    const envConfig = EnvironmentManager.getConfiguration();
    const networkConfig = NetworkManager.getConfiguration();

    const configContext = {
      configuration: {
        timestamp: new Date().toISOString(),
        summary: {
          platform: config.platform,
          environment: config.environment,
          nodeVersion: process.version,
          isContainerized: EnvironmentManager.isContainerized()
        },
        server: {
          bindAddress: networkConfig.bindAddress,
          port: networkConfig.port,
          authEnabled: envConfig.authEnabled,
          logLevel: config.logLevel
        },
        cors: {
          origin: envConfig.corsOrigin,
          mode: config.environment === 'development' ? 'wildcard' : 'strict',
          loggingEnabled: config.environment === 'development'
        },
        docker: {
          socketPath: networkConfig.dockerSocket,
          socketType: config.platform === 'windows' ? 'named_pipe' : 'unix_socket',
          timeout: networkConfig.timeouts.connection
        },
        features: envConfig.features
      }
    };

    const logEntry = this.#createLogEntry(
      'info',
      'Configuration',
      'Application configuration summary',
      configContext
    );

    return this.#outputLog(logEntry, '⚙️');
  }

  /**
   * Create a middleware function for Express to log CORS requests
   */
  static createCorsLoggingMiddleware() {
    const config = this.#getConfig();
    
    // Only enable CORS logging in development mode
    if (config.environment !== 'development') {
      return (req, res, next) => next();
    }

    return (req, res, next) => {
      // Log the incoming request
      this.logCorsActivity(req, null, {
        phase: 'request',
        timestamp: new Date().toISOString()
      });

      // Capture response details
      const originalSend = res.send;
      res.send = function(data) {
        // Log the response
        DeploymentLogger.logCorsActivity(req, res, {
          phase: 'response',
          timestamp: new Date().toISOString(),
          responseSize: data ? data.length : 0
        });
        
        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Log performance metrics and statistics
   */
  static logPerformanceMetrics(metrics = {}) {
    const config = this.#getConfig();
    
    const performanceContext = {
      performance: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: config.platform,
        environment: config.environment,
        ...metrics
      }
    };

    const logEntry = this.#createLogEntry(
      'debug',
      'Performance',
      `Performance metrics - Uptime: ${Math.round(process.uptime())}s, Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      performanceContext
    );

    return this.#outputLog(logEntry, '📊');
  }
}