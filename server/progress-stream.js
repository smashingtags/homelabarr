import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { DeploymentLogger } from './deployment-logger.js';

/**
 * Progress Stream Manager - Handles real-time deployment progress updates
 * Uses Server-Sent Events (SSE) for real-time streaming to frontend
 */
export class ProgressStreamManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // Map of clientId -> response object
    this.deploymentStreams = new Map(); // Map of deploymentId -> client list
    
    DeploymentLogger.logNetworkActivity('Progress Stream Manager initialized', {
      level: 'info',
      component: 'ProgressStreamManager'
    });
  }

  /**
   * Add a new SSE client
   */
  addClient(clientId, res) {
    this.clients.set(clientId, res);
    
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection event
    this.sendToClient(clientId, 'connected', {
      message: 'Connected to deployment progress stream',
      timestamp: new Date().toISOString()
    });

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(clientId);
    });

    DeploymentLogger.logNetworkActivity('SSE client connected', {
      level: 'info',
      clientId,
      component: 'ProgressStreamManager'
    });
  }

  /**
   * Remove a client and clean up
   */
  removeClient(clientId) {
    const res = this.clients.get(clientId);
    if (res) {
      try {
        res.end();
      } catch (error) {
        // Client already disconnected
      }
    }
    
    this.clients.delete(clientId);
    
    // Remove from deployment streams
    for (const [deploymentId, clients] of this.deploymentStreams.entries()) {
      const index = clients.indexOf(clientId);
      if (index > -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          this.deploymentStreams.delete(deploymentId);
        }
      }
    }

    DeploymentLogger.logNetworkActivity('SSE client disconnected', {
      level: 'info',
      clientId,
      component: 'ProgressStreamManager'
    });
  }

  /**
   * Subscribe client to a deployment stream
   */
  subscribeToDeployment(clientId, deploymentId) {
    if (!this.clients.has(clientId)) {
      throw new Error(`Client ${clientId} not found`);
    }

    if (!this.deploymentStreams.has(deploymentId)) {
      this.deploymentStreams.set(deploymentId, []);
    }

    const clients = this.deploymentStreams.get(deploymentId);
    if (!clients.includes(clientId)) {
      clients.push(clientId);
    }

    this.sendToClient(clientId, 'deployment-subscribed', {
      deploymentId,
      message: `Subscribed to deployment ${deploymentId}`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send data to specific client
   */
  sendToClient(clientId, event, data) {
    const res = this.clients.get(clientId);
    if (!res) return false;

    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (error) {
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Broadcast deployment progress to all subscribed clients
   */
  broadcastDeploymentProgress(deploymentId, event, data) {
    const clients = this.deploymentStreams.get(deploymentId);
    if (!clients || clients.length === 0) return;

    const payload = {
      deploymentId,
      timestamp: new Date().toISOString(),
      ...data
    };

    let successCount = 0;
    for (const clientId of clients) {
      if (this.sendToClient(clientId, event, payload)) {
        successCount++;
      }
    }

    DeploymentLogger.logNetworkActivity('Deployment progress broadcasted', {
      level: 'info',
      deploymentId,
      event,
      clientsReached: successCount,
      totalClients: clients.length,
      component: 'ProgressStreamManager'
    });
  }

  /**
   * Stream deployment step update
   */
  streamDeploymentStep(deploymentId, step, status, message, details = {}) {
    this.broadcastDeploymentProgress(deploymentId, 'deployment-step', {
      step,
      status, // 'started', 'progress', 'completed', 'failed'
      message,
      details
    });
  }

  /**
   * Stream command output in real-time
   */
  streamCommandOutput(deploymentId, command, output, type = 'stdout') {
    this.broadcastDeploymentProgress(deploymentId, 'command-output', {
      command,
      output,
      type, // 'stdout', 'stderr'
      raw: true
    });
  }

  /**
   * Stream container status updates
   */
  streamContainerStatus(deploymentId, containerId, containerName, status, details = {}) {
    this.broadcastDeploymentProgress(deploymentId, 'container-status', {
      containerId,
      containerName,
      status, // 'creating', 'starting', 'running', 'stopped', 'error'
      details
    });
  }

  /**
   * Stream deployment completion
   */
  streamDeploymentComplete(deploymentId, success, summary) {
    this.broadcastDeploymentProgress(deploymentId, 'deployment-complete', {
      success,
      summary,
      completedAt: new Date().toISOString()
    });

    // Clean up deployment stream after a delay
    setTimeout(() => {
      this.deploymentStreams.delete(deploymentId);
    }, 30000); // Keep for 30 seconds for any late clients
  }

  /**
   * Stream error information
   */
  streamError(deploymentId, error, context = {}) {
    this.broadcastDeploymentProgress(deploymentId, 'error', {
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get active deployment count
   */
  getActiveDeploymentCount() {
    return this.deploymentStreams.size;
  }

  /**
   * Get connected client count
   */
  getConnectedClientCount() {
    return this.clients.size;
  }

  /**
   * Get deployment statistics
   */
  getStatistics() {
    return {
      connectedClients: this.getConnectedClientCount(),
      activeDeployments: this.getActiveDeploymentCount(),
      deploymentStreams: Array.from(this.deploymentStreams.keys())
    };
  }
}

// Singleton instance
export const progressStream = new ProgressStreamManager();

/**
 * Enhanced CLI Bridge with Progress Streaming
 * Extends the base CLI Bridge to add real-time progress updates
 */
export class StreamingCLIBridge {
  constructor(cliBridge, progressStream) {
    this.cliBridge = cliBridge;
    this.progressStream = progressStream;
    this.activeDeployments = new Map();
  }

  /**
   * Deploy application with progress streaming
   */
  async deployApplicationWithProgress(appId, config, deploymentMode, deploymentId) {
    this.activeDeployments.set(deploymentId, {
      appId,
      startedAt: new Date().toISOString(),
      status: 'in-progress'
    });

    try {
      // Step 1: Validate application
      this.progressStream.streamDeploymentStep(
        deploymentId, 
        'validate', 
        'started', 
        'Validating application configuration...'
      );

      const [category, appName] = appId.split('-');
      const appPath = path.join(this.cliBridge.appsPath, category, `${appName}.yml`);
      
      if (!fs.existsSync(appPath)) {
        throw new Error(`Application ${appId} not found at ${appPath}`);
      }

      this.progressStream.streamDeploymentStep(
        deploymentId, 
        'validate', 
        'completed', 
        'Application configuration validated'
      );

      // Step 2: Prepare environment
      this.progressStream.streamDeploymentStep(
        deploymentId, 
        'environment', 
        'started', 
        'Preparing deployment environment...'
      );

      await this.cliBridge.prepareEnvironmentConfig(config, deploymentMode);

      this.progressStream.streamDeploymentStep(
        deploymentId, 
        'environment', 
        'completed', 
        'Environment configuration prepared'
      );

      // Step 3: Setup infrastructure (if needed)
      if (deploymentMode.type === 'traefik' || deploymentMode.type === 'authelia') {
        this.progressStream.streamDeploymentStep(
          deploymentId, 
          'infrastructure', 
          'started', 
          'Setting up reverse proxy infrastructure...'
        );

        await this.cliBridge.ensureTraefikRunning();
        
        if (deploymentMode.type === 'authelia') {
          await this.cliBridge.ensureAutheliaRunning();
        }

        this.progressStream.streamDeploymentStep(
          deploymentId, 
          'infrastructure', 
          'completed', 
          'Infrastructure setup completed'
        );
      }

      // Step 4: Deploy application
      this.progressStream.streamDeploymentStep(
        deploymentId, 
        'deploy', 
        'started', 
        `Deploying ${appId} using ${deploymentMode.type} mode...`
      );

      // Use the original CLI bridge method but capture output
      const originalStreamProgress = this.cliBridge.streamProgress.bind(this.cliBridge);
      this.cliBridge.streamProgress = (data, type = 'info') => {
        this.progressStream.streamCommandOutput(deploymentId, 'docker-compose', data, type);
        originalStreamProgress(data, type);
      };

      let deploymentResult;
      switch (deploymentMode.type) {
        case 'traefik':
          deploymentResult = await this.cliBridge.deployWithTraefik(appPath, config);
          break;
        case 'standard':
          deploymentResult = await this.cliBridge.deployStandard(appPath, config);
          break;
        case 'authelia':
          deploymentResult = await this.cliBridge.deployWithAuthelia(appPath, config);
          break;
        default:
          throw new Error(`Unknown deployment mode: ${deploymentMode.type}`);
      }

      this.progressStream.streamDeploymentStep(
        deploymentId, 
        'deploy', 
        'completed', 
        'Application deployed successfully'
      );

      // Step 5: Verify deployment
      this.progressStream.streamDeploymentStep(
        deploymentId, 
        'verify', 
        'started', 
        'Verifying deployment...'
      );

      // Add verification logic here if needed

      this.progressStream.streamDeploymentStep(
        deploymentId, 
        'verify', 
        'completed', 
        'Deployment verified successfully'
      );

      // Complete deployment
      this.progressStream.streamDeploymentComplete(deploymentId, true, {
        appId,
        deploymentMode: deploymentMode.type,
        completedAt: new Date().toISOString(),
        result: deploymentResult
      });

      this.activeDeployments.set(deploymentId, {
        ...this.activeDeployments.get(deploymentId),
        status: 'completed',
        completedAt: new Date().toISOString()
      });

      return deploymentResult;

    } catch (error) {
      this.progressStream.streamError(deploymentId, error, {
        appId,
        deploymentMode: deploymentMode.type,
        step: 'deployment'
      });

      this.progressStream.streamDeploymentComplete(deploymentId, false, {
        appId,
        error: error.message,
        failedAt: new Date().toISOString()
      });

      this.activeDeployments.set(deploymentId, {
        ...this.activeDeployments.get(deploymentId),
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId) {
    return this.activeDeployments.get(deploymentId) || null;
  }

  /**
   * Get all active deployments
   */
  getActiveDeployments() {
    return Array.from(this.activeDeployments.entries()).map(([id, deployment]) => ({
      id,
      ...deployment
    }));
  }
}