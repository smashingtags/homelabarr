import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentManager } from '../server/environment-manager.js';

// Mock dependencies
vi.mock('fs');
vi.mock('os');

describe('CORS Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Reset the internal state
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

    // Clean up getuid mock
    if (process.getuid && process.getuid.mockRestore) {
      process.getuid.mockRestore();
    }
  });

  describe('getCorsOptions - Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should return wildcard origin for development', () => {
      const corsOptions = EnvironmentManager.getCorsOptions();

      expect(corsOptions.origin).toBe('*');
      expect(corsOptions.credentials).toBe(false); // Must be false when origin is '*'
    });

    it('should allow all HTTP methods in development', () => {
      const corsOptions = EnvironmentManager.getCorsOptions();

      const expectedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'];
      expect(corsOptions.methods).toEqual(expect.arrayContaining(expectedMethods));
    });

    it('should allow comprehensive headers in development', () => {
      const corsOptions = EnvironmentManager.getCorsOptions();

      const expectedHeaders = [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Methods'
      ];

      expect(corsOptions.allowedHeaders).toEqual(expect.arrayContaining(expectedHeaders));
    });

    it('should expose response headers in development', () => {
      const corsOptions = EnvironmentManager.getCorsOptions();

      const expectedExposedHeaders = [
        'Content-Length',
        'Content-Type',
        'ETag',
        'Last-Modified',
        'Cache-Control'
      ];

      expect(corsOptions.exposedHeaders).toEqual(expect.arrayContaining(expectedExposedHeaders));
    });

    it('should set correct preflight options for development', () => {
      const corsOptions = EnvironmentManager.getCorsOptions();

      expect(corsOptions.optionsSuccessStatus).toBe(200);
      expect(corsOptions.preflightContinue).toBe(false);
    });
  });

  describe('getCorsOptions - Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should use function-based origin validation for production', () => {
      process.env.CORS_ORIGIN = 'https://example.com';

      const corsOptions = EnvironmentManager.getCorsOptions();

      expect(typeof corsOptions.origin).toBe('function');
      expect(corsOptions.credentials).toBe(true);
    });

    it('should allow configured origins in production', () => {
      process.env.CORS_ORIGIN = 'https://example.com,https://app.example.com';

      const corsOptions = EnvironmentManager.getCorsOptions();
      const originValidator = corsOptions.origin;

      // Test allowed origins
      const mockCallback1 = vi.fn();
      originValidator('https://example.com', mockCallback1);
      expect(mockCallback1).toHaveBeenCalledWith(null, true);

      const mockCallback2 = vi.fn();
      originValidator('https://app.example.com', mockCallback2);
      expect(mockCallback2).toHaveBeenCalledWith(null, true);
    });

    it('should reject non-configured origins in production', () => {
      process.env.CORS_ORIGIN = 'https://example.com';

      const corsOptions = EnvironmentManager.getCorsOptions();
      const originValidator = corsOptions.origin;

      const mockCallback = vi.fn();
      originValidator('https://malicious.com', mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should allow requests without origin in production', () => {
      process.env.CORS_ORIGIN = 'https://example.com';

      const corsOptions = EnvironmentManager.getCorsOptions();
      const originValidator = corsOptions.origin;

      const mockCallback = vi.fn();
      originValidator(undefined, mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    it('should restrict methods in production', () => {
      const corsOptions = EnvironmentManager.getCorsOptions();

      expect(corsOptions.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
      expect(corsOptions.methods).not.toContain('PATCH');
      expect(corsOptions.methods).not.toContain('HEAD');
    });

    it('should restrict headers in production', () => {
      const corsOptions = EnvironmentManager.getCorsOptions();

      expect(corsOptions.allowedHeaders).toEqual(['Content-Type', 'Authorization', 'Accept']);
    });
  });

  describe('createCorsLoggingMiddleware - Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should create logging middleware for development', () => {
      const middleware = EnvironmentManager.createCorsLoggingMiddleware();

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should log CORS request details in development', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const middleware = EnvironmentManager.createCorsLoggingMiddleware();

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
        send: vi.fn().mockImplementation(function(data) {
          return data;
        }),
        getHeaders: vi.fn().mockReturnValue({
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE'
        }),
        statusCode: 200
      };

      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[CORS]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('GET /api/test'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Origin: http://localhost:3000'));
      expect(mockNext).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log preflight OPTIONS requests specially', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const middleware = EnvironmentManager.createCorsLoggingMiddleware();

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
        send: vi.fn().mockImplementation(function(data) {
          return data;
        }),
        getHeaders: vi.fn().mockReturnValue({}),
        statusCode: 200
      };

      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[PREFLIGHT]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Requested Method: POST'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Requested Headers: Content-Type,Authorization'));

      consoleSpy.mockRestore();
    });

    it('should log response headers when response is sent', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const middleware = EnvironmentManager.createCorsLoggingMiddleware();

      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: {
          'origin': 'http://localhost:3000'
        }
      };

      const mockRes = {
        send: vi.fn().mockImplementation(function(data) {
          return data;
        }),
        getHeaders: vi.fn().mockReturnValue({
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE'
        }),
        getHeader: vi.fn().mockImplementation((header) => {
          const headers = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,PUT,DELETE'
          };
          return headers[header.toLowerCase()];
        }),
        statusCode: 200
      };

      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);
      
      // Simulate sending response
      mockRes.send('test data');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[CORS Response]'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Status: 200'));

      consoleSpy.mockRestore();
    });
  });

  describe('createCorsLoggingMiddleware - Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should create no-op middleware for production', () => {
      const middleware = EnvironmentManager.createCorsLoggingMiddleware();

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should not log in production mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const middleware = EnvironmentManager.createCorsLoggingMiddleware();

      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: { 'origin': 'http://localhost:3000' }
      };

      const mockRes = {};
      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('CORS Configuration Integration', () => {
    it('should handle multiple CORS origins correctly', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://app1.example.com,https://app2.example.com,https://admin.example.com';

      const config = EnvironmentManager.getConfiguration();
      expect(config.corsOrigin).toEqual([
        'https://app1.example.com',
        'https://app2.example.com',
        'https://admin.example.com'
      ]);

      const corsOptions = EnvironmentManager.getCorsOptions();
      const originValidator = corsOptions.origin;

      // Test each configured origin
      const origins = ['https://app1.example.com', 'https://app2.example.com', 'https://admin.example.com'];
      origins.forEach(origin => {
        const mockCallback = vi.fn();
        originValidator(origin, mockCallback);
        expect(mockCallback).toHaveBeenCalledWith(null, true);
      });
    });

    it('should handle single wildcard CORS origin', () => {
      process.env.NODE_ENV = 'development';
      process.env.CORS_ORIGIN = '*';

      const config = EnvironmentManager.getConfiguration();
      expect(config.corsOrigin).toBe('*');

      const corsOptions = EnvironmentManager.getCorsOptions();
      expect(corsOptions.origin).toBe('*');
      expect(corsOptions.credentials).toBe(false);
    });

    it('should validate CORS configuration in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGIN;

      const validation = EnvironmentManager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('CORS_ORIGIN must be configured in production');
    });

    it('should not require CORS configuration in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.CORS_ORIGIN;

      const validation = EnvironmentManager.validateConfiguration();
      const corsErrors = validation.errors.filter(error => error.includes('CORS'));

      expect(corsErrors).toHaveLength(0);
    });
  });
});