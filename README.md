# Homelabarr

A beautiful, modern web interface for managing your home lab Docker containers. Homelabarr makes it easy to deploy and manage self-hosted applications with just a few clicks.

![Status](https://img.shields.io/badge/Status-Production%20Ready-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## ✨ Features

- 🎯 One-click deployment of popular self-hosted applications
- 🔄 Easy container management (start, stop, remove)
- 📊 Real-time container statistics and monitoring
- 🏆 Achievement system for container uptime
- 🎨 Beautiful, intuitive user interface
- 📱 Responsive design that works on all devices
- 🌙 Dark mode support
- 🔒 Secure configuration management
- 🚀 Support for various applications:
  - Media servers (Plex, Jellyfin, Emby)
  - Download clients (qBittorrent, NZBGet)
  - Management tools (Traefik)
  - And many more!

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository
```bash
git clone https://github.com/yourusername/homelabarr.git
cd homelabarr
```

2. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Start the application
```bash
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost
- Backend API: http://localhost:3001

### Manual Installation (Development)

1. Clone the repository
```bash
git clone https://github.com/yourusername/homelabarr.git
cd homelabarr
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

## 🛠️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

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

Ensure the Docker socket is accessible:
```bash
sudo chmod 666 /var/run/docker.sock
```

## 🔒 Security

- All communication with the backend is secured
- Rate limiting prevents abuse
- Helmet.js provides security headers
- CORS protection enabled
- Container isolation through Docker
- Regular security updates

## 📦 Application Categories

- **Infrastructure**: Core services (Traefik, Homepage)
- **Security**: Authentication and password management
- **Media**: Streaming servers (Plex, Jellyfin, Emby)
- **Downloads**: Torrent and Usenet clients
- **Storage**: File sync and document management
- **Monitoring**: System and service monitoring
- **Automation**: Media automation tools
- **Development**: Development tools
- **Productivity**: Notes and collaboration
- **Communication**: Chat and email servers

## 🔧 Development

### Prerequisites
- Node.js 18 or higher
- Docker and Docker Compose
- Git

### Development Server
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Running Tests
```bash
npm run test
```

## 📝 API Documentation

The backend API provides endpoints for:

- `GET /containers` - List all containers
- `POST /deploy` - Deploy new container
- `DELETE /containers/:id` - Remove container
- `POST /containers/:id/start` - Start container
- `POST /containers/:id/stop` - Stop container
- `POST /containers/:id/restart` - Restart container
- `GET /containers/:id/logs` - Get container logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a Pull Request

Please follow our coding standards and include tests for new features.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [Docker](https://www.docker.com/)
- All our amazing contributors!

## 🐛 Troubleshooting

### Common Issues

1. **Docker socket permission denied**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```

2. **Port conflicts**
   - Check for existing services using the same ports
   - Modify port mappings in docker-compose.yml

3. **Container won't start**
   - Check container logs: `docker logs [container_name]`
   - Verify environment variables
   - Check volume permissions

4. **Network issues**
   - Ensure the proxy network exists
   - Verify Traefik is running
   - Check DNS resolution

## 📞 Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Check the [HELP.md](HELP.md) file
- Community: Join our Discord server