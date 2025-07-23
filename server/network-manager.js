import os from 'os';
import fs from 'fs';
import { EnvironmentManager } from './environment-manager.js';

/**
 * Platform-Agnostic Network Configuration Manager
 * Handles Docker socket path resolution, server binding, and service URL resolution
 */
export class NetworkManager {
  static #config = null;
  static #initialized = false;

  /**
   * Reset internal state for testing
   * @private
   */
  static _resetForTesting() {
    this.#config = null;
    this.#initialized = false;
  }

  /**
   * Get the comprehensive network configuration
   * @returns {NetworkConfig} The complete network configuration object
   */
  static getConfiguration() {
    if (!this.#initialized) {
      this.#config = this.#buildConfiguration();
      this.#initialized = true;
    }
    return this.#config;
  }

  /**
   * Build the complete network configuration object
   * @private
   */
  static #buildConfiguration() {
    const envConfig = EnvironmentManager.getConfiguration();
    
    return {
      // Platform and environment context
      platform: envConfig.platform,
      environment: envConfig.environment,
      
      // Docker socket configuration
      dockerSocket: this.resolveDockerSocketPath(envConfig.platform),
      
      // Server binding configuration
      bindAddress: this.getBindAddress(envConfig.environment),
      port: envConfig.port,
      
      // Service URLs for container-to-container communication
      serviceUrls: this.resolveServiceUrls(envConfig.environment),
      
      // Network timeouts
      timeouts: {
        connection: envConfig.timeouts.docker,
        request: envConfig.timeouts.request,
        healthCheck: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
      },
      
      // Network validation settings
      validation: {
        validateDockerSocket: process.env.VALIDATE_DOCKER_SOCKET !== 'false',
        validateServiceUrls: process.env.VALIDATE_SERVICE_URLS !== 'false',
        strictPortValidation: envConfig.environment === 'production'
      }
    };
  }

  /**
   * Resolve Docker socket path based on platform
   * @param {string} platform - The target platform ('windows', 'linux', 'darwin')
   * @returns {string} The appropriate Docker socket path
   */
  static resolveDockerSocketPath(platform) {
    // Check for explicit override first
    if (process.env.DOCKER_SOCKET) {
      return process.env.DOCKER_SOCKET;
    }

    // Platform-specific defaults
    switch (platform) {
      case 'windows':
        return '\\\\.\\pipe\\docker_engine';
      case 'linux':
      case 'darwin':
      default:
        return '/var/run/docker.sock';
    }
  }

  /**
   * Get the appropriate bind address for server binding
   * @param {string} environment - The environment mode ('development', 'production', 'test')
   * @returns {string} The bind address to use
   */
  static getBindAddress(environment) {
    // Check for explicit override first
    if (process.env.BIND_ADDRESS) {
      return process.env.BIND_ADDRESS;
    }

    // Always use 0.0.0.0 for container compatibility
    // This allows external connections to reach the containerized service
    return '0.0.0.0';
  }

  /**
   * Resolve service URLs using environment variables instead of hardcoded values
   * @param {string} environment - The environment mode
   * @returns {Object} Service URL mappings
   */
  static resolveServiceUrls(environment) {
    const config = EnvironmentManager.getConfiguration();
    
    // Base service URLs with environment variable overrides
    const serviceUrls = {
      // Frontend service URL
      frontend: process.env.FRONTEND_URL || 
                process.env.FRONTEND_SERVICE_URL || 
                (environment === 'development' ? 'http://localhost:5173' : 'http://frontend:5173'),
      
      // Backend service URL (this service)
      backend: process.env.BACKEND_URL || 
               process.env.BACKEND_SERVICE_URL || 
               `http://${config.bindAddress}:${config.port}`,
      
      // Docker daemon URL
      docker: process.env.DOCKER_HOST || 
              (config.platform === 'windows' ? 
                'npipe://./pipe/docker_engine' : 
                'unix:///var/run/docker.sock'),
      
      // Database service URL (if applicable)
      database: process.env.DATABASE_URL || 
                process.env.DB_URL || 
                'sqlite://./data/homelabarr.db',
      
      // Redis service URL (if applicable)
      redis: process.env.REDIS_URL || 
             process.env.REDIS_SERVICE_URL || 
             'redis://redis:6379',
      
      // External service URLs
      registry: process.env.DOCKER_REGISTRY_URL || 'https://registry-1.docker.io',
      
      // Health check endpoints
      healthCheck: {
        internal: `http://${config.bindAddress}:${config.port}/health`,
        external: process.env.EXTERNAL_HEALTH_URL || `http://localhost:${config.port}/health`
      }
    };

    // Add container-specific service URLs if running in container
    if (EnvironmentManager.isContainerized()) {
      // In container environments, prefer service names over localhost
      serviceUrls.frontend = process.env.FRONTEND_URL || 'http://frontend:5173';
      serviceUrls.backend = process.env.BACKEND_URL || `http://backend:${config.port}`;
      serviceUrls.database = process.env.DATABASE_URL || 'sqlite:///app/data/homelabarr.db';
    }

    return serviceUrls;
  }

  /**
   * Validate network configuration with detailed error messages
   * @returns {NetworkValidationResult} Validation result with errors and warnings
   */
  static validateNetworkConfiguration() {
    const config = this.getConfiguration();
    const errors = [];
    const warnings = [];

    // Validate Docker socket configuration
    if (config.validation.validateDockerSocket) {
      const dockerValidation = this.#validateDockerSocket(config);
      errors.push(...dockerValidation.errors);
      warnings.push(...dockerValidation.warnings);
    }

    // Validate bind address configuration
    const bindValidation = this.#validateBindAddress(config);
    errors.push(...bindValidation.errors);
    warnings.push(...bindValidation.warnings);

    // Validate port configuration
    const portValidation = this.#validatePortConfiguration(config);
    errors.push(...portValidation.errors);
    warnings.push(...portValidation.warnings);

    // Validate service URLs
    if (config.validation.validateServiceUrls) {
      const urlValidation = this.#validateServiceUrls(config);
      errors.push(...urlValidation.errors);
      warnings.push(...urlValidation.warnings);
    }

    // Validate timeout configuration
    const timeoutValidation = this.#validateTimeouts(config);
    errors.push(...timeoutValidation.errors);
    warnings.push(...timeoutValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      config,
      platform: config.platform,
      environment: config.environment,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate Docker socket configuration
   * @private
   */
  static #validateDockerSocket(config) {
    const errors = [];
    const warnings = [];

    try {
      if (config.platform !== 'windows') {
        // Unix-like systems: check if socket file exists and is accessible
        if (!fs.existsSync(config.dockerSocket)) {
          errors.push(`Docker socket not found at ${config.dockerSocket}. Ensure Docker is installed and running.`);
        } else {
          try {
            const stats = fs.statSync(config.dockerSocket);
            if (!stats.isSocket()) {
              errors.push(`Path ${config.dockerSocket} exists but is not a socket file.`);
            }
          } catch (statError) {
            warnings.push(`Cannot check Docker socket properties: ${statError.message}`);
          }
        }
      } else {
        // Windows: validate named pipe format
        if (!config.dockerSocket.startsWith('\\\\.\\pipe\\')) {
          warnings.push(`Windows Docker socket path should start with '\\\\.\\pipe\\'. Current: ${config.dockerSocket}`);
        }
      }
    } catch (error) {
      warnings.push(`Docker socket validation failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate bind address configuration
   * @private
   */
  static #validateBindAddress(config) {
    const errors = [];
    const warnings = [];

    // Validate bind address format
    const bindAddress = config.bindAddress;
    
    if (!bindAddress) {
      errors.push('Bind address is not configured');
      return { errors, warnings };
    }

    // Check for common bind address patterns
    if (bindAddress === 'localhost' || bindAddress === '127.0.0.1') {
      if (EnvironmentManager.isContainerized()) {
        errors.push(`Bind address '${bindAddress}' will not work in containers. Use '0.0.0.0' for container compatibility.`);
      } else {
        warnings.push(`Bind address '${bindAddress}' only allows local connections. Consider '0.0.0.0' for external access.`);
      }
    }

    // Validate IPv4 format if not using special addresses
    if (bindAddress !== '0.0.0.0' && bindAddress !== 'localhost') {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(bindAddress)) {
        warnings.push(`Bind address '${bindAddress}' does not appear to be a valid IPv4 address.`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate port configuration
   * @private
   */
  static #validatePortConfiguration(config) {
    const errors = [];
    const warnings = [];

    const port = config.port;

    // Validate port range
    if (!port || port < 1 || port > 65535) {
      errors.push(`Port ${port} is not in valid range (1-65535)`);
      return { errors, warnings };
    }

    // Check for privileged ports
    if (port < 1024) {
      if (process.getuid && process.getuid() !== 0) {
        if (EnvironmentManager.isContainerized()) {
          warnings.push(`Port ${port} is privileged but may work in containers with proper configuration`);
        } else {
          errors.push(`Port ${port} requires root privileges on Unix systems`);
        }
      }
    }

    // Check for commonly used ports
    const commonPorts = {
      80: 'HTTP',
      443: 'HTTPS',
      3000: 'Node.js development',
      3001: 'Node.js development',
      5000: 'Flask/Python development',
      8080: 'HTTP alternate',
      8443: 'HTTPS alternate'
    };

    if (commonPorts[port]) {
      warnings.push(`Port ${port} is commonly used for ${commonPorts[port]}. Ensure no conflicts exist.`);
    }

    return { errors, warnings };
  }

  /**
   * Validate service URLs
   * @private
   */
  static #validateServiceUrls(config) {
    const errors = [];
    const warnings = [];

    const serviceUrls = config.serviceUrls;

    // Validate each service URL
    Object.entries(serviceUrls).forEach(([serviceName, url]) => {
      if (typeof url === 'object') {
        // Handle nested URL objects (like healthCheck)
        Object.entries(url).forEach(([subService, subUrl]) => {
          const validation = this.#validateSingleUrl(subUrl, `${serviceName}.${subService}`);
          errors.push(...validation.errors);
          warnings.push(...validation.warnings);
        });
      } else {
        const validation = this.#validateSingleUrl(url, serviceName);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
      }
    });

    return { errors, warnings };
  }

  /**
   * Validate a single URL
   * @private
   */
  static #validateSingleUrl(url, serviceName) {
    const errors = [];
    const warnings = [];

    if (!url) {
      warnings.push(`Service URL for '${serviceName}' is not configured`);
      return { errors, warnings };
    }

    try {
      const parsedUrl = new URL(url);
      
      // Check for localhost in containerized environments
      if (EnvironmentManager.isContainerized() && 
          (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')) {
        warnings.push(`Service '${serviceName}' uses localhost (${url}) which may not work in containers`);
      }

      // Validate protocol
      if (!['http:', 'https:', 'unix:', 'npipe:', 'sqlite:', 'redis:'].includes(parsedUrl.protocol)) {
        warnings.push(`Service '${serviceName}' uses uncommon protocol: ${parsedUrl.protocol}`);
      }

    } catch (urlError) {
      // Handle special cases like Unix sockets and SQLite paths
      if (url.startsWith('unix://') || url.startsWith('sqlite://') || url.startsWith('npipe://')) {
        // These are valid but don't parse as standard URLs
        return { errors, warnings };
      }
      
      errors.push(`Service '${serviceName}' has invalid URL format: ${url} (${urlError.message})`);
    }

    return { errors, warnings };
  }

  /**
   * Validate timeout configuration
   * @private
   */
  static #validateTimeouts(config) {
    const errors = [];
    const warnings = [];

    const timeouts = config.timeouts;

    Object.entries(timeouts).forEach(([timeoutName, timeout]) => {
      if (typeof timeout !== 'number' || timeout <= 0) {
        errors.push(`Timeout '${timeoutName}' must be a positive number, got: ${timeout}`);
      } else if (timeout < 1000) {
        warnings.push(`Timeout '${timeoutName}' is very short (${timeout}ms), may cause connection issues`);
      } else if (timeout > 300000) { // 5 minutes
        warnings.push(`Timeout '${timeoutName}' is very long (${timeout}ms), may cause poor user experience`);
      }
    });

    return { errors, warnings };
  }

  /**
   * Get platform-specific Docker connection options
   * @returns {Object} Docker connection configuration
   */
  static getDockerConnectionOptions() {
    const config = this.getConfiguration();
    
    const connectionOptions = {
      socketPath: config.dockerSocket,
      timeout: config.timeouts.connection
    };

    // Add platform-specific options
    if (config.platform === 'windows') {
      connectionOptions.protocol = 'npipe';
    } else {
      connectionOptions.protocol = 'unix';
    }

    return connectionOptions;
  }

  /**
   * Get service URL for a specific service
   * @param {string} serviceName - Name of the service
   * @returns {string|null} The service URL or null if not found
   */
  static getServiceUrl(serviceName) {
    const config = this.getConfiguration();
    return config.serviceUrls[serviceName] || null;
  }

  /**
   * Log comprehensive network configuration information
   */
  static logNetworkInfo() {
    const config = this.getConfiguration();
    const validation = this.validateNetworkConfiguration();
    
    console.log('🌐 Network Configuration Manager');
    console.log('================================');
    
    // Platform and environment
    console.log(`📋 Platform: ${config.platform}`);
    console.log(`🌍 Environment: ${config.environment}`);
    console.log(`🏠 Containerized: ${EnvironmentManager.isContainerized() ? 'yes' : 'no'}`);
    
    // Server binding
    console.log(`🔗 Server Binding: ${config.bindAddress}:${config.port}`);
    
    // Docker configuration
    console.log(`🐳 Docker Socket: ${config.dockerSocket}`);
    console.log(`⏱️  Docker Timeout: ${config.timeouts.connection}ms`);
    
    // Service URLs
    console.log('🔗 Service URLs:');
    Object.entries(config.serviceUrls).forEach(([service, url]) => {
      if (typeof url === 'object') {
        Object.entries(url).forEach(([subService, subUrl]) => {
          console.log(`   ${service}.${subService}: ${subUrl}`);
        });
      } else {
        console.log(`   ${service}: ${url}`);
      }
    });
    
    // Validation results
    if (validation.warnings.length > 0) {
      console.log('⚠️  Network Configuration Warnings:');
      validation.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    if (validation.errors.length > 0) {
      console.log('❌ Network Configuration Errors:');
      validation.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (validation.isValid) {
      console.log('✅ Network configuration validation passed');
    } else {
      console.log('❌ Network configuration validation failed - see errors above');
    }
    
    console.log('================================');
  }

  /**
   * Create network error response with troubleshooting information
   * @param {string} operation - The operation that failed
   * @param {Error} error - The error that occurred
   * @param {boolean} includeConfig - Whether to include configuration details
   * @returns {Object} Formatted error response
   */
  static createNetworkErrorResponse(operation, error, includeConfig = false) {
    const config = this.getConfiguration();
    
    const errorResponse = {
      error: `Network operation failed: ${operation}`,
      details: error.message,
      platform: config.platform,
      environment: config.environment,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        possibleCauses: [],
        suggestedActions: [],
        documentationLinks: []
      }
    };

    // Add operation-specific troubleshooting
    if (operation.toLowerCase().includes('docker')) {
      errorResponse.troubleshooting.possibleCauses = [
        'Docker daemon not running',
        'Docker socket not accessible',
        'Network connectivity issues',
        'Container networking misconfiguration'
      ];
      errorResponse.troubleshooting.suggestedActions = [
        'Check Docker daemon status',
        'Verify Docker socket permissions',
        'Check container network configuration',
        'Review Docker Compose networking setup'
      ];
    } else if (operation.toLowerCase().includes('bind') || operation.toLowerCase().includes('port')) {
      errorResponse.troubleshooting.possibleCauses = [
        'Port already in use',
        'Insufficient privileges for port binding',
        'Network interface not available',
        'Firewall blocking connections'
      ];
      errorResponse.troubleshooting.suggestedActions = [
        'Check for port conflicts',
        'Verify user permissions',
        'Check network interface configuration',
        'Review firewall settings'
      ];
    }

    // Include configuration details if requested
    if (includeConfig) {
      errorResponse.networkConfig = {
        bindAddress: config.bindAddress,
        port: config.port,
        dockerSocket: config.dockerSocket,
        platform: config.platform,
        isContainerized: EnvironmentManager.isContainerized()
      };
    }

    return errorResponse;
  }
}

// Type definitions for better IDE support
/**
 * @typedef {Object} NetworkConfig
 * @property {string} platform - Detected platform
 * @property {string} environment - Environment mode
 * @property {string} dockerSocket - Docker socket path
 * @property {string} bindAddress - Server bind address
 * @property {number} port - Server port
 * @property {Object} serviceUrls - Service URL mappings
 * @property {Object} timeouts - Network timeout configurations
 * @property {Object} validation - Validation settings
 */

/**
 * @typedef {Object} NetworkValidationResult
 * @property {boolean} isValid - Whether network configuration is valid
 * @property {string[]} errors - Network configuration errors
 * @property {string[]} warnings - Network configuration warnings
 * @property {NetworkConfig} config - The validated network configuration
 * @property {string} platform - Platform information
 * @property {string} environment - Environment information
 * @property {string} timestamp - Validation timestamp
 */