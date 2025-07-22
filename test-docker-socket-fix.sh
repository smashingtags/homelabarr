#!/bin/bash

# Shell script to run Docker socket access fix validation tests
# This script provides a convenient way to run the comprehensive Docker socket tests on Linux/macOS

set -e

# Default values
SOCKET_PATH="/var/run/docker.sock"
TIMEOUT=10000
VERBOSE=false
SKIP_SERVER_CHECK=false
HELP=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to show help
show_help() {
    print_color $GREEN "Docker Socket Access Fix Test Script"
    echo ""
    print_color $YELLOW "USAGE:"
    echo "  ./test-docker-socket-fix.sh [OPTIONS]"
    echo ""
    print_color $YELLOW "OPTIONS:"
    echo "  -h, --help              Show this help message"
    echo "  -v, --verbose           Enable verbose output"
    echo "  -s, --socket PATH       Docker socket path (default: /var/run/docker.sock)"
    echo "  -t, --timeout MS        Connection timeout in milliseconds (default: 10000)"
    echo "  --skip-server-check     Skip checking if the server is running"
    echo ""
    print_color $YELLOW "EXAMPLES:"
    echo "  ./test-docker-socket-fix.sh"
    echo "  ./test-docker-socket-fix.sh --verbose"
    echo "  ./test-docker-socket-fix.sh --socket /var/run/docker.sock --timeout 15000"
    echo ""
    print_color $YELLOW "REQUIREMENTS:"
    echo "  - Node.js installed"
    echo "  - Docker running"
    echo "  - npm dependencies installed (npm install)"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -s|--socket)
            SOCKET_PATH="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --skip-server-check)
            SKIP_SERVER_CHECK=true
            shift
            ;;
        *)
            print_color $RED "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Docker is running
docker_running() {
    docker info >/dev/null 2>&1
}

# Function to check if server is running
server_running() {
    local port=${1:-3001}
    curl -s -f "http://localhost:$port/health" >/dev/null 2>&1
}

# Function to get Docker group ID
get_docker_gid() {
    if command_exists getent; then
        getent group docker 2>/dev/null | cut -d: -f3
    elif [[ -f /etc/group ]]; then
        grep "^docker:" /etc/group 2>/dev/null | cut -d: -f3
    else
        echo "999"  # Default fallback
    fi
}

# Main execution
print_color $GREEN "🧪 Docker Socket Access Fix - Test Runner"
print_color $GREEN "================================================"

# Check prerequisites
print_color $YELLOW "🔍 Checking prerequisites..."

# Check Node.js
if ! command_exists node; then
    print_color $RED "❌ Node.js is not installed or not in PATH"
    print_color $RED "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
print_color $GREEN "✅ Node.js found: $NODE_VERSION"

# Check npm
if ! command_exists npm; then
    print_color $RED "❌ npm is not installed or not in PATH"
    exit 1
fi

print_color $GREEN "✅ npm found"

# Check Docker
if ! command_exists docker; then
    print_color $RED "❌ Docker is not installed or not in PATH"
    print_color $RED "   Please install Docker from https://docker.com/"
    exit 1
fi

print_color $GREEN "✅ Docker found"

# Check if Docker is running
if ! docker_running; then
    print_color $YELLOW "⚠️  Docker daemon is not running"
    print_color $YELLOW "   Please start Docker daemon"
    print_color $YELLOW "   Some tests may fail without Docker running"
else
    print_color $GREEN "✅ Docker daemon is running"
fi

# Check Docker group information
DOCKER_GID=$(get_docker_gid)
if [[ -n "$DOCKER_GID" ]]; then
    print_color $GREEN "✅ Docker group found (GID: $DOCKER_GID)"
else
    print_color $YELLOW "⚠️  Could not determine Docker group ID"
fi

# Check if package.json exists
if [[ ! -f "package.json" ]]; then
    print_color $RED "❌ package.json not found in current directory"
    print_color $RED "   Please run this script from the project root directory"
    exit 1
fi

print_color $GREEN "✅ package.json found"

# Check if node_modules exists
if [[ ! -d "node_modules" ]]; then
    print_color $YELLOW "⚠️  node_modules not found"
    print_color $YELLOW "   Installing dependencies..."
    
    if ! npm install; then
        print_color $RED "❌ Failed to install dependencies"
        exit 1
    fi
    print_color $GREEN "✅ Dependencies installed"
else
    print_color $GREEN "✅ Dependencies found"
fi

# Check if test script exists
if [[ ! -f "test-docker-socket-fix.js" ]]; then
    print_color $RED "❌ test-docker-socket-fix.js not found"
    print_color $RED "   Please ensure the test script is in the current directory"
    exit 1
fi

print_color $GREEN "✅ Test script found"

# Check server status (optional)
if [[ "$SKIP_SERVER_CHECK" != "true" ]]; then
    print_color $YELLOW "🔍 Checking server status..."
    
    if server_running; then
        print_color $GREEN "✅ Server is running on port 3001"
    else
        print_color $YELLOW "⚠️  Server is not running on port 3001"
        print_color $YELLOW "   Health check tests may fail"
        print_color $YELLOW "   You can start the server with: npm run dev"
        print_color $YELLOW "   Or start just the backend with: node server/index.js"
    fi
fi

echo ""
print_color $GREEN "🚀 Starting Docker socket access tests..."
print_color $GREEN "================================================"

# Set environment variables
export DOCKER_SOCKET="$SOCKET_PATH"
export TEST_TIMEOUT="$TIMEOUT"

if [[ "$VERBOSE" == "true" ]]; then
    print_color $CYAN "🐛 Verbose mode enabled"
    print_color $CYAN "   Socket Path: $SOCKET_PATH"
    print_color $CYAN "   Timeout: $TIMEOUT ms"
    print_color $CYAN "   Docker GID: $DOCKER_GID"
    print_color $CYAN "   Platform: $(uname -s)"
fi

# Run the test
print_color $BLUE "▶️  Executing test script..."
echo ""

# Execute the Node.js test script
if node test-docker-socket-fix.js; then
    echo ""
    print_color $GREEN "================================================"
    print_color $GREEN "🎉 All tests passed successfully!"
    print_color $GREEN "   Docker socket access fix is working correctly"
    exit 0
else
    EXIT_CODE=$?
    echo ""
    print_color $GREEN "================================================"
    print_color $RED "❌ Some tests failed"
    print_color $RED "   Please review the test output above for details"
    print_color $RED "   Exit code: $EXIT_CODE"
    
    echo ""
    print_color $YELLOW "📋 TROUBLESHOOTING:"
    print_color $YELLOW "   If tests fail, check:"
    print_color $YELLOW "   1. Docker is running and accessible"
    print_color $YELLOW "   2. Docker socket permissions are correct"
    print_color $YELLOW "   3. Container has proper group membership"
    print_color $YELLOW "   4. docker-compose.yml has correct group_add configuration"
    print_color $YELLOW "   5. DOCKER_GID environment variable is set correctly"
    echo ""
    print_color $YELLOW "📖 For more information, see:"
    print_color $YELLOW "   - DOCKER-TESTING.md"
    print_color $YELLOW "   - .kiro/specs/docker-socket-fix/design.md"
    
    # Show current Docker group info for troubleshooting
    echo ""
    print_color $CYAN "🔧 Current Docker configuration:"
    print_color $CYAN "   Docker socket: $SOCKET_PATH"
    print_color $CYAN "   Docker group ID: $DOCKER_GID"
    
    if [[ -S "$SOCKET_PATH" ]]; then
        SOCKET_PERMS=$(ls -la "$SOCKET_PATH" 2>/dev/null || echo "Cannot read socket permissions")
        print_color $CYAN "   Socket permissions: $SOCKET_PERMS"
    else
        print_color $CYAN "   Socket file not found or not accessible"
    fi
    
    exit $EXIT_CODE
fi