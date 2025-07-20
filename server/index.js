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

// Simple logging utility
const logger = {
  info: (message, ...args) => console.log(`ℹ️  ${message}`, ...args),
  warn: (message, ...args) => console.warn(`⚠️  ${message}`, ...args),
  error: (message, ...args) => console.error(`❌ ${message}`, ...args),
  debug: (message, ...args) => {
    if (isDevelopment) console.log(`🐛 ${message}`, ...args);
  }
};

const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:8080', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
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

// Basic health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test Docker connection
    const containers = await docker.listContainers({ limit: 1 });

    res.status(200).json({
      status: 'OK',
      platform: 'linux',
      docker: 'connected',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      platform: 'linux',
      docker: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
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
    const containers = await docker.listContainers({ all: true });
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
      usedPorts: Array.from(usedPorts).sort((a, b) => a - b)
    });
  } catch (error) {
    console.error('Error checking ports:', error);
    res.status(500).json({
      error: 'Failed to check port availability',
      details: error.message
    });
  }
});

// Find available port endpoint
app.get('/ports/available', async (req, res) => {
  try {
    const startPort = parseInt(req.query.start) || 8000;
    const endPort = parseInt(req.query.end) || 9000;

    const containers = await docker.listContainers({ all: true });
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
          availablePort: port
        });
      }
    }

    res.status(404).json({
      error: 'No available ports found in range',
      details: `Checked ports ${startPort}-${endPort}`
    });
  } catch (error) {
    console.error('Error finding available port:', error);
    res.status(500).json({
      error: 'Failed to find available port',
      details: error.message
    });
  }
});

let docker;

// Configure Docker connection for Linux deployments
try {
  // Set socket permissions for Docker access
  try {
    chmodSync('/var/run/docker.sock', 0o666);
  } catch (err) {
    console.warn('Could not set Docker socket permissions:', err.message);
  }

  docker = new Docker({
    socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    timeout: 30000
  });

  logger.info('Docker client initialized for Linux deployment');
} catch (error) {
  logger.error('Error initializing Docker client:', error);
  process.exit(1);
}

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
    const containers = await docker.listContainers({ all: true });
    const includeStats = req.query.stats === 'true';

    if (!includeStats) {
      // Fast path: return containers without expensive stats
      const containersWithBasicInfo = await Promise.all(
        containers.map(async (container) => {
          try {
            const containerInfo = docker.getContainer(container.Id);
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
            console.error(`Error fetching basic info for container ${container.Id}:`, error);
            return {
              ...container,
              stats: {
                cpu: 0,
                memory: { usage: 0, limit: 0, percentage: 0 },
                network: {},
                uptime: 0
              }
            };
          }
        })
      );
      return res.json(containersWithBasicInfo);
    }

    // Slow path: include full statistics (only when requested)
    const containersWithStats = await Promise.all(
      containers.map(async (container) => {
        try {
          const containerInfo = docker.getContainer(container.Id);
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
          console.error(`Error fetching stats for container ${container.Id}:`, error);
          // Return container with default stats instead of failing
          return {
            ...container,
            stats: {
              cpu: 0,
              memory: { usage: 0, limit: 0, percentage: 0 },
              network: {},
              uptime: 0
            }
          };
        }
      })
    );
    res.json(containersWithStats);
  } catch (error) {
    console.error('Error fetching containers:', error);
    res.json([]);
  }
});

// Separate endpoint for container statistics
app.get('/containers/:id/stats', async (req, res) => {
  try {
    const containerInfo = docker.getContainer(req.params.id);
    const [stats, info] = await Promise.all([
      containerInfo.stats({ stream: false }),
      containerInfo.inspect()
    ]);

    res.json({
      success: true,
      stats: {
        cpu: calculateCPUPercentage(stats),
        memory: calculateMemoryUsage(stats),
        network: calculateNetworkUsage(stats),
        uptime: calculateUptime(info)
      }
    });
  } catch (error) {
    console.error(`Error fetching stats for container ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to fetch container statistics',
      details: error.message
    });
  }
});

// Container control endpoints
app.post('/containers/:id/start', conditionalAuth, async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ success: true, message: 'Container started successfully' });
  } catch (error) {
    console.error('Error starting container:', error);
    res.status(500).json({
      error: 'Failed to start container',
      details: error.message
    });
  }
});

app.post('/containers/:id/stop', conditionalAuth, async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.json({ success: true, message: 'Container stopped successfully' });
  } catch (error) {
    console.error('Error stopping container:', error);
    res.status(500).json({
      error: 'Failed to stop container',
      details: error.message
    });
  }
});

app.post('/containers/:id/restart', conditionalAuth, async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.restart();
    res.json({ success: true, message: 'Container restarted successfully' });
  } catch (error) {
    console.error('Error restarting container:', error);
    res.status(500).json({
      error: 'Failed to restart container',
      details: error.message
    });
  }
});

app.delete('/containers/:id', conditionalAuth, async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);

    // Stop container if it's running
    try {
      const info = await container.inspect();
      if (info.State.Running) {
        await container.stop();
      }
    } catch (stopError) {
      console.warn('Container may already be stopped:', stopError.message);
    }

    // Remove the container
    await container.remove();
    res.json({ success: true, message: 'Container removed successfully' });
  } catch (error) {
    console.error('Error removing container:', error);
    res.status(500).json({
      error: 'Failed to remove container',
      details: error.message
    });
  }
});

app.get('/containers/:id/logs', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const tail = parseInt(req.query.tail) || 100;

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: tail,
      timestamps: true
    });

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
      containerId: req.params.id
    });
  } catch (error) {
    console.error('Error fetching container logs:', error);
    res.status(500).json({
      error: 'Failed to fetch container logs',
      details: error.message
    });
  }
});

// Deploy container endpoint
app.post('/deploy', authEnabled ? requireAuth : optionalAuth, async (req, res) => {
  try {
    const { appId, config, mode } = req.body;
    console.log(`🚀 Starting deployment of ${appId}...`);

    // Validate input
    if (!appId) {
      return res.status(400).json({ error: 'App ID is required' });
    }

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Configuration object is required' });
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
      const containers = await docker.listContainers({ all: true });
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
    } catch (error) {
      console.error('Error checking/creating networks:', error);
      throw new Error('Failed to setup networks');
    }

    // Get the service configuration (reusing variables from above)
    // const [serviceName, serviceConfig] = Object.entries(finalConfig.services)[0]; // Already declared above

    // Pull the image first
    console.log('Pulling image:', serviceConfig.image);
    try {
      const stream = await docker.pull(serviceConfig.image);
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
      });
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

      container = await docker.createContainer(containerConfig);
      console.log('Container created:', container.id);
    } catch (error) {
      console.error('Error creating container:', error);
      throw new Error(`Failed to create container: ${error.message}`);
    }

    // Connect to networks after creation
    try {
      if (finalConfig.networks && finalConfig.networks.proxy) {
        const proxyNetwork = docker.getNetwork('proxy');
        await proxyNetwork.connect({ Container: container.id });
        console.log('Connected to proxy network');
      }
      
      const homelabarrNetwork = docker.getNetwork('homelabarr');
      await homelabarrNetwork.connect({ Container: container.id });
      console.log('Connected to homelabarr network');
    } catch (networkError) {
      console.warn('Network connection warning:', networkError.message);
      // Don't fail deployment for network issues
    }

    try {
      await container.start();
      console.log('Container started');
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

    console.log(`✅ Successfully deployed ${appId} (${container.id})`);
    res.json({ success: true, containerId: container.id });
  } catch (error) {
    console.error(`❌ Failed to deploy ${appId}:`, error.message);
    res.status(500).json({
      error: 'Failed to deploy container',
      details: error.message,
      step: error.step || 'unknown'
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

// Start server
const PORT = process.env.PORT || 3001;
// Initialize authentication system
initializeAuth().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`HomelabARR backend running on port ${PORT}`);
    logger.info('Configured for Linux Docker deployments');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Authentication: ${authEnabled ? 'enabled' : 'disabled'}`);
    logger.info(`CORS origins: ${allowedOrigins.join(', ')}`);
  });
}).catch(error => {
  logger.error('Failed to initialize authentication:', error);
  process.exit(1);
});