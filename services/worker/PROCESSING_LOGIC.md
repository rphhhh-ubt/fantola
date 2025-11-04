# Worker Processing Logic

This document describes the comprehensive worker processing implementation including provider integration, token deduction with rollback, and structured logging/metrics.

## Overview

The worker service processes asynchronous jobs from multiple BullMQ queues with the following features:

- **Provider Integration**: Fetch results from external providers (image generation, chat, etc.)
- **Token Deduction**: Tokens are deducted ONLY after confirmed success/failure transitions
- **Rollback on Errors**: Automatic token refunds if processing fails after deduction
- **Structured Logging**: Comprehensive logging with context
- **Metrics & Alerts**: Track success/failure rates and trigger alerts
- **Partial Failure Handling**: Handle cases where some outputs succeed and others fail

## Architecture

### Core Components

```
services/worker/src/
├── processors/
│   ├── base-processor.ts                    # Abstract base with token logic
│   ├── image-generation-processor.ts        # Image generation (DALL-E, SD)
│   ├── sora-processor.ts                    # Video generation
│   ├── chat-processing-processor.ts         # Chat/text processing
│   ├── product-card-processor.ts            # Product card generation
│   └── example-processor.ts                 # Example/template
├── __tests__/
│   ├── token-deduction.test.ts              # Token deduction & rollback tests
│   ├── image-generation-processor.test.ts   # Image generation tests
│   ├── chat-processing-processor.test.ts    # Chat processing tests
│   └── product-card-processor.test.ts       # Product card tests
└── index.ts                                  # Worker initialization
```

## Token Deduction Flow

### Success Flow

```
1. Job received from queue
2. Update status: pending → processing
3. Execute processing logic (fetch from provider, store results)
4. ✅ Processing succeeds
5. Deduct tokens from user balance
6. Update status: processing → completed
7. Track success metrics
```

### Failure Flow (No Tokens Deducted)

```
1. Job received from queue
2. Update status: pending → processing
3. Execute processing logic
4. ❌ Processing fails
5. ⛔ Skip token deduction (skipDeductionOnFailure: true)
6. Update status: processing → failed
7. Track failure metrics
```

### Rollback Flow (Tokens Refunded)

```
1. Job received from queue
2. Update status: pending → processing
3. Execute processing logic
4. ✅ Processing succeeds initially
5. Deduct tokens from user balance
6. ❌ Subsequent step fails (e.g., status update fails)
7. 🔄 Rollback: Refund tokens to user
8. Update status: processing → failed
9. Track rollback metrics & alert
```

## Processor Implementation

### BaseProcessor

The abstract `BaseProcessor` class provides:

- Automatic token deduction after successful processing
- Token rollback on errors
- Status tracking (pending → processing → completed/failed)
- Structured logging with context
- Metrics tracking
- Alert hooks for failures

```typescript
export abstract class BaseProcessor<T extends JobData = JobData> {
  protected abstract process(job: Job<T>): Promise<JobResult>;
  
  protected getTokenDeductionConfig(): TokenDeductionConfig {
    return {
      enabled: true,
      operationType: 'image_generation',
      skipDeductionOnFailure: true,
    };
  }
}
```

### Token Deduction Configuration

Each processor can customize token deduction behavior:

```typescript
interface TokenDeductionConfig {
  enabled: boolean;                    // Enable/disable token deduction
  operationType: OperationType;        // Type of operation (image_generation, chatgpt_message, etc.)
  amount?: number;                     // Custom amount (overrides default cost)
  skipDeductionOnFailure?: boolean;    // Skip deduction for failed jobs
}
```

### Example Processor

```typescript
export class ImageGenerationProcessor extends BaseProcessor<ImageGenerationJobData> {
  constructor(config: ImageGenerationProcessorConfig) {
    super(QueueName.IMAGE_GENERATION, config);
  }

  protected getTokenDeductionConfig(): TokenDeductionConfig {
    return {
      enabled: true,
      operationType: 'image_generation',
      skipDeductionOnFailure: true,  // Don't charge for failures
    };
  }

  protected async process(job: Job<ImageGenerationJobData>): Promise<JobResult> {
    // 1. Fetch generation record
    const generation = await db.generation.findFirst({...});
    
    // 2. Update status to processing
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'processing', startedAt: new Date() },
    });
    
    // 3. Generate images using provider
    const response = await this.imageService.generateImage({...});
    
    // 4. Store results
    const resultUrls = await this.storeGeneratedImages(response.images);
    
    // 5. Update status to completed
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'completed', resultUrls, completedAt: new Date() },
    });
    
    // 6. Return success (tokens will be deducted automatically)
    return {
      success: true,
      data: { generationId: generation.id, resultUrls },
    };
  }
}
```

## Registered Processors

### 1. ImageGenerationProcessor

- **Queue**: `IMAGE_GENERATION`
- **Provider**: FAL, Replicate, Together (via ImageGenerationService)
- **Token Cost**: 10 tokens
- **Outputs**: 1-4 generated images stored in storage

### 2. SoraProcessor

- **Queue**: `SORA_GENERATION`
- **Provider**: Sora API (simulated for now)
- **Token Cost**: 10 tokens
- **Outputs**: Multi-resolution videos (1080p, 720p, 480p)

### 3. ChatProcessingProcessor

- **Queue**: `CHAT_PROCESSING`
- **Provider**: ChatGPT, Groq (simulated for now)
- **Token Cost**: 5 tokens
- **Outputs**: User and assistant chat messages stored in DB

### 4. ProductCardProcessor

- **Queue**: `PRODUCT_CARD_GENERATION`
- **Provider**: Internal image processing (Sharp)
- **Token Cost**: 10 tokens
- **Outputs**: Product card images with backgrounds and text overlays

## Structured Logging

All processing operations include structured logs:

```typescript
// Job start
this.monitoring.logger.info({
  jobId,
  queue: this.queueName,
  attempt: job.attemptsMade,
  data: job.data,
  tokenDeduction: tokenConfig.enabled,
}, 'Processing job');

// Token deduction
this.monitoring.logger.info({
  jobId,
  userId,
  tokensDeducted: amount,
  newBalance,
  ledgerEntryId,
}, 'Tokens deducted after successful processing');

// Token rollback
this.monitoring.logger.warn({
  userId,
  amount,
  originalLedgerEntryId,
  metadata,
}, 'Rolling back token deduction');

// Job completion
this.monitoring.logger.info({
  jobId,
  queue: this.queueName,
  processingTimeMs,
  tokensDeducted,
}, 'Job completed successfully');
```

## Metrics & KPIs

### Success Metrics

```typescript
this.monitoring.trackKPI({
  type: 'generation_success',
  data: { type: this.queueName, tokensDeducted },
});

this.monitoring.metrics.trackGenerationSuccess(provider);
```

### Failure Metrics

```typescript
this.monitoring.trackKPI({
  type: 'generation_failure',
  data: { type: this.queueName, errorType: error.name },
});

this.monitoring.metrics.trackGenerationFailure(provider, errorType);
```

### Token Rollback Metrics

```typescript
this.monitoring.trackKPI({
  type: 'token_rollback',
  data: { userId, amount, queue: this.queueName },
});
```

## Alert Hooks

### Token Deduction Failure

```typescript
this.monitoring.alerts.alertQueueFailure(
  this.queueName,
  new Error(`Token deduction failed: ${error}`),
  { userId, amount }
);
```

### Token Rollback Failure (CRITICAL)

```typescript
this.monitoring.alerts.alertQueueFailure(
  this.queueName,
  new Error(`Token rollback failed: ${error}`),
  {
    userId,
    amount,
    originalLedgerEntryId,
    severity: 'critical',  // Requires immediate attention
  }
);
```

### Processing Failure

```typescript
this.monitoring.alerts.alertQueueFailure(
  this.queueName,
  error,
  {
    jobId,
    data: job.data,
    attempts: job.attemptsMade,
  }
);
```

## Partial Failure Handling

For operations that generate multiple outputs (e.g., multiple images):

```typescript
async storeGeneratedImages(imageUrls: string[]): Promise<string[]> {
  const storedUrls: string[] = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const url = await this.storage.upload(key, buffer, mimeType);
      storedUrls.push(url);
    } catch (error) {
      this.monitoring.logger.error({
        error,
        imageUrl: imageUrls[i],
        imageIndex: i,
      }, 'Failed to store generated image');
      
      // Continue with partial results instead of failing completely
    }
  }
  
  if (storedUrls.length === 0) {
    throw new Error('Failed to store any generated images');
  }
  
  // Return partial results
  return storedUrls;
}
```

## Testing

### Unit Tests with Mocked Providers

All processors include comprehensive unit tests:

```typescript
describe('ImageGenerationProcessor', () => {
  it('should successfully process an image generation job', async () => {
    // Create generation record
    const generation = await db.generation.create({...});
    
    // Create job
    const job = {
      id: 'test-job',
      data: { userId, prompt, tool: 'dalle' },
    } as Job;
    
    // Process job
    const result = await jobProcessor(job);
    
    // Verify success
    expect(result.success).toBe(true);
    expect(result.data?.resultUrls).toBeDefined();
    
    // Verify tokens were deducted
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.tokensBalance).toBe(990); // 1000 - 10
    expect(user?.tokensSpent).toBe(10);
  });
  
  it('should rollback tokens on processing failure', async () => {
    // Test rollback scenario
  });
});
```

### Test Coverage

- ✅ Successful processing with token deduction
- ✅ Failed processing without token deduction
- ✅ Token rollback on post-processing errors
- ✅ Insufficient balance handling
- ✅ Partial failure scenarios
- ✅ Multiple outputs handling
- ✅ Provider error handling

## Configuration

### Environment Variables

```bash
# Worker concurrency
WORKER_CONCURRENCY=5
WORKER_MAX_JOBS_PER_WORKER=50

# Storage configuration
STORAGE_TYPE=local
STORAGE_BASE_URL=http://localhost:3001/storage
STORAGE_LOCAL_PATH=/app/storage

# Provider API keys (if using real providers)
FAL_API_KEY=your_fal_api_key
REPLICATE_API_TOKEN=your_replicate_token
```

### Queue-Specific Settings

Configured in `packages/shared/src/queue/config.ts`:

```typescript
export const RETRY_CONFIGS = {
  'image-generation': {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
  'chat-processing': {
    attempts: 2,
    backoff: { type: 'fixed', delay: 500 },
  },
};

export const JOB_TIMEOUTS = {
  'image-generation': 5 * 60 * 1000,  // 5 minutes
  'chat-processing': 30 * 1000,        // 30 seconds
};
```

## Error Handling

### Retry Logic

Jobs are automatically retried by BullMQ based on configuration:

1. First attempt fails → wait 1s, retry
2. Second attempt fails → wait 2s, retry
3. Third attempt fails → move to dead-letter

### Dead-Letter Handling

Failed jobs (after all retries) are:

1. Logged with full context
2. Moved to dead-letter queue (stub)
3. Alert triggered via monitoring
4. Status updated in database

### Graceful Shutdown

Workers gracefully stop on shutdown:

1. Stop accepting new jobs
2. Wait for active jobs to complete (up to 15s)
3. Force stop remaining jobs
4. Close Redis connections

## Best Practices

1. **Always use BaseProcessor** - Inherit from BaseProcessor to get automatic token deduction and rollback
2. **Configure token deduction** - Override `getTokenDeductionConfig()` to customize behavior
3. **Handle partial failures** - Continue with partial results instead of failing completely
4. **Log with context** - Include jobId, userId, and relevant metadata in all logs
5. **Track metrics** - Use monitoring.trackKPI() for success/failure tracking
6. **Test thoroughly** - Write unit tests with mocked providers
7. **Monitor alerts** - Critical alerts (token rollback failures) require immediate attention

## Monitoring

### Prometheus Metrics

Available at `http://localhost:9091/metrics`:

```
# Token operations
token_deductions_total{operation_type="image_generation"}
token_rollbacks_total{queue="image-generation"}
token_deduction_failures_total

# Job processing
worker_job_duration_seconds{queue="image-generation"}
worker_completed_jobs_total{queue="image-generation"}
worker_failed_jobs_total{queue="image-generation"}

# Provider metrics
provider_requests_total{provider="fal"}
provider_failures_total{provider="fal"}
```

### Log Aggregation

Structured logs can be aggregated using:

- **Elasticsearch**: Query by jobId, userId, or queue
- **Datadog**: Filter by service:worker and various tags
- **CloudWatch**: Group by log level and queue name

## Troubleshooting

### Token Deduction Issues

**Problem**: Tokens not being deducted
- Check token deduction config: `enabled: true`
- Verify user has sufficient balance
- Check logs for "Token deduction failed" messages

**Problem**: Tokens deducted but job failed
- This is expected if job fails AFTER token deduction
- Tokens should be rolled back automatically
- Check logs for "Rolling back token deduction" messages
- If rollback fails, check for CRITICAL alerts

### Processing Failures

**Problem**: Jobs failing repeatedly
- Check provider availability
- Verify API keys and credentials
- Review job data for invalid input
- Check storage configuration

**Problem**: Partial results
- Review logs for "Failed to store" messages
- Verify storage adapter is working
- Check disk space / S3 permissions

## Future Enhancements

1. **Provider Health Monitoring**: Track provider availability and latency
2. **Dynamic Provider Selection**: Failover to backup providers
3. **Cost Optimization**: Choose cheapest provider for each request
4. **Batch Processing**: Process multiple jobs in a single provider call
5. **Result Caching**: Cache common prompts to reduce costs
6. **Webhook Notifications**: Notify users when jobs complete
7. **Job Prioritization**: Prioritize premium users' jobs
