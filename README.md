# Homelabarr

A beautiful, modern web interface for managing your home lab Docker containers. Homelabarr makes it easy to deploy and manage self-hosted applications with just a few clicks.

![Status](https://img.shields.io/badge/Status-Production%20Ready-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
## Features
- 🚀 One-click application deployment
- 🔄 Container management (start, stop, restart, remove)
- 📊 Real-time container statistics
- 📝 Live container logs
- 🏆 Uptime tracking and achievements
- 🌙 Dark/Light theme support
- 🔍 Search and filter applications
- 🏷️ Category-based organization
- 🔒 Optional Authentik integration with per-application control
- 🌐 Flexible deployment modes (standard or Traefik)

## Deployment Modes

Homelabarr supports two deployment modes with optional authentication:

1. **Standard Mode**
   - Direct port mapping
   - Suitable for standalone deployments
   - No reverse proxy required

2. **Traefik Mode**
   - Automatic Traefik integration
   - SSL/TLS support via Let's Encrypt
   - Domain-based routing
   - Optional per-application Authentik authentication
     - Choose which applications require authentication
     - Seamless SSO integration when enabled
     - Easy toggle in deployment interface


## 📋 Prerequisites

- Docker Engine 20.10.0 or higher
- Docker Compose v2.0.0 or higher
- Node.js 18 or higher (for development)

## 🛠️ Installation

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/smashingtags/homelabarr.git
cd homelabarr

# Create environment file
cp .env.example .env

# Edit the environment file with your settings
nano .env

# Start the application
docker compose up -d
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/smashingtags/homelabarr.git
cd homelabarr

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Security
AUTH_TOKEN=your-secure-token-here
CORS_ORIGIN=https://your-domain.com

# Docker Configuration
DOCKER_SOCKET=/var/run/docker.sock
```

### Docker Socket Permissions

For Unix-based systems, ensure proper Docker socket permissions:

```bash
sudo chmod 666 /var/run/docker.sock
```

## 🎯 Special Features

### Achievement System
- Track container uptime with achievements
- Achievement levels:
  - Starting (up to 24 hours)
  - Bronze (24+ hours)
  - Silver (7+ days)
  - Gold (30+ days)
  - Platinum (90+ days)
  - Diamond (365+ days)
- Leaderboard showing top performing containers

### Container Statistics
- Real-time CPU usage monitoring
- Memory usage tracking
- Network traffic monitoring
- Detailed uptime tracking
- Historical performance data

### Deployment Options
- Standard deployment with direct port mapping
- Traefik integration for reverse proxy
- Optional Authentik authentication
- Automatic volume path creation
- Port conflict detection

### Container Management
- Live container logs with auto-refresh
- One-click container controls
- Health status monitoring
- Resource usage alerts
- Batch operations support

## 🔌 API Reference

### Authentication

All API endpoints require authentication using the `AUTH_TOKEN` header.

### Endpoints

#### GET /containers
Returns a list of all Docker containers with their status and statistics.

**Response:**
```json
[
  {
    "id": "container_id",
    "name": "container_name",
    "status": "running",
    "stats": {
      "cpu": 2.5,
      "memory": {
        "usage": 100000000,
        "limit": 1000000000,
        "percentage": 10
      },
      "network": {
        "rx_bytes": 1000,
        "tx_bytes": 2000
      },
      "uptime": 86400
    }
  }
]
```

#### POST /deploy
Deploy a new container based on a template.

**Request Body:**
```json
{
  "appId": "string",
  "config": {
    "key": "value"
  },
  "mode": {
    "type": "standard|traefik",
    "useAuthentik": boolean
  }
}
```

**Response:**
```json
{
  "success": true,
  "containerId": "string"
}
```

#### DELETE /containers/:id
Remove a container by ID.

**Response:**
```json
{
  "success": true
}
```

## 🎨 Supported Applications

### Infrastructure
- Traefik (Reverse Proxy)
- Homepage (Dashboard)
- Fenrus (Dashboard)
- Heimdall (Application Dashboard)

### Security
- Authelia (Authentication)
- Authentik (Identity Provider)
- Vaultwarden (Password Manager)

### Media
- Plex (Media Server)
- Jellyfin (Media Server)
- Emby (Media Server)
- Overseerr (Request Management)

### Downloads
- qBittorrent (Torrent Client)
- NZBGet (Usenet Client)

### Storage
- Nextcloud (File Sharing)
- Syncthing (File Sync)
- Paperless-ngx (Document Management)
- Immich (Photo Management)

### Monitoring
- Uptime Kuma (Status Monitor)
- Grafana (Analytics)
- Netdata (Performance Monitor)
- Glances (System Monitor)

### Development
- Gitea (Git Server)
- Dockge (Container Management)
- Cloud Commander (File Manager)
- IT Tools (Developer Utilities)

### Communication
- Rocket.Chat (Team Chat)
- Matrix (Decentralized Chat)
- Mattermost (Team Collaboration)
- Mailcow (Email Server)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Docker](https://www.docker.com/)
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

## 📞 Support

- Create an [Issue](https://github.com/smashingtags/homelabarr/issues)
- Join our [Discord](https://discord.gg/your-server)
- Check the [Wiki](https://github.com/smashingtags/homelabarr/wiki)