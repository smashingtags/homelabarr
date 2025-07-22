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

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
const authEnabled = process.env.AUTH_ENABLED !== 'false'; // Default to enabled

// Enhanced logging utility with structured logging for Docker connections
const logger = {
  info: (message, ...args) => console.log(`ℹ️  ${message}`, ...args),
  warn: (message, ...args) => console.warn(`⚠️  ${message}`, ...args),
  error: (message, ...args) => console.error(`❌ ${message}`, ...args),
  debug: (message, ...args) => {
    if (isDevelopment || logLevel === 'debug') console.log(`🐛 ${message}`, ...args);
  },

  // Structured logging methods for Docker operations
  dockerConnection: (level, message, context = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      component: 'DockerConnectionManager',
      message,
      ...context
    };

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
        if (isDevelopment || logLevel === 'debug') {
          console.log(`🐛 ${formattedMessage}`, contextStr ? '\n' + contextStr : '');
        }
        break;
    }

    return logEntry;
  },

  // Specialized method for connection state changes
  dockerStateChange: (fromState, toState, context = {}) => {
    const stateChangeContext = {
      stateTransition: {
        from: fromState,
        to: toState,
        timestamp: new Date().toISOString()
      },
      ...context
    };

    return logger.dockerConnection('info', `Connection state changed: ${fromState} → ${toState}`, stateChangeContext);
  },

  // Method for retry attempts with detailed context
  dockerRetry: (attempt, maxAttempts, delay, error, context = {}) => {
    const retryContext = {
      retry: {
        attempt,
        maxAttempts,
        delayMs: delay,
        nextRetryAt: new Date(Date.now() + delay).toISOString()
      },
      error: {
        type: error.type || 'unknown',
        code: error.code || 'UNKNOWN',
        message: error.message,
        recoverable: error.recoverable !== false
      },
      ...context
    };

    return logger.dockerConnection('warn', `Retry attempt ${attempt}/${maxAttempts} scheduled in ${delay}ms`, retryContext);
  },

  // Method for operation failures with troubleshooting info
  dockerOperationFailed: (operation, error, troubleshooting = {}) => {
    const operationContext = {
      operation,
      error: {
        type: error.type || 'unknown',
        code: error.code || 'UNKNOWN',
        message: error.message,
        severity: error.severity || 'medium',
        recoverable: error.recoverable !== false,
        userMessage: error.userMessage || error.message
      },
      troubleshooting: {
        possibleCauses: troubleshooting.possibleCauses || [],
        suggestedActions: troubleshooting.suggestedActions || [],
        documentationLinks: troubleshooting.documentationLinks || []
      },
      timestamp: new Date().toISOString()
    };

    return logger.dockerConnection('error', `Operation '${operation}' failed`, operationContext);
  }
};

const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:8080', 'http://localhost:3000'];

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Check if origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

const app = express();

// Middleware setup
app.use(express.json());
app.use(cors(corsOptions));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

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

// Enhanced health check endpoint with Docker connection status
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

    // Determine overall service status
    let overallStatus = 'OK';
    let httpStatus = 200;

    if (dockerStatus === 'connected') {
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
      platform: process.platform || 'linux',
      docker: {
        status: dockerStatus,
        socketPath: connectionState.config.socketPath,
        timeout: connectionState.config.timeout,
        serviceMessage: serviceStatus.message,
        ...dockerDetails
      },
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime()
    };

    // Add Docker version info if available
    if (dockerInfo) {
      healthResponse.docker.version = {
        version: dockerInfo.Version,
        apiVersion: dockerInfo.ApiVersion,
        platform: dockerInfo.Os,
        arch: dockerInfo.Arch
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

    const errorResponse = {
      status: 'ERROR',
      platform: process.platform || 'linux',
      docker: {
        status: 'error',
        error: {
          message: error.message,
          code: error.code,
          type: 'health_check_failure'
        },
        socketPath: connectionState.config.socketPath,
        serviceMessage: serviceStatus.message
      },
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
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

// Template validation endpoint
app.get('/templates/validate', (req, res) => {
  try {
    const templateDir = path.join(process.cwd(), 'server', 'templates');
    const templateFiles = fs.readdirSync(templateDir)
      .filter(file => file.endsWith('.yml'))
      .map(file => file.replace('.yml', ''));

    res.json({
      success: true,
      availableTemplates: templateFiles.sort(),
      count: templateFiles.length
    });
  } catch (error) {
    console.error('Error reading templates:', error);
    res.status(500).json({
      error: 'Failed to read templates',
      details: error.message
    });
  }
});

// Port availability check endpoint
app.get('/ports/check', async (req, res) => {
  try {
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Check port availability', new Error(serviceStatus.message), false)
      );
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
    this.config = {
      socketPath: options.socketPath || process.env.DOCKER_SOCKET || '/var/run/docker.sock',
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 5,
      retryDelay: options.retryDelay || 1000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      maxRetryDelay: options.maxRetryDelay || 30000,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 3,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000
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

    // Log initialization
    logger.dockerConnection('info', 'Initializing Docker Connection Manager', {
      config: this.config,
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    });

    // Initialize connection
    this.connect();
    this.startHealthCheck();
    this.startStatsLogging();
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
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
      });

      this.docker = new Docker({
        socketPath: this.config.socketPath,
        timeout: this.config.timeout
      });

      // Test the connection by listing containers with detailed logging
      logger.dockerConnection('debug', 'Testing Docker connection with container list operation');
      const testResult = await this.docker.listContainers({ limit: 1 });

      // Log successful connection with context
      const connectionContext = {
        socketPath: this.config.socketPath,
        testContainers: testResult.length,
        connectionDuration: this.state.lastSuccessfulConnection ?
          Date.now() - this.state.lastSuccessfulConnection.getTime() : 'first_connection',
        previousRetryCount: this.state.retryCount,
        circuitBreakerState: this.circuitBreaker.state,
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
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
        consecutiveFailures: this.circuitBreaker.consecutiveFailures
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
      consecutiveFailures: this.circuitBreaker.consecutiveFailures
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
      documentationLinks: []
    };

    switch (classifiedError.type) {
      case 'permission':
        troubleshooting.possibleCauses = [
          'Container user not in docker group',
          'Docker socket permissions too restrictive',
          'Incorrect group_add configuration in docker-compose'
        ];
        troubleshooting.suggestedActions = [
          'Check docker-compose.yml group_add configuration',
          'Verify Docker socket is mounted correctly',
          'Ensure container user has docker group membership',
          'Check host system docker group ID matches container configuration'
        ];
        break;

      case 'socket_not_found':
        troubleshooting.possibleCauses = [
          'Docker daemon not running',
          'Docker socket not mounted in container',
          'Incorrect socket path configuration'
        ];
        troubleshooting.suggestedActions = [
          'Verify Docker daemon is running on host',
          'Check docker-compose.yml volume mounts for /var/run/docker.sock',
          'Confirm DOCKER_SOCKET environment variable is correct',
          'Ensure Docker is installed on host system'
        ];
        break;

      case 'connection_refused':
        troubleshooting.possibleCauses = [
          'Docker daemon starting up',
          'Docker daemon crashed or stopped',
          'Network connectivity issues'
        ];
        troubleshooting.suggestedActions = [
          'Wait for Docker daemon to fully start',
          'Check Docker daemon status on host',
          'Restart Docker service if necessary',
          'Check system resources (disk space, memory)'
        ];
        break;

      case 'timeout':
        troubleshooting.possibleCauses = [
          'Docker daemon overloaded',
          'Network latency issues',
          'System resource constraints'
        ];
        troubleshooting.suggestedActions = [
          'Check system resource usage (CPU, memory, disk)',
          'Increase timeout configuration if needed',
          'Check for other processes consuming Docker resources',
          'Consider restarting Docker daemon'
        ];
        break;

      default:
        troubleshooting.possibleCauses = [
          'Unknown Docker connectivity issue',
          'System configuration problem'
        ];
        troubleshooting.suggestedActions = [
          'Check Docker daemon logs',
          'Verify container configuration',
          'Check system resources and connectivity'
        ];
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
      occurredAt: new Date().toISOString()
    };

    if (error.code === 'EACCES') {
      errorInfo.type = 'permission';
      errorInfo.recoverable = false;
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Docker socket permission denied. Please check container configuration.';
    } else if (error.code === 'ENOENT') {
      errorInfo.type = 'socket_not_found';
      errorInfo.recoverable = false;
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Docker socket not found. Please ensure Docker is installed and running.';
    } else if (error.code === 'ECONNREFUSED') {
      errorInfo.type = 'connection_refused';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Cannot connect to Docker daemon. Docker may be starting up.';
    } else if (error.code === 'ENOTFOUND') {
      errorInfo.type = 'host_not_found';
      errorInfo.recoverable = true;
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Docker host not found. Please check Docker configuration.';
    } else if (error.code === 'ETIMEDOUT') {
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

    const response = {
      error: `${operation} failed`,
      message: classifiedError.userMessage,
      details: {
        type: classifiedError.type,
        code: classifiedError.code,
        severity: classifiedError.severity,
        recoverable: classifiedError.recoverable
      },
      docker: {
        connected: connectionState.isConnected,
        socketPath: connectionState.config.socketPath
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
    const suggestions = {
      permission: 'Check Docker socket permissions and ensure the container user is in the docker group.',
      socket_not_found: 'Ensure Docker is installed and the socket path is correctly mounted.',
      client_error: 'Review the request parameters and ensure they are valid.',
      unknown: 'Check Docker daemon status and container configuration.'
    };

    return suggestions[errorType] || suggestions.unknown;
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
        occurredAt: this.state.lastError.occurredAt
      } : null,
      circuitBreaker: this.getCircuitBreakerStatus(),
      config: {
        socketPath: this.config.socketPath,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
        healthCheckInterval: this.config.healthCheckInterval,
        circuitBreakerThreshold: this.config.circuitBreakerThreshold,
        circuitBreakerTimeout: this.config.circuitBreakerTimeout
      }
    };

    return stats;
  }

  // Log periodic connection statistics
  logConnectionStats() {
    const stats = this.getConnectionStats();

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

// Initialize Docker Connection Manager
const dockerManager = new DockerConnectionManager();

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
    logger.info(`🚀 Starting deployment of ${appId}...`);

    // Check Docker availability first
    const serviceStatus = dockerManager.getServiceStatus();

    if (serviceStatus.status === 'unavailable') {
      return res.status(503).json(
        dockerManager.createErrorResponse('Deploy container', new Error(serviceStatus.message))
      );
    }

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

// Start server
const PORT = process.env.PORT || 3001;
// Initialize authentication system
initializeAuth().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`HomelabARR backend running on port ${PORT}`);
    logger.info('Configured for Linux Docker deployments');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Authentication: ${authEnabled ? 'enabled' : 'disabled'}`);
    logger.info(`CORS origins: ${allowedOrigins.join(', ')}`);
    logger.info(`Docker connection manager initialized`);
  });

  // Graceful shutdown for server
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server');
    server.close(() => {
      logger.info('Server closed');
    });
  });
}).catch(error => {
  logger.error('Failed to initialize authentication:', error);
  dockerManager.destroy();
  process.exit(1);
});