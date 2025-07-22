#!/bin/bash

# Script to detect Docker group ID for proper container configuration
# This helps ensure the homelabarr-backend container can access Docker socket

echo "Detecting Docker group configuration..."

# Check if docker group exists
if getent group docker >/dev/null 2>&1; then
    DOCKER_GID=$(getent group docker | cut -d: -f3)
    echo "Docker group found with GID: $DOCKER_GID"
    
    # Check if current user is in docker group
    if groups $USER | grep -q docker; then
        echo "✓ Current user ($USER) is in docker group"
    else
        echo "⚠ Current user ($USER) is NOT in docker group"
        echo "  Add user to docker group with: sudo usermod -aG docker $USER"
        echo "  Then log out and back in for changes to take effect"
    fi
    
    # Update .env file if it exists
    if [ -f .env ]; then
        if grep -q "DOCKER_GID=" .env; then
            sed -i "s/DOCKER_GID=.*/DOCKER_GID=$DOCKER_GID/" .env
            echo "✓ Updated DOCKER_GID in .env file to $DOCKER_GID"
        else
            echo "DOCKER_GID=$DOCKER_GID" >> .env
            echo "✓ Added DOCKER_GID=$DOCKER_GID to .env file"
        fi
    else
        echo "⚠ .env file not found. Create one from .env.example and set DOCKER_GID=$DOCKER_GID"
    fi
    
    echo ""
    echo "To use this configuration with docker-compose:"
    echo "  export DOCKER_GID=$DOCKER_GID"
    echo "  docker-compose up -d"
    echo ""
    echo "Or set it inline:"
    echo "  DOCKER_GID=$DOCKER_GID docker-compose up -d"
    
else
    echo "❌ Docker group not found on this system"
    echo "   Make sure Docker is installed and the docker group exists"
    exit 1
fi