# Migrating from SQL Scripts to Prisma

This document explains the migration from raw SQL scripts to Prisma ORM for database management.

## Overview

The project previously used raw SQL migrations in `scripts/db/migrations/`. We've now implemented Prisma ORM for type-safe database access and better developer experience.

## What Changed

### Before (SQL Scripts)

- Manual SQL files in `scripts/db/migrations/001_add_telegram_users.sql`
- No type safety
- Manual query writing
- No auto-completion
- Complex joins and relations

### After (Prisma)

- Type-safe Prisma Client with auto-generated types
- Schema-first approach with `prisma/schema.prisma`
- Automatic migration generation
- Full TypeScript support
- Intuitive query API

## Schema Mapping

The Prisma schema (`packages/database/prisma/schema.prisma`) implements the same database structure as the original SQL migration:

### Users Table

**SQL (before):**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  tier VARCHAR(50) NOT NULL DEFAULT 'Gift',
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  tokens_balance INTEGER NOT NULL DEFAULT 0,
  tokens_spent INTEGER NOT NULL DEFAULT 0,
  channel_subscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_tier CHECK (tier IN ('Gift', 'Professional', 'Business'))
);
```

**Prisma (after):**

```prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  telegramId String  @unique @map("telegram_id") @db.VarChar(255)
  username   String? @db.VarChar(255)
  firstName  String? @map("first_name") @db.VarChar(255)
  lastName   String? @map("last_name") @db.VarChar(255)

  tier                 SubscriptionTier @default(Gift)
  subscriptionExpiresAt DateTime?       @map("subscription_expires_at") @db.Timestamptz

  tokensBalance Int @default(0) @map("tokens_balance")
  tokensSpent   Int @default(0) @map("tokens_spent")

  channelSubscribedAt DateTime? @map("channel_subscribed_at") @db.Timestamptz

  // Relations
  tokenOperations      TokenOperation[]
  subscriptionHistory  SubscriptionHistory[]
  generations          Generation[]
  chatMessages         ChatMessage[]
  payments             Payment[]

  @@index([telegramId])
  @@index([tier])
  @@index([subscriptionExpiresAt])
  @@index([channelSubscribedAt])
  @@map("users")
}

enum SubscriptionTier {
  Gift
  Professional
  Business
}
```

### Key Improvements

1. **Type Safety**: Enum for SubscriptionTier instead of CHECK constraint
2. **Relations**: Explicit foreign key relationships
3. **Cascading**: Automatic ON DELETE CASCADE for related records
4. **Mapping**: Snake_case database columns mapped to camelCase TypeScript properties
5. **Auto-completion**: IDE support for all fields and relations

## Code Comparison

### Querying Users

**Before (Raw SQL):**

```typescript
const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
const user = result.rows[0];
// No type safety, manual row parsing
```

**After (Prisma):**

```typescript
import { db } from '@monorepo/database';

const user = await db.user.findUnique({
  where: { telegramId },
  include: {
    tokenOperations: true,
    subscriptionHistory: true,
  },
});
// Full type safety, auto-completion, relations included
```

### Creating Users

**Before (Raw SQL):**

```typescript
await pool.query(
  `INSERT INTO users (telegram_id, username, first_name, tier, tokens_balance)
   VALUES ($1, $2, $3, $4, $5)`,
  [telegramId, username, firstName, 'Gift', 100]
);
```

**After (Prisma):**

```typescript
const user = await db.user.create({
  data: {
    telegramId,
    username,
    firstName,
    tier: 'Gift',
    tokensBalance: 100,
  },
});
```

### Complex Queries with Joins

**Before (Raw SQL):**

```typescript
const result = await pool.query(
  `
  SELECT u.*, COUNT(to.id) as operation_count
  FROM users u
  LEFT JOIN token_operations to ON u.id = to.user_id
  WHERE u.tier = $1
  GROUP BY u.id
`,
  ['Professional']
);
```

**After (Prisma):**

```typescript
const users = await db.user.findMany({
  where: { tier: 'Professional' },
  include: {
    tokenOperations: {
      select: { id: true },
    },
  },
});
// Count in memory or use aggregation
const usersWithCount = users.map((user) => ({
  ...user,
  operationCount: user.tokenOperations.length,
}));
```

## New Features in Prisma Schema

The Prisma schema includes additional models not in the original SQL:

### Generation Model

Tracks AI generation requests:

```prisma
model Generation {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tool      GenerationTool
  status    GenerationStatus
  prompt    String
  resultUrls String[]
  tokensUsed Int
  // ... more fields
}
```

### ChatMessage Model

Stores chat message history:

```prisma
model ChatMessage {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  role      String   // 'user', 'assistant', 'system'
  content   String
  tokensUsed Int?
  conversationId String?
  // ... more fields
}
```

### Payment Model

Tracks payment processing:

```prisma
model Payment {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  provider      PaymentProvider
  status        PaymentStatus
  amountRubles  Int
  externalId    String   @unique
  subscriptionTier SubscriptionTier?
  // ... more fields
}
```

### SubscriptionTierConfig Model

Stores tier configuration:

```prisma
model SubscriptionTierConfig {
  tier              SubscriptionTier @unique
  monthlyTokens     Int
  priceRubles       Int?
  requestsPerMinute Int
  burstPerSecond    Int
  requiresChannel   Boolean
  description       String
  // ... more fields
}
```

## Migration Path

### If Starting Fresh

1. Drop existing database (if needed)
2. Run Prisma migrations:
   ```bash
   pnpm db:migrate:deploy
   ```
3. Seed database:
   ```bash
   pnpm db:seed
   ```

### If Migrating Existing Data

1. **Backup your database:**

   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Generate initial Prisma migration from existing schema:**

   ```bash
   cd packages/database
   pnpm prisma db pull          # Pull schema from database
   pnpm prisma migrate dev --name initial_from_db
   ```

3. **Verify migration matches existing schema**

4. **Test with a copy of production data**

5. **Deploy to production:**
   ```bash
   pnpm db:migrate:deploy
   ```

## Breaking Changes

### Field Name Changes

Database columns remain unchanged, but TypeScript property names use camelCase:

| Database Column           | TypeScript Property     |
| ------------------------- | ----------------------- |
| `telegram_id`             | `telegramId`            |
| `first_name`              | `firstName`             |
| `last_name`               | `lastName`              |
| `tokens_balance`          | `tokensBalance`         |
| `tokens_spent`            | `tokensSpent`           |
| `subscription_expires_at` | `subscriptionExpiresAt` |
| `channel_subscribed_at`   | `channelSubscribedAt`   |

### Enum Changes

The `tier` field now uses a TypeScript enum:

```typescript
import { SubscriptionTier } from '@monorepo/database';

// Before
const tier = 'Professional';

// After
const tier = SubscriptionTier.Professional;
```

### Query API Changes

All database queries now use Prisma Client API instead of raw SQL.

## Benefits of Prisma

### 1. Type Safety

```typescript
// TypeScript knows all fields and their types
const user = await db.user.findUnique({ where: { telegramId: '123' } });
user.tokensBalance; // number
user.firstName; // string | null
user.tier; // SubscriptionTier enum
```

### 2. Auto-completion

Your IDE provides suggestions for:

- Model names
- Field names
- Query methods
- Relations

### 3. Relations

```typescript
// Load user with all relations in one query
const user = await db.user.findUnique({
  where: { telegramId: '123' },
  include: {
    tokenOperations: true,
    subscriptionHistory: true,
    generations: true,
    chatMessages: true,
    payments: true,
  },
});
```

### 4. Migrations

```bash
# Automatic migration generation
pnpm db:migrate:dev

# No need to write SQL by hand
```

### 5. Seeding

```bash
# Consistent test data
pnpm db:seed
```

### 6. Prisma Studio

```bash
# Visual database browser
pnpm db:studio
```

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Database Package README](../packages/database/README.md)
- [Migration Workflow](./PRISMA_MIGRATION_WORKFLOW.md)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
