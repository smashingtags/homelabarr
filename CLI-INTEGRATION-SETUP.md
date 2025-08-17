# HomelabARR CLI Integration - MVP Setup Guide

This document provides setup instructions for testing the CLI integration MVP that connects the React frontend to the proven HomelabARR CLI system.

## Architecture Overview

The integration bridges the React frontend with the existing HomelabARR CLI infrastructure:

- **Frontend**: React app with real-time deployment progress
- **Backend**: Express server with CLI bridge
- **CLI Integration**: Direct connection to HomelabARR apps/ directory
- **Real-time Streaming**: Server-Sent Events for deployment progress
- **Deployment Modes**: Standard, Traefik, and Authelia support

## Prerequisites

### 1. HomelabARR CLI Installation
Ensure the HomelabARR CLI is properly installed at the expected location:

```bash
# Verify CLI structure
ls -la /path/to/homelabarr-cli/
# Should contain:
# - apps/          (100+ application YAML files)
# - traefik/       (Traefik configuration)
# - scripts/       (Utility scripts)
# - install.sh     (Main installer)
```

### 2. Docker Environment
- Docker Desktop or Docker Engine running
- Docker Compose available
- Proper permissions for Docker socket access

### 3. System Requirements
- Node.js 18+ 
- 4GB+ RAM
- 20GB+ available disk space

## Setup Instructions

### 1. Environment Configuration

Create/update the backend environment configuration:

```bash
# In server/.env (create if not exists)
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173

# CLI Integration paths
CLI_PATH=../../../  # Path to HomelabARR CLI root
APPS_PATH=apps/     # Relative to CLI_PATH
SCRIPTS_PATH=scripts/
TRAEFIK_PATH=traefik/

# Docker configuration
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_TIMEOUT=30000

# Default environment variables for deployments
DEFAULT_ID=1000
DEFAULT_TZ=UTC
DEFAULT_UMASK=002
DEFAULT_RESTART=unless-stopped
DEFAULT_DOMAIN=localhost
DEFAULT_APPFOLDER=/opt/appdata
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Ensure CLI bridge dependencies
npm install --save child_process fs path yaml
```

### 3. Start Development Environment

```bash
# Start both frontend and backend
npm run dev

# OR start separately:
# Frontend: npm run dev (port 5173)
# Backend: node server/index.js (port 3001)
```

### 4. Verify CLI Integration

Check CLI integration status by accessing the new "HomelabARR CLI" tab in the frontend:

1. Open http://localhost:5173
2. Click "HomelabARR CLI" tab (first tab)
3. Look for green "HomelabARR CLI Connected" banner
4. Verify application count shows 100+ apps

## Testing Deployment Modes

### Standard Mode (Basic Docker)
1. Select any application (e.g., "Media Servers" > "Plex")
2. Choose "Standard" deployment mode
3. Configure required fields
4. Deploy and monitor progress

### Traefik Mode (Reverse Proxy)
1. Ensure Traefik is available in CLI
2. Select application requiring web access
3. Choose "Traefik" deployment mode
4. Deploy with domain configuration

### Authelia Mode (Full Security)
1. Verify both Traefik and Authelia available
2. Select sensitive application
3. Choose "Traefik + Authelia" mode
4. Deploy with authentication

## Real-time Progress Testing

### 1. Open Browser Developer Tools
Monitor real-time deployment progress:

```javascript
// In browser console, monitor SSE connection
const eventSource = new EventSource('/stream/progress');
eventSource.onmessage = (event) => {
  console.log('Progress update:', JSON.parse(event.data));
};
```

### 2. Deploy Test Application
1. Start a deployment from CLI tab
2. Monitor progress modal in real-time
3. Check console for SSE events
4. Verify deployment logs stream

### 3. Verify Background Processing
1. Start deployment
2. Click "Run in Background"
3. Switch to "Deployed Apps" tab
4. Verify container appears after completion

## Troubleshooting

### CLI Integration Issues

**Problem**: "CLI Bridge not available" error
**Solutions**:
1. Verify CLI path in environment configuration
2. Check file permissions on CLI directory
3. Ensure CLI install.sh is executable

**Problem**: Applications not loading
**Solutions**:
1. Check apps/ directory structure
2. Verify YAML file permissions
3. Review server logs for parsing errors

### Docker Connection Issues

**Problem**: "Docker not available" errors
**Solutions**:
1. Verify Docker daemon is running
2. Check Docker socket permissions
3. Test Docker CLI access: `docker ps`

### Real-time Streaming Issues

**Problem**: Progress not updating
**Solutions**:
1. Check browser console for SSE errors
2. Verify /stream/progress endpoint accessible
3. Check server logs for streaming errors

### Deployment Failures

**Problem**: Traefik deployment fails
**Solutions**:
1. Ensure Traefik CLI files present
2. Check network configuration
3. Verify domain settings

**Problem**: Port conflicts
**Solutions**:
1. Check existing containers: `docker ps`
2. Use port manager to find alternatives
3. Stop conflicting services

## Performance Monitoring

### Backend Metrics
Monitor CLI bridge performance:

```bash
# Check server logs
tail -f server/logs/deployment.log

# Monitor active deployments
curl http://localhost:3001/deployments/active

# Check streaming statistics
curl http://localhost:3001/stream/statistics
```

### Frontend Metrics
Monitor frontend performance:

```javascript
// Check deployment state
console.log('Active deployments:', window.deploymentState);

// Monitor SSE connection
console.log('SSE readyState:', eventSource.readyState);
```

## Development Guidelines

### Adding New Applications
1. Add YAML files to CLI apps/ directory
2. Follow existing naming conventions
3. Include proper labels for Traefik/Authelia
4. Test deployment in all modes

### Extending Deployment Modes
1. Update DeploymentMode types
2. Add mode to backend deployment logic
3. Update frontend selection UI
4. Test end-to-end functionality

### Debugging
1. Enable debug logging in environment
2. Monitor both frontend and backend logs
3. Use browser dev tools for SSE monitoring
4. Check Docker container states

## Community Beta Testing

### Preparation Checklist
- [ ] All 100+ CLI applications tested
- [ ] Deployment modes verified
- [ ] Real-time progress working
- [ ] Error handling comprehensive
- [ ] Documentation complete
- [ ] Performance acceptable

### Beta Testing Instructions
1. Provide setup guide to community
2. Create test deployment scenarios
3. Monitor feedback channels
4. Track deployment success rates
5. Gather performance metrics

### Feedback Collection
- Discord community integration
- GitHub issue tracking
- Deployment success/failure metrics
- User experience feedback
- Performance benchmarks

## Next Steps

1. **Complete Testing**: Verify all deployment modes work correctly
2. **Performance Optimization**: Optimize CLI bridge and streaming
3. **Error Handling**: Improve error messages and recovery
4. **Documentation**: Complete user documentation
5. **Community Launch**: Prepare for beta testing rollout

## Support

- **Discord Community**: [HomelabARR Community](https://discord.gg/Pc7mXX786x)
- **Documentation**: Check CLAUDE.md for development guidelines
- **Issues**: Report bugs via GitHub issues
- **Support Development**: [Ko-fi Support](https://ko-fi.com/homelabarr)

---

**Note**: This integration represents a major milestone in connecting the proven CLI infrastructure with modern web interface. The community has identified HomelabARR as "#2 choice for docker container management" and this MVP bridges that gap with real-time deployment capabilities.