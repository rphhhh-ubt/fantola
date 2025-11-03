# @monorepo/monitoring

Comprehensive monitoring, logging, and alerting package for the monorepo services.

## Features

- **Structured Logging**: Pino-based logging with pretty printing for development
- **Metrics Collection**: Prometheus metrics for KPIs and system metrics
- **Error Tracking**: Sentry integration for error tracking and performance monitoring
- **Alerting**: Built-in alerting for critical events (queue failures, payment issues, etc.)

## Installation

This package is already included in the workspace. To use it in a service:

```json
{
  "dependencies": {
    "@monorepo/monitoring": "workspace:*"
  }
}
```

## Quick Start

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({
  service: 'your-service-name',
  environment: process.env.NODE_ENV,
});

// Start metrics server (exposes /metrics and /health endpoints)
await monitoring.startMetricsServer(9091);

// Use logger
monitoring.logger.info('Service started');
monitoring.logger.error({ err: error }, 'Something went wrong');

// Track metrics
monitoring.metrics.trackGenerationSuccess('image');
monitoring.metrics.trackTokenSpend(1000, 'gpt-4', 'completion');

// Track KPIs
monitoring.trackKPI({
  type: 'active_user',
  data: { userId: 'user123' },
});

monitoring.trackKPI({
  type: 'payment_conversion',
  data: { paymentMethod: 'card', plan: 'premium' },
});

// Handle errors
try {
  // ... code
} catch (error) {
  monitoring.handleError(error, { context: 'additional info' });
}

// Send alerts
monitoring.alerts.alertQueueFailure('queue-name', error, jobData);
monitoring.alerts.alertPaymentFailure('payment-id', error);
```

## Environment Variables

```bash
# Logging
LOG_LEVEL=info                # debug, info, warn, error, fatal

# Metrics
METRICS_PORT=9091             # Port for metrics endpoint
ENABLE_METRICS=true

# Sentry
SENTRY_ENABLED=true
SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0

# Alerts
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
```

## API Reference

### Monitoring

Main monitoring class that integrates all features.

#### Constructor

```typescript
new Monitoring(config: MonitoringConfig)
```

#### Methods

- `startMetricsServer(port?: number): Promise<void>` - Start HTTP server for metrics
- `handleError(error: Error, context?: object): void` - Handle non-critical errors
- `handleCriticalError(error: Error, context?: object): void` - Handle critical errors with alerts
- `trackKPI(kpi: KPIData): void` - Track key performance indicators

### Logger

Structured logger based on Pino.

```typescript
logger.debug('Debug message', { extra: 'data' });
logger.info('Info message');
logger.warn('Warning message');
logger.error({ err: error }, 'Error message');
logger.fatal('Fatal error');
```

### Metrics

Prometheus metrics collector.

#### Available Metrics

- `activeUsers: Gauge` - Number of active users
- `generationSuccess: Counter` - Successful generations
- `generationFailure: Counter` - Failed generations
- `tokenSpend: Counter` - Total tokens spent
- `paymentConversions: Counter` - Successful payments
- `paymentFailures: Counter` - Failed payments
- `queueFailures: Counter` - Queue job failures
- `queueJobDuration: Histogram` - Job processing duration
- `httpRequestDuration: Histogram` - HTTP request duration
- `httpRequestTotal: Counter` - Total HTTP requests
- `activeJobs: Gauge` - Number of active jobs
- `errorCounter: Counter` - Total errors

#### Methods

```typescript
metrics.trackGenerationSuccess(type: string);
metrics.trackGenerationFailure(type: string, errorType: string);
metrics.trackTokenSpend(tokens: number, model: string, type: string);
metrics.trackPaymentConversion(paymentMethod: string, plan: string);
metrics.trackPaymentFailure(paymentMethod: string, errorType: string);
metrics.trackQueueFailure(queueName: string, errorType: string);

// Timer
const endTimer = metrics.startJobTimer(queueName, jobType);
// ... do work
endTimer();

// HTTP metrics
metrics.trackHttpRequest(method, route, statusCode, duration);

// Active jobs
metrics.setActiveJobs(queueName, count);
```

### Alerts

Alert manager for critical events.

```typescript
alerts.alertQueueFailure(queueName, error, jobData);
alerts.alertPaymentFailure(paymentId, error, paymentData);
alerts.alertHighErrorRate(service, errorCount, timeWindow);
alerts.alertServiceDegradation(service, metric, value, threshold);
alerts.alertCriticalError(error, context);
```

### Sentry

Error tracking with Sentry.

```typescript
import { captureException, captureMessage, setUser } from '@monorepo/monitoring';

captureException(error, { extra: 'context' });
captureMessage('Important message', 'info');
setUser({ id: '123', email: 'user@example.com' });
```

## Integration Examples

### API Service with HTTP Middleware

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'api' });

// Express middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    monitoring.metrics.trackHttpRequest(
      req.method,
      req.route?.path || req.path,
      res.statusCode,
      duration
    );
  });
  
  next();
});
```

### Worker Service with Job Processing

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'worker' });

async function processJob(job: Job) {
  const endTimer = monitoring.metrics.startJobTimer('main-queue', job.type);
  
  try {
    await job.process();
    monitoring.metrics.trackGenerationSuccess(job.type);
    monitoring.logger.info({ jobId: job.id }, 'Job completed');
  } catch (error) {
    monitoring.metrics.trackGenerationFailure(job.type, error.name);
    monitoring.alerts.alertQueueFailure('main-queue', error, { jobId: job.id });
    throw error;
  } finally {
    endTimer();
  }
}
```

### Bot Service with User Tracking

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'bot' });

bot.on('message', async (msg) => {
  monitoring.trackKPI({
    type: 'active_user',
    data: { userId: msg.from.id.toString() },
  });
  
  monitoring.logger.info({
    userId: msg.from.id,
    text: msg.text,
  }, 'Message received');
});
```

## Metrics Endpoint

Once started, metrics are available at:
- `http://localhost:9091/metrics` - Prometheus metrics
- `http://localhost:9091/health` - Health check

## Dashboard Setup

See [ANALYTICS.md](./ANALYTICS.md) for:
- Grafana dashboard configurations
- Prometheus query examples
- Alerting rules
- Analytics storage setup

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## License

MIT
