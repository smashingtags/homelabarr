# PowerShell script to run Docker socket access fix validation tests
# This script provides a convenient way to run the comprehensive Docker socket tests on Windows

param(
    [switch]$Help,
    [switch]$Verbose,
    [string]$SocketPath = "/var/run/docker.sock",
    [int]$Timeout = 10000,
    [switch]$SkipServerCheck
)

# Display help information
if ($Help) {
    Write-Host "Docker Socket Access Fix Test Script" -ForegroundColor Green
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor Yellow
    Write-Host "  .\test-docker-socket-fix.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "OPTIONS:" -ForegroundColor Yellow
    Write-Host "  -Help              Show this help message"
    Write-Host "  -Verbose           Enable verbose output"
    Write-Host "  -SocketPath PATH   Docker socket path (default: /var/run/docker.sock)"
    Write-Host "  -Timeout MS        Connection timeout in milliseconds (default: 10000)"
    Write-Host "  -SkipServerCheck   Skip checking if the server is running"
    Write-Host ""
    Write-Host "EXAMPLES:" -ForegroundColor Yellow
    Write-Host "  .\test-docker-socket-fix.ps1"
    Write-Host "  .\test-docker-socket-fix.ps1 -Verbose"
    Write-Host "  .\test-docker-socket-fix.ps1 -SocketPath '/var/run/docker.sock' -Timeout 15000"
    Write-Host ""
    Write-Host "REQUIREMENTS:" -ForegroundColor Yellow
    Write-Host "  - Node.js installed"
    Write-Host "  - Docker running"
    Write-Host "  - npm dependencies installed (npm install)"
    Write-Host ""
    exit 0
}

# Function to write colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Function to check if a command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        $dockerInfo = docker info 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# Function to check if server is running
function Test-ServerRunning {
    param([int]$Port = 3001)
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -Method HEAD -TimeoutSec 2 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Main execution
Write-ColorOutput "🧪 Docker Socket Access Fix - Test Runner" "Green"
Write-ColorOutput "================================================" "Green"

# Check prerequisites
Write-ColorOutput "🔍 Checking prerequisites..." "Yellow"

# Check Node.js
if (-not (Test-Command "node")) {
    Write-ColorOutput "❌ Node.js is not installed or not in PATH" "Red"
    Write-ColorOutput "   Please install Node.js from https://nodejs.org/" "Red"
    exit 1
}

$nodeVersion = node --version
Write-ColorOutput "✅ Node.js found: $nodeVersion" "Green"

# Check npm
if (-not (Test-Command "npm")) {
    Write-ColorOutput "❌ npm is not installed or not in PATH" "Red"
    exit 1
}

Write-ColorOutput "✅ npm found" "Green"

# Check Docker
if (-not (Test-Command "docker")) {
    Write-ColorOutput "❌ Docker is not installed or not in PATH" "Red"
    Write-ColorOutput "   Please install Docker from https://docker.com/" "Red"
    exit 1
}

Write-ColorOutput "✅ Docker found" "Green"

# Check if Docker is running
if (-not (Test-DockerRunning)) {
    Write-ColorOutput "⚠️  Docker daemon is not running" "Yellow"
    Write-ColorOutput "   Please start Docker Desktop or Docker daemon" "Yellow"
    Write-ColorOutput "   Some tests may fail without Docker running" "Yellow"
} else {
    Write-ColorOutput "✅ Docker daemon is running" "Green"
}

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-ColorOutput "❌ package.json not found in current directory" "Red"
    Write-ColorOutput "   Please run this script from the project root directory" "Red"
    exit 1
}

Write-ColorOutput "✅ package.json found" "Green"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-ColorOutput "⚠️  node_modules not found" "Yellow"
    Write-ColorOutput "   Installing dependencies..." "Yellow"
    
    try {
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "❌ Failed to install dependencies" "Red"
            exit 1
        }
        Write-ColorOutput "✅ Dependencies installed" "Green"
    } catch {
        Write-ColorOutput "❌ Failed to install dependencies: $_" "Red"
        exit 1
    }
} else {
    Write-ColorOutput "✅ Dependencies found" "Green"
}

# Check if test script exists
if (-not (Test-Path "test-docker-socket-fix.js")) {
    Write-ColorOutput "❌ test-docker-socket-fix.js not found" "Red"
    Write-ColorOutput "   Please ensure the test script is in the current directory" "Red"
    exit 1
}

Write-ColorOutput "✅ Test script found" "Green"

# Check server status (optional)
if (-not $SkipServerCheck) {
    Write-ColorOutput "🔍 Checking server status..." "Yellow"
    
    if (Test-ServerRunning) {
        Write-ColorOutput "✅ Server is running on port 3001" "Green"
    } else {
        Write-ColorOutput "⚠️  Server is not running on port 3001" "Yellow"
        Write-ColorOutput "   Health check tests may fail" "Yellow"
        Write-ColorOutput "   You can start the server with: npm run dev" "Yellow"
        Write-ColorOutput "   Or start just the backend with: node server/index.js" "Yellow"
    }
}

Write-ColorOutput "" "White"
Write-ColorOutput "🚀 Starting Docker socket access tests..." "Green"
Write-ColorOutput "================================================" "Green"

# Set environment variables (only if not using default auto-detection)
if ($SocketPath -ne "/var/run/docker.sock") {
    $env:DOCKER_SOCKET = $SocketPath
}
$env:TEST_TIMEOUT = $Timeout

# Prepare command arguments
$nodeArgs = @("test-docker-socket-fix.js")

if ($Verbose) {
    Write-ColorOutput "🐛 Verbose mode enabled" "Cyan"
    Write-ColorOutput "   Socket Path: $SocketPath" "Cyan"
    Write-ColorOutput "   Timeout: $Timeout ms" "Cyan"
}

# Run the test
try {
    Write-ColorOutput "▶️  Executing test script..." "Blue"
    Write-ColorOutput "" "White"
    
    # Execute the Node.js test script
    & node @nodeArgs
    
    $exitCode = $LASTEXITCODE
    
    Write-ColorOutput "" "White"
    Write-ColorOutput "================================================" "Green"
    
    if ($exitCode -eq 0) {
        Write-ColorOutput "🎉 All tests passed successfully!" "Green"
        Write-ColorOutput "   Docker socket access fix is working correctly" "Green"
    } else {
        Write-ColorOutput "❌ Some tests failed" "Red"
        Write-ColorOutput "   Please review the test output above for details" "Red"
        Write-ColorOutput "   Exit code: $exitCode" "Red"
    }
    
    exit $exitCode
    
} catch {
    Write-ColorOutput "❌ Failed to run test script: $_" "Red"
    exit 1
}

# Additional troubleshooting information
Write-ColorOutput "" "White"
Write-ColorOutput "📋 TROUBLESHOOTING:" "Yellow"
Write-ColorOutput "   If tests fail, check:" "Yellow"
Write-ColorOutput "   1. Docker is running and accessible" "Yellow"
Write-ColorOutput "   2. Docker socket permissions are correct" "Yellow"
Write-ColorOutput "   3. Container has proper group membership" "Yellow"
Write-ColorOutput "   4. docker-compose.yml has correct group_add configuration" "Yellow"
Write-ColorOutput "   5. DOCKER_GID environment variable is set correctly" "Yellow"
Write-ColorOutput "" "White"
Write-ColorOutput "📖 For more information, see:" "Yellow"
Write-ColorOutput "   - DOCKER-TESTING.md" "Yellow"
Write-ColorOutput "   - .kiro/specs/docker-socket-fix/design.md" "Yellow"