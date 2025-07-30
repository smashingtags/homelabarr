import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { NetworkManager } from '../server/network-manager.js';
import { EnvironmentManager } from '../server/environment-manager.js';

// Mock dependencies
vi.mock('fs');
vi.mock('../server/environment-manager.js');

describe('NetworkManager', () => {
  let originalEnv;
  let originalPlatform;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    originalPlatform = process.platform;
    
    // Reset the internal state
    NetworkManager._resetForTesting?.();
    
    // Clear all mocks
    vi.clearAllMocks();

    // Mock process.getuid for Windows compatibility
    if (!process.getuid) {
      process.getuid = vi.fn().mockReturnValue(1000);
    } else {
      vi.spyOn(process, 'getuid').mockReturnValue(1000);
    }
    
    // Mock EnvironmentManager default responses
    EnvironmentManager.getConfiguration.mockReturnValue({
      platform: 'linux',
      environment: 'development',
      port: 3001,
      bindAddress: '0.0.0.0',
      timeouts: {
        docker: 30000,
        request: 10000
      }
    });
    
    EnvironmentManager.isContainerized.mockReturnValue(false);
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

  describe('resolveDockerSocketPath', () => {
    it('should return custom socket path when DOCKER_SOCKET is set', () => {
      process.env.DOCKER_SOCKET = '/custom/docker.sock';

      const socketPath = NetworkManager.resolveDockerSocketPath('linux');
      expect(socketPath).toBe('/custom/docker.sock');
    });

    it('should return Windows named pipe path for Windows platform', () => {
      delete process.env.DOCKER_SOCKET;

      const socketPath = NetworkManager.resolveDockerSocketPath('windows');
      expect(socketPath).toBe('\\\\.\\pipe\\docker_engine');
    });

    it('should return Unix socket path for Linux platform', () => {
      delete process.env.DOCKER_SOCKET;

      const socketPath = NetworkManager.resolveDockerSocketPath('linux');
      expect(socketPath).toBe('/var/run/docker.sock');
    });

    it('should return Unix socket path for macOS platform', () => {
      delete process.env.DOCKER_SOCKET;

      const socketPath = NetworkManager.resolveDockerSocketPath('darwin');
      expect(socketPath).toBe('/var/run/docker.sock');
    });

    it('should default to Unix socket path for unknown platforms', () => {
      delete process.env.DOCKER_SOCKET;

      const socketPath = NetworkManager.resolveDockerSocketPath('unknown');
      expect(socketPath).toBe('/var/run/docker.sock');
    });
  });

  describe('getBindAddress', () => {
    it('should return custom bind address when BIND_ADDRESS is set', () => {
      process.env.BIND_ADDRESS = '127.0.0.1';

      const bindAddress = NetworkManager.getBindAddress('development');
      expect(bindAddress).toBe('127.0.0.1');
    });

    it('should return 0.0.0.0 for container compatibility', () => {
      delete process.env.BIND_ADDRESS;

      const bindAddress = NetworkManager.getBindAddress('development');
      expect(bindAddress).toBe('0.0.0.0');
    });

    it('should return 0.0.0.0 for production environment', () => {
      delete process.env.BIND_ADDRESS;

      const bindAddress = NetworkManager.getBindAddress('production');
      expect(bindAddress).toBe('0.0.0.0');
    });
  });

  describe('resolveServiceUrls', () => {
    beforeEach(() => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0'
      });
    });

    it('should return default service URLs for development', () => {
      const serviceUrls = NetworkManager.resolveServiceUrls('development');

      expect(serviceUrls).toMatchObject({
        frontend: 'http://localhost:5173',
        backend: 'http://0.0.0.0:3001',
        docker: 'unix:///var/run/docker.sock',
        database: 'sqlite://./data/homelabarr.db',
        redis: 'redis://redis:6379'
      });
    });

    it('should use environment variable overrides', () => {
      process.env.FRONTEND_URL = 'http://custom-frontend:8080';
      process.env.BACKEND_URL = 'http://custom-backend:9000';
      process.env.DOCKER_HOST = 'tcp://docker-host:2376';
      process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/homelabarr';
      process.env.REDIS_URL = 'redis://custom-redis:6380';

      const serviceUrls = NetworkManager.resolveServiceUrls('development');

      expect(serviceUrls.frontend).toBe('http://custom-frontend:8080');
      expect(serviceUrls.backend).toBe('http://custom-backend:9000');
      expect(serviceUrls.docker).toBe('tcp://docker-host:2376');
      expect(serviceUrls.database).toBe('postgresql://user:pass@db:5432/homelabarr');
      expect(serviceUrls.redis).toBe('redis://custom-redis:6380');
    });

    it('should return container-friendly URLs when containerized', () => {
      EnvironmentManager.isContainerized.mockReturnValue(true);

      const serviceUrls = NetworkManager.resolveServiceUrls('production');

      expect(serviceUrls.frontend).toBe('http://frontend:5173');
      expect(serviceUrls.backend).toBe('http://backend:3001');
      expect(serviceUrls.database).toBe('sqlite:///app/data/homelabarr.db');
    });

    it('should handle Windows Docker host URL', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'windows',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0'
      });

      const serviceUrls = NetworkManager.resolveServiceUrls('development');

      expect(serviceUrls.docker).toBe('npipe://./pipe/docker_engine');
    });

    it('should include health check URLs', () => {
      const serviceUrls = NetworkManager.resolveServiceUrls('development');

      expect(serviceUrls.healthCheck).toMatchObject({
        internal: 'http://0.0.0.0:3001/health',
        external: 'http://localhost:3001/health'
      });
    });
  });

  describe('validateNetworkConfiguration', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({
        isSocket: () => true
      });
    });

    it('should pass validation for valid configuration', () => {
      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation when Docker socket does not exist on Linux', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        timeouts: { docker: 30000, request: 10000 },
        validation: { validateDockerSocket: true, validateServiceUrls: true }
      });

      fs.existsSync.mockReturnValue(false);

      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(expect.stringContaining('Docker socket not found'));
    });

    it('should warn about localhost bind address in containers', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: 'localhost',
        timeouts: { docker: 30000, request: 10000 },
        validation: { validateDockerSocket: false, validateServiceUrls: false }
      });

      EnvironmentManager.isContainerized.mockReturnValue(true);

      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(expect.stringContaining('will not work in containers'));
    });

    it('should fail validation for invalid port range', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 70000, // Invalid port
        bindAddress: '0.0.0.0',
        timeouts: { docker: 30000, request: 10000 },
        validation: { validateDockerSocket: false, validateServiceUrls: false }
      });

      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(expect.stringContaining('not in valid range'));
    });

    it('should warn about privileged ports for non-root users', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 80,
        bindAddress: '0.0.0.0',
        timeouts: { docker: 30000, request: 10000 },
        validation: { validateDockerSocket: false, validateServiceUrls: false }
      });

      // getuid is already mocked in main beforeEach
      EnvironmentManager.isContainerized.mockReturnValue(false);

      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.warnings).toContain(expect.stringContaining('requires root privileges'));
    });

    it('should validate service URLs', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        timeouts: { docker: 30000, request: 10000 },
        validation: { validateDockerSocket: false, validateServiceUrls: true },
        serviceUrls: {
          frontend: 'invalid-url',
          backend: 'http://localhost:3001'
        }
      });

      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.errors).toContain(expect.stringContaining('invalid URL format'));
    });

    it('should validate timeout configuration', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        timeouts: { 
          docker: -1000, // Invalid negative timeout
          request: 10000 
        },
        validation: { validateDockerSocket: false, validateServiceUrls: false }
      });

      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(expect.stringContaining('must be a positive number'));
    });

    it('should warn about very short timeouts', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        timeouts: { 
          docker: 500, // Very short timeout
          request: 10000 
        },
        validation: { validateDockerSocket: false, validateServiceUrls: false }
      });

      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.warnings).toContain(expect.stringContaining('very short'));
    });

    it('should warn about very long timeouts', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        timeouts: { 
          docker: 400000, // Very long timeout (> 5 minutes)
          request: 10000 
        },
        validation: { validateDockerSocket: false, validateServiceUrls: false }
      });

      const validation = NetworkManager.validateNetworkConfiguration();

      expect(validation.warnings).toContain(expect.stringContaining('very long'));
    });
  });

  describe('getDockerConnectionOptions', () => {
    it('should return Windows Docker connection options', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'windows',
        environment: 'development',
        dockerSocket: '\\\\.\\pipe\\docker_engine',
        timeouts: { connection: 30000 }
      });

      const options = NetworkManager.getDockerConnectionOptions();

      expect(options).toMatchObject({
        socketPath: '\\\\.\\pipe\\docker_engine',
        timeout: 30000,
        protocol: 'npipe'
      });
    });

    it('should return Unix Docker connection options', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        dockerSocket: '/var/run/docker.sock',
        timeouts: { connection: 30000 }
      });

      const options = NetworkManager.getDockerConnectionOptions();

      expect(options).toMatchObject({
        socketPath: '/var/run/docker.sock',
        timeout: 30000,
        protocol: 'unix'
      });
    });
  });

  describe('getServiceUrl', () => {
    beforeEach(() => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        timeouts: { docker: 30000, request: 10000 }
      });
    });

    it('should return service URL for existing service', () => {
      const url = NetworkManager.getServiceUrl('frontend');
      expect(url).toBe('http://localhost:5173');
    });

    it('should return null for non-existing service', () => {
      const url = NetworkManager.getServiceUrl('nonexistent');
      expect(url).toBeNull();
    });
  });

  describe('createNetworkErrorResponse', () => {
    beforeEach(() => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        dockerSocket: '/var/run/docker.sock'
      });
    });

    it('should create error response with basic information', () => {
      const error = new Error('Connection failed');
      const response = NetworkManager.createNetworkErrorResponse('docker connection', error);

      expect(response).toMatchObject({
        error: 'Network operation failed: docker connection',
        details: 'Connection failed',
        platform: 'linux',
        environment: 'development'
      });

      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('troubleshooting');
    });

    it('should include Docker-specific troubleshooting for Docker operations', () => {
      const error = new Error('Docker daemon not running');
      const response = NetworkManager.createNetworkErrorResponse('docker socket', error);

      expect(response.troubleshooting.possibleCauses).toContain('Docker daemon not running');
      expect(response.troubleshooting.suggestedActions).toContain('Check Docker daemon status');
    });

    it('should include port-specific troubleshooting for port operations', () => {
      const error = new Error('Port already in use');
      const response = NetworkManager.createNetworkErrorResponse('port binding', error);

      expect(response.troubleshooting.possibleCauses).toContain('Port already in use');
      expect(response.troubleshooting.suggestedActions).toContain('Check for port conflicts');
    });

    it('should include configuration details when requested', () => {
      const error = new Error('Network error');
      const response = NetworkManager.createNetworkErrorResponse('test operation', error, true);

      expect(response).toHaveProperty('networkConfig');
      expect(response.networkConfig).toMatchObject({
        bindAddress: '0.0.0.0',
        port: 3001,
        dockerSocket: '/var/run/docker.sock',
        platform: 'linux'
      });
    });
  });

  describe('logNetworkInfo', () => {
    it('should log network information without errors', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      EnvironmentManager.getConfiguration.mockReturnValue({
        platform: 'linux',
        environment: 'development',
        port: 3001,
        bindAddress: '0.0.0.0',
        dockerSocket: '/var/run/docker.sock',
        timeouts: { connection: 30000 }
      });

      NetworkManager.logNetworkInfo();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network Configuration Manager'));
      
      consoleSpy.mockRestore();
    });
  });
});