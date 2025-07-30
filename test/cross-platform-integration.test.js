import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentManager } from '../server/environment-manager.js';
import { NetworkManager } from '../server/network-manager.js';
import { DeploymentLogger } from '../server/deployment-logger.js';

// Mock dependencies
vi.mock('fs');
vi.mock('os');

describe('Cross-Platform Integration Tests', () => {
  let originalEnv;
  let originalPlatform;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    originalPlatform = process.platform;
    
    // Reset all managers
    EnvironmentManager._resetForTesting?.();
    NetworkManager._resetForTesting?.();
    DeploymentLogger._resetForTesting?.();
    
    // Clear all mocks
    vi.clearAllMocks();

    // Mock process.getuid for Windows compatibility
    if (!process.getuid) {
      process.getuid = vi.fn().mockReturnValue(1000);
    } else {
      vi.spyOn(process, 'getuid').mockReturnValue(1000);
    }
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });

    // Clean up getuid mock
    if (process.getuid && process.getuid.mockRestore) {
      process.getuid.mockRestore();
    }
  });

  describe('Platform Detection Integration', () => {
    it('should detect Windows platform and configure accordingly', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const platform = EnvironmentManager.detectPlatform();
      const dockerSocket = NetworkManager.resolveDockerSocketPath(platform);
      const dockerConfig = EnvironmentManager.getDockerConfig();

      expect(platform).toBe('windows');
      expect(dockerSocket).toBe('\\\\.\\pipe\\docker_engine');
      expect(dockerConfig.protocol).toBe('npipe');
    });

    it('should detect Linux platform and configure accordingly', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const platform = EnvironmentManager.detectPlatform();
      const dockerSocket = NetworkManager.resolveDockerSocketPath(platform);
      const dockerConfig = EnvironmentManager.getDockerConfig();

      expect(platform).toBe('linux');
      expect(dockerSocket).toBe('/var/run/docker.sock');
      expect(dockerConfig.protocol).toBe('unix');
    });
  });

  describe('Environment Configuration Integration', () => {
    it('should configure development environment with wildcard CORS', () => {
      process.env.NODE_ENV = 'development';

      const environment = EnvironmentManager.detectEnvironment();
      const corsOptions = EnvironmentManager.getCorsOptions();
      const bindAddress = NetworkManager.getBindAddress(environment);

      expect(environment).toBe('development');
      expect(corsOptions.origin).toBe('*');
      expect(corsOptions.credentials).toBe(false);
      expect(bindAddress).toBe('0.0.0.0');
    });

    it('should configure production environment with strict CORS', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://example.com';

      const environment = EnvironmentManager.detectEnvironment();
      const config = EnvironmentManager.getConfiguration();
      const bindAddress = NetworkManager.getBindAddress(environment);

      expect(environment).toBe('production');
      expect(config.corsOrigin).toEqual(['https://example.com']);
      expect(bindAddress).toBe('0.0.0.0');
    });
  });

  describe('Network Configuration Integration', () => {
    it('should resolve service URLs for development environment', () => {
      const serviceUrls = NetworkManager.resolveServiceUrls('development');

      expect(serviceUrls).toHaveProperty('frontend');
      expect(serviceUrls).toHaveProperty('backend');
      expect(serviceUrls).toHaveProperty('docker');
      expect(serviceUrls.frontend).toContain('localhost');
    });

    it('should handle environment variable overrides', () => {
      process.env.FRONTEND_URL = 'http://custom-frontend:8080';
      process.env.DOCKER_HOST = 'tcp://custom-docker:2376';

      const serviceUrls = NetworkManager.resolveServiceUrls('development');

      expect(serviceUrls.frontend).toBe('http://custom-frontend:8080');
      expect(serviceUrls.docker).toBe('tcp://custom-docker:2376');
    });
  });

  describe('Logging Integration', () => {
    it('should initialize deployment logger with environment context', () => {
      process.env.NODE_ENV = 'development';
      
      expect(() => DeploymentLogger.initialize()).not.toThrow();
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      DeploymentLogger.logStartupInfo();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log network activity with platform context', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      DeploymentLogger.logNetworkActivity('test operation', {
        platform: 'linux',
        success: true
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network operation: test operation'));
      consoleSpy.mockRestore();
    });

    it('should log Docker state changes with context', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      DeploymentLogger.logDockerStateChange('disconnected', 'connected', {
        platform: 'linux',
        socketPath: '/var/run/docker.sock'
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Docker connection state changed'));
      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should validate complete environment configuration', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3001';
      process.env.CORS_ORIGIN = '*';

      const envValidation = EnvironmentManager.validateConfiguration();
      const networkValidation = NetworkManager.validateNetworkConfiguration();

      expect(envValidation).toHaveProperty('isValid');
      expect(envValidation).toHaveProperty('errors');
      expect(envValidation).toHaveProperty('warnings');
      
      expect(networkValidation).toHaveProperty('isValid');
      expect(networkValidation).toHaveProperty('errors');
      expect(networkValidation).toHaveProperty('warnings');
    });

    it('should provide platform-specific error messages', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const errorResponse = NetworkManager.createNetworkErrorResponse(
        'docker connection',
        new Error('Connection failed'),
        true
      );

      expect(errorResponse).toHaveProperty('platform', 'windows');
      expect(errorResponse).toHaveProperty('troubleshooting');
      expect(errorResponse).toHaveProperty('networkConfig');
    });
  });

  describe('Cross-Platform Docker Socket Handling', () => {
    it('should handle Windows Docker socket configuration', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const socketPath = NetworkManager.resolveDockerSocketPath('windows');
      const connectionOptions = NetworkManager.getDockerConnectionOptions();

      expect(socketPath).toBe('\\\\.\\pipe\\docker_engine');
      expect(connectionOptions.protocol).toBe('npipe');
    });

    it('should handle Unix Docker socket configuration', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const socketPath = NetworkManager.resolveDockerSocketPath('linux');
      const connectionOptions = NetworkManager.getDockerConnectionOptions();

      expect(socketPath).toBe('/var/run/docker.sock');
      expect(connectionOptions.protocol).toBe('unix');
    });
  });

  describe('CORS Configuration Integration', () => {
    it('should create appropriate CORS middleware for development', () => {
      process.env.NODE_ENV = 'development';

      const middleware = EnvironmentManager.createCorsLoggingMiddleware();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should create no-op CORS middleware for production', () => {
      process.env.NODE_ENV = 'production';

      const middleware = EnvironmentManager.createCorsLoggingMiddleware();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });
  });
});