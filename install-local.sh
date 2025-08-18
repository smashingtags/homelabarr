#!/bin/bash

# HomelabARR Local Installation Script - Container Version
# This script installs the containerized HomelabARR web interface
# which provides a GUI for managing HomelabARR CLI containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# ASCII Banner
print_banner() {
    print_color $BLUE "
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     _   _                      _       _       _    ____    ║
║    | | | | ___  _ __ ___   ___| | __ _| |__   / \  |  _ \   ║
║    | |_| |/ _ \| '_ \` _ \ / _ \ |/ _\` | '_ \ / _ \ | |_) |  ║
║    |  _  | (_) | | | | | |  __/ | (_| | |_) / ___ \|  _ <   ║
║    |_| |_|\___/|_| |_| |_|\___|_|\__,_|_.__/_/   \_\_| \_\  ║
║                                                              ║
║            Container Management Interface                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"
}

# Main installation function
main() {
    print_banner
    
    print_color $GREEN "🚀 HomelabARR Local Installation Script"
    print_color $GREEN "================================================"
    echo ""
    
    # Check prerequisites
    print_color $YELLOW "🔍 Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_color $RED "❌ Docker is not installed"
        print_color $RED "   Please install Docker first: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_color $GREEN "✅ Docker found"
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        print_color $GREEN "✅ Docker Compose found (standalone)"
    elif docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
        print_color $GREEN "✅ Docker Compose found (plugin)"
    else
        print_color $RED "❌ Docker Compose is not installed"
        print_color $RED "   Please install Docker Compose first"
        exit 1
    fi
    
    # Detect platform and select appropriate compose file
    print_color $YELLOW "🔍 Detecting platform..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        COMPOSE_FILE="homelabarr-linux.yml"
        print_color $GREEN "✅ Linux platform detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        COMPOSE_FILE="homelabarr-linux.yml"
        print_color $GREEN "✅ macOS platform detected"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        COMPOSE_FILE="homelabarr-demo.yml"
        print_color $GREEN "✅ Windows platform detected"
    else
        print_color $YELLOW "⚠️  Unknown platform: $OSTYPE"
        print_color $YELLOW "   Defaulting to Linux configuration"
        COMPOSE_FILE="homelabarr-linux.yml"
    fi
    
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        print_color $RED "❌ Compose file not found: $COMPOSE_FILE"
        print_color $RED "   Please ensure you're running this from the HomelabARR directory"
        exit 1
    fi
    
    print_color $GREEN "✅ Using compose file: $COMPOSE_FILE"
    echo ""
    
    # Stop any existing containers
    print_color $YELLOW "🛑 Stopping any existing HomelabARR containers..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down 2>/dev/null || true
    
    # Build and start containers
    print_color $YELLOW "🔨 Building HomelabARR containers..."
    echo ""
    
    if ! $COMPOSE_CMD -f "$COMPOSE_FILE" build; then
        print_color $RED "❌ Build failed"
        print_color $RED "   Please check the error messages above"
        exit 1
    fi
    
    print_color $GREEN "✅ Build completed successfully"
    echo ""
    
    # Start containers
    print_color $YELLOW "🚀 Starting HomelabARR containers..."
    echo ""
    
    if ! $COMPOSE_CMD -f "$COMPOSE_FILE" up -d; then
        print_color $RED "❌ Failed to start containers"
        print_color $RED "   Please check the error messages above"
        exit 1
    fi
    
    print_color $GREEN "✅ Containers started successfully"
    echo ""
    
    # Wait for services to be ready
    print_color $YELLOW "⏳ Waiting for services to initialize..."
    sleep 5
    
    # Check container health
    print_color $YELLOW "🏥 Checking container health..."
    echo ""
    
    # Get container status
    FRONTEND_STATUS=$($COMPOSE_CMD -f "$COMPOSE_FILE" ps frontend 2>/dev/null | grep -c "Up" || echo "0")
    BACKEND_STATUS=$($COMPOSE_CMD -f "$COMPOSE_FILE" ps backend 2>/dev/null | grep -c "Up" || echo "0")
    
    if [[ "$FRONTEND_STATUS" == "1" ]]; then
        print_color $GREEN "✅ Frontend container is running"
    else
        print_color $RED "❌ Frontend container is not running"
    fi
    
    if [[ "$BACKEND_STATUS" == "1" ]]; then
        print_color $GREEN "✅ Backend container is running"
    else
        print_color $RED "❌ Backend container is not running"
    fi
    
    echo ""
    
    # Test endpoints
    print_color $YELLOW "🔍 Testing service endpoints..."
    echo ""
    
    # Test backend health
    if curl -s -f "http://localhost:8092/health" > /dev/null 2>&1; then
        print_color $GREEN "✅ Backend health check passed"
    else
        print_color $YELLOW "⚠️  Backend health check failed (service may still be starting)"
    fi
    
    # Test frontend
    if curl -s -f "http://localhost:8084" > /dev/null 2>&1; then
        print_color $GREEN "✅ Frontend is accessible"
    else
        print_color $YELLOW "⚠️  Frontend not yet accessible (service may still be starting)"
    fi
    
    echo ""
    print_color $GREEN "================================================"
    print_color $GREEN "🎉 HomelabARR Installation Complete!"
    print_color $GREEN "================================================"
    echo ""
    print_color $BLUE "📋 Access Information:"
    print_color $BLUE "   Frontend: http://localhost:8084"
    print_color $BLUE "   Backend:  http://localhost:8092"
    echo ""
    print_color $BLUE "📋 Container Management:"
    print_color $BLUE "   View logs:    $COMPOSE_CMD -f $COMPOSE_FILE logs -f"
    print_color $BLUE "   Stop:         $COMPOSE_CMD -f $COMPOSE_FILE down"
    print_color $BLUE "   Restart:      $COMPOSE_CMD -f $COMPOSE_FILE restart"
    print_color $BLUE "   Update:       git pull && $0"
    echo ""
    print_color $YELLOW "📝 Notes:"
    print_color $YELLOW "   - Services may take a few moments to fully initialize"
    print_color $YELLOW "   - Check logs if services are not accessible"
    print_color $YELLOW "   - Default credentials: admin/demo (if auth is enabled)"
    echo ""
    
    # Ask if user wants to view logs
    read -p "Would you like to view the container logs? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_color $YELLOW "📜 Showing container logs (Ctrl+C to exit)..."
        $COMPOSE_CMD -f "$COMPOSE_FILE" logs -f
    fi
}

# Run main function
main "$@"