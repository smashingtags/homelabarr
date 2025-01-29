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

const mkdir = promisify(fs.mkdir);
const chmod = promisify(fs.chmod);

// CORS configuration
const corsOptions = {
  origin: '*',  // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Access-Control-Allow-Origin'],
  exposedHeaders: ['Access-Control-Allow-Origin'],
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
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// Apply CORS middleware
app.use(cors(corsOptions));


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

// Deploy container endpoint
app.post('/deploy', async (req, res) => {
  try {
    const { appId, config } = req.body;
    console.log('Deploying app:', appId, 'with config:', config);
    
    // Read template file
    const templatePath = path.join(process.cwd(), 'server', 'templates', `${appId}.yml`);
    if (!fs.existsSync(templatePath)) {
      console.error('Template not found:', templatePath);
      return res.status(404).json({ error: 'Template not found' });
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

    // Ensure the homelabarr network exists
    try {
      const networks = await docker.listNetworks();
      const networkExists = networks.some(n => n.Name === 'homelabarr');
      if (!networkExists) {
        console.log('Creating homelabarr network');
        await docker.createNetwork({
          Name: 'homelabarr',
          Driver: 'bridge'
        });
      }
    } catch (error) {
      console.error('Error checking/creating network:', error);
      throw new Error('Failed to setup network');
    }

    // Get the service configuration
    const [serviceName, serviceConfig] = Object.entries(finalConfig.services)[0];

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

    // Create container config
    const containerConfig = {
      Image: serviceConfig.image,
      name: serviceConfig.container_name,
      Env: Object.entries(serviceConfig.environment || {}).map(([key, value]) => `${key}=${value}`),
      HostConfig: {
        RestartPolicy: {
          Name: serviceConfig.restart || 'no',
        },
        Binds: (serviceConfig.volumes || []).map(volume => {
          const [host, container] = volume.split(':');
          // Ensure host path exists
          try {
            const hostPath = path.resolve(host);
            if (!fs.existsSync(hostPath)) {
              fs.mkdirSync(hostPath, { recursive: true });
              fs.chmodSync(hostPath, 0o755);
            }
            return `${hostPath}:${container}`;
          } catch (error) {
            console.error(`Error creating volume path ${host}:`, error);
            throw new Error(`Failed to create volume path: ${error.message}`);
          }
        }),
        PortBindings: {},
        NetworkMode: 'homelabarr',
      },
      ExposedPorts: {}
    };

    // Handle port bindings
    if (serviceConfig.ports) {
      serviceConfig.ports.forEach(portMapping => {
        const [hostPort, containerPort] = portMapping.split(':').reverse();
        containerConfig.ExposedPorts[`${containerPort}/tcp`] = {};
        containerConfig.HostConfig.PortBindings[`${containerPort}/tcp`] = [
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

    res.json({ success: true, containerId: container.id });
  } catch (error) {
    console.error('Error deploying container:', error);
    console.error('Stack trace:', error.stack);
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
app.listen(PORT, '0.0.0.0', () => {  // Listen on all interfaces
  console.log(`Server running on port ${PORT}`);
  console.log(`Running on platform: ${os.platform()}`);
  console.log('Docker connection mode:', os.platform() === 'win32' ? 'Windows TCP' : 'Unix Socket');
});