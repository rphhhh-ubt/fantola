#!/bin/bash
set -e

# Fly.io deployment script

echo "🚀 Starting Fly.io deployment..."

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
  echo "❌ flyctl is not installed"
  echo "Install with: curl -L https://fly.io/install.sh | sh"
  exit 1
fi

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Parse arguments
SERVICE=${1:-all}

deploy_service() {
  local service=$1
  local config_file="deploy/fly/fly.$service.toml"
  
  if [ ! -f "$config_file" ]; then
    echo "❌ Config file not found: $config_file"
    return 1
  fi
  
  echo ""
  echo "📦 Deploying $service service..."
  
  # Check if app exists
  if ! flyctl apps list | grep -q "monorepo-$service"; then
    echo "🆕 Creating new app: monorepo-$service"
    flyctl apps create "monorepo-$service" --org personal
  fi
  
  # Deploy
  flyctl deploy --config "$config_file" --remote-only
  
  echo "✅ $service service deployed"
}

# Deploy services
case $SERVICE in
  api)
    deploy_service api
    ;;
  bot)
    deploy_service bot
    ;;
  worker)
    deploy_service worker
    ;;
  all)
    deploy_service api
    deploy_service bot
    deploy_service worker
    ;;
  *)
    echo "❌ Unknown service: $SERVICE"
    echo "Usage: $0 [api|bot|worker|all]"
    exit 1
    ;;
esac

echo ""
echo "🔧 Setting up secrets..."
echo "Run the following commands to set required secrets:"
echo ""
echo "# Database"
echo "flyctl secrets set DATABASE_URL=\$DATABASE_URL -a monorepo-api"
echo "flyctl secrets set DATABASE_URL=\$DATABASE_URL -a monorepo-bot"
echo "flyctl secrets set DATABASE_URL=\$DATABASE_URL -a monorepo-worker"
echo ""
echo "# Redis"
echo "flyctl secrets set REDIS_URL=\$REDIS_URL -a monorepo-api"
echo "flyctl secrets set REDIS_URL=\$REDIS_URL -a monorepo-bot"
echo "flyctl secrets set REDIS_URL=\$REDIS_URL -a monorepo-worker"
echo ""
echo "# Telegram"
echo "flyctl secrets set TELEGRAM_BOT_TOKEN=\$TELEGRAM_BOT_TOKEN -a monorepo-bot"
echo ""
echo "# YooKassa"
echo "flyctl secrets set YOOKASSA_SHOP_ID=\$YOOKASSA_SHOP_ID YOOKASSA_SECRET_KEY=\$YOOKASSA_SECRET_KEY -a monorepo-api"
echo ""
echo "📊 Scale workers:"
echo "flyctl scale count 3 -a monorepo-worker"
echo ""
echo "✅ Fly.io deployment completed!"
