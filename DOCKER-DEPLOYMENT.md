# HomelabARR Docker Deployment Guide

This guide covers deploying HomelabARR using Docker containers with the updated architecture (React + Node.js on ports 8084/8092).

## Quick Start

### 1. Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- HomelabARR CLI installed at a known path (e.g., `/opt/dockserver`)
- Minimum 2GB RAM and 2 CPU cores
- Ports 8084 (frontend) and 8092 (backend) available

### 2. Quick Deployment (GHCR Images)

```bash
# Download deployment manifest
curl -o homelabarr.yml https://raw.githubusercontent.com/smashingtags/homelabarr-cli/main/homelabarr.yml

# Configure environment
export CLI_BRIDGE_HOST_PATH=/opt/dockserver  # Your dockserver path
export DOCKER_GID=$(getent group docker | cut -d: -f3)
export CORS_ORIGIN=https://your-domain.com   # Your domain
export JWT_SECRET=$(openssl rand -base64 32)
export DEFAULT_ADMIN_PASSWORD=YourSecurePassword

# Deploy
docker-compose -f homelabarr.yml up -d

# Access the interface
echo "Frontend: http://localhost:8084"
echo "Backend:  http://localhost:8092"
```

## Deployment Options

### Option 1: GHCR Pre-built Images (Recommended)

Uses pre-built images from GitHub Container Registry - fastest deployment.

```bash
# Use the homelabarr.yml file
docker-compose -f homelabarr.yml up -d
```

**Pros:**
- Fastest deployment
- Automatically updated images
- Multi-architecture support (AMD64/ARM64)
- Production tested

**Cons:**
- Requires internet connection
- Uses latest version only

### Option 2: Local Build (Development)

Builds images locally from source - best for development and customization.

```bash
# Use the development configuration
docker-compose up -d
```

**Pros:**
- Latest code changes
- Full customization possible
- Works offline
- Development features enabled

**Cons:**
- Longer initial setup
- Requires build tools

### Option 3: Production Build

Builds optimized production images locally.

```bash
# Use the production configuration
docker-compose -f docker-compose.prod.yml up -d
```

**Pros:**
- Production optimizations
- Security features enabled
- Custom configurations
- Local control

**Cons:**
- Requires build environment
- Manual security configuration

## Environment Configuration

### Development Environment

Copy and customize the development environment:

```bash
cp .env.development .env

# Edit .env with your settings
nano .env
```

Key development settings:
```bash
NODE_ENV=development
FRONTEND_PORT=8084
BACKEND_PORT=8092
CORS_ORIGIN=*
AUTH_ENABLED=false
LOG_LEVEL=debug
CLI_BRIDGE_HOST_PATH=../../../dockserver
```

### Production Environment

Copy and customize the production environment:

```bash
cp .env.production .env

# Edit .env with your settings - CRITICAL security settings
nano .env
```

**Required production settings:**
```bash
NODE_ENV=production
FRONTEND_PORT=8084
BACKEND_PORT=8092
CORS_ORIGIN=https://your-domain.com  # NEVER use * in production
AUTH_ENABLED=true
JWT_SECRET=your-super-secret-32-char-key
DEFAULT_ADMIN_PASSWORD=YourSecurePassword
CLI_BRIDGE_HOST_PATH=/opt/dockserver
```

### CLI Bridge Configuration

The CLI Bridge integration is **critical** for HomelabARR functionality:

```bash
# Standard installation path
CLI_BRIDGE_HOST_PATH=/opt/dockserver

# User installation path
CLI_BRIDGE_HOST_PATH=/home/username/dockserver

# Custom installation path
CLI_BRIDGE_HOST_PATH=/your/custom/path/dockserver
```

**Verify CLI Bridge path:**
```bash
ls -la ${CLI_BRIDGE_HOST_PATH}/apps
ls -la ${CLI_BRIDGE_HOST_PATH}/traefik
```

## Docker Configuration

### Port Mapping

The updated architecture uses these ports:

| Service  | Container Port | Host Port | Purpose |
|----------|---------------|-----------|---------|
| Frontend | 8080          | 8084      | React UI |
| Backend  | 8092          | 8092      | Node.js API |

### Volume Mounts

Critical volume mounts for proper operation:

```yaml
volumes:
  # Docker socket for container management
  - /var/run/docker.sock:/var/run/docker.sock:rw
  
  # CLI Bridge integration - CRITICAL
  - ${CLI_BRIDGE_HOST_PATH}:/dockserver:rw
  
  # Data persistence
  - homelabarr-data:/app/data
```

### Network Configuration

Services communicate via Docker network:

```yaml
networks:
  homelabarr:
    name: homelabarr
    driver: bridge
```

Internal communication:
- Frontend → Backend: `http://homelabarr-backend:8092`
- Backend → Frontend: `http://homelabarr-frontend:8080`

## Security Configuration

### Docker Group Permissions

**Critical:** The backend container needs Docker socket access.

```bash
# Find your Docker group ID
DOCKER_GID=$(getent group docker | cut -d: -f3)
echo "Docker GID: $DOCKER_GID"

# Add to environment
export DOCKER_GID=$DOCKER_GID
```

### Production Security

**Required security configurations for production:**

1. **CORS Origin:**
   ```bash
   CORS_ORIGIN=https://your-domain.com  # Specific domain only
   ```

2. **Strong JWT Secret:**
   ```bash
   JWT_SECRET=$(openssl rand -base64 32)
   ```

3. **Secure Admin Password:**
   ```bash
   DEFAULT_ADMIN_PASSWORD=YourComplexPassword123!
   ```

4. **Authentication Enabled:**
   ```bash
   AUTH_ENABLED=true
   ```

## Deployment Scripts

### Using Deployment Script

The included deployment script provides easy management:

```bash
# Start development environment
./scripts/deploy.sh development

# Start production environment
./scripts/deploy.sh production

# Deploy using GHCR images
./scripts/deploy.sh ghcr

# Stop all containers
./scripts/deploy.sh stop

# Clean environment (removes volumes)
./scripts/deploy.sh clean
```

### Manual Deployment Commands

```bash
# Development deployment
docker-compose up -d

# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# GHCR deployment
docker-compose -f homelabarr.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove everything (including volumes)
docker-compose down -v
```

## Building Custom Images

### Building Locally

```bash
# Build both images
./scripts/build-images.sh

# Or build manually
docker build -f Dockerfile -t homelabarr-frontend .
docker build -f Dockerfile.backend -t homelabarr-backend .
```

### Pushing to Registry

```bash
# Push to your registry
./scripts/push-images.sh

# Or manually
docker tag homelabarr-frontend your-registry/homelabarr-frontend
docker push your-registry/homelabarr-frontend
```

## Health Checking

### Container Health

```bash
# Check container status
docker-compose ps

# Check individual container health
docker logs homelabarr-frontend
docker logs homelabarr-backend

# Test health endpoints
curl http://localhost:8084/health  # Frontend
curl http://localhost:8092/health  # Backend
```

### CLI Bridge Verification

```bash
# Test CLI Bridge integration
docker exec homelabarr-backend ls -la /dockserver

# Test CLI commands through API
curl -X GET http://localhost:8092/templates
```

## Troubleshooting

### Common Issues

1. **Port Conflicts:**
   ```bash
   # Check port usage
   netstat -tlnp | grep -E ':(8084|8092)'
   
   # Change ports in environment
   FRONTEND_PORT=8085
   BACKEND_PORT=8093
   ```

2. **Docker Permission Issues:**
   ```bash
   # Fix Docker group membership
   sudo usermod -aG docker $USER
   newgrp docker
   
   # Fix Docker socket permissions
   sudo chmod 666 /var/run/docker.sock
   ```

3. **CLI Bridge Not Found:**
   ```bash
   # Verify path exists
   ls -la ${CLI_BRIDGE_HOST_PATH}
   
   # Update path in environment
   CLI_BRIDGE_HOST_PATH=/correct/path/to/dockserver
   ```

4. **CORS Errors:**
   ```bash
   # Development: Allow all origins
   CORS_ORIGIN=*
   
   # Production: Set specific domain
   CORS_ORIGIN=https://your-domain.com
   ```

### Debug Commands

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker logs -f homelabarr-backend

# Execute commands in container
docker exec -it homelabarr-backend bash

# Check container networking
docker exec homelabarr-frontend curl http://homelabarr-backend:8092/health

# Monitor resource usage
docker stats homelabarr-frontend homelabarr-backend
```

## Reverse Proxy Integration

### Traefik Configuration

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.homelabarr.rule=Host(`homelabarr.your-domain.com`)"
  - "traefik.http.routers.homelabarr.tls.certresolver=letsencrypt"
  - "traefik.http.services.homelabarr.loadbalancer.server.port=8084"
```

### Nginx Configuration

```nginx
upstream homelabarr-frontend {
    server localhost:8084;
}

upstream homelabarr-backend {
    server localhost:8092;
}

server {
    listen 443 ssl;
    server_name homelabarr.your-domain.com;

    location / {
        proxy_pass http://homelabarr-frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://homelabarr-backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Backup and Recovery

### Data Backup

```bash
# Backup application data
docker run --rm -v homelabarr-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/homelabarr-data-backup.tar.gz -C /data .

# Backup user configurations
docker exec homelabarr-backend tar czf /backup/config-backup.tar.gz -C /app/server config
```

### Disaster Recovery

```bash
# Stop existing containers
docker-compose down

# Restore data volume
docker run --rm -v homelabarr-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/homelabarr-data-backup.tar.gz -C /data

# Restart services
docker-compose up -d
```

## Monitoring and Maintenance

### Resource Monitoring

```bash
# Monitor container resources
docker stats

# Check disk usage
docker system df

# Clean unused resources
docker system prune -a
```

### Log Management

```bash
# Rotate logs (configure in Docker daemon)
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### Updates

```bash
# Update GHCR images
docker-compose -f homelabarr.yml pull
docker-compose -f homelabarr.yml up -d

# Rebuild local images
./scripts/build-images.sh
docker-compose up -d --force-recreate
```

This guide ensures successful Docker deployment of HomelabARR with proper CLI Bridge integration and security configurations.