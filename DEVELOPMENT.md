# Development Documentation

## Project Overview
HomelabARR Enhanced is a revolutionary CLI-based Docker container management system with modern web interface. It provides real Docker deployment capabilities through a CLI-based architecture that bypasses socket compatibility issues.

## Technical Stack
- Frontend: React + TypeScript + Vite
- UI Framework: Tailwind CSS
- Icons: Lucide React
- Backend: Express.js
- Container Management: CLI-based Docker integration (bypasses dockerode limitations)
- CLI Bridge: Custom Docker CLI wrapper for reliable cross-platform operations
- Configuration Format: YAML templates from HomelabARR CLI ecosystem

## Docker Setup

### Prerequisites
- Docker Engine (Linux/macOS) or Docker Desktop (Windows)
- Docker CLI (for CLI-based operations)
- Node.js 18 or higher (for development)
- Git (for accessing HomelabARR CLI templates)

### CLI-Based Architecture Benefits
Our enhanced architecture uses Docker CLI commands instead of socket connections to solve:
- ✅ Windows named pipe compatibility issues
- ✅ Docker Desktop permission complexities  
- ✅ Cross-platform socket access limitations
- ✅ Reliable container deployment across all environments

### Platform-Specific Setup

#### Windows
1. Install Docker Desktop
2. Ensure Docker CLI is in PATH
3. Enable containers feature in Windows if needed
4. No special socket permissions required (CLI-based)

#### Unix (Linux/macOS)
1. Install Docker Engine
2. Add user to docker group: `sudo usermod -aG docker $USER`
3. Restart session or run: `newgrp docker`
4. Verify CLI access: `docker ps`

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

### CLI-Based Development

#### Building Images
```bash
# Frontend
docker build -t homelabarr-frontend .

# Backend (with CLI integration)
docker build -f Dockerfile.backend -t homelabarr-backend .
```

#### Running Containers
```bash
# Using Docker Compose (recommended)
docker compose up -d

# Development mode with CLI access
docker compose -f docker-compose.yml up -d
```

#### CLI Integration Features
- Direct Docker CLI command execution
- No socket permission issues
- Cross-platform compatibility
- Integration with HomelabARR CLI ecosystem
- Real container deployment capabilities

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