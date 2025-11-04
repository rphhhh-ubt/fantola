# Bot Service

Telegram bot service built with Grammy framework, featuring session management, command routing, and AI integration.

## Features

- 🤖 **Grammy Framework**: Modern, type-safe Telegram Bot framework
- 💾 **Redis Sessions**: Persistent session storage with automatic cleanup
- 🔐 **User Authentication**: Automatic user registration and management
- 📊 **Database Integration**: Prisma ORM for user and subscription management
- ⌨️ **Reply Keyboards**: Intuitive navigation with custom keyboards
- 🔄 **Dual Mode**: Supports both polling (dev) and webhook (production)
- 📝 **Structured Logging**: Pino logging via monitoring package
- 🎯 **Rate Limiting**: Token-based billing and rate limiting support
- 🚨 **Error Handling**: Comprehensive error handling and user feedback

## Architecture

```
src/
├── bot.ts              # Bot initialization and configuration
├── index.ts            # Service entry point
├── types.ts            # TypeScript type definitions
├── session-adapter.ts  # Redis session storage adapter
├── keyboards.ts        # Reply keyboard builders
├── commands/           # Command handlers
│   ├── start.ts       # /start command
│   ├── help.ts        # /help command
│   ├── profile.ts     # /profile command
│   └── subscription.ts # /subscription command
├── handlers/           # Message handlers
│   └── text.ts        # Text message (keyboard) handler
└── middleware/         # Bot middleware
    ├── auth.ts        # User authentication
    ├── error.ts       # Global error handling
    └── logging.ts     # Request/response logging
```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database
- Redis server
- Telegram Bot Token (get from [@BotFather](https://t.me/botfather))

### Environment Variables

Create `.env.local` or update `.env.development`:

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/monorepo_dev

# Redis
REDIS_URL=redis://localhost:6379

# Development mode (uses polling)
NODE_ENV=development
```

### Installation

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate:dev

# Generate Prisma client
pnpm db:generate
```

### Running the Bot

#### Development Mode (Polling)

In development, the bot uses **polling** to receive updates:

```bash
pnpm dev
```

The bot will start and continuously poll Telegram's servers for updates. This is ideal for local development:

- ✅ No need for HTTPS/domain
- ✅ Works behind firewalls/NAT
- ✅ Hot reload friendly
- ✅ Instant feedback

#### Production Mode (Webhook)

In production, the bot uses **webhooks** to receive updates:

```bash
# Set production environment variables
export NODE_ENV=production
export TELEGRAM_WEBHOOK_DOMAIN=your-domain.com
export TELEGRAM_WEBHOOK_PATH=/webhook/telegram
export TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Start bot
pnpm start
```

Webhook mode requires:
- 🌐 Public HTTPS domain
- 🔒 Valid SSL certificate
- 🚀 Reverse proxy (nginx, etc.)
- 📡 Incoming webhook endpoint

### Webhook vs Polling

| Feature | Polling (Dev) | Webhook (Prod) |
|---------|--------------|----------------|
| **Setup** | Simple | Requires domain + SSL |
| **Latency** | Higher (1-2s) | Lower (<100ms) |
| **Reliability** | Good | Excellent |
| **Scalability** | Limited | High |
| **Use Case** | Development | Production |

The bot **automatically selects** the mode based on `NODE_ENV`:
- `development` → Polling
- `production` → Webhook

## Available Commands

### User Commands

- `/start` - Start the bot and show main menu
- `/help` - Show help and available commands
- `/profile` - View profile and token balance
- `/subscription` - View and manage subscription plans

### Reply Keyboard Buttons

- 🎨 **Generate Image** - AI image generation (coming soon)
- 💬 **Chat with GPT** - ChatGPT conversations (coming soon)
- 👤 **My Profile** - Quick profile overview
- 💎 **Subscription** - Manage subscription
- ❓ **Help** - Get help

## Session Management

Sessions are stored in Redis with the following structure:

```typescript
interface SessionData {
  userId?: string;           // Database user ID
  telegramId?: number;       // Telegram user ID
  username?: string;         // Telegram username
  state?: string;            // Current conversation state
  conversationContext?: {
    lastCommand?: string;
    lastPrompt?: string;
    messageCount?: number;
  };
}
```

Sessions automatically expire after **1 hour** of inactivity.

## User Authentication

The bot automatically handles user authentication:

1. User sends message → Auth middleware triggers
2. Middleware checks if user exists in database (by Telegram ID)
3. If new user → Creates account with **Gift tier** (100 tokens)
4. If existing user → Loads from database
5. User object attached to context: `ctx.user`

## Error Handling

The bot has comprehensive error handling:

- **Global Error Handler**: Catches all unhandled errors
- **User-Friendly Messages**: Shows helpful error messages
- **Error Logging**: All errors logged with context
- **Metrics Tracking**: Error rates tracked for monitoring
- **Graceful Degradation**: Bot continues running after errors

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

Tests use `MockTelegramBot` from `@monorepo/test-utils`.

## Database Schema

The bot uses the following main models:

- **User**: Telegram users with subscription and token balance
- **TokenOperation**: Token transaction history
- **SubscriptionHistory**: Subscription purchase history
- **Generation**: AI generation tracking
- **ChatMessage**: Chat message history

See `packages/database/prisma/schema.prisma` for full schema.

## Deployment

### Docker

```bash
# Build image
docker build -f Dockerfile.bot -t bot-service .

# Run container
docker run -d \
  --name bot \
  --env-file .env.production \
  bot-service
```

### Docker Compose

```bash
docker-compose up bot
```

### Environment Variables (Production)

```bash
# Required
TELEGRAM_BOT_TOKEN=<your_token>
DATABASE_URL=<postgres_url>
REDIS_URL=<redis_url>

# Webhook (required for production)
TELEGRAM_WEBHOOK_DOMAIN=bot.example.com
TELEGRAM_WEBHOOK_PATH=/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=<random_secret>

# Optional
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9091
SENTRY_ENABLED=true
SENTRY_DSN=<your_dsn>
```

## Monitoring

The bot exposes Prometheus metrics at `:9091/metrics`:

- `bot_updates_total` - Total updates processed
- `bot_commands_total` - Commands by type
- `bot_errors_total` - Errors by type
- `bot_active_users` - Active user count
- `bot_response_time` - Response time histogram

## Rate Limiting & Token Billing

The bot integrates with `@monorepo/rate-limit` for:

- **Rate Limiting**: Requests per minute based on subscription tier
- **Token Billing**: Token deduction for AI operations
- **Balance Checks**: Ensure sufficient tokens before operations

Example usage:

```typescript
import { RateLimiter, TokenBilling } from '@monorepo/rate-limit';

// Check rate limit
const rateLimit = await rateLimiter.checkLimit(userId, tier);
if (!rateLimit.allowed) {
  await ctx.reply('Rate limit exceeded. Please try again later.');
  return;
}

// Check token balance
const affordability = await tokenBilling.canAffordOperation(userId, 'chatgpt_message');
if (!affordability.canAfford) {
  await ctx.reply(`Insufficient tokens. You need ${affordability.required} tokens.`);
  return;
}

// Deduct tokens
await tokenBilling.deductTokens(userId, 'chatgpt_message');
```

## Contributing

1. Create feature branch: `git checkout -b feature/new-command`
2. Add command handler in `src/commands/`
3. Register command in `src/bot.ts`
4. Add tests in `src/__tests__/`
5. Update documentation
6. Submit pull request

## Troubleshooting

### Bot not responding

- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is running: `pnpm dev`
- Check logs for errors
- Ensure database and Redis are accessible

### Webhook not working

- Verify domain has valid SSL certificate
- Check webhook is set: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Ensure `TELEGRAM_WEBHOOK_SECRET` matches
- Check reverse proxy configuration

### Session not persisting

- Verify Redis is running and accessible
- Check `REDIS_URL` is correct
- Ensure Redis has sufficient memory
- Check session TTL (default: 1 hour)

## Related Documentation

- [Grammy Documentation](https://grammy.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Rate Limiting & Token Billing](../../docs/RATE_LIMITING_AND_TOKEN_BILLING.md)
- [Database Package](../../packages/database/README.md)
- [Monitoring Package](../../packages/monitoring/README.md)

## License

MIT
