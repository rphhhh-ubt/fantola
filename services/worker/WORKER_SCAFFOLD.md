# Worker Service Scaffold

This document describes the BullMQ-based worker service scaffold implementation.

## Overview

The worker service provides a robust foundation for processing asynchronous jobs using BullMQ. It includes:

- **Worker Runtime**: Subscribes to multiple BullMQ queues with concurrency control
- **Base Processor**: Abstract class for implementing job processors with status tracking
- **Health Reporting**: Heartbeat mechanism and health status monitoring
- **Graceful Shutdown**: Proper cleanup of workers and connections
- **Structured Logging**: Comprehensive logging via the monitoring package

## Architecture

### Components

```
services/worker/src/
├── worker/
│   └── worker-service.ts       # Main worker orchestrator
├── processors/
│   ├── base-processor.ts       # Abstract base processor
│   └── example-processor.ts    # Example implementation
├── health/
│   └── health-service.ts       # Health monitoring and heartbeat
└── __tests__/
    └── worker-processor.test.ts # Integration tests
```

### WorkerService

The main orchestrator that manages multiple queue consumers:

```typescript
import { WorkerService } from './worker/worker-service';
import { createRedisConnection } from '@monorepo/shared';

const redis = createRedisConnection();
const workerService = new WorkerService(monitoring, redis, {
  concurrency: 5,
  maxJobsPerWorker: 50,
  enableHealthChecks: true,
  heartbeatInterval: 30000,
});

// Register processors
workerService.registerProcessor({
  queueName: QueueName.IMAGE_PROCESSING,
  processor: myProcessor,
  concurrency: 3,
});

// Start processing
await workerService.start();
```

### BaseProcessor

Abstract class for implementing job processors:

```typescript
import { BaseProcessor } from './processors/base-processor';
import { Job } from 'bullmq';

class MyProcessor extends BaseProcessor<MyJobData> {
  constructor(context: ProcessorContext) {
    super(QueueName.MY_QUEUE, context);
  }

  protected async process(job: Job<MyJobData>): Promise<JobResult> {
    // Update progress
    await this.updateProgress(job, 0.5);

    // Do work
    const result = await doWork(job.data);

    return {
      success: true,
      data: result,
    };
  }
}
```

### HealthService

Monitors worker health and provides heartbeat:

```typescript
const health = workerService.getHealth();
console.log(health);
// {
//   healthy: true,
//   uptime: 3600000,
//   lastHeartbeat: 1234567890,
//   activeJobs: 5,
//   processedJobs: 123,
//   failedJobs: 2,
//   queues: [...]
// }
```

## Features

### 1. Concurrency Control

Configure concurrency at service level or per-queue:

```typescript
// Service-level concurrency
const workerService = new WorkerService(monitoring, redis, {
  concurrency: 5, // Default for all queues
});

// Per-queue concurrency override
workerService.registerProcessor({
  queueName: QueueName.IMAGE_PROCESSING,
  processor: imageProcessor,
  concurrency: 10, // Override for this queue
});
```

### 2. Status Updates

The BaseProcessor automatically updates job status in the database:

- `pending` → `processing` (on start)
- `processing` → `completed` (on success)
- `processing` → `failed` (on error)

Status updates are linked to the `Generation` model using the `userId` field.

### 3. Retry Logic

Retry configuration is managed by BullMQ:

```typescript
// Configured in packages/shared/src/queue/config.ts
export const RETRY_CONFIGS = {
  'image-processing': {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
};
```

The BaseProcessor tracks retries and moves jobs to dead-letter after exhausting attempts.

### 4. Dead-Letter Handling

Failed jobs (after all retries) are moved to dead-letter:

```typescript
protected async moveToDeadLetter(job: Job, error: Error): Promise<void> {
  // Log the failure
  this.monitoring.logger.error({ jobId: job.id, error }, 'Job moved to dead letter');

  // Send alert
  this.monitoring.alerts.alertQueueFailure(this.queueName, error, {
    jobId: job.id,
    data: job.data,
  });

  // Stub: Implement custom dead-letter storage
  // - Store in Redis with TTL
  // - Store in PostgreSQL table
  // - Send to external service
}
```

### 5. Health Checks

The HealthService provides:

- **Heartbeat**: Periodic health signals (default: 30s)
- **Status**: Current worker health status
- **Metrics**: Active jobs, processed, failed counts
- **Queue Info**: Status of each registered queue

```typescript
// Get health status
const health = workerService.getHealth();

// Get formatted report
const report = workerService.getHealthReport();
console.log(report);
// === Worker Health Report ===
// Status: ✓ HEALTHY
// Uptime: 1h 23m 45s
// Active Jobs: 3
// Processed: 156
// Failed: 2
//
// Queues:
//   - image-processing: ✓ Running
//   - chat-processing: ✓ Running
```

### 6. Graceful Shutdown

The worker service integrates with the database shutdown handler:

```typescript
setupDatabaseShutdown({
  timeout: 15000,
  logger: (message) => monitoring.logger.info(message),
  cleanupHandlers: [
    async () => {
      await workerService.stop(); // Gracefully stop all workers
      await closeRedisConnections(); // Close Redis connections
    },
  ],
});
```

This ensures:
- Workers finish current jobs before shutdown
- New jobs are not accepted during shutdown
- All connections are properly closed
- Configurable timeout to force shutdown

### 7. Structured Logging

All operations are logged with structured data:

```typescript
this.monitoring.logger.info(
  {
    jobId: job.id,
    queue: this.queueName,
    attempt: job.attemptsMade,
    processingTimeMs: duration,
  },
  'Job completed successfully'
);
```

### 8. Metrics & KPIs

The worker tracks:

- Job processing time
- Success/failure rates
- Active job counts
- Queue-specific metrics

```typescript
// Automatic KPI tracking
monitoring.trackKPI({
  type: 'generation_success',
  data: { type: this.queueName },
});

monitoring.trackKPI({
  type: 'generation_failure',
  data: { type: this.queueName, errorType: error.name },
});
```

## Usage

### Creating a New Processor

1. **Extend BaseProcessor**:

```typescript
import { BaseProcessor } from './processors/base-processor';
import { Job } from 'bullmq';
import { QueueName, JobResult } from '@monorepo/shared';

export class PaymentProcessor extends BaseProcessor<PaymentJobData> {
  constructor(context: ProcessorContext) {
    super(QueueName.PAYMENT_PROCESSING, context);
  }

  protected async process(job: Job<PaymentJobData>): Promise<JobResult> {
    const { userId, paymentId, amount } = job.data;

    // Update progress
    await this.updateProgress(job, { step: 'validating', progress: 0.3 });

    // Process payment
    const result = await this.processPayment(paymentId);

    await this.updateProgress(job, { step: 'recording', progress: 0.7 });

    // Record in database
    await this.recordPayment(userId, result);

    return {
      success: true,
      data: result,
    };
  }

  private async processPayment(paymentId: string) {
    // Payment processing logic
  }

  private async recordPayment(userId: string, result: any) {
    // Database recording logic
  }
}
```

2. **Register with WorkerService**:

```typescript
const paymentProcessor = new PaymentProcessor({ monitoring });

workerService.registerProcessor({
  queueName: QueueName.PAYMENT_PROCESSING,
  processor: paymentProcessor,
  concurrency: 3,
});
```

3. **Start the worker**:

```typescript
await workerService.start();
```

### Testing

Use the provided test utilities:

```typescript
import { WorkerService } from '../worker/worker-service';
import { ExampleProcessor } from '../processors/example-processor';
import { MockRedisClient } from '@monorepo/test-utils';

describe('MyProcessor', () => {
  let workerService: WorkerService;

  beforeEach(() => {
    const redis = new MockRedisClient() as any;
    workerService = new WorkerService(monitoring, redis);
  });

  it('should process job successfully', async () => {
    const processor = new MyProcessor({ monitoring });
    const jobProcessor = processor.getProcessor();

    const mockJob = {
      id: 'test-job',
      data: { /* job data */ },
      attemptsMade: 0,
      opts: { attempts: 3 },
      updateProgress: jest.fn(),
    } as unknown as Job;

    const result = await jobProcessor(mockJob);

    expect(result.success).toBe(true);
  });
});
```

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Worker concurrency
WORKER_CONCURRENCY=5
WORKER_MAX_JOBS_PER_WORKER=50
WORKER_REPLICAS=1

# Health checks
# (configured in code)
```

### Queue Configuration

Queue-specific settings in `packages/shared/src/queue/config.ts`:

```typescript
export const RETRY_CONFIGS = {
  'image-processing': {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
};

export const JOB_TIMEOUTS = {
  'image-processing': 2 * 60 * 1000, // 2 minutes
};

export const RATE_LIMITS = {
  'image-processing': { max: 50, duration: 1000 },
};
```

## Best Practices

1. **Always extend BaseProcessor** for automatic status tracking and retry handling
2. **Use updateProgress** for long-running jobs to track progress
3. **Implement idempotent processors** - jobs may be retried
4. **Handle cleanup** in the processor's error handling
5. **Monitor health** regularly using the health service
6. **Test with MockRedisClient** for unit tests
7. **Use structured logging** with relevant context
8. **Set appropriate timeouts** based on job complexity

## Monitoring

### Metrics

Access Prometheus metrics at `http://localhost:9091/metrics`:

```
# Job processing metrics
worker_job_duration_seconds
worker_active_jobs
worker_completed_jobs_total
worker_failed_jobs_total

# Queue metrics
queue_waiting_jobs
queue_active_jobs
queue_completed_jobs
queue_failed_jobs
```

### Logging

Structured logs include:

- Job ID and queue name
- Processing time
- Retry attempts
- Error details
- Progress updates

### Alerts

Failed jobs trigger alerts via the monitoring package:

```typescript
monitoring.alerts.alertQueueFailure(queueName, error, context);
```

## Troubleshooting

### Jobs Not Processing

1. Check Redis connection: `redis-cli ping`
2. Verify worker is running: `workerService.isServiceRunning()`
3. Check health status: `workerService.getHealth()`
4. Review logs for errors

### High Failure Rate

1. Check health status: `health.failedJobs / (health.processedJobs + health.failedJobs)`
2. Review dead-letter logs
3. Check retry configuration
4. Monitor resource usage (CPU, memory)

### Workers Not Stopping

1. Increase shutdown timeout in `setupDatabaseShutdown`
2. Check for hung jobs in Redis
3. Force kill if necessary (not recommended)

## Future Enhancements

Potential improvements for the worker scaffold:

1. **Dead-Letter Storage**: Implement persistent storage for failed jobs
2. **Job Scheduling**: Add support for scheduled/delayed jobs
3. **Priority Queues**: Enhanced priority-based processing
4. **Rate Limiting**: Per-user or per-tenant rate limiting
5. **Job Chaining**: Support for job workflows
6. **Dashboard**: Web UI for monitoring workers
7. **Auto-scaling**: Dynamic worker scaling based on queue size

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Queue Configuration](../../packages/shared/src/queue/README.md)
- [Monitoring Package](../../packages/monitoring/README.md)
- [Database Models](../../packages/database/prisma/schema.prisma)
