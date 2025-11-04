# Database Access Layer Usage Examples

This document provides practical examples of using the database access layer in your services.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Database Client](#database-client)
- [Repository Helpers](#repository-helpers)
- [Graceful Shutdown](#graceful-shutdown)
- [Error Handling](#error-handling)
- [Advanced Patterns](#advanced-patterns)

## Basic Setup

### Service Initialization

```typescript
import { getApiConfig } from '@monorepo/config';
import { DatabaseClient, setupDatabaseShutdown } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';

async function main() {
  const config = getApiConfig();
  const monitoring = new Monitoring({ service: 'api', environment: config.nodeEnv });

  // 1. Initialize database client
  DatabaseClient.initialize({
    logQueries: config.nodeEnv === 'development',
    onError: (error, context) => {
      monitoring.handleError(error, context as Record<string, unknown>);
    },
  });

  // 2. Setup graceful shutdown
  setupDatabaseShutdown({
    timeout: 10000,
    logger: (message) => monitoring.logger.info(message),
    cleanupHandlers: [
      async () => {
        monitoring.logger.info('Stopping API server...');
        // Your cleanup logic here
      },
    ],
  });

  // 3. Start your application
  monitoring.logger.info('Service started');
}

main().catch(console.error);
```

## Database Client

### Direct Queries

```typescript
import { db } from '@monorepo/shared';

// Find all users
const users = await db.user.findMany({
  take: 10,
  orderBy: { createdAt: 'desc' },
});

// Find user by telegram ID
const user = await db.user.findUnique({
  where: { telegramId: '123456' },
  include: {
    tokenOperations: true,
    generations: true,
  },
});

// Create user
const newUser = await db.user.create({
  data: {
    telegramId: '123456',
    username: 'john_doe',
    subscriptionTier: 'Gift',
    tokensBalance: 100,
  },
});

// Update user
const updatedUser = await db.user.update({
  where: { telegramId: '123456' },
  data: { tokensBalance: 150 },
});

// Delete user
await db.user.delete({
  where: { telegramId: '123456' },
});
```

### Raw SQL Queries

```typescript
import { db } from '@monorepo/shared';

// Simple query
const result = await db.$queryRaw`
  SELECT * FROM users WHERE tokens_balance > 100
`;

// Parameterized query
const minTokens = 100;
const users = await db.$queryRaw`
  SELECT * FROM users WHERE tokens_balance > ${minTokens}
`;

// Execute without result
await db.$executeRaw`
  UPDATE users SET tokens_balance = tokens_balance + 10
  WHERE subscription_tier = 'Professional'
`;
```

## Repository Helpers

### Pagination

```typescript
import { repository } from '@monorepo/shared';

// Basic pagination
const page1 = await repository.paginate('user', {
  page: 1,
  limit: 20,
});

console.log(page1.data); // User records
console.log(page1.pagination);
// {
//   page: 1,
//   limit: 20,
//   total: 150,
//   totalPages: 8,
//   hasNext: true,
//   hasPrev: false
// }

// With filters and includes
const professionalUsers = await repository.paginate(
  'user',
  {
    page: 1,
    limit: 10,
    orderBy: { createdAt: 'desc' },
  },
  { subscriptionTier: 'Professional' },
  { tokenOperations: true }
);
```

### Transactions

```typescript
import { repository, db } from '@monorepo/shared';

// Simple transaction
const result = await repository.transaction(async (tx) => {
  // Create user
  const user = await tx.user.create({
    data: {
      telegramId: '123',
      username: 'newuser',
    },
  });

  // Create initial token operation
  await tx.tokenOperation.create({
    data: {
      userId: user.id,
      operationType: 'purchase',
      tokensChange: 100,
      balanceAfter: 100,
    },
  });

  return user;
});

// Transaction with options
const complexResult = await repository.transaction(
  async (tx) => {
    // Your transactional operations
    const user = await tx.user.findUnique({ where: { telegramId: '123' } });
    if (!user) throw new Error('User not found');

    await tx.user.update({
      where: { id: user.id },
      data: { tokensBalance: user.tokensBalance - 10 },
    });

    await tx.tokenOperation.create({
      data: {
        userId: user.id,
        operationType: 'image_generation',
        tokensChange: -10,
        balanceAfter: user.tokensBalance - 10,
      },
    });

    return user;
  },
  {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: 'ReadCommitted',
  }
);
```

### Soft Validations

```typescript
import { repository } from '@monorepo/shared';

// Check if user exists
const userExists = await repository.exists('user', {
  telegramId: '123',
});

if (!userExists) {
  // Create user
}

// Find user without throwing
const user = await repository.findUnique('user', {
  telegramId: '123',
});

if (!user) {
  // Handle not found case
}

// Find first matching user
const premiumUser = await repository.findFirst('user', {
  subscriptionTier: 'Business',
  tokensBalance: { gt: 5000 },
});

// Count users
const professionalCount = await repository.count('user', {
  subscriptionTier: 'Professional',
});
```

### Batch Operations

```typescript
import { repository } from '@monorepo/shared';

// Batch create users
const usersData = [
  { telegramId: '1', username: 'user1' },
  { telegramId: '2', username: 'user2' },
  { telegramId: '3', username: 'user3' },
];

await repository.batchCreate('user', usersData, 100);

// Upsert (create or update)
const user = await repository.upsert(
  'user',
  { telegramId: '123' }, // where
  {
    // create
    telegramId: '123',
    username: 'newuser',
    tokensBalance: 100,
  },
  {
    // update
    username: 'updateduser',
  }
);

// Soft delete
await repository.softDelete('user', { id: 'user-id' }, 'deletedAt');
```

## Graceful Shutdown

### Basic Shutdown

```typescript
import { setupDatabaseShutdown } from '@monorepo/shared';

// Setup with default options
setupDatabaseShutdown({
  timeout: 10000,
  logger: (message) => console.log(message),
});

// The shutdown will be triggered automatically on:
// - SIGTERM
// - SIGINT (Ctrl+C)
// - Uncaught exceptions
// - Unhandled promise rejections
```

### Advanced Shutdown with Multiple Cleanup Handlers

```typescript
import { setupDatabaseShutdown } from '@monorepo/shared';
import { createServer } from 'http';
import { Queue } from 'bullmq';

const server = createServer();
const queue = new Queue('jobs');

const shutdownManager = setupDatabaseShutdown({
  timeout: 15000,
  logger: (message) => console.log(message),
  cleanupHandlers: [
    // Handler 1: Close job queue
    async () => {
      console.log('Closing job queue...');
      await queue.close();
      console.log('Queue closed');
    },
    // Handler 2: Stop HTTP server
    async () => {
      console.log('Stopping HTTP server...');
      await new Promise((resolve) => server.close(resolve));
      console.log('Server stopped');
    },
  ],
});

// Add more handlers dynamically
shutdownManager.addCleanupHandler(async () => {
  console.log('Additional cleanup task...');
});
```

### Manual Shutdown

```typescript
import { ShutdownManager } from '@monorepo/shared';

const manager = new ShutdownManager({
  logger: (message) => console.log(message),
});

// Setup signal handlers
manager.setupGracefulShutdown({ timeout: 10000 });

// Trigger shutdown manually (e.g., in tests)
await manager.shutdown();
```

## Error Handling

### Normalized Errors

```typescript
import { DatabaseClient, db } from '@monorepo/shared';

try {
  await db.user.create({
    data: {
      telegramId: '123',
      username: 'duplicate',
    },
  });
} catch (error) {
  const normalized = DatabaseClient.normalizeError(error);
  console.error(normalized.message);
  // "Unique constraint violation: telegramId"
}
```

### Common Error Patterns

```typescript
import { DatabaseClient, db } from '@monorepo/shared';

async function handleDatabaseOperation() {
  try {
    const user = await db.user.update({
      where: { telegramId: 'nonexistent' },
      data: { username: 'test' },
    });
    return user;
  } catch (error) {
    const normalized = DatabaseClient.normalizeError(error);

    // Check error message
    if (normalized.message === 'Record not found') {
      // Handle not found case
      return null;
    }

    if (normalized.message.includes('Unique constraint violation')) {
      // Handle duplicate
      throw new Error('User already exists');
    }

    // Re-throw other errors
    throw normalized;
  }
}
```

### Error Callback

```typescript
import { DatabaseClient } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'api' });

DatabaseClient.initialize({
  logQueries: true,
  onError: (error, context) => {
    // Log error with context
    monitoring.logger.error(
      {
        error: error.message,
        context,
      },
      'Database operation failed'
    );

    // Track metrics
    monitoring.trackKPI({
      type: 'generation_failure',
      data: { errorType: error.name },
    });
  },
});
```

## Advanced Patterns

### Repository with Type Safety

```typescript
import { repository } from '@monorepo/shared';
import type { User, TokenOperation } from '@monorepo/shared';

// Typed pagination
const result = await repository.paginate<User>('user', {
  page: 1,
  limit: 10,
});

const users: User[] = result.data;

// Typed find
const user = await repository.findUnique<User>('user', {
  telegramId: '123',
});

if (user) {
  console.log(user.username);
}
```

### Custom Repository Class

```typescript
import { db, RepositoryHelpers } from '@monorepo/shared';
import type { User } from '@monorepo/shared';

class UserRepository extends RepositoryHelpers {
  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.findUnique<User>('user', { telegramId });
  }

  async findActiveUsers(page = 1, limit = 20) {
    return this.paginate<User>(
      'user',
      { page, limit, orderBy: { createdAt: 'desc' } },
      { tokensBalance: { gt: 0 } }
    );
  }

  async deductTokens(userId: string, amount: number): Promise<User> {
    return this.transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      if (user.tokensBalance < amount) {
        throw new Error('Insufficient tokens');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { tokensBalance: user.tokensBalance - amount },
      });

      await tx.tokenOperation.create({
        data: {
          userId,
          operationType: 'image_generation',
          tokensChange: -amount,
          balanceAfter: updated.tokensBalance,
        },
      });

      return updated;
    });
  }
}

// Usage
const userRepo = new UserRepository(db);
const user = await userRepo.findByTelegramId('123');
const activeUsers = await userRepo.findActiveUsers(1, 10);
await userRepo.deductTokens('user-id', 10);
```

### Testing with Database

```typescript
import { DatabaseClient, db } from '@monorepo/shared';

describe('UserService', () => {
  beforeAll(async () => {
    // Initialize database for tests
    DatabaseClient.initialize();
  });

  afterAll(async () => {
    // Cleanup
    await DatabaseClient.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.user.deleteMany({
      where: { telegramId: { startsWith: 'test-' } },
    });
  });

  it('should create user', async () => {
    const user = await db.user.create({
      data: {
        telegramId: 'test-123',
        username: 'testuser',
      },
    });

    expect(user).toBeDefined();
    expect(user.telegramId).toBe('test-123');
  });
});
```

## Best Practices

1. **Always use transactions for related operations**
   ```typescript
   // ✅ Good
   await repository.transaction(async (tx) => {
     await tx.user.update({ where: { id }, data: { tokensBalance } });
     await tx.tokenOperation.create({ data: { userId: id } });
   });

   // ❌ Bad
   await db.user.update({ where: { id }, data: { tokensBalance } });
   await db.tokenOperation.create({ data: { userId: id } });
   ```

2. **Use pagination for large datasets**
   ```typescript
   // ✅ Good
   const result = await repository.paginate('user', { page, limit });

   // ❌ Bad
   const users = await db.user.findMany(); // Could return thousands of records
   ```

3. **Handle errors gracefully**
   ```typescript
   // ✅ Good
   try {
     await db.user.create({ data });
   } catch (error) {
     const normalized = DatabaseClient.normalizeError(error);
     // Handle specific error cases
   }

   // ❌ Bad
   await db.user.create({ data }); // Unhandled error
   ```

4. **Always setup graceful shutdown**
   ```typescript
   // ✅ Good
   setupDatabaseShutdown({ timeout: 10000 });

   // ❌ Bad
   // No shutdown handler - may leave connections open
   ```

5. **Use soft validations to avoid exceptions**
   ```typescript
   // ✅ Good
   const exists = await repository.exists('user', { telegramId });
   if (!exists) {
     // Handle not found case
   }

   // ❌ Bad
   try {
     await db.user.findUniqueOrThrow({ where: { telegramId } });
   } catch (error) {
     // Exception handling is slower
   }
   ```
