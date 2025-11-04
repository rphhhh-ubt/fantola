# Bot Service

Telegram bot service built with Grammy framework, featuring session management, command routing, and AI integration.

## Features

- 🤖 **Grammy Framework**: Modern, type-safe Telegram Bot framework
- 💾 **Redis Sessions**: Persistent session storage with automatic cleanup
- 🔐 **User Authentication**: Automatic user registration and management
- 🎁 **Smart Onboarding**: Monthly gift token allocation with eligibility tracking
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
│   ├── start.ts       # /start command with onboarding
│   ├── help.ts        # /help command
│   ├── profile.ts     # /profile command
│   └── subscription.ts # /subscription command
├── handlers/           # Message handlers
│   └── text.ts        # Text message (keyboard) handler
├── services/           # Business logic services
│   ├── onboarding-service.ts  # User onboarding & gift tokens
│   └── index.ts       # Service exports
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

## User Authentication & Onboarding

The bot automatically handles user authentication and onboarding:

### Authentication Flow

1. User sends message → Auth middleware triggers
2. Middleware checks if user exists in database (by Telegram ID)
3. If new user → Creates account with **Gift tier** (0 tokens initially)
4. If existing user → Loads from database
5. User object attached to context: `ctx.user`

### Onboarding Flow (`/start` command)

The `/start` command intelligently handles both new and returning users:

**New Users (Gift Tier)**
- Receives **100 free tokens** immediately
- Gets welcome message with feature overview
- Prompted to subscribe to channel (required for Gift tier)
- `lastGiftClaimAt` timestamp recorded

**Returning Users - Monthly Renewal**
- If 30+ days since last gift claim → Receives **100 tokens**
- Gets renewal confirmation message
- `lastGiftClaimAt` updated to current date

**Returning Users - Same Month**
- No token award (already claimed this month)
- Shows days until next monthly renewal
- Displays current token balance

**Paid Tier Users (Professional/Business)**
- No automatic gift tokens (managed separately)
- Shows current balance and subscription status

All token awards are logged in `token_operations` table for audit trail.

For detailed implementation, see [User Onboarding Documentation](../../docs/USER_ONBOARDING.md).

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

## AI Integration

### Overview

The bot integrates two free AI providers:

- **Groq API**: Fast text chat (14,400 requests/day, 300 req/min)
- **Gemini Flash**: Vision + text (1,500 requests/day, 15 req/min)

### Environment Variables

```bash
# Groq API (Fast text chat)
GROQ_API_KEY=your_groq_api_key_from_console.groq.com
GROQ_MODEL=llama-3.1-70b-versatile
GROQ_MAX_TOKENS=2048

# Gemini API (Vision + text)
GEMINI_API_KEY=your_gemini_api_key_from_aistudio.google.com
GEMINI_MODEL=gemini-1.5-flash
GEMINI_MAX_TOKENS=2048
```

### Getting API Keys

#### Groq API Key
1. Visit https://console.groq.com/
2. Sign up for free account
3. Navigate to API Keys section
4. Create new API key
5. Copy key to `GROQ_API_KEY`

#### Gemini API Key
1. Visit https://aistudio.google.com/
2. Sign in with Google account
3. Click "Get API Key"
4. Create new project or use existing
5. Copy key to `GEMINI_API_KEY`

### Provider Selection Logic

- **Text-only messages** → Routed to Groq (Llama 3.1 70B)
- **Messages with photos** → Routed to Gemini Flash (vision support)
- **Token billing**: 5 tokens per message (regardless of provider)

### Rate Limits

**Groq API:**
- Daily: 14,400 requests
- Per minute: 300 requests
- Warning: 90% usage threshold

**Gemini Flash:**
- Daily: 1,500 requests
- Per minute: 15 requests
- Warning: 90% usage threshold

Rate limits are tracked in Redis with daily reset at 00:00 UTC.

### Usage Examples

**Text chat:**
```
User: What is the capital of France?
Bot: (Groq) The capital of France is Paris...
```

**Photo analysis:**
```
User: [sends photo] What do you see?
Bot: (Gemini) I can see a beautiful landscape with...
```

### Error Handling

- Rate limit errors: User-friendly message with retry time
- API errors: Automatic error normalization
- Token insufficient: Balance check before request
- Network errors: Retry with exponential backoff

### Monitoring

All AI requests are tracked via monitoring package:

```typescript
monitoring.trackGenerationSuccess('groq');
monitoring.trackGenerationFailure('gemini', 'rate_limit');
```

Metrics available:
- `ai_generation_success{provider="groq"}`
- `ai_generation_failure{provider="gemini",error="rate_limit"}`
- Daily usage statistics logged

## Related Documentation

- [Grammy Documentation](https://grammy.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Groq API Docs](https://console.groq.com/docs/quickstart)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Rate Limiting & Token Billing](../../docs/RATE_LIMITING_AND_TOKEN_BILLING.md)
- [Database Package](../../packages/database/README.md)
- [Monitoring Package](../../packages/monitoring/README.md)

## License

MIT
