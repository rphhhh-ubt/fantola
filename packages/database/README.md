# @monorepo/database

Database package with Prisma ORM for PostgreSQL. Provides type-safe database access, migrations, and seeding for the entire monorepo.

## Features

- 🗄️ **Prisma ORM** - Type-safe database access with auto-generated types
- 🔄 **Migrations** - Version-controlled database schema changes
- 🌱 **Seeding** - Automated seed scripts for subscription tiers and test data
- 📊 **Models** - Complete data model for Users, Subscriptions, Generations, Payments, ChatMessages
- 🔐 **Type Safety** - Full TypeScript support with Prisma Client types
- 🎯 **Relations** - Properly defined foreign keys and cascading deletes

## Schema Overview

### Core Models

#### User
- Telegram user information (telegram_id, username, first_name, last_name)
- Subscription tier (Gift, Professional, Business)
- Token balance and spending tracking
- Channel subscription tracking for Gift tier

#### TokenOperation
- Audit log for all token operations
- Operation types: image_generation, sora_image, chatgpt_message, refund, purchase, monthly_reset
- Balance tracking (before/after)

#### SubscriptionHistory
- History of all subscription changes and purchases
- Price and payment method tracking
- Start and expiration dates

#### Generation
- AI generation tracking (DALL-E, Sora, Stable Diffusion, ChatGPT)
- Prompt and result storage
- Status tracking (pending, processing, completed, failed)
- Token usage tracking

#### ChatMessage
- Chat message history
- Conversation grouping
- Token usage per message

#### Payment
- Payment processing tracking
- Multiple providers (YooKassa, Stripe, manual)
- Status tracking (pending, succeeded, failed, canceled, refunded)
- External provider ID mapping

#### SubscriptionTierConfig
- Subscription tier configuration metadata
- Monthly token allocations
- Rate limiting parameters
- Pricing information
- Feature descriptions

### Enums

- **SubscriptionTier**: Gift, Professional, Business
- **OperationType**: image_generation, sora_image, chatgpt_message, refund, purchase, monthly_reset
- **PaymentStatus**: pending, succeeded, failed, canceled, refunded
- **PaymentProvider**: yookassa, stripe, manual
- **GenerationTool**: dalle, sora, stable_diffusion, chatgpt
- **GenerationStatus**: pending, processing, completed, failed, canceled

## Installation

```bash
pnpm install
```

## Configuration

Set the `DATABASE_URL` environment variable in your `.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/monorepo_dev
```

The connection string format is:
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

## Usage

### Import in Your Code

```typescript
import { db, PrismaClient, SubscriptionTier, OperationType } from '@monorepo/database';

// Use the singleton client
const users = await db.user.findMany();

// Or create a new client
import { createPrismaClient } from '@monorepo/database';
const prisma = createPrismaClient();
```

### Type Helpers

```typescript
import type { UserWithRelations, GenerationWithUser } from '@monorepo/database';

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

## Migration Workflow

### 1. Generate Prisma Client

After schema changes, regenerate the Prisma Client:

```bash
pnpm prisma:generate
```

This happens automatically during `pnpm build`.

### 2. Create a Migration (Development)

When you modify `prisma/schema.prisma`, create a new migration:

```bash
pnpm prisma:migrate:dev
```

This will:
1. Create a new migration file in `prisma/migrations/`
2. Apply the migration to your development database
3. Regenerate Prisma Client

You'll be prompted to name your migration (e.g., "add_user_fields").

### 3. Apply Migrations (Production)

In production or CI/CD, apply pending migrations without prompts:

```bash
pnpm prisma:migrate:deploy
```

### 4. Reset Database (Development Only)

⚠️ **WARNING**: This will drop all data!

```bash
pnpm prisma:migrate:reset
```

This will:
1. Drop the database
2. Create a new database
3. Apply all migrations
4. Run the seed script

### 5. Push Schema (Prototyping)

For rapid prototyping without creating migration files:

```bash
pnpm db:push
```

⚠️ Use only in development! Use migrations for production.

## Seeding

### Run Seed Script

```bash
pnpm db:seed
```

The seed script will:
1. Create/update subscription tier configurations (Gift, Professional, Business)
2. Create test users with different tiers
3. Display summary of seeded data

### Seed Data

The seed creates:

**Subscription Tiers:**
- **Gift**: 100 tokens/month, Free, requires channel subscription
  - 10 requests/minute, 3 burst/second
- **Professional**: 2000 tokens/month, 1990₽
  - 50 requests/minute, 10 burst/second
- **Business**: 10000 tokens/month, 3490₽
  - 100 requests/minute, 20 burst/second

**Token Costs:**
- Image Generation (DALL-E, Stable Diffusion): 10 tokens
- Sora Video: 10 tokens
- ChatGPT Message: 5 tokens

**Test Users:**
- testuser1 (telegram_id: 123456789) - Gift tier, 100 tokens
- testuser2 (telegram_id: 987654321) - Professional tier, 2000 tokens
- testuser3 (telegram_id: 555555555) - Business tier, 10000 tokens

## Prisma Studio

Open Prisma Studio to view and edit database data:

```bash
pnpm prisma:studio
```

This will open a web interface at http://localhost:5555

## Available Scripts

- `pnpm build` - Generate Prisma Client and build TypeScript
- `pnpm prisma:generate` - Generate Prisma Client
- `pnpm prisma:migrate:dev` - Create and apply new migration
- `pnpm prisma:migrate:deploy` - Apply pending migrations (production)
- `pnpm prisma:migrate:reset` - Reset database and run seed
- `pnpm prisma:studio` - Open Prisma Studio
- `pnpm db:push` - Push schema changes without migration
- `pnpm db:seed` - Run seed script
- `pnpm test` - Run tests
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm lint` - Run ESLint

## Development Workflow

### Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Create migration: `pnpm prisma:migrate:dev`
3. Name your migration descriptively
4. Commit the migration file with your code

### Testing Schema Changes

```bash
# Reset database to clean state
pnpm prisma:migrate:reset

# Run seed to populate test data
pnpm db:seed

# View data in Prisma Studio
pnpm prisma:studio
```

### Adding to Services

Add as dependency in service `package.json`:

```json
{
  "dependencies": {
    "@monorepo/database": "workspace:*"
  }
}
```

Update service `tsconfig.json`:

```json
{
  "references": [
    { "path": "../../packages/database" }
  ]
}
```

## CI/CD Integration

### Build Process

The `prisma generate` command is automatically run during `pnpm build`:

```json
{
  "scripts": {
    "build": "pnpm prisma:generate && tsc"
  }
}
```

### Environment Variables

Ensure `DATABASE_URL` is set in your CI/CD environment:

```yaml
# Example GitHub Actions
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Migration Deployment

In your deployment pipeline:

```bash
# Apply pending migrations
pnpm --filter @monorepo/database prisma:migrate:deploy

# Optionally run seed (first deployment only)
pnpm --filter @monorepo/database db:seed
```

## Best Practices

### Migrations

1. ✅ **Always create migrations** - Don't use `db:push` in production
2. ✅ **Name migrations descriptively** - "add_user_tier" not "migration1"
3. ✅ **Test migrations** - Reset and migrate before committing
4. ✅ **Commit migration files** - Include in version control
5. ❌ **Don't edit migrations** - Create a new one if changes are needed

### Schema Design

1. ✅ **Use enums** - For fixed value sets
2. ✅ **Add indexes** - For frequently queried columns
3. ✅ **Use cascading deletes** - For dependent data
4. ✅ **Add constraints** - For data integrity
5. ✅ **Use meaningful names** - Follow snake_case for database, camelCase for code

### Type Safety

1. ✅ **Use generated types** - Import from @prisma/client
2. ✅ **Use type helpers** - UserWithRelations, etc.
3. ✅ **Avoid any types** - Use Prisma's type inference
4. ✅ **Use strict mode** - Enable in tsconfig.json

## Troubleshooting

### "Cannot find module '@prisma/client'"

Run `pnpm prisma:generate` to generate the client.

### "Database does not exist"

Create the database manually or use docker-compose:

```bash
docker-compose up -d postgres
```

### "Migration is in a failed state"

Mark the migration as rolled back and reapply:

```bash
npx prisma migrate resolve --rolled-back <migration-name>
pnpm prisma:migrate:deploy
```

### Schema Changes Not Reflected

1. Regenerate client: `pnpm prisma:generate`
2. Rebuild package: `pnpm build`
3. Restart services

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
