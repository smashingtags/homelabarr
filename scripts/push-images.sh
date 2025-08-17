#!/bin/bash

# HomelabARR Docker Images Push Script
# This script pushes Docker images to GitHub Container Registry (GHCR)

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
VERSION=${VERSION:-"latest"}
REGISTRY="ghcr.io"
NAMESPACE="smashingtags"
FRONTEND_IMAGE="${REGISTRY}/${NAMESPACE}/homelabarr-frontend"
BACKEND_IMAGE="${REGISTRY}/${NAMESPACE}/homelabarr-backend"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   HomelabARR Docker Image Pusher      ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Push Configuration:${NC}"
echo -e "  Registry: ${REGISTRY}"
echo -e "  Namespace: ${NAMESPACE}"
echo -e "  Version: ${VERSION}"
echo ""

# Check if images exist locally
echo -e "${BLUE}Verifying local images...${NC}"

if ! docker images "${FRONTEND_IMAGE}" | grep -q "${VERSION}"; then
    echo -e "${RED}❌ Frontend image ${FRONTEND_IMAGE}:${VERSION} not found locally${NC}"
    echo -e "${YELLOW}Run ./scripts/build-images.sh first${NC}"
    exit 1
fi

if ! docker images "${BACKEND_IMAGE}" | grep -q "${VERSION}"; then
    echo -e "${RED}❌ Backend image ${BACKEND_IMAGE}:${VERSION} not found locally${NC}"
    echo -e "${YELLOW}Run ./scripts/build-images.sh first${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Local images verified${NC}"
echo ""

# Check GHCR authentication
echo -e "${BLUE}Checking GHCR authentication...${NC}"

# Try to login to GHCR (user should have already set up token)
if ! docker info | grep -q "Username.*"; then
    echo -e "${YELLOW}⚠️  Docker not logged in to any registry${NC}"
    echo -e "${YELLOW}Make sure you're logged in to GHCR:${NC}"
    echo -e "  ${BLUE}echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin${NC}"
    echo ""
fi

# Test GHCR connectivity
echo -e "Testing GHCR connectivity..."
if docker pull hello-world >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker registry connectivity verified${NC}"
else
    echo -e "${YELLOW}⚠️  Docker registry connectivity test inconclusive${NC}"
fi
echo ""

# Push frontend image
echo -e "${BLUE}Pushing frontend image...${NC}"
echo -e "${YELLOW}Pushing: ${FRONTEND_IMAGE}:${VERSION}${NC}"

docker push "${FRONTEND_IMAGE}:${VERSION}"
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Frontend image ${VERSION} pushed successfully${NC}"
else
    echo -e "${RED}❌ Failed to push frontend image ${VERSION}${NC}"
    exit 1
fi

# Push frontend latest tag if version is not latest
if [[ "${VERSION}" != "latest" ]]; then
    echo -e "${YELLOW}Pushing: ${FRONTEND_IMAGE}:latest${NC}"
    docker push "${FRONTEND_IMAGE}:latest"
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Frontend image latest pushed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to push frontend image latest${NC}"
        exit 1
    fi
fi
echo ""

# Push backend image
echo -e "${BLUE}Pushing backend image...${NC}"
echo -e "${YELLOW}Pushing: ${BACKEND_IMAGE}:${VERSION}${NC}"

docker push "${BACKEND_IMAGE}:${VERSION}"
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Backend image ${VERSION} pushed successfully${NC}"
else
    echo -e "${RED}❌ Failed to push backend image ${VERSION}${NC}"
    exit 1
fi

# Push backend latest tag if version is not latest
if [[ "${VERSION}" != "latest" ]]; then
    echo -e "${YELLOW}Pushing: ${BACKEND_IMAGE}:latest${NC}"
    docker push "${BACKEND_IMAGE}:latest"
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Backend image latest pushed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to push backend image latest${NC}"
        exit 1
    fi
fi
echo ""

# Verify pushed images
echo -e "${BLUE}Verifying pushed images...${NC}"

# Note: We can't easily verify the remote images without additional tools
# This is a placeholder for future enhancement
echo -e "${YELLOW}Note: Remote image verification requires additional tooling${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Push completed successfully!        ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Pushed Images:${NC}"
echo -e "  ${FRONTEND_IMAGE}:${VERSION}"
if [[ "${VERSION}" != "latest" ]]; then
    echo -e "  ${FRONTEND_IMAGE}:latest"
fi
echo -e "  ${BACKEND_IMAGE}:${VERSION}"
if [[ "${VERSION}" != "latest" ]]; then
    echo -e "  ${BACKEND_IMAGE}:latest"
fi
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update homelabarr.yml with new image tags (if not using latest)"
echo -e "2. Deploy: ${BLUE}docker-compose -f homelabarr.yml up -d${NC}"
echo -e "3. Verify deployment: ${BLUE}docker-compose -f homelabarr.yml ps${NC}"
echo ""
echo -e "${YELLOW}Public Registry URLs:${NC}"
echo -e "  Frontend: https://github.com/smashingtags/homelabarr-cli/pkgs/container/homelabarr-frontend"
echo -e "  Backend:  https://github.com/smashingtags/homelabarr-cli/pkgs/container/homelabarr-backend"