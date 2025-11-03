#!/bin/bash
set -e

# Webhook setup script for Telegram and YooKassa

echo "🔄 Setting up webhooks..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Telegram Webhook Setup
if [ ! -z "$TELEGRAM_BOT_TOKEN" ] && [ ! -z "$TELEGRAM_WEBHOOK_DOMAIN" ]; then
  echo "🤖 Setting up Telegram webhook..."
  
  TELEGRAM_WEBHOOK_PATH=${TELEGRAM_WEBHOOK_PATH:-/webhook/telegram}
  TELEGRAM_WEBHOOK_URL="https://${TELEGRAM_WEBHOOK_DOMAIN}${TELEGRAM_WEBHOOK_PATH}"
  
  echo "📍 Webhook URL: $TELEGRAM_WEBHOOK_URL"
  
  # Set webhook
  RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"${TELEGRAM_WEBHOOK_URL}\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET:-}\"}")
  
  if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo "✅ Telegram webhook set successfully"
  else
    echo "❌ Failed to set Telegram webhook"
    echo "$RESPONSE"
    exit 1
  fi
  
  # Get webhook info
  echo "📊 Webhook info:"
  curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq '.'
  
else
  echo "⚠️  Skipping Telegram webhook setup (TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_DOMAIN not set)"
fi

echo ""

# YooKassa Webhook Setup
if [ ! -z "$YOOKASSA_SHOP_ID" ] && [ ! -z "$YOOKASSA_SECRET_KEY" ] && [ ! -z "$YOOKASSA_WEBHOOK_URL" ]; then
  echo "💳 Setting up YooKassa webhook..."
  
  echo "📍 Webhook URL: $YOOKASSA_WEBHOOK_URL"
  
  # Set webhook (adjust based on YooKassa API documentation)
  echo "⚠️  Note: YooKassa webhooks are typically configured through their dashboard"
  echo "   Dashboard: https://yookassa.ru/my/merchant/integration/http-notifications"
  echo "   Set the following URL: $YOOKASSA_WEBHOOK_URL"
  echo "   Events to subscribe:"
  echo "   - payment.succeeded"
  echo "   - payment.waiting_for_capture"
  echo "   - payment.canceled"
  echo "   - refund.succeeded"
  
else
  echo "⚠️  Skipping YooKassa webhook setup (credentials not set)"
fi

echo ""
echo "🎉 Webhook setup completed!"
