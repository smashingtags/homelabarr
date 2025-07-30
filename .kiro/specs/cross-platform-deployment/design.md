# Design Document

## Overview

This design addresses cross-platform deployment issues where the HomelabARR containerized application works on Windows Docker Desktop but fails on Linux environments. The solution implements comprehensive environment detection, enhanced CORS configuration, platform-agnostic networking, and robust error handling to ensure consistent behavior across deployment platforms.

The design preserves all existing functionality while adding platform-specific adaptations and enhanced logging for troubleshooting deployment issues.

## Architecture

### Current State Analysis

The application already has:
- Basic CORS configuration with wildcard support in development
- Docker connection management with retry logic
- Environment variable handling
- Health check endpoints

### Enhanced Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Environment Detection & Configuration Manager             │
│  ├─ Platform Detection (Windows/Linux)                     │
│  ├─ Environment Mode Detection (dev/prod)                  │
│  └─ Configuration Validation & Defaults                    │
├─────────────────────────────────────────────────────────────┤
│  Enhanced CORS Manager                                      │
│  ├─ Development Mode: Wildcard Origins                     │
│  ├─ Production Mode: Configured Origins                    │
│  └─ Request Logging & Debugging                            │
├─────────────────────────────────────────────────────────────┤
│  Platform-Agnostic Network Manager                         │
│  ├─ Docker Socket Path Resolution                          │
│  ├─ Host Binding Configuration (0.0.0.0 vs localhost)     │
│  └─ Service URL Resolution                                  │
├─────────────────────────────────────────────────────────────┤
│  Enhanced Docker Connection Manager (Existing + Updates)   │
│  ├─ Cross-Platform Socket Handling                         │
│  ├─ Connection State Management                            │
│  └─ Error Classification & Recovery                        │
├─────────────────────────────────────────────────────────────┤
│  Deployment Logging & Diagnostics                          │
│  ├─ Startup Environment Logging                            │
│  ├─ CORS Request Logging                                   │
│  └─ Network Connection Diagnostics                         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Environment Detection & Configuration Manager

**Purpose**: Detect platform and environment, validate configuration, and provide defaults.

**Interface**:
```javascript
class EnvironmentManager {
  static detectPlatform(): 'windows' | 'linux' | 'darwin'
  static detectEnvironment(): 'development' | 'production' | 'test'
  static validateConfiguration(): ConfigValidationResult
  static getConfiguration(): EnvironmentConfig
  static logEnvironmentInfo(): void
}
```

**Key Features**:
- Automatic platform detection using `process.platform`
- Environment mode detection with fallback to development
- Configuration validation with detailed error messages
- Startup logging of environment details

### 2. Enhanced CORS Manager

**Purpose**: Provide robust CORS handling with development-friendly defaults and comprehensive logging.

**Interface**:
```javascript
class CORSManager {
  static createCORSOptions(environment: string): CORSOptions
  static logCORSRequest(req: Request): void
  static validateOrigin(origin: string, environment: string): boolean
}
```

**Key Features**:
- Development mode: Wildcard origins (`*`) with all methods and headers
- Production mode: Configured origin list with validation
- Request logging for debugging CORS issues
- Preflight request handling

### 3. Platform-Agnostic Network Manager

**Purpose**: Handle networking differences between Windows and Linux deployments.

**Interface**:
```javascript
class NetworkManager {
  static resolveDockerSocketPath(platform: string): string
  static getBindAddress(environment: string): string
  static resolveServiceURL(serviceName: string, environment: string): string
  static validateNetworkConfiguration(): NetworkValidationResult
}
```

**Key Features**:
- Docker socket path resolution (Unix socket vs named pipe)
- Host binding configuration (0.0.0.0 for containers, localhost for development)
- Service URL resolution using environment variables
- Network configuration validation

### 4. Enhanced Docker Connection Manager Updates

**Purpose**: Extend existing Docker connection manager with cross-platform improvements.

**Enhancements**:
- Cross-platform socket path handling
- Enhanced error classification for platform-specific issues
- Improved connection state logging
- Platform-specific troubleshooting suggestions

### 5. Deployment Logging & Diagnostics

**Purpose**: Provide comprehensive logging for deployment troubleshooting.

**Interface**:
```javascript
class DeploymentLogger {
  static logStartupInfo(): void
  static logCORSActivity(req: Request, res: Response): void
  static logNetworkActivity(operation: string, details: object): void
  static logPlatformDifferences(): void
}
```

**Key Features**:
- Structured startup logging with environment details
- CORS request/response logging in development
- Network operation logging with timestamps
- Platform-specific configuration logging

## Data Models

### Environment Configuration Model

```javascript
interface EnvironmentConfig {
  platform: 'windows' | 'linux' | 'darwin';
  environment: 'development' | 'production' | 'test';
  nodeEnv: string;
  port: number;
  corsOrigin: string | string[];
  dockerSocket: string;
  dockerGid: string | number;
  authEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  bindAddress: string;
  serviceUrls: Record<string, string>;
}
```

### CORS Configuration Model

```javascript
interface CORSConfig {
  origin: string | string[] | boolean | Function;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  optionsSuccessStatus: number;
  preflightContinue: boolean;
}
```

### Network Configuration Model

```javascript
interface NetworkConfig {
  dockerSocketPath: string;
  bindAddress: string;
  serviceUrls: Record<string, string>;
  timeouts: {
    connection: number;
    request: number;
  };
}
```

## Error Handling

### Configuration Validation Errors

- **Missing Environment Variables**: Provide clear error messages with required variable names
- **Invalid Configuration Values**: Validate and suggest correct formats
- **Platform Incompatibility**: Detect and warn about platform-specific issues

### CORS Error Handling

- **Development Mode**: Log all CORS requests and responses for debugging
- **Production Mode**: Log blocked requests with origin information
- **Preflight Failures**: Provide detailed error messages for OPTIONS requests

### Network Error Handling

- **Docker Socket Access**: Platform-specific error messages and resolution steps
- **Port Binding Issues**: Detect and suggest alternative ports or binding addresses
- **Service Communication**: Retry logic with exponential backoff

### Error Response Format

```javascript
interface ErrorResponse {
  error: string;
  details: string;
  platform: string;
  environment: string;
  timestamp: string;
  troubleshooting?: {
    possibleCauses: string[];
    suggestedActions: string[];
    documentationLinks: string[];
  };
}
```

## Testing Strategy

### Unit Tests

1. **Environment Detection Tests**
   - Platform detection accuracy
   - Environment variable parsing
   - Configuration validation logic
   - Default value assignment

2. **CORS Configuration Tests**
   - Development mode wildcard behavior
   - Production mode origin validation
   - Preflight request handling
   - Header configuration

3. **Network Configuration Tests**
   - Docker socket path resolution
   - Bind address determination
   - Service URL construction
   - Configuration validation

### Integration Tests

1. **Cross-Platform Docker Tests**
   - Docker socket connectivity on different platforms
   - Container networking validation
   - Volume mounting compatibility

2. **CORS Integration Tests**
   - Frontend-backend communication
   - Cross-origin request handling
   - Authentication with CORS

3. **Environment Configuration Tests**
   - Configuration loading from different sources
   - Environment variable precedence
   - Default value fallbacks

### Platform-Specific Tests

1. **Windows Docker Desktop Tests**
   - Named pipe Docker socket access
   - Windows path handling
   - Container networking on Windows

2. **Linux Docker Tests**
   - Unix socket Docker socket access
   - Linux path handling
   - Container networking on Linux

### Manual Testing Scenarios

1. **Development Environment Setup**
   - Fresh installation on Windows
   - Fresh installation on Linux
   - Configuration migration between platforms

2. **Production Deployment Testing**
   - Docker Hub image deployment on Linux
   - Environment variable configuration
   - CORS behavior in production mode

3. **Error Scenario Testing**
   - Missing Docker socket
   - Invalid environment variables
   - Network connectivity issues

## Implementation Considerations

### Backward Compatibility

- All existing functionality must be preserved
- Existing environment variables should continue to work
- Current Docker Compose configuration should remain functional

### Performance Impact

- Environment detection should occur only at startup
- CORS logging should be conditional based on environment
- Network configuration should be cached after initial resolution

### Security Considerations

- Development mode CORS wildcards should never be used in production
- Sensitive configuration values should not be logged
- Docker socket access should maintain proper permissions

### Monitoring and Observability

- Structured logging for deployment diagnostics
- Health check endpoints should include platform information
- Error tracking should include platform and environment context

## Configuration Files Updates

### Docker Compose Enhancements

- Add platform-specific environment variables
- Include development mode flags
- Configure logging levels appropriately

### Environment File Templates

- Provide platform-specific .env templates
- Include comprehensive documentation
- Add validation examples

### Documentation Updates

- Platform-specific deployment guides
- Troubleshooting section for common issues
- Configuration reference documentation