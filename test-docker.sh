#!/bin/bash

echo "🐳 Testing HomelabARR Docker Deployment"
echo "======================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ docker-compose not found. Please install docker-compose."
    exit 1
fi

echo "✅ Docker is running"
echo "✅ docker-compose is available"

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.docker .env
fi

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🏥 Checking service health..."

# Check frontend
if curl -f http://localhost:8087/health > /dev/null 2>&1; then
    echo "✅ Frontend is healthy (http://localhost:8087)"
else
    echo "❌ Frontend health check failed"
fi

# Check backend
if curl -f http://localhost:3009/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy (http://localhost:3009)"
else
    echo "❌ Backend health check failed"
fi

# Show container status
echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "🎉 Deployment complete!"
echo "📱 Frontend: http://localhost:8087"
echo "🔧 Backend API: http://localhost:3009"
echo "🔐 Default login: admin / admin"
echo ""
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"