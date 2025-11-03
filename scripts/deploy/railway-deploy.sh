#!/bin/bash
set -e

# Railway deployment script

echo "🚀 Starting Railway deployment..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
  echo "❌ railway CLI is not installed"
  echo "Install with: npm install -g @railway/cli"
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
  local config_file="deploy/railway/railway.$service.json"
  
  if [ ! -f "$config_file" ]; then
    echo "❌ Config file not found: $config_file"
    return 1
  fi
  
  echo ""
  echo "📦 Deploying $service service..."
  
  # Set Railway config
  cp "$config_file" railway.json
  
  # Deploy
  railway up --service "$service"
  
  echo "✅ $service service deployed"
}

# Check if logged in
if ! railway whoami &> /dev/null; then
  echo "🔐 Please login to Railway:"
  railway login
fi

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
echo "🔧 Setting up environment variables..."
echo "Run the following commands to set required variables:"
echo ""
echo "railway variables set DATABASE_URL=\$DATABASE_URL"
echo "railway variables set REDIS_URL=\$REDIS_URL"
echo "railway variables set TELEGRAM_BOT_TOKEN=\$TELEGRAM_BOT_TOKEN"
echo "railway variables set YOOKASSA_SHOP_ID=\$YOOKASSA_SHOP_ID"
echo "railway variables set YOOKASSA_SECRET_KEY=\$YOOKASSA_SECRET_KEY"
echo ""
echo "✅ Railway deployment completed!"
