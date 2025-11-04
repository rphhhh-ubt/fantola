# Bot Service - Development Guide

This guide covers local development setup, webhook vs polling configuration, and common development workflows.

## Quick Start

### 1. Install Dependencies

```bash
# From repository root
pnpm install

# Build all dependencies
pnpm --filter @monorepo/database build
pnpm --filter @monorepo/shared build
pnpm --filter @monorepo/config build
pnpm --filter @monorepo/monitoring build
pnpm --filter @monorepo/rate-limit build
```

### 2. Set Up Database

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run migrations
pnpm db:migrate:dev

# Generate Prisma Client
pnpm db:generate

# (Optional) Seed database
pnpm db:seed
```

### 3. Set Up Redis

```bash
# Start Redis
docker-compose up -d redis

# Verify Redis is running
redis-cli ping  # Should return PONG
```

### 4. Configure Bot Token

Get your bot token from [@BotFather](https://t.me/botfather):

1. Send `/newbot` to BotFather
2. Choose a name and username for your bot
3. Copy the token
4. Add to `.env.local`:

```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

### 5. Start Development Server

```bash
# From repository root
pnpm bot:dev

# Or from services/bot
cd services/bot
pnpm dev
```

The bot will start in **polling mode** automatically in development.

## Polling vs Webhook Mode

### Development Mode (Polling) ✅

**When:** `NODE_ENV=development`

**Pros:**
- ✅ Works locally without domain/SSL
- ✅ No reverse proxy needed
- ✅ Easy debugging
- ✅ Hot reload friendly
- ✅ Works behind NAT/firewalls

**Cons:**
- ❌ Higher latency (1-2 seconds)
- ❌ Not scalable for production
- ❌ Continuous polling overhead

**Setup:**

```bash
# .env.local or .env.development
NODE_ENV=development
TELEGRAM_BOT_TOKEN=your_token_here
```

That's it! No webhook configuration needed.

### Production Mode (Webhook) 🚀

**When:** `NODE_ENV=production`

**Pros:**
- ✅ Low latency (<100ms)
- ✅ Highly scalable
- ✅ No continuous polling
- ✅ Real-time updates

**Cons:**
- ❌ Requires public HTTPS domain
- ❌ Requires valid SSL certificate
- ❌ More complex setup

**Setup:**

```bash
# .env.production
NODE_ENV=production
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_WEBHOOK_DOMAIN=bot.yourdomain.com
TELEGRAM_WEBHOOK_PATH=/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=random_secret_string
```

**Nginx Configuration:**

```nginx
server {
    listen 443 ssl http2;
    server_name bot.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/bot.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.yourdomain.com/privkey.pem;

    location /webhook/telegram {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
    }
}
```

## Testing Bot Locally

### Manual Testing

1. Find your bot on Telegram by username (from BotFather)
2. Start a chat with your bot
3. Send `/start` command
4. Test keyboard buttons and commands

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug pnpm dev
```

Watch logs in real-time:

```bash
# In bot service directory
pnpm dev | bunyan
```

### Common Issues

#### Bot not responding

```bash
# Check bot is running
ps aux | grep node

# Check logs
tail -f logs/bot.log

# Verify token
curl https://api.telegram.org/bot<TOKEN>/getMe
```

#### Redis connection failed

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli ping

# Check Redis URL
echo $REDIS_URL
```

#### Database connection failed

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
psql $DATABASE_URL

# Run migrations
pnpm db:migrate:dev
```

## Development Workflow

### Adding New Commands

1. Create handler in `src/commands/`:

```typescript
// src/commands/mycommand.ts
import { CommandContext } from 'grammy';
import { BotContext } from '../types';

export async function handleMyCommand(ctx: CommandContext<BotContext>): Promise<void> {
  await ctx.reply('My command response');
}
```

2. Register command in `src/bot.ts`:

```typescript
import { handleMyCommand } from './commands/mycommand';

// In createBot function
bot.command('mycommand', handleMyCommand);
```

3. Add to commands index:

```typescript
// src/commands/index.ts
export * from './mycommand';
```

4. Add tests:

```typescript
// src/__tests__/mycommand.test.ts
import { handleMyCommand } from '../commands/mycommand';

describe('handleMyCommand', () => {
  it('should respond correctly', async () => {
    // Test implementation
  });
});
```

### Adding Keyboard Buttons

1. Add button to `src/keyboards.ts`:

```typescript
export const MainMenuButtons = {
  // ... existing buttons
  MY_NEW_BUTTON: '🆕 New Feature',
} as const;

export function buildMainMenuKeyboard(): Keyboard {
  return new Keyboard()
    // ... existing buttons
    .text(MainMenuButtons.MY_NEW_BUTTON)
    .resized()
    .persistent();
}
```

2. Add handler in `src/handlers/text.ts`:

```typescript
case MainMenuButtons.MY_NEW_BUTTON:
  await handleMyNewButton(ctx);
  break;
```

### Working with Sessions

```typescript
// Read from session
const userId = ctx.session.userId;
const state = ctx.session.state;

// Write to session
ctx.session.state = 'generating_image';
ctx.session.conversationContext = {
  lastPrompt: 'A beautiful sunset',
};

// Sessions automatically persist to Redis
```

### Database Operations

```typescript
import { db } from '@monorepo/shared';

// Find user (already loaded by auth middleware)
const user = ctx.user;

// Update user
await db.user.update({
  where: { id: user.id },
  data: { tokensBalance: user.tokensBalance - 10 },
});

// Create token operation
await db.tokenOperation.create({
  data: {
    userId: user.id,
    operationType: 'image_generation',
    tokensAmount: -10,
  },
});
```

## Testing

### Run All Tests

```bash
pnpm test
```

### Watch Mode

```bash
pnpm test:watch
```

### Coverage

```bash
pnpm test:coverage
```

### Unit Tests

```typescript
import { MockRedisClient, MockTelegramBot } from '@monorepo/test-utils';

describe('My Feature', () => {
  let redis: MockRedisClient;
  let bot: MockTelegramBot;

  beforeEach(() => {
    redis = new MockRedisClient();
    bot = new MockTelegramBot();
  });

  it('should work correctly', async () => {
    // Test implementation
  });
});
```

## Environment Variables

### Required

- `TELEGRAM_BOT_TOKEN` - Bot token from BotFather
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

### Optional

- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
- `ENABLE_METRICS` - Enable Prometheus metrics (true/false)
- `METRICS_PORT` - Metrics server port (default: 9091)
- `SENTRY_ENABLED` - Enable Sentry error tracking (true/false)
- `SENTRY_DSN` - Sentry DSN

### Webhook (Production Only)

- `TELEGRAM_WEBHOOK_DOMAIN` - Public domain
- `TELEGRAM_WEBHOOK_PATH` - Webhook endpoint path
- `TELEGRAM_WEBHOOK_SECRET` - Webhook secret token

## Hot Reload

The bot service uses `ts-node` in development for automatic reloading:

```bash
# Changes to .ts files automatically reload
pnpm dev
```

To disable auto-reload, use:

```bash
node dist/index.js
```

## Debugging with VSCode

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Bot",
      "cwd": "${workspaceFolder}/services/bot",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  ]
}
```

Set breakpoints in your code and press F5 to start debugging.

## Performance Monitoring

### Prometheus Metrics

```bash
# Enable metrics
ENABLE_METRICS=true pnpm dev

# View metrics
curl http://localhost:9091/metrics
```

Available metrics:
- `bot_updates_total` - Total updates processed
- `bot_commands_total{command}` - Commands by type
- `bot_errors_total{type}` - Errors by type
- `bot_response_time` - Response time histogram

### Logging

Structured JSON logs with Pino:

```typescript
monitoring.logger.info({ userId, command }, 'Processing command');
monitoring.logger.error({ error, context }, 'Command failed');
```

## Deployment

### Docker

```bash
# Build image
docker build -f Dockerfile.bot -t bot-service .

# Run container
docker run -d \
  --name bot \
  --env-file .env.production \
  --network host \
  bot-service
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f bot
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure webhook domain and secret
- [ ] Set up SSL certificate
- [ ] Configure reverse proxy (nginx)
- [ ] Enable metrics and monitoring
- [ ] Set up Sentry for error tracking
- [ ] Configure log aggregation
- [ ] Set up health checks
- [ ] Configure auto-restart (PM2, systemd)

## Troubleshooting

### Clear Webhook

If switching from webhook to polling:

```bash
curl https://api.telegram.org/bot<TOKEN>/deleteWebhook
```

### View Webhook Info

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### Reset Session

```bash
redis-cli DEL "bot:session:*"
```

### View Bot Info

```bash
curl https://api.telegram.org/bot<TOKEN>/getMe
```

## Resources

- [Grammy Documentation](https://grammy.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Redis Commands](https://redis.io/commands/)
- [Prisma Documentation](https://www.prisma.io/docs/)

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f bot`
2. Review documentation in `README.md`
3. Check environment variables
4. Verify dependencies are running
5. Open an issue on GitHub
