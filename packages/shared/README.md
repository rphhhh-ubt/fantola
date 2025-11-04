# @monorepo/shared

Shared utilities and database access layer for all services in the monorepo.

## Features

- **Database Client**: Singleton Prisma client with logging and error normalization
- **Repository Helpers**: Reusable patterns for transactions, pagination, and soft validations
- **Graceful Shutdown**: Automatic database disconnection on process termination
- **Utility Functions**: Common helpers like `formatDate`, `isValidEmail`

## Installation

This package is already included in the monorepo workspace. Services can use it by adding to their `package.json`:

```json
{
  "dependencies": {
    "@monorepo/shared": "workspace:*"
  }
}
```

## Database Client

### Initialization

```typescript
import { DatabaseClient } from '@monorepo/shared';

// Initialize with options
DatabaseClient.initialize({
  logQueries: true,
  onError: (error, context) => {
    console.error('Database error:', error);
  },
});
```

### Using the Singleton

```typescript
import { db } from '@monorepo/shared';

// Query users
const users = await db.user.findMany();

// Create user
const user = await db.user.create({
  data: {
    telegramId: '123',
    username: 'testuser',
  },
});
```

### Error Normalization

The client automatically normalizes Prisma errors to user-friendly messages:

```typescript
import { DatabaseClient } from '@monorepo/shared';

try {
  await db.user.create({ data: { /* ... */ } });
} catch (error) {
  const normalizedError = DatabaseClient.normalizeError(error);
  console.error(normalizedError.message); // "Unique constraint violation: username"
}
```

## Repository Helpers

### Pagination

```typescript
import { repository } from '@monorepo/shared';

const result = await repository.paginate('user', {
  page: 1,
  limit: 10,
  orderBy: { createdAt: 'desc' },
});

console.log(result.data); // User records
console.log(result.pagination); // Metadata
// {
//   page: 1,
//   limit: 10,
//   total: 42,
//   totalPages: 5,
//   hasNext: true,
//   hasPrev: false
// }
```

### Transactions

```typescript
import { repository } from '@monorepo/shared';

const result = await repository.transaction(async (tx) => {
  const user = await tx.user.create({ data: { /* ... */ } });
  await tx.tokenOperation.create({ data: { userId: user.id /* ... */ } });
  return user;
});
```

With custom options:

```typescript
const result = await repository.transaction(
  async (tx) => {
    // Your transaction logic
  },
  {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: 'ReadCommitted',
  }
);
```

### Soft Validations

Check if records exist without throwing errors:

```typescript
// Check existence
const exists = await repository.exists('user', {
  telegramId: '123',
});

// Find unique record
const user = await repository.findUnique('user', {
  telegramId: '123',
});

if (!user) {
  // Handle not found
}

// Find first matching record
const firstUser = await repository.findFirst('user', {
  subscriptionTier: 'Professional',
});
```

### Batch Operations

```typescript
// Batch create
const users = [
  { telegramId: '1', username: 'user1' },
  { telegramId: '2', username: 'user2' },
];

await repository.batchCreate('user', users, 100);

// Upsert
const user = await repository.upsert(
  'user',
  { telegramId: '123' },
  { telegramId: '123', username: 'newuser' },
  { username: 'updateduser' }
);

// Count
const count = await repository.count('user', {
  subscriptionTier: 'Professional',
});

// Soft delete
await repository.softDelete('user', { id: 'user-id' });
```

## Graceful Shutdown

### Basic Setup

```typescript
import { setupDatabaseShutdown } from '@monorepo/shared';

setupDatabaseShutdown({
  timeout: 10000,
  logger: (message) => console.log(message),
});
```

### With Custom Cleanup Handlers

```typescript
import { setupDatabaseShutdown } from '@monorepo/shared';

const shutdownManager = setupDatabaseShutdown({
  timeout: 15000,
  logger: (message) => console.log(message),
  cleanupHandlers: [
    async () => {
      console.log('Stopping job queue...');
      await queue.close();
    },
    async () => {
      console.log('Closing HTTP server...');
      await server.close();
    },
  ],
});

// Add more handlers later
shutdownManager.addCleanupHandler(async () => {
  console.log('Additional cleanup...');
});
```

### Manual Shutdown

```typescript
import { ShutdownManager } from '@monorepo/shared';

const manager = new ShutdownManager({
  logger: (message) => console.log(message),
});

// Trigger shutdown manually
await manager.shutdown();
```

## Service Integration

### API Service Example

```typescript
import { getApiConfig } from '@monorepo/config';
import { DatabaseClient, setupDatabaseShutdown } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';

async function main() {
  const config = getApiConfig();
  const monitoring = new Monitoring({ service: 'api' });

  // Initialize database
  DatabaseClient.initialize({
    logQueries: config.nodeEnv === 'development',
    onError: (error, context) => {
      monitoring.handleError(error, context);
    },
  });

  // Setup graceful shutdown
  setupDatabaseShutdown({
    timeout: 10000,
    logger: (message) => monitoring.logger.info(message),
    cleanupHandlers: [
      async () => {
        monitoring.logger.info('Stopping API server...');
        // Add cleanup logic
      },
    ],
  });

  // Start your service
}

main().catch(console.error);
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm --filter @monorepo/shared test

# Run with coverage
pnpm --filter @monorepo/shared test:coverage

# Watch mode
pnpm --filter @monorepo/shared test:watch
```

### Running with Dockerized Postgres

```bash
# Start test database
docker-compose -f docker-compose.test.yml up postgres-test -d

# Wait for health check
docker-compose -f docker-compose.test.yml ps

# Run migrations
pnpm db:migrate:deploy

# Run tests
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/monorepo_test pnpm --filter @monorepo/shared test

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Smoke Tests

The package includes smoke tests that verify database connectivity:

```bash
# Run only smoke tests
pnpm --filter @monorepo/shared test db-connectivity
```

## Type Exports

All Prisma types and models are re-exported for convenience:

```typescript
import {
  PrismaClient,
  User,
  SubscriptionTier,
  OperationType,
  // ... all other Prisma types
} from '@monorepo/shared';
```

## API Reference

### DatabaseClient

- `initialize(options?)` - Initialize the database client
- `getInstance()` - Get the singleton instance
- `disconnect()` - Disconnect from database
- `isConnected()` - Check connection status
- `normalizeError(error)` - Normalize Prisma errors

### RepositoryHelpers

- `transaction(callback, options?)` - Execute a transaction
- `paginate(model, options?, where?, include?)` - Paginate query results
- `exists(model, where)` - Check if record exists
- `findUnique(model, where, include?)` - Find unique record
- `findFirst(model, where, include?)` - Find first matching record
- `batchCreate(model, data, chunkSize?)` - Batch create records
- `upsert(model, where, create, update)` - Create or update record
- `softDelete(model, where, deletedAtField?)` - Soft delete record
- `count(model, where?)` - Count records

### ShutdownManager

- `constructor(options?)` - Create shutdown manager
- `setupGracefulShutdown(options?)` - Setup signal handlers
- `addCleanupHandler(handler)` - Add cleanup handler
- `shutdown()` - Manually trigger shutdown

## Environment Variables

The database client uses the following environment variables:

- `NODE_ENV` - Node environment (development, test, production)
- `DATABASE_URL` - PostgreSQL connection string

Example `.env`:

```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/monorepo_dev
```

## Best Practices

1. **Initialize Once**: Call `DatabaseClient.initialize()` at application startup
2. **Use Singleton**: Import `db` for queries instead of creating new clients
3. **Setup Shutdown**: Always call `setupDatabaseShutdown()` in service entry points
4. **Handle Errors**: Use error normalization for user-friendly messages
5. **Use Transactions**: Wrap related operations in transactions for consistency
6. **Paginate Queries**: Use pagination helpers for large result sets
7. **Test with Docker**: Run tests against real Postgres using docker-compose

## Troubleshooting

### Connection Issues

If you encounter connection issues:

1. Check `DATABASE_URL` environment variable
2. Ensure Postgres is running: `docker-compose ps`
3. Verify network connectivity: `pg_isready -h localhost -p 5432`
4. Check Prisma schema: `pnpm db:generate`

### Type Errors

If you see TypeScript errors:

1. Regenerate Prisma client: `pnpm db:generate`
2. Rebuild package: `pnpm --filter @monorepo/shared build`
3. Clear TypeScript cache: `rm -rf dist`

### Test Failures

If tests fail:

1. Ensure test database is running
2. Run migrations: `pnpm db:migrate:deploy`
3. Check database URL in `.env.test`
4. Reset database: `pnpm db:migrate:reset`

## Contributing

When adding new features to the database access layer:

1. Add types and implementations
2. Write comprehensive tests
3. Update this README
4. Test with all services (api, bot, worker)
