# Homelabarr Help Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Docker Installation](#docker-installation)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Usage Guide](#usage-guide)
7. [Application Categories](#application-categories)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)
10. [FAQ](#faq)

## Introduction
Homelabarr is a comprehensive Docker container management system designed for home lab environments. It provides a user-friendly web interface to deploy and manage self-hosted applications with minimal effort.

## Getting Started

### Prerequisites
- Docker Engine 20.10.0 or higher
- Docker Compose v2.0.0 or higher
- Node.js 18 or higher (for development)
- A reverse proxy (like Traefik) for SSL termination
- Sufficient disk space for containers and data

### System Requirements
- CPU: 2+ cores recommended
- RAM: 4GB minimum, 8GB+ recommended
- Storage: Varies based on applications

## Docker Installation

### Windows
1. Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Enable WSL 2 backend:
   ```powershell
   wsl --install
   ```
3. In Docker Desktop settings:
   - Enable "Use WSL 2 based engine"
   - Enable "Expose daemon on tcp://localhost:2375 without TLS"
   - Apply & Restart

### macOS
1. Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. From terminal:
   ```bash
   # Install Homebrew if not installed
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Install Docker CLI
   brew install docker docker-compose
   ```

### Linux (Ubuntu/Debian)
```bash
# Add Docker's official GPG key
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Set socket permissions
sudo chmod 666 /var/run/docker.sock

# Make socket permissions persistent
sudo mkdir -p /etc/systemd/system/docker.service.d/
echo '[Service]
ExecStartPost=/bin/chmod 666 /var/run/docker.sock
' | sudo tee /etc/systemd/system/docker.service.d/override.conf

sudo systemctl daemon-reload
sudo systemctl restart docker
```

## Installation

### Using Docker Compose (Recommended)
```bash
# Clone the repository
git clone https://github.com/yourusername/homelabarr.git
cd homelabarr

# Start the application
docker compose up -d
```

### Manual Docker Installation
```bash
# Build frontend
docker build -t homelabarr-frontend .

# Build backend
docker build -f Dockerfile.backend -t homelabarr-backend .

# Run frontend
docker run -d \
  --name homelabarr-frontend \
  -p 80:80 \
  homelabarr-frontend

# Run backend
docker run -d \
  --name homelabarr-backend \
  -p 3001:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --group-add 999 \
  homelabarr-backend
```

## Configuration

### Environment Variables
Create a `.env` file based on `.env.example`:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Docker Configuration
DOCKER_SOCKET=/var/run/docker.sock

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### Docker Socket
Ensure the Docker socket is accessible:
```bash
sudo chmod 666 /var/run/docker.sock
```

## Usage Guide

### Deploying Applications
1. Browse available applications in the dashboard
2. Click "Deploy" on your chosen application
3. Fill in the required configuration fields
4. Click "Deploy" to start the container

### Managing Containers
- **Start/Stop**: Use the play/stop buttons
- **Restart**: Click the refresh button
- **Remove**: Click the trash button
- **Logs**: Click the terminal button to view container logs
- **Stats**: Click the expand button to view container statistics

### Application Templates
Templates are stored in `server/templates/` as YAML files. Each template defines:
- Container configuration
- Environment variables
- Volume mappings
- Network settings
- Traefik labels

## Application Categories

### Infrastructure
- **Traefik**: Reverse proxy and SSL termination
- **Homepage**: Dashboard for your services

### Security
- **Authentik**: Identity provider
- **Vaultwarden**: Password manager

### Media
- **Plex**: Media streaming server
- **Jellyfin**: Open source media system
- **Emby**: Personal media server
- **Overseerr**: Media request management

### Downloads
- **qBittorrent**: Torrent client
- **NZBGet**: Usenet downloader

### Storage
- **Syncthing**: File synchronization
- **Paperless-ngx**: Document management
- **Immich**: Photo management

### Monitoring
- **Uptime Kuma**: Service monitoring
- **Grafana**: Analytics and dashboards

### Automation
- **Sonarr**: TV show management
- **Radarr**: Movie management
- **Prowlarr**: Indexer management
- **Autoscan**: Media scanner

### Development
- **Gitea**: Git server

### Productivity
- **Nextcloud**: File sharing and collaboration
- **Joplin**: Note-taking

### Communication
- **Mailcow**: Email server
- **Rocket.Chat**: Team chat
- **Mattermost**: Collaboration platform
- **Matrix**: Decentralized chat

## Troubleshooting

### Common Issues

1. **Docker Socket Permission Denied**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```

2. **Port Conflicts**
   - Check for existing services using the same ports
   - Modify port mappings in docker-compose.yml

3. **Container Won't Start**
   - Check container logs: `docker logs [container_name]`
   - Verify environment variables
   - Check volume permissions

4. **Network Issues**
   - Ensure the proxy network exists: `docker network create proxy`
   - Verify Traefik is running
   - Check DNS resolution

### Logs
- Application logs: `docker logs homelabarr`
- Container logs: Available through the UI
- Server logs: Check `npm run dev` output

## Security Considerations

1. **Access Control**
   - Use Authentik for authentication
   - Implement strong passwords
   - Regularly update credentials

2. **Network Security**
   - Use SSL/TLS encryption
   - Configure firewall rules
   - Limit exposed ports

3. **Data Protection**
   - Regular backups
   - Secure volume permissions
   - Encrypt sensitive data

4. **Updates**
   - Keep containers updated
   - Monitor security advisories
   - Regular system updates

## FAQ

### General Questions

**Q: How do I update containers?**  
A: Click the restart button after pulling new images manually or use a tool like Watchtower.

**Q: Can I add custom applications?**  
A: Yes, add new YAML templates to `server/templates/`.

**Q: How do I backup my data?**  
A: Back up the mounted volumes and configuration directories.

### Technical Questions

**Q: What ports need to be open?**  
A: By default, 80 (HTTP) and 443 (HTTPS) for Traefik, plus any application-specific ports.

**Q: How do I change the theme?**  
A: Use the theme toggle in the top-right corner.

**Q: Can I use custom SSL certificates?**  
A: Yes, configure them in Traefik settings.

### Support

For additional support:
1. Check the GitHub issues
2. Join our community forums
3. Review the documentation
4. Submit a bug report