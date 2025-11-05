# Rate Limiting and Token Billing System

This document explains the Redis-based rate limiting and token billing system for the Telegram bot.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Rate Limiting vs Token Billing](#rate-limiting-vs-token-billing)
- [Subscription Tiers](#subscription-tiers)
- [Implementation Guide](#implementation-guide)
- [Database Schema](#database-schema)
- [Caching Strategy](#caching-strategy)
- [Error Handling](#error-handling)
- [Monitoring](#monitoring)

## Overview

The system consists of three interconnected but separate components:

1. **Rate Limiting** - Anti-abuse protection using Redis-based sliding window + token bucket algorithms
2. **Token Billing** - Payment/credit system tracking user token balance and spending
3. **Caching** - High-performance Redis caching for user data

## Architecture

```
┌──────────────┐
│ Telegram Bot │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│         Request Flow                         │
│                                              │
│  1. Check Rate Limit (Anti-Abuse)           │
│     └─> Redis Sliding Window + Token Bucket │
│                                              │
│  2. Check Token Balance (Payment)            │
│     └─> Redis Cache → PostgreSQL            │
│                                              │
│  3. Deduct Tokens                            │
│     └─> Update Cache + Database             │
│                                              │
│  4. Process Request                          │
│     └─> Generate Image / ChatGPT / etc.     │
└──────────────────────────────────────────────┘
```

## Rate Limiting vs Token Billing

**CRITICAL DISTINCTION**: These are two separate systems that work together:

### Rate Limiting (Anti-Abuse)

- **Purpose**: Prevent abuse, protect infrastructure
- **Unit**: Requests per minute
- **Storage**: Redis (sliding window + token bucket)
- **Scope**: Per user, per operation type
- **Reset**: Automatic (sliding window)

### Token Billing (Payment/Credits)

- **Purpose**: Monetization, track usage
- **Unit**: Tokens (virtual currency)
- **Storage**: PostgreSQL (source of truth) + Redis (cache)
- **Scope**: Per user account
- **Reset**: Monthly renewal for Gift tier, purchase for paid tiers

### Example Scenario

**User with Gift Tier:**

- Has 100 tokens remaining
- Rate limit: 10 requests/minute, 3 burst/second

**Scenario 1: Too Many Requests**

```
User sends 11 requests in 30 seconds
└─> Request 1-10: ✅ Pass rate limit, deduct tokens
└─> Request 11: ❌ RATE LIMITED (even though tokens available)
    Message: "Too many requests. Please wait 30 seconds."
```

**Scenario 2: Insufficient Tokens**

```
User (with 3 tokens) tries to generate image (costs 10 tokens)
└─> Check rate limit: ✅ Under limit
└─> Check tokens: ❌ INSUFFICIENT TOKENS
    Message: "Insufficient tokens. You need 10 tokens but have 3."
```

**Both systems must pass** for a request to be processed.

## Subscription Tiers

### Gift Tier (Free)

```typescript
{
  monthlyTokens: 100,
  priceRubles: null,  // Free after channel subscription
  requestsPerMinute: 10,
  burstPerSecond: 3,
}
```

**Requirements:**

- Must subscribe to Telegram channel
- Tokens renew automatically each month
- Limited rate to prevent abuse

**Use Cases:**

- 20 ChatGPT messages (5 tokens each)
- 10 image generations (10 tokens each)
- Mix of both

### Professional Tier (1990₽/month)

```typescript
{
  monthlyTokens: 2000,
  priceRubles: 1990,
  requestsPerMinute: 50,
  burstPerSecond: 10,
}
```

**Features:**

- 20x more tokens than Gift tier
- 5x higher rate limit
- Suitable for regular users
- No channel subscription required

**Use Cases:**

- 400 ChatGPT messages
- 200 image generations
- Mix of operations

### Business Tier (3490₽/month)

```typescript
{
  monthlyTokens: 10000,
  priceRubles: 3490,
  requestsPerMinute: 100,
  burstPerSecond: 20,
}
```

**Features:**

- 100x more tokens than Gift tier
- 10x higher rate limit
- Suitable for heavy users and businesses
- Priority support

**Use Cases:**

- 2000 ChatGPT messages
- 1000 image generations
- High-volume operations

## Implementation Guide

### Step 1: Initialize Redis Connection

```typescript
import Redis from 'ioredis';
import { getConfig } from '@monorepo/config';

const config = getConfig();

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Redis connected');
});
```

### Step 2: Initialize Rate Limiter and Token Billing

```typescript
import { RateLimiter, CacheManager, UserCache, TokenBilling } from '@monorepo/rate-limit';

const rateLimiter = new RateLimiter(redis);
const cacheManager = new CacheManager(redis, 'bot', 300);
const userCache = new UserCache(cacheManager);

const tokenBilling = new TokenBilling(userCache, {
  onBalanceUpdate: async (userId, newBalance) => {
    // Update database on token changes
    await db.query('UPDATE users SET tokens_balance = $1 WHERE id = $2', [newBalance, userId]);
  },
});
```

### Step 3: Handle Telegram Bot Requests

```typescript
import { SubscriptionTier, OperationType } from '@monorepo/rate-limit';

bot.on('message', async (msg) => {
  const userId = msg.from.id.toString();
  const chatId = msg.chat.id;

  // Get user data (from cache or DB)
  const user = await userCache.getOrFetchUserProfile(userId, async () => {
    return await db.getUserById(userId);
  });

  if (!user) {
    await bot.sendMessage(chatId, 'Please /start the bot first.');
    return;
  }

  // Determine operation type
  const operation = msg.text?.startsWith('/image')
    ? OperationType.IMAGE_GENERATION
    : OperationType.CHATGPT_MESSAGE;

  // Step 1: Check rate limiting
  const rateLimit = await rateLimiter.checkLimit(userId, user.tier as SubscriptionTier, operation);

  if (!rateLimit.allowed) {
    await bot.sendMessage(
      chatId,
      `⏱️ Too many requests. Please wait ${rateLimit.retryAfter} seconds.\n\n` +
        `Your limit resets at ${rateLimit.resetAt.toLocaleTimeString()}.`
    );
    return;
  }

  // Step 2: Check token balance
  const affordability = await tokenBilling.canAffordOperation(userId, operation);

  if (!affordability.canAfford) {
    const tier = user.tier;
    const cost = affordability.cost;
    const balance = affordability.balance;
    const deficit = affordability.deficit;

    await bot.sendMessage(
      chatId,
      `❌ Insufficient tokens.\n\n` +
        `This operation costs ${cost} tokens, but you have ${balance}.\n` +
        `You need ${deficit} more tokens.\n\n` +
        `Upgrade your tier or wait for monthly renewal:` +
        `\n• Gift: 100 tokens/month (free)` +
        `\n• Professional: 2000 tokens/month (1990₽)` +
        `\n• Business: 10000 tokens/month (3490₽)\n\n` +
        `Use /upgrade to upgrade your subscription.`
    );
    return;
  }

  // Step 3: Deduct tokens
  const deduction = await tokenBilling.deductTokens(userId, operation);

  if (!deduction.success) {
    await bot.sendMessage(chatId, `Error: ${deduction.error}`);
    return;
  }

  // Step 4: Process request
  try {
    let result;

    if (operation === OperationType.IMAGE_GENERATION) {
      result = await generateImage(msg.text);
    } else {
      result = await getChatGPTResponse(msg.text);
    }

    await bot.sendMessage(chatId, result, {
      caption:
        `✅ Success!\n\n` +
        `Tokens used: ${affordability.cost}\n` +
        `Remaining: ${deduction.newBalance} tokens\n` +
        `Requests remaining this minute: ${rateLimit.remaining}`,
    });

    // Log operation
    await db.logTokenOperation({
      userId,
      operation,
      tokensAmount: -affordability.cost,
      balanceBefore: affordability.balance,
      balanceAfter: deduction.newBalance,
    });
  } catch (error) {
    // Refund tokens on failure
    await tokenBilling.addTokens(userId, affordability.cost);

    await bot.sendMessage(
      chatId,
      `❌ Operation failed. Your ${affordability.cost} tokens have been refunded.`
    );

    throw error;
  }
});
```

### Step 4: Handle Payments

```typescript
// When user purchases subscription
async function handlePayment(userId: string, tier: SubscriptionTier) {
  const allocation = tokenBilling.getTierAllocation(tier);
  const price = tokenBilling.getTierPrice(tier);

  // Add tokens
  await tokenBilling.addTokens(userId, allocation);

  // Update user tier and expiration
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  await db.query(
    `UPDATE users 
     SET tier = $1, 
         subscription_expires_at = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [tier, expiresAt, userId]
  );

  // Invalidate cache
  await userCache.invalidateAllUserData(userId);

  // Log subscription
  await db.logSubscription({
    userId,
    tier,
    priceRubles: price,
    startedAt: new Date(),
    expiresAt,
  });
}
```

### Step 5: Monthly Token Renewal (Scheduled Job)

```typescript
// Run this daily to renew Gift tier tokens
async function renewGiftTierTokens() {
  const result = await db.query(`
    SELECT id, tier, subscription_expires_at
    FROM users
    WHERE tier = 'Gift'
    AND (
      subscription_expires_at IS NULL 
      OR subscription_expires_at < CURRENT_TIMESTAMP
    )
  `);

  for (const user of result.rows) {
    // Reset tokens
    await tokenBilling.resetMonthlyTokens(user.id, SubscriptionTier.GIFT);

    // Update expiration
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await db.query('UPDATE users SET subscription_expires_at = $1 WHERE id = $2', [
      expiresAt,
      user.id,
    ]);

    // Invalidate cache
    await userCache.invalidateAllUserData(user.id);

    console.log(`Renewed tokens for Gift tier user: ${user.id}`);
  }
}

// Schedule with cron
cron.schedule('0 0 * * *', renewGiftTierTokens); // Run daily at midnight
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Telegram fields
  telegram_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),

  -- Subscription fields
  tier VARCHAR(50) NOT NULL DEFAULT 'Gift',
  subscription_expires_at TIMESTAMP WITH TIME ZONE,

  -- Token billing fields
  tokens_balance INTEGER NOT NULL DEFAULT 0,
  tokens_spent INTEGER NOT NULL DEFAULT 0,

  -- Channel subscription
  channel_subscribed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_tier CHECK (tier IN ('Gift', 'Professional', 'Business')),
  CONSTRAINT positive_tokens_balance CHECK (tokens_balance >= 0),
  CONSTRAINT positive_tokens_spent CHECK (tokens_spent >= 0)
);
```

### Token Operations Log

```sql
CREATE TABLE token_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL,
  tokens_amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Subscription History

```sql
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL,
  price_rubles INTEGER,
  payment_method VARCHAR(50),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Caching Strategy

### Cache-Aside Pattern

1. **Read Operation:**

   ```
   Check Redis → If hit, return cached data
                → If miss, fetch from PostgreSQL
                         → Store in Redis
                         → Return data
   ```

2. **Write Operation:**
   ```
   Update PostgreSQL → Invalidate Redis cache
                     → Next read will refresh cache
   ```

### TTL Values

| Data Type            | TTL        | Reason                     |
| -------------------- | ---------- | -------------------------- |
| User Profile         | 5 minutes  | Changes infrequently       |
| Token Balance        | 1 minute   | Changes on every operation |
| Channel Subscription | 10 minutes | Checked once per session   |

### Cache Keys

```typescript
// User profile
`bot:user:profile:{userId}`
// Token balance
`bot:user:tokens:{userId}`
// Channel subscription
`bot:user:channel:{userId}`
// Rate limiting (sliding window)
`ratelimit:{userId}:{operation}:minute`
// Rate limiting (token bucket)
`ratelimit:{userId}:{operation}:second:bucket``ratelimit:{userId}:{operation}:second:timestamp`;
```

### Cache Warming

Warm cache for active users to improve performance:

```typescript
async function warmCacheForActiveUsers() {
  const activeUsers = await db.query(`
    SELECT * FROM users
    WHERE updated_at > NOW() - INTERVAL '1 hour'
    LIMIT 100
  `);

  const entries = [];

  for (const user of activeUsers.rows) {
    entries.push({
      userId: user.id,
      profile: user,
      tokenBalance: {
        tokensBalance: user.tokens_balance,
        tokensSpent: user.tokens_spent,
      },
    });
  }

  await Promise.all(entries.map((entry) => userCache.warmUserCache(entry.userId, entry)));
}
```

### Graceful Degradation

If Redis is unavailable, the system falls back to direct database reads:

```typescript
try {
  const profile = await userCache.getOrFetchUserProfile(userId, async () => {
    return await db.getUserById(userId);
  });
  // Always succeeds - either from cache or DB
} catch (error) {
  // Handle database errors separately
}
```

## Error Handling

### User-Friendly Error Messages

```typescript
// Rate limit exceeded
'⏱️ Too many requests. Please wait 30 seconds.';

// Insufficient tokens
'❌ Insufficient tokens. You need 10 tokens but have 3. Please upgrade your subscription.';

// Balance not found
'❌ User balance not found. Please try again.';

// Operation failed (with refund)
'❌ Operation failed. Your 10 tokens have been refunded.';
```

### Error Recovery

```typescript
// Auto-refund on operation failure
try {
  await processOperation();
} catch (error) {
  await tokenBilling.addTokens(userId, cost);
  throw error;
}
```

## Monitoring

### Key Metrics to Track

1. **Rate Limiting:**
   - Rate limit hits per user
   - Rate limit hits per tier
   - Most rate-limited users
   - Average requests per minute

2. **Token Billing:**
   - Token deductions per operation type
   - Average token balance per tier
   - Token refunds (operation failures)
   - Monthly token consumption

3. **Caching:**
   - Cache hit/miss rates
   - Cache invalidation frequency
   - Average cache latency
   - Redis connection errors

4. **Business Metrics:**
   - Active users per tier
   - Conversion rate (Gift → Professional/Business)
   - Average revenue per user
   - Token usage patterns

### Prometheus Metrics Example

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'bot' });

// Track rate limit hit
monitoring.trackKPI({
  type: 'rate_limit_hit',
  data: { userId, tier, operation },
});

// Track token deduction
monitoring.trackKPI({
  type: 'token_spend',
  data: { userId, operation, amount: cost },
});

// Track cache hit/miss
monitoring.trackKPI({
  type: 'cache_hit',
  data: { cacheType: 'user_profile' },
});
```

## Best Practices

1. **Always check rate limits before token billing** - Faster and prevents abuse
2. **Invalidate cache on updates** - Keep cache consistent with database
3. **Use batch operations** - More efficient for multiple users
4. **Monitor Redis health** - Alert on connection issues
5. **Implement graceful degradation** - Fallback to database if Redis fails
6. **Log all token operations** - Audit trail for disputes
7. **Refund tokens on failures** - Fair to users
8. **Use operation-specific rate limits** - Different limits for different operations
9. **Warm cache for active users** - Improve performance
10. **Regular cache cleanup** - Prevent memory bloat

## Testing

Run the comprehensive test suite:

```bash
cd packages/rate-limit
pnpm test
pnpm test:coverage
```

Tests cover:

- Rate limiting logic (sliding window, token bucket)
- Token deduction and balance tracking
- Cache operations (get, set, invalidate, TTL)
- Edge cases (insufficient tokens, rate limit exceeded)
- Error handling and graceful degradation

## Security Considerations

1. **Rate Limiting:** Prevents DDoS and abuse
2. **Token Validation:** Always check both systems before processing
3. **Cache Invalidation:** Prevent stale data from bypassing checks
4. **Audit Logging:** Track all token operations for accountability
5. **Secure Redis:** Use authentication and encryption in production

## Performance Optimization

1. **Redis Pipelining:** Batch Redis commands when possible
2. **Connection Pooling:** Reuse Redis connections
3. **Cache Warming:** Pre-load frequently accessed data
4. **Batch Operations:** Process multiple users at once
5. **Async Operations:** Use Promise.all for parallel processing

## Troubleshooting

### High Rate Limit Rejections

- Check if tier limits are appropriate
- Implement exponential backoff on client
- Add operation-specific limits

### Token Balance Inconsistencies

- Verify cache invalidation on updates
- Check database transaction isolation
- Review token operation logs

### Redis Connection Issues

- Verify Redis URL configuration
- Check network connectivity
- Implement connection retry logic
- Enable graceful degradation

### Cache Hit Rate Low

- Increase TTL values if appropriate
- Implement cache warming
- Check cache invalidation frequency
