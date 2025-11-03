# Monitoring Examples

This document provides practical examples of using the monitoring package in different scenarios.

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [API Service with Express](#api-service-with-express)
3. [Bot Service with Telegram](#bot-service-with-telegram)
4. [Worker Service with Queue Processing](#worker-service-with-queue-processing)
5. [Payment Processing](#payment-processing)
6. [AI Generation with Cost Tracking](#ai-generation-with-cost-tracking)
7. [Custom Metrics](#custom-metrics)

## Basic Setup

```typescript
import { Monitoring } from '@monorepo/monitoring';
import { getConfig } from '@monorepo/config';

async function main() {
  const config = getConfig();

  // Initialize monitoring
  const monitoring = new Monitoring({
    service: 'my-service',
    environment: config.nodeEnv,
  });

  // Start metrics server
  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
    monitoring.logger.info({ port: config.metricsPort }, 'Metrics server started');
  }

  // Your application code here...
}

main().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
```

## API Service with Express

```typescript
import express from 'express';
import { Monitoring, createExpressMetricsMiddleware, createExpressErrorHandler } from '@monorepo/monitoring';
import { getConfig } from '@monorepo/config';

async function createServer() {
  const config = getConfig();
  const monitoring = new Monitoring({
    service: 'api',
    environment: config.nodeEnv,
  });

  // Start metrics server
  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
  }

  const app = express();

  // Body parsing middleware
  app.use(express.json());

  // Metrics middleware (automatically tracks HTTP metrics)
  app.use(createExpressMetricsMiddleware({
    monitoring,
    ignorePaths: ['/health', '/metrics'],
  }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'api' });
  });

  // Example endpoint
  app.post('/api/generate', async (req, res) => {
    const { userId, prompt } = req.body;

    monitoring.logger.info({ userId, prompt }, 'Generation requested');

    // Track active user
    monitoring.trackKPI({
      type: 'active_user',
      data: { userId },
    });

    try {
      // Generate content
      const result = await generateContent(prompt);

      // Track success
      monitoring.trackKPI({
        type: 'generation_success',
        data: { type: 'text' },
      });

      // Track token usage
      monitoring.trackKPI({
        type: 'token_spend',
        data: {
          tokens: result.usage.total_tokens,
          model: 'gpt-4',
          type: 'completion',
        },
      });

      res.json({ success: true, result: result.text });
    } catch (error) {
      // Track failure
      monitoring.trackKPI({
        type: 'generation_failure',
        data: { type: 'text', errorType: error.name },
      });

      monitoring.handleError(error, { userId, prompt });

      res.status(500).json({
        success: false,
        error: 'Failed to generate content',
      });
    }
  });

  // Error handler middleware (must be last)
  app.use(createExpressErrorHandler(monitoring));

  app.listen(config.port, () => {
    monitoring.logger.info({ port: config.port }, 'Server started');
  });

  return app;
}

createServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

## Bot Service with Telegram

```typescript
import TelegramBot from 'node-telegram-bot-api';
import { Monitoring } from '@monorepo/monitoring';
import { getConfig } from '@monorepo/config';

async function startBot() {
  const config = getConfig();
  const monitoring = new Monitoring({
    service: 'bot',
    environment: config.nodeEnv,
  });

  // Start metrics server
  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
  }

  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

  monitoring.logger.info('Bot started');

  // Handle /start command
  bot.onText(/\/start/, (msg) => {
    const userId = msg.from!.id.toString();

    monitoring.trackKPI({
      type: 'active_user',
      data: { userId },
    });

    monitoring.logger.info({ userId }, 'User started bot');

    bot.sendMessage(msg.chat.id, 'Welcome! Send me a prompt and I\'ll generate an image.');
  });

  // Handle text messages
  bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return; // Ignore commands

    const userId = msg.from!.id.toString();
    const prompt = msg.text || '';

    monitoring.trackKPI({
      type: 'active_user',
      data: { userId },
    });

    monitoring.logger.info({ userId, prompt }, 'Message received');

    try {
      await bot.sendChatAction(msg.chat.id, 'typing');

      // Generate response
      const response = await generateAIResponse(prompt);

      // Track metrics
      monitoring.trackKPI({
        type: 'generation_success',
        data: { type: 'text' },
      });

      monitoring.trackKPI({
        type: 'token_spend',
        data: {
          tokens: response.usage.total_tokens,
          model: 'gpt-4',
          type: 'completion',
        },
      });

      await bot.sendMessage(msg.chat.id, response.text);

      monitoring.logger.info({ userId }, 'Response sent');
    } catch (error) {
      monitoring.trackKPI({
        type: 'generation_failure',
        data: { type: 'text', errorType: error.name },
      });

      monitoring.handleError(error, { userId, prompt });

      await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong. Please try again.');
    }
  });

  // Handle errors
  bot.on('polling_error', (error) => {
    monitoring.handleError(error, { context: 'telegram_polling' });
  });
}

startBot().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
```

## Worker Service with Queue Processing

```typescript
import { Queue, Worker, Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { getConfig } from '@monorepo/config';

interface ImageGenerationJob {
  userId: string;
  prompt: string;
  size: '1024x1024' | '512x512';
}

async function startWorker() {
  const config = getConfig();
  const monitoring = new Monitoring({
    service: 'worker',
    environment: config.nodeEnv,
  });

  // Start metrics server
  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
  }

  const queueName = 'image-generation';

  const worker = new Worker<ImageGenerationJob>(
    queueName,
    async (job: Job<ImageGenerationJob>) => {
      return await processImageGenerationJob(job, monitoring);
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    monitoring.logger.info({ jobId: job.id }, 'Job completed');
    monitoring.metrics.setActiveJobs(queueName, worker.activeCount);
  });

  worker.on('failed', (job, error) => {
    monitoring.logger.error({ jobId: job?.id, err: error }, 'Job failed');
    monitoring.metrics.setActiveJobs(queueName, worker.activeCount);
  });

  monitoring.logger.info({ concurrency: 5 }, 'Worker started');
}

async function processImageGenerationJob(
  job: Job<ImageGenerationJob>,
  monitoring: Monitoring
): Promise<{ imageUrl: string }> {
  const queueName = 'image-generation';
  const jobType = 'dalle-3';

  monitoring.logger.info({
    jobId: job.id,
    userId: job.data.userId,
    prompt: job.data.prompt,
  }, 'Processing job');

  // Start timer and track active jobs
  const endTimer = monitoring.metrics.startJobTimer(queueName, jobType);

  try {
    // Track job as active
    const activeCount = await getActiveJobCount(queueName);
    monitoring.metrics.setActiveJobs(queueName, activeCount);

    // Generate image
    const image = await generateImage({
      prompt: job.data.prompt,
      size: job.data.size,
    });

    // Track success
    monitoring.trackKPI({
      type: 'generation_success',
      data: { type: 'image' },
    });

    // Track cost (DALL-E 3 costs per image)
    monitoring.trackKPI({
      type: 'token_spend',
      data: {
        tokens: 1, // 1 image = 1 unit for tracking
        model: 'dall-e-3',
        type: 'image',
      },
    });

    monitoring.logger.info({
      jobId: job.id,
      userId: job.data.userId,
      imageUrl: image.url,
    }, 'Image generated');

    return { imageUrl: image.url };
  } catch (error) {
    // Track failure
    monitoring.metrics.trackQueueFailure(queueName, error.name);

    monitoring.trackKPI({
      type: 'generation_failure',
      data: { type: 'image', errorType: error.name },
    });

    // Alert on failure
    monitoring.alerts.alertQueueFailure(queueName, error, {
      jobId: job.id,
      userId: job.data.userId,
      prompt: job.data.prompt,
      attempts: job.attemptsMade,
    });

    monitoring.logger.error({
      jobId: job.id,
      userId: job.data.userId,
      err: error,
    }, 'Job failed');

    throw error;
  } finally {
    endTimer();
  }
}

startWorker().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
```

## Payment Processing

```typescript
import { Monitoring } from '@monorepo/monitoring';
import Stripe from 'stripe';

const monitoring = new Monitoring({ service: 'api' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function processPayment(
  userId: string,
  plan: 'basic' | 'premium' | 'enterprise',
  amount: number
) {
  monitoring.logger.info({ userId, plan, amount }, 'Processing payment');

  try {
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      metadata: {
        userId,
        plan,
      },
    });

    monitoring.logger.info({
      userId,
      paymentId: paymentIntent.id,
    }, 'Payment intent created');

    // Simulate payment confirmation
    const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id);

    if (confirmed.status === 'succeeded') {
      // Track successful payment
      monitoring.trackKPI({
        type: 'payment_conversion',
        data: {
          paymentMethod: 'card',
          plan,
        },
      });

      monitoring.logger.info({
        userId,
        paymentId: confirmed.id,
        plan,
        amount,
      }, 'Payment successful');

      return {
        success: true,
        paymentId: confirmed.id,
        status: confirmed.status,
      };
    } else {
      throw new Error(`Payment not successful: ${confirmed.status}`);
    }
  } catch (error) {
    // Track payment failure
    monitoring.trackKPI({
      type: 'payment_failure',
      data: {
        paymentId: error.payment_intent?.id || 'unknown',
        paymentMethod: 'card',
        errorType: error.code || error.name,
      },
    });

    // Send alert for payment failure
    monitoring.alerts.alertPaymentFailure(
      error.payment_intent?.id || 'unknown',
      error,
      {
        userId,
        plan,
        amount,
        errorCode: error.code,
      }
    );

    monitoring.logger.error({
      userId,
      plan,
      amount,
      err: error,
    }, 'Payment failed');

    throw error;
  }
}

// Example usage
processPayment('user-123', 'premium', 29.99)
  .then((result) => console.log('Payment result:', result))
  .catch((error) => console.error('Payment error:', error));
```

## AI Generation with Cost Tracking

```typescript
import OpenAI from 'openai';
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'worker' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Pricing per 1K tokens
const PRICING = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

async function generateText(prompt: string, model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo') {
  monitoring.logger.info({ prompt, model }, 'Generating text');

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });

    const usage = response.usage!;
    const text = response.choices[0].message.content!;

    // Track input tokens
    monitoring.trackKPI({
      type: 'token_spend',
      data: {
        tokens: usage.prompt_tokens,
        model,
        type: 'input',
      },
    });

    // Track output tokens
    monitoring.trackKPI({
      type: 'token_spend',
      data: {
        tokens: usage.completion_tokens,
        model,
        type: 'output',
      },
    });

    // Calculate cost
    const inputCost = (usage.prompt_tokens / 1000) * PRICING[model].input;
    const outputCost = (usage.completion_tokens / 1000) * PRICING[model].output;
    const totalCost = inputCost + outputCost;

    monitoring.trackKPI({
      type: 'generation_success',
      data: { type: 'text' },
    });

    monitoring.logger.info({
      model,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cost: totalCost.toFixed(4),
    }, 'Text generated successfully');

    return {
      text,
      usage,
      cost: totalCost,
    };
  } catch (error) {
    monitoring.trackKPI({
      type: 'generation_failure',
      data: { type: 'text', errorType: error.name },
    });

    monitoring.handleError(error, { prompt, model });

    throw error;
  }
}

// Example usage
generateText('Write a poem about TypeScript', 'gpt-4')
  .then((result) => {
    console.log('Generated text:', result.text);
    console.log('Cost: $' + result.cost.toFixed(4));
  })
  .catch((error) => console.error('Generation error:', error));
```

## Custom Metrics

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'custom' });

// Access the raw metrics collector for custom metrics
const { metrics } = monitoring;

// Example: Track custom business metric
function trackUserSubscription(userId: string, tier: string) {
  // Use the metrics collector directly for custom tracking
  metrics.activeUsers.inc({ service: 'custom' });

  monitoring.logger.info({
    userId,
    tier,
    timestamp: new Date().toISOString(),
  }, 'User subscribed');
}

// Example: Track custom event with duration
async function trackCustomOperation(operationName: string) {
  const startTime = Date.now();

  try {
    // Your operation here
    await performOperation();

    const duration = (Date.now() - startTime) / 1000;

    monitoring.logger.info({
      operation: operationName,
      duration,
    }, 'Operation completed');
  } catch (error) {
    monitoring.handleError(error, { operation: operationName });
    throw error;
  }
}

// Example: Batch metrics update
function updateDailyMetrics(stats: {
  activeUsers: number;
  totalGenerations: number;
  totalRevenue: number;
}) {
  monitoring.logger.info(stats, 'Daily metrics updated');

  // Log for later analysis
  monitoring.logger.info({
    type: 'daily_metrics',
    date: new Date().toISOString().split('T')[0],
    ...stats,
  }, 'Daily metrics snapshot');
}
```

## Environment Configuration

Create a `.env` file with monitoring configuration:

```bash
# Logging
LOG_LEVEL=info

# Metrics
METRICS_PORT=9091
ENABLE_METRICS=true

# Sentry (optional)
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=1.0

# Alerting (optional)
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## Testing with Monitoring

```typescript
import { Monitoring } from '@monorepo/monitoring';

describe('Service with monitoring', () => {
  let monitoring: Monitoring;

  beforeEach(() => {
    monitoring = new Monitoring({
      service: 'test',
      environment: 'test',
    });
  });

  it('should track metrics during operation', async () => {
    // Your test code
    await performOperation();

    // Get metrics to verify
    const metricsOutput = await monitoring.metrics.getMetrics();
    expect(metricsOutput).toContain('generation_success_total');
  });

  it('should handle errors with monitoring', async () => {
    try {
      await operationThatFails();
    } catch (error) {
      monitoring.handleError(error, { context: 'test' });
    }

    // Verify error was tracked
    const metricsOutput = await monitoring.metrics.getMetrics();
    expect(metricsOutput).toContain('errors_total');
  });
});
```

## Next Steps

- See [ANALYTICS.md](./ANALYTICS.md) for Prometheus queries and dashboards
- See [README.md](./README.md) for complete API reference
- See [../../../docs/MONITORING.md](../../../docs/MONITORING.md) for deployment setup
