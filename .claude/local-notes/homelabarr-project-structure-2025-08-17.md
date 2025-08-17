# HomelabARR Project Structure & Naming Convention

**Date**: 2025-08-17  
**Context**: Repository structure clarification and naming conventions

## Repository Structure

### Main Repositories
1. **homelabarr-cli** - Core CLI application with Docker containers and scripts
   - Contains the main infrastructure (apps/, scripts/, traefik/)
   - Used to be called "dockserver" - ALL REFERENCES UPDATED
   - Mount point in containers: `/homelabarr-cli`
   - CLI Bridge path: `../../../homelabarr-cli`

2. **homelabarr** - Web interface application (React frontend + Node.js backend)
   - Frontend: React application for container management
   - Backend: Node.js with CLI Bridge integration
   - Docker images: `ghcr.io/smashingtags/homelabarr-frontend` and `ghcr.io/smashingtags/homelabarr-backend`

3. **homelabarr-site** - Official website repository for homelabarr.com
   - NOT related to the container management system
   - Separate marketing/documentation website

### Additional Assets
- **local-persist-homelabarr-containers** - Container persistence layer
- **homelabarr-assets** - Shared assets and resources

## Important Naming Rules

### What We NO LONGER Call "dockserver"
- ❌ dockserver (old name)
- ✅ homelabarr-cli (new name)

### Docker Mount Points
- Container internal path: `/homelabarr-cli`
- Host mount example: `/opt/homelabarr-cli:/homelabarr-cli:rw`
- CLI_BRIDGE_PATH environment variable: `/homelabarr-cli`

### Environment Variables
- CLI_BRIDGE_HOST_PATH: Points to host system's homelabarr-cli installation
- CLI_BRIDGE_PATH: Internal container path `/homelabarr-cli`

## Integration Architecture

```
homelabarr (web UI) 
    ↓ (CLI Bridge)
homelabarr-cli (core infrastructure)
    ↓ (manages)
Docker containers (100+ applications)
```

## Recent Updates (2025-08-17)
- Updated all dockserver references to homelabarr-cli in:
  - Dockerfile.backend mount points
  - homelabarr.yml deployment configuration  
  - GitHub Actions deployment documentation
  - cli-bridge.js path resolution
  - Environment variable naming

## Key Takeaways
- homelabarr-site = website only, NOT container management
- homelabarr-cli = core infrastructure (was dockserver)
- homelabarr = web interface for managing homelabarr-cli
- Always use homelabarr-cli naming in technical implementations