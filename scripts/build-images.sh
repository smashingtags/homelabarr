#!/bin/bash

# HomelabARR Docker Images Build Script
# This script builds optimized Docker images for both frontend and backend

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION=${VERSION:-"latest"}

# Registry configuration
REGISTRY="ghcr.io"
NAMESPACE="smashingtags"
FRONTEND_IMAGE="${REGISTRY}/${NAMESPACE}/homelabarr-frontend"
BACKEND_IMAGE="${REGISTRY}/${NAMESPACE}/homelabarr-backend"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   HomelabARR Docker Image Builder     ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Build Configuration:${NC}"
echo -e "  Project Dir: ${PROJECT_DIR}"
echo -e "  Version: ${VERSION}"
echo -e "  Git Commit: ${GIT_COMMIT}"
echo -e "  Build Date: ${BUILD_DATE}"
echo -e "  Registry: ${REGISTRY}"
echo ""

# Change to project directory
cd "$PROJECT_DIR"

# Verify required files exist
echo -e "${BLUE}Validating build environment...${NC}"
REQUIRED_FILES=(
    "Dockerfile"
    "Dockerfile.backend"
    "package.json"
    "src"
    "server"
    "nginx.conf"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -e "$file" ]]; then
        echo -e "${RED}❌ Required file/directory not found: $file${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ Build environment validated${NC}"
echo ""

# Build frontend image
echo -e "${BLUE}Building frontend image...${NC}"
echo -e "${YELLOW}Image: ${FRONTEND_IMAGE}:${VERSION}${NC}"

docker build \
    --file Dockerfile \
    --tag "${FRONTEND_IMAGE}:${VERSION}" \
    --tag "${FRONTEND_IMAGE}:latest" \
    --label "org.opencontainers.image.title=HomelabARR Frontend" \
    --label "org.opencontainers.image.description=React frontend for HomelabARR CLI container management" \
    --label "org.opencontainers.image.vendor=HomelabARR CLI" \
    --label "org.opencontainers.image.version=${VERSION}" \
    --label "org.opencontainers.image.revision=${GIT_COMMIT}" \
    --label "org.opencontainers.image.created=${BUILD_DATE}" \
    --label "org.opencontainers.image.source=https://github.com/smashingtags/homelabarr-cli" \
    --label "org.opencontainers.image.licenses=MIT" \
    --build-arg NODE_ENV=production \
    .

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Frontend image built successfully${NC}"
else
    echo -e "${RED}❌ Frontend image build failed${NC}"
    exit 1
fi
echo ""

# Build backend image
echo -e "${BLUE}Building backend image...${NC}"
echo -e "${YELLOW}Image: ${BACKEND_IMAGE}:${VERSION}${NC}"

docker build \
    --file Dockerfile.backend \
    --tag "${BACKEND_IMAGE}:${VERSION}" \
    --tag "${BACKEND_IMAGE}:latest" \
    --label "org.opencontainers.image.title=HomelabARR Backend" \
    --label "org.opencontainers.image.description=Node.js backend with CLI Bridge for HomelabARR container management" \
    --label "org.opencontainers.image.vendor=HomelabARR CLI" \
    --label "org.opencontainers.image.version=${VERSION}" \
    --label "org.opencontainers.image.revision=${GIT_COMMIT}" \
    --label "org.opencontainers.image.created=${BUILD_DATE}" \
    --label "org.opencontainers.image.source=https://github.com/smashingtags/homelabarr-cli" \
    --label "org.opencontainers.image.licenses=MIT" \
    --build-arg NODE_ENV=production \
    .

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Backend image built successfully${NC}"
else
    echo -e "${RED}❌ Backend image build failed${NC}"
    exit 1
fi
echo ""

# Display image information
echo -e "${BLUE}Build Summary:${NC}"
echo -e "${GREEN}Frontend Image:${NC}"
docker images "${FRONTEND_IMAGE}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
echo ""
echo -e "${GREEN}Backend Image:${NC}"
docker images "${BACKEND_IMAGE}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
echo ""

# Test image functionality
echo -e "${BLUE}Testing images...${NC}"

# Test frontend image
echo -e "Testing frontend image health..."
FRONTEND_TEST=$(docker run --rm --detach --publish 18080:8080 "${FRONTEND_IMAGE}:${VERSION}")
sleep 5
if curl -f http://localhost:18080/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend image health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend image health check failed (may be expected without backend)${NC}"
fi
docker stop "$FRONTEND_TEST" >/dev/null 2>&1

# Note about backend testing
echo -e "${YELLOW}Note: Backend testing requires Docker socket access and CLI Bridge mount${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Build completed successfully!       ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Test images locally: ${BLUE}docker-compose -f homelabarr.yml up -d${NC}"
echo -e "2. Push to registry: ${BLUE}./scripts/push-images.sh${NC}"
echo -e "3. Deploy in production: ${BLUE}docker-compose -f homelabarr.yml up -d${NC}"
echo ""
echo -e "${YELLOW}Image Tags:${NC}"
echo -e "  ${FRONTEND_IMAGE}:${VERSION}"
echo -e "  ${FRONTEND_IMAGE}:latest"
echo -e "  ${BACKEND_IMAGE}:${VERSION}"
echo -e "  ${BACKEND_IMAGE}:latest"