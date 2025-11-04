# YooKassa Integration Guide

Complete guide for integrating YooKassa payment processing into the monorepo application.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup](#setup)
- [Payment Flow](#payment-flow)
- [Webhook Processing](#webhook-processing)
- [Auto-Renewal](#auto-renewal)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

The YooKassa integration provides:

- **Payment Creation**: Create one-time and recurring payments
- **Two-Step Payments**: Authorization with delayed capture
- **Webhook Processing**: Automatic payment confirmation and fulfillment
- **Subscription Management**: Auto-renewal scheduling and token grants
- **Refund Handling**: Process refunds with token deductions
- **Failure Notifications**: Alert users of payment failures

## Architecture

### Components

1. **YooKassa Client** (`packages/shared/src/yookassa/`)
   - API client for YooKassa payment platform
   - Payment creation, capture, cancellation, refunds
   - Webhook signature validation

2. **Payment Service** (`services/api/src/services/payment.service.ts`)
   - Business logic for payment processing
   - Token grants and subscription activation
   - Refund processing with token deductions

3. **Webhook Endpoint** (`services/api/src/routes/webhooks/yookassa.ts`)
   - Receives payment notifications from YooKassa
   - Validates webhook signatures
   - Triggers payment processing

4. **Database Models** (`packages/database/prisma/schema.prisma`)
   - `Payment`: Payment records with external IDs
   - `SubscriptionHistory`: Subscription activation history
   - `TokenOperation`: Token grant/deduction audit log

### Payment Flow

```
User → Bot → Create Payment → YooKassa → Redirect to Payment Page
                                          ↓
                                    User Pays
                                          ↓
YooKassa → Webhook → API → Validate → Process → Update DB → Grant Tokens
```

## Setup

### 1. YooKassa Account Setup

1. Sign up at [YooKassa](https://yookassa.ru/)
2. Complete business verification
3. Navigate to Settings → API keys
4. Copy your **Shop ID** and **Secret Key**

### 2. Environment Configuration

Add to `.env.local` or production environment:

```bash
# YooKassa Configuration
YOOKASSA_SHOP_ID=your-shop-id-here
YOOKASSA_SECRET_KEY=your-secret-key-here
YOOKASSA_WEBHOOK_URL=https://yourapp.com/api/v1/webhooks/yookassa
YOOKASSA_WEBHOOK_SECRET=generate-strong-random-secret
```

**Generate webhook secret:**
```bash
openssl rand -hex 32
```

### 3. Configure Webhooks in YooKassa Dashboard

1. Navigate to Settings → Webhooks
2. Click "Add Webhook"
3. Enter webhook URL: `https://yourapp.com/api/v1/webhooks/yookassa`
4. Select events:
   - ✅ payment.succeeded
   - ✅ payment.canceled
   - ✅ refund.succeeded
5. Save configuration

### 4. Install Dependencies

Dependencies are already included in the monorepo:

```bash
pnpm install
```

## Payment Flow

### Create a Payment (Bot Service)

```typescript
import { YooKassaClient } from '@monorepo/shared';

const client = new YooKassaClient({
  shopId: config.yookassaShopId,
  secretKey: config.yookassaSecretKey,
});

// Create payment record in database
const payment = await db.payment.create({
  data: {
    userId: user.id,
    provider: 'yookassa',
    status: 'pending',
    amountRubles: 1990,
    currency: 'RUB',
    description: 'Professional subscription - 30 days',
    externalId: '', // Will be updated after YooKassa response
    subscriptionTier: 'Professional',
    metadata: {
      userId: user.id,
      subscriptionTier: 'Professional',
    },
  },
});

// Create payment in YooKassa
const yookassaPayment = await client.createPayment({
  amount: {
    value: '1990.00',
    currency: 'RUB',
  },
  description: 'Professional subscription - 30 days',
  confirmation: {
    type: 'redirect',
    return_url: `https://t.me/your_bot`,
  },
  capture: true, // Auto-capture on success
  metadata: {
    userId: user.id,
    subscriptionTier: 'Professional',
  },
});

// Update payment with external ID
await db.payment.update({
  where: { id: payment.id },
  data: { externalId: yookassaPayment.id },
});

// Send payment link to user
await bot.api.sendMessage(
  user.telegramId,
  `Payment link: ${yookassaPayment.confirmation?.confirmation_url}`
);
```

### Process Payment Success (API Webhook)

The webhook handler automatically:

1. Validates webhook signature
2. Updates payment status to 'succeeded'
3. Activates subscription with expiration date
4. Grants monthly tokens to user
5. Creates subscription history record
6. Logs token operation

```typescript
// Webhook endpoint: POST /api/v1/webhooks/yookassa
// Automatically processes payment.succeeded events
```

### Process Payment Failure

The webhook handler automatically:

1. Validates webhook signature
2. Updates payment status to 'failed' or 'canceled'
3. Logs failure reason

You should implement notification logic in bot service:

```typescript
// Listen for payment updates in bot service
const failedPayments = await db.payment.findMany({
  where: {
    status: { in: ['failed', 'canceled'] },
    userId: user.id,
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
});

if (failedPayments.length > 0) {
  await bot.api.sendMessage(
    user.telegramId,
    'Your payment was not successful. Please try again or contact support.'
  );
}
```

## Webhook Processing

### Webhook Events

#### payment.succeeded

**Triggered:** Payment successfully completed

**Processing:**
1. Find payment by `externalId`
2. Check if already processed (idempotency)
3. Update payment status
4. Activate subscription
5. Grant monthly tokens
6. Track KPI metrics

**Example notification:**
```json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "payment-123",
    "status": "succeeded",
    "amount": { "value": "1990.00", "currency": "RUB" },
    "paid": true,
    "captured_at": "2024-01-01T12:00:00Z",
    "metadata": {
      "userId": "user-uuid",
      "subscriptionTier": "Professional"
    }
  }
}
```

#### payment.canceled

**Triggered:** Payment was canceled by user or system

**Processing:**
1. Find payment by `externalId`
2. Update payment status to 'canceled'
3. Log cancellation reason

**Example notification:**
```json
{
  "type": "notification",
  "event": "payment.canceled",
  "object": {
    "id": "payment-123",
    "status": "canceled",
    "cancellation_details": {
      "party": "merchant",
      "reason": "Expired"
    }
  }
}
```

#### refund.succeeded

**Triggered:** Refund successfully processed

**Processing:**
1. Find payment by `payment_id`
2. Update payment status to 'refunded'
3. Deduct tokens from user balance
4. Cancel subscription immediately
5. Log refund operation

**Example notification:**
```json
{
  "type": "notification",
  "event": "refund.succeeded",
  "object": {
    "id": "refund-123",
    "payment_id": "payment-123",
    "status": "succeeded",
    "amount": { "value": "1990.00", "currency": "RUB" }
  }
}
```

## Auto-Renewal

### Subscription Auto-Renewal Strategy

**Current Implementation:**
- Manual subscription activation via webhook
- 30-day subscription periods
- Auto-renewal flag stored in User model
- Expiration tracking via `subscriptionExpiresAt`

**Future Auto-Renewal (Not Yet Implemented):**

1. **Expiration Check Job** (Worker Service)
   ```typescript
   // Run daily at 2 AM
   cron.schedule('0 2 * * *', async () => {
     const expiringUsers = await db.user.findMany({
       where: {
         autoRenew: true,
         subscriptionExpiresAt: {
           gte: new Date(),
           lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
         },
       },
     });

     for (const user of expiringUsers) {
       await attemptRenewal(user);
     }
   });
   ```

2. **Create Renewal Payment**
   ```typescript
   async function attemptRenewal(user: User) {
     const tierConfig = await getTierConfig(user.tier);

     const payment = await yookassaClient.createPayment({
       amount: {
         value: tierConfig.priceRubles.toFixed(2),
         currency: 'RUB',
       },
       description: `${user.tier} subscription renewal`,
       capture: true,
       metadata: {
         userId: user.id,
         subscriptionTier: user.tier,
         isRenewal: true,
       },
     });

     // Send payment link to user
     await notifyRenewal(user, payment);
   }
   ```

3. **Renewal Failure Handling**
   - Send notification 7 days before expiration
   - Send reminder 3 days before expiration
   - Send final reminder 1 day before expiration
   - Downgrade to Gift tier after expiration

## Testing

### Unit Tests

Test YooKassa client:
```bash
pnpm --filter @monorepo/shared test src/yookassa/__tests__
```

### Integration Tests

Test webhook processing:
```bash
pnpm --filter @monorepo/api test src/__tests__/integration/yookassa-webhook.test.ts
```

### Manual Testing with YooKassa Sandbox

1. Use test credentials from YooKassa dashboard
2. Create test payments
3. Use test card numbers:
   - **Success:** 5555 5555 5555 4477
   - **Failure:** 5555 5555 5555 5559
   - **3D Secure:** 4111 1111 1111 1111

### Test Webhook Locally

Use ngrok to expose local API:

```bash
# Start API service
pnpm api:dev

# In another terminal, start ngrok
ngrok http 3000

# Update YooKassa webhook URL to ngrok URL
# https://your-ngrok-id.ngrok.io/api/v1/webhooks/yookassa
```

### Simulate Webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/yookassa \
  -H "Content-Type: application/json" \
  -H "X-YooKassa-Signature: $(echo -n '{"type":"notification","event":"payment.succeeded","object":{"id":"test-123"}}' | openssl dgst -sha256 -hmac 'your-secret-key' | awk '{print $2}')" \
  -d '{
    "type": "notification",
    "event": "payment.succeeded",
    "object": {
      "id": "payment-123",
      "status": "succeeded",
      "amount": {"value": "1990.00", "currency": "RUB"},
      "paid": true,
      "refundable": true,
      "test": true,
      "created_at": "2024-01-01T00:00:00Z",
      "metadata": {
        "userId": "user-uuid",
        "subscriptionTier": "Professional"
      }
    }
  }'
```

## Deployment

### Production Checklist

- [ ] Configure production YooKassa credentials
- [ ] Set strong webhook secret
- [ ] Configure webhook URL in YooKassa dashboard
- [ ] Enable HTTPS for API service
- [ ] Test webhook connectivity
- [ ] Set up monitoring alerts
- [ ] Configure Sentry error tracking
- [ ] Review payment flows end-to-end
- [ ] Set up database backups
- [ ] Document payment reconciliation process

### Environment Variables

```bash
# Production
YOOKASSA_SHOP_ID=prod-shop-id
YOOKASSA_SECRET_KEY=prod-secret-key
YOOKASSA_WEBHOOK_URL=https://api.yourapp.com/api/v1/webhooks/yookassa
YOOKASSA_WEBHOOK_SECRET=production-webhook-secret
```

## Monitoring

### Key Metrics

Track these metrics via Monitoring package:

- `payment_conversion` - Successful payment conversions
- `payment_failure` - Failed payment attempts
- `active_user` - User activity after payment
- `token_spend` - Token usage after grants

### Prometheus Queries

**Payment Success Rate:**
```promql
rate(kpi_payment_conversion_total[5m]) / 
(rate(kpi_payment_conversion_total[5m]) + rate(kpi_payment_failure_total[5m]))
```

**Average Payment Amount:**
```promql
avg(payment_amount_rubles)
```

**Payments by Tier:**
```promql
sum by (plan) (kpi_payment_conversion_total)
```

### Alerts

Configure alerts for:

- Payment webhook failures (> 5% error rate)
- Payment processing delays (> 5 minutes)
- Signature validation failures (> 10 in 1 hour)
- Token grant failures after payment

## Troubleshooting

### Payment Not Processing

**Symptom:** Payment shows as 'succeeded' in YooKassa but not in database

**Solution:**
1. Check webhook logs in YooKassa dashboard
2. Verify webhook URL is accessible (not localhost)
3. Check API service logs for errors
4. Verify payment metadata includes `userId`

### Invalid Webhook Signature

**Symptom:** Webhooks rejected with 401 Unauthorized

**Solution:**
1. Verify `YOOKASSA_SECRET_KEY` matches dashboard
2. Check webhook secret hasn't been rotated
3. Ensure webhook payload is not modified by proxy

### Token Not Granted

**Symptom:** Payment processed but tokens not added

**Solution:**
1. Check `SubscriptionTierConfig` exists for tier
2. Verify `TokenService` is working correctly
3. Check database transaction logs
4. Review PaymentService error logs

### Duplicate Payment Processing

**Symptom:** Tokens granted multiple times for same payment

**Solution:**
1. Check payment status before processing
2. Verify idempotency checks are working
3. Review webhook logs for duplicates

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `invalid_request` | Invalid request parameters | Check request format |
| `not_found` | Payment/refund not found | Verify external ID mapping |
| `forbidden` | Invalid credentials | Check shop ID and secret key |
| `too_many_requests` | Rate limit exceeded | Implement retry with backoff |

## Security Best Practices

1. **Never expose secret keys** in client-side code
2. **Always validate webhook signatures** before processing
3. **Use HTTPS** for all webhook endpoints
4. **Store payment metadata** encrypted in database
5. **Log all payment operations** for audit trail
6. **Implement rate limiting** on webhook endpoint
7. **Monitor for suspicious activity** (unusual payment amounts, patterns)

## Resources

- [YooKassa API Documentation](https://yookassa.ru/developers/api)
- [YooKassa Dashboard](https://yookassa.ru/)
- [Webhook Testing Tool](https://webhook.site/)
- [Package Documentation](../packages/shared/src/yookassa/README.md)
