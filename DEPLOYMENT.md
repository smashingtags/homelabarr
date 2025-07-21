# HomelabARR Deployment Guide

## Quick Start (Recommended)

### Using Docker Compose

1. **Clone the repository:**
   ```bash
   git clone https://github.com/smashingtags/homelabarr.git
   cd homelabarr
   ```

2. **Start the application:**
   ```bash
   docker compose up -d
   ```

3. **Access the application:**
   - Frontend: http://localhost:8087
   - Backend API: http://localhost:3009

## Production Deployment

### Prerequisites

- Docker Engine 20.10.0+
- Docker Compose v2.0.0+
- Linux host (recommended)
- Minimum 2GB RAM
- 10GB free disk space

### Environment Configuration

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables:**
   ```bash
   # Edit .env file
   NODE_ENV=production
   CORS_ORIGIN=https://your-domain.com
   
   # Authentication (recommended for production)
   AUTH_ENABLED=true
   JWT_SECRET=your-super-secret-jwt-key-change-this
   DEFAULT_ADMIN_PASSWORD=your-secure-admin-password
   ```

### First Time Setup

After deployment, you'll need to sign in:

1. **Access the application:** http://localhost:8087
2. **Click "Sign In"** in the top right
3. **Use default credentials:**
   - Username: `admin`
   - Password: `admin` (or your custom password)
4. **⚠️ IMMEDIATELY change the default password** via Settings → Change Password

### Authentication Features

- **Secure JWT-based authentication**
- **Role-based access control** (admin/user roles)
- **Password management** - users can change their own passwords
- **Session management** - automatic logout on token expiration
- **Admin user management** - create and manage users (coming soon)

### Security Considerations

#### Authentication Security
HomelabARR includes built-in authentication to protect your container management:

- **JWT-based authentication** with configurable expiration
- **Secure password hashing** using bcrypt
- **Role-based access control** (admin/user permissions)
- **Automatic session management** and token validation

#### Docker Socket Security
The application requires access to the Docker socket for container management. This is configured securely by:

- Using Docker group membership instead of privileged mode
- Restricting CORS origins in production
- Authentication required for all container operations
- Health checks for service monitoring

#### Network Security
- Frontend and backend communicate over internal Docker network
- Only necessary ports are exposed
- CORS is configured for specific origins only

### Monitoring & Health Checks

Both services include health checks:

- **Frontend**: HTTP check on port 80
- **Backend**: Docker connectivity check on `/health`

Monitor with:
```bash
docker compose ps
docker compose logs -f
```

### Backup & Data Persistence

Application data is stored in:
- Container configurations: `/app/data/`
- Docker volumes: Managed by deployed applications

**Backup strategy:**
```bash
# Backup application data
docker compose exec backend tar -czf /tmp/backup.tar.gz /app/data/

# Backup Docker volumes (for deployed apps)
docker run --rm -v homelabarr_data:/data -v $(pwd):/backup alpine tar -czf /backup/volumes-backup.tar.gz /data
```

### Troubleshooting

#### Common Issues

1. **Port conflicts:**
   - Check if ports 8087, 3009 are available
   - Use `netstat -tulpn | grep :8087` to check

2. **Docker socket permission denied:**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   # Or add user to docker group:
   sudo usermod -aG docker $USER
   ```

3. **Container won't start:**
   ```bash
   docker compose logs backend
   docker compose logs frontend
   ```

#### Health Check Commands

```bash
# Check backend health
curl http://localhost:3009/health

# Check frontend
curl http://localhost:8087

# Check Docker connectivity
docker compose exec backend node -e "console.log('Backend accessible')"
```

### Updating

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

### Performance Tuning

For production environments:

1. **Resource limits** (add to docker-compose.yml):
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             memory: 512M
             cpus: '0.5'
   ```

2. **Log rotation:**
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

## Development Setup

For development with hot reload:

```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

This starts:
- Frontend: http://localhost:8080
- Backend: http://localhost:3001

## Support

- GitHub Issues: [Report bugs](https://github.com/smashingtags/homelabarr/issues)
- Documentation: [Wiki](https://github.com/smashingtags/homelabarr/wiki)
- Discord: [Community chat](https://discord.gg/Pc7mXX786x)