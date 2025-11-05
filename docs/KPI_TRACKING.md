# KPI Tracking Guide

This document describes how to track Key Performance Indicators (KPIs) across the system using the monitoring package.

## Overview

The system tracks the following KPIs:

1. **Active Users** - Currently active users in the system
2. **Generation Success/Failure** - Success rate of content generation
3. **Token Spend** - AI token consumption
4. **Payment Conversions** - Successful payment completions
5. **Queue Performance** - Job processing metrics
6. **System Performance** - Response times, error rates

## Implementation Guide

### 1. Active Users

Track when users interact with the system:

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'bot' });

// Track active user
monitoring.trackKPI({
  type: 'active_user',
  data: { userId: 'user-123' },
});
```

**When to track:**

- User sends a message (bot service)
- User makes an API request (api service)
- User session starts

**Metric exposed:**

- `active_users_total{service="bot"}`

### 2. Generation Success/Failure

Track AI content generation attempts:

```typescript
// Success
monitoring.trackKPI({
  type: 'generation_success',
  data: { type: 'image' }, // or 'text', 'video', etc.
});

// Failure
monitoring.trackKPI({
  type: 'generation_failure',
  data: {
    type: 'image',
    errorType: 'timeout', // or 'api_error', 'validation_error', etc.
  },
});
```

**When to track:**

- After calling AI generation APIs (OpenAI, Anthropic, etc.)
- On worker job completion
- After content creation pipeline

**Metrics exposed:**

- `generation_success_total{service="worker",type="image"}`
- `generation_failure_total{service="worker",type="image",error_type="timeout"}`

**Business insights:**

- Success rate: `success / (success + failure)`
- Most common failure types
- Generation volume by type

### 3. Token Spend

Track AI token consumption:

```typescript
monitoring.trackKPI({
  type: 'token_spend',
  data: {
    tokens: 1500,
    model: 'gpt-4',
    type: 'completion', // or 'embedding', 'image', etc.
  },
});
```

**When to track:**

- After every AI API call
- When processing batch operations
- On worker job completion

**Metric exposed:**

- `token_spend_total{service="worker",model="gpt-4",type="completion"}`

**Business insights:**

- Total cost: `(tokens / 1000) * price_per_1k_tokens`
- Cost by model
- Cost trends over time
- Cost per user

**Example cost calculation:**

```typescript
// GPT-4 pricing: $0.03/1K input tokens, $0.06/1K output tokens
const inputCost = (inputTokens / 1000) * 0.03;
const outputCost = (outputTokens / 1000) * 0.06;
const totalCost = inputCost + outputCost;

// Track both input and output separately
monitoring.trackKPI({
  type: 'token_spend',
  data: { tokens: inputTokens, model: 'gpt-4', type: 'input' },
});
monitoring.trackKPI({
  type: 'token_spend',
  data: { tokens: outputTokens, model: 'gpt-4', type: 'output' },
});
```

### 4. Payment Conversions

Track successful payments:

```typescript
// Success
monitoring.trackKPI({
  type: 'payment_conversion',
  data: {
    paymentMethod: 'card', // or 'yookassa', 'paypal', etc.
    plan: 'premium', // or 'basic', 'enterprise', etc.
  },
});

// Failure
monitoring.trackKPI({
  type: 'payment_failure',
  data: {
    paymentId: 'payment-123',
    paymentMethod: 'card',
    errorType: 'insufficient_funds', // or 'card_declined', 'network_error', etc.
  },
});
```

**When to track:**

- After payment gateway response
- On webhook confirmation
- After subscription renewal

**Metrics exposed:**

- `payment_conversions_total{service="api",payment_method="card",plan="premium"}`
- `payment_failures_total{service="api",payment_method="card",error_type="insufficient_funds"}`

**Business insights:**

- Conversion rate: `conversions / (conversions + failures)`
- Revenue by plan
- Most common payment failure reasons
- Payment method preferences

**Alerting:**
Payment failures trigger automatic alerts:

```typescript
// Alerts are automatically sent when tracking payment failures
// Custom alert for high-value failures:
if (amount > 1000) {
  monitoring.alerts.alertPaymentFailure(paymentId, error, {
    amount,
    currency,
    plan,
  });
}
```

### 5. Queue Performance

Track background job processing:

```typescript
const queueName = 'image-generation';
const jobType = 'dalle-3';

// Start timer
const endTimer = monitoring.metrics.startJobTimer(queueName, jobType);

// Track active jobs
monitoring.metrics.setActiveJobs(queueName, activeCount);

try {
  // Process job
  await processJob(job);

  // Track success
  monitoring.trackKPI({
    type: 'generation_success',
    data: { type: jobType },
  });
} catch (error) {
  // Track failure
  monitoring.metrics.trackQueueFailure(queueName, error.name);
  monitoring.alerts.alertQueueFailure(queueName, error, {
    jobId: job.id,
    attempts: job.attempts,
  });

  monitoring.trackKPI({
    type: 'generation_failure',
    data: { type: jobType, errorType: error.name },
  });
} finally {
  // Stop timer
  endTimer();
  monitoring.metrics.setActiveJobs(queueName, activeCount - 1);
}
```

**Metrics exposed:**

- `queue_failures_total{service="worker",queue_name="image-generation",error_type="timeout"}`
- `queue_job_duration_seconds{service="worker",queue_name="image-generation",job_type="dalle-3"}`
- `active_jobs_total{service="worker",queue_name="image-generation"}`

**Business insights:**

- P95 job duration
- Queue throughput
- Failure rate by error type
- Queue backlog

### 6. HTTP Performance (API Service)

Automatically tracked with middleware:

```typescript
import { createExpressMetricsMiddleware } from '@monorepo/monitoring';

app.use(
  createExpressMetricsMiddleware({
    monitoring,
    ignorePaths: ['/health', '/metrics'],
  })
);
```

**Metrics exposed:**

- `http_requests_total{service="api",method="POST",route="/api/generate",status_code="200"}`
- `http_request_duration_seconds{service="api",method="POST",route="/api/generate",status_code="200"}`

**Business insights:**

- Request rate
- P95/P99 response times
- Error rate (4xx/5xx)
- Most used endpoints

## Real-World Examples

### Example 1: Telegram Bot Message Handler

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'bot' });

bot.on('message', async (msg) => {
  // Track active user
  monitoring.trackKPI({
    type: 'active_user',
    data: { userId: msg.from.id.toString() },
  });

  // Log message
  monitoring.logger.info(
    {
      userId: msg.from.id,
      text: msg.text,
    },
    'Message received'
  );

  try {
    // Call AI to generate response
    const response = await generateResponse(msg.text);

    // Track token usage
    monitoring.trackKPI({
      type: 'token_spend',
      data: {
        tokens: response.usage.total_tokens,
        model: 'gpt-4',
        type: 'completion',
      },
    });

    // Track success
    monitoring.trackKPI({
      type: 'generation_success',
      data: { type: 'text' },
    });

    await bot.sendMessage(msg.chat.id, response.text);
  } catch (error) {
    // Track failure
    monitoring.trackKPI({
      type: 'generation_failure',
      data: { type: 'text', errorType: error.name },
    });

    monitoring.handleError(error, {
      userId: msg.from.id,
      messageText: msg.text,
    });

    await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong.');
  }
});
```

### Example 2: Payment Processing

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'api' });

async function processPayment(userId: string, plan: string, amount: number) {
  monitoring.logger.info(
    {
      userId,
      plan,
      amount,
    },
    'Processing payment'
  );

  try {
    const payment = await paymentGateway.createPayment({
      userId,
      plan,
      amount,
    });

    // Wait for confirmation
    const result = await waitForPaymentConfirmation(payment.id);

    if (result.status === 'succeeded') {
      // Track conversion
      monitoring.trackKPI({
        type: 'payment_conversion',
        data: {
          paymentMethod: result.payment_method,
          plan,
        },
      });

      monitoring.logger.info(
        {
          userId,
          paymentId: payment.id,
          plan,
          amount,
        },
        'Payment successful'
      );

      return { success: true, paymentId: payment.id };
    } else {
      throw new Error(`Payment failed: ${result.status}`);
    }
  } catch (error) {
    // Track failure
    monitoring.trackKPI({
      type: 'payment_failure',
      data: {
        paymentId: payment?.id || 'unknown',
        paymentMethod: 'card',
        errorType: error.code || error.name,
      },
    });

    // Alert on payment failure
    monitoring.alerts.alertPaymentFailure(payment?.id || 'unknown', error, {
      userId,
      plan,
      amount,
    });

    monitoring.logger.error(
      {
        err: error,
        userId,
        plan,
        amount,
      },
      'Payment failed'
    );

    throw error;
  }
}
```

### Example 3: Worker Job Processing

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'worker' });

async function processImageGenerationJob(job: Job) {
  const queueName = 'image-generation';
  const jobType = 'dalle-3';

  monitoring.logger.info(
    {
      jobId: job.id,
      userId: job.data.userId,
      prompt: job.data.prompt,
    },
    'Processing image generation job'
  );

  // Start timer and track active jobs
  const endTimer = monitoring.metrics.startJobTimer(queueName, jobType);
  monitoring.metrics.setActiveJobs(queueName, activeJobsCount + 1);

  try {
    // Generate image
    const image = await openai.images.generate({
      model: 'dall-e-3',
      prompt: job.data.prompt,
      n: 1,
      size: '1024x1024',
    });

    // Track token spend (DALL-E pricing is per image, but we can track it)
    monitoring.trackKPI({
      type: 'token_spend',
      data: {
        tokens: 1, // 1 image = 1 "token" for tracking
        model: 'dall-e-3',
        type: 'image',
      },
    });

    // Track success
    monitoring.trackKPI({
      type: 'generation_success',
      data: { type: 'image' },
    });

    monitoring.logger.info(
      {
        jobId: job.id,
        userId: job.data.userId,
        imageUrl: image.data[0].url,
      },
      'Image generated successfully'
    );

    return { success: true, imageUrl: image.data[0].url };
  } catch (error) {
    // Track failure
    monitoring.metrics.trackQueueFailure(queueName, error.name);

    monitoring.trackKPI({
      type: 'generation_failure',
      data: { type: 'image', errorType: error.name },
    });

    // Alert on queue failure
    monitoring.alerts.alertQueueFailure(queueName, error, {
      jobId: job.id,
      userId: job.data.userId,
      prompt: job.data.prompt,
      attempts: job.attemptsMade,
    });

    monitoring.logger.error(
      {
        err: error,
        jobId: job.id,
        userId: job.data.userId,
      },
      'Image generation failed'
    );

    throw error;
  } finally {
    // Stop timer and update active jobs
    endTimer();
    monitoring.metrics.setActiveJobs(queueName, activeJobsCount);
  }
}
```

## Dashboard Queries

See `packages/monitoring/ANALYTICS.md` for complete dashboard configurations and PromQL queries.

### Quick Queries

**Active Users:**

```promql
sum(active_users_total)
```

**Generation Success Rate:**

```promql
sum(rate(generation_success_total[5m])) /
(sum(rate(generation_success_total[5m])) + sum(rate(generation_failure_total[5m]))) * 100
```

**Token Spend per Hour:**

```promql
sum(rate(token_spend_total[1h])) * 3600
```

**Payment Conversion Rate:**

```promql
sum(rate(payment_conversions_total[5m])) /
(sum(rate(payment_conversions_total[5m])) + sum(rate(payment_failures_total[5m]))) * 100
```

**Queue P95 Duration:**

```promql
histogram_quantile(0.95, sum(rate(queue_job_duration_seconds_bucket[5m])) by (le, queue_name))
```

## Best Practices

1. **Always track both success and failure** for rate calculations
2. **Use consistent type labels** (e.g., 'image', 'text', not 'img', 'txt')
3. **Track errors with meaningful error types** for debugging
4. **Set alerts for critical KPIs** (payment failures, high error rates)
5. **Include context in logs** for troubleshooting
6. **Monitor costs** by tracking token usage
7. **Review metrics regularly** to identify trends

## Troubleshooting

**Metrics not appearing:**

1. Check service is exposing metrics: `curl http://localhost:9091/metrics`
2. Verify `ENABLE_METRICS=true` in environment
3. Check Prometheus scrape targets

**Incorrect counts:**

1. Use `rate()` for counters, not raw values
2. Ensure you're tracking all code paths (success and failure)
3. Check for duplicate tracking calls

**High cardinality warnings:**

1. Don't use user IDs as metric labels
2. Limit the number of unique values for labels
3. Use log context for high-cardinality data

## Next Steps

1. Set up Grafana dashboards (see `docs/MONITORING.md`)
2. Configure alerting rules for your business
3. Set up Sentry for error tracking
4. Create custom KPIs for your specific needs
5. Export metrics for long-term analysis
