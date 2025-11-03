# Analytics and Monitoring

This document describes the monitoring setup, KPI tracking, and analytics queries for the system.

## Overview

The monitoring system integrates:
- **Logging**: Structured logging with Pino
- **Metrics**: Prometheus metrics collection and export
- **Error Tracking**: Sentry for error tracking and alerting
- **Alerting**: Custom alert system for queue failures and payment issues

## Metrics Endpoints

Each service exposes:
- `/metrics` - Prometheus metrics endpoint
- `/health` - Health check endpoint

Default port: `9091` (configurable via `METRICS_PORT`)

## Key Performance Indicators (KPIs)

### 1. Active Users
**Metric**: `active_users_total`
**Type**: Gauge
**Labels**: `service`

Tracks the number of currently active users in the system.

**PromQL Queries**:
```promql
# Current active users across all services
sum(active_users_total)

# Active users by service
active_users_total{service="bot"}

# Rate of active user growth (5m)
rate(active_users_total[5m])
```

### 2. Generation Success/Failure
**Metrics**: 
- `generation_success_total` (Counter)
- `generation_failure_total` (Counter)

**Labels**: `service`, `type`, `error_type` (failure only)

Tracks successful and failed content generations.

**PromQL Queries**:
```promql
# Total successful generations
sum(generation_success_total)

# Success rate (last 5m)
sum(rate(generation_success_total[5m])) / 
(sum(rate(generation_success_total[5m])) + sum(rate(generation_failure_total[5m]))) * 100

# Failure rate by error type
sum by (error_type) (rate(generation_failure_total[5m]))

# Top 5 generation types by volume
topk(5, sum by (type) (generation_success_total))
```

### 3. Token Spend
**Metric**: `token_spend_total`
**Type**: Counter
**Labels**: `service`, `model`, `type`

Tracks total tokens spent across all AI model interactions.

**PromQL Queries**:
```promql
# Total tokens spent
sum(token_spend_total)

# Token spend by model
sum by (model) (token_spend_total)

# Token spend rate (per hour)
sum(rate(token_spend_total[1h])) * 3600

# Cost estimation (assuming $0.002 per 1K tokens)
(sum(token_spend_total) / 1000) * 0.002

# Daily token spend trend
sum(increase(token_spend_total[24h]))
```

### 4. Payment Conversions
**Metrics**:
- `payment_conversions_total` (Counter)
- `payment_failures_total` (Counter)

**Labels**: `service`, `payment_method`, `plan`, `error_type` (failure only)

**PromQL Queries**:
```promql
# Total successful payments
sum(payment_conversions_total)

# Payment success rate
sum(rate(payment_conversions_total[5m])) / 
(sum(rate(payment_conversions_total[5m])) + sum(rate(payment_failures_total[5m]))) * 100

# Conversions by payment method
sum by (payment_method) (payment_conversions_total)

# Revenue by plan (last 24h, assuming plan prices)
sum by (plan) (increase(payment_conversions_total[24h]))

# Failed payments by error type
sum by (error_type) (payment_failures_total)
```

### 5. Queue Performance
**Metrics**:
- `queue_failures_total` (Counter)
- `queue_job_duration_seconds` (Histogram)
- `active_jobs_total` (Gauge)

**PromQL Queries**:
```promql
# Queue failure rate
sum(rate(queue_failures_total[5m]))

# Average job duration by queue
avg(queue_job_duration_seconds_sum / queue_job_duration_seconds_count) by (queue_name)

# P95 job duration
histogram_quantile(0.95, sum(rate(queue_job_duration_seconds_bucket[5m])) by (le, queue_name))

# Current active jobs
sum(active_jobs_total)

# Jobs by queue
sum by (queue_name) (active_jobs_total)
```

### 6. HTTP Performance
**Metrics**:
- `http_requests_total` (Counter)
- `http_request_duration_seconds` (Histogram)

**PromQL Queries**:
```promql
# Request rate by endpoint
sum by (route) (rate(http_requests_total[5m]))

# P95 response time
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))

# Error rate (4xx and 5xx)
sum(rate(http_requests_total{status_code=~"4..|5.."}[5m]))

# Success rate by endpoint
sum by (route) (rate(http_requests_total{status_code=~"2.."}[5m]))
```

### 7. Error Tracking
**Metric**: `errors_total`
**Type**: Counter
**Labels**: `service`, `error_type`, `severity`

**PromQL Queries**:
```promql
# Total error rate
sum(rate(errors_total[5m]))

# Errors by severity
sum by (severity) (errors_total)

# Critical errors only
sum(rate(errors_total{severity="critical"}[5m]))

# Top error types
topk(10, sum by (error_type) (errors_total))
```

## Grafana Dashboard Configuration

### Dashboard: Service Overview

```json
{
  "dashboard": {
    "title": "Service Overview",
    "panels": [
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "sum(active_users_total)"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m]))",
            "legendFormat": "Total"
          },
          {
            "expr": "sum by (service) (rate(http_requests_total[5m]))",
            "legendFormat": "{{service}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(errors_total[5m]))",
            "legendFormat": "Total Errors"
          },
          {
            "expr": "sum(rate(errors_total{severity='critical'}[5m]))",
            "legendFormat": "Critical"
          }
        ],
        "type": "graph"
      },
      {
        "title": "P95 Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))",
            "legendFormat": "{{route}}"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

### Dashboard: Business KPIs

```json
{
  "dashboard": {
    "title": "Business KPIs",
    "panels": [
      {
        "title": "Generation Success Rate",
        "targets": [
          {
            "expr": "sum(rate(generation_success_total[5m])) / (sum(rate(generation_success_total[5m])) + sum(rate(generation_failure_total[5m]))) * 100"
          }
        ],
        "type": "gauge",
        "thresholds": [
          { "value": 95, "color": "green" },
          { "value": 90, "color": "yellow" },
          { "value": 0, "color": "red" }
        ]
      },
      {
        "title": "Token Spend Rate",
        "targets": [
          {
            "expr": "sum(rate(token_spend_total[1h])) * 3600",
            "legendFormat": "Tokens/hour"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Payment Conversions",
        "targets": [
          {
            "expr": "sum(increase(payment_conversions_total[24h]))",
            "legendFormat": "Last 24h"
          },
          {
            "expr": "sum by (plan) (increase(payment_conversions_total[24h]))",
            "legendFormat": "{{plan}}"
          }
        ],
        "type": "bar"
      },
      {
        "title": "Payment Success Rate",
        "targets": [
          {
            "expr": "sum(rate(payment_conversions_total[5m])) / (sum(rate(payment_conversions_total[5m])) + sum(rate(payment_failures_total[5m]))) * 100"
          }
        ],
        "type": "gauge"
      }
    ]
  }
}
```

### Dashboard: Queue Monitoring

```json
{
  "dashboard": {
    "title": "Queue Monitoring",
    "panels": [
      {
        "title": "Active Jobs",
        "targets": [
          {
            "expr": "sum by (queue_name) (active_jobs_total)",
            "legendFormat": "{{queue_name}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Job Duration (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(queue_job_duration_seconds_bucket[5m])) by (le, queue_name))",
            "legendFormat": "{{queue_name}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Queue Failure Rate",
        "targets": [
          {
            "expr": "sum by (queue_name) (rate(queue_failures_total[5m]))",
            "legendFormat": "{{queue_name}}"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

## Alerting Rules

### Prometheus Alert Rules

```yaml
groups:
  - name: service_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: sum(rate(errors_total[5m])) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: CriticalErrorRate
        expr: sum(rate(errors_total{severity="critical"}[5m])) > 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Critical errors detected"
          description: "Critical error rate: {{ $value }}/sec"

      - alert: HighQueueFailureRate
        expr: sum(rate(queue_failures_total[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High queue failure rate"
          description: "Queue failure rate: {{ $value }}/sec"

      - alert: PaymentFailures
        expr: sum(increase(payment_failures_total[5m])) > 3
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Payment failures detected"
          description: "{{ $value }} payment failures in the last 5 minutes"

      - alert: LowGenerationSuccessRate
        expr: (sum(rate(generation_success_total[5m])) / (sum(rate(generation_success_total[5m])) + sum(rate(generation_failure_total[5m])))) < 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low generation success rate"
          description: "Success rate is {{ $value | humanizePercentage }}"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time on {{ $labels.route }}"
          description: "P95 response time is {{ $value }}s"

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.service }} is down"
          description: "Service has been down for more than 1 minute"
```

## Integration with Services

### Environment Variables

Add to `.env`:

```bash
# Logging
LOG_LEVEL=info

# Metrics
METRICS_PORT=9091
ENABLE_METRICS=true

# Sentry
SENTRY_ENABLED=true
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0

# Alerts
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Usage in Services

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({
  service: 'api',
  environment: process.env.NODE_ENV,
});

// Start metrics server
await monitoring.startMetricsServer();

// Track KPIs
monitoring.trackKPI({
  type: 'active_user',
  data: { userId: 'user123' },
});

monitoring.trackKPI({
  type: 'generation_success',
  data: { type: 'image' },
});

monitoring.trackKPI({
  type: 'token_spend',
  data: { tokens: 1000, model: 'gpt-4', type: 'completion' },
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

// Queue job tracking
const endTimer = monitoring.metrics.startJobTimer('main-queue', 'image-generation');
try {
  // ... process job
  monitoring.metrics.trackGenerationSuccess('image');
} catch (error) {
  monitoring.metrics.trackGenerationFailure('image', error.name);
  monitoring.alerts.alertQueueFailure('main-queue', error, jobData);
} finally {
  endTimer();
}
```

## Analytics Storage

Metrics are stored in Prometheus with configurable retention:
- **Default retention**: 15 days
- **Recommended for production**: 30-90 days
- **Long-term storage**: Use Prometheus remote write to send to Thanos, Cortex, or VictoriaMetrics

### Prometheus Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'production'
    environment: 'prod'

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:9091']
        labels:
          service: 'api'

  - job_name: 'bot'
    static_configs:
      - targets: ['bot:9091']
        labels:
          service: 'bot'

  - job_name: 'worker'
    static_configs:
      - targets: ['worker:9091']
        labels:
          service: 'worker'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - '/etc/prometheus/alerts.yml'
```

## Querying Analytics

### Common Queries for Reports

1. **Daily Active Users**: `max_over_time(active_users_total[24h])`
2. **Total Generations Today**: `sum(increase(generation_success_total[24h]))`
3. **Revenue Today** (assuming plan prices): Custom calculation based on `payment_conversions_total`
4. **Average Response Time**: `avg(http_request_duration_seconds_sum / http_request_duration_seconds_count)`
5. **System Uptime**: `avg(up) * 100`

### Export to CSV/JSON

Use Prometheus API to export data:

```bash
# Query API
curl 'http://prometheus:9090/api/v1/query?query=sum(active_users_total)'

# Range query for time series
curl 'http://prometheus:9090/api/v1/query_range?query=sum(rate(http_requests_total[5m]))&start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z&step=15m'
```
