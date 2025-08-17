#!/bin/bash

# HomelabARR Deployment Script
# This script provides easy deployment options for HomelabARR

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_MODE=${1:-"development"}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     HomelabARR Deployment Script      ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Display usage information
show_usage() {
    echo -e "${YELLOW}Usage: $0 [deployment_mode]${NC}"
    echo ""
    echo -e "${YELLOW}Deployment Modes:${NC}"
    echo -e "  ${GREEN}development${NC}  - Local development with hot reload (default)"
    echo -e "  ${GREEN}build${NC}        - Build and run containers locally"
    echo -e "  ${GREEN}production${NC}   - Production deployment with security features"
    echo -e "  ${GREEN}ghcr${NC}         - Deploy using pre-built GHCR images"
    echo -e "  ${GREEN}stop${NC}         - Stop all running containers"
    echo -e "  ${GREEN}clean${NC}        - Stop containers and remove volumes"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  $0 development    # Start development environment"
    echo -e "  $0 production     # Deploy in production mode"
    echo -e "  $0 ghcr          # Deploy using GHCR images"
    echo -e "  $0 stop          # Stop all containers"
    echo ""
}

# Validate deployment mode
case "$DEPLOYMENT_MODE" in
    "development"|"build"|"production"|"ghcr"|"stop"|"clean"|"help"|"-h"|"--help")
        ;;
    *)
        echo -e "${RED}❌ Invalid deployment mode: $DEPLOYMENT_MODE${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac

# Show help if requested
if [[ "$DEPLOYMENT_MODE" == "help" || "$DEPLOYMENT_MODE" == "-h" || "$DEPLOYMENT_MODE" == "--help" ]]; then
    show_usage
    exit 0
fi

# Change to project directory
cd "$PROJECT_DIR"

echo -e "${YELLOW}Deployment Configuration:${NC}"
echo -e "  Mode: ${CYAN}${DEPLOYMENT_MODE}${NC}"
echo -e "  Project Dir: ${PROJECT_DIR}"
echo -e "  Docker Status: $(docker --version 2>/dev/null || echo 'Not available')"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker Compose is not available${NC}"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites satisfied${NC}"
}

# Function to stop containers
stop_containers() {
    echo -e "${BLUE}Stopping containers...${NC}"
    
    # Try multiple compose files
    COMPOSE_FILES=("docker-compose.yml" "docker-compose.prod.yml" "homelabarr.yml")
    
    for compose_file in "${COMPOSE_FILES[@]}"; do
        if [[ -f "$compose_file" ]]; then
            echo -e "Stopping containers from $compose_file..."
            docker-compose -f "$compose_file" down 2>/dev/null || docker compose -f "$compose_file" down 2>/dev/null || true
        fi
    done
    
    # Stop individual containers if they exist
    CONTAINERS=("homelabarr-frontend" "homelabarr-backend" "homelabarr-frontend-prod" "homelabarr-backend-prod")
    for container in "${CONTAINERS[@]}"; do
        if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
            echo -e "Stopping container: $container"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ Containers stopped${NC}"
}

# Function to clean up
clean_environment() {
    echo -e "${BLUE}Cleaning environment...${NC}"
    
    stop_containers
    
    # Remove volumes
    VOLUMES=("homelabarr-data" "homelabarr-prod-data" "homelabarr-prod-logs")
    for volume in "${VOLUMES[@]}"; do
        if docker volume ls --format "{{.Name}}" | grep -q "^${volume}$"; then
            echo -e "Removing volume: $volume"
            docker volume rm "$volume" 2>/dev/null || true
        fi
    done
    
    # Remove networks
    NETWORKS=("homelabarr" "homelabarr-prod")
    for network in "${NETWORKS[@]}"; do
        if docker network ls --format "{{.Name}}" | grep -q "^${network}$"; then
            echo -e "Removing network: $network"
            docker network rm "$network" 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ Environment cleaned${NC}"
}

# Main deployment logic
case "$DEPLOYMENT_MODE" in
    "stop")
        check_prerequisites
        stop_containers
        ;;
    
    "clean")
        check_prerequisites
        clean_environment
        ;;
    
    "development")
        check_prerequisites
        echo -e "${BLUE}Starting development environment...${NC}"
        
        # Copy development environment
        if [[ -f ".env.development" ]]; then
            cp .env.development .env
            echo -e "${GREEN}✅ Development environment configured${NC}"
        fi
        
        # Start development containers
        docker-compose up -d
        
        echo ""
        echo -e "${GREEN}✅ Development environment started${NC}"
        echo -e "${YELLOW}Services:${NC}"
        echo -e "  Frontend: ${BLUE}http://localhost:8084${NC}"
        echo -e "  Backend:  ${BLUE}http://localhost:8092${NC}"
        echo -e "  Health:   ${BLUE}http://localhost:8092/health${NC}"
        ;;
    
    "build")
        check_prerequisites
        echo -e "${BLUE}Building and starting containers locally...${NC}"
        
        # Stop existing containers
        stop_containers
        
        # Build and start
        docker-compose up --build -d
        
        echo ""
        echo -e "${GREEN}✅ Local build deployment started${NC}"
        echo -e "${YELLOW}Services:${NC}"
        echo -e "  Frontend: ${BLUE}http://localhost:8084${NC}"
        echo -e "  Backend:  ${BLUE}http://localhost:8092${NC}"
        ;;
    
    "production")
        check_prerequisites
        echo -e "${BLUE}Starting production deployment...${NC}"
        
        # Validate production environment
        if [[ -f ".env.production" ]]; then
            cp .env.production .env
            echo -e "${GREEN}✅ Production environment configured${NC}"
        else
            echo -e "${RED}❌ .env.production file not found${NC}"
            exit 1
        fi
        
        # Check required production variables
        source .env
        REQUIRED_VARS=("JWT_SECRET" "DEFAULT_ADMIN_PASSWORD" "CORS_ORIGIN")
        for var in "${REQUIRED_VARS[@]}"; do
            if [[ -z "${!var}" || "${!var}" == *"CHANGE"* ]]; then
                echo -e "${RED}❌ Required production variable not set or contains default value: $var${NC}"
                exit 1
            fi
        done
        
        # Stop existing containers
        stop_containers
        
        # Start production containers
        docker-compose -f docker-compose.prod.yml up -d
        
        echo ""
        echo -e "${GREEN}✅ Production deployment started${NC}"
        echo -e "${YELLOW}Services:${NC}"
        echo -e "  Frontend: ${BLUE}http://localhost:8084${NC}"
        echo -e "  Backend:  ${BLUE}http://localhost:8092${NC}"
        ;;
    
    "ghcr")
        check_prerequisites
        echo -e "${BLUE}Deploying using GHCR images...${NC}"
        
        # Stop existing containers
        stop_containers
        
        # Pull latest images
        echo -e "Pulling latest images from GHCR..."
        docker pull ghcr.io/smashingtags/homelabarr-frontend:latest
        docker pull ghcr.io/smashingtags/homelabarr-backend:latest
        
        # Start using GHCR images
        docker-compose -f homelabarr.yml up -d
        
        echo ""
        echo -e "${GREEN}✅ GHCR deployment started${NC}"
        echo -e "${YELLOW}Services:${NC}"
        echo -e "  Frontend: ${BLUE}http://localhost:8084${NC}"
        echo -e "  Backend:  ${BLUE}http://localhost:8092${NC}"
        ;;
esac

# Show deployment status if not stopping/cleaning
if [[ "$DEPLOYMENT_MODE" != "stop" && "$DEPLOYMENT_MODE" != "clean" ]]; then
    echo ""
    echo -e "${BLUE}Deployment Status:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep homelabarr || echo "No HomelabARR containers running"
    echo ""
    echo -e "${YELLOW}Monitor logs:${NC}"
    echo -e "  All services: ${BLUE}docker-compose logs -f${NC}"
    echo -e "  Backend only: ${BLUE}docker logs -f homelabarr-backend${NC}"
    echo -e "  Frontend only: ${BLUE}docker logs -f homelabarr-frontend${NC}"
fi