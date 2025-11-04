# User Onboarding Flow

This document describes the comprehensive user onboarding implementation for the Telegram bot service.

## Overview

The onboarding flow handles both new and returning users, automatically managing monthly gift token allocation for users on the Gift tier. The system tracks token claims, prevents duplicate rewards, and provides contextual welcome messages based on user status.

## Key Features

- **Automatic User Registration**: Users are created in the database on first interaction
- **Monthly Gift Tokens**: Gift tier users receive 100 tokens monthly
- **Eligibility Tracking**: System tracks last gift claim timestamp to prevent abuse
- **Smart Token Renewal**: Automatically awards tokens after 30+ days
- **Contextual Messaging**: Different messages for new users, returning users, and monthly renewals
- **Audit Trail**: All token operations logged in `token_operations` table

## Database Schema

### User Model Fields

```typescript
{
  id: string;                      // UUID
  telegramId: string;              // Telegram user ID
  username?: string;               // Telegram username
  firstName?: string;              // First name
  lastName?: string;               // Last name
  tier: SubscriptionTier;          // Gift, Professional, Business
  tokensBalance: number;           // Current token balance
  tokensSpent: number;             // Total tokens spent
  lastGiftClaimAt?: Date;          // Last gift token claim timestamp
  channelSubscribedAt?: Date;      // Channel subscription timestamp
  subscriptionExpiresAt?: Date;    // Paid subscription expiration
  createdAt: Date;
  updatedAt: Date;
}
```

### Token Operation Model

```typescript
{
  id: string;
  userId: string;
  operationType: OperationType;    // monthly_reset for gifts
  tokensAmount: number;            // Amount awarded
  balanceBefore: number;           // Balance before operation
  balanceAfter: number;            // Balance after operation
  metadata?: {
    source: 'monthly_gift';
    tier: SubscriptionTier;
  };
  createdAt: Date;
}
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User sends /start                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            Auth Middleware: Load/Create User                 │
│  • Find user by telegram_id                                  │
│  • If not found, create with Gift tier, 0 tokens            │
│  • Attach user to context                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Process Onboarding: Check Eligibility              │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
┌────────────────┐          ┌──────────────────┐
│   New User?    │          │  Returning User  │
│ (no lastGift)  │          │ (has lastGift)   │
└───────┬────────┘          └────────┬─────────┘
        │                            │
        ▼                            ▼
┌────────────────┐          ┌──────────────────┐
│ Award 100      │          │ Check Eligibility│
│ tokens         │          │ (30+ days?)      │
└───────┬────────┘          └────────┬─────────┘
        │                            │
        ▼                   ┌────────┴────────┐
┌────────────────┐          │                 │
│ Set lastGift   │          ▼                 ▼
│ Create audit   │   ┌─────────────┐   ┌──────────┐
│ log            │   │ Award 100   │   │ No Award │
└───────┬────────┘   │ tokens      │   └────┬─────┘
        │            └──────┬──────┘        │
        │                   │               │
        └───────────┬───────┘               │
                    ▼                       │
          ┌──────────────────┐              │
          │ Welcome Message  │              │
          │ + Main Menu      │◄─────────────┘
          └──────────────────┘
```

## User States

### 1. Brand New User
- **Condition**: `lastGiftClaimAt === null && tier === Gift`
- **Action**: Award 100 tokens, set `lastGiftClaimAt`
- **Message**: Welcome message with token award notification

### 2. Returning User - Monthly Renewal
- **Condition**: `lastGiftClaimAt >= 30 days ago && tier === Gift`
- **Action**: Award 100 tokens, update `lastGiftClaimAt`
- **Message**: Monthly renewal message

### 3. Returning User - Same Month
- **Condition**: `lastGiftClaimAt < 30 days ago && tier === Gift`
- **Action**: No token award
- **Message**: Welcome back with days until next renewal

### 4. Paid Tier User
- **Condition**: `tier === Professional || tier === Business`
- **Action**: No token award (managed separately)
- **Message**: Welcome back with current balance

## Implementation

### Core Service: `onboarding-service.ts`

```typescript
// Check if user is eligible for monthly gift
export function checkGiftEligibility(user: User): GiftEligibilityCheck;

// Award gift tokens with transaction
export async function awardGiftTokens(userId: string, amount: number): Promise<User>;

// Main onboarding processor
export async function processUserOnboarding(user: User): Promise<OnboardingResult>;
```

### Integration in `/start` Command

```typescript
import { processUserOnboarding } from '../services';

export async function handleStart(ctx: CommandContext<BotContext>, monitoring: Monitoring) {
  const onboardingResult = await processUserOnboarding(ctx.user);
  
  // Track KPIs
  monitoring.trackKPI({ type: 'active_user', data: { ... } });
  
  // Send contextual message
  await ctx.reply(onboardingResult.message, {
    parse_mode: 'Markdown',
    reply_markup: buildMainMenuKeyboard(),
  });
}
```

## Token Cost Reference

| Operation | Cost | Description |
|-----------|------|-------------|
| DALL-E Image | 10 tokens | AI image generation |
| Sora Video | 10 tokens | AI video generation |
| ChatGPT Message | 5 tokens | Per message |

With 100 gift tokens, users can:
- Generate 10 images
- Generate 10 videos  
- Send 20 chat messages
- Or any combination

## Message Examples

### New User Welcome

```
🎉 Welcome to AI Bot!

Hello Test! Your account has been created successfully.

✨ You've received 100 free tokens!

🎯 What you can do:
• 🎨 Generate images with DALL-E (10 tokens)
• 🎬 Create videos with Sora (10 tokens)
• 💬 Chat with GPT-4 (5 tokens per message)

📋 Your Current Plan: Gift
💰 Token Balance: 100

⚠️ Important: To use the free tier, you need to subscribe to our channel.
Use /subscription to learn more and subscribe.

Use the menu below to get started! 👇
```

### Monthly Renewal

```
🎁 Monthly Tokens Renewed!

Welcome back, Test!

You've received your monthly 100 tokens! 🎉

📋 Your Current Plan: Gift
💰 Token Balance: 100

⚠️ Remember: Make sure you're subscribed to our channel to continue using the free tier.

Ready to create something amazing? 🚀
```

### Returning User (No Award)

```
👋 Welcome back, Test!

📋 Your Current Plan: Gift
💰 Token Balance: 45

🎁 Next monthly tokens: 15 days
⚠️ Remember: Keep your channel subscription active to continue using the free tier.

Use the menu below to continue! 👇
```

## Testing

Comprehensive test suite covering:

### Unit Tests
- ✅ Gift eligibility checking (new user, 30+ days, recent claim, non-Gift tier)
- ✅ Token awarding logic
- ✅ Error handling (user not found)

### Integration Tests  
- ✅ New user onboarding flow
- ✅ Monthly token renewal (30+ days)
- ✅ Returning user (no award)
- ✅ Professional tier user handling
- ✅ Message content validation
- ✅ Channel subscription reminders
- ✅ Token cost display
- ✅ Upgrade suggestions

Run tests:
```bash
cd services/bot
pnpm test onboarding.test.ts
```

## Configuration

### Subscription Tier Config

Gift tier configuration stored in `subscription_tier_config` table:

```typescript
{
  tier: SubscriptionTier.Gift,
  monthlyTokens: 100,
  priceRubles: null,
  requestsPerMinute: 10,
  burstPerSecond: 3,
  requiresChannel: true,
  description: 'Free tier with 100 tokens per month',
  isActive: true
}
```

### Token Renewal Period

Currently hardcoded to **30 days**. Can be made configurable:

```typescript
// In onboarding-service.ts
const GIFT_RENEWAL_DAYS = 30; // Make this configurable via env var
```

## Monitoring & Metrics

### KPIs Tracked

```typescript
monitoring.trackKPI({
  type: 'active_user',
  data: {
    userId: string,
    telegramId: string,
    username: string,
    isNewUser: boolean,
    tokensAwarded: number,
  }
});
```

### Logs

```typescript
monitoring.logger.info({
  userId,
  tokensAwarded,
  isNewUser,
  newBalance,
}, 'Gift tokens awarded to user');
```

## Migration Guide

### Database Migration

Migration file: `20251104034044_add_last_gift_claim_at/migration.sql`

```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_gift_claim_at" TIMESTAMPTZ;
```

Apply migration:
```bash
pnpm db:migrate:dev
pnpm db:generate
```

### Backfilling Existing Users

For existing users without `lastGiftClaimAt`, they will be treated as new users and receive their first gift allocation on next `/start`.

Optional backfill script:
```sql
-- Set lastGiftClaimAt to createdAt for existing users with tokens
UPDATE users 
SET last_gift_claim_at = created_at 
WHERE tier = 'Gift' 
  AND last_gift_claim_at IS NULL 
  AND tokens_balance > 0;
```

## Security Considerations

1. **Transaction Safety**: Token awards use database transactions to ensure atomicity
2. **Idempotency**: Multiple `/start` calls won't duplicate token awards
3. **Tier Validation**: Only Gift tier users receive monthly tokens
4. **Audit Trail**: All operations logged in `token_operations` table
5. **Time-based Eligibility**: 30-day cooldown prevents abuse

## Future Enhancements

### Potential Improvements

1. **Configurable Renewal Period**: Make 30-day period an environment variable
2. **Tiered Gift Amounts**: Different gift amounts per tier
3. **Welcome Bonuses**: One-time signup bonus separate from monthly gift
4. **Referral Rewards**: Award tokens for referring new users
5. **Activity-based Bonuses**: Reward active users with bonus tokens
6. **Channel Verification**: Automatically verify channel subscription before awarding
7. **Token Expiration**: Implement token expiration for unused balances
8. **Admin Override**: Allow admins to manually award tokens via bot commands

## Troubleshooting

### User not receiving tokens

1. Check user tier: `SELECT tier FROM users WHERE telegram_id = '...'`
2. Check last claim: `SELECT last_gift_claim_at FROM users WHERE telegram_id = '...'`
3. Check eligibility: Days since last claim must be >= 30
4. Check logs for errors in onboarding service

### Token operation audit missing

1. Verify transaction completed: Check `token_operations` table
2. If missing, tokens were not actually awarded (transaction rolled back)
3. Check error logs for database connection issues

### Wrong message displayed

1. Verify user state in database matches expected conditions
2. Check `lastGiftClaimAt` timestamp
3. Verify tier is correctly set
4. Clear Redis session cache if user data is stale

## Related Documentation

- [Bot Service README](../services/bot/README.md)
- [Database Schema](../packages/database/README.md)
- [Token Billing](./RATE_LIMITING_AND_TOKEN_BILLING.md)
- [Monitoring & KPIs](./KPI_TRACKING.md)
