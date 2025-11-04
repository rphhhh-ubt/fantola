# Token Accounting Service - Usage Examples

This document provides practical examples of integrating the token accounting service into your application.

## Basic Integration

### 1. Service Initialization

```typescript
import { TokenService, MonthlyRenewalService } from '@monorepo/shared';
import { db } from '@monorepo/database';
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'api', environment: 'production' });

// Initialize token service with monitoring and cache integration
const tokenService = new TokenService(db, {
  cacheInvalidationCallback: async (userId) => {
    // Invalidate your cache when balance changes
    await userCache.invalidateTokenBalance(userId);
    await userCache.invalidateProfile(userId);
  },
  metricsCallback: (metrics) => {
    // Track token operations in your monitoring system
    monitoring.logger.info(metrics, 'Token operation');
    
    if (!metrics.success) {
      monitoring.handleError(new Error(metrics.error || 'Token operation failed'), {
        operation: metrics.operation,
        userId: metrics.userId,
        amount: metrics.amount,
      });
    }
  },
});

const renewalService = new MonthlyRenewalService(db);
```

## Common Use Cases

### 2. Charging for AI Generation

```typescript
// In your generation handler
async function handleImageGeneration(userId: string, prompt: string) {
  // Check if user can afford the operation
  const affordability = await tokenService.canAfford(userId, 'image_generation');
  
  if (!affordability.canAfford) {
    throw new Error(
      `Insufficient tokens. You need ${affordability.cost} tokens but have ${affordability.balance}. ` +
      `Please add ${affordability.deficit} more tokens.`
    );
  }

  // Charge tokens before generation
  const chargeResult = await tokenService.chargeForOperation(
    userId,
    'image_generation',
    {
      prompt,
      model: 'dall-e-3',
      timestamp: Date.now(),
    }
  );

  if (!chargeResult.success) {
    throw new Error(chargeResult.error);
  }

  try {
    // Perform the actual generation
    const imageUrl = await generateImage(prompt);
    
    return {
      imageUrl,
      tokensCharged: 10,
      remainingBalance: chargeResult.newBalance,
    };
  } catch (error) {
    // Refund tokens if generation fails
    await tokenService.refund(userId, 10, {
      reason: 'Generation failed',
      error: error.message,
    });
    
    throw error;
  }
}
```

### 3. Charging for Chat Messages

```typescript
async function handleChatMessage(userId: string, message: string) {
  // Check affordability
  const affordability = await tokenService.canAfford(userId, 'chatgpt_message');
  
  if (!affordability.canAfford) {
    return {
      error: 'Insufficient tokens',
      deficit: affordability.deficit,
      balance: affordability.balance,
    };
  }

  // Charge tokens
  const result = await tokenService.chargeForOperation(
    userId,
    'chatgpt_message',
    {
      message,
      conversationId: 'conv-123',
    }
  );

  if (!result.success) {
    return { error: result.error };
  }

  // Process chat message
  const response = await chatWithGPT(message);

  return {
    response,
    tokensCharged: 5,
    remainingBalance: result.newBalance,
  };
}
```

### 4. Handling Subscription Purchases

```typescript
async function handleSubscriptionPurchase(
  userId: string,
  tier: SubscriptionTier,
  paymentId: string
) {
  const tierAllocations = {
    Gift: 100,
    Professional: 2000,
    Business: 10000,
  };

  const tokensToAdd = tierAllocations[tier];

  // Credit tokens to user
  const result = await tokenService.credit(userId, {
    operationType: 'purchase',
    amount: tokensToAdd,
    metadata: {
      tier,
      paymentId,
      priceRubles: tier === 'Professional' ? 1990 : 3490,
      timestamp: Date.now(),
    },
  });

  if (!result.success) {
    throw new Error(`Failed to credit tokens: ${result.error}`);
  }

  // Update user's tier in database
  await db.user.update({
    where: { id: userId },
    data: {
      tier,
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return {
    success: true,
    tokensAdded: tokensToAdd,
    newBalance: result.newBalance,
  };
}
```

### 5. Getting User Balance

```typescript
async function getUserBalance(userId: string) {
  const balance = await tokenService.getBalance(userId);

  if (!balance) {
    throw new Error('User not found');
  }

  return {
    balance: balance.tokensBalance,
    spent: balance.tokensSpent,
    tier: balance.tier,
    lastRenewal: balance.lastRenewalAt,
  };
}
```

### 6. Viewing Transaction History

```typescript
async function getTransactionHistory(userId: string, page: number = 1) {
  const ledger = tokenService.getLedger();
  const limit = 20;
  const offset = (page - 1) * limit;

  const entries = await ledger.getUserEntries(userId, {
    limit,
    offset,
  });

  return {
    page,
    perPage: limit,
    entries: entries.map((entry) => ({
      id: entry.id,
      type: entry.operationType,
      amount: entry.tokensAmount,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      date: entry.createdAt,
      metadata: entry.metadata,
    })),
  };
}
```

### 7. Getting Usage Statistics

```typescript
async function getUserStatistics(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const ledger = tokenService.getLedger();

  const stats = await ledger.getUserStatistics(userId, startDate, endDate);

  return {
    totalSpent: stats.totalSpent,
    totalEarned: stats.totalEarned,
    netChange: stats.netChange,
    operations: stats.operationCount,
    averagePerOperation: stats.totalSpent / stats.operationCount,
  };
}
```

## Monthly Renewal Integration

### 8. Manual Renewal (Admin Action)

```typescript
async function renewUserManually(userId: string) {
  // Check eligibility
  const eligibility = await renewalService.checkEligibility(userId);

  if (!eligibility.eligible) {
    return {
      success: false,
      reason: eligibility.reason,
      nextRenewalDate: eligibility.nextRenewalDate,
      daysUntilRenewal: eligibility.daysUntilRenewal,
    };
  }

  // Perform renewal
  const result = await renewalService.renewUser(userId);

  return result;
}
```

### 9. Batch Renewal Job (Scheduled)

```typescript
import { Queue, Worker } from 'bullmq';
import { QueueName } from '@monorepo/shared';

// Setup queue
const renewalQueue = new Queue(QueueName.SUBSCRIPTION_RENEWAL, {
  connection: redisConnection,
});

// Add recurring job
await renewalQueue.add(
  'monthly-renewal',
  {},
  {
    repeat: {
      pattern: renewalService.getCronExpression(), // '0 2 * * *' - Daily at 2 AM
    },
    jobId: 'monthly-renewal-job',
  }
);

// Worker to process renewal job
const renewalWorker = new Worker(
  QueueName.SUBSCRIPTION_RENEWAL,
  async (job) => {
    monitoring.logger.info('Starting monthly renewal job');

    const result = await renewalService.renewAllEligible({
      continueOnError: true,
      limit: 1000, // Process in batches
    });

    monitoring.logger.info(
      {
        totalProcessed: result.totalProcessed,
        successful: result.successful,
        failed: result.failed,
        errors: result.errors,
      },
      'Monthly renewal completed'
    );

    // Alert if too many failures
    if (result.failed > result.successful * 0.1) {
      monitoring.handleCriticalError(
        new Error('High failure rate in monthly renewal'),
        {
          totalProcessed: result.totalProcessed,
          failed: result.failed,
          failureRate: (result.failed / result.totalProcessed) * 100,
        }
      );
    }

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);
```

### 10. Dry Run (Testing)

```typescript
async function testRenewalProcess() {
  // Perform dry run without actually renewing
  const result = await renewalService.renewAllEligible({
    dryRun: true,
    tier: SubscriptionTier.Gift, // Test only Gift tier
  });

  console.log(`Would renew ${result.successful} users`);
  console.log('Renewal details:', result.renewals);

  return result;
}
```

## Advanced Patterns

### 11. Custom Token Operations with Ledger

```typescript
async function awardBonusTokens(
  userId: string,
  amount: number,
  reason: string
) {
  // Use credit with custom metadata
  const result = await tokenService.credit(userId, {
    operationType: 'purchase', // Or use a custom type
    amount,
    metadata: {
      reason,
      type: 'bonus',
      awardedBy: 'system',
      timestamp: Date.now(),
    },
  });

  if (result.success) {
    // Notify user
    await notificationService.send(userId, {
      title: 'Bonus Tokens Received!',
      message: `You've received ${amount} bonus tokens! Reason: ${reason}`,
    });
  }

  return result;
}
```

### 12. Multi-step Operations with Transactions

```typescript
async function processGenerationWithRetry(
  userId: string,
  prompt: string,
  maxRetries: number = 3
) {
  let attempt = 0;
  let lastError: Error | null = null;

  // Charge tokens once
  const chargeResult = await tokenService.chargeForOperation(
    userId,
    'image_generation',
    {
      prompt,
      maxRetries,
    }
  );

  if (!chargeResult.success) {
    throw new Error(chargeResult.error);
  }

  while (attempt < maxRetries) {
    try {
      const result = await generateImage(prompt);
      return {
        success: true,
        result,
        attempts: attempt + 1,
        tokensCharged: 10,
      };
    } catch (error) {
      lastError = error as Error;
      attempt++;
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // All retries failed - refund tokens
  await tokenService.refund(userId, 10, {
    reason: 'All generation attempts failed',
    attempts: maxRetries,
    lastError: lastError?.message,
  });

  throw lastError;
}
```

### 13. Analytics and Reporting

```typescript
async function generateMonthlyReport(userId: string) {
  const ledger = tokenService.getLedger();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  // Get overall statistics
  const stats = await ledger.getUserStatistics(
    userId,
    startOfMonth,
    endOfMonth
  );

  // Get breakdown by operation type
  const imageGenerations = await ledger.getUserEntries(userId, {
    operationType: 'image_generation',
    startDate: startOfMonth,
    endDate: endOfMonth,
  });

  const chatMessages = await ledger.getUserEntries(userId, {
    operationType: 'chatgpt_message',
    startDate: startOfMonth,
    endDate: endOfMonth,
  });

  return {
    period: {
      start: startOfMonth,
      end: endOfMonth,
    },
    summary: {
      totalSpent: stats.totalSpent,
      totalEarned: stats.totalEarned,
      netChange: stats.netChange,
      operations: stats.operationCount,
    },
    breakdown: {
      imageGenerations: {
        count: imageGenerations.length,
        tokensSpent: imageGenerations.reduce((sum, e) => sum + Math.abs(e.tokensAmount), 0),
      },
      chatMessages: {
        count: chatMessages.length,
        tokensSpent: chatMessages.reduce((sum, e) => sum + Math.abs(e.tokensAmount), 0),
      },
    },
  };
}
```

## Error Handling

### 14. Comprehensive Error Handling

```typescript
async function safeTokenOperation(
  userId: string,
  operationType: OperationType,
  amount: number
) {
  try {
    const result = await tokenService.debit(userId, {
      operationType,
      amount,
    });

    if (!result.success) {
      // Handle specific errors
      if (result.error?.includes('Insufficient tokens')) {
        return {
          status: 'insufficient_tokens',
          message: 'Please purchase more tokens to continue',
          balance: result.newBalance,
        };
      } else if (result.error?.includes('User not found')) {
        return {
          status: 'user_not_found',
          message: 'User account not found',
        };
      } else {
        return {
          status: 'error',
          message: result.error,
        };
      }
    }

    return {
      status: 'success',
      newBalance: result.newBalance,
      ledgerEntryId: result.ledgerEntryId,
    };
  } catch (error) {
    monitoring.handleError(error as Error, {
      userId,
      operationType,
      amount,
    });

    return {
      status: 'error',
      message: 'An unexpected error occurred',
    };
  }
}
```

## Testing

### 15. Unit Test Example

```typescript
import { TokenService } from '@monorepo/shared';

describe('Token Service Integration', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    tokenService = new TokenService(mockPrisma);
  });

  it('should charge correct amount for operations', async () => {
    // Mock user with balance
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tokensBalance: 100,
      tokensSpent: 50,
    });

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      return callback(mockPrisma);
    });

    const result = await tokenService.chargeForOperation(
      'user-1',
      'image_generation'
    );

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(90); // 100 - 10
  });
});
```

## Best Practices

1. **Always check affordability** before starting expensive operations
2. **Use metadata** to track operation context for debugging
3. **Refund tokens** when operations fail after charging
4. **Enable monitoring** to track token usage patterns
5. **Run renewals in background jobs** to avoid blocking requests
6. **Use dry run** to test batch operations before execution
7. **Invalidate cache** after balance changes
8. **Handle errors gracefully** with user-friendly messages
9. **Track KPIs** for business analytics
10. **Review ledger** periodically for audit and compliance
