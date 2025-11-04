# Payments API Documentation

This document describes the payment endpoints implemented for the API service, including authentication, idempotency, and concurrency safety features.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Idempotency & Concurrency Safety](#idempotency--concurrency-safety)
5. [Error Handling](#error-handling)
6. [Testing](#testing)

## Overview

The Payments API provides endpoints for creating payment sessions, listing payment history, and receiving webhook notifications from YooKassa payment provider.

### Key Features

- ✅ **JWT Authentication**: All endpoints require Bearer token authentication
- ✅ **Idempotency**: Duplicate webhook processing is handled safely
- ✅ **Concurrency Safety**: Database transactions with timeout controls
- ✅ **Schema Validation**: Request/response validation with Zod
- ✅ **Comprehensive Testing**: Unit and integration tests included

## Authentication

All payment endpoints (except webhooks) require JWT authentication via Bearer token.

```bash
Authorization: Bearer <token>
```

Tokens can be obtained via the `/api/v1/auth/login` endpoint.

## Endpoints

### 1. Create Payment Session

Creates a new payment session with YooKassa for subscription purchase.

**Endpoint**: `POST /api/v1/payments/sessions`  
**Authentication**: Required  
**Rate Limit**: 100 req/min (global)

#### Request Body

```json
{
  "subscriptionTier": "Professional",
  "returnUrl": "https://example.com/success"
}
```

**Parameters**:
- `subscriptionTier` (required): One of `"Gift"`, `"Professional"`, `"Business"`
- `returnUrl` (optional): URL to redirect user after payment

#### Response (200 OK)

```json
{
  "paymentId": "uuid",
  "confirmationUrl": "https://yookassa.ru/checkout/...",
  "externalId": "yookassa-payment-id",
  "amount": 1990,
  "currency": "RUB",
  "status": "pending",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

#### Error Responses

- `400 Bad Request`: Invalid subscription tier or tier not available
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Subscription tier configuration not found
- `503 Service Unavailable`: Payment provider not configured

#### Example

```bash
curl -X POST https://api.example.com/api/v1/payments/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionTier": "Professional",
    "returnUrl": "https://example.com/success"
  }'
```

---

### 2. List User Payments

Retrieves paginated list of user's payment history.

**Endpoint**: `GET /api/v1/payments`  
**Authentication**: Required  
**Rate Limit**: 100 req/min (global)

#### Query Parameters

- `limit` (optional, default: 20): Number of payments to return (1-100)
- `offset` (optional, default: 0): Number of payments to skip
- `status` (optional): Filter by payment status: `"pending"`, `"succeeded"`, `"failed"`, `"canceled"`, `"refunded"`

#### Response (200 OK)

```json
{
  "items": [
    {
      "id": "uuid",
      "externalId": "yookassa-payment-id",
      "provider": "yookassa",
      "status": "succeeded",
      "amountRubles": 1990,
      "currency": "RUB",
      "description": "Subscription: Professional Plan",
      "subscriptionTier": "Professional",
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-01T12:05:00Z",
      "confirmedAt": "2024-01-01T12:05:00Z",
      "failedAt": null,
      "failureReason": null,
      "metadata": {}
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "hasMore": false
}
```

#### Error Responses

- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid JWT token
- `500 Internal Server Error`: Database error

#### Example

```bash
curl -X GET "https://api.example.com/api/v1/payments?limit=10&offset=0&status=succeeded" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Get Payment by ID

Retrieves a specific payment by its ID.

**Endpoint**: `GET /api/v1/payments/:id`  
**Authentication**: Required  
**Rate Limit**: 100 req/min (global)

#### Path Parameters

- `id` (required): Payment UUID

#### Response (200 OK)

```json
{
  "id": "uuid",
  "externalId": "yookassa-payment-id",
  "provider": "yookassa",
  "status": "succeeded",
  "amountRubles": 1990,
  "currency": "RUB",
  "description": "Subscription: Professional Plan",
  "subscriptionTier": "Professional",
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-01T12:05:00Z",
  "confirmedAt": "2024-01-01T12:05:00Z",
  "failedAt": null,
  "failureReason": null,
  "metadata": {}
}
```

#### Error Responses

- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Payment not found or doesn't belong to user
- `500 Internal Server Error`: Database error

#### Example

```bash
curl -X GET "https://api.example.com/api/v1/payments/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer <token>"
```

---

### 4. YooKassa Webhook

Receives payment notification webhooks from YooKassa.

**Endpoint**: `POST /api/v1/webhooks/yookassa`  
**Authentication**: Webhook signature verification  
**Rate Limit**: None (handled by YooKassa)

#### Request Headers

- `X-YooKassa-Signature`: Webhook signature for verification

#### Request Body

See YooKassa webhook documentation for complete payload structure.

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Webhook processed"
}
```

#### Error Responses

- `400 Bad Request`: Missing or invalid payload
- `401 Unauthorized`: Invalid signature
- `500 Internal Server Error`: Processing error

**Note**: This endpoint is called automatically by YooKassa and should not be called manually.

---

## Idempotency & Concurrency Safety

### Idempotency

The webhook processing is idempotent - multiple deliveries of the same webhook will be handled safely:

1. **Status Check**: Before processing, checks if payment already has `succeeded` status
2. **Early Return**: If already processed, returns success without re-processing
3. **Logging**: Logs idempotent returns for monitoring

**Implementation**:
```typescript
// In payment.service.ts
if (payment.status === 'succeeded') {
  this.monitoring.logger.info(
    { paymentId, existingStatus: payment.status },
    'Payment already processed - idempotent return'
  );
  return { success: true, alreadyProcessed: true };
}
```

### Concurrency Safety

Database transactions are used with timeout controls to ensure atomic updates:

1. **Transaction Isolation**: Uses Prisma transactions with `maxWait` and `timeout`
2. **Row Locking**: Payment records are queried within transaction for consistency
3. **Atomic Updates**: All state changes happen atomically within transaction

**Implementation**:
```typescript
await this.db.$transaction(
  async (tx) => {
    // All database operations here
  },
  {
    maxWait: 5000,  // Maximum time to wait for transaction to start
    timeout: 10000, // Maximum time for transaction to complete
  }
);
```

### Payment Flow with Idempotency

```
┌─────────────────┐
│ YooKassa sends  │
│ webhook         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate        │
│ signature       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Start DB        │
│ transaction     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌────────────────┐
│ Check payment   │────▶│ Already        │
│ status          │     │ succeeded?     │
└────────┬────────┘     └───────┬────────┘
         │                      │
         │ pending              │ yes
         ▼                      │
┌─────────────────┐             │
│ Update status   │             │
│ to succeeded    │             │
└────────┬────────┘             │
         │                      │
         ▼                      │
┌─────────────────┐             │
│ Activate        │             │
│ subscription    │             │
└────────┬────────┘             │
         │                      │
         ▼                      │
┌─────────────────┐             │
│ Grant tokens    │             │
└────────┬────────┘             │
         │                      │
         ▼                      ▼
┌─────────────────────────────────┐
│ Return success                  │
│ (alreadyProcessed: true/false)  │
└─────────────────────────────────┘
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error Name",
  "message": "Detailed error message",
  "statusCode": 400
}
```

### Common Error Codes

- `400`: Bad Request (validation error, invalid parameters)
- `401`: Unauthorized (missing or invalid token)
- `404`: Not Found (resource not found)
- `500`: Internal Server Error (server-side error)
- `503`: Service Unavailable (payment provider not configured)

## Testing

### Unit Tests

Located in `src/__tests__/unit/`:
- `payment.controller.test.ts`: Controller logic tests (7 tests)
- `payment.service.test.ts`: Service logic and idempotency tests (10 tests)

Run unit tests:
```bash
pnpm test src/__tests__/unit/payment.controller.test.ts
pnpm test src/__tests__/unit/payment.service.test.ts
```

### Integration Tests

Located in `src/__tests__/integration/`:
- `payments.test.ts`: End-to-end API tests

Run integration tests:
```bash
# Requires database connection
DATABASE_URL="postgresql://..." pnpm test src/__tests__/integration/payments.test.ts
```

### Test Coverage

**Payment Controller Tests**:
- ✅ Create payment session successfully
- ✅ Return 404 if tier not found
- ✅ Return 503 if payment provider not configured
- ✅ List user payments with pagination
- ✅ Filter payments by status
- ✅ Get specific payment
- ✅ Return 404 if payment not found

**Payment Service Tests**:
- ✅ Process payment only once (idempotent)
- ✅ Process pending payment for Gift tier
- ✅ Handle payment not found error
- ✅ Use transaction with timeout settings
- ✅ Mark payment as failed
- ✅ Handle errors gracefully
- ✅ Mark payment as canceled
- ✅ Process refund and deduct tokens
- ✅ Handle payment not found in refund
- ✅ Handle concurrent payment processing (idempotency)

## Environment Variables

Required for payment functionality:

```env
# YooKassa Configuration
YOOKASSA_SHOP_ID=your-shop-id
YOOKASSA_SECRET_KEY=your-secret-key

# API Configuration
JWT_SECRET=your-jwt-secret
API_BASE_URL=https://api.example.com
DATABASE_URL=postgresql://...
```

## Monitoring & Logging

All payment operations are logged with structured logging:

```typescript
monitoring.logger.info(
  {
    paymentId: payment.id,
    externalId: yookassaPayment.id,
    userId: payload.userId,
    tier: subscriptionTier,
    amount: tierConfig.priceRubles,
  },
  'Payment session created'
);
```

KPI tracking for business metrics:
```typescript
monitoring.trackKPI({
  type: 'payment_conversion',
  data: {
    paymentMethod: 'yookassa',
    plan: payment.subscriptionTier,
    amount: options.amountRubles,
    userId: payment.userId,
  },
});
```

## API Documentation

Interactive API documentation is available via Swagger UI:
- Local: `http://localhost:3000/docs`
- Production: `https://api.example.com/docs`

All payment endpoints are documented with request/response schemas and examples.
