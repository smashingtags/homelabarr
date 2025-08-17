# HomelabARR Enhanced

A revolutionary CLI-based Docker container management system with modern web interface. HomelabARR Enhanced makes deploying and managing self-hosted applications effortless with real Docker deployment capabilities and cross-platform compatibility.

![Status](https://img.shields.io/badge/status-MVP_Ready-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Docker](https://img.shields.io/badge/Docker-CLI_Enhanced-blue)
![Platform](https://img.shields.io/badge/Platform-Windows_|_Linux-blue)

![Interface Preview](https://github.com/smashingtags/homelabarr-assets/blob/main/screenshots/homelabarr-app-recording.gif?raw=true)

🔗 **[Live Demo](https://demo.homelabarr.com)** | 🚀 **MVP Status: Ready for Testing**

## ✨ What's New in Enhanced Version

- ✅ **Real Docker Deployment**: Actual container deployment via CLI-based Docker integration
- ✅ **Windows Compatibility**: Bypasses docker-modem limitations with native CLI approach
- ✅ **90+ Working Applications**: Pre-tested templates ready for deployment
- ✅ **Cross-Platform Support**: Works seamlessly on Windows, Linux, and macOS
- ✅ **HomelabARR CLI Integration**: Compatible with existing HomelabARR ecosystem
- ✅ **CLI-Based Architecture**: Reliable container management without socket limitations

## 🚀 MVP Features (Ready for Testing)

- ✅ **One-click Real Container Deployment** - Deploy actual Docker containers
- ✅ **CLI-Based Docker Management** - Reliable cross-platform container operations  
- ✅ **Live Container Status** - Real-time monitoring of deployed containers
- ✅ **90+ Application Templates** - Pre-configured, tested application library
- ✅ **Windows Docker Desktop Support** - Full compatibility with Windows environments
- ✅ **HomelabARR Ecosystem Integration** - Works with existing HomelabARR CLI
- ✅ **Modern React Interface** - Beautiful, responsive web UI
- ✅ **Container Health Monitoring** - Health checks and status tracking

## 🏗️ Architecture Overview

### Core Components
- **Frontend**: React + TypeScript + Vite for modern UI experience
- **Backend**: Node.js with CLI-based Docker integration for reliable deployments
- **CLI Bridge**: Custom Docker CLI wrapper that bypasses socket compatibility issues
- **Template Engine**: 90+ pre-configured application templates
- **Health Monitor**: Real-time container status and health checking

### Why CLI-Based Approach?
Our enhanced architecture uses Docker CLI commands instead of socket connections to solve:
- ✅ Windows named pipe compatibility issues
- ✅ Docker Desktop permission complexities  
- ✅ Cross-platform socket access limitations
- ✅ Reliable container deployment across all environments

## 📋 Prerequisites

- **Docker Desktop** (Windows) or **Docker Engine** (Linux/macOS)
- **Node.js 18+** (for development)
- **Git** (for cloning repository)

## 🛠️ Quick Start Options

### Option 1: Production Deployment (Recommended)
```bash
# Quick deployment using pre-built images
git clone https://github.com/smashingtags/homelabarr.git
cd homelabarr
docker compose -f homelabarr.yml up -d
```

Access at: `http://localhost:8087` (Frontend) | Backend API: `http://localhost:3009`

### Option 2: Development Environment
```bash
# Development with live reload
git clone https://github.com/smashingtags/homelabarr.git
cd homelabarr
npm install
npm run dev
```

### Option 3: Standalone Enhanced Container
```bash
# Run the enhanced standalone version
docker run -d \
  --name homelabarr-enhanced \
  -p 8081:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/smashingtags/homelabarr-mount-enhanced:latest
```

### Option 4: HomelabARR CLI Integration
```bash
# Integration with existing HomelabARR CLI
cd /opt/dockserver/apps/addons
sudo docker compose -f mount-enhanced.yml up -d
```

## 🔧 Configuration Options

### Production Configuration (homelabarr.yml)
```yaml
services:
  frontend:
    image: ghcr.io/smashingtags/homelabarr-frontend:latest
    container_name: homelabarr-frontend
    restart: unless-stopped
    ports:
      - "8087:80"
    networks:
      - homelabarr
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://homelabarr-frontend/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  backend:
    image: ghcr.io/smashingtags/homelabarr-backend:latest
    container_name: homelabarr-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3001
      - CORS_ORIGIN=*
      - DOCKER_SOCKET=/var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - "3009:3001"
    networks:
      - homelabarr
    group_add:
      - "${DOCKER_GID:-994}"
    privileged: true
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://homelabarr-backend:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

networks:
  homelabarr:
    name: homelabarr
```

### Environment Variables
```bash
# Docker Configuration
DOCKER_GID=999              # Docker group ID (auto-detected)
NODE_ENV=production          # Environment mode
CORS_ORIGIN=*               # CORS configuration

# Port Configuration  
FRONTEND_PORT=8087          # Frontend web interface
BACKEND_PORT=3009           # Backend API port

# Authentication (Optional)
AUTH_ENABLED=false          # Enable/disable authentication
DEFAULT_ADMIN_PASSWORD=admin # Default admin password
```

## 🎯 Deployment Modes

### 1. Standard Mode (Current MVP)
- Direct port mapping for easy access
- CLI-based Docker deployment
- Perfect for standalone installations
- No reverse proxy required

### 2. HomelabARR CLI Integration
- Full integration with existing HomelabARR ecosystem
- Traefik reverse proxy support
- Authelia authentication middleware
- SSL/TLS with Let's Encrypt certificates

### 3. Development Mode
- Live reload for frontend development
- Debug logging enabled
- Hot module replacement
- Development API endpoints

## 📱 Application Library

### Infrastructure & Management
- **Traefik** - Reverse Proxy with SSL
- **Homepage** - Application Dashboard  
- **Portainer** - Docker Management
- **Dockge** - Docker Compose Manager
- **Fenrus** - Modern Dashboard
- **Heimdall** - Application Portal

### Media & Entertainment  
- **Plex** - Media Server
- **Jellyfin** - Open Source Media Server
- **Emby** - Media Server
- **Overseerr** - Media Request Management
- **Tautulli** - Plex Analytics
- **Kometa** - Media Collection Manager

### Download Management
- **qBittorrent** - Torrent Client
- **SABnzbd** - Usenet Downloader
- **NZBGet** - Usenet Client
- **Deluge** - BitTorrent Client

### Media Automation (Servarr Stack)
- **Sonarr** - TV Series Management
- **Radarr** - Movie Management  
- **Lidarr** - Music Management
- **Readarr** - Book Management
- **Prowlarr** - Indexer Manager
- **Bazarr** - Subtitle Management

### Monitoring & Analytics
- **Grafana** - Analytics & Monitoring
- **Prometheus** - Metrics Collection
- **Uptime Kuma** - Status Monitoring
- **Netdata** - Performance Monitoring  
- **Glances** - System Monitoring

### Security & Authentication
- **Authelia** - Authentication Server
- **Authentik** - Identity Provider
- **Vaultwarden** - Password Manager
- **AdGuard Home** - DNS & Ad Blocking

### Productivity & Storage
- **Nextcloud** - File Sharing & Sync
- **Paperless-ngx** - Document Management
- **Immich** - Photo Management
- **Syncthing** - File Synchronization
- **Duplicati** - Backup Solution

### Development & Tools
- **Gitea** - Git Repository Server
- **IT-Tools** - Developer Utilities
- **Cloud Commander** - File Manager
- **Code Server** - VS Code in Browser

### Communication & Collaboration
- **Matrix** - Decentralized Chat
- **Rocket.Chat** - Team Communication
- **Mattermost** - Team Collaboration

## 🔌 CLI Integration API

### Core Endpoints

#### `POST /api/deploy`
Deploy containers using CLI-based Docker approach
```javascript
{
  "appId": "plex",
  "config": {
    "ports": {"32400": "32400"},
    "volumes": {"/config": "/opt/appdata/plex"}
  },
  "mode": "standard"
}
```

#### `GET /api/containers`
Get real-time container status via Docker CLI
```javascript
[
  {
    "id": "homelabarr-plex-12345",
    "name": "plex", 
    "status": "running",
    "ports": ["32400:32400"],
    "uptime": "2 hours"
  }
]
```

#### `GET /api/applications`
List all available application templates
```javascript
[
  {
    "id": "plex",
    "name": "Plex Media Server",
    "category": "media",
    "description": "Stream your media collection",
    "verified": true
  }
]
```

## 🚀 MVP Testing Guide

### 1. Basic Deployment Test
```bash
# Start the application
docker compose -f homelabarr.yml up -d

# Access frontend
curl http://localhost:8087

# Test backend API
curl http://localhost:3009/health
```

### 2. Container Deployment Test
```bash
# Deploy a test application via API
curl -X POST http://localhost:3009/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"appId": "it-tools", "config": {}, "mode": "standard"}'

# Verify container is running
docker ps | grep it-tools
```

### 3. Integration Test
```bash
# Test with existing containers
docker ps
curl http://localhost:3009/api/containers
```

## 🏆 MVP Achievements

- ✅ **90+ Working Templates**: Extensively tested application library
- ✅ **Real Docker Deployment**: Actual container deployment capabilities
- ✅ **Windows Compatibility**: Full Docker Desktop support
- ✅ **CLI-Based Reliability**: No socket compatibility issues
- ✅ **HomelabARR Integration**: Seamless ecosystem compatibility
- ✅ **Production Ready**: Stable, tested, and documented

## 🔍 Troubleshooting

### Windows Docker Desktop Issues
```bash
# Ensure Docker Desktop is running
docker --version

# Check Docker daemon status  
docker info

# Test Docker CLI access
docker ps
```

### Container Deployment Issues
```bash
# Check backend logs
docker logs homelabarr-backend

# Verify Docker socket access
docker exec homelabarr-backend docker ps

# Test CLI deployment manually
docker run -d --name test-container nginx:latest
```

### Port Conflicts
```bash
# Check port usage
netstat -an | findstr :8087
netstat -an | findstr :3009

# Modify port configuration
FRONTEND_PORT=8088 BACKEND_PORT=3010 docker compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📈 Roadmap

### Phase 1: MVP ✅ (Current)
- CLI-based Docker deployment
- 90+ application templates
- Cross-platform compatibility
- Basic container management

### Phase 2: Enhanced Features 🚧
- Advanced container orchestration
- Volume management interface
- Backup and restore functionality
- Performance monitoring dashboard

### Phase 3: Enterprise Features 🔮
- Multi-host deployment
- Role-based access control
- Advanced networking configuration
- Enterprise authentication integration

## 📞 Support & Community

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/smashingtags/homelabarr/issues)
- 💬 **Community Chat**: [Discord Server](https://discord.gg/Pc7mXX786x)
- 📚 **Documentation**: [Project Wiki](https://github.com/smashingtags/homelabarr/wiki)
- 🤝 **Contributions**: [Contributing Guide](CONTRIBUTING.md)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

### Core Technologies
- [Docker](https://www.docker.com/) - Containerization platform
- [React](https://reactjs.org/) - Frontend framework
- [Node.js](https://nodejs.org/) - Backend runtime
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vite](https://vitejs.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework

### Community & Ecosystem
- **HomelabARR CLI** - Integration foundation
- **Servarr Community** - Application templates
- **Homelab Community** - Testing and feedback
- **Self-Hosted Community** - Application ecosystem

---

**Status**: ✅ MVP Ready | **Last Updated**: August 2025 | **Version**: 2.0.0-enhanced