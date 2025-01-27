import express from 'express';
import Docker from 'dockerode';
import cors from 'cors';
import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fileURLToPath } from 'url';

const app = express();
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

app.use(express.json());

// Helper functions
function calculateCPUPercentage(stats) {
  // CPU percentage calculation logic
  return 0; // Implement actual calculation
}

function calculateMemoryUsage(stats) {
  // Memory usage calculation logic
  return {
    usage: 0,
    limit: 0,
    percentage: 0
  }; // Implement actual calculation
}

function calculateNetworkUsage(stats) {
  // Network usage calculation logic
  return {}; // Implement actual calculation
}

function calculateUptime(container) {
  if (!container.State || !container.State.StartedAt) {
    return 0;
  }
  
  const startTime = new Date(container.State.StartedAt).getTime();
  const now = new Date().getTime();
  return Math.floor((now - startTime) / 1000);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

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
    next(error);
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});