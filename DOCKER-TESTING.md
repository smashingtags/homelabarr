# Docker Testing Guide

## Pre-Flight Checklist ✅

Before running the Docker containers, ensure:

### System Requirements
- [ ] Docker Desktop is installed and running
- [ ] Docker Compose is available (`docker-compose --version`)
- [ ] Ports 8087 and 3009 are available
- [ ] At least 2GB RAM available
- [ ] 5GB free disk space
- [ ] Docker socket access configured (see Docker Socket Configuration below)

### Quick Test Commands

```powershell
# Test Docker
docker --version
docker info

# Test Docker Compose
docker-compose --version

# Check available ports
netstat -an | findstr ":8087"
netstat -an | findstr ":3009"
```

## Testing Steps

### Option 1: Automated Test (Recommended)
```powershell
# Run the automated test script
.\test-docker.ps1
```

### Option 2: Manual Testing
```powershell
# 1. Configure Docker socket access (if needed)
.\scripts\detect-docker-gid.ps1

# 2. Create environment file
copy .env.docker .env

# 3. Build and start containers
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# 4. Check container status
docker-compose ps

# 5. View logs
docker-compose logs -f
```

## Docker Socket Configuration

The backend container needs access to the Docker socket to manage containers. This is configured automatically, but you may need to adjust settings for your system.

### Windows (Docker Desktop)
```powershell
# Run the detection script
.\scripts\detect-docker-gid.ps1

# This will configure the DOCKER_GID in your .env file
```

### Linux
```bash
# Run the detection script
./scripts/detect-docker-gid.sh

# Or manually find your docker group ID
getent group docker | cut -d: -f3

# Set the environment variable
export DOCKER_GID=$(getent group docker | cut -d: -f3)
docker-compose up -d
```

### Manual Configuration
If the scripts don't work, you can manually set the Docker group ID in your `.env` file:

```bash
# Add to .env file
DOCKER_GID=999  # Replace with your system's docker group ID
DOCKER_SOCKET=/var/run/docker.sock
```

## Expected Results

### Successful Deployment
- ✅ Frontend accessible at http://localhost:8087
- ✅ Backend API at http://localhost:3009/health
- ✅ Both containers show "healthy" status
- ✅ Login page appears with authentication

### Health Check URLs
- Frontend: http://localhost:8087/health
- Backend: http://localhost:3009/health
- Full App: http://localhost:8087

### Default Credentials
- Username: `admin`
- Password: `admin`
- **⚠️ Change immediately after first login!**

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```powershell
   # Check what's using the ports
   netstat -ano | findstr ":8087"
   netstat -ano | findstr ":3009"
   ```

2. **Docker not running**
   ```powershell
   # Start Docker Desktop
   # Wait for Docker to fully start
   docker info
   ```

3. **Build failures**
   ```powershell
   # Clean build
   docker-compose down --volumes --remove-orphans
   docker system prune -f
   docker-compose build --no-cache
   ```

4. **Container startup issues**
   ```powershell
   # Check logs
   docker-compose logs backend
   docker-compose logs frontend
   ```

5. **Docker socket permission errors (EACCES)**
   ```powershell
   # Windows: Run the Docker GID detection script
   .\scripts\detect-docker-gid.ps1
   
   # Check if DOCKER_GID is set correctly in .env
   Get-Content .env | Select-String "DOCKER_GID"
   
   # Restart containers after fixing configuration
   docker-compose down
   docker-compose up -d
   ```

6. **Backend cannot access Docker**
   ```powershell
   # Check backend logs for Docker connection errors
   docker-compose logs backend | Select-String "docker\|EACCES\|permission"
   
   # Verify Docker socket is mounted correctly
   docker-compose exec backend ls -la /var/run/docker.sock
   
   # Test Docker access from within container
   docker-compose exec backend docker ps
   ```

### Debug Commands

```powershell
# Container status
docker-compose ps

# Live logs
docker-compose logs -f

# Execute commands in containers
docker-compose exec backend node -e "console.log('Backend OK')"
docker-compose exec frontend nginx -t

# Check internal networking
docker-compose exec backend ping homelabarr-frontend
docker-compose exec frontend ping homelabarr-backend
```

## Testing Authentication

1. **Access the app**: http://localhost:8087
2. **Click "Sign In"** in top right
3. **Use default credentials**: admin / admin
4. **Verify login success**: Should see user menu
5. **Test container operations**: Try viewing deployed apps
6. **Change password**: Settings → Change Password

## Performance Testing

```powershell
# Check resource usage
docker stats

# Test API endpoints
curl http://localhost:3009/health
curl http://localhost:3009/containers -H "Authorization: Bearer YOUR_TOKEN"
```

## Cleanup

```powershell
# Stop containers
docker-compose down

# Remove everything (including volumes)
docker-compose down --volumes --remove-orphans

# Clean up Docker system
docker system prune -f
```

## Success Criteria

- [ ] Both containers start successfully
- [ ] Health checks pass
- [ ] Frontend loads without errors
- [ ] Authentication works
- [ ] API endpoints respond correctly
- [ ] No critical errors in logs
- [ ] Resource usage is reasonable (<1GB RAM total)

## Next Steps After Successful Test

1. **Change default password**
2. **Configure environment variables** for production
3. **Set up reverse proxy** (optional)
4. **Configure backups** for user data
5. **Monitor logs** for any issues