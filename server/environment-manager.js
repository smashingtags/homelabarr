import os from 'os';
import fs from 'fs';
import path from 'path';

/**
 * Environment Detection and Configuration Manager
 * Handles platform detection, environment mode detection, and configuration validation
 */
export class EnvironmentManager {
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
   * Detect the current platform
   * @returns {'windows' | 'linux' | 'darwin'} The detected platform
   */
  static detectPlatform() {
    const platform = process.platform;
    switch (platform) {
      case 'win32':
        return 'windows';
      case 'linux':
        return 'linux';
      case 'darwin':
        return 'darwin';
      default:
        console.warn(`⚠️  Unknown platform: ${platform}, defaulting to linux`);
        return 'linux';
    }
  }

  /**
   * Detect the current environment mode
   * @returns {'development' | 'production' | 'test'} The detected environment
   */
  static detectEnvironment() {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    
    switch (nodeEnv) {
      case 'production':
      case 'prod':
        return 'production';
      case 'test':
      case 'testing':
        return 'test';
      case 'development':
      case 'dev':
      default:
        return 'development';
    }
  }

  /**
   * Get the comprehensive environment configuration
   * @returns {EnvironmentConfig} The complete configuration object
   */
  static getConfiguration() {
    if (!this.#initialized) {
      this.#config = this.#buildConfiguration();
      this.#initialized = true;
    }
    return this.#config;
  }

  /**
   * Build the complete configuration object
   * @private
   */
  static #buildConfiguration() {
    const platform = this.detectPlatform();
    const environment = this.detectEnvironment();
    
    return {
      // Platform and environment detection
      platform,
      environment,
      nodeEnv: process.env.NODE_ENV || 'development',
      
      // Server configuration
      port: parseInt(process.env.PORT) || 3001,
      bindAddress: this.#getBindAddress(environment),
      
      // CORS configuration
      corsOrigin: this.#getCorsOrigin(environment),
      
      // Docker configuration
      dockerSocket: this.#getDockerSocketPath(platform),
      dockerGid: process.env.DOCKER_GID || (platform === 'linux' ? '999' : null),
      
      // Authentication configuration
      authEnabled: process.env.AUTH_ENABLED !== 'false',
      jwtSecret: process.env.JWT_SECRET || 'homelabarr-default-secret-change-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      
      // Logging configuration
      logLevel: process.env.LOG_LEVEL || (environment === 'development' ? 'debug' : 'info'),
      
      // Service URLs (for container-to-container communication)
      serviceUrls: this.#getServiceUrls(),
      
      // Timeouts and limits
      timeouts: {
        docker: parseInt(process.env.DOCKER_TIMEOUT) || 30000,
        request: parseInt(process.env.REQUEST_TIMEOUT) || 10000,
      },
      
      // Feature flags
      features: {
        healthCheck: process.env.HEALTH_CHECK_ENABLED !== 'false',
        metrics: process.env.METRICS_ENABLED === 'true',
        detailedLogging: environment === 'development' || process.env.DETAILED_LOGGING === 'true'
      }
    };
  }

  /**
   * Get the appropriate bind address based on environment
   * @private
   */
  static #getBindAddress(environment) {
    // In containers, always bind to 0.0.0.0 to allow external connections
    // In development, can use localhost unless explicitly overridden
    if (process.env.BIND_ADDRESS) {
      return process.env.BIND_ADDRESS;
    }
    
    // Check if running in a container (common indicators)
    const isContainer = process.env.DOCKER_CONTAINER === 'true' || 
                       fs.existsSync('/.dockerenv') ||
                       process.env.KUBERNETES_SERVICE_HOST;
    
    return isContainer ? '0.0.0.0' : '0.0.0.0'; // Always use 0.0.0.0 for better compatibility
  }

  /**
   * Get CORS origin configuration based on environment
   * @private
   */
  static #getCorsOrigin(environment) {
    if (process.env.CORS_ORIGIN) {
      // If explicitly set, use the configured value
      const origins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
      return origins.length === 1 && origins[0] === '*' ? '*' : origins;
    }
    
    if (environment === 'development') {
      // In development, use wildcard for maximum compatibility
      return '*';
    }
    
    // Production should have explicit origins configured
    return [];
  }

  /**
   * Get Docker socket path based on platform
   * @private
   */
  static #getDockerSocketPath(platform) {
    if (process.env.DOCKER_SOCKET) {
      return process.env.DOCKER_SOCKET;
    }
    
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
   * Get service URLs for container-to-container communication
   * @private
   */
  static #getServiceUrls() {
    return {
      frontend: process.env.FRONTEND_URL || 'http://localhost:5173',
      backend: process.env.BACKEND_URL || 'http://localhost:3001',
      docker: process.env.DOCKER_HOST || 'unix:///var/run/docker.sock'
    };
  }

  /**
   * Validate the current configuration
   * @returns {ConfigValidationResult} Validation result with any errors or warnings
   */
  static validateConfiguration() {
    const config = this.getConfiguration();
    const errors = [];
    const warnings = [];

    // Validate required environment variables
    if (config.environment === 'production') {
      if (config.jwtSecret === 'homelabarr-default-secret-change-in-production') {
        errors.push('JWT_SECRET must be set to a secure value in production');
      }
      
      if (!config.corsOrigin || config.corsOrigin.length === 0) {
        errors.push('CORS_ORIGIN must be configured in production');
      }
    }

    // Validate Docker configuration
    if (config.platform === 'linux' && !config.dockerGid) {
      warnings.push('DOCKER_GID not set - may cause permission issues with Docker socket');
    }

    // Validate port configuration
    if (config.port < 1024 && process.getuid && process.getuid() !== 0) {
      warnings.push(`Port ${config.port} requires root privileges on Unix systems`);
    }

    // Validate Docker socket accessibility
    try {
      if (config.platform !== 'windows' && !fs.existsSync(config.dockerSocket)) {
        warnings.push(`Docker socket not found at ${config.dockerSocket}`);
      }
    } catch (error) {
      warnings.push(`Cannot check Docker socket accessibility: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      config
    };
  }

  /**
   * Log comprehensive environment information at startup
   */
  static logEnvironmentInfo() {
    const config = this.getConfiguration();
    const validation = this.validateConfiguration();
    
    console.log('🚀 Environment Detection and Configuration');
    console.log('==========================================');
    
    // Platform and environment info
    console.log(`📋 Platform: ${config.platform} (${process.platform})`);
    console.log(`🌍 Environment: ${config.environment} (NODE_ENV: ${config.nodeEnv})`);
    console.log(`🏠 Node.js: ${process.version} on ${os.arch()}`);
    console.log(`💾 Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB total, ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB free`);
    
    // Server configuration
    console.log(`🌐 Server: ${config.bindAddress}:${config.port}`);
    console.log(`🔐 Authentication: ${config.authEnabled ? 'enabled' : 'disabled'}`);
    console.log(`📝 Log Level: ${config.logLevel}`);
    
    // CORS configuration
    if (Array.isArray(config.corsOrigin)) {
      console.log(`🔗 CORS Origins: ${config.corsOrigin.join(', ')}`);
    } else {
      console.log(`🔗 CORS Origins: ${config.corsOrigin}`);
    }
    
    if (config.environment === 'development') {
      console.log(`🔗 CORS Mode: Development (wildcard origins, comprehensive headers, request logging enabled)`);
    } else {
      console.log(`🔗 CORS Mode: Production (strict origin validation, limited headers)`);
    }
    
    // Docker configuration
    console.log(`🐳 Docker Socket: ${config.dockerSocket}`);
    if (config.dockerGid) {
      console.log(`👥 Docker GID: ${config.dockerGid}`);
    }
    
    // Feature flags
    const enabledFeatures = Object.entries(config.features)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature);
    if (enabledFeatures.length > 0) {
      console.log(`⚡ Features: ${enabledFeatures.join(', ')}`);
    }
    
    // Validation results
    if (validation.warnings.length > 0) {
      console.log('⚠️  Configuration Warnings:');
      validation.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    if (validation.errors.length > 0) {
      console.log('❌ Configuration Errors:');
      validation.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (validation.isValid) {
      console.log('✅ Configuration validation passed');
    } else {
      console.log('❌ Configuration validation failed - see errors above');
    }
    
    console.log('==========================================');
  }

  /**
   * Get platform-specific Docker socket configuration
   * @returns {Object} Docker socket configuration
   */
  static getDockerConfig() {
    const config = this.getConfiguration();
    
    const dockerConfig = {
      socketPath: config.dockerSocket,
      timeout: config.timeouts.docker
    };

    // Add platform-specific options
    if (config.platform === 'windows') {
      // Windows-specific Docker configuration
      dockerConfig.protocol = 'npipe';
    } else {
      // Unix-like systems
      dockerConfig.protocol = 'unix';
      if (config.dockerGid) {
        dockerConfig.gid = config.dockerGid;
      }
    }

    return dockerConfig;
  }

  /**
   * Check if running in a containerized environment
   * @returns {boolean} True if running in a container
   */
  static isContainerized() {
    return process.env.DOCKER_CONTAINER === 'true' || 
           fs.existsSync('/.dockerenv') ||
           !!process.env.KUBERNETES_SERVICE_HOST;
  }

  /**
   * Get environment-specific CORS options
   * @returns {Object} CORS configuration object
   */
  static getCorsOptions() {
    const config = this.getConfiguration();
    
    const corsOptions = {
      credentials: true,
      optionsSuccessStatus: 200,
      preflightContinue: false
    };

    if (config.environment === 'development') {
      // Development mode: wildcard CORS for maximum compatibility
      corsOptions.origin = '*';
      corsOptions.methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'];
      corsOptions.allowedHeaders = [
        'Content-Type', 
        'Authorization', 
        'Accept', 
        'Origin', 
        'X-Requested-With',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Methods',
        'Cache-Control',
        'Pragma',
        'Expires',
        'Last-Modified',
        'If-Modified-Since',
        'If-None-Match',
        'ETag'
      ];
      corsOptions.exposedHeaders = [
        'Content-Length',
        'Content-Type',
        'ETag',
        'Last-Modified',
        'Cache-Control'
      ];
      
      // Note: credentials must be false when origin is '*'
      corsOptions.credentials = false;
    } else {
      // Production mode: strict CORS
      corsOptions.origin = function(origin, callback) {
        if (!origin) return callback(null, true);
        
        const allowedOrigins = Array.isArray(config.corsOrigin) ? config.corsOrigin : [config.corsOrigin];
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      };
      corsOptions.methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
      corsOptions.allowedHeaders = ['Content-Type', 'Authorization', 'Accept'];
    }

    return corsOptions;
  }

  /**
   * Create CORS logging middleware for development debugging
   * @returns {Function} Express middleware function
   */
  static createCorsLoggingMiddleware() {
    const config = this.getConfiguration();
    
    // Only enable CORS logging in development mode
    if (config.environment !== 'development') {
      return (req, res, next) => next();
    }

    return (req, res, next) => {
      const timestamp = new Date().toISOString();
      const origin = req.headers.origin || 'no-origin';
      const method = req.method;
      const url = req.url;
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Log CORS request details
      console.log(`🔗 [CORS] ${timestamp} - ${method} ${url}`);
      console.log(`   Origin: ${origin}`);
      console.log(`   User-Agent: ${userAgent}`);
      
      // Log all CORS-related headers
      const corsHeaders = {};
      Object.keys(req.headers).forEach(header => {
        if (header.toLowerCase().includes('cors') || 
            header.toLowerCase().includes('origin') ||
            header.toLowerCase().includes('access-control')) {
          corsHeaders[header] = req.headers[header];
        }
      });
      
      if (Object.keys(corsHeaders).length > 0) {
        console.log(`   CORS Headers:`, corsHeaders);
      }

      // Special handling for preflight OPTIONS requests
      if (method === 'OPTIONS') {
        const requestedMethod = req.headers['access-control-request-method'];
        const requestedHeaders = req.headers['access-control-request-headers'];
        
        console.log(`   🚁 [PREFLIGHT] Requested Method: ${requestedMethod || 'none'}`);
        console.log(`   🚁 [PREFLIGHT] Requested Headers: ${requestedHeaders || 'none'}`);
      }

      // Log response CORS headers after response is sent
      const originalSend = res.send;
      res.send = function(data) {
        const responseHeaders = {};
        Object.keys(res.getHeaders()).forEach(header => {
          if (header.toLowerCase().includes('cors') || 
              header.toLowerCase().includes('origin') ||
              header.toLowerCase().includes('access-control')) {
            responseHeaders[header] = res.getHeader(header);
          }
        });
        
        if (Object.keys(responseHeaders).length > 0) {
          console.log(`   📤 [CORS Response] Status: ${res.statusCode}`);
          console.log(`   📤 [CORS Response] Headers:`, responseHeaders);
        }
        
        if (method === 'OPTIONS') {
          console.log(`   ✅ [PREFLIGHT] Completed with status ${res.statusCode}`);
        }
        
        return originalSend.call(this, data);
      };

      next();
    };
  }
}

// Type definitions for better IDE support
/**
 * @typedef {Object} EnvironmentConfig
 * @property {'windows' | 'linux' | 'darwin'} platform - Detected platform
 * @property {'development' | 'production' | 'test'} environment - Environment mode
 * @property {string} nodeEnv - NODE_ENV value
 * @property {number} port - Server port
 * @property {string} bindAddress - Server bind address
 * @property {string|string[]} corsOrigin - CORS origin configuration
 * @property {string} dockerSocket - Docker socket path
 * @property {string|number|null} dockerGid - Docker group ID
 * @property {boolean} authEnabled - Authentication enabled flag
 * @property {string} jwtSecret - JWT secret key
 * @property {string} jwtExpiresIn - JWT expiration time
 * @property {string} logLevel - Logging level
 * @property {Object} serviceUrls - Service URL mappings
 * @property {Object} timeouts - Timeout configurations
 * @property {Object} features - Feature flags
 */

/**
 * @typedef {Object} ConfigValidationResult
 * @property {boolean} isValid - Whether configuration is valid
 * @property {string[]} errors - Configuration errors
 * @property {string[]} warnings - Configuration warnings
 * @property {EnvironmentConfig} config - The validated configuration
 */