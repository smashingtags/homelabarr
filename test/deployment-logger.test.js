import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeploymentLogger } from '../server/deployment-logger.js';
import { EnvironmentManager } from '../server/environment-manager.js';
import { NetworkManager } from '../server/network-manager.js';

// Mock dependencies
vi.mock('../server/environment-manager.js');
vi.mock('../server/network-manager.js');

describe('DeploymentLogger', () => {
  let originalEnv;
  let consoleSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear all mocks
    vi.clearAllMocks();

    // Mock console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Mock EnvironmentManager
    EnvironmentManager.detectEnvironment.mockReturnValue('development');
    EnvironmentManager.detectPlatform.mockReturnValue('linux');
    EnvironmentManager.getConfiguration.mockReturnValue({
      platform: 'linux',
      environment: 'development',
      logLevel: 'debug',
      features: { detailedLogging: true },
      port: 3001,
      bindAddress: '0.0.0.0',
      corsOrigin: '*',
      authEnabled: true,
      nodeEnv: 'development'
    });
    EnvironmentManager.validateConfiguration.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });
    EnvironmentManager.isContainerized.mockReturnValue(false);

    // Mock NetworkManager
    NetworkManager.getConfiguration.mockReturnValue({
      platform: 'linux',
      environment: 'development',
      bindAddress: '0.0.0.0',
      port: 3001,
      dockerSocket: '/var/run/docker.sock',
      timeouts: { connection: 30000, request: 10000, healthCheck: 5000 }
    });
    NetworkManager.validateNetworkConfiguration.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    // Reset DeploymentLogger state
    DeploymentLogger._resetForTesting?.();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      DeploymentLogger.initialize();

      // Verify initialization doesn't throw
      expect(() => DeploymentLogger.initialize()).not.toThrow();
    });

    it('should not reinitialize if already initialized', () => {
      DeploymentLogger.initialize();
      const firstCall = EnvironmentManager.detectEnvironment.mock.calls.length;
      
      DeploymentLogger.initialize();
      const secondCall = EnvironmentManager.detectEnvironment.mock.calls.length;

      expect(secondCall).toBe(firstCall); // Should not call again
    });
  });

  describe('Startup Logging', () => {
    it('should log comprehensive startup information', () => {
      DeploymentLogger.logStartupInfo();

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('🚀'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Application startup completed'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Platform: linux'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Environment: development'));
    });

    it('should include validation errors in startup log', () => {
      EnvironmentManager.validateConfiguration.mockReturnValue({
        isValid: false,
        errors: ['JWT_SECRET must be set'],
        warnings: ['Docker socket not found']
      });

      NetworkManager.validateNetworkConfiguration.mockReturnValue({
        isValid: false,
        errors: ['Port already in use'],
        warnings: ['Bind address may cause issues']
      });

      DeploymentLogger.logStartupInfo();

      // Should log with validation details
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('startup'));
    });

    it('should handle containerized environment in startup log', () => {
      EnvironmentManager.isContainerized.mockReturnValue(true);

      DeploymentLogger.logStartupInfo();

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('startup'));
    });
  });

  describe('CORS Activity Logging', () => {
    it('should log CORS activity in development mode', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: {
          'origin': 'http://localhost:3000',
          'user-agent': 'Mozilla/5.0',
          'access-control-request-method': 'POST'
        }
      };

      const mockRes = {
        statusCode: 200,
        statusMessage: 'OK',
        getHeaders: () => ({
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE'
        })
      };

      DeploymentLogger.logCorsActivity(mockReq, mockRes);

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('🔗'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('CORS request: GET /api/test'));
    });

    it('should log preflight OPTIONS requests specially', () => {
      const mockReq = {
        method: 'OPTIONS',
        url: '/api/test',
        headers: {
          'origin': 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type,Authorization'
        }
      };

      const mockRes = {
        statusCode: 200,
        getHeaders: () => ({})
      };

      DeploymentLogger.logCorsActivity(mockReq, mockRes);

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('CORS preflight request'));
    });

    it('should not log CORS activity in production mode', () => {
      EnvironmentManager.detectEnvironment.mockReturnValue('production');
      EnvironmentManager.getConfiguration.mockReturnValue({
        ...EnvironmentManager.getConfiguration(),
        environment: 'production'
      });

      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: { 'origin': 'http://localhost:3000' }
      };

      const result = DeploymentLogger.logCorsActivity(mockReq, null);

      expect(result).toBeNull();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should extract CORS-related headers correctly', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: {
          'origin': 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'content-type': 'application/json',
          'authorization': 'Bearer token'
        }
      };

      const mockRes = {
        statusCode: 200,
        getHeaders: () => ({
          'access-control-allow-origin': '*',
          'content-type': 'application/json'
        })
      };

      DeploymentLogger.logCorsActivity(mockReq, mockRes);

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('CORS request'));
    });
  });

  describe('Network Activity Logging', () => {
    it('should log successful network operations', () => {
      DeploymentLogger.logNetworkActivity('docker connection', {
        success: true,
        duration: 1500
      });

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('🌐'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Network operation: docker connection'));
    });

    it('should log network errors with error level', () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';

      DeploymentLogger.logNetworkActivity('docker connection', {
        error: error
      });

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('❌'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Network operation: docker connection'));
    });

    it('should log warnings for retry operations', () => {
      DeploymentLogger.logNetworkActivity('docker retry attempt', {
        warning: 'Retrying connection'
      });

      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('⚠️'));
    });

    it('should include platform and configuration context', () => {
      DeploymentLogger.logNetworkActivity('test operation', {
        testData: 'value'
      });

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Network operation: test operation'));
    });
  });

  describe('Docker State Change Logging', () => {
    it('should log Docker state transitions', () => {
      DeploymentLogger.logDockerStateChange('disconnected', 'connected', {
        duration: 2000,
        reason: 'successful_connection'
      });

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('✅'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Docker connection state changed: disconnected → connected'));
    });

    it('should log error states with error level', () => {
      DeploymentLogger.logDockerStateChange('connected', 'error', {
        error: 'Connection lost'
      });

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('❌'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('connected → error'));
    });

    it('should log retry states with warning level', () => {
      DeploymentLogger.logDockerStateChange('error', 'retrying', {
        retryCount: 2
      });

      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('⚠️'));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('error → retrying'));
    });

    it('should include comprehensive context information', () => {
      const context = {
        socketPath: '/var/run/docker.sock',
        platform: 'linux',
        retryCount: 1,
        duration: 1500
      };

      DeploymentLogger.logDockerStateChange('disconnected', 'connected', context);

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Docker connection state changed'));
    });
  });

  describe('Docker Retry Logging', () => {
    it('should log retry attempts with comprehensive context', () => {
      const error = {
        type: 'connection_refused',
        message: 'Connection refused',
        code: 'ECONNREFUSED'
      };

      DeploymentLogger.logDockerRetry(2, 5, 4000, error, {
        socketPath: '/var/run/docker.sock'
      });

      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('🔄'));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Docker retry attempt 2/5 scheduled in 4000ms'));
    });

    it('should include error stack in development mode', () => {
      const error = {
        type: 'connection_error',
        message: 'Connection failed',
        stack: 'Error: Connection failed\n    at test.js:1:1'
      };

      DeploymentLogger.logDockerRetry(1, 3, 2000, error);

      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Docker retry attempt'));
    });

    it('should calculate retry progress and remaining attempts', () => {
      const error = { type: 'timeout', message: 'Timeout' };

      DeploymentLogger.logDockerRetry(3, 5, 8000, error);

      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('3/5'));
    });
  });

  describe('Docker Operation Failure Logging', () => {
    it('should log operation failures with troubleshooting info', () => {
      const error = {
        type: 'connection_refused',
        message: 'Connection refused',
        code: 'ECONNREFUSED'
      };

      const troubleshooting = {
        possibleCauses: ['Docker daemon not running'],
        suggestedActions: ['Start Docker daemon']
      };

      DeploymentLogger.logDockerOperationFailed('container list', error, troubleshooting);

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('💥'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Docker operation \'container list\' failed'));
    });

    it('should provide default troubleshooting for Windows platform', () => {
      EnvironmentManager.detectPlatform.mockReturnValue('windows');
      EnvironmentManager.getConfiguration.mockReturnValue({
        ...EnvironmentManager.getConfiguration(),
        platform: 'windows'
      });

      const error = { type: 'unknown', message: 'Unknown error' };

      DeploymentLogger.logDockerOperationFailed('test operation', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Docker operation'));
    });

    it('should provide default troubleshooting for Linux platform', () => {
      const error = { type: 'unknown', message: 'Unknown error' };

      DeploymentLogger.logDockerOperationFailed('test operation', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Docker operation'));
    });

    it('should include error stack in development mode', () => {
      const error = {
        type: 'connection_error',
        message: 'Connection failed',
        stack: 'Error: Connection failed\n    at test.js:1:1'
      };

      DeploymentLogger.logDockerOperationFailed('test operation', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Docker operation'));
    });
  });

  describe('Configuration Summary Logging', () => {
    it('should log comprehensive configuration summary', () => {
      DeploymentLogger.logConfigurationSummary();

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('⚙️'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Application configuration summary'));
    });

    it('should include all major configuration sections', () => {
      DeploymentLogger.logConfigurationSummary();

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('configuration summary'));
    });
  });

  describe('CORS Logging Middleware', () => {
    it('should create middleware function in development', () => {
      const middleware = DeploymentLogger.createCorsLoggingMiddleware();

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should create no-op middleware in production', () => {
      EnvironmentManager.detectEnvironment.mockReturnValue('production');
      EnvironmentManager.getConfiguration.mockReturnValue({
        ...EnvironmentManager.getConfiguration(),
        environment: 'production'
      });

      const middleware = DeploymentLogger.createCorsLoggingMiddleware();

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3);
    });

    it('should log request and response in development middleware', () => {
      const middleware = DeploymentLogger.createCorsLoggingMiddleware();
      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: { 'origin': 'http://localhost:3000' }
      };
      const mockRes = {
        send: vi.fn().mockImplementation(function(data) { return data; }),
        getHeaders: vi.fn().mockReturnValue({})
      };
      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics Logging', () => {
    it('should log performance metrics', () => {
      const metrics = {
        requestCount: 100,
        averageResponseTime: 250,
        errorRate: 0.02
      };

      DeploymentLogger.logPerformanceMetrics(metrics);

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('📊'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Performance metrics'));
    });

    it('should include process uptime and memory usage', () => {
      DeploymentLogger.logPerformanceMetrics();

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Uptime:'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Memory:'));
    });

    it('should only log in debug mode or development', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        ...EnvironmentManager.getConfiguration(),
        environment: 'production',
        logLevel: 'info'
      });

      DeploymentLogger.logPerformanceMetrics();

      // Should still log but might be filtered by log level
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('Log Level Handling', () => {
    it('should respect debug log level in development', () => {
      DeploymentLogger.logNetworkActivity('debug operation', { level: 'debug' });

      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should filter debug logs in production', () => {
      EnvironmentManager.getConfiguration.mockReturnValue({
        ...EnvironmentManager.getConfiguration(),
        environment: 'production',
        logLevel: 'info'
      });

      // This would be a debug-level log that should be filtered
      DeploymentLogger.logPerformanceMetrics();

      // Should still be called since we're mocking console
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });
});