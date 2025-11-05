# Prisma Migration Workflow

This document describes the database migration workflow using Prisma ORM in this monorepo.

## Overview

We use Prisma as our database ORM layer with PostgreSQL as the database. The `@monorepo/database` package contains:

- Prisma schema definition
- Migration files
- Seed scripts
- Type-safe database client
- Database utilities

## Quick Start

### Initial Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Start PostgreSQL:**

   ```bash
   docker compose up -d postgres
   ```

3. **Generate Prisma Client:**

   ```bash
   pnpm db:generate
   ```

4. **Apply migrations:**

   ```bash
   pnpm db:migrate:deploy
   ```

5. **Seed the database:**
   ```bash
   pnpm db:seed
   ```

## Development Workflow

### Making Schema Changes

When you need to modify the database schema:

1. **Edit the schema:**

   ```bash
   # Edit packages/database/prisma/schema.prisma
   vim packages/database/prisma/schema.prisma
   ```

2. **Create and apply migration:**

   ```bash
   pnpm db:migrate:dev
   ```

   You'll be prompted to name your migration. Use a descriptive name like:
   - `add_user_avatar_field`
   - `create_notifications_table`
   - `add_payment_status_index`

3. **Review the generated migration:**

   ```bash
   cat packages/database/prisma/migrations/[timestamp]_[name]/migration.sql
   ```

4. **Test the migration:**

   ```bash
   # Reset database to clean state
   pnpm db:migrate:reset

   # Run seed to populate test data
   pnpm db:seed

   # Verify in Prisma Studio
   pnpm db:studio
   ```

5. **Commit the migration:**
   ```bash
   git add packages/database/prisma/migrations/
   git add packages/database/prisma/schema.prisma
   git commit -m "feat: add user avatar field"
   ```

### Commands

All database commands can be run from the root of the monorepo:

#### Generate Prisma Client

```bash
pnpm db:generate
```

Generates TypeScript types from the Prisma schema. Run this after:

- Cloning the repository
- Pulling schema changes
- Modifying the schema

#### Create Migration (Development)

```bash
pnpm db:migrate:dev
```

Creates a new migration file and applies it. Use during development when making schema changes.

#### Apply Migrations (Production)

```bash
pnpm db:migrate:deploy
```

Applies pending migrations without prompts. Use in:

- CI/CD pipelines
- Production deployments
- Staging environments

#### Reset Database (Development Only)

```bash
pnpm db:migrate:reset
```

⚠️ **WARNING**: This will:

1. Drop all data
2. Recreate the database
3. Apply all migrations
4. Run seed script

Only use in development!

#### Seed Database

```bash
pnpm db:seed
```

Populates the database with:

- Subscription tier configurations (Gift, Professional, Business)
- Test users with different tiers

#### Open Prisma Studio

```bash
pnpm db:studio
```

Opens a web UI at http://localhost:5555 to view and edit database data.

## Production Deployment

### Pre-deployment Checklist

- [ ] All migrations are committed to version control
- [ ] Migrations have been tested in development
- [ ] Migrations have been tested in staging
- [ ] Backup plan is in place
- [ ] Rollback plan is prepared

### Deployment Steps

1. **Backup the database:**

   ```bash
   # Using docker
   docker exec monorepo-postgres pg_dump -U postgres monorepo_prod > backup.sql

   # Or using pg_dump directly
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Deploy code:**

   ```bash
   git pull origin main
   pnpm install
   ```

3. **Apply migrations:**

   ```bash
   pnpm db:migrate:deploy
   ```

4. **Verify deployment:**

   ```bash
   # Check migration status
   cd packages/database
   pnpm prisma migrate status
   ```

5. **Seed (first deployment only):**
   ```bash
   pnpm db:seed
   ```

### Rollback

If a migration fails or causes issues:

1. **Restore from backup:**

   ```bash
   # Stop services
   docker compose down

   # Restore database
   docker compose up -d postgres
   cat backup.sql | docker exec -i monorepo-postgres psql -U postgres monorepo_prod
   ```

2. **Revert code:**

   ```bash
   git revert [commit-hash]
   ```

3. **Mark migration as rolled back:**
   ```bash
   cd packages/database
   npx prisma migrate resolve --rolled-back [migration-name]
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        run: npm install -g pnpm@8

      - name: Install dependencies
        run: pnpm install

      - name: Generate Prisma Client
        run: pnpm db:generate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Apply migrations
        run: pnpm db:migrate:deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Build
        run: pnpm build
```

### Railway Example

Add to `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm db:generate && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm db:migrate:deploy && pnpm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Schema Structure

### Core Models

#### User

- Telegram user information
- Subscription tier management
- Token balance tracking
- Channel subscription status

#### TokenOperation

- Audit log for token operations
- Balance tracking (before/after)
- Operation types: generation, refund, purchase, monthly reset

#### SubscriptionHistory

- Subscription purchase history
- Price and payment method tracking
- Start and expiration dates

#### Generation

- AI generation tracking (DALL-E, Sora, Stable Diffusion, ChatGPT)
- Prompt and result storage
- Status tracking
- Token usage

#### ChatMessage

- Chat message history
- Conversation grouping
- Token usage per message

#### Payment

- Payment processing tracking
- Multiple provider support (YooKassa, Stripe)
- Status tracking and external ID mapping

#### SubscriptionTierConfig

- Subscription tier metadata
- Monthly token allocations
- Rate limiting parameters
- Pricing information

## Best Practices

### DO ✅

- **Always create migrations** for schema changes
- **Name migrations descriptively** (e.g., "add_user_avatar")
- **Test migrations locally** before committing
- **Commit migration files** with your code changes
- **Review generated SQL** before applying
- **Backup before migrations** in production
- **Use `db:migrate:deploy`** in production
- **Run `db:generate`** after schema changes

### DON'T ❌

- **Don't edit migration files** after they're applied
- **Don't use `db:push`** in production
- **Don't skip migrations** (use sequential order)
- **Don't delete migrations** that have been applied
- **Don't modify applied migrations** (create a new one)
- **Don't commit `node_modules`** or `.prisma/client`
- **Don't forget to run `db:generate`** in CI/CD

## Troubleshooting

### "Cannot find module '@prisma/client'"

**Solution:**

```bash
pnpm db:generate
```

### "Database does not exist"

**Solution:**

```bash
# Using docker-compose
docker compose up -d postgres

# Or create manually
createdb monorepo_dev
```

### "Migration is in a failed state"

**Solution:**

```bash
cd packages/database

# Mark as rolled back
npx prisma migrate resolve --rolled-back [migration-name]

# Try again
pnpm prisma:migrate:deploy
```

### Schema changes not reflected in TypeScript

**Solution:**

```bash
# Regenerate client
pnpm db:generate

# Rebuild database package
cd packages/database
pnpm build

# Restart TypeScript server in your IDE
```

### "The migration is already applied"

This is normal when migrations are already in sync with the database.

### "Error: P1001 Can't reach database server"

**Solution:**

- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check network connectivity
- Verify credentials

## Environment Variables

### Required

```env
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
```

### Examples

**Development:**

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/monorepo_dev
```

**Production:**

```env
DATABASE_URL=postgresql://user:password@prod-host:5432/monorepo_prod
```

**Docker:**

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/monorepo
```

## Using the Database in Services

### Install as Dependency

Add to service `package.json`:

```json
{
  "dependencies": {
    "@monorepo/database": "workspace:*"
  }
}
```

### Import in Code

```typescript
import { db, PrismaClient, SubscriptionTier } from '@monorepo/database';

// Use singleton client
const users = await db.user.findMany({
  where: { tier: SubscriptionTier.Professional },
});

// Or create new client
import { createPrismaClient } from '@monorepo/database';
const prisma = createPrismaClient();
```

### Type Helpers

```typescript
import type { UserWithRelations } from '@monorepo/database';

const user: UserWithRelations = await db.user.findUnique({
  where: { telegramId: '123456789' },
  include: {
    tokenOperations: true,
    subscriptionHistory: true,
    generations: true,
    chatMessages: true,
    payments: true,
  },
});
```

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Database Package README](../packages/database/README.md)
