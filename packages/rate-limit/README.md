# @monorepo/rate-limit

Redis-based rate limiting, caching, and token billing system for the Telegram bot.

## Overview

This package provides three distinct but complementary systems:

1. **Rate Limiting** - Anti-abuse protection using sliding window + token bucket algorithms
2. **Token Billing** - Payment system tracking token balance and spending
3. **Caching** - Redis-based caching for user data with TTL and tag support

**IMPORTANT**: Rate limiting and token billing are SEPARATE systems:
- **Rate limiting** = How many requests per minute (anti-abuse)
- **Token billing** = How many tokens user has (payment/credits)

Both systems work together but independently. A user can have plenty of tokens but still hit rate limits if they make too many requests too quickly.

## Installation

```bash
pnpm add @monorepo/rate-limit
```

## Subscription Tiers

### Gift Tier
- **Tokens**: 100/month (free after channel subscription)
- **Rate Limit**: 10 requests/minute
- **Burst Limit**: 3 requests/second
- **Renewal**: Monthly automatic

### Professional Tier
- **Tokens**: 2000/month
- **Price**: 1990₽
- **Rate Limit**: 50 requests/minute
- **Burst Limit**: 10 requests/second

### Business Tier
- **Tokens**: 10000/month
- **Price**: 3490₽
- **Rate Limit**: 100 requests/minute
- **Burst Limit**: 20 requests/second

## Token Costs

| Operation | Tokens |
|-----------|--------|
| Image Generation (Product Card) | 10 |
| Sora Image Generation | 10 |
| ChatGPT Message | 5 |

## Usage

### Setup

```typescript
import Redis from 'ioredis';
import {
  RateLimiter,
  CacheManager,
  UserCache,
  TokenBilling,
  SubscriptionTier,
  OperationType,
} from '@monorepo/rate-limit';

const redis = new Redis(process.env.REDIS_URL);

const rateLimiter = new RateLimiter(redis);
const cacheManager = new CacheManager(redis, 'bot', 300);
const userCache = new UserCache(cacheManager);
const tokenBilling = new TokenBilling(userCache, {
  onBalanceUpdate: async (userId, newBalance) => {
    await database.updateTokenBalance(userId, newBalance);
  },
});
```

### Rate Limiting

```typescript
// Check if user is rate limited
const result = await rateLimiter.checkLimit(
  userId,
  SubscriptionTier.PROFESSIONAL,
  'image_generation'
);

if (!result.allowed) {
  await bot.sendMessage(
    chatId,
    `Too many requests. Please wait ${result.retryAfter} seconds.`
  );
  return;
}

// Get remaining requests
const remaining = await rateLimiter.getRemainingLimit(
  userId,
  SubscriptionTier.PROFESSIONAL
);

console.log(`You have ${remaining} requests remaining this minute`);

// Reset limits (admin only)
await rateLimiter.resetLimit(userId);

// Get user statistics
const stats = await rateLimiter.getUserStats(userId);
console.log(`Requests this minute: ${stats.minuteCount}`);
```

### Token Billing

```typescript
// Check if user can afford operation
const affordability = await tokenBilling.canAffordOperation(
  userId,
  OperationType.CHATGPT_MESSAGE
);

if (!affordability.canAfford) {
  await bot.sendMessage(
    chatId,
    `Insufficient tokens. You need ${affordability.cost} tokens but have ${affordability.balance}. ` +
    `Please purchase more tokens.`
  );
  return;
}

// Deduct tokens for operation
const result = await tokenBilling.deductTokens(
  userId,
  OperationType.IMAGE_GENERATION
);

if (!result.success) {
  await bot.sendMessage(chatId, result.error);
  return;
}

console.log(`New balance: ${result.newBalance} tokens`);

// Add tokens (after payment)
await tokenBilling.addTokens(userId, 2000);

// Reset monthly tokens (scheduled job)
await tokenBilling.resetMonthlyTokens(userId, SubscriptionTier.GIFT);

// Get current balance
const balance = await tokenBilling.getBalance(userId);
console.log(`Balance: ${balance?.tokensBalance}, Spent: ${balance?.tokensSpent}`);

// Estimate operations possible
const possibleMessages = await tokenBilling.estimateOperations(
  userId,
  OperationType.CHATGPT_MESSAGE
);
console.log(`You can send ${possibleMessages} more messages`);
```

### Caching

```typescript
// Cache user profile
await userCache.setUserProfile(userId, {
  id: userId,
  telegramId: '12345',
  username: 'john',
  tier: SubscriptionTier.PROFESSIONAL,
  subscriptionExpiresAt: new Date('2024-12-31'),
  tokensBalance: 2000,
  tokensSpent: 0,
  channelSubscribedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Get or fetch from database
const profile = await userCache.getOrFetchUserProfile(userId, async () => {
  return await database.getUserProfile(userId);
});

// Cache token balance (shorter TTL)
await userCache.setTokenBalance(userId, {
  tokensBalance: 1500,
  tokensSpent: 500,
});

// Cache channel subscription status (longer TTL)
await userCache.setChannelSubscription(userId, {
  isSubscribed: true,
  subscribedAt: new Date(),
});

// Invalidate cache on updates
await userCache.invalidateTokenBalance(userId); // After token operation
await userCache.invalidateUserProfile(userId); // After tier change
await userCache.invalidateChannelSubscription(userId); // After sub check
await userCache.invalidateAllUserData(userId); // Invalidate everything

// Warm cache for active users
await userCache.warmUserCache(userId, {
  profile,
  tokenBalance: { tokensBalance: 2000, tokensSpent: 0 },
  channelSubscription: { isSubscribed: true, subscribedAt: new Date() },
});

// Batch operations
const profiles = await userCache.batchGetProfiles([userId1, userId2, userId3]);
await userCache.batchSetProfiles([
  { userId: userId1, profile: profile1 },
  { userId: userId2, profile: profile2 },
]);
```

### Complete Request Flow

```typescript
async function handleUserRequest(
  userId: string,
  tier: SubscriptionTier,
  operation: OperationType
) {
  // 1. Check rate limiting (anti-abuse)
  const rateLimit = await rateLimiter.checkLimit(userId, tier, operation);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Please wait ${rateLimit.retryAfter} seconds.`,
    };
  }

  // 2. Check token balance (payment)
  const affordability = await tokenBilling.canAffordOperation(userId, operation);
  if (!affordability.canAfford) {
    return {
      success: false,
      error: `Insufficient tokens. You need ${affordability.cost} tokens but have ${affordability.balance}.`,
    };
  }

  // 3. Deduct tokens
  const deduction = await tokenBilling.deductTokens(userId, operation);
  if (!deduction.success) {
    return {
      success: false,
      error: deduction.error,
    };
  }

  // 4. Process request
  try {
    const result = await processOperation(operation);
    
    return {
      success: true,
      result,
      tokensRemaining: deduction.newBalance,
      requestsRemaining: rateLimit.remaining,
    };
  } catch (error) {
    // Refund tokens on failure
    await tokenBilling.addTokens(userId, affordability.cost);
    throw error;
  }
}
```

## Cache Strategy

### Cache-Aside Pattern
1. Check cache first
2. If miss, fetch from database
3. Store in cache
4. Return result

### TTL Values
- **User Profile**: 5 minutes (300s)
- **Token Balance**: 1 minute (60s)
- **Channel Subscription**: 10 minutes (600s)

### Invalidation Strategy
- Invalidate on updates (token operations, tier changes, etc.)
- Use tags for bulk invalidation
- Graceful degradation if Redis is down (fallback to DB)

### Cache Warming
- Pre-load active users' data
- Batch operations for multiple users
- Reduce database load during peak times

## Error Handling

### Rate Limiting Errors
```typescript
const result = await rateLimiter.checkLimit(userId, tier);

if (!result.allowed) {
  console.log(`Rate limited. Retry in ${result.retryAfter}s`);
  console.log(`Limit resets at ${result.resetAt}`);
}
```

### Token Billing Errors
```typescript
const result = await tokenBilling.deductTokens(userId, operation);

if (!result.success) {
  console.error(result.error);
  // Error messages are user-friendly and can be shown directly
}
```

### Graceful Degradation
```typescript
// If Redis is down, cache operations fail gracefully
const profile = await userCache.getOrFetchUserProfile(userId, async () => {
  return await database.getUserProfile(userId);
});
// Always returns profile (from cache or DB)
```

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## Environment Variables

```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
```

## Best Practices

1. **Always check rate limits before token billing** - Rate limiting is faster and prevents abuse
2. **Invalidate cache on updates** - Keep cache fresh and consistent
3. **Use batch operations** - More efficient for multiple users
4. **Warm cache for active users** - Improves performance
5. **Monitor metrics** - Track rate limit hits, token usage, cache hit rates
6. **Implement graceful degradation** - Handle Redis failures
7. **Use operation-specific rate limits** - Different limits for different operations
8. **Refund tokens on operation failure** - Fair to users

## Metrics to Track

- Rate limit hits per user/tier
- Token deductions per operation type
- Cache hit/miss rates
- Average token balance per tier
- Most rate-limited users
- Most token-consuming operations
- Cache invalidation frequency

## License

MIT
