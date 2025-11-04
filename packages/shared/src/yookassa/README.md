# YooKassa Integration

This module provides a complete integration with the YooKassa payment platform, including payment creation, capture, cancellation, refunds, and webhook validation.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Webhook Integration](#webhook-integration)
- [Error Handling](#error-handling)
- [Testing](#testing)

## Installation

The YooKassa module is included in `@monorepo/shared`:

```typescript
import { YooKassaClient, YooKassaClientError } from '@monorepo/shared';
```

## Quick Start

### Initialize the Client

```typescript
import { YooKassaClient } from '@monorepo/shared';

const client = new YooKassaClient({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
  apiUrl: 'https://api.yookassa.ru/v3', // Optional, default value
  timeout: 30000, // Optional, default 30 seconds
});
```

### Create a Payment

```typescript
const payment = await client.createPayment({
  amount: {
    value: '1990.00',
    currency: 'RUB',
  },
  description: 'Professional subscription',
  confirmation: {
    type: 'redirect',
    return_url: 'https://yourapp.com/payment/success',
  },
  capture: true, // Auto-capture payment
  metadata: {
    userId: 'user-123',
    subscriptionTier: 'Professional',
  },
});

console.log(`Payment URL: ${payment.confirmation?.confirmation_url}`);
```

### Two-Step Payment (Authorization + Capture)

```typescript
// Step 1: Create payment without auto-capture
const payment = await client.createPayment({
  amount: {
    value: '1990.00',
    currency: 'RUB',
  },
  description: 'Professional subscription',
  confirmation: {
    type: 'redirect',
    return_url: 'https://yourapp.com/payment/success',
  },
  capture: false, // Manual capture required
});

// Step 2: Capture payment later (e.g., after order confirmation)
const capturedPayment = await client.capturePayment(payment.id);
```

### Get Payment Status

```typescript
const payment = await client.getPayment('payment-id');
console.log(`Payment status: ${payment.status}`);
console.log(`Paid: ${payment.paid}`);
```

### Cancel a Payment

```typescript
const canceledPayment = await client.cancelPayment('payment-id', {
  cancellation_details: {
    party: 'merchant',
    reason: 'Order canceled by user',
  },
});
```

### Create a Refund

```typescript
const refund = await client.createRefund({
  payment_id: 'payment-id',
  amount: {
    value: '1990.00',
    currency: 'RUB',
  },
  description: 'Order cancellation',
});

console.log(`Refund ID: ${refund.id}`);
```

## API Reference

### YooKassaClient

#### Constructor

```typescript
new YooKassaClient(config: YooKassaClientConfig)
```

**Config Options:**
- `shopId` (required): Your YooKassa shop ID
- `secretKey` (required): Your YooKassa secret key
- `apiUrl` (optional): API base URL (default: `https://api.yookassa.ru/v3`)
- `timeout` (optional): Request timeout in milliseconds (default: 30000)

#### Methods

##### createPayment

```typescript
async createPayment(
  request: CreatePaymentRequest,
  idempotenceKey?: string
): Promise<Payment>
```

Create a new payment. The `idempotenceKey` ensures that duplicate requests are handled safely.

##### getPayment

```typescript
async getPayment(paymentId: string): Promise<Payment>
```

Get payment information by ID.

##### capturePayment

```typescript
async capturePayment(
  paymentId: string,
  request?: CapturePaymentRequest,
  idempotenceKey?: string
): Promise<Payment>
```

Capture a previously authorized payment. Optionally specify a different amount for partial capture.

##### cancelPayment

```typescript
async cancelPayment(
  paymentId: string,
  request?: CancelPaymentRequest,
  idempotenceKey?: string
): Promise<Payment>
```

Cancel a payment that hasn't been captured yet.

##### createRefund

```typescript
async createRefund(
  request: CreateRefundRequest,
  idempotenceKey?: string
): Promise<Refund>
```

Create a refund for a captured payment.

##### getRefund

```typescript
async getRefund(refundId: string): Promise<Refund>
```

Get refund information by ID.

##### validateWebhookSignature

```typescript
validateWebhookSignature(
  notification: WebhookNotification,
  signature: string
): boolean
```

Validate the signature of a webhook notification to ensure it's from YooKassa.

## Webhook Integration

YooKassa sends webhook notifications for payment events. Always validate the signature before processing.

### Webhook Events

- `payment.succeeded` - Payment successfully completed
- `payment.canceled` - Payment was canceled
- `refund.succeeded` - Refund successfully processed

### Example Webhook Handler

```typescript
import { YooKassaClient } from '@monorepo/shared';

const client = new YooKassaClient({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
});

app.post('/webhooks/yookassa', async (req, res) => {
  const signature = req.headers['x-yookassa-signature'];
  const notification = req.body;

  // Validate signature
  if (!client.validateWebhookSignature(notification, signature)) {
    return res.status(401).send({ error: 'Invalid signature' });
  }

  // Process notification
  switch (notification.event) {
    case 'payment.succeeded':
      await handlePaymentSucceeded(notification.object);
      break;

    case 'payment.canceled':
      await handlePaymentCanceled(notification.object);
      break;

    case 'refund.succeeded':
      await handleRefundSucceeded(notification.object);
      break;
  }

  res.status(200).send({ success: true });
});
```

## Error Handling

All methods throw `YooKassaClientError` on failure:

```typescript
import { YooKassaClient, YooKassaClientError } from '@monorepo/shared';

try {
  const payment = await client.createPayment({
    amount: { value: '0', currency: 'RUB' }, // Invalid amount
  });
} catch (error) {
  if (error instanceof YooKassaClientError) {
    console.error(`YooKassa error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Type: ${error.type}`);
    console.error(`Status: ${error.statusCode}`);
  }
}
```

### Common Error Codes

- `invalid_request` - Invalid request parameters
- `invalid_credentials` - Invalid shop ID or secret key
- `not_found` - Payment or refund not found
- `timeout` - Request timeout
- `network_error` - Network connectivity issue

## Testing

Use the `MockYooKassaClient` from `@monorepo/test-utils` for testing:

```typescript
import { MockYooKassaClient } from '@monorepo/test-utils';

describe('Payment Service', () => {
  let mockClient: MockYooKassaClient;

  beforeEach(() => {
    mockClient = new MockYooKassaClient();
  });

  it('should create a payment', async () => {
    const payment = await mockClient.createPayment({
      amount: { value: '1990.00', currency: 'RUB' },
      description: 'Test payment',
    });

    expect(payment.id).toBeDefined();
    expect(payment.status).toBe('succeeded');
  });

  it('should validate webhook signature', () => {
    mockClient.setWebhookSecret('test-secret');

    const notification = {
      type: 'notification',
      event: 'payment.succeeded',
      object: { id: 'payment-123', status: 'succeeded' },
    };

    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(JSON.stringify(notification))
      .digest('hex');

    const isValid = mockClient.validateWebhookSignature(notification, signature);
    expect(isValid).toBe(true);
  });
});
```

## Configuration

### Environment Variables

Required for production:

```bash
YOOKASSA_SHOP_ID=your-shop-id
YOOKASSA_SECRET_KEY=your-secret-key
YOOKASSA_WEBHOOK_URL=https://yourapp.com/api/v1/webhooks/yookassa
YOOKASSA_WEBHOOK_SECRET=your-webhook-secret
```

### YooKassa Dashboard Setup

1. Log in to [YooKassa Dashboard](https://yookassa.ru/)
2. Navigate to Settings → API keys
3. Copy your Shop ID and Secret Key
4. Navigate to Settings → Webhooks
5. Add webhook URL: `https://yourapp.com/api/v1/webhooks/yookassa`
6. Select events: `payment.succeeded`, `payment.canceled`, `refund.succeeded`

## Best Practices

1. **Always use idempotence keys** for create/capture/cancel operations to prevent duplicate processing
2. **Validate webhook signatures** before processing notifications
3. **Store payment metadata** (userId, subscriptionTier) for webhook processing
4. **Use two-step payments** for high-value transactions requiring confirmation
5. **Handle all webhook events** even if you don't use them yet
6. **Log all payment operations** for debugging and compliance
7. **Test with YooKassa sandbox** before going to production

## Resources

- [YooKassa API Documentation](https://yookassa.ru/developers/api)
- [YooKassa Webhook Documentation](https://yookassa.ru/developers/using-api/webhooks)
- [YooKassa Integration Guide](https://yookassa.ru/developers/payments/integration-scenarios)
