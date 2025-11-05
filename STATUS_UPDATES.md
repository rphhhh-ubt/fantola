# Status Updates System

This document describes the real-time status updates system implemented for generation tracking.

## Overview

The status updates system provides real-time notifications for generation status changes using:
- **Redis Pub/Sub** for inter-service communication
- **WebSocket Gateway** for real-time client updates
- **REST API endpoints** for querying generation history
- **Database persistence** for status history

## Architecture

```
┌─────────────┐    Status     ┌──────────────┐    Pub/Sub    ┌─────────────┐
│   Worker    │─── Update ───>│    Redis     │──────────────>│  API Service│
│   Service   │               │   Pub/Sub    │               │             │
└─────────────┘               └──────────────┘               └─────────────┘
      │                                                             │
      │ 1. Updates DB                                               │ 3. Broadcasts
      │ 2. Publishes to Redis                                       │    via WebSocket
      ▼                                                             ▼
┌─────────────┐                                              ┌─────────────┐
│  Database   │                                              │   Clients   │
│  (Postgres) │                                              │  (Bot/Web)  │
└─────────────┘                                              └─────────────┘
                                                                    │
                                                                    │ 4. Can query
                                                                    │    via REST API
                                                                    ▼
                                                              ┌─────────────┐
                                                              │  REST API   │
                                                              │  /generations│
                                                              └─────────────┘
```

## Components

### 1. Redis Pub/Sub (packages/shared/src/pubsub/)

#### StatusPublisher
Publishes status updates to Redis channels:
- Global channel: `generation:status-updates`
- User-specific channel: `generation:user:{userId}`

```typescript
import { StatusPublisher } from '@monorepo/shared';

const publisher = new StatusPublisher(redis);

await publisher.publishStatusUpdate({
  generationId: 'gen-123',
  userId: 'user-456',
  type: 'product_card',
  status: 'completed',
  timestamp: Date.now(),
  metadata: {
    resultUrls: ['https://...'],
    tokensUsed: 10,
  },
});
```

#### StatusSubscriber
Subscribes to status updates from Redis:

```typescript
import { StatusSubscriber } from '@monorepo/shared';

const subscriber = new StatusSubscriber(redis);

// Subscribe to all updates
await subscriber.subscribeAll((payload) => {
  console.log('Status update:', payload);
});

// Subscribe to user-specific updates
await subscriber.subscribeUser(userId, (payload) => {
  console.log('User update:', payload);
});
```

### 2. Worker Service Integration

The `BaseProcessor` automatically publishes status updates when status changes occur:

```typescript
// In worker/src/processors/base-processor.ts
protected async updateStatus(
  job: Job<T, JobResult>,
  status: GenerationStatus,
  resultData?: any
): Promise<void> {
  // 1. Update database
  await db.generation.update({ ... });
  
  // 2. Publish to Redis pub/sub
  if (this.statusPublisher) {
    await this.statusPublisher.publishStatusUpdate({
      generationId,
      userId,
      type: this.getGenerationType(),
      status,
      timestamp: Date.now(),
      metadata: { ... },
    });
  }
}
```

All processors automatically inherit this functionality:
- `SoraProcessor` → `GenerationType.SORA`
- `ProductCardProcessor` → `GenerationType.PRODUCT_CARD`
- `ChatProcessingProcessor` → `GenerationType.CHAT`
- `ImageGenerationProcessor` → `GenerationType.CHAT`

### 3. API Service - WebSocket Gateway

#### WebSocket Plugin (services/api/src/plugins/websocket.ts)

Provides WebSocket endpoint for real-time updates:

**Endpoint:** `ws://api-host/ws/status`

**Authentication:** Bearer token in headers or query param

**Message Format:**
```json
{
  "type": "status_update",
  "payload": {
    "generationId": "gen-123",
    "userId": "user-456",
    "type": "product_card",
    "status": "completed",
    "timestamp": 1234567890,
    "metadata": {
      "resultUrls": ["https://..."],
      "tokensUsed": 10
    }
  }
}
```

#### Client Usage

```javascript
const ws = new WebSocket('ws://api-host/ws/status', {
  headers: { authorization: 'Bearer <token>' }
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'connected') {
    console.log('Connected to status updates');
  } else if (message.type === 'status_update') {
    console.log('Generation update:', message.payload);
  }
});
```

### 4. REST API Endpoints

#### List Generations
**GET** `/api/v1/generations`

Query parameters:
- `status`: Filter by status (pending, processing, completed, failed, canceled)
- `type`: Filter by type (product_card, sora, chat)
- `startDate`: Filter by start date (ISO 8601)
- `endDate`: Filter by end date (ISO 8601)
- `limit`: Number of items (max 100, default 50)
- `offset`: Pagination offset (default 0)

Response:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "gen-123",
        "userId": "user-456",
        "type": "product_card",
        "status": "completed",
        "prompt": "Product card: clean",
        "resultUrls": ["https://..."],
        "tokensUsed": 10,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:01:00.000Z",
        "startedAt": "2024-01-01T00:00:05.000Z",
        "completedAt": "2024-01-01T00:01:00.000Z"
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

#### Get Single Generation
**GET** `/api/v1/generations/:id`

Response:
```json
{
  "success": true,
  "data": {
    "id": "gen-123",
    "userId": "user-456",
    "type": "product_card",
    "status": "completed",
    "prompt": "Product card: clean",
    "resultUrls": ["https://..."],
    "tokensUsed": 10,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:01:00.000Z"
  }
}
```

## Bot Service Integration

The bot service can subscribe to Redis pub/sub for status notifications:

```typescript
import { StatusSubscriber } from '@monorepo/shared';
import Redis from 'ioredis';

const redis = new Redis({ ... });
const subscriber = new StatusSubscriber(redis);

// Subscribe to user-specific updates
await subscriber.subscribeUser(telegramUserId, async (payload) => {
  // Send Telegram notification
  await bot.api.sendMessage(
    telegramUserId,
    `Your ${payload.type} generation is ${payload.status}!`
  );
  
  if (payload.status === 'completed' && payload.metadata?.resultUrls) {
    // Send result images
    for (const url of payload.metadata.resultUrls) {
      await bot.api.sendPhoto(telegramUserId, url);
    }
  }
});
```

## Status Lifecycle

All generations follow this lifecycle:

1. **pending** - Job queued, awaiting processing
2. **processing** - Worker actively processing the generation
3. **completed** - Generation finished successfully
   - `resultUrls` populated with output URLs
   - `tokensUsed` recorded
4. **failed** - Generation encountered an error
   - `errorMessage` contains error details
5. **canceled** - Generation manually canceled (optional)

## Testing

Comprehensive integration tests validate:

### Redis Pub/Sub Tests
- ✅ Publishing and receiving status updates
- ✅ Multi-channel broadcasting (global + user-specific)
- ✅ Subscriber callbacks

### REST API Tests
- ✅ List generations with authentication
- ✅ Filter by status, type, date range
- ✅ Pagination support
- ✅ Get single generation by ID
- ✅ Access control (users can only see their own generations)
- ✅ 404 handling for non-existent generations

### WebSocket Tests
- ✅ Connection establishment with authentication
- ✅ Real-time status update broadcasting
- ✅ Multiple concurrent connections
- ✅ Connection cleanup

### End-to-End Tests
- ✅ Complete generation lifecycle tracking (pending → processing → completed)

Run tests:
```bash
pnpm test services/api/src/__tests__/status-updates.integration.test.ts
```

## Environment Variables

No new environment variables required. Uses existing Redis configuration:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional
```

## Performance Considerations

1. **Redis Pub/Sub**
   - Lightweight and fast
   - No message persistence (use database for history)
   - Scales horizontally with Redis Cluster

2. **WebSocket Connections**
   - One connection per authenticated user
   - Automatic cleanup on disconnect
   - Memory usage: ~1-2KB per connection

3. **Database Queries**
   - Indexed by `userId`, `status`, `createdAt`
   - Pagination prevents large result sets
   - Supports filtering to reduce query size

## Security

- **Authentication**: All WebSocket and REST API endpoints require valid JWT token
- **Authorization**: Users can only access their own generations
- **Input Validation**: All query parameters validated with schemas
- **Rate Limiting**: Standard Fastify rate limiting applies

## Future Enhancements

- [ ] Server-Sent Events (SSE) as alternative to WebSocket
- [ ] Webhook callbacks for external integrations
- [ ] Long-polling fallback for clients without WebSocket support
- [ ] Status update batching for high-volume scenarios
- [ ] Retention policies for old generation records
