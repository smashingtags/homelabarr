# PowerShell script to detect Docker group configuration for Windows
# This helps configure the homelabarr-backend container for Docker socket access

Write-Host "Detecting Docker configuration for Windows..." -ForegroundColor Green

# Check if Docker Desktop is running
try {
    $dockerInfo = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker is running" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker is not running or not accessible" -ForegroundColor Red
        Write-Host "   Make sure Docker Desktop is installed and running" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Docker command not found" -ForegroundColor Red
    Write-Host "   Make sure Docker Desktop is installed" -ForegroundColor Yellow
    exit 1
}

# On Windows with Docker Desktop, the docker group ID is typically handled differently
# Docker Desktop usually runs with elevated privileges or uses named pipes
Write-Host ""
Write-Host "Docker Desktop Configuration Notes:" -ForegroundColor Cyan
Write-Host "- Docker Desktop on Windows typically uses named pipes or elevated access"
Write-Host "- The DOCKER_GID setting may not be needed for Docker Desktop"
Write-Host "- If using WSL2, the docker group ID inside WSL2 may be different"

# Check if we're in WSL
if ($env:WSL_DISTRO_NAME) {
    Write-Host ""
    Write-Host "WSL2 detected: $($env:WSL_DISTRO_NAME)" -ForegroundColor Yellow
    Write-Host "For WSL2, you may need to check the docker group ID inside the WSL2 environment:"
    Write-Host "  wsl -d $($env:WSL_DISTRO_NAME) -e bash -c 'getent group docker | cut -d: -f3'"
}

# Set default values for Windows
$dockerGid = 999
Write-Host ""
Write-Host "Setting default DOCKER_GID=$dockerGid for Windows environment" -ForegroundColor Green

# Update .env file if it exists
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    $dockerGidLine = $envContent | Where-Object { $_ -match "^DOCKER_GID=" }
    
    if ($dockerGidLine) {
        $envContent = $envContent -replace "^DOCKER_GID=.*", "DOCKER_GID=$dockerGid"
        $envContent | Set-Content ".env"
        Write-Host "✓ Updated DOCKER_GID in .env file to $dockerGid" -ForegroundColor Green
    } else {
        Add-Content ".env" "DOCKER_GID=$dockerGid"
        Write-Host "✓ Added DOCKER_GID=$dockerGid to .env file" -ForegroundColor Green
    }
} else {
    Write-Host "⚠ .env file not found. Create one from .env.example and set DOCKER_GID=$dockerGid" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "To use this configuration with docker-compose:" -ForegroundColor Cyan
Write-Host "  `$env:DOCKER_GID=$dockerGid; docker-compose up -d"
Write-Host ""
Write-Host "Or use the existing .env file:"
Write-Host "  docker-compose up -d"