# Token Accounting Service

Comprehensive token accounting system for managing user token balances, ledger entries, and monthly renewals.

## Features

- ✅ **Balance Management**: Debit/credit operations with overdraft protection
- ✅ **Ledger System**: Full audit trail of all token operations
- ✅ **Monthly Renewals**: Automated renewal scheduling and enforcement
- ✅ **Transactional Safety**: All operations are atomic and consistent
- ✅ **Usage Analytics**: Track spending, earnings, and operation statistics
- ✅ **Cache Integration**: Optional cache invalidation callbacks
- ✅ **Metrics Tracking**: Built-in metrics for monitoring

## Architecture

### Token Service
Main service class that orchestrates all token operations.

**Key Methods:**
- `getBalance(userId)` - Get current balance
- `debit(userId, options)` - Deduct tokens with overdraft protection
- `credit(userId, options)` - Add tokens to balance
- `chargeForOperation(userId, operationType)` - Charge based on operation type
- `canAfford(userId, operationType)` - Check affordability
- `refund(userId, amount)` - Refund tokens
- `resetBalance(userId, newBalance)` - Reset balance to specific amount

### Token Ledger
Manages the audit log of all token operations.

**Key Methods:**
- `createEntry(...)` - Create ledger entry
- `getUserEntries(userId, options)` - Get user's transaction history
- `getEntriesByType(operationType)` - Get entries by operation type
- `getTotalSpent(userId, startDate, endDate)` - Calculate total spending
- `getTotalEarned(userId, startDate, endDate)` - Calculate total earnings
- `getUserStatistics(userId, startDate, endDate)` - Get aggregate stats
- `deleteOldEntries(olderThan)` - GDPR compliance cleanup

### Monthly Renewal Service
Handles automated monthly token renewals for all tiers.

**Key Methods:**
- `checkEligibility(userId)` - Check if user is eligible for renewal
- `renewUser(userId)` - Renew single user
- `renewAllEligible(options)` - Batch renewal for all eligible users
- `getUsersDueForRenewal(tier)` - Get list of users due for renewal
- `getCronExpression()` - Get recommended cron schedule

## Installation

```bash
pnpm install
```

## Usage

### Basic Setup

```typescript
import { TokenService, MonthlyRenewalService } from '@monorepo/shared';
import { db } from '@monorepo/database';

// Initialize token service
const tokenService = new TokenService(db, {
  cacheInvalidationCallback: async (userId) => {
    // Invalidate your cache here
    await userCache.invalidateTokenBalance(userId);
  },
  metricsCallback: (metrics) => {
    // Track metrics
    monitoring.trackTokenOperation(metrics);
  },
});

// Initialize renewal service
const renewalService = new MonthlyRenewalService(db);
```

### Debit Tokens (with overdraft protection)

```typescript
const result = await tokenService.debit(userId, {
  operationType: 'image_generation',
  amount: 10,
  allowOverdraft: false,
  metadata: {
    generationId: 'gen-123',
    model: 'dall-e-3',
  },
});

if (result.success) {
  console.log(`New balance: ${result.newBalance}`);
  console.log(`Ledger entry: ${result.ledgerEntryId}`);
} else {
  console.error(`Error: ${result.error}`);
}
```

### Credit Tokens

```typescript
const result = await tokenService.credit(userId, {
  operationType: 'purchase',
  amount: 1000,
  metadata: {
    paymentId: 'pay-456',
    plan: 'Professional',
  },
});
```

### Charge for Operation (automatic cost lookup)

```typescript
// Automatically charges 10 tokens for image generation
const result = await tokenService.chargeForOperation(
  userId,
  'image_generation',
  {
    generationId: 'gen-789',
  }
);
```

### Check Affordability

```typescript
const affordability = await tokenService.canAfford(userId, 'image_generation');

if (affordability.canAfford) {
  // Proceed with operation
} else {
  console.log(`Need ${affordability.deficit} more tokens`);
}
```

### Refund Tokens

```typescript
const result = await tokenService.refund(userId, 10, {
  reason: 'Generation failed',
  originalOperationId: 'gen-123',
});
```

### Get Balance

```typescript
const balance = await tokenService.getBalance(userId);

console.log(`Balance: ${balance.tokensBalance}`);
console.log(`Spent: ${balance.tokensSpent}`);
console.log(`Tier: ${balance.tier}`);
```

### Ledger Queries

```typescript
const ledger = tokenService.getLedger();

// Get user's transaction history
const entries = await ledger.getUserEntries(userId, {
  operationType: 'image_generation',
  limit: 10,
  offset: 0,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
});

// Get aggregate statistics
const stats = await ledger.getUserStatistics(
  userId,
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

console.log(`Total spent: ${stats.totalSpent}`);
console.log(`Total earned: ${stats.totalEarned}`);
console.log(`Net change: ${stats.netChange}`);
console.log(`Operations: ${stats.operationCount}`);
```

### Monthly Renewals

#### Check Eligibility

```typescript
const eligibility = await renewalService.checkEligibility(userId);

if (eligibility.eligible) {
  console.log('User is eligible for renewal');
} else {
  console.log(`Not eligible: ${eligibility.reason}`);
  console.log(`Next renewal: ${eligibility.nextRenewalDate}`);
}
```

#### Renew Single User

```typescript
const result = await renewalService.renewUser(userId);

if (result.success) {
  console.log(`Renewed: ${result.tokensAdded} tokens added`);
  console.log(`New balance: ${result.newBalance}`);
} else {
  console.error(`Renewal failed: ${result.error}`);
}
```

#### Batch Renewal (All Eligible Users)

```typescript
const result = await renewalService.renewAllEligible({
  tier: 'Gift', // Optional: filter by tier
  limit: 1000, // Optional: limit batch size
  dryRun: false, // Optional: test without actual renewal
  continueOnError: true, // Optional: continue even if some fail
});

console.log(`Processed: ${result.totalProcessed}`);
console.log(`Successful: ${result.successful}`);
console.log(`Failed: ${result.failed}`);
console.log(`Errors: ${result.errors.length}`);
```

#### Schedule Renewal Job (BullMQ)

```typescript
import { Queue } from 'bullmq';
import { QueueName } from '@monorepo/shared';

const renewalQueue = new Queue(QueueName.SUBSCRIPTION_RENEWAL, {
  connection: redisConnection,
});

// Add recurring job
await renewalQueue.add(
  'monthly-renewal',
  {},
  {
    repeat: {
      pattern: renewalService.getCronExpression(), // '0 2 * * *'
    },
  }
);
```

## Token Costs

| Operation Type       | Cost (tokens) |
|---------------------|---------------|
| `image_generation`  | 10            |
| `sora_image`        | 10            |
| `chatgpt_message`   | 5             |
| `refund`            | 0             |
| `purchase`          | 0             |
| `monthly_reset`     | 0             |

## Monthly Token Allocations

| Tier          | Monthly Tokens | Renewal Period |
|--------------|---------------|----------------|
| Gift         | 100           | 30 days        |
| Professional | 2000          | 30 days        |
| Business     | 10000         | 30 days        |

## Transaction Safety

All token operations are wrapped in database transactions:

```typescript
// Atomic transaction example
await prisma.$transaction(async (tx) => {
  // 1. Get current balance
  const user = await tx.user.findUnique({ where: { id: userId } });
  
  // 2. Update balance
  await tx.user.update({
    where: { id: userId },
    data: { tokensBalance: newBalance },
  });
  
  // 3. Create ledger entry
  await tx.tokenOperation.create({
    data: { userId, operationType, tokensAmount, ... },
  });
  
  // All or nothing - rollback on any error
});
```

## Overdraft Protection

By default, debit operations will fail if the user doesn't have sufficient tokens:

```typescript
// Default behavior - prevent overdraft
await tokenService.debit(userId, {
  operationType: 'image_generation',
  amount: 10,
  allowOverdraft: false, // Default
});

// Allow negative balance (use with caution)
await tokenService.debit(userId, {
  operationType: 'image_generation',
  amount: 10,
  allowOverdraft: true,
});
```

## Error Handling

All operations return a result object with success status:

```typescript
const result = await tokenService.debit(userId, { ... });

if (!result.success) {
  console.error(result.error);
  // Handle error appropriately
}
```

Common errors:
- `"User not found"`
- `"Insufficient tokens. Required: X, Available: Y"`
- `"Debit amount must be positive"`
- `"Balance cannot be negative"`

## Metrics Integration

Track all token operations with custom metrics:

```typescript
const tokenService = new TokenService(db, {
  metricsCallback: (metrics) => {
    monitoring.trackMetric('token_operation', {
      operation: metrics.operation,
      user_id: metrics.userId,
      amount: metrics.amount,
      success: metrics.success,
      duration_ms: metrics.duration,
      error: metrics.error,
    });
  },
});
```

## Cache Integration

Automatically invalidate cache after balance changes:

```typescript
const tokenService = new TokenService(db, {
  cacheInvalidationCallback: async (userId) => {
    await Promise.all([
      userCache.invalidateTokenBalance(userId),
      userCache.invalidateProfile(userId),
    ]);
  },
});
```

## Testing

Run tests:

```bash
pnpm test
```

Test coverage:
- ✅ Debit/credit flows
- ✅ Overdraft protection
- ✅ Transaction safety
- ✅ Ledger operations
- ✅ Renewal eligibility edge cases
- ✅ Batch renewal operations
- ✅ Error handling

## Database Schema

The service uses these database models:

**User:**
- `tokensBalance` - Current token balance
- `tokensSpent` - Total tokens spent lifetime
- `tier` - Subscription tier (Gift, Professional, Business)
- `lastGiftClaimAt` - Last renewal timestamp

**TokenOperation:**
- `operationType` - Type of operation
- `tokensAmount` - Amount (negative for debit, positive for credit)
- `balanceBefore` - Balance before operation
- `balanceAfter` - Balance after operation
- `metadata` - Additional context (JSON)

## Best Practices

1. **Always check affordability** before starting expensive operations
2. **Use metadata** to track operation context for debugging
3. **Enable cache invalidation** to keep cached balances in sync
4. **Track metrics** to monitor token usage patterns
5. **Run renewals in background jobs** to avoid blocking requests
6. **Use dry run mode** to test batch renewals before execution
7. **Monitor ledger growth** and clean up old entries periodically

## License

MIT
