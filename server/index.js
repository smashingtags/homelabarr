import express from 'express';
import Docker from 'dockerode';
import cors from 'cors';
import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import helmet from 'helmet';
import os from 'os';
import { chmodSync } from 'fs';

// CORS configuration
const corsOptions = {
  origin: '*',  // Allow all origins in development
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

const app = express();

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

let docker;

// Configure Docker connection based on platform
try {
  // Try to set socket permissions if we're on Linux
  if (os.platform() === 'linux') {
    try {
      chmodSync('/var/run/docker.sock', 0o666);
    } catch (err) {
      console.warn('Could not set Docker socket permissions:', err.message);
    }
  }

  if (os.platform() === 'win32') {
    docker = new Docker({
      host: '127.0.0.1',
      port: 2375
    });
  } else {
    docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
      timeout: 30000
    });
  }
} catch (error) {
  console.error('Error connecting to Docker:', error);
  docker = {
    listContainers: async () => [],
    getContainer: () => ({
      stats: async () => ({}),
      inspect: async () => ({})
    })
  };
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: { policy: "credentialless" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle OPTIONS requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());

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

  return (cpuDelta / systemDelta) * cpuCount * 100;
}

function calculateMemoryUsage(stats) {
  if (!stats || !stats.memory_stats) {
    return {
      usage: 0,
      limit: 0,
      percentage: 0
    };
  }

  const usage = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);
  const limit = stats.memory_stats.limit;

  return {
    usage,
    limit,
    percentage: (usage / limit) * 100
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

// Routes
app.get('/containers', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const containersWithStats = await Promise.all(
      containers.map(async (container) => {
        try {
          const containerInfo = docker.getContainer(container.Id);
          const stats = await containerInfo.stats({ stream: false });
          const info = await containerInfo.inspect();
          
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
          return container;
        }
      })
    );
    res.json(containersWithStats);
  } catch (error) {
    console.error('Error fetching containers:', error);
    res.json([]);
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
app.listen(PORT, '0.0.0.0', () => {  // Listen on all interfaces
  console.log(`Server running on port ${PORT}`);
  console.log(`Running on platform: ${os.platform()}`);
  console.log('Docker connection mode:', os.platform() === 'win32' ? 'Windows TCP' : 'Unix Socket');
});