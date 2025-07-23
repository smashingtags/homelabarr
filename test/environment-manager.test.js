import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import { EnvironmentManager } from '../server/environment-manager.js';

// Mock dependencies
vi.mock('fs');
vi.mock('os');

describe('EnvironmentManager', () => {
  let originalEnv;
  let originalPlatform;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    originalPlatform = process.platform;
    
    // Reset the internal state of EnvironmentManager
    EnvironmentManager._resetForTesting?.();
    
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

  describe('detectPlatform', () => {
    it('should detect Windows platform correctly', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const platform = EnvironmentManager.detectPlatform();
      expect(platform).toBe('windows');
    });

    it('should detect Linux platform correctly', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const platform = EnvironmentManager.detectPlatform();
      expect(platform).toBe('linux');
    });

    it('should detect macOS platform correctly', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      const platform = EnvironmentManager.detectPlatform();
      expect(platform).toBe('darwin');
    });

    it('should default to linux for unknown platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'unknown',
        writable: true
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const platform = EnvironmentManager.detectPlatform();
      
      expect(platform).toBe('linux');
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Unknown platform: unknown, defaulting to linux');
      
      consoleSpy.mockRestore();
    });
  });

  describe('detectEnvironment', () => {
    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const environment = EnvironmentManager.detectEnvironment();
      expect(environment).toBe('production');
    });

    it('should detect production environment with "prod" value', () => {
      process.env.NODE_ENV = 'prod';
      const environment = EnvironmentManager.detectEnvironment();
      expect(environment).toBe('production');
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      const environment = EnvironmentManager.detectEnvironment();
      expect(environment).toBe('test');
    });

    it('should detect test environment with "testing" value', () => {
      process.env.NODE_ENV = 'testing';
      const environment = EnvironmentManager.detectEnvironment();
      expect(environment).toBe('test');
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      const environment = EnvironmentManager.detectEnvironment();
      expect(environment).toBe('development');
    });

    it('should default to development when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const environment = EnvironmentManager.detectEnvironment();
      expect(environment).toBe('development');
    });

    it('should default to development for unknown NODE_ENV values', () => {
      process.env.NODE_ENV = 'unknown';
      const environment = EnvironmentManager.detectEnvironment();
      expect(environment).toBe('development');
    });

    it('should handle case insensitive NODE_ENV values', () => {
      process.env.NODE_ENV = 'PRODUCTION';
      const environment = EnvironmentManager.detectEnvironment();
      expect(environment).toBe('production');
    });
  });

  describe('getConfiguration', () => {
    beforeEach(() => {
      // Mock fs.existsSync to return false by default
      fs.existsSync.mockReturnValue(false);
      
      // Mock os methods
      os.arch.mockReturnValue('x64');
      os.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
      os.freemem.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
    });

    it('should return complete configuration object', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3001';
      process.env.CORS_ORIGIN = '*';
      
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const config = EnvironmentManager.getConfiguration();

      expect(config).toMatchObject({
        platform: 'linux',
        environment: 'development',
        nodeEnv: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        corsOrigin: '*',
        dockerSocket: '/var/run/docker.sock',
        authEnabled: true,
        logLevel: 'debug'
      });

      expect(config).toHaveProperty('serviceUrls');
      expect(config).toHaveProperty('timeouts');
      expect(config).toHaveProperty('features');
    });

    it('should handle Windows platform configuration', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const config = EnvironmentManager.getConfiguration();

      expect(config.platform).toBe('windows');
      expect(config.dockerSocket).toBe('\\\\.\\pipe\\docker_engine');
      expect(config.dockerGid).toBeNull();
    });

    it('should handle Linux platform configuration', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const config = EnvironmentManager.getConfiguration();

      expect(config.platform).toBe('linux');
      expect(config.dockerSocket).toBe('/var/run/docker.sock');
      expect(config.dockerGid).toBe('999');
    });

    it('should use environment variable overrides', () => {
      process.env.PORT = '8080';
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      process.env.DOCKER_SOCKET = '/custom/docker.sock';
      process.env.DOCKER_GID = '1000';
      process.env.AUTH_ENABLED = 'false';
      process.env.LOG_LEVEL = 'error';

      const config = EnvironmentManager.getConfiguration();

      expect(config.port).toBe(8080);
      expect(config.corsOrigin).toBe('http://localhost:3000');
      expect(config.dockerSocket).toBe('/custom/docker.sock');
      expect(config.dockerGid).toBe('1000');
      expect(config.authEnabled).toBe(false);
      expect(config.logLevel).toBe('error');
    });

    it('should handle production environment defaults', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGIN;

      const config = EnvironmentManager.getConfiguration();

      expect(config.environment).toBe('production');
      expect(config.logLevel).toBe('info');
      expect(config.corsOrigin).toEqual([]);
    });

    it('should detect containerized environment', () => {
      fs.existsSync.mockImplementation((path) => {
        return path === '/.dockerenv';
      });

      const config = EnvironmentManager.getConfiguration();
      expect(config.bindAddress).toBe('0.0.0.0');
    });

    it('should handle CORS_ORIGIN with multiple origins', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000,http://localhost:5173,https://example.com';

      const config = EnvironmentManager.getConfiguration();
      expect(config.corsOrigin).toEqual([
        'http://localhost:3000',
        'http://localhost:5173',
        'https://example.com'
      ]);
    });
  });

  describe('validateConfiguration', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      // getuid is already mocked in main beforeEach
    });

    it('should pass validation for valid development configuration', () => {
      process.env.NODE_ENV = 'development';
      process.env.CORS_ORIGIN = '*';

      const validation = EnvironmentManager.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation for production without JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'homelabarr-default-secret-change-in-production';

      const validation = EnvironmentManager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('JWT_SECRET must be set to a secure value in production');
    });

    it('should fail validation for production without CORS_ORIGIN', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'secure-secret';
      delete process.env.CORS_ORIGIN;

      const validation = EnvironmentManager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('CORS_ORIGIN must be configured in production');
    });

    it('should warn about missing DOCKER_GID on Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });
      delete process.env.DOCKER_GID;

      const validation = EnvironmentManager.validateConfiguration();

      expect(validation.warnings).toContain('DOCKER_GID not set - may cause permission issues with Docker socket');
    });

    it('should warn about privileged ports for non-root users', () => {
      process.env.PORT = '80';
      vi.spyOn(process, 'getuid').mockReturnValue(1000); // non-root user

      const validation = EnvironmentManager.validateConfiguration();

      expect(validation.warnings).toContain('Port 80 requires root privileges on Unix systems');
    });

    it('should warn when Docker socket is not accessible', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });
      fs.existsSync.mockReturnValue(false);

      const validation = EnvironmentManager.validateConfiguration();

      expect(validation.warnings).toContain('Docker socket not found at /var/run/docker.sock');
    });
  });

  describe('getCorsOptions', () => {
    it('should return wildcard CORS for development', () => {
      process.env.NODE_ENV = 'development';

      const corsOptions = EnvironmentManager.getCorsOptions();

      expect(corsOptions.origin).toBe('*');
      expect(corsOptions.credentials).toBe(false);
      expect(corsOptions.methods).toContain('GET');
      expect(corsOptions.methods).toContain('POST');
      expect(corsOptions.methods).toContain('PUT');
      expect(corsOptions.methods).toContain('DELETE');
      expect(corsOptions.methods).toContain('OPTIONS');
    });

    it('should return strict CORS for production', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://example.com';

      const corsOptions = EnvironmentManager.getCorsOptions();

      expect(typeof corsOptions.origin).toBe('function');
      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
    });

    it('should validate origins in production mode', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://example.com';

      const corsOptions = EnvironmentManager.getCorsOptions();
      const originValidator = corsOptions.origin;

      // Test allowed origin
      const mockCallback = vi.fn();
      originValidator('https://example.com', mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(null, true);

      // Test disallowed origin
      const mockCallback2 = vi.fn();
      originValidator('https://malicious.com', mockCallback2);
      expect(mockCallback2).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getDockerConfig', () => {
    it('should return Windows Docker configuration', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const dockerConfig = EnvironmentManager.getDockerConfig();

      expect(dockerConfig.protocol).toBe('npipe');
      expect(dockerConfig.socketPath).toBe('\\\\.\\pipe\\docker_engine');
    });

    it('should return Unix Docker configuration', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });
      process.env.DOCKER_GID = '999';

      const dockerConfig = EnvironmentManager.getDockerConfig();

      expect(dockerConfig.protocol).toBe('unix');
      expect(dockerConfig.socketPath).toBe('/var/run/docker.sock');
      expect(dockerConfig.gid).toBe('999');
    });
  });

  describe('isContainerized', () => {
    it('should detect containerized environment with DOCKER_CONTAINER env var', () => {
      process.env.DOCKER_CONTAINER = 'true';

      const isContainerized = EnvironmentManager.isContainerized();
      expect(isContainerized).toBe(true);
    });

    it('should detect containerized environment with .dockerenv file', () => {
      fs.existsSync.mockImplementation((path) => {
        return path === '/.dockerenv';
      });

      const isContainerized = EnvironmentManager.isContainerized();
      expect(isContainerized).toBe(true);
    });

    it('should detect Kubernetes environment', () => {
      process.env.KUBERNETES_SERVICE_HOST = 'kubernetes.default.svc';

      const isContainerized = EnvironmentManager.isContainerized();
      expect(isContainerized).toBe(true);
    });

    it('should return false for non-containerized environment', () => {
      delete process.env.DOCKER_CONTAINER;
      delete process.env.KUBERNETES_SERVICE_HOST;
      fs.existsSync.mockReturnValue(false);

      const isContainerized = EnvironmentManager.isContainerized();
      expect(isContainerized).toBe(false);
    });
  });

  describe('logEnvironmentInfo', () => {
    it('should log environment information without errors', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock os methods
      os.arch.mockReturnValue('x64');
      os.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024);
      os.freemem.mockReturnValue(4 * 1024 * 1024 * 1024);
      
      process.env.NODE_ENV = 'development';

      EnvironmentManager.logEnvironmentInfo();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Environment Detection and Configuration'));
      
      consoleSpy.mockRestore();
    });
  });
});