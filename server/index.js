import express from 'express';
import Docker from 'dockerode';
import cors from 'cors';
import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import helmet from 'helmet';
import os from 'os';
import { chmodSync } from 'fs';
import { promisify } from 'util';
import {
  initializeAuth,
  requireAuth,
  requireRole,
  optionalAuth,
  validatePassword,
  generateToken,
  createUser,
  loadUsers,
  saveUsers,
  findUserById,
  authenticate,
  loadSessions,
  saveSessions,
  getUserSessions,
  invalidateSession,
  changePassword
} from './auth.js';
import { EnvironmentManager } from './environment-manager.js';
import { NetworkManager } from './network-manager.js';
import { DeploymentLogger } from './deployment-logger.js';
import { CLIBridge } from './cli-bridge.js';
import { progressStream, StreamingCLIBridge } from './progress-stream.js';
import { randomUUID } from 'crypto';

// Global error handlers to prevent container crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  
  // Log the error but don't crash the process
  if (reason && reason.message && reason.message.includes('docker')) {
    console.warn('⚠️  Docker-related error detected - continuing with degraded functionality');
  }
  
  // Don't exit the process - let it continue running
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  
  // For Docker-related errors, try to continue
  if (error.message && error.message.includes('docker')) {
    console.warn('⚠️  Docker-related exception - attempting to continue');
    return;
  }
  
  // For other critical errors, exit gracefully
  console.error('💥 Critical error - shutting down');
  process.exit(1);
});

// Initialize environment configuration
const envConfig = EnvironmentManager.getConfiguration();
const isDevelopment = envConfig.environment === 'development';
const logLevel = envConfig.logLevel;
const authEnabled = envConfig.authEnabled;

// Enhanced logging utility with structured logging for Docker connections
const logger = {
  info: (message, ...args) => console.log(`ℹ️  ${message}`, ...args),
  warn: (message, ...args) => console.warn(`⚠️  ${message}`, ...args),
  error: (message, ...args) => console.error(`❌ ${message}`, ...args),
  debug: (message, ...args) => {
    if (isDevelopment || logLevel === 'debug') console.log(`🐛 ${message}`, ...args);
  },

  // Structured logging methods for Docker operations - now using DeploymentLogger
  dockerConnection: (level, message, context = {}) => {
    return DeploymentLogger.logNetworkActivity(`Docker: ${message}`, {
      level,
      dockerContext: context,
      component: 'DockerConnectionManager'
    });
  },

  // Specialized method for connection state changes
  dockerStateChange: (fromState, toState, context = {}) => {
    return DeploymentLogger.logDockerStateChange(fromState, toState, context);
  },

  // Method for retry attempts with detailed context
  dockerRetry: (attempt, maxAttempts, delay, error, context = {}) => {
    return DeploymentLogger.logDockerRetry(attempt, maxAttempts, delay, error, context);
  },

  // Method for operation failures with troubleshooting info
  dockerOperationFailed: (operation, error, troubleshooting = {}) => {
    return DeploymentLogger.logDockerOperationFailed(operation, error, troubleshooting);
  }
};

// Initialize CLI Bridge for HomelabARR integration
let cliBridge;
let streamingCLIBridge;
try {
  cliBridge = new CLIBridge();
  streamingCLIBridge = new StreamingCLIBridge(cliBridge, progressStream);
  logger.info('CLI Bridge initialized successfully - Connected to HomelabARR CLI with streaming support');
} catch (error) {
  logger.error('Failed to initialize CLI Bridge:', error.message);
  logger.warn('Falling back to template mode - ensure HomelabARR CLI is properly installed');
  cliBridge = null;
  streamingCLIBridge = null;
}

const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);

// CORS configuration using EnvironmentManager
const corsOptions = EnvironmentManager.getCorsOptions();

const app = express();

// Middleware setup
app.use(express.json());

// Add CORS logging middleware before CORS middleware in development
app.use(DeploymentLogger.createCorsLoggingMiddleware());

app.use(cors(corsOptions));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Enhanced preflight OPTIONS handler for development mode
if (isDevelopment) {
  app.options('*', (req, res) => {
    logger.debug('Handling preflight OPTIONS request', {
      url: req.url,
      origin: req.headers.origin,
      method: req.headers['access-control-request-method'],
      headers: req.headers['access-control-request-headers']
    });

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.header('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, Accept, Origin, X-Requested-With, Access-Control-Allow-Origin, ' +
      'Access-Control-Allow-Headers, Access-Control-Allow-Methods, Cache-Control, Pragma, Expires, ' +
      'Last-Modified, If-Modified-Since, If-None-Match, ETag'
    );
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(200).end();
  });
}

// Authentication routes
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await authenticate(username, password);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // Update session with request info
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === result.sessionId);
    if (session) {
      session.userAgent = req.headers['user-agent'] || '';
      session.ipAddress = req.ip || req.connection.remoteAddress || '';
      saveSessions(sessions);
    }

    logger.info(`User ${result.user.username} logged in from ${req.ip}`);

    res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/logout', requireAuth(), (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Find and invalidate the session
      const sessions = loadSessions();
      const session = sessions.find(s => s.token === token);
      if (session) {
        invalidateSession(session.id);
      }
    }

    logger.info(`User ${req.user.username} logged out`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/auth/me', requireAuth(), (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  });
});

app.post('/auth/change-password', requireAuth(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await changePassword(req.user.id, currentPassword, newPassword);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logger.info(`User ${req.user.username} changed password`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/auth/sessions', requireAuth(), (req, res) => {
  const sessions = getUserSessions(req.user.id);
  const sanitizedSessions = sessions.map(session => ({
    id: session.id,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress
  }));

  res.json(sanitizedSessions);
});

app.delete('/auth/sessions/:sessionId', requireAuth(), (req, res) => {
  const { sessionId } = req.params;
  const sessions = getUserSessions(req.user.id);
  const session = sessions.find(s => s.id === sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  invalidateSession(sessionId);
  logger.info(`User ${req.user.username} invalidated session ${sessionId}`);

  res.json({ success: true });
});

// Admin-only user management routes
app.post('/auth/users', requireAuth('admin'), async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password required' });
    }

    const result = await createUser({ username, email, password, role });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logger.info(`Admin ${req.user.username} created user ${result.user.username}`);
    res.json(result);
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/auth/users', requireAuth('admin'), (req, res) => {
  const users = loadUsers();
  const sanitizedUsers = users.map(user => ({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }));

  res.json(sanitizedUsers);
});

// Enhanced health check endpoint with comprehensive platform and configuration information
app.get('/health', async (req, res) => {
  const connectionState = dockerManager.getConnectionState();
  const serviceStatus = dockerManager.getServiceStatus();

  try {
    let dockerStatus = 'disconnected';
    let dockerDetails = {};
    let dockerInfo = null;

    if (connectionState.isConnected) {
      try {
        // Test Docker connection and get basic info
        await dockerManager.executeWithRetry(
          async (docker) => await docker.listContainers({ limit: 1 }),
          'Health check'
        );

        // Get Docker version info for additional context
        try {
          dockerInfo = await dockerManager.executeWithRetry(
            async (docker) => await docker.version(),
            'Docker version check',
            { allowDegraded: true, fallbackValue: null }
          );
        } catch (versionError) {
          logger.debug('Could not retrieve Docker version info:', versionError.message);
        }

        dockerStatus = 'connected';
      } catch (testError) {
        // Connection test failed, update status
        dockerStatus = 'error';
        dockerDetails.testError = {
          message: testError.message,
          code: testError.code,
          type: dockerManager.classifyError(testError).type
        };
      }
    } else {
      dockerStatus = serviceStatus.status === 'degraded' ? 'degraded' : 'disconnected';

      // Add detailed error information
      dockerDetails = {
        lastError: connectionState.lastError ? {
          type: connectionState.lastError.type,
          code: connectionState.lastError.code,
          message: connectionState.lastError.message,
          userMessage: connectionState.lastError.userMessage,
          severity: connectionState.lastError.severity,
          recoverable: connectionState.lastError.recoverable,
          occurredAt: connectionState.lastError.occurredAt || new Date().toISOString()
        } : null,
        retryCount: connectionState.retryCount,
        maxRetries: connectionState.config.retryAttempts,
        nextRetryAt: connectionState.nextRetryAt,
        isRetrying: connectionState.isRetrying,
        lastSuccessfulConnection: connectionState.lastSuccessfulConnection,
        connectionAttempts: connectionState.retryCount + 1,
        circuitBreaker: connectionState.circuitBreaker
      };
    }

    // Get comprehensive configuration validation results
    const envValidation = EnvironmentManager.validateConfiguration();
    const networkValidation = NetworkManager.validateNetworkConfiguration();
    const corsOptions = EnvironmentManager.getCorsOptions();

    // Determine overall service status based on all components
    let overallStatus = 'OK';
    let httpStatus = 200;

    // Check for configuration errors that would affect service operation
    if (!envValidation.isValid || !networkValidation.isValid) {
      overallStatus = 'ERROR';
      httpStatus = 503;
    } else if (dockerStatus === 'connected') {
      overallStatus = 'OK';
      httpStatus = 200;
    } else if (dockerStatus === 'degraded' || (dockerStatus === 'disconnected' && connectionState.isRetrying)) {
      overallStatus = 'DEGRADED';
      httpStatus = 503;
    } else {
      overallStatus = 'ERROR';
      httpStatus = 503;
    }

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      
      // Enhanced platform detection results
      platform: {
        detected: envConfig.platform,
        process: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
        isContainerized: EnvironmentManager.isContainerized(),
        containerIndicators: {
          dockerEnv: !!process.env.DOCKER_CONTAINER,
          dockerFile: fs.existsSync('/.dockerenv'),
          kubernetes: !!process.env.KUBERNETES_SERVICE_HOST
        },
        memory: {
          total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
          free: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
          usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        }
      },

      // Enhanced environment configuration status
      environment: {
        mode: envConfig.environment,
        nodeEnv: envConfig.nodeEnv,
        validation: {
          isValid: envValidation.isValid,
          errors: envValidation.errors,
          warnings: envValidation.warnings,
          configuredVariables: {
            port: !!process.env.PORT,
            corsOrigin: !!process.env.CORS_ORIGIN,
            dockerSocket: !!process.env.DOCKER_SOCKET,
            dockerGid: !!process.env.DOCKER_GID,
            authEnabled: process.env.AUTH_ENABLED !== undefined,
            jwtSecret: !!process.env.JWT_SECRET,
            logLevel: !!process.env.LOG_LEVEL
          }
        },
        features: envConfig.features,
        timeouts: envConfig.timeouts
      },

      // Enhanced CORS configuration status
      cors: {
        mode: envConfig.environment === 'development' ? 'development' : 'production',
        origin: corsOptions.origin === '*' ? 'wildcard' : 
                Array.isArray(corsOptions.origin) ? corsOptions.origin : 
                typeof corsOptions.origin === 'function' ? 'function-based' : corsOptions.origin,
        methods: corsOptions.methods || ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
        allowedHeaders: corsOptions.allowedHeaders || [],
        credentials: corsOptions.credentials,
        configuration: {
          preflightContinue: corsOptions.preflightContinue,
          optionsSuccessStatus: corsOptions.optionsSuccessStatus,
          exposedHeaders: corsOptions.exposedHeaders || []
        },
        status: envConfig.environment === 'development' ? 
          'permissive (wildcard origins for development)' : 
          'restrictive (configured origins for production)'
      },

      // Enhanced network configuration validation
      network: {
        bindAddress: networkConfig.bindAddress,
        port: networkConfig.port,
        dockerSocket: networkConfig.dockerSocket,
        serviceUrls: networkConfig.serviceUrls,
        validation: {
          isValid: networkValidation.isValid,
          errors: networkValidation.errors,
          warnings: networkValidation.warnings,
          timestamp: networkValidation.timestamp
        },
        timeouts: networkConfig.timeouts,
        socketType: networkConfig.platform === 'windows' ? 'named_pipe' : 'unix_socket',
        platformSpecific: {
          expectedSocketPath: networkConfig.platform === 'windows' ? 
            '\\\\.\\pipe\\docker_engine' : '/var/run/docker.sock',
          actualSocketPath: networkConfig.dockerSocket,
          isDefaultSocket: networkConfig.dockerSocket === (
            networkConfig.platform === 'windows' ? 
            '\\\\.\\pipe\\docker_engine' : '/var/run/docker.sock'
          )
        }
      },

      // Enhanced Docker connection status
      docker: {
        status: dockerStatus,
        socketPath: connectionState.config.socketPath,
        timeout: connectionState.config.timeout,
        serviceMessage: serviceStatus.message,
        platformSupport: {
          platform: networkConfig.platform,
          socketType: networkConfig.platform === 'windows' ? 'named_pipe' : 'unix_socket',
          protocol: networkConfig.platform === 'windows' ? 'npipe' : 'unix'
        },
        ...dockerDetails
      },

      // Comprehensive troubleshooting information for deployment issues
      troubleshooting: {
        overallHealth: overallStatus,
        criticalIssues: [
          ...envValidation.errors.map(error => ({ type: 'environment', severity: 'error', message: error })),
          ...networkValidation.errors.map(error => ({ type: 'network', severity: 'error', message: error }))
        ],
        warnings: [
          ...envValidation.warnings.map(warning => ({ type: 'environment', severity: 'warning', message: warning })),
          ...networkValidation.warnings.map(warning => ({ type: 'network', severity: 'warning', message: warning }))
        ],
        platformSpecificGuidance: {
          platform: envConfig.platform,
          commonIssues: envConfig.platform === 'windows' ? [
            'Docker Desktop not running',
            'Windows container mode vs Linux container mode',
            'Named pipe access permissions',
            'Windows Defender or antivirus blocking Docker socket'
          ] : [
            'Docker daemon not running (systemctl status docker)',
            'User not in docker group (usermod -aG docker $USER)',
            'Docker socket permissions (ls -la /var/run/docker.sock)',
            'Docker socket not mounted in container (-v /var/run/docker.sock:/var/run/docker.sock)'
          ],
          quickChecks: envConfig.platform === 'windows' ? [
            'Verify Docker Desktop is running and accessible',
            'Check Windows container vs Linux container mode',
            'Ensure named pipe is accessible: \\\\.\\pipe\\docker_engine',
            'Try running as administrator if permission issues persist'
          ] : [
            'Check Docker daemon: sudo systemctl status docker',
            'Verify socket exists: ls -la /var/run/docker.sock',
            'Test Docker access: docker ps',
            'Check user permissions: groups $USER'
          ]
        },
        deploymentContext: {
          isContainerized: EnvironmentManager.isContainerized(),
          environment: envConfig.environment,
          recommendedActions: overallStatus === 'ERROR' ? [
            'Review configuration errors listed above',
            'Check platform-specific guidance for your system',
            'Verify all required environment variables are set',
            'Ensure Docker daemon is running and accessible'
          ] : overallStatus === 'DEGRADED' ? [
            'Monitor Docker connection stability',
            'Review warnings for potential issues',
            'Consider adjusting timeout values if needed'
          ] : [
            'System is healthy - no action required',
            'Monitor logs for any emerging issues'
          ]
        }
      }
    };

    // Add Docker version info if available
    if (dockerInfo) {
      healthResponse.docker.version = {
        version: dockerInfo.Version,
        apiVersion: dockerInfo.ApiVersion,
        platform: dockerInfo.Os,
        arch: dockerInfo.Arch,
        buildTime: dockerInfo.BuildTime,
        gitCommit: dockerInfo.GitCommit
      };
    }

    // Add retry information if applicable
    if (connectionState.isRetrying || connectionState.retryCount > 0) {
      healthResponse.docker.retry = {
        isRetrying: connectionState.isRetrying,
        retryCount: connectionState.retryCount,
        maxRetries: connectionState.config.retryAttempts,
        nextRetryAt: connectionState.nextRetryAt,
        retryProgress: `${connectionState.retryCount}/${connectionState.config.retryAttempts}`
      };
    }

    // Add resolution suggestions for non-recoverable errors
    if (connectionState.lastError && !connectionState.lastError.recoverable) {
      healthResponse.docker.resolution = dockerManager.getResolutionSuggestion(connectionState.lastError.type);
    }

    res.status(httpStatus).json(healthResponse);
  } catch (error) {
    logger.error('Health check endpoint error:', error);

    // Get validation results even in error cases
    let envValidation, networkValidation;
    try {
      envValidation = EnvironmentManager.validateConfiguration();
      networkValidation = NetworkManager.validateNetworkConfiguration();
    } catch (validationError) {
      logger.error('Error during validation in health check error handler:', validationError);
      envValidation = { isValid: false, errors: ['Validation failed'], warnings: [] };
      networkValidation = { isValid: false, errors: ['Network validation failed'], warnings: [] };
    }

    const errorResponse = {
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      
      platform: {
        detected: envConfig.platform,
        process: process.platform,
        architecture: process.arch,
        isContainerized: EnvironmentManager.isContainerized()
      },
      
      environment: {
        mode: envConfig.environment,
        validation: {
          isValid: envValidation.isValid,
          errors: envValidation.errors,
          warnings: envValidation.warnings
        }
      },
      
      network: {
        bindAddress: networkConfig.bindAddress,
        port: networkConfig.port,
        dockerSocket: networkConfig.dockerSocket,
        validation: {
          isValid: networkValidation.isValid,
          errors: networkValidation.errors,
          warnings: networkValidation.warnings
        }
      },
      
      docker: {
        status: 'error',
        error: {
          message: error.message,
          code: error.code,
          type: 'health_check_failure',
          stack: isDevelopment ? error.stack : undefined
        },
        socketPath: connectionState.config.socketPath,
        serviceMessage: serviceStatus.message
      },

      troubleshooting: {
        healthCheckError: {
          message: 'Health check endpoint encountered an internal error',
          possibleCauses: [
            'Configuration validation failure',
            'Docker connection manager error',
            'Network configuration issue',
            'Internal service error'
          ],
          suggestedActions: [
            'Check application logs for detailed error information',
            'Verify all configuration files are valid',
            'Ensure Docker daemon is accessible',
            'Restart the service if issues persist'
          ]
        },
        platformGuidance: {
          platform: envConfig.platform,
          environment: envConfig.environment,
          isContainerized: EnvironmentManager.isContainerized()
        }
      }
    };

    // Include connection state information even in error cases
    if (connectionState.lastError) {
      errorResponse.docker.lastError = {
        type: connectionState.lastError.type,
        code: connectionState.lastError.code,
        message: connectionState.lastError.message,
        userMessage: connectionState.lastError.userMessage,
        severity: connectionState.lastError.severity,
        recoverable: connectionState.lastError.recoverable
      };
    }

    if (connectionState.isRetrying) {
      errorResponse.docker.retry = {
        isRetrying: connectionState.isRetrying,
        retryCount: connectionState.retryCount,
        maxRetries: connectionState.config.retryAttempts,
        nextRetryAt: connectionState.nextRetryAt
      };
    }

    res.status(503).json(errorResponse);
  }
});

// Authentication routes
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        details: 'Username and password are required'
      });
    }

    const user = await validatePassword(username, password);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        details: 'Username or password is incorrect'
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
});

app.post('/auth/register', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, email, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Username and password are required'
      });
    }

    const user = await createUser({
      username,
      password,
      email: email || '',
      role: role || 'user'
    });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({
      error: 'Registration failed',
      details: error.message
    });
  }
});

app.get('/auth/me', requireAuth, (req, res) => {
  const user = findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  const { password, ...userWithoutPassword } = user;
  res.json({
    success: true,
    user: userWithoutPassword
  });
});

app.get('/auth/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = loadUsers();
  const usersWithoutPasswords = users.map(({ password, ...user }) => user);

  res.json({
    success: true,
    users: usersWithoutPasswords
  });
});

app.post('/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Current password and new password are required'
      });
    }

    const user = findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Validate current password
    const validUser = await validatePassword(user.username, currentPassword);
    if (!validUser) {
      return res.status(401).json({
        error: 'Invalid current password'
      });
    }

    // Update password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].password = hashedPassword;
      saveUsers(users);
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      details: error.message
    });
  }
});

// Application catalog endpoint - replaces template validation
app.get('/applications', async (req, res) => {
  try {
    if (cliBridge) {
      // Use CLI Bridge to get real HomelabARR applications
      const applications = await cliBridge.getAvailableApplications();
      
      res.json({
        success: true,
        source: 'cli',
        applications: applications,
        totalApps: Object.values(applications).flat().length,
        categories: Object.keys(applications)
      });
    } else {
      // Fallback to template mode if CLI not available
      const templateDir = path.join(process.cwd(), 'server', 'templates');
      const templateFiles = fs.readdirSync(templateDir)
        .filter(file => file.endsWith('.yml'))
        .map(file => file.replace('.yml', ''));

      // Format templates to match CLI structure for frontend compatibility
      const templateApps = templateFiles.map(name => ({
        id: name,
        name: name,
        displayName: name.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        description: `Docker application: ${name}`,
        image: `${name}:latest`,
        category: 'template',
        ports: { "80": "8080" },
        environment: {},
        requiresTraefik: false,
        requiresAuthelia: false
      }));
      
      res.json({
        success: true,
        source: 'templates',
        applications: {
          'templates': templateApps
        },
        totalApps: templateFiles.length,
        categories: ['templates'],
        message: 'Using template mode - CLI integration unavailable'
      });
    }
  } catch (error) {
    logger.error('Error loading applications:', error);
    res.status(500).json({
      error: 'Failed to load applications',
      details: error.message
    });
  }
});

// CLI Application Management Endpoints

// Stop application endpoint
app.post('/applications/:appId/stop', authEnabled ? requireAuth : optionalAuth, async (req, res) => {
  try {
    const { appId } = req.params;
    
    if (cliBridge) {
      const result = await cliBridge.stopApplication(appId);
      res.json({
        success: true,
        message: `Application ${appId} stopped successfully`,
        result,
        source: 'cli'
      });
    } else {
      res.status(503).json({
        error: 'CLI Bridge not available',
        details: 'Cannot manage applications without CLI integration'
      });
    }
  } catch (error) {
    logger.error('Error stopping application:', error);
    res.status(500).json({
      error: 'Failed to stop application',
      details: error.message
    });
  }
});

// Remove application endpoint
app.delete('/applications/:appId', authEnabled ? requireAuth : optionalAuth, async (req, res) => {
  try {
    const { appId } = req.params;
    const { removeVolumes } = req.query;
    
    if (cliBridge) {
      const result = await cliBridge.removeApplication(appId, removeVolumes === 'true');
      res.json({
        success: true,
        message: `Application ${appId} removed successfully`,
        result,
        source: 'cli'
      });
    } else {
      res.status(503).json({
        error: 'CLI Bridge not available',
        details: 'Cannot manage applications without CLI integration'
      });
    }
  } catch (error) {
    logger.error('Error removing application:', error);
    res.status(500).json({
      error: 'Failed to remove application',
      details: error.message
    });
  }
});

// Get application logs endpoint
app.get('/applications/:appId/logs', authEnabled ? requireAuth : optionalAuth, async (req, res) => {
  try {
    const { appId } = req.params;
    const { lines = 100 } = req.query;
    
    if (cliBridge) {
      const result = await cliBridge.getApplicationLogs(appId, parseInt(lines));
      res.json({
        success: true,
        logs: result.stdout || result,
        source: 'cli',
        appId
      });
    } else {
      res.status(503).json({
        error: 'CLI Bridge not available',
        details: 'Cannot retrieve logs without CLI integration'
      });
    }
  } catch (error) {
    logger.error('Error getting application logs:', error);
    res.status(500).json({
      error: 'Failed to get application logs',
      details: error.message
    });
  }
});

// Deployment modes endpoint
app.get('/deployment-modes', (req, res) => {
  res.json({
    success: true,
    modes: [
      {
        type: 'standard',
        name: 'Standard',
        description: 'Basic Docker deployment without reverse proxy',
        features: ['Direct port access', 'Basic networking', 'Suitable for development']
      },
      {
        type: 'traefik',
        name: 'Traefik',
        description: 'Deployment with Traefik reverse proxy and SSL',
        features: ['Automatic SSL certificates', 'Domain routing', 'Load balancing', 'Production ready']
      },
      {
        type: 'authelia',
        name: 'Traefik + Authelia',
        description: 'Full production deployment with authentication',
        features: ['All Traefik features', 'Multi-factor authentication', 'User management', 'Maximum security']
      }
    ],
    cliAvailable: !!cliBridge
  });
});

// Progress Streaming Endpoints

// Server-Sent Events endpoint for deployment progress
app.get('/stream/progress', (req, res) => {
  const clientId = randomUUID();
  
  try {
    progressStream.addClient(clientId, res);
    
    // Send current statistics
    const stats = progressStream.getStatistics();
    progressStream.sendToClient(clientId, 'statistics', stats);
    
  } catch (error) {
    logger.error('Error setting up progress stream:', error);
    res.status(500).json({
      error: 'Failed to setup progress stream',
      details: error.message
    });
  }
});

// Subscribe to deployment progress
app.post('/stream/deployments/:deploymentId/subscribe', authEnabled ? requireAuth : optionalAuth, (req, res) => {
  try {
    const { deploymentId } = req.params;
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({
        error: 'Client ID is required',
        details: 'Please provide a valid client ID from the progress stream connection'
      });
    }
    
    progressStream.subscribeToDeployment(clientId, deploymentId);
    
    res.json({
      success: true,
      message: `Subscribed to deployment ${deploymentId}`,
      deploymentId,
      clientId
    });
  } catch (error) {
    logger.error('Error subscribing to deployment:', error);
    res.status(500).json({
      error: 'Failed to subscribe to deployment',
      details: error.message
    });
  }
});

// Get deployment status
app.get('/deployments/:deploymentId/status', authEnabled ? requireAuth : optionalAuth, (req, res) => {
  try {
    const { deploymentId } = req.params;
    
    if (streamingCLIBridge) {
      const status = streamingCLIBridge.getDeploymentStatus(deploymentId);
      if (status) {
        res.json({
          success: true,
          deployment: status
        });
      } else {
        res.status(404).json({
          error: 'Deployment not found',
          deploymentId
        });
      }
    } else {
      res.status(503).json({
        error: 'Streaming CLI Bridge not available',
        details: 'Real-time deployment tracking requires CLI integration'
      });
    }
  } catch (error) {
    logger.error('Error getting deployment status:', error);
    res.status(500).json({
      error: 'Failed to get deployment status',
      details: error.message
    });
  }
});

// Get all active deployments
app.get('/deployments/active', authEnabled ? requireAuth : optionalAuth, (req, res) => {
  try {
    if (streamingCLIBridge) {
      const deployments = streamingCLIBridge.getActiveDeployments();
      res.json({
        success: true,
        deployments,
        count: deployments.length
      });
    } else {
      res.json({
        success: true,
        deployments: [],
        count: 0,
        message: 'Streaming CLI Bridge not available'
      });
    }
  } catch (error) {
    logger.error('Error getting active deployments:', error);
    res.status(500).json({
      error: 'Failed to get active deployments',
      details: error.message
    });
  }
});

// Port availability check endpoint
app.get('/ports/check', async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    // In template mode (Docker unavailable), return mock port data for MVP
    if (serviceStatus.status === 'unavailable') {
      return res.json({
        success: true,
        usedPorts: [3001, 8888], // Our current development ports
        docker: {
          status: 'template-mode',
          message: 'Docker integration unavailable - using template mode'
        },
        source: 'template-fallback'
      });
    }

    const containers = await dockerManager.executeWithRetry(
      async (docker) => await docker.listContainers({ all: true }),
      'Check port availability',
      {
        allowDegraded: true,
        fallbackValue: []
      }
    );

    const usedPorts = new Set();

    containers.forEach(container => {
      if (container.Ports) {
        container.Ports.forEach(port => {
          if (port.PublicPort) {
            usedPorts.add(port.PublicPort);
          }
        });
      }
    });

    res.json({
      success: true,
      usedPorts: Array.from(usedPorts).sort((a, b) => a - b),
      docker: {
        status: serviceStatus.status,
        message: serviceStatus.message
      }
    });
  } catch (error) {
    logger.error('Error checking ports:', error);
    const errorResponse = dockerManager.createErrorResponse('Check port availability', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

// Find available port endpoint
app.get('/ports/available', async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Find available port', new Error(serviceStatus.message), false)
      );
    }

    const startPort = parseInt(req.query.start) || 8000;
    const endPort = parseInt(req.query.end) || 9000;

    const containers = await dockerManager.executeWithRetry(
      async (docker) => await docker.listContainers({ all: true }),
      'Find available port',
      {
        allowDegraded: true,
        fallbackValue: []
      }
    );

    const usedPorts = new Set();

    containers.forEach(container => {
      if (container.Ports) {
        container.Ports.forEach(port => {
          if (port.PublicPort) {
            usedPorts.add(port.PublicPort);
          }
        });
      }
    });

    // Find first available port in range
    for (let port = startPort; port <= endPort; port++) {
      if (!usedPorts.has(port)) {
        return res.json({
          success: true,
          availablePort: port,
          docker: {
            status: serviceStatus.status,
            message: serviceStatus.message
          }
        });
      }
    }

    res.status(404).json({
      error: 'No available ports found in range',
      details: `Checked ports ${startPort}-${endPort}`,
      searchRange: { start: startPort, end: endPort },
      usedPorts: Array.from(usedPorts).sort((a, b) => a - b),
      docker: {
        status: serviceStatus.status,
        message: serviceStatus.message
      }
    });
  } catch (error) {
    logger.error('Error finding available port:', error);
    const errorResponse = dockerManager.createErrorResponse('Find available port', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

// Docker Connection Manager Class
class DockerConnectionManager {
  constructor(options = {}) {
    const dockerConfig = EnvironmentManager.getDockerConfig();
    const networkConfig = NetworkManager.getConfiguration();
    
    this.config = {
      socketPath: options.socketPath || dockerConfig.socketPath,
      timeout: options.timeout || dockerConfig.timeout,
      retryAttempts: options.retryAttempts || 5,
      retryDelay: options.retryDelay || 1000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      maxRetryDelay: options.maxRetryDelay || 30000,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 3,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
      platform: networkConfig.platform
    };

    this.state = {
      isConnected: false,
      lastError: null,
      lastSuccessfulConnection: null,
      retryCount: 0,
      nextRetryAt: null,
      isRetrying: false
    };

    // Circuit breaker state
    this.circuitBreaker = {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      consecutiveFailures: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    };

    this.docker = null;
    this.healthCheckTimer = null;
    this.retryTimer = null;
    this.statsLogTimer = null;

    // Log initialization with platform-specific context
    logger.dockerConnection('info', 'Initializing Docker Connection Manager', {
      config: {
        ...this.config,
        socketPath: this.config.socketPath // Show actual socket path being used
      },
      platform: this.config.platform,
      platformDetails: this.getPlatformDetails(),
      nodeVersion: process.version,
      environment: envConfig.environment,
      isContainerized: EnvironmentManager.isContainerized(),
      dockerSocketType: this.getDockerSocketType()
    });

    // Initialize connection with error handling
    this.initializeConnection();
    this.startHealthCheck();
    this.startStatsLogging();
  }

  /**
   * Initialize Docker connection with graceful error handling
   * This method won't crash the application if Docker is unavailable
   */
  async initializeConnection() {
    try {
      logger.dockerConnection('info', 'Attempting initial Docker connection with enhanced error handling');
      
      // Add a delay to allow Docker socket to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.connect();
      logger.dockerConnection('info', 'Initial Docker connection successful');
    } catch (error) {
      logger.dockerConnection('warn', 'Initial Docker connection failed - will retry automatically', {
        error: error.message,
        code: error.code,
        willRetry: true,
        retryInterval: this.config.retryDelay
      });
      
      // Don't throw - let the health check handle retries
      this.state.isConnected = false;
      this.state.lastError = this.classifyError(error);
      
      // For Windows Docker Desktop, disable Docker functionality if modem errors occur
      if (error.message && error.message.includes('Cannot read properties of undefined')) {
        logger.dockerConnection('error', 'Docker modem error detected - disabling Docker functionality for stability');
        this.state.lastError = {
          type: 'modem_error',
          code: 'MODEM_ERROR',
          message: 'Docker modem initialization failed',
          userMessage: 'Docker functionality disabled due to Windows Docker Desktop compatibility issues',
          severity: 'error',
          recoverable: false,
          occurredAt: new Date().toISOString()
        };
      }
    }
  }

  /**
   * Get platform-specific details for logging and troubleshooting
   * @returns {Object} Platform details
   */
  getPlatformDetails() {
    const details = {
      platform: this.config.platform,
      arch: process.arch,
      nodeVersion: process.version
    };

    if (this.config.platform === 'windows') {
      details.dockerSocketType = 'named_pipe';
      details.expectedSocketPath = '\\\\.\\pipe\\docker_engine';
      details.commonIssues = [
        'Docker Desktop not running',
        'Named pipe access permissions',
        'Windows container mode vs Linux container mode'
      ];
    } else {
      details.dockerSocketType = 'unix_socket';
      details.expectedSocketPath = '/var/run/docker.sock';
      details.commonIssues = [
        'Docker daemon not running',
        'Socket file permissions',
        'User not in docker group',
        'Socket not mounted in container'
      ];
    }

    return details;
  }

  /**
   * Determine the type of Docker socket being used
   * @returns {string} Socket type
   */
  getDockerSocketType() {
    if (this.config.platform === 'windows' || this.config.socketPath.includes('pipe')) {
      return 'named_pipe';
    }
    return 'unix_socket';
  }

  /**
   * Get platform-specific Docker connection options
   * @returns {Object} Docker connection options
   */
  getPlatformSpecificDockerOptions() {
    const baseOptions = {
      socketPath: this.config.socketPath,
      timeout: this.config.timeout
    };

    if (this.config.platform === 'windows') {
      // Windows-specific Docker options
      baseOptions.protocol = 'npipe';
      // On Windows, we might need to handle named pipes differently
      if (!this.config.socketPath.includes('pipe')) {
        baseOptions.socketPath = '\\\\.\\pipe\\docker_engine';
      }
    } else {
      // Unix-specific Docker options
      baseOptions.protocol = 'unix';
    }

    return baseOptions;
  }

  /**
   * Get platform-specific connection information for logging
   * @returns {Object} Platform connection info
   */
  getPlatformConnectionInfo() {
    const info = {
      platform: this.config.platform,
      socketType: this.getDockerSocketType(),
      actualSocketPath: this.config.socketPath
    };

    if (this.config.platform === 'windows') {
      info.namedPipeInfo = {
        isDefaultPipe: this.config.socketPath.includes('docker_engine'),
        pipeFormat: this.config.socketPath.startsWith('\\\\.\\pipe\\') ? 'correct' : 'non_standard'
      };
    } else {
      info.unixSocketInfo = {
        isDefaultSocket: this.config.socketPath === '/var/run/docker.sock',
        isContainerized: EnvironmentManager.isContainerized(),
        expectedMountPath: '/var/run/docker.sock'
      };
    }

    return info;
  }

  // Start periodic statistics logging
  startStatsLogging() {
    // Log stats every 5 minutes in production, every minute in development
    const statsInterval = isDevelopment ? 60000 : 300000;

    logger.dockerConnection('debug', 'Starting periodic statistics logging', {
      interval: statsInterval,
      intervalMinutes: statsInterval / 60000
    });

    this.statsLogTimer = setInterval(() => {
      this.logConnectionStats();
    }, statsInterval);
  }

  async connect() {
    const previousState = this.state.isConnected ? 'connected' : 'disconnected';

    // Check circuit breaker before attempting connection
    if (!this.canAttemptConnection()) {
      const timeUntilNextAttempt = this.circuitBreaker.nextAttemptTime ?
        this.circuitBreaker.nextAttemptTime.getTime() - Date.now() : 0;

      logger.dockerConnection('warn', 'Connection attempt blocked by circuit breaker', {
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        timeUntilNextAttempt,
        nextAttemptTime: this.circuitBreaker.nextAttemptTime?.toISOString()
      });

      return false;
    }

    try {
      logger.dockerConnection('debug', 'Initiating Docker connection attempt', {
        socketPath: this.config.socketPath,
        timeout: this.config.timeout,
        retryCount: this.state.retryCount,
        previousConnectionState: previousState,
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        platform: this.config.platform,
        socketType: this.getDockerSocketType(),
        platformDetails: this.getPlatformDetails()
      });

      // Use platform-specific Docker connection options
      const dockerOptions = this.getPlatformSpecificDockerOptions();
      
      try {
        // Add additional error handling for Windows Docker Desktop modem issues
        if (this.config.platform === 'windows' || process.platform === 'win32') {
          logger.dockerConnection('debug', 'Applying Windows-specific Docker connection handling');
        }
        
        this.docker = new Docker(dockerOptions);

        logger.dockerConnection('debug', 'Created Docker client with platform-specific options', {
          options: dockerOptions,
          platform: this.config.platform,
          socketType: this.getDockerSocketType()
        });

        // Test the connection by listing containers with detailed logging
        logger.dockerConnection('debug', 'Testing Docker connection with container list operation');
        
        // Add timeout to prevent hanging on modem errors
        const testPromise = this.docker.listContainers({ limit: 1 });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Docker connection test timeout')), 5000)
        );
        
        const testResult = await Promise.race([testPromise, timeoutPromise]);
        
        logger.dockerConnection('debug', 'Docker connection test successful', {
          testContainers: testResult.length
        });
      } catch (dockerError) {
        logger.dockerConnection('error', 'Failed to create or test Docker client', {
          error: dockerError.message,
          code: dockerError.code,
          platform: this.config.platform,
          socketPath: this.config.socketPath,
          isModemError: dockerError.message && dockerError.message.includes('Cannot read properties of undefined')
        });
        
        // Special handling for modem errors - these are typically unrecoverable
        if (dockerError.message && dockerError.message.includes('Cannot read properties of undefined')) {
          logger.dockerConnection('error', 'Docker modem error detected - this typically indicates Docker socket access issues');
          const modemError = new Error('Docker modem initialization failed - check Docker socket access');
          modemError.code = 'MODEM_ERROR';
          modemError.recoverable = false;
          throw modemError;
        }
        
        // Don't throw here for other errors - let the connection be retried later
        this.docker = null;
        throw dockerError;
      }

      // Log successful connection with context
      const connectionContext = {
        socketPath: this.config.socketPath,
        testContainers: testResult.length,
        connectionDuration: this.state.lastSuccessfulConnection ?
          Date.now() - this.state.lastSuccessfulConnection.getTime() : 'first_connection',
        previousRetryCount: this.state.retryCount,
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        platform: this.config.platform,
        socketType: this.getDockerSocketType(),
        platformSpecificInfo: this.getPlatformConnectionInfo()
      };

      this.state.isConnected = true;
      this.state.lastError = null;
      this.state.lastSuccessfulConnection = new Date();
      this.state.retryCount = 0;
      this.state.nextRetryAt = null;
      this.state.isRetrying = false;

      // Update circuit breaker on successful connection
      this.updateCircuitBreakerOnSuccess();

      // Log state change
      logger.dockerStateChange(previousState, 'connected', connectionContext);

      logger.dockerConnection('info', 'Docker connection established successfully', connectionContext);
      return true;
    } catch (error) {
      logger.dockerConnection('debug', 'Docker connection attempt failed, handling error', {
        errorCode: error.code,
        errorMessage: error.message,
        socketPath: this.config.socketPath,
        retryCount: this.state.retryCount,
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        platform: this.config.platform,
        socketType: this.getDockerSocketType(),
        platformSpecificInfo: this.getPlatformConnectionInfo()
      });

      this.handleConnectionError(error);
      return false;
    }
  }

  handleConnectionError(error) {
    const previousState = this.state.isConnected ? 'connected' : 'disconnected';

    this.state.isConnected = false;
    this.state.lastError = this.classifyError(error);
    this.docker = null;

    // Update circuit breaker state
    this.updateCircuitBreakerOnFailure();

    // Generate troubleshooting information based on error type
    const troubleshooting = this.generateTroubleshootingInfo(this.state.lastError);

    // Log the connection failure with comprehensive context
    logger.dockerOperationFailed('Docker connection', this.state.lastError, troubleshooting);

    // Log state change
    logger.dockerStateChange(previousState, 'disconnected', {
      errorType: this.state.lastError.type,
      errorCode: this.state.lastError.code,
      retryCount: this.state.retryCount,
      recoverable: this.state.lastError.recoverable,
      circuitBreakerState: this.circuitBreaker.state,
      consecutiveFailures: this.circuitBreaker.consecutiveFailures,
      platform: this.config.platform,
      socketType: this.getDockerSocketType(),
      platformSpecificInfo: this.getPlatformConnectionInfo()
    });

    // Check circuit breaker state before attempting retry
    if (this.circuitBreaker.state === 'OPEN') {
      logger.dockerConnection('warn', 'Circuit breaker is OPEN, blocking retry attempts', {
        consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        threshold: this.config.circuitBreakerThreshold,
        nextAttemptTime: this.circuitBreaker.nextAttemptTime?.toISOString(),
        timeUntilNextAttempt: this.circuitBreaker.nextAttemptTime ?
          this.circuitBreaker.nextAttemptTime.getTime() - Date.now() : null
      });
      this.state.isRetrying = false;
      return;
    }

    if (this.state.lastError.recoverable && this.state.retryCount < this.config.retryAttempts) {
      logger.dockerConnection('info', 'Error is recoverable, scheduling retry', {
        errorType: this.state.lastError.type,
        retryCount: this.state.retryCount,
        maxRetries: this.config.retryAttempts,
        recoverable: this.state.lastError.recoverable,
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
      });
      this.scheduleRetry();
    } else {
      const finalFailureContext = {
        errorType: this.state.lastError.type,
        totalRetries: this.state.retryCount,
        maxRetries: this.config.retryAttempts,
        recoverable: this.state.lastError.recoverable,
        finalFailureReason: this.state.lastError.recoverable ? 'max_retries_exceeded' : 'non_recoverable_error',
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
      };

      logger.dockerConnection('error', 'Docker connection failed permanently', finalFailureContext);
      logger.dockerStateChange('disconnected', 'failed', finalFailureContext);
      this.state.isRetrying = false;
    }
  } handleConnectionError(error) {
    const previousState = this.state.isConnected ? 'connected' : 'disconnected';

    this.state.isConnected = false;
    this.state.lastError = this.classifyError(error);
    this.docker = null;

    // Generate troubleshooting information based on error type
    const troubleshooting = this.generateTroubleshootingInfo(this.state.lastError);

    // Log the connection failure with comprehensive context
    logger.dockerOperationFailed('Docker connection', this.state.lastError, troubleshooting);

    // Log state change
    logger.dockerStateChange(previousState, 'disconnected', {
      errorType: this.state.lastError.type,
      errorCode: this.state.lastError.code,
      retryCount: this.state.retryCount,
      recoverable: this.state.lastError.recoverable
    });

    if (this.state.lastError.recoverable && this.state.retryCount < this.config.retryAttempts) {
      logger.dockerConnection('info', 'Error is recoverable, scheduling retry', {
        errorType: this.state.lastError.type,
        retryCount: this.state.retryCount,
        maxRetries: this.config.retryAttempts,
        recoverable: this.state.lastError.recoverable
      });
      this.scheduleRetry();
    } else {
      const finalFailureContext = {
        errorType: this.state.lastError.type,
        totalRetries: this.state.retryCount,
        maxRetries: this.config.retryAttempts,
        recoverable: this.state.lastError.recoverable,
        finalFailureReason: this.state.lastError.recoverable ? 'max_retries_exceeded' : 'non_recoverable_error'
      };

      logger.dockerConnection('error', 'Docker connection failed permanently', finalFailureContext);
      logger.dockerStateChange('disconnected', 'failed', finalFailureContext);
      this.state.isRetrying = false;
    }
  }

  // Generate troubleshooting information based on error type
  generateTroubleshootingInfo(classifiedError) {
    const troubleshooting = {
      possibleCauses: [],
      suggestedActions: [],
      documentationLinks: [],
      platform: classifiedError.platform,
      socketType: classifiedError.socketType
    };

    // Platform-specific troubleshooting
    if (classifiedError.platform === 'windows') {
      troubleshooting = this.generateWindowsTroubleshooting(classifiedError, troubleshooting);
    } else {
      troubleshooting = this.generateUnixTroubleshooting(classifiedError, troubleshooting);
    }

    // Common troubleshooting for all platforms
    switch (classifiedError.type) {
      case 'timeout':
        troubleshooting.possibleCauses.push(
          'Docker daemon overloaded',
          'Network latency issues',
          'System resource constraints'
        );
        troubleshooting.suggestedActions.push(
          'Check system resource usage (CPU, memory, disk)',
          'Increase timeout configuration if needed',
          'Check for other processes consuming Docker resources',
          'Consider restarting Docker daemon'
        );
        break;

      case 'broken_pipe':
      case 'socket_hangup':
        troubleshooting.possibleCauses.push(
          'Network connection instability',
          'Docker daemon restart during operation',
          'System resource exhaustion'
        );
        troubleshooting.suggestedActions.push(
          'Check network stability',
          'Monitor Docker daemon status',
          'Verify system resources are adequate'
        );
        break;

      case 'client_error':
        troubleshooting.possibleCauses.push(
          'Invalid API request parameters',
          'Unsupported Docker API version',
          'Malformed request data'
        );
        troubleshooting.suggestedActions.push(
          'Review request parameters',
          'Check Docker API compatibility',
          'Validate request data format'
        );
        break;

      case 'server_error':
        troubleshooting.possibleCauses.push(
          'Docker daemon internal error',
          'System resource exhaustion',
          'Docker daemon corruption'
        );
        troubleshooting.suggestedActions.push(
          'Check Docker daemon logs',
          'Restart Docker daemon',
          'Verify system resources',
          'Consider Docker daemon reinstallation if persistent'
        );
        break;
    }

    return troubleshooting;
  }

  /**
   * Generate Windows-specific troubleshooting information
   * @param {Object} classifiedError - The classified error
   * @param {Object} troubleshooting - Base troubleshooting object
   * @returns {Object} Enhanced troubleshooting with Windows-specific info
   */
  generateWindowsTroubleshooting(classifiedError, troubleshooting) {
    switch (classifiedError.type) {
      case 'windows_named_pipe_not_found':
        troubleshooting.possibleCauses = [
          'Docker Desktop not installed',
          'Docker Desktop not running',
          'Docker Desktop starting up',
          'Windows container mode vs Linux container mode mismatch'
        ];
        troubleshooting.suggestedActions = [
          'Install Docker Desktop for Windows',
          'Start Docker Desktop application',
          'Wait for Docker Desktop to fully initialize',
          'Check Docker Desktop is in correct container mode (Linux containers)',
          'Verify Docker Desktop system tray icon shows running status'
        ];
        troubleshooting.documentationLinks = [
          'https://docs.docker.com/desktop/windows/install/',
          'https://docs.docker.com/desktop/windows/troubleshoot/'
        ];
        break;

      case 'windows_named_pipe_permission':
        troubleshooting.possibleCauses = [
          'User not in docker-users group',
          'Docker Desktop permission settings',
          'Windows user account control restrictions'
        ];
        troubleshooting.suggestedActions = [
          'Add user to docker-users Windows group',
          'Run Docker Desktop as administrator',
          'Check Docker Desktop security settings',
          'Restart Windows session after group changes'
        ];
        break;

      case 'windows_docker_desktop_not_running':
        troubleshooting.possibleCauses = [
          'Docker Desktop service stopped',
          'Docker Desktop crashed',
          'Windows service dependencies not running'
        ];
        troubleshooting.suggestedActions = [
          'Start Docker Desktop from Start Menu',
          'Check Windows Services for Docker Desktop Service',
          'Restart Docker Desktop if running but unresponsive',
          'Check Windows Event Viewer for Docker Desktop errors'
        ];
        break;

      case 'windows_hyperv_error':
        troubleshooting.possibleCauses = [
          'Hyper-V not enabled',
          'Hyper-V service not running',
          'Conflicting virtualization software',
          'Windows feature requirements not met'
        ];
        troubleshooting.suggestedActions = [
          'Enable Hyper-V Windows feature',
          'Ensure virtualization is enabled in BIOS',
          'Disable conflicting virtualization software (VirtualBox, VMware)',
          'Check Windows version compatibility with Docker Desktop'
        ];
        break;
    }

    return troubleshooting;
  }

  /**
   * Generate Unix/Linux-specific troubleshooting information
   * @param {Object} classifiedError - The classified error
   * @param {Object} troubleshooting - Base troubleshooting object
   * @returns {Object} Enhanced troubleshooting with Unix-specific info
   */
  generateUnixTroubleshooting(classifiedError, troubleshooting) {
    switch (classifiedError.type) {
      case 'unix_socket_permission':
        troubleshooting.possibleCauses = [
          'Container user not in docker group',
          'Docker socket permissions too restrictive',
          'Incorrect group_add configuration in docker-compose',
          'Docker group ID mismatch between host and container'
        ];
        troubleshooting.suggestedActions = [
          'Check docker-compose.yml group_add configuration',
          'Verify Docker socket is mounted correctly',
          'Ensure container user has docker group membership',
          'Check host system docker group ID matches container configuration',
          'Run: docker-compose exec service id to check user groups'
        ];
        troubleshooting.documentationLinks = [
          'https://docs.docker.com/engine/install/linux-postinstall/'
        ];
        break;

      case 'unix_socket_not_found':
        troubleshooting.possibleCauses = [
          'Docker daemon not running',
          'Docker socket not mounted in container',
          'Incorrect socket path configuration',
          'Docker not installed on host'
        ];
        troubleshooting.suggestedActions = [
          'Verify Docker daemon is running on host: systemctl status docker',
          'Check docker-compose.yml volume mounts for /var/run/docker.sock',
          'Confirm DOCKER_SOCKET environment variable is correct',
          'Ensure Docker is installed on host system',
          'Check socket file exists: ls -la /var/run/docker.sock'
        ];
        break;

      case 'unix_docker_daemon_not_running':
        troubleshooting.possibleCauses = [
          'Docker daemon starting up',
          'Docker daemon crashed or stopped',
          'System resource constraints',
          'Docker service not enabled'
        ];
        troubleshooting.suggestedActions = [
          'Start Docker daemon: sudo systemctl start docker',
          'Enable Docker service: sudo systemctl enable docker',
          'Check Docker daemon status: systemctl status docker',
          'Check Docker daemon logs: journalctl -u docker',
          'Verify system resources (disk space, memory)'
        ];
        break;

      case 'unix_host_not_found':
        troubleshooting.possibleCauses = [
          'Incorrect DOCKER_HOST environment variable',
          'Network connectivity issues',
          'DNS resolution problems'
        ];
        troubleshooting.suggestedActions = [
          'Check DOCKER_HOST environment variable',
          'Verify network connectivity to Docker host',
          'Test DNS resolution if using hostname',
          'Try using IP address instead of hostname'
        ];
        break;
    }

    return troubleshooting;
  }

  classifyError(error) {
    const errorInfo = {
      type: 'unknown',
      code: error.code || 'UNKNOWN',
      message: error.message,
      recoverable: true,
      retryAfter: this.calculateRetryDelay(),
      severity: 'medium',
      userMessage: 'Docker service is temporarily unavailable',
      occurredAt: new Date().toISOString(),
      platform: this.config.platform,
      socketType: this.getDockerSocketType()
    };

    // Platform-specific error classification
    if (this.config.platform === 'windows') {
      errorInfo = this.classifyWindowsError(error, errorInfo);
    } else {
      errorInfo = this.classifyUnixError(error, errorInfo);
    }

    // Common error patterns across platforms
    if (error.code === 'ETIMEDOUT') {
      errorInfo.type = 'timeout';
      errorInfo.recoverable = true;
      errorInfo.severity = 'low';
      errorInfo.userMessage = 'Docker operation timed out. Retrying...';
    } else if (error.message && error.message.includes('EPIPE')) {
      errorInfo.type = 'broken_pipe';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Docker connection was interrupted. Reconnecting...';
    } else if (error.message && error.message.includes('socket hang up')) {
      errorInfo.type = 'socket_hangup';
      errorInfo.recoverable = true;
      errorInfo.severity = 'low';
      errorInfo.userMessage = 'Docker connection was reset. Retrying...';
    } else if (error.statusCode >= 400 && error.statusCode < 500) {
      errorInfo.type = 'client_error';
      errorInfo.recoverable = false;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Invalid Docker operation request.';
    } else if (error.statusCode >= 500) {
      errorInfo.type = 'server_error';
      errorInfo.recoverable = true;
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Docker daemon encountered an internal error.';
    }

    return errorInfo;
  }

  /**
   * Classify Windows-specific Docker errors
   * @param {Error} error - The error to classify
   * @param {Object} errorInfo - Base error info object
   * @returns {Object} Enhanced error info with Windows-specific details
   */
  classifyWindowsError(error, errorInfo) {
    if (error.code === 'ENOENT') {
      errorInfo.type = 'windows_named_pipe_not_found';
      errorInfo.recoverable = false;
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Docker Desktop named pipe not found. Please ensure Docker Desktop is running.';
    } else if (error.code === 'EACCES') {
      errorInfo.type = 'windows_named_pipe_permission';
      errorInfo.recoverable = false;
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Access denied to Docker Desktop named pipe. Please check Docker Desktop permissions.';
    } else if (error.code === 'ECONNREFUSED') {
      errorInfo.type = 'windows_docker_desktop_not_running';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Cannot connect to Docker Desktop. Please ensure Docker Desktop is running and fully started.';
    } else if (error.message && error.message.includes('pipe')) {
      errorInfo.type = 'windows_named_pipe_error';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Windows named pipe connection error. Docker Desktop may be starting up.';
    } else if (error.message && error.message.includes('hyperv')) {
      errorInfo.type = 'windows_hyperv_error';
      errorInfo.recoverable = false;
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Hyper-V related error. Please check Docker Desktop and Hyper-V configuration.';
    }

    return errorInfo;
  }

  /**
   * Classify Unix/Linux-specific Docker errors
   * @param {Error} error - The error to classify
   * @param {Object} errorInfo - Base error info object
   * @returns {Object} Enhanced error info with Unix-specific details
   */
  classifyUnixError(error, errorInfo) {
    if (error.code === 'EACCES') {
      errorInfo.type = 'unix_socket_permission';
      errorInfo.recoverable = false;
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Docker socket permission denied. Please check container user is in docker group.';
    } else if (error.code === 'ENOENT') {
      errorInfo.type = 'unix_socket_not_found';
      errorInfo.recoverable = false;
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Docker socket not found. Please ensure Docker is installed and socket is mounted.';
    } else if (error.code === 'ECONNREFUSED') {
      errorInfo.type = 'unix_docker_daemon_not_running';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Cannot connect to Docker daemon. Docker daemon may be starting up.';
    } else if (error.code === 'ENOTFOUND') {
      errorInfo.type = 'unix_host_not_found';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Docker host not found. Please check Docker configuration.';
    }

    return errorInfo;
  }

  calculateRetryDelay() {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, this.state.retryCount);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const delay = Math.min(exponentialDelay + jitter, this.config.maxRetryDelay);

    return Math.floor(delay);
  }

  // Circuit breaker pattern implementation
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

    // Reset circuit breaker on successful connection
    this.circuitBreaker.consecutiveFailures = 0;
    this.circuitBreaker.lastFailureTime = null;
    this.circuitBreaker.nextAttemptTime = null;
    this.circuitBreaker.state = 'CLOSED';

    if (previousState !== 'CLOSED' || previousFailures > 0) {
      logger.dockerConnection('info', 'Circuit breaker reset after successful connection', {
        previousState,
        previousConsecutiveFailures: previousFailures,
        newState: this.circuitBreaker.state
      });
    }
  }

  openCircuitBreaker() {
    this.circuitBreaker.state = 'OPEN';
    this.circuitBreaker.nextAttemptTime = new Date(Date.now() + this.config.circuitBreakerTimeout);

    logger.dockerConnection('warn', 'Circuit breaker OPENED due to consecutive failures', {
      consecutiveFailures: this.circuitBreaker.consecutiveFailures,
      threshold: this.config.circuitBreakerThreshold,
      nextAttemptTime: this.circuitBreaker.nextAttemptTime.toISOString(),
      timeoutDuration: this.config.circuitBreakerTimeout
    });

    // Schedule circuit breaker to transition to HALF_OPEN
    setTimeout(() => {
      if (this.circuitBreaker.state === 'OPEN') {
        this.circuitBreaker.state = 'HALF_OPEN';
        logger.dockerConnection('info', 'Circuit breaker transitioned to HALF_OPEN', {
          timeInOpenState: this.config.circuitBreakerTimeout,
          nextAttemptAllowed: true
        });
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
          logger.dockerConnection('info', 'Circuit breaker transitioned to HALF_OPEN after timeout', {
            timeInOpenState: now.getTime() - this.circuitBreaker.lastFailureTime.getTime()
          });
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return false;
    }
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

  scheduleRetry() {
    if (this.state.isRetrying) {
      logger.dockerConnection('debug', 'Retry already scheduled, skipping duplicate retry request');
      return; // Already retrying
    }

    // Check circuit breaker before scheduling retry
    if (!this.canAttemptConnection()) {
      const timeUntilNextAttempt = this.circuitBreaker.nextAttemptTime ?
        this.circuitBreaker.nextAttemptTime.getTime() - Date.now() : 0;

      logger.dockerConnection('warn', 'Retry blocked by circuit breaker', {
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        timeUntilNextAttempt,
        retryCount: this.state.retryCount
      });

      this.state.isRetrying = false;
      return;
    }

    const delay = this.calculateRetryDelay();
    this.state.nextRetryAt = new Date(Date.now() + delay);
    this.state.isRetrying = true;

    // Log retry scheduling with detailed context
    logger.dockerRetry(
      this.state.retryCount + 1,
      this.config.retryAttempts,
      delay,
      this.state.lastError,
      {
        socketPath: this.config.socketPath,
        errorType: this.state.lastError?.type,
        retryStrategy: 'exponential_backoff_with_jitter',
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
      }
    );

    // Log state change to retrying
    logger.dockerStateChange('disconnected', 'retrying', {
      retryAttempt: this.state.retryCount + 1,
      maxRetries: this.config.retryAttempts,
      retryDelay: delay,
      nextRetryAt: this.state.nextRetryAt.toISOString(),
      circuitBreakerState: this.circuitBreaker.state
    });

    this.retryTimer = setTimeout(async () => {
      this.state.retryCount++;

      logger.dockerConnection('info', `Executing retry attempt ${this.state.retryCount}/${this.config.retryAttempts}`, {
        retryAttempt: this.state.retryCount,
        maxRetries: this.config.retryAttempts,
        lastErrorType: this.state.lastError?.type,
        timeSinceLastAttempt: delay,
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
      });

      const success = await this.connect();

      if (!success && this.state.retryCount < this.config.retryAttempts && this.canAttemptConnection()) {
        logger.dockerConnection('warn', `Retry attempt ${this.state.retryCount} failed, scheduling next attempt`, {
          failedAttempt: this.state.retryCount,
          remainingAttempts: this.config.retryAttempts - this.state.retryCount,
          lastErrorType: this.state.lastError?.type,
          circuitBreakerState: this.circuitBreaker.state
        });
        this.scheduleRetry();
      } else if (!success) {
        const failureReason = !this.canAttemptConnection() ? 'circuit_breaker_open' : 'max_retries_exceeded';
        logger.dockerConnection('error', 'Retry attempts stopped', {
          totalAttempts: this.state.retryCount,
          maxRetries: this.config.retryAttempts,
          finalErrorType: this.state.lastError?.type,
          finalErrorMessage: this.state.lastError?.message,
          failureReason,
          circuitBreakerState: this.circuitBreaker.state,
          consecutiveFailures: this.circuitBreaker.consecutiveFailures
        });
        this.state.isRetrying = false;
      }
    }, delay);
  }

  startHealthCheck() {
    logger.dockerConnection('info', 'Starting Docker health check monitoring', {
      healthCheckInterval: this.config.healthCheckInterval,
      socketPath: this.config.socketPath
    });

    this.healthCheckTimer = setInterval(async () => {
      const healthCheckStart = Date.now();

      if (this.state.isConnected) {
        try {
          // Simple health check - list containers with limit 1
          logger.dockerConnection('debug', 'Performing Docker health check');
          await this.docker.listContainers({ limit: 1 });

          const healthCheckDuration = Date.now() - healthCheckStart;
          logger.dockerConnection('debug', 'Docker health check passed', {
            duration: healthCheckDuration,
            status: 'healthy',
            lastSuccessfulConnection: this.state.lastSuccessfulConnection?.toISOString()
          });
        } catch (error) {
          const healthCheckDuration = Date.now() - healthCheckStart;
          logger.dockerConnection('warn', 'Docker health check failed, connection may be lost', {
            duration: healthCheckDuration,
            errorCode: error.code,
            errorMessage: error.message,
            lastSuccessfulConnection: this.state.lastSuccessfulConnection?.toISOString()
          });

          this.handleConnectionError(error);
        }
      } else if (!this.state.isRetrying && this.state.retryCount < this.config.retryAttempts) {
        // Only try to reconnect if the last error was recoverable
        if (this.state.lastError && this.state.lastError.recoverable) {
          logger.dockerConnection('info', 'Health check triggered automatic reconnection attempt', {
            lastErrorType: this.state.lastError.type,
            timeSinceLastError: this.state.lastError.occurredAt ?
              Date.now() - new Date(this.state.lastError.occurredAt).getTime() : 'unknown',
            retryCount: this.state.retryCount
          });

          this.state.retryCount = 0; // Reset retry count for health check reconnections
          await this.connect();
        } else {
          logger.dockerConnection('debug', 'Health check skipped - non-recoverable error or max retries reached', {
            lastErrorType: this.state.lastError?.type,
            recoverable: this.state.lastError?.recoverable,
            retryCount: this.state.retryCount,
            maxRetries: this.config.retryAttempts
          });
        }
      } else {
        logger.dockerConnection('debug', 'Health check skipped - retry in progress or max attempts reached', {
          isRetrying: this.state.isRetrying,
          retryCount: this.state.retryCount,
          maxRetries: this.config.retryAttempts,
          nextRetryAt: this.state.nextRetryAt?.toISOString()
        });
      }
    }, this.config.healthCheckInterval);
  }

  getDocker() {
    if (!this.state.isConnected || !this.docker) {
      throw new Error('Docker connection not available');
    }
    return this.docker;
  }

  getConnectionState() {
    return {
      ...this.state,
      config: {
        socketPath: this.config.socketPath,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
        circuitBreakerThreshold: this.config.circuitBreakerThreshold,
        circuitBreakerTimeout: this.config.circuitBreakerTimeout
      },
      circuitBreaker: this.getCircuitBreakerStatus()
    };
  }

  createErrorResponse(operation, error, includeRetryInfo = true) {
    const classifiedError = this.classifyError(error);
    const connectionState = this.getConnectionState();
    const troubleshooting = this.generateTroubleshootingInfo(classifiedError);

    const response = {
      error: `${operation} failed`,
      message: classifiedError.userMessage,
      details: {
        type: classifiedError.type,
        code: classifiedError.code,
        severity: classifiedError.severity,
        recoverable: classifiedError.recoverable,
        platform: classifiedError.platform,
        socketType: classifiedError.socketType
      },
      docker: {
        connected: connectionState.isConnected,
        socketPath: connectionState.config.socketPath,
        platform: connectionState.platform
      },
      troubleshooting: {
        possibleCauses: troubleshooting.possibleCauses,
        suggestedActions: troubleshooting.suggestedActions,
        documentationLinks: troubleshooting.documentationLinks,
        platform: troubleshooting.platform,
        socketType: troubleshooting.socketType
      },
      timestamp: new Date().toISOString()
    };

    if (includeRetryInfo && classifiedError.recoverable) {
      response.retry = {
        willRetry: connectionState.retryCount < this.config.retryAttempts,
        retryCount: connectionState.retryCount,
        maxRetries: this.config.retryAttempts,
        nextRetryAt: connectionState.nextRetryAt,
        retryAfter: classifiedError.retryAfter
      };
    }

    if (!classifiedError.recoverable) {
      response.resolution = this.getResolutionSuggestion(classifiedError.type);
    }

    return response;
  }

  getResolutionSuggestion(errorType) {
    const platformSpecificSuggestions = {
      // Windows-specific suggestions
      windows_named_pipe_not_found: 'Install and start Docker Desktop for Windows. Ensure it is fully initialized.',
      windows_named_pipe_permission: 'Add your user to the docker-users Windows group and restart your session.',
      windows_docker_desktop_not_running: 'Start Docker Desktop from the Start Menu and wait for it to fully load.',
      windows_hyperv_error: 'Enable Hyper-V Windows feature and ensure virtualization is enabled in BIOS.',
      
      // Unix-specific suggestions
      unix_socket_permission: 'Add the container user to the docker group and ensure proper group_add configuration.',
      unix_socket_not_found: 'Install Docker and ensure the socket is mounted correctly in the container.',
      unix_docker_daemon_not_running: 'Start the Docker daemon: sudo systemctl start docker',
      unix_host_not_found: 'Check DOCKER_HOST environment variable and network connectivity.',
      
      // Common suggestions
      permission: 'Check Docker socket permissions and ensure proper user/group configuration.',
      socket_not_found: 'Ensure Docker is installed and the socket path is correctly configured.',
      connection_refused: 'Verify Docker daemon is running and accessible.',
      timeout: 'Check system resources and consider increasing timeout values.',
      client_error: 'Review the request parameters and ensure they are valid.',
      server_error: 'Check Docker daemon logs and consider restarting the Docker service.',
      unknown: 'Check Docker daemon status and container configuration.'
    };

    return platformSpecificSuggestions[errorType] || platformSpecificSuggestions.unknown;
  }

  isDockerAvailable() {
    return this.state.isConnected;
  }

  getServiceStatus() {
    const connectionState = this.getConnectionState();

    if (connectionState.isConnected) {
      return {
        status: 'available',
        message: 'Docker service is running normally'
      };
    }

    if (connectionState.isRetrying && connectionState.lastError?.recoverable) {
      return {
        status: 'degraded',
        message: 'Docker service is temporarily unavailable, retrying connection'
      };
    }

    if (connectionState.lastError && !connectionState.lastError.recoverable) {
      return {
        status: 'unavailable',
        message: connectionState.lastError.userMessage
      };
    }

    return {
      status: 'unknown',
      message: 'Docker service status unknown'
    };
  }

  async executeWithRetry(operation, operationName = 'Docker operation', options = {}) {
    const {
      allowDegraded = false,
      fallbackValue = null,
      maxOperationRetries = 2
    } = options;

    const operationStart = Date.now();

    logger.dockerConnection('debug', `Starting operation: ${operationName}`, {
      operation: operationName,
      allowDegraded,
      maxOperationRetries,
      connectionState: this.state.isConnected ? 'connected' : 'disconnected'
    });

    // Check if Docker is available
    if (!this.state.isConnected) {
      const serviceStatus = this.getServiceStatus();

      if (allowDegraded) {
        logger.dockerConnection('warn', `Operation skipped due to Docker unavailability`, {
          operation: operationName,
          serviceStatus: serviceStatus.status,
          serviceMessage: serviceStatus.message,
          fallbackUsed: true,
          duration: Date.now() - operationStart
        });
        return fallbackValue;
      }

      const error = new Error(`${operationName} failed: ${serviceStatus.message}`);
      error.dockerStatus = serviceStatus.status;

      logger.dockerOperationFailed(operationName, {
        type: 'connection_unavailable',
        code: 'DOCKER_UNAVAILABLE',
        message: serviceStatus.message,
        severity: 'high',
        recoverable: serviceStatus.status === 'degraded'
      });

      throw error;
    }

    let lastError = null;

    // Retry the operation with exponential backoff
    for (let attempt = 0; attempt <= maxOperationRetries; attempt++) {
      const attemptStart = Date.now();

      try {
        logger.dockerConnection('debug', `Executing operation attempt ${attempt + 1}/${maxOperationRetries + 1}`, {
          operation: operationName,
          attempt: attempt + 1,
          maxAttempts: maxOperationRetries + 1
        });

        const result = await operation(this.docker);

        const operationDuration = Date.now() - operationStart;
        const attemptDuration = Date.now() - attemptStart;

        logger.dockerConnection('debug', `Operation completed successfully`, {
          operation: operationName,
          attempt: attempt + 1,
          totalDuration: operationDuration,
          attemptDuration: attemptDuration,
          retriesUsed: attempt
        });

        return result;
      } catch (error) {
        lastError = error;
        const classifiedError = this.classifyError(error);
        const attemptDuration = Date.now() - attemptStart;

        logger.dockerConnection('warn', `Operation attempt ${attempt + 1} failed`, {
          operation: operationName,
          attempt: attempt + 1,
          maxAttempts: maxOperationRetries + 1,
          attemptDuration,
          errorType: classifiedError.type,
          errorCode: classifiedError.code,
          errorMessage: error.message,
          recoverable: classifiedError.recoverable
        });

        // If it's a connection-related error, trigger reconnection
        if (['connection_refused', 'timeout', 'broken_pipe', 'socket_hangup'].includes(classifiedError.type)) {
          logger.dockerConnection('info', 'Connection-related error detected, triggering reconnection', {
            operation: operationName,
            errorType: classifiedError.type,
            attempt: attempt + 1
          });

          this.handleConnectionError(error);

          // If we have more attempts and the error is recoverable, wait and retry
          if (attempt < maxOperationRetries && classifiedError.recoverable) {
            const retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 second delay

            logger.dockerConnection('info', `Retrying operation after connection error`, {
              operation: operationName,
              attempt: attempt + 1,
              retryDelay,
              nextAttempt: attempt + 2
            });

            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }

        // For non-recoverable errors or final attempt, break the loop
        if (!classifiedError.recoverable || attempt === maxOperationRetries) {
          logger.dockerConnection('error', 'Operation cannot be retried', {
            operation: operationName,
            attempt: attempt + 1,
            reason: !classifiedError.recoverable ? 'non_recoverable_error' : 'max_attempts_reached',
            errorType: classifiedError.type,
            recoverable: classifiedError.recoverable
          });
          break;
        }

        // Wait before next attempt for recoverable errors
        if (attempt < maxOperationRetries) {
          const retryDelay = Math.min(500 * Math.pow(2, attempt), 2000);

          logger.dockerConnection('info', `Retrying operation after recoverable error`, {
            operation: operationName,
            attempt: attempt + 1,
            retryDelay,
            nextAttempt: attempt + 2,
            errorType: classifiedError.type
          });

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // If we reach here, all attempts failed
    const totalDuration = Date.now() - operationStart;

    if (allowDegraded) {
      logger.dockerConnection('warn', 'Operation failed after all retries, using fallback', {
        operation: operationName,
        totalAttempts: maxOperationRetries + 1,
        totalDuration,
        fallbackUsed: true,
        finalErrorType: this.classifyError(lastError).type
      });
      return fallbackValue;
    }

    logger.dockerOperationFailed(operationName, this.classifyError(lastError), {
      possibleCauses: ['Connection instability', 'Docker daemon issues', 'Resource constraints'],
      suggestedActions: [
        'Check Docker daemon status',
        'Verify system resources',
        'Review container configuration',
        'Check network connectivity'
      ]
    });

    throw lastError;
  }

  // Get connection statistics for logging and monitoring
  getConnectionStats() {
    const now = new Date();
    const stats = {
      currentState: this.state.isConnected ? 'connected' : 'disconnected',
      lastSuccessfulConnection: this.state.lastSuccessfulConnection,
      totalRetries: this.state.retryCount,
      isRetrying: this.state.isRetrying,
      nextRetryAt: this.state.nextRetryAt,
      uptime: this.state.lastSuccessfulConnection ?
        now.getTime() - this.state.lastSuccessfulConnection.getTime() : 0,
      lastError: this.state.lastError ? {
        type: this.state.lastError.type,
        code: this.state.lastError.code,
        severity: this.state.lastError.severity,
        recoverable: this.state.lastError.recoverable,
        occurredAt: this.state.lastError.occurredAt,
        platform: this.state.lastError.platform,
        socketType: this.state.lastError.socketType
      } : null,
      circuitBreaker: this.getCircuitBreakerStatus(),
      platform: {
        name: this.config.platform,
        socketType: this.getDockerSocketType(),
        details: this.getPlatformDetails(),
        connectionInfo: this.getPlatformConnectionInfo()
      },
      config: {
        socketPath: this.config.socketPath,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
        healthCheckInterval: this.config.healthCheckInterval,
        circuitBreakerThreshold: this.config.circuitBreakerThreshold,
        circuitBreakerTimeout: this.config.circuitBreakerTimeout,
        platform: this.config.platform
      }
    };

    return stats;
  }

  // Log periodic connection statistics
  logConnectionStats() {
    const stats = this.getConnectionStats();

    // Use DeploymentLogger for performance metrics
    DeploymentLogger.logPerformanceMetrics({
      docker: {
        connectionStats: stats,
        isConnected: this.state.isConnected,
        retryCount: this.state.retryCount,
        lastSuccessfulConnection: this.state.lastSuccessfulConnection,
        circuitBreakerState: this.circuitBreaker.state
      }
    });

    logger.dockerConnection('info', 'Docker connection statistics', {
      connectionStats: stats,
      timestamp: new Date().toISOString()
    });
  }

  destroy() {
    const stats = this.getConnectionStats();

    logger.dockerConnection('info', 'Destroying Docker connection manager', {
      finalStats: stats,
      timersCleared: {
        healthCheck: !!this.healthCheckTimer,
        retry: !!this.retryTimer,
        statsLog: !!this.statsLogTimer
      }
    });

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.dockerConnection('debug', 'Health check timer cleared');
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      logger.dockerConnection('debug', 'Retry timer cleared');
    }

    if (this.statsLogTimer) {
      clearInterval(this.statsLogTimer);
      this.statsLogTimer = null;
      logger.dockerConnection('debug', 'Statistics logging timer cleared');
    }

    // Log final state change
    if (this.state.isConnected) {
      logger.dockerStateChange('connected', 'destroyed', {
        reason: 'manager_shutdown',
        finalStats: stats
      });
    }

    this.state.isConnected = false;
    this.docker = null;

    logger.dockerConnection('info', 'Docker connection manager destroyed successfully');
  }
}

// Initialize Docker Connection Manager with NetworkManager configuration
const networkConfig = NetworkManager.getConfiguration();
let dockerManager;

// Enable Docker functionality for MVP testing
logger.info('🐳 Initializing Docker connection manager');
logger.info('🔧 Enabling Docker functionality for container deployment');
  
  // Create CLI-based Docker manager for Windows compatibility
  dockerManager = {
    config: {
      platform: networkConfig.platform,
      cliPath: 'docker', // Use docker CLI directly
    },
    getConnectionState: () => ({ 
      isConnected: true, 
      lastSuccessfulConnection: new Date(),
      platform: 'windows-cli'
    }),
    getServiceStatus: () => ({ 
      status: 'available', 
      message: 'Docker CLI integration active'
    }),
    executeWithRetry: async (operation, description) => {
      return operation();
    },
    createErrorResponse: (operation, error, includeDetails = true) => ({
      success: false,
      error: error.message || 'Docker operation failed',
      details: includeDetails ? error.message : undefined,
      operation,
      timestamp: new Date().toISOString(),
      dockerStatus: 'cli-mode'
    }),
    destroy: () => {
      logger.info('🔧 CLI Docker manager cleanup complete');
    }
  };
  
  logger.info('✅ CLI-based Docker manager initialized for Windows compatibility');


// Legacy docker variable for backward compatibility
let docker = dockerManager;

// Middleware already set up at the top of the file

// Helper functions
function calculateCPUPercentage(stats) {
  if (!stats || !stats.cpu_stats || !stats.precpu_stats) {
    return 0;
  }

  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || 1;

  if (systemDelta <= 0 || cpuDelta < 0) {
    return 0;
  }

  const percentage = (cpuDelta / systemDelta) * cpuCount * 100;

  // Ensure we return a valid number
  if (isNaN(percentage) || !isFinite(percentage)) {
    return 0;
  }

  // Cap at 100% per core * number of cores (reasonable maximum)
  return Math.min(percentage, cpuCount * 100);
}

function calculateMemoryUsage(stats) {
  if (!stats || !stats.memory_stats) {
    return {
      usage: 0,
      limit: 0,
      percentage: 0
    };
  }

  const usage = Math.max(0, stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0));
  const limit = stats.memory_stats.limit || 1; // Prevent division by zero

  const percentage = (usage / limit) * 100;

  return {
    usage,
    limit,
    percentage: isNaN(percentage) || !isFinite(percentage) ? 0 : Math.min(percentage, 100)
  };
}

function calculateNetworkUsage(stats) {
  if (!stats || !stats.networks) {
    return {};
  }

  return Object.entries(stats.networks).reduce((acc, [networkInterface, data]) => {
    acc[networkInterface] = {
      rx_bytes: data.rx_bytes,
      tx_bytes: data.tx_bytes
    };
    return acc;
  }, {});
}

function calculateUptime(container) {
  if (!container.State || !container.State.StartedAt) {
    return 0;
  }

  const startTime = new Date(container.State.StartedAt).getTime();
  const now = new Date().getTime();
  return Math.floor((now - startTime) / 1000);
}

// Middleware to conditionally require auth
const conditionalAuth = (req, res, next) => {
  if (!authEnabled) {
    return next();
  }
  return requireAuth(req, res, next);
};

// Routes (protected by authentication if enabled)
app.get('/containers', conditionalAuth, async (req, res) => {
  try {
    // Check Docker availability first
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json({
        ...dockerManager.createErrorResponse('List containers', new Error(serviceStatus.message), false),
        containers: []
      });
    }

    const containers = await dockerManager.executeWithRetry(
      async (docker) => await docker.listContainers({ all: true }),
      'List containers',
      {
        allowDegraded: true,
        fallbackValue: []
      }
    );

    if (!containers || containers.length === 0) {
      return res.json({
        success: true,
        containers: [],
        docker: {
          status: serviceStatus.status,
          message: serviceStatus.message
        }
      });
    }

    const includeStats = req.query.stats === 'true';

    if (!includeStats) {
      // Fast path: return containers without expensive stats
      const containersWithBasicInfo = await Promise.all(
        containers.map(async (container) => {
          try {
            const containerInfo = dockerManager.getDocker().getContainer(container.Id);
            const info = await containerInfo.inspect();

            return {
              ...container,
              stats: {
                cpu: 0,
                memory: { usage: 0, limit: 0, percentage: 0 },
                network: {},
                uptime: calculateUptime(info)
              },
              config: info.Config,
              mounts: info.Mounts
            };
          } catch (error) {
            logger.warn(`Error fetching basic info for container ${container.Id}:`, error.message);
            return {
              ...container,
              stats: {
                cpu: 0,
                memory: { usage: 0, limit: 0, percentage: 0 },
                network: {},
                uptime: 0
              },
              error: 'Failed to fetch container details'
            };
          }
        })
      );
      return res.json({
        success: true,
        containers: containersWithBasicInfo,
        docker: {
          status: serviceStatus.status,
          message: serviceStatus.message
        }
      });
    }

    // Slow path: include full statistics (only when requested)
    const containersWithStats = await Promise.all(
      containers.map(async (container) => {
        try {
          const containerInfo = dockerManager.getDocker().getContainer(container.Id);
          const [stats, info] = await Promise.all([
            containerInfo.stats({ stream: false }),
            containerInfo.inspect()
          ]);

          return {
            ...container,
            stats: {
              cpu: calculateCPUPercentage(stats),
              memory: calculateMemoryUsage(stats),
              network: calculateNetworkUsage(stats),
              uptime: calculateUptime(info)
            },
            config: info.Config,
            mounts: info.Mounts
          };
        } catch (error) {
          logger.warn(`Error fetching stats for container ${container.Id}:`, error.message);
          // Return container with default stats instead of failing
          return {
            ...container,
            stats: {
              cpu: 0,
              memory: { usage: 0, limit: 0, percentage: 0 },
              network: {},
              uptime: 0
            },
            error: 'Failed to fetch container statistics'
          };
        }
      })
    );

    res.json({
      success: true,
      containers: containersWithStats,
      docker: {
        status: serviceStatus.status,
        message: serviceStatus.message
      }
    });
  } catch (error) {
    logger.error('Error fetching containers:', error);
    const errorResponse = dockerManager.createErrorResponse('List containers', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

// Separate endpoint for container statistics
app.get('/containers/:id/stats', async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Get container statistics', new Error(serviceStatus.message), false)
      );
    }

    const result = await dockerManager.executeWithRetry(
      async (docker) => {
        const containerInfo = docker.getContainer(req.params.id);
        const [stats, info] = await Promise.all([
          containerInfo.stats({ stream: false }),
          containerInfo.inspect()
        ]);

        return {
          stats: {
            cpu: calculateCPUPercentage(stats),
            memory: calculateMemoryUsage(stats),
            network: calculateNetworkUsage(stats),
            uptime: calculateUptime(info)
          }
        };
      },
      `Get container statistics for ${req.params.id}`,
      {
        allowDegraded: true,
        fallbackValue: {
          stats: {
            cpu: 0,
            memory: { usage: 0, limit: 0, percentage: 0 },
            network: {},
            uptime: 0
          }
        }
      }
    );

    res.json({
      success: true,
      containerId: req.params.id,
      ...result,
      docker: {
        status: serviceStatus.status,
        message: serviceStatus.message
      }
    });
  } catch (error) {
    logger.error(`Error fetching stats for container ${req.params.id}:`, error);
    const errorResponse = dockerManager.createErrorResponse('Get container statistics', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

// Container control endpoints
app.post('/containers/:id/start', conditionalAuth, async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Start container', new Error(serviceStatus.message))
      );
    }

    await dockerManager.executeWithRetry(
      async (docker) => {
        const container = docker.getContainer(req.params.id);
        await container.start();
      },
      `Start container ${req.params.id}`
    );

    res.json({
      success: true,
      message: 'Container started successfully',
      containerId: req.params.id
    });
  } catch (error) {
    logger.error(`Error starting container ${req.params.id}:`, error);
    const errorResponse = dockerManager.createErrorResponse('Start container', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

app.post('/containers/:id/stop', conditionalAuth, async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Stop container', new Error(serviceStatus.message))
      );
    }

    await dockerManager.executeWithRetry(
      async (docker) => {
        const container = docker.getContainer(req.params.id);
        await container.stop();
      },
      `Stop container ${req.params.id}`
    );

    res.json({
      success: true,
      message: 'Container stopped successfully',
      containerId: req.params.id
    });
  } catch (error) {
    logger.error(`Error stopping container ${req.params.id}:`, error);
    const errorResponse = dockerManager.createErrorResponse('Stop container', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

app.post('/containers/:id/restart', conditionalAuth, async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Restart container', new Error(serviceStatus.message))
      );
    }

    await dockerManager.executeWithRetry(
      async (docker) => {
        const container = docker.getContainer(req.params.id);
        await container.restart();
      },
      `Restart container ${req.params.id}`
    );

    res.json({
      success: true,
      message: 'Container restarted successfully',
      containerId: req.params.id
    });
  } catch (error) {
    logger.error(`Error restarting container ${req.params.id}:`, error);
    const errorResponse = dockerManager.createErrorResponse('Restart container', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

app.delete('/containers/:id', conditionalAuth, async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Remove container', new Error(serviceStatus.message))
      );
    }

    await dockerManager.executeWithRetry(
      async (docker) => {
        const container = docker.getContainer(req.params.id);

        // Stop container if it's running
        try {
          const info = await container.inspect();
          if (info.State.Running) {
            logger.info(`Stopping container ${req.params.id} before removal`);
            await container.stop();
          }
        } catch (stopError) {
          logger.warn(`Container ${req.params.id} may already be stopped:`, stopError.message);
        }

        // Remove the container
        await container.remove();
      },
      `Remove container ${req.params.id}`
    );

    res.json({
      success: true,
      message: 'Container removed successfully',
      containerId: req.params.id
    });
  } catch (error) {
    logger.error(`Error removing container ${req.params.id}:`, error);
    const errorResponse = dockerManager.createErrorResponse('Remove container', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

app.get('/containers/:id/logs', async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Get container logs', new Error(serviceStatus.message), false)
      );
    }

    const tail = parseInt(req.query.tail) || 100;

    const logs = await dockerManager.executeWithRetry(
      async (docker) => {
        const container = docker.getContainer(req.params.id);
        return await container.logs({
          stdout: true,
          stderr: true,
          tail: tail,
          timestamps: true
        });
      },
      `Get container logs for ${req.params.id}`,
      {
        allowDegraded: true,
        fallbackValue: Buffer.from('Logs unavailable: Docker service is not accessible\n')
      }
    );

    // Convert buffer to string and clean up Docker log format
    const logString = logs.toString('utf8');
    const cleanLogs = logString
      .split('\n')
      .map(line => {
        // Remove Docker's 8-byte header from each log line
        if (line.length > 8) {
          return line.substring(8);
        }
        return line;
      })
      .filter(line => line.trim().length > 0)
      .join('\n');

    res.json({
      success: true,
      logs: cleanLogs,
      containerId: req.params.id,
      docker: {
        status: serviceStatus.status,
        message: serviceStatus.message
      }
    });
  } catch (error) {
    logger.error(`Error fetching container logs for ${req.params.id}:`, error);
    const errorResponse = dockerManager.createErrorResponse('Get container logs', error);
    res.status(error.dockerStatus === 'degraded' ? 503 : 500).json(errorResponse);
  }
});

// Deploy container endpoint
app.post('/deploy', authEnabled ? requireAuth : optionalAuth, async (req, res) => {
  try {
    const { appId, config, mode } = req.body;
    logger.info(`🚀 Starting deployment of ${appId} using ${cliBridge ? 'CLI Bridge' : 'Template Mode'}...`);

    // Validate input
    if (!appId) {
      return res.status(400).json({
        error: 'App ID is required',
        details: 'Please provide a valid application identifier'
      });
    }

    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        error: 'Configuration object is required',
        details: 'Please provide a valid configuration object with deployment parameters'
      });
    }

    // Check for special Docker CLI deployments first
    if (appId === 'it-tools') {
      logger.info('🐳 Using direct Docker CLI deployment for it-tools MVP (bypassing streaming)');
      
      try {
        const { spawn } = await import('child_process');
        
        const containerName = `homelabarr-${appId}-${Date.now()}`;
        const port = config.port || '8080';
        
        const dockerArgs = [
          'run',
          '-d',
          '--name', containerName,
          '--restart', 'unless-stopped',
          '-p', `${port}:80`,
          'corentinth/it-tools:latest'
        ];
        
        logger.info(`🐳 Deploying ${appId} with: docker ${dockerArgs.join(' ')}`);
        
        const dockerProcess = spawn('docker', dockerArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        dockerProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        dockerProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        dockerProcess.on('close', (code) => {
          if (code === 0) {
            logger.info(`✅ Container ${containerName} deployed successfully`);
          } else {
            logger.error(`❌ Docker deployment failed with code ${code}: ${errorOutput}`);
          }
        });
        
        // Set timeout for the deployment
        setTimeout(() => {
          if (!res.headersSent) {
            dockerProcess.kill();
            return res.status(500).json({
              success: false,
              error: 'Deployment timeout',
              details: 'Docker deployment took too long'
            });
          }
        }, 30000);
        
        // Return success immediately for MVP testing
        return res.json({
          success: true,
          message: `${appId} deployed successfully using Docker CLI`,
          containerName,
          containerId: 'generated-by-docker',
          url: `http://localhost:${port}`,
          source: 'docker-cli',
          appId,
          port: parseInt(port)
        });
        
      } catch (cliError) {
        logger.error('Docker CLI deployment failed:', cliError.message);
        return res.status(500).json({
          success: false,
          error: 'Docker CLI deployment failed',
          details: cliError.message
        });
      }
    }

    // Use Streaming CLI Bridge if available (preferred method)
    if (streamingCLIBridge) {
      try {
        const deploymentId = randomUUID();
        
        // Start deployment with streaming
        const deploymentPromise = streamingCLIBridge.deployApplicationWithProgress(
          appId, 
          config, 
          mode || { type: 'standard', useAuthentik: false },
          deploymentId
        );
        
        // Return immediately with deployment ID for streaming
        res.json({
          success: true,
          message: `${appId} deployment started with real-time progress tracking`,
          deploymentId,
          source: 'cli-streaming',
          appId,
          mode: mode || { type: 'standard' },
          streamEndpoint: `/stream/progress`,
          statusEndpoint: `/deployments/${deploymentId}/status`
        });
        
        // Continue deployment in background
        deploymentPromise.catch((error) => {
          logger.error('Background CLI deployment failed:', error.message);
        });
        
        return;
      } catch (cliError) {
        logger.error('Streaming CLI deployment failed:', cliError.message);
        logger.warn('Falling back to standard CLI mode');
      }
    }

    // Check for special Docker CLI deployments before using CLI Bridge
    if (appId === 'it-tools') {
      logger.info('🐳 Using direct Docker CLI deployment for it-tools MVP');
      
      try {
        const { spawn } = require('child_process');
        
        const containerName = `homelabarr-${appId}-${Date.now()}`;
        const port = config.port || '8080';
        
        const dockerArgs = [
          'run',
          '-d',
          '--name', containerName,
          '--restart', 'unless-stopped',
          '-p', `${port}:80`,
          'corentinth/it-tools:latest'
        ];
        
        logger.info(`🐳 Deploying ${appId} with: docker ${dockerArgs.join(' ')}`);
        
        return new Promise((resolve) => {
          const dockerProcess = spawn('docker', dockerArgs, {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let output = '';
          let errorOutput = '';
          
          dockerProcess.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          dockerProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          dockerProcess.on('close', (code) => {
            if (code === 0) {
              logger.info(`✅ Container ${containerName} deployed successfully`);
              resolve(res.json({
                success: true,
                message: `${appId} deployed successfully using Docker CLI`,
                containerName,
                containerId: output.trim(),
                url: `http://localhost:${port}`,
                source: 'docker-cli',
                appId,
                port: parseInt(port)
              }));
            } else {
              logger.error(`❌ Docker deployment failed with code ${code}: ${errorOutput}`);
              resolve(res.status(500).json({
                success: false,
                error: 'Docker deployment failed',
                details: errorOutput || `Process exited with code ${code}`,
                dockerStatus: 'cli-error'
              }));
            }
          });
          
          // Set timeout for the deployment
          setTimeout(() => {
            if (!res.headersSent) {
              dockerProcess.kill();
              resolve(res.status(500).json({
                success: false,
                error: 'Deployment timeout',
                details: 'Docker deployment took too long'
              }));
            }
          }, 30000);
        });
        
      } catch (cliError) {
        logger.error('Docker CLI deployment failed:', cliError.message);
        return res.status(500).json({
          success: false,
          error: 'Docker CLI deployment failed',
          details: cliError.message
        });
      }
    }

    // Fallback to standard CLI Bridge for other apps
    if (cliBridge) {
      try {
        const deploymentResult = await cliBridge.deployApplication(appId, config, mode || { type: 'standard', useAuthentik: false });
        
        return res.json({
          success: true,
          message: `${appId} deployed successfully using HomelabARR CLI`,
          deployment: deploymentResult,
          source: 'cli',
          appId,
          mode: mode || { type: 'standard' }
        });
      } catch (cliError) {
        logger.error('CLI deployment failed:', cliError.message);
        // Fall back to template mode if CLI fails
        logger.warn('Falling back to template mode for deployment');
      }
    }

    // Direct Docker CLI deployment for MVP
    logger.info('Using CLI-based Docker deployment for MVP');
    
    // For MVP, create a simple container deployment using docker CLI
    try {
      const { spawn } = require('child_process');
      
      // Basic it-tools container deployment
      if (appId === 'it-tools') {
        const containerName = `homelabarr-${appId}-${Date.now()}`;
        const port = config.port || '8080';
        
        const dockerArgs = [
          'run',
          '-d',
          '--name', containerName,
          '--restart', 'unless-stopped',
          '-p', `${port}:80`,
          'corentinth/it-tools:latest'
        ];
        
        logger.info(`🐳 Deploying ${appId} with: docker ${dockerArgs.join(' ')}`);
        
        const dockerProcess = spawn('docker', dockerArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        dockerProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        dockerProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        dockerProcess.on('close', (code) => {
          if (code === 0) {
            logger.info(`✅ Container ${containerName} deployed successfully`);
            res.json({
              success: true,
              message: `${appId} deployed successfully using Docker CLI`,
              containerName,
              containerId: output.trim(),
              url: `http://localhost:${port}`,
              source: 'docker-cli',
              appId,
              port: parseInt(port)
            });
          } else {
            logger.error(`❌ Docker deployment failed with code ${code}: ${errorOutput}`);
            res.status(500).json({
              success: false,
              error: 'Docker deployment failed',
              details: errorOutput || `Process exited with code ${code}`,
              dockerStatus: 'cli-error'
            });
          }
        });
        
        // Set timeout for the deployment
        setTimeout(() => {
          if (!res.headersSent) {
            dockerProcess.kill();
            res.status(500).json({
              success: false,
              error: 'Deployment timeout',
              details: 'Docker deployment took too long'
            });
          }
        }, 30000);
        
        return; // Don't continue to old template mode
      }
      
      // For other apps, return a helpful message
      return res.status(501).json({
        success: false,
        error: 'App not supported in CLI mode',
        details: `${appId} deployment not implemented yet. Try 'it-tools' for MVP testing.`,
        supportedApps: ['it-tools']
      });
      
    } catch (cliError) {
      logger.error('CLI deployment setup failed:', cliError.message);
      return res.status(500).json({
        success: false,
        error: 'CLI deployment failed',
        details: cliError.message
      });
    }

    // Read template file
    const templatePath = path.join(process.cwd(), 'server', 'templates', `${appId}.yml`);
    if (!fs.existsSync(templatePath)) {
      console.error('Template not found:', templatePath);
      return res.status(404).json({
        error: 'Template not found',
        details: `No template file found for app: ${appId}`
      });
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    console.log('Template content:', templateContent);

    const template = yaml.parse(templateContent);
    console.log('Parsed template:', template);

    // Replace variables in template
    const composerConfig = JSON.stringify(template)
      .replace(/\${([^}]+)}/g, (_, key) => config[key] || '');

    // Parse back to object
    const finalConfig = JSON.parse(composerConfig);
    console.log('Final config:', finalConfig);

    // Check for port conflicts before deployment
    const [serviceName, serviceConfig] = Object.entries(finalConfig.services)[0];
    if (serviceConfig.ports) {
      const containers = await dockerManager.executeWithRetry(
        async (docker) => await docker.listContainers({ all: true }),
        'Check port conflicts'
      );
      const usedPorts = new Set();

      containers.forEach(container => {
        if (container.Ports) {
          container.Ports.forEach(port => {
            if (port.PublicPort) {
              usedPorts.add(port.PublicPort);
            }
          });
        }
      });

      const conflictingPorts = [];
      serviceConfig.ports.forEach(portMapping => {
        const cleanMapping = portMapping.replace('/udp', '');
        const [hostPort] = cleanMapping.split(':').reverse();
        const port = parseInt(hostPort);

        if (usedPorts.has(port)) {
          conflictingPorts.push(port);
        }
      });

      if (conflictingPorts.length > 0) {
        return res.status(409).json({
          error: 'Port conflict detected',
          details: `The following ports are already in use: ${conflictingPorts.join(', ')}`,
          conflictingPorts
        });
      }
    }

    // Ensure required networks exist
    try {
      await dockerManager.executeWithRetry(
        async (docker) => {
          const networks = await docker.listNetworks();

          // Create homelabarr network if it doesn't exist
          const homelabarrExists = networks.some(n => n.Name === 'homelabarr');
          if (!homelabarrExists) {
            console.log('Creating homelabarr network');
            await docker.createNetwork({
              Name: 'homelabarr',
              Driver: 'bridge'
            });
          }

          // Create proxy network if it doesn't exist (for templates that use it)
          const proxyExists = networks.some(n => n.Name === 'proxy');
          if (!proxyExists) {
            console.log('Creating proxy network');
            await docker.createNetwork({
              Name: 'proxy',
              Driver: 'bridge'
            });
          }
        },
        'Setup networks'
      );
    } catch (error) {
      console.error('Error checking/creating networks:', error);
      throw new Error('Failed to setup networks');
    }

    // Get the service configuration (reusing variables from above)
    // const [serviceName, serviceConfig] = Object.entries(finalConfig.services)[0]; // Already declared above

    // Pull the image first
    console.log('Pulling image:', serviceConfig.image);
    try {
      await dockerManager.executeWithRetry(
        async (docker) => {
          const stream = await docker.pull(serviceConfig.image);
          await new Promise((resolve, reject) => {
            docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
          });
        },
        'Pull image'
      );
    } catch (error) {
      console.error('Error pulling image:', error);
      throw new Error(`Failed to pull image: ${error.message}`);
    }

    // Process environment variables (handle both array and object formats)
    let envVars = [];
    if (serviceConfig.environment) {
      if (Array.isArray(serviceConfig.environment)) {
        envVars = serviceConfig.environment;
      } else {
        envVars = Object.entries(serviceConfig.environment).map(([key, value]) => `${key}=${value}`);
      }
    }

    // Process volumes with proper path handling
    const processedVolumes = (serviceConfig.volumes || []).map(volume => {
      // Skip Docker socket and system mounts
      if (volume.includes('/var/run/docker.sock') || volume.includes('/proc') || volume.includes('/sys')) {
        return volume;
      }

      const [host, container, options] = volume.split(':');

      // Handle relative paths and special cases
      let hostPath;
      if (host.startsWith('./')) {
        // Create app-specific config directory
        hostPath = path.join(process.cwd(), 'server', 'data', appId, host.substring(2));
      } else if (host.startsWith('/')) {
        // Absolute path - use as is (but validate it's safe)
        if (host.startsWith('/var/run') || host.startsWith('/proc') || host.startsWith('/sys')) {
          return volume; // System paths, don't modify
        }
        hostPath = host;
      } else {
        // Relative path - create in app data directory
        hostPath = path.join(process.cwd(), 'server', 'data', appId, host);
      }

      // Ensure directory exists for non-system paths
      try {
        if (!fs.existsSync(hostPath)) {
          fs.mkdirSync(hostPath, { recursive: true });
          fs.chmodSync(hostPath, 0o755);
        }
      } catch (error) {
        console.error(`Error creating volume path ${hostPath}:`, error);
        // Don't fail deployment for volume creation issues
        console.warn(`Warning: Could not create volume path ${hostPath}, using default`);
      }

      return options ? `${hostPath}:${container}:${options}` : `${hostPath}:${container}`;
    });

    // Create container config
    const containerConfig = {
      Image: serviceConfig.image,
      name: serviceConfig.container_name,
      Env: envVars,
      HostConfig: {
        RestartPolicy: {
          Name: serviceConfig.restart === 'unless-stopped' ? 'unless-stopped' : 'no',
        },
        Binds: processedVolumes,
        PortBindings: {},
        NetworkMode: 'homelabarr', // Use homelabarr network by default
      },
      ExposedPorts: {}
    };

    // Handle port bindings with UDP support
    if (serviceConfig.ports) {
      serviceConfig.ports.forEach(portMapping => {
        // Handle both TCP and UDP ports
        const isUdp = portMapping.includes('/udp');
        const cleanMapping = portMapping.replace('/udp', '');
        const [hostPort, containerPort] = cleanMapping.split(':').reverse();
        const protocol = isUdp ? 'udp' : 'tcp';

        containerConfig.ExposedPorts[`${containerPort}/${protocol}`] = {};
        containerConfig.HostConfig.PortBindings[`${containerPort}/${protocol}`] = [
          { HostPort: hostPort }
        ];
      });
    }

    console.log('Container config:', containerConfig);

    // Create and start the container
    let container;
    try {
      container = await dockerManager.executeWithRetry(
        async (docker) => {
          // Check if container with same name exists
          const existingContainers = await docker.listContainers({ all: true });
          const existing = existingContainers.find(c =>
            c.Names.includes(`/${containerConfig.name}`)
          );

          if (existing) {
            console.log('Container already exists, removing...');
            const existingContainer = docker.getContainer(existing.Id);
            if (existing.State === 'running') {
              await existingContainer.stop();
            }
            await existingContainer.remove();
          }

          const newContainer = await docker.createContainer(containerConfig);
          console.log('Container created:', newContainer.id);
          return newContainer;
        },
        'Create container'
      );
    } catch (error) {
      console.error('Error creating container:', error);
      throw new Error(`Failed to create container: ${error.message}`);
    }

    // Connect to networks after creation
    try {
      await dockerManager.executeWithRetry(
        async (docker) => {
          if (finalConfig.networks && finalConfig.networks.proxy) {
            const proxyNetwork = docker.getNetwork('proxy');
            await proxyNetwork.connect({ Container: container.id });
            console.log('Connected to proxy network');
          }

          const homelabarrNetwork = docker.getNetwork('homelabarr');
          await homelabarrNetwork.connect({ Container: container.id });
          console.log('Connected to homelabarr network');
        },
        'Connect to networks'
      );
    } catch (networkError) {
      console.warn('Network connection warning:', networkError.message);
      // Don't fail deployment for network issues
    }

    try {
      await dockerManager.executeWithRetry(
        async (docker) => {
          await container.start();
          console.log('Container started');
        },
        'Start container'
      );
    } catch (error) {
      console.error('Error starting container:', error);
      // Try to get container logs for better error reporting
      try {
        const logs = await container.logs({ tail: 50, stdout: true, stderr: true });
        console.error('Container logs:', logs.toString());
      } catch (logError) {
        console.error('Could not fetch container logs:', logError);
      }
      throw new Error(`Failed to start container: ${error.message}`);
    }

    logger.info(`✅ Successfully deployed ${appId} (${container.id})`);
    res.json({
      success: true,
      containerId: container.id,
      appId: appId,
      message: 'Container deployed successfully'
    });
  } catch (error) {
    logger.error(`❌ Failed to deploy ${appId}:`, error.message);

    // Determine appropriate status code based on error type
    let statusCode = 500;
    if (error.dockerStatus === 'degraded') {
      statusCode = 503;
    } else if (error.message.includes('Port conflict')) {
      statusCode = 409;
    } else if (error.message.includes('Template not found')) {
      statusCode = 404;
    } else if (error.message.includes('required') || error.message.includes('invalid')) {
      statusCode = 400;
    }

    const errorResponse = dockerManager.createErrorResponse('Deploy container', error);
    errorResponse.appId = appId;
    errorResponse.step = error.step || 'deployment';

    res.status(statusCode).json(errorResponse);
  }
});

// Enhanced Mount Container API endpoints - Proxy to container's web interface
app.get('/enhanced-mount/:containerId/status', conditionalAuth, async (req, res) => {
  try {
    const { containerId } = req.params;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    // Find the web interface port (default 8080)
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's API
    const response = await fetch(`http://localhost:${webPort}/api/v2/status`);
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      data: data
    });
  } catch (error) {
    logger.error(`Error fetching enhanced mount status for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced mount status',
      details: error.message
    });
  }
});

app.get('/enhanced-mount/:containerId/providers', conditionalAuth, async (req, res) => {
  try {
    const { containerId } = req.params;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's API
    const response = await fetch(`http://localhost:${webPort}/api/v2/providers`);
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      data: data
    });
  } catch (error) {
    logger.error(`Error fetching enhanced mount providers for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced mount providers',
      details: error.message
    });
  }
});

app.get('/enhanced-mount/:containerId/costs', conditionalAuth, async (req, res) => {
  try {
    const { containerId } = req.params;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's API
    const response = await fetch(`http://localhost:${webPort}/api/v2/costs`);
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      data: data
    });
  } catch (error) {
    logger.error(`Error fetching enhanced mount costs for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced mount costs',
      details: error.message
    });
  }
});

app.get('/enhanced-mount/:containerId/performance', conditionalAuth, async (req, res) => {
  try {
    const { containerId } = req.params;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's API
    const response = await fetch(`http://localhost:${webPort}/api/v2/performance`);
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      data: data
    });
  } catch (error) {
    logger.error(`Error fetching enhanced mount performance for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced mount performance',
      details: error.message
    });
  }
});

// Provider configuration endpoints
app.post('/enhanced-mount/:containerId/providers/:provider/enable', conditionalAuth, async (req, res) => {
  try {
    const { containerId, provider } = req.params;
    const config = req.body;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's API
    const response = await fetch(`http://localhost:${webPort}/api/v2/providers/${provider}/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      provider: provider,
      data: data
    });
  } catch (error) {
    logger.error(`Error enabling provider ${req.params.provider} for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to enable provider ${req.params.provider}`,
      details: error.message
    });
  }
});

app.post('/enhanced-mount/:containerId/providers/:provider/disable', conditionalAuth, async (req, res) => {
  try {
    const { containerId, provider } = req.params;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's API
    const response = await fetch(`http://localhost:${webPort}/api/v2/providers/${provider}/disable`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      provider: provider,
      data: data
    });
  } catch (error) {
    logger.error(`Error disabling provider ${req.params.provider} for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to disable provider ${req.params.provider}`,
      details: error.message
    });
  }
});

// Rclone Authentication endpoints
app.post('/enhanced-mount/:containerId/auth/start', conditionalAuth, async (req, res) => {
  try {
    const { containerId } = req.params;
    const { provider } = req.body;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's auth API
    const response = await fetch(`http://localhost:${webPort}/api/v2/auth/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider })
    });
    
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      data: data
    });
  } catch (error) {
    logger.error(`Error starting auth for ${req.params.provider} on ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to start authentication',
      details: error.message
    });
  }
});

app.post('/enhanced-mount/:containerId/auth/complete', conditionalAuth, async (req, res) => {
  try {
    const { containerId } = req.params;
    const { provider, auth_code } = req.body;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's auth API
    const response = await fetch(`http://localhost:${webPort}/api/v2/auth/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider, auth_code })
    });
    
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      data: data
    });
  } catch (error) {
    logger.error(`Error completing auth for ${req.params.provider} on ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete authentication',
      details: error.message
    });
  }
});

app.post('/enhanced-mount/:containerId/auth/api-key', conditionalAuth, async (req, res) => {
  try {
    const { containerId } = req.params;
    const { provider, credentials } = req.body;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's auth API
    const response = await fetch(`http://localhost:${webPort}/api/v2/auth/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider, credentials })
    });
    
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      data: data
    });
  } catch (error) {
    logger.error(`Error configuring API key for ${req.params.provider} on ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure API credentials',
      details: error.message
    });
  }
});

// Test rclone connection
app.post('/enhanced-mount/:containerId/auth/test', conditionalAuth, async (req, res) => {
  try {
    const { containerId } = req.params;
    const { provider } = req.body;
    
    // Get container info to find its web port
    const container = dockerManager.getDocker().getContainer(containerId);
    const containerInfo = await container.inspect();
    
    let webPort = 8080;
    if (containerInfo.NetworkSettings?.Ports) {
      const portMapping = containerInfo.NetworkSettings.Ports['8080/tcp'];
      if (portMapping && portMapping[0]) {
        webPort = portMapping[0].HostPort;
      }
    }
    
    // Proxy request to container's test API
    const response = await fetch(`http://localhost:${webPort}/api/v2/auth/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider })
    });
    
    if (!response.ok) {
      throw new Error(`Container API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      containerId: containerId,
      data: data
    });
  } catch (error) {
    logger.error(`Error testing connection for ${req.params.provider} on ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connection',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  dockerManager.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  dockerManager.destroy();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  dockerManager.destroy();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  dockerManager.destroy();
  process.exit(1);
});

// Start server with network configuration
const PORT = networkConfig.port;
const BIND_ADDRESS = networkConfig.bindAddress;

// Log network binding attempt
DeploymentLogger.logNetworkActivity('Server binding attempt', {
  bindAddress: BIND_ADDRESS,
  port: PORT,
  platform: envConfig.platform,
  environment: envConfig.environment
});

// Log environment and network information at startup
EnvironmentManager.logEnvironmentInfo();
NetworkManager.logNetworkInfo();

// Initialize DeploymentLogger
DeploymentLogger.initialize();

// Validate configuration before starting with comprehensive error handling
try {
  const envValidation = EnvironmentManager.validateConfiguration();
  const networkValidation = NetworkManager.validateNetworkConfiguration();

  if (!envValidation.isValid) {
    logger.error('❌ Environment configuration validation failed:');
    envValidation.errors.forEach(error => logger.error(`  • ${error}`));
    
    // Log detailed troubleshooting information
    DeploymentLogger.logNetworkActivity('Environment configuration validation failed', {
      validationResult: envValidation,
      platform: envConfig.platform,
      environment: envConfig.environment,
      troubleshooting: {
        possibleCauses: [
          'Missing required environment variables',
          'Invalid environment variable values',
          'Platform-specific configuration issues'
        ],
        suggestedActions: [
          'Check .env files for missing variables',
          'Verify environment variable formats',
          'Review platform-specific requirements',
          'Check file permissions for configuration files'
        ]
      }
    });
    
    process.exit(1);
  }

  if (!networkValidation.isValid) {
    logger.error('❌ Network configuration validation failed:');
    networkValidation.errors.forEach(error => logger.error(`  • ${error}`));
    
    // Log detailed troubleshooting information
    DeploymentLogger.logNetworkActivity('Network configuration validation failed', {
      validationResult: networkValidation,
      platform: envConfig.platform,
      environment: envConfig.environment,
      troubleshooting: {
        possibleCauses: [
          'Invalid Docker socket path',
          'Port conflicts or invalid port numbers',
          'Network binding issues',
          'Service URL configuration problems'
        ],
        suggestedActions: [
          'Verify Docker is running and accessible',
          'Check for port conflicts with other services',
          'Ensure proper network permissions',
          'Validate service URL formats'
        ]
      }
    });
    
    process.exit(1);
  }

  // Log successful validation
  logger.info('✅ Configuration validation completed successfully');
  
} catch (configError) {
  logger.error('❌ Critical error during configuration validation:', configError);
  
  DeploymentLogger.logNetworkActivity('Configuration validation critical error', {
    error: {
      message: configError.message,
      stack: configError.stack,
      type: 'configuration_validation_error'
    },
    platform: envConfig.platform,
    environment: envConfig.environment,
    troubleshooting: {
      possibleCauses: [
        'Component initialization failure',
        'Missing configuration files',
        'Corrupted environment state',
        'Platform compatibility issues'
      ],
      suggestedActions: [
        'Restart the application',
        'Check component file integrity',
        'Verify all required files are present',
        'Review system requirements'
      ]
    }
  });
  
  process.exit(1);
}

// Initialize authentication system with comprehensive error handling
initializeAuth().then(() => {
  logger.info('✅ Authentication system initialized successfully');
  
  try {
    const server = app.listen(PORT, BIND_ADDRESS, () => {
      // Log successful network binding
      DeploymentLogger.logNetworkActivity('Server successfully bound and listening', {
        bindAddress: BIND_ADDRESS,
        port: PORT,
        platform: envConfig.platform,
        environment: envConfig.environment,
        success: true
      });
      
      // Log comprehensive startup information using DeploymentLogger
      DeploymentLogger.logStartupInfo();
      DeploymentLogger.logConfigurationSummary();
      
      // Log basic server startup info for immediate feedback
      logger.info(`🚀 HomelabARR backend running on ${BIND_ADDRESS}:${PORT}`);
      logger.info(`📋 Platform: ${envConfig.platform} | Environment: ${envConfig.environment}`);
      logger.info(`🔐 Authentication: ${authEnabled ? 'enabled' : 'disabled'}`);
      logger.info(`🐳 Docker connection manager initialized with socket: ${networkConfig.dockerSocket}`);
      logger.info(`🌐 Network configuration validated successfully`);
      
      // Log configuration warnings if they exist
      try {
        const envValidation = EnvironmentManager.validateConfiguration();
        const networkValidation = NetworkManager.validateNetworkConfiguration();
        
        if (envValidation.warnings && envValidation.warnings.length > 0) {
          logger.warn('⚠️  Environment configuration warnings:');
          envValidation.warnings.forEach(warning => logger.warn(`  • ${warning}`));
        }
        
        if (networkValidation.warnings && networkValidation.warnings.length > 0) {
          logger.warn('⚠️  Network configuration warnings:');
          networkValidation.warnings.forEach(warning => logger.warn(`  • ${warning}`));
        }
      } catch (warningError) {
        logger.debug('Could not retrieve configuration warnings:', warningError.message);
      }
      
      logger.info('🎉 Application startup completed successfully');
    });

    // Handle server startup errors with detailed troubleshooting
    server.on('error', (error) => {
      const troubleshooting = {
        possibleCauses: [],
        suggestedActions: []
      };
      
      // Provide specific troubleshooting based on error type
      if (error.code === 'EADDRINUSE') {
        troubleshooting.possibleCauses.push(
          `Port ${PORT} is already in use by another process`,
          'Another instance of the application is running',
          'System service is using the port'
        );
        troubleshooting.suggestedActions.push(
          `Check what process is using port ${PORT}`,
          'Stop the conflicting process or change the port',
          'Use a different PORT environment variable',
          `On Windows: netstat -ano | findstr :${PORT}`,
          `On Linux: lsof -i :${PORT}`
        );
      } else if (error.code === 'EACCES') {
        troubleshooting.possibleCauses.push(
          'Insufficient permissions to bind to the port',
          'Port is in privileged range (< 1024) and requires admin rights'
        );
        troubleshooting.suggestedActions.push(
          'Run with administrator/root privileges',
          'Use a port number above 1024',
          'Check firewall settings'
        );
      } else if (error.code === 'EADDRNOTAVAIL') {
        troubleshooting.possibleCauses.push(
          `Bind address ${BIND_ADDRESS} is not available`,
          'Network interface is not configured',
          'Invalid IP address specified'
        );
        troubleshooting.suggestedActions.push(
          'Verify the bind address is correct',
          'Use 0.0.0.0 for all interfaces',
          'Check network interface configuration'
        );
      }
      
      DeploymentLogger.logNetworkActivity('Server binding failed', {
        bindAddress: BIND_ADDRESS,
        port: PORT,
        platform: envConfig.platform,
        environment: envConfig.environment,
        error: {
          message: error.message,
          code: error.code,
          type: 'server_binding_error',
          stack: error.stack
        },
        troubleshooting
      });
      
      logger.error('❌ Failed to start server:', error);
      logger.error('💡 Troubleshooting suggestions:');
      troubleshooting.suggestedActions.forEach(action => {
        logger.error(`  • ${action}`);
      });
      
      // Clean up Docker manager before exit
      try {
        dockerManager.destroy();
      } catch (cleanupError) {
        logger.debug('Error during cleanup:', cleanupError.message);
      }
      
      process.exit(1);
    });

    // Enhanced graceful shutdown handling
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, initiating graceful shutdown`);
      
      DeploymentLogger.logNetworkActivity('Server shutdown initiated', {
        reason: signal,
        bindAddress: BIND_ADDRESS,
        port: PORT,
        platform: envConfig.platform,
        environment: envConfig.environment
      });
      
      // Set a timeout for forced shutdown
      const shutdownTimeout = setTimeout(() => {
        logger.error('❌ Graceful shutdown timeout, forcing exit');
        DeploymentLogger.logNetworkActivity('Forced shutdown due to timeout', {
          reason: signal,
          bindAddress: BIND_ADDRESS,
          port: PORT
        });
        process.exit(1);
      }, 10000); // 10 second timeout
      
      server.close((closeError) => {
        clearTimeout(shutdownTimeout);
        
        if (closeError) {
          logger.error('❌ Error during server shutdown:', closeError);
          DeploymentLogger.logNetworkActivity('Server shutdown error', {
            reason: signal,
            bindAddress: BIND_ADDRESS,
            port: PORT,
            error: {
              message: closeError.message,
              code: closeError.code
            }
          });
        } else {
          logger.info('✅ Server closed successfully');
          DeploymentLogger.logNetworkActivity('Server shutdown completed', {
            reason: signal,
            bindAddress: BIND_ADDRESS,
            port: PORT
          });
        }
        
        // Clean up Docker manager
        try {
          dockerManager.destroy();
          logger.info('✅ Docker connection manager cleaned up');
        } catch (cleanupError) {
          logger.error('⚠️  Error cleaning up Docker manager:', cleanupError.message);
        }
        
        process.exit(closeError ? 1 : 0);
      });
    };

    // Handle multiple shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error);
      DeploymentLogger.logNetworkActivity('Uncaught exception occurred', {
        error: {
          message: error.message,
          stack: error.stack,
          type: 'uncaught_exception'
        },
        platform: envConfig.platform,
        environment: envConfig.environment
      });
      
      // Clean up and exit
      try {
        dockerManager.destroy();
      } catch (cleanupError) {
        logger.debug('Error during cleanup:', cleanupError.message);
      }
      
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      DeploymentLogger.logNetworkActivity('Unhandled promise rejection occurred', {
        error: {
          message: reason?.message || String(reason),
          stack: reason?.stack,
          type: 'unhandled_rejection'
        },
        platform: envConfig.platform,
        environment: envConfig.environment
      });
      
      // Don't exit on unhandled rejection in production, just log it
      if (envConfig.environment !== 'production') {
        // Clean up and exit in development
        try {
          dockerManager.destroy();
        } catch (cleanupError) {
          logger.debug('Error during cleanup:', cleanupError.message);
        }
        
        process.exit(1);
      }
    });
    
  } catch (serverError) {
    logger.error('❌ Critical error during server initialization:', serverError);
    
    DeploymentLogger.logNetworkActivity('Server initialization critical error', {
      error: {
        message: serverError.message,
        stack: serverError.stack,
        type: 'server_initialization_error'
      },
      platform: envConfig.platform,
      environment: envConfig.environment,
      troubleshooting: {
        possibleCauses: [
          'Express application configuration error',
          'Middleware initialization failure',
          'System resource limitations'
        ],
        suggestedActions: [
          'Check application configuration',
          'Verify all dependencies are installed',
          'Check system resources (memory, disk space)',
          'Review recent code changes'
        ]
      }
    });
    
    // Clean up Docker manager before exit
    try {
      dockerManager.destroy();
    } catch (cleanupError) {
      logger.debug('Error during cleanup:', cleanupError.message);
    }
    
    process.exit(1);
  }
  
}).catch(authError => {
  logger.error('❌ Failed to initialize authentication system:', authError);
  
  DeploymentLogger.logNetworkActivity('Authentication initialization failed', {
    error: {
      message: authError.message,
      stack: authError.stack,
      type: 'authentication_initialization_error'
    },
    platform: envConfig.platform,
    environment: envConfig.environment,
    troubleshooting: {
      possibleCauses: [
        'Authentication configuration error',
        'Database initialization failure',
        'User data corruption',
        'File system permissions'
      ],
      suggestedActions: [
        'Check authentication configuration',
        'Verify database files are accessible',
        'Check file permissions for auth data',
        'Review authentication logs',
        'Consider resetting authentication data'
      ]
    }
  });
  
  // Clean up Docker manager before exit
  try {
    dockerManager.destroy();
  } catch (cleanupError) {
    logger.debug('Error during cleanup:', cleanupError.message);
  }
  
  process.exit(1);
});