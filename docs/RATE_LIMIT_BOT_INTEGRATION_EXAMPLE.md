# Bot Service Integration Example

This document shows how to integrate the rate limiting and token billing system into the Telegram bot service.

## Step 1: Update Bot Service Dependencies

Add the rate-limit package to the bot service:

```json
{
  "name": "@monorepo/bot",
  "dependencies": {
    "@monorepo/config": "workspace:*",
    "@monorepo/shared": "workspace:*",
    "@monorepo/monitoring": "workspace:*",
    "@monorepo/rate-limit": "workspace:*",
    "ioredis": "^5.3.2",
    "telegraf": "^4.12.0",
    "pg": "^8.11.0"
  }
}
```

## Step 2: Initialize Services

```typescript
// services/bot/src/index.ts
import { Telegraf } from 'telegraf';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { getConfig } from '@monorepo/config';
import { Monitoring } from '@monorepo/monitoring';
import {
  RateLimiter,
  CacheManager,
  UserCache,
  TokenBilling,
  SubscriptionTier,
  OperationType,
} from '@monorepo/rate-limit';

const config = getConfig();
const monitoring = new Monitoring({ service: 'bot', environment: config.nodeEnv });

// Initialize Redis
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (error) => {
  monitoring.handleError(error, { context: 'redis' });
});

// Initialize PostgreSQL
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

// Initialize rate limiting and caching
const rateLimiter = new RateLimiter(redis);
const cacheManager = new CacheManager(redis, 'bot', 300);
const userCache = new UserCache(cacheManager);

const tokenBilling = new TokenBilling(userCache, {
  onBalanceUpdate: async (userId, newBalance) => {
    await db.query(
      'UPDATE users SET tokens_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, userId]
    );
  },
});

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
```

## Step 3: Create User Management Utilities

```typescript
// services/bot/src/utils/user-management.ts
import { Pool } from 'pg';
import { UserCache } from '@monorepo/rate-limit';
import { SubscriptionTier, UserProfile } from '@monorepo/rate-limit';

export class UserManager {
  constructor(
    private db: Pool,
    private userCache: UserCache
  ) {}

  async getOrCreateUser(
    telegramId: string,
    username?: string,
    firstName?: string
  ): Promise<UserProfile> {
    return this.userCache.getOrFetchUserProfile(telegramId, async () => {
      const result = await this.db.query(`SELECT * FROM users WHERE telegram_id = $1`, [
        telegramId,
      ]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id,
          telegramId: row.telegram_id,
          username: row.username,
          tier: row.tier as SubscriptionTier,
          subscriptionExpiresAt: row.subscription_expires_at,
          tokensBalance: row.tokens_balance,
          tokensSpent: row.tokens_spent,
          channelSubscribedAt: row.channel_subscribed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }

      const insertResult = await this.db.query(
        `INSERT INTO users (telegram_id, username, first_name, tier, tokens_balance)
         VALUES ($1, $2, $3, 'Gift', 0)
         RETURNING *`,
        [telegramId, username, firstName]
      );

      const row = insertResult.rows[0];
      return {
        id: row.id,
        telegramId: row.telegram_id,
        username: row.username,
        tier: row.tier as SubscriptionTier,
        subscriptionExpiresAt: row.subscription_expires_at,
        tokensBalance: row.tokens_balance,
        tokensSpent: row.tokens_spent,
        channelSubscribedAt: row.channel_subscribed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async updateTokenBalance(userId: string, balance: number, spent: number): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET tokens_balance = $1, tokens_spent = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [balance, spent, userId]
    );

    await this.userCache.invalidateTokenBalance(userId);
  }

  async upgradeTier(userId: string, tier: SubscriptionTier): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await this.db.query(
      `UPDATE users 
       SET tier = $1, subscription_expires_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [tier, expiresAt, userId]
    );

    await this.userCache.invalidateUserProfile(userId);
  }
}
```

## Step 4: Create Request Handler Middleware

```typescript
// services/bot/src/middleware/rate-limit.ts
import { Context } from 'telegraf';
import { RateLimiter, TokenBilling, OperationType, SubscriptionTier } from '@monorepo/rate-limit';
import { Monitoring } from '@monorepo/monitoring';
import { UserManager } from '../utils/user-management';

export class BotMiddleware {
  constructor(
    private rateLimiter: RateLimiter,
    private tokenBilling: TokenBilling,
    private userManager: UserManager,
    private monitoring: Monitoring
  ) {}

  async handleRequest(
    ctx: Context,
    operation: OperationType,
    handler: () => Promise<void>
  ): Promise<boolean> {
    const userId = ctx.from?.id.toString();
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;

    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return false;
    }

    try {
      // Get or create user
      const user = await this.userManager.getOrCreateUser(userId, username, firstName);

      // Step 1: Check rate limiting
      const rateLimit = await this.rateLimiter.checkLimit(
        user.id,
        user.tier as SubscriptionTier,
        operation
      );

      if (!rateLimit.allowed) {
        this.monitoring.trackKPI({
          type: 'rate_limit_hit',
          data: { userId: user.id, tier: user.tier, operation },
        });

        await ctx.reply(
          `⏱️ Rate limit exceeded.\n\n` +
            `Please wait ${rateLimit.retryAfter} seconds before trying again.\n` +
            `Your limit resets at ${rateLimit.resetAt.toLocaleTimeString()}.\n\n` +
            `Current tier: ${user.tier}\n` +
            `Upgrade your tier for higher limits with /upgrade`
        );
        return false;
      }

      // Step 2: Check token balance
      const affordability = await this.tokenBilling.canAffordOperation(user.id, operation);

      if (!affordability.canAfford) {
        this.monitoring.trackKPI({
          type: 'insufficient_tokens',
          data: { userId: user.id, operation, balance: affordability.balance },
        });

        const cost = affordability.cost;
        const balance = affordability.balance;
        const deficit = affordability.deficit;

        await ctx.reply(
          `❌ Insufficient tokens.\n\n` +
            `This operation costs ${cost} tokens, but you have ${balance}.\n` +
            `You need ${deficit} more tokens.\n\n` +
            `Your current tier: ${user.tier}\n` +
            `• Gift: 100 tokens/month (free after channel subscription)\n` +
            `• Professional: 2000 tokens/month (1990₽)\n` +
            `• Business: 10000 tokens/month (3490₽)\n\n` +
            `Use /upgrade to upgrade your subscription.`
        );
        return false;
      }

      // Step 3: Deduct tokens
      const deduction = await this.tokenBilling.deductTokens(user.id, operation);

      if (!deduction.success) {
        await ctx.reply(`❌ ${deduction.error}`);
        return false;
      }

      // Step 4: Execute the operation
      try {
        await handler();

        this.monitoring.trackKPI({
          type: 'token_spend',
          data: { userId: user.id, operation, amount: affordability.cost },
        });

        // Send success message with remaining tokens and requests
        await ctx.reply(
          `\n\n✅ Tokens used: ${affordability.cost}\n` +
            `💰 Remaining: ${deduction.newBalance} tokens\n` +
            `⏱️ Requests remaining this minute: ${rateLimit.remaining}`
        );

        return true;
      } catch (error) {
        // Refund tokens on failure
        await this.tokenBilling.addTokens(user.id, affordability.cost);

        this.monitoring.handleError(error, {
          context: 'operation_failed',
          userId: user.id,
          operation,
        });

        await ctx.reply(
          `❌ Operation failed. Your ${affordability.cost} tokens have been refunded.\n\n` +
            `Please try again or contact support.`
        );

        return false;
      }
    } catch (error) {
      this.monitoring.handleCriticalError(error, {
        context: 'request_handler',
        userId,
        operation,
      });

      await ctx.reply('❌ An unexpected error occurred. Please try again later.');
      return false;
    }
  }
}
```

## Step 5: Implement Bot Commands

```typescript
// services/bot/src/commands/index.ts
import { Telegraf, Context } from 'telegraf';
import { BotMiddleware } from '../middleware/rate-limit';
import { OperationType } from '@monorepo/rate-limit';

export function registerCommands(
  bot: Telegraf,
  middleware: BotMiddleware,
  generateImage: (prompt: string) => Promise<string>,
  getChatGPTResponse: (message: string) => Promise<string>
) {
  // Start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `👋 Welcome to the AI Bot!\n\n` +
        `I can help you with:\n` +
        `• /image <prompt> - Generate images\n` +
        `• /chat <message> - Chat with AI\n` +
        `• /balance - Check your token balance\n` +
        `• /upgrade - Upgrade your subscription\n` +
        `• /help - Show this message`
    );
  });

  // Image generation command
  bot.command('image', async (ctx) => {
    const prompt = ctx.message.text.replace('/image', '').trim();

    if (!prompt) {
      await ctx.reply('Please provide a prompt: /image <your prompt>');
      return;
    }

    await ctx.reply('🎨 Generating image...');

    await middleware.handleRequest(ctx, OperationType.IMAGE_GENERATION, async () => {
      const imageUrl = await generateImage(prompt);
      await ctx.replyWithPhoto({ url: imageUrl });
    });
  });

  // Chat command
  bot.command('chat', async (ctx) => {
    const message = ctx.message.text.replace('/chat', '').trim();

    if (!message) {
      await ctx.reply('Please provide a message: /chat <your message>');
      return;
    }

    await ctx.reply('💬 Thinking...');

    await middleware.handleRequest(ctx, OperationType.CHATGPT_MESSAGE, async () => {
      const response = await getChatGPTResponse(message);
      await ctx.reply(response);
    });
  });

  // Balance command
  bot.command('balance', async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const user = await middleware.userManager.getOrCreateUser(
      userId,
      ctx.from?.username,
      ctx.from?.first_name
    );

    const balance = await middleware.tokenBilling.getBalance(user.id);

    if (!balance) {
      await ctx.reply('❌ Unable to fetch balance.');
      return;
    }

    const chatMessages = await middleware.tokenBilling.estimateOperations(
      user.id,
      OperationType.CHATGPT_MESSAGE
    );

    const images = await middleware.tokenBilling.estimateOperations(
      user.id,
      OperationType.IMAGE_GENERATION
    );

    await ctx.reply(
      `💰 Your Token Balance\n\n` +
        `Balance: ${balance.tokensBalance} tokens\n` +
        `Spent: ${balance.tokensSpent} tokens\n` +
        `Tier: ${user.tier}\n\n` +
        `You can:\n` +
        `• Send ${chatMessages} more chat messages (5 tokens each)\n` +
        `• Generate ${images} more images (10 tokens each)\n\n` +
        `Use /upgrade to get more tokens.`
    );
  });

  // Upgrade command
  bot.command('upgrade', async (ctx) => {
    await ctx.reply(
      `📈 Upgrade Your Subscription\n\n` +
        `**Gift Tier** (Free)\n` +
        `• 100 tokens/month\n` +
        `• 10 requests/minute\n` +
        `• Requires channel subscription\n\n` +
        `**Professional Tier** (1990₽/month)\n` +
        `• 2000 tokens/month (20x more)\n` +
        `• 50 requests/minute (5x more)\n` +
        `• No channel required\n\n` +
        `**Business Tier** (3490₽/month)\n` +
        `• 10000 tokens/month (100x more)\n` +
        `• 100 requests/minute (10x more)\n` +
        `• Priority support\n\n` +
        `Click below to upgrade:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💎 Upgrade to Professional', callback_data: 'upgrade_professional' }],
            [{ text: '🚀 Upgrade to Business', callback_data: 'upgrade_business' }],
          ],
        },
      }
    );
  });

  // Handle text messages as chat
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    if (text.startsWith('/')) return; // Ignore commands

    await middleware.handleRequest(ctx, OperationType.CHATGPT_MESSAGE, async () => {
      const response = await getChatGPTResponse(text);
      await ctx.reply(response);
    });
  });
}
```

## Step 6: Main Bot Application

```typescript
// services/bot/src/index.ts (continued)

async function main() {
  // Initialize all services (as shown in Step 2)
  const userManager = new UserManager(db, userCache);
  const middleware = new BotMiddleware(rateLimiter, tokenBilling, userManager, monitoring);

  // Register commands
  registerCommands(
    bot,
    middleware,
    generateImage, // Your image generation function
    getChatGPTResponse // Your ChatGPT function
  );

  // Start metrics server
  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
    monitoring.logger.info(`Metrics server started on port ${config.metricsPort}`);
  }

  // Start bot
  await bot.launch();
  monitoring.logger.info('Bot started successfully');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((error) => {
  monitoring.handleCriticalError(error, { context: 'startup' });
  process.exit(1);
});
```

## Step 7: Scheduled Jobs (Token Renewal)

```typescript
// services/bot/src/jobs/token-renewal.ts
import cron from 'node-cron';
import { Pool } from 'pg';
import { TokenBilling, UserCache, SubscriptionTier } from '@monorepo/rate-limit';
import { Monitoring } from '@monorepo/monitoring';

export function scheduleTokenRenewal(
  db: Pool,
  tokenBilling: TokenBilling,
  userCache: UserCache,
  monitoring: Monitoring
) {
  // Run daily at midnight to renew Gift tier tokens
  cron.schedule('0 0 * * *', async () => {
    monitoring.logger.info('Starting monthly token renewal');

    try {
      const result = await db.query(`
        SELECT id, telegram_id, tier, subscription_expires_at
        FROM users
        WHERE tier = 'Gift'
        AND channel_subscribed_at IS NOT NULL
        AND (
          subscription_expires_at IS NULL 
          OR subscription_expires_at < CURRENT_TIMESTAMP
        )
      `);

      for (const user of result.rows) {
        try {
          // Reset tokens
          await tokenBilling.resetMonthlyTokens(user.id, SubscriptionTier.GIFT);

          // Update expiration
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          await db.query(
            `UPDATE users 
             SET subscription_expires_at = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [expiresAt, user.id]
          );

          // Invalidate cache
          await userCache.invalidateAllUserData(user.id);

          monitoring.logger.info(`Renewed tokens for Gift tier user: ${user.telegram_id}`);
        } catch (error) {
          monitoring.handleError(error, {
            context: 'token_renewal',
            userId: user.id,
          });
        }
      }

      monitoring.logger.info(`Token renewal completed. Renewed ${result.rows.length} users`);
    } catch (error) {
      monitoring.handleCriticalError(error, { context: 'token_renewal_job' });
    }
  });
}
```

## Environment Variables

Add to `.env`:

```bash
# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bot_db

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

## Testing the Integration

```bash
# Start Redis
docker-compose up -d redis

# Run migrations
psql $DATABASE_URL < scripts/db/migrations/001_add_telegram_users.sql

# Start the bot
pnpm bot:dev
```

## Monitoring

Track key metrics:

```typescript
// Rate limit hits
monitoring.trackKPI({
  type: 'rate_limit_hit',
  data: { userId, tier, operation },
});

// Token spending
monitoring.trackKPI({
  type: 'token_spend',
  data: { userId, operation, amount },
});

// Insufficient tokens
monitoring.trackKPI({
  type: 'insufficient_tokens',
  data: { userId, operation, balance },
});
```

View metrics at: `http://localhost:9091/metrics`
