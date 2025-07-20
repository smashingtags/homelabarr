#!/usr/bin/env pwsh

Write-Host "🐳 Testing HomelabARR Docker Deployment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Check if docker-compose is available
try {
    docker-compose --version | Out-Null
    Write-Host "✅ docker-compose is available" -ForegroundColor Green
} catch {
    Write-Host "❌ docker-compose not found. Please install docker-compose." -ForegroundColor Red
    exit 1
}

# Copy environment file
if (-not (Test-Path .env)) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item .env.docker .env
}

# Build and start containers
Write-Host "🔨 Building and starting containers..." -ForegroundColor Yellow
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to start
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check service health
Write-Host "🏥 Checking service health..." -ForegroundColor Yellow

# Check frontend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8087/health" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Frontend is healthy (http://localhost:8087)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Frontend health check failed" -ForegroundColor Red
}

# Check backend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3009/health" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend is healthy (http://localhost:3009)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Backend health check failed" -ForegroundColor Red
}

# Show container status
Write-Host ""
Write-Host "📊 Container Status:" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host "📱 Frontend: http://localhost:8087" -ForegroundColor Cyan
Write-Host "🔧 Backend API: http://localhost:3009" -ForegroundColor Cyan
Write-Host "🔐 Default login: admin / admin" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 To view logs: docker-compose logs -f" -ForegroundColor Gray
Write-Host "🛑 To stop: docker-compose down" -ForegroundColor Gray