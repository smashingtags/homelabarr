import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { DeploymentLogger } from './deployment-logger.js';

/**
 * CLI Bridge - Connects React frontend to HomelabARR CLI system
 * Provides seamless integration with 100+ proven Docker applications
 */
export class CLIBridge {
  constructor() {
    // Path to the main HomelabARR CLI repository
    // Fixed path - we're in homelabarr-cli/.claude/homelabarr-other-git-repositories/homelabarr-main
    // So we need to go up 3 levels to get to homelabarr-cli root
    this.cliPath = path.resolve(process.cwd(), '../../..');
    this.appsPath = path.join(this.cliPath, 'apps');
    this.scriptsPath = path.join(this.cliPath, 'scripts');
    this.traefik = path.join(this.cliPath, 'traefik');
    
    // Verify CLI installation
    this.verifyCLIInstallation();
    
    DeploymentLogger.logNetworkActivity('CLI Bridge initialized', {
      level: 'info',
      cliPath: this.cliPath,
      component: 'CLIBridge'
    });
  }

  /**
   * Verify that the HomelabARR CLI is properly installed
   */
  verifyCLIInstallation() {
    const requiredPaths = [
      this.appsPath,
      this.scriptsPath,
      path.join(this.cliPath, 'install.sh'),
      path.join(this.cliPath, 'traefik', 'install.sh')
    ];

    for (const requiredPath of requiredPaths) {
      if (!fs.existsSync(requiredPath)) {
        throw new Error(`HomelabARR CLI not found at ${requiredPath}. Please ensure CLI is properly installed.`);
      }
    }
  }

  /**
   * Get all available applications from the CLI
   * Scans the apps/ directory for .yml files and categorizes them
   */
  async getAvailableApplications() {
    const applications = {};
    
    try {
      // For now, only scan local-mode-apps which has fixed YAML files
      // TODO: Fix other directories' YAML files
      const categories = ['local-mode-apps'];

      for (const category of categories) {
        const categoryPath = path.join(this.appsPath, category);
        applications[category] = [];

        // Skip install.sh and other non-app files
        if (category === 'install.sh') continue;

        const files = fs.readdirSync(categoryPath)
          .filter(file => file.endsWith('.yml') && file !== 'install.sh');

        for (const file of files) {
          const appPath = path.join(categoryPath, file);
          const appConfig = await this.parseApplicationConfig(appPath, category);
          if (appConfig) {
            applications[category].push(appConfig);
          }
        }
      }

      DeploymentLogger.logNetworkActivity('Application catalog loaded', {
        level: 'info',
        totalApps: Object.values(applications).flat().length,
        categories: Object.keys(applications).length,
        component: 'CLIBridge'
      });

      return applications;
    } catch (error) {
      DeploymentLogger.logDockerOperationFailed('getAvailableApplications', error, {
        suggestion: 'Verify CLI installation and file permissions'
      });
      throw error;
    }
  }

  /**
   * Parse individual application configuration from YAML
   */
  async parseApplicationConfig(filePath, category) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const config = yaml.parse(fileContent);
      
      if (!config.services) {
        return null;
      }

      const serviceName = Object.keys(config.services)[0];
      const service = config.services[serviceName];
      
      const appName = path.basename(filePath, '.yml');
      
      return {
        id: `${category}-${appName}`,
        name: appName,
        displayName: this.formatDisplayName(appName),
        category: category,
        description: this.extractDescription(service),
        image: service.image || 'Unknown',
        ports: this.extractPorts(service),
        environment: this.extractEnvironmentVars(service),
        volumes: this.extractVolumes(service),
        networks: this.extractNetworks(service),
        labels: this.extractLabels(service),
        filePath: filePath,
        healthcheck: service.healthcheck || null,
        restart: service.restart || '${RESTARTAPP}',
        requiresTraefik: this.requiresTraefik(service),
        requiresAuthelia: this.requiresAuthelia(service)
      };
    } catch (error) {
      // Silently skip files with YAML errors instead of logging errors
      // This prevents flooding the console with parse errors
      console.debug(`Skipping ${filePath}: ${error.message.split('\n')[0]}`);
      return null;
    }
  }

  /**
   * Deploy application using CLI infrastructure
   */
  async deployApplication(appId, config, deploymentMode) {
    const [category, appName] = appId.split('-');
    const appPath = path.join(this.appsPath, category, `${appName}.yml`);
    
    if (!fs.existsSync(appPath)) {
      throw new Error(`Application ${appId} not found at ${appPath}`);
    }

    DeploymentLogger.logNetworkActivity('Starting application deployment', {
      level: 'info',
      appId,
      category,
      appName,
      deploymentMode,
      component: 'CLIBridge'
    });

    try {
      // Prepare environment configuration
      await this.prepareEnvironmentConfig(config, deploymentMode);
      
      // Deploy based on mode
      let deploymentResult;
      switch (deploymentMode.type) {
        case 'traefik':
          deploymentResult = await this.deployWithTraefik(appPath, config);
          break;
        case 'standard':
          deploymentResult = await this.deployStandard(appPath, config);
          break;
        case 'authelia':
          deploymentResult = await this.deployWithAuthelia(appPath, config);
          break;
        default:
          throw new Error(`Unknown deployment mode: ${deploymentMode.type}`);
      }

      DeploymentLogger.logNetworkActivity('Application deployed successfully', {
        level: 'info',
        appId,
        deploymentMode: deploymentMode.type,
        result: deploymentResult,
        component: 'CLIBridge'
      });

      return deploymentResult;
    } catch (error) {
      DeploymentLogger.logDockerOperationFailed('deployApplication', error, {
        appId,
        suggestion: 'Check Docker daemon and network connectivity'
      });
      throw error;
    }
  }

  /**
   * Deploy application with Traefik integration
   */
  async deployWithTraefik(appPath, config) {
    // Ensure Traefik is installed and running
    await this.ensureTraefikRunning();
    
    // Deploy using docker-compose with Traefik network
    return await this.executeDockerCompose(appPath, 'up -d', {
      ...config,
      DOCKERNETWORK: 'proxy'
    });
  }

  /**
   * Deploy application in standard mode (without Traefik)
   */
  async deployStandard(appPath, config) {
    return await this.executeDockerCompose(appPath, 'up -d', config);
  }

  /**
   * Deploy application with Authelia authentication
   */
  async deployWithAuthelia(appPath, config) {
    // Ensure both Traefik and Authelia are running
    await this.ensureTraefikRunning();
    await this.ensureAutheliaRunning();
    
    return await this.executeDockerCompose(appPath, 'up -d', {
      ...config,
      DOCKERNETWORK: 'proxy'
    });
  }

  /**
   * Execute docker-compose commands with proper environment
   */
  async executeDockerCompose(appPath, command, envVars = {}) {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ...envVars
      };

      const dockerCompose = spawn('docker-compose', ['-f', appPath, ...command.split(' ')], {
        env,
        cwd: path.dirname(appPath),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      dockerCompose.stdout.on('data', (data) => {
        stdout += data.toString();
        // Stream real-time output for progress tracking
        this.streamProgress(data.toString());
      });

      dockerCompose.stderr.on('data', (data) => {
        stderr += data.toString();
        this.streamProgress(data.toString(), 'error');
      });

      dockerCompose.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          reject(new Error(`Docker Compose failed with exit code ${code}: ${stderr}`));
        }
      });

      dockerCompose.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Ensure Traefik is running
   */
  async ensureTraefikRunning() {
    const traefikPath = path.join(this.traefik, 'docker-compose.yml');
    
    if (!fs.existsSync(traefikPath)) {
      // Install Traefik if not present
      await this.installTraefik();
    }

    // Check if Traefik is running
    try {
      execSync('docker ps | grep traefik', { stdio: 'pipe' });
    } catch (error) {
      // Start Traefik
      await this.executeDockerCompose(traefikPath, 'up -d');
    }
  }

  /**
   * Ensure Authelia is running
   */
  async ensureAutheliaRunning() {
    try {
      execSync('docker ps | grep authelia', { stdio: 'pipe' });
    } catch (error) {
      // Start Authelia if not running
      const autheliaPath = path.join(this.traefik, 'authelia', 'docker-compose.yml');
      if (fs.existsSync(autheliaPath)) {
        await this.executeDockerCompose(autheliaPath, 'up -d');
      }
    }
  }

  /**
   * Install Traefik using CLI installer
   */
  async installTraefik() {
    return new Promise((resolve, reject) => {
      const installer = spawn('bash', [path.join(this.traefik, 'install.sh')], {
        cwd: this.cliPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      installer.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Traefik installation failed with exit code ${code}`));
        }
      });
    });
  }

  /**
   * Stream deployment progress for real-time updates
   */
  streamProgress(data, type = 'info') {
    // This will be connected to WebSocket or Server-Sent Events
    DeploymentLogger.logNetworkActivity('Deployment progress', {
      level: type,
      output: data.trim(),
      component: 'CLIBridge'
    });
  }

  /**
   * Stop application using CLI
   */
  async stopApplication(appId) {
    const [category, appName] = appId.split('-');
    const appPath = path.join(this.appsPath, category, `${appName}.yml`);
    
    return await this.executeDockerCompose(appPath, 'down');
  }

  /**
   * Remove application and cleanup
   */
  async removeApplication(appId, removeVolumes = false) {
    const [category, appName] = appId.split('-');
    const appPath = path.join(this.appsPath, category, `${appName}.yml`);
    
    const command = removeVolumes ? 'down -v' : 'down';
    return await this.executeDockerCompose(appPath, command);
  }

  /**
   * Get application logs
   */
  async getApplicationLogs(appId, lines = 100) {
    const [category, appName] = appId.split('-');
    const appPath = path.join(this.appsPath, category, `${appName}.yml`);
    
    return await this.executeDockerCompose(appPath, `logs --tail=${lines}`);
  }

  // Helper methods for parsing application configurations

  formatDisplayName(name) {
    return name.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  extractDescription(service) {
    // Try to extract description from labels or image name
    if (service.labels) {
      const descLabel = service.labels.find(label => 
        label.includes('description') || label.includes('summary')
      );
      if (descLabel) {
        return descLabel.split('=')[1];
      }
    }
    return `${service.image} container`;
  }

  extractPorts(service) {
    if (!service.ports) return {};
    
    const ports = {};
    service.ports.forEach(port => {
      if (typeof port === 'string' && port.includes(':')) {
        const [hostPort, containerPort] = port.split(':');
        ports[containerPort.replace('/tcp', '')] = parseInt(hostPort);
      }
    });
    return ports;
  }

  extractEnvironmentVars(service) {
    if (!service.environment) return {};
    
    const env = {};
    service.environment.forEach(envVar => {
      if (typeof envVar === 'string' && envVar.includes('=')) {
        const [key, value] = envVar.split('=');
        env[key] = value;
      }
    });
    return env;
  }

  extractVolumes(service) {
    return service.volumes || [];
  }

  extractNetworks(service) {
    return service.networks || [];
  }

  extractLabels(service) {
    return service.labels || [];
  }

  requiresTraefik(service) {
    if (!service.labels) return false;
    return service.labels.some(label => label.includes('traefik.enable=true'));
  }

  requiresAuthelia(service) {
    if (!service.labels) return false;
    return service.labels.some(label => label.includes('authelia') || label.includes('chain-authelia'));
  }

  /**
   * Prepare environment configuration for deployment
   */
  async prepareEnvironmentConfig(config, deploymentMode) {
    // Set default environment variables based on CLI standards
    const defaultEnv = {
      ID: '1000',
      TZ: 'UTC',
      UMASK: '002',
      RESTARTAPP: 'unless-stopped',
      DOCKERNETWORK: deploymentMode.type === 'traefik' ? 'proxy' : 'bridge',
      DOMAIN: config.domain || 'localhost',
      APPFOLDER: '/opt/appdata',
      SECURITYOPS: 'no-new-privileges',
      SECURITYOPSSET: 'true'
    };

    // Merge with user configuration
    Object.assign(process.env, defaultEnv, config);
  }

  /**
   * Get Docker containers using CLI commands (Windows compatible)
   */
  async getDockerContainers() {
    try {
      // Use docker ps command to get container list
      const result = execSync('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}"', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const containers = result.trim().split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [id, names, image, status, ports, createdAt] = line.split('|');
          
          // Parse status to determine state
          const isRunning = status.toLowerCase().includes('up');
          const state = isRunning ? 'running' : 'exited';
          
          // Parse ports
          const portMappings = this.parseDockerPorts(ports);
          
          return {
            Id: id,
            Names: [`/${names}`],
            Image: image,
            State: state,
            Status: status,
            Ports: portMappings,
            Created: new Date(createdAt).toISOString(),
            NetworkSettings: {
              Networks: {
                bridge: { IPAddress: '' }
              }
            },
            Config: {
              Image: image
            }
          };
        });

      DeploymentLogger.logNetworkActivity('Docker containers retrieved via CLI', {
        level: 'info',
        containerCount: containers.length,
        component: 'CLIBridge'
      });

      return containers;
    } catch (error) {
      DeploymentLogger.logDockerOperationFailed('getDockerContainers', error, {
        suggestion: 'Ensure Docker Desktop is running and accessible via CLI'
      });
      
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  }

  /**
   * Parse Docker ports from CLI output
   */
  parseDockerPorts(portsString) {
    if (!portsString || portsString.trim() === '') {
      return [];
    }

    const ports = [];
    // Example: "0.0.0.0:8080->80/tcp, 443/tcp"
    const portMappings = portsString.split(',').map(p => p.trim());
    
    for (const mapping of portMappings) {
      if (mapping.includes('->')) {
        const [publicPart, privatePart] = mapping.split('->');
        const [publicIP, publicPort] = publicPart.split(':');
        
        ports.push({
          IP: publicIP || '0.0.0.0',
          PrivatePort: parseInt(privatePart.replace(/\/\w+$/, '')),
          PublicPort: parseInt(publicPort),
          Type: privatePart.includes('/tcp') ? 'tcp' : 'udp'
        });
      } else if (mapping.includes('/')) {
        // Internal port only
        const [port, type] = mapping.split('/');
        ports.push({
          PrivatePort: parseInt(port),
          Type: type
        });
      }
    }
    
    return ports;
  }

  /**
   * Get Docker container stats using CLI
   */
  async getDockerContainerStats(containerId) {
    try {
      const result = execSync(`docker stats ${containerId} --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const [cpuPerc, memUsage, netIO, blockIO] = result.trim().split('|');
      
      return {
        CPUStats: {
          cpu_usage: { percpu_usage: [parseFloat(cpuPerc.replace('%', ''))] }
        },
        MemoryStats: {
          usage: this.parseMemoryUsage(memUsage)
        },
        Networks: {
          eth0: this.parseNetworkIO(netIO)
        },
        BlkioStats: this.parseBlockIO(blockIO)
      };
    } catch (error) {
      DeploymentLogger.logDockerOperationFailed('getDockerContainerStats', error);
      return null;
    }
  }

  /**
   * Get Docker container logs using CLI
   */
  async getDockerContainerLogs(containerId, tail = 100) {
    try {
      const result = execSync(`docker logs --tail ${tail} --timestamps ${containerId}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      return {
        logs: result
      };
    } catch (error) {
      DeploymentLogger.logDockerOperationFailed('getDockerContainerLogs', error);
      return { logs: '' };
    }
  }

  /**
   * Control Docker containers using CLI
   */
  async controlDockerContainer(containerId, action) {
    try {
      const result = execSync(`docker ${action} ${containerId}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      DeploymentLogger.logNetworkActivity(`Container ${action} completed`, {
        level: 'info',
        containerId,
        action,
        component: 'CLIBridge'
      });

      return { success: true, output: result };
    } catch (error) {
      DeploymentLogger.logDockerOperationFailed(`controlDockerContainer-${action}`, error);
      throw error;
    }
  }

  // Helper methods for parsing Docker CLI output

  parseMemoryUsage(memUsage) {
    // Example: "1.5GiB / 16GiB"
    const [used, total] = memUsage.split(' / ');
    return {
      usage: this.parseMemoryValue(used),
      limit: this.parseMemoryValue(total)
    };
  }

  parseMemoryValue(value) {
    const units = { 'B': 1, 'KiB': 1024, 'MiB': 1024**2, 'GiB': 1024**3 };
    const match = value.match(/^([\d.]+)(\w+)$/);
    if (match) {
      const [, num, unit] = match;
      return parseFloat(num) * (units[unit] || 1);
    }
    return 0;
  }

  parseNetworkIO(netIO) {
    // Example: "1.2kB / 800B"
    const [rx, tx] = netIO.split(' / ');
    return {
      rx_bytes: this.parseMemoryValue(rx.replace('B', 'B')),
      tx_bytes: this.parseMemoryValue(tx.replace('B', 'B'))
    };
  }

  parseBlockIO(blockIO) {
    // Example: "0B / 1.2kB"
    const [read, write] = blockIO.split(' / ');
    return {
      io_service_bytes_recursive: [
        { op: 'Read', value: this.parseMemoryValue(read.replace('B', 'B')) },
        { op: 'Write', value: this.parseMemoryValue(write.replace('B', 'B')) }
      ]
    };
  }
}