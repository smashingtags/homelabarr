# Docker Socket Access Fix - Testing Guide

This document provides comprehensive instructions for testing and validating the Docker socket access fix implemented for the homelabarr-backend service.

## Overview

The Docker socket access fix addresses the EACCES permission error that prevented the homelabarr-backend from accessing Docker containers. This testing suite validates that:

- Docker socket permissions are correctly configured
- Container deployment works with updated configuration
- All Docker operations function correctly after the fix
- Health check endpoints properly report Docker connectivity status

## Test Requirements Validation

The tests validate the following requirements:

- **Requirement 1.1**: Backend can access Docker socket without EACCES errors
- **Requirement 1.2**: Backend process has proper read/write permissions to Docker socket
- **Requirement 1.3**: API calls complete successfully without permission denials
- **Requirement 3.1**: Docker socket access works consistently across environments

## Test Files

### Main Test Script
- `test-docker-socket-fix.js` - Comprehensive Node.js test script
- `test-docker-socket-fix.ps1` - PowerShell wrapper for Windows
- `test-docker-socket-fix.sh` - Bash wrapper for Linux/macOS

### Supporting Test Files
- `test-health-endpoint.js` - Health check endpoint testing
- `test-circuit-breaker.js` - Docker connection retry mechanism testing

## Prerequisites

Before running the tests, ensure you have:

1. **Node.js** installed (version 14 or higher)
2. **Docker** installed and running
3. **npm dependencies** installed (`npm install`)
4. **Proper permissions** to access Docker socket

## Running the Tests

### Option 1: Direct Node.js Execution

```bash
# Run the main test script directly
node test-docker-socket-fix.js
```

### Option 2: Using Platform-Specific Wrappers

#### Windows (PowerShell)
```powershell
# Basic execution
.\test-docker-socket-fix.ps1

# With verbose output
.\test-docker-socket-fix.ps1 -Verbose

# With custom socket path and timeout
.\test-docker-socket-fix.ps1 -SocketPath "/var/run/docker.sock" -Timeout 15000

# Skip server status check
.\test-docker-socket-fix.ps1 -SkipServerCheck

# Show help
.\test-docker-socket-fix.ps1 -Help
```

#### Linux/macOS (Bash)
```bash
# Make script executable (Linux/macOS only)
chmod +x test-docker-socket-fix.sh

# Basic execution
./test-docker-socket-fix.sh

# With verbose output
./test-docker-socket-fix.sh --verbose

# With custom socket path and timeout
./test-docker-socket-fix.sh --socket /var/run/docker.sock --timeout 15000

# Skip server status check
./test-docker-socket-fix.sh --skip-server-check

# Show help
./test-docker-socket-fix.sh --help
```

## Test Categories

### 1. Socket Permissions Test
**Requirements**: 1.1, 1.2

Validates:
- Docker socket file exists and is accessible
- Socket has proper read/write permissions
- Basic Docker daemon connectivity

### 2. Docker Connection Test
**Requirements**: 1.1, 1.3

Validates:
- Docker version retrieval
- Container listing operations
- Image listing operations
- System information retrieval

### 3. Container Operations Test
**Requirements**: 1.1, 1.2, 1.3

Validates:
- Container creation
- Container starting and stopping
- Container log retrieval
- Container removal
- Image pulling (if needed)

### 4. Deployment Configuration Test
**Requirements**: 3.1

Validates:
- `docker-compose.yml` contains required configurations
- `Dockerfile.backend` is properly configured
- Hardcoded docker group creation is removed
- Docker Compose configuration validation

### 5. Health Check Test
**Requirements**: 1.1, 1.3

Validates:
- Health endpoint accessibility
- Proper Docker status reporting
- Required response fields present
- Error handling for Docker connectivity issues

### 6. Cleanup Test

Validates:
- Test resources are properly cleaned up
- No orphaned containers remain

## Environment Variables

The tests support the following environment variables:

- `DOCKER_SOCKET` - Path to Docker socket (default: `/var/run/docker.sock`)
- `TEST_TIMEOUT` - Connection timeout in milliseconds (default: `10000`)
- `PORT` - Server port for health check tests (default: `3001`)

## Expected Output

### Successful Test Run
```
🧪 Starting Docker Socket Access Fix Validation Tests
📍 Testing Docker socket: /var/run/docker.sock
⏱️  Timeout: 10000ms
🖥️  Platform: win32

────────────────────────────────────────────────────────────────
🧪 Testing Docker socket permissions...
ℹ️  Socket file exists: /var/run/docker.sock
ℹ️  Is socket: true
ℹ️  Socket permissions: 660
✅ Socket is readable and writable
✅ Docker daemon ping successful

────────────────────────────────────────────────────────────────
🧪 Testing Docker connection and basic operations...
ℹ️  Testing Docker version retrieval...
✅ Docker version: 24.0.7
ℹ️  API version: 1.43
ℹ️  Platform: linux/amd64
ℹ️  Testing container listing...
✅ Found 3 containers
ℹ️  Testing image listing...
✅ Found 12 images
ℹ️  Testing system info retrieval...
✅ Docker system info retrieved - 3 containers, 12 images

[... additional test output ...]

================================================================================
🧪 DOCKER SOCKET ACCESS FIX - TEST REPORT
================================================================================
✅ PASS Socket Permissions (Req: 1.1, 1.2)
   Details: Socket permissions and accessibility verified
✅ PASS Docker Connection (Req: 1.1, 1.3)
   Details: All Docker operations successful - Version: 24.0.7
✅ PASS Container Operations (Req: 1.1, 1.2, 1.3)
   Details: All container operations successful - Exit code: 0
✅ PASS Deployment Configuration (Req: 3.1)
   Details: Deployment configuration validated successfully
✅ PASS Health Check (Req: 1.1, 1.3)
   Details: Health check successful - Docker status: connected
✅ PASS Cleanup (Req: N/A)
   Details: Cleanup completed successfully

--------------------------------------------------------------------------------
📊 SUMMARY: 6/6 tests passed
✅ ALL TESTS PASSED - Docker socket access fix is working correctly!

🎉 Requirements validated:
   ✅ 1.1 - Backend can access Docker socket without EACCES errors
   ✅ 1.2 - Backend process has proper read/write permissions
   ✅ 1.3 - API calls complete successfully without permission denials
   ✅ 3.1 - Docker socket access works consistently across environments
```

### Failed Test Run
```
❌ FAIL Socket Permissions (Req: 1.1, 1.2)
   Details: Socket access denied: EACCES: permission denied

📊 SUMMARY: 0/6 tests passed
❌ SOME TESTS FAILED - Docker socket access fix needs attention

🔧 Failed tests require investigation and fixes
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Permission Denied (EACCES)
**Symptoms**: Socket access denied errors
**Solutions**:
- Verify Docker group membership: `groups $USER`
- Check Docker socket permissions: `ls -la /var/run/docker.sock`
- Ensure DOCKER_GID is set correctly in docker-compose.yml
- Restart Docker service if needed

#### 2. Docker Daemon Not Running
**Symptoms**: Connection refused errors
**Solutions**:
- Start Docker Desktop (Windows/macOS)
- Start Docker daemon: `sudo systemctl start docker` (Linux)
- Verify Docker status: `docker info`

#### 3. Server Not Running
**Symptoms**: Health check tests fail with connection refused
**Solutions**:
- Start the server: `npm run dev`
- Or start backend only: `node server/index.js`
- Verify server is listening on port 3001

#### 4. Missing Dependencies
**Symptoms**: Module not found errors
**Solutions**:
- Install dependencies: `npm install`
- Verify package.json exists
- Check Node.js version compatibility

#### 5. Container Group Membership Issues
**Symptoms**: Tests pass locally but fail in container
**Solutions**:
- Verify group_add configuration in docker-compose.yml
- Check DOCKER_GID environment variable
- Ensure container user is added to docker group at runtime

### Docker Group Configuration

#### Finding Docker Group ID
```bash
# Linux
getent group docker | cut -d: -f3

# Alternative
grep docker /etc/group | cut -d: -f3

# macOS
dscl . -read /Groups/docker PrimaryGroupID
```

#### Setting DOCKER_GID
```bash
# Set environment variable
export DOCKER_GID=$(getent group docker | cut -d: -f3)

# Use in docker-compose
DOCKER_GID=$(getent group docker | cut -d: -f3) docker-compose up -d
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Test Docker Socket Access
  run: |
    export DOCKER_GID=$(getent group docker | cut -d: -f3)
    node test-docker-socket-fix.js
```

### Docker Compose Testing
```bash
# Test with docker-compose
DOCKER_GID=$(getent group docker | cut -d: -f3) docker-compose up -d
node test-docker-socket-fix.js
docker-compose down
```

## Test Configuration

### Customizing Test Behavior

The test script supports various configuration options:

```javascript
const TEST_CONFIG = {
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  timeout: 10000,
  testContainerName: 'homelabarr-socket-test',
  testImage: 'alpine:latest',
  backendContainerName: 'homelabarr-backend',
  frontendContainerName: 'homelabarr-frontend'
};
```

### Environment-Specific Testing

#### Development Environment
```bash
NODE_ENV=development node test-docker-socket-fix.js
```

#### Production Environment
```bash
NODE_ENV=production DOCKER_SOCKET=/var/run/docker.sock node test-docker-socket-fix.js
```

## Security Considerations

The tests validate that:
- Container runs with minimal required permissions
- Docker socket access is group-based, not privileged mode
- No unnecessary system privileges are granted
- Socket permissions are properly restricted

## Performance Testing

The tests include timing information for:
- Connection establishment
- Container operations
- Health check response times
- Retry mechanism performance

## Monitoring and Logging

Test output includes:
- Structured logging for Docker operations
- Connection state transitions
- Error classification and troubleshooting info
- Performance metrics and timing data

## Related Documentation

- [Design Document](.kiro/specs/docker-socket-fix/design.md)
- [Requirements Document](.kiro/specs/docker-socket-fix/requirements.md)
- [Implementation Tasks](.kiro/specs/docker-socket-fix/tasks.md)
- [Docker Testing Guide](DOCKER-TESTING.md)
- [Development Guide](DEVELOPMENT.md)

## Support

If tests continue to fail after following this guide:

1. Review the troubleshooting section above
2. Check the design document for implementation details
3. Verify your Docker and system configuration
4. Ensure all prerequisites are met
5. Check for platform-specific issues

For additional support, refer to the project documentation or create an issue with:
- Test output logs
- System information (OS, Docker version, Node.js version)
- Configuration details (docker-compose.yml, environment variables)
- Error messages and stack traces