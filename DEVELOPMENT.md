# Development Documentation

## Project Overview
Homelabarr is a web-based Docker container management system designed to simplify the deployment and management of self-hosted applications in a home lab environment.

## Technical Stack
- Frontend: React + TypeScript + Vite
- UI Framework: Tailwind CSS
- Icons: Lucide React
- Backend: Express.js
- Container Management: Dockerode
- Configuration Format: YAML

## Docker Setup

### Prerequisites
- Docker Engine (Linux/macOS) or Docker Desktop (Windows)
- Docker Compose v2
- Node.js 18 or higher (for development)

### Docker Socket Permissions
For Unix-based systems (Linux/macOS), you need to set the correct permissions for the Docker socket:

```bash
# Set socket permissions
sudo chmod 666 /var/run/docker.sock

# Make it persistent via systemd
sudo mkdir -p /etc/systemd/system/docker.service.d/
echo '[Service]
ExecStartPost=/bin/chmod 666 /var/run/docker.sock
' | sudo tee /etc/systemd/system/docker.service.d/override.conf

sudo systemctl daemon-reload
sudo systemctl restart docker
```

### Platform-Specific Configuration

#### Windows
1. Install Docker Desktop
2. Enable WSL 2 backend
3. In Docker Desktop settings:
   - Enable "Expose daemon on tcp://localhost:2375 without TLS"
   - Apply & Restart

#### Unix (Linux/macOS)
1. Install Docker Engine
2. Configure permissions:
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   
   # Set socket permissions
   sudo chmod 666 /var/run/docker.sock
   ```

## Development Environment

### Start Frontend Development Server
```bash
npm run dev
```
- Runs Vite dev server on port 5173
- Hot module replacement enabled

### Backend Development
- Express server runs on port 3001
- Auto-restarts on file changes
- Concurrent running with frontend using concurrently

### Docker Development

#### Building Images
```bash
# Frontend
docker build -t homelabarr-frontend .

# Backend
docker build -f Dockerfile.backend -t homelabarr-backend .
```

#### Running Containers
```bash
# Using Docker Compose
docker compose up -d

# Or manually
docker run -d --name homelabarr-frontend -p 80:80 homelabarr-frontend
docker run -d --name homelabarr-backend -p 3001:3001 -v /var/run/docker.sock:/var/run/docker.sock --group-add 999 homelabarr-backend
```

## Architecture

### Frontend (Port 5173)
- React application with TypeScript
- Component-based architecture
- State management using React hooks
- Responsive design with Tailwind CSS
- Modal-based deployment configuration

### Backend (Port 3001)
- Express.js server
- Docker socket integration via Dockerode
- REST API endpoints:
  - GET /containers - List all containers
  - POST /deploy - Deploy new container
  - DELETE /containers/:id - Remove container

### Docker Integration
- Uses Docker socket for container management
- Template-based container deployment
- YAML configuration for container templates
- Environment variable substitution in templates

## Key Features

1. Container Management
   - List all containers
   - Deploy new containers
   - Remove containers
   - Monitor container status

2. Application Templates
   - Predefined templates for popular applications
   - Customizable configuration fields
   - Category-based organization

3. Security Considerations
   - Docker socket access required
   - CORS configuration for local development
   - Environment variable management

## API Endpoints

### GET /containers
Returns list of all Docker containers with their status.

### POST /deploy
Deploys a new container based on template and configuration.
```json
{
  "appId": "string",
  "config": {
    "key": "value"
  }
}
```

### DELETE /containers/:id
Removes a container by ID.

## Environment Variables
- PORT: Backend server port (default: 3001)
- DOCKER_SOCKET: Docker socket path (default: /var/run/docker.sock)
- CORS_ORIGIN: Allowed CORS origin (default: http://localhost:5173)

## Future Considerations
1. Authentication and Authorization
2. Container logs viewing
3. Container resource monitoring
4. Backup and restore functionality
5. Multi-node support
6. Template versioning

## Known Issues
1. Docker socket permissions may require configuration
2. Template variables need validation
3. Error handling needs improvement
4. No persistent storage for container configurations

## Contributing
1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request
4. Follow the existing code style
5. Add tests for new features

## Testing
Currently manual testing only. Future plans include:
- Unit tests for React components
- API endpoint testing
- Integration tests for Docker operations