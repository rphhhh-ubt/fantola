#!/bin/bash
set -e

# Docker Compose deployment script

echo "🚀 Starting Docker deployment..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "⚠️  Warning: .env file not found. Using defaults."
fi

# Default to production mode
export NODE_ENV=${NODE_ENV:-production}

# Parse arguments
COMPOSE_FILES="-f docker-compose.yml"
if [ "$NODE_ENV" = "production" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prod.yml"
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
  echo "❌ docker-compose is not installed"
  exit 1
fi

DOCKER_COMPOSE_CMD="docker compose"
if ! command -v docker compose &> /dev/null; then
  DOCKER_COMPOSE_CMD="docker-compose"
fi

echo "📦 Building images..."
$DOCKER_COMPOSE_CMD $COMPOSE_FILES build

echo "🔄 Stopping existing containers..."
$DOCKER_COMPOSE_CMD $COMPOSE_FILES down

echo "🚀 Starting services..."
$DOCKER_COMPOSE_CMD $COMPOSE_FILES up -d

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
$DOCKER_COMPOSE_CMD $COMPOSE_FILES ps

# Run migrations
echo "🔄 Running database migrations..."
$DOCKER_COMPOSE_CMD $COMPOSE_FILES exec -T postgres psql -U postgres -d monorepo -f /docker-entrypoint-initdb.d/init.sql || echo "⚠️  Migrations may have already run"

# Setup webhooks
if [ -f ./scripts/deploy/setup-webhooks.sh ]; then
  echo "🔄 Setting up webhooks..."
  ./scripts/deploy/setup-webhooks.sh
fi

echo "✅ Deployment completed!"
echo ""
echo "📊 Service URLs:"
echo "   API: http://localhost:${API_PORT:-3000}"
echo ""
echo "📝 View logs:"
echo "   docker compose $COMPOSE_FILES logs -f"
