# Monitoring and Analytics Setup

This document provides instructions for setting up the monitoring and analytics stack for the monorepo.

## Architecture

The monitoring system consists of:

1. **Pino Logger**: Structured JSON logging with pretty printing for development
2. **Prometheus**: Metrics collection and time-series database
3. **Grafana**: Visualization and dashboards
4. **Sentry**: Error tracking and performance monitoring
5. **Alert Manager**: Alerting system for critical events

## Quick Start

### 1. Environment Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Required environment variables:

```bash
# Logging
LOG_LEVEL=info

# Metrics
METRICS_PORT=9091
ENABLE_METRICS=true

# Sentry (optional but recommended for production)
SENTRY_ENABLED=true
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0

# Alerting (optional - Slack webhook)
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 2. Start Services with Monitoring

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Start services
pnpm dev
```

Each service will expose:
- `/metrics` endpoint on port 9091 (configurable)
- `/health` endpoint for health checks

### 3. Verify Metrics

Check that metrics are being exposed:

```bash
# API service metrics
curl http://localhost:9091/metrics

# Health check
curl http://localhost:9091/health
```

## Prometheus Setup

### Using Docker Compose

Create a `docker-compose.monitoring.yml` file:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./deploy/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./deploy/prometheus/alerts.yml:/etc/prometheus/alerts.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=redis-datasource
    volumes:
      - ./deploy/grafana/provisioning:/etc/grafana/provisioning
      - ./deploy/grafana/dashboards:/var/lib/grafana/dashboards
      - grafana_data:/var/lib/grafana
    networks:
      - monitoring
    depends_on:
      - prometheus

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./deploy/prometheus/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
```

### Prometheus Configuration

Create `deploy/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'production'
    environment: 'prod'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - '/etc/prometheus/alerts.yml'

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

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### Alert Rules

Create `deploy/prometheus/alerts.yml`:

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

### AlertManager Configuration

Create `deploy/prometheus/alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack'
  routes:
    - match:
        severity: critical
      receiver: 'slack'
      continue: true

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'service']
```

## Grafana Dashboards

### Data Source Configuration

Create `deploy/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

### Dashboard Provisioning

Create `deploy/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'Default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

For example dashboards, see the `packages/monitoring/ANALYTICS.md` file.

## Sentry Setup

### 1. Create a Sentry Project

1. Go to https://sentry.io
2. Create a new project (Node.js)
3. Copy the DSN

### 2. Configure Sentry

Add to your `.env`:

```bash
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0
```

### 3. Verify

Errors and performance data will automatically be sent to Sentry when enabled.

## Accessing the Stack

Once deployed:

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **Service Metrics**: http://localhost:9091/metrics
- **Service Health**: http://localhost:9091/health

## Production Deployment

### Railway/Kubernetes

For production deployment:

1. **Managed Prometheus**: Use Grafana Cloud, AWS Managed Prometheus, or Google Cloud Monitoring
2. **Managed Grafana**: Use Grafana Cloud or your cloud provider's solution
3. **Sentry**: Use Sentry.io or self-host

### Environment Variables

Set in your deployment platform:

```bash
METRICS_PORT=9091
ENABLE_METRICS=true
LOG_LEVEL=info
SENTRY_ENABLED=true
SENTRY_DSN=<your-dsn>
```

### Firewall Rules

Ensure port 9091 is accessible:
- From Prometheus scraper
- Protected from public access (internal network only)

## Usage Examples

See the service implementations for examples:
- `services/api/src/index.ts` - API service with metrics
- `services/bot/src/index.ts` - Bot service with user tracking
- `services/worker/src/index.ts` - Worker service with job metrics

For detailed API documentation, see `packages/monitoring/README.md` and `packages/monitoring/ANALYTICS.md`.

## Troubleshooting

### Metrics not appearing in Prometheus

1. Check service is exposing metrics:
   ```bash
   curl http://localhost:9091/metrics
   ```

2. Check Prometheus targets:
   Go to http://localhost:9090/targets

3. Verify Prometheus scrape config includes your service

### High memory usage

Adjust Prometheus retention:

```yaml
command:
  - '--storage.tsdb.retention.time=15d'  # Reduce from 30d
```

### Grafana dashboard not loading

1. Check Prometheus data source connection
2. Verify queries in Explore tab first
3. Check browser console for errors

## Best Practices

1. **Log Levels**: Use appropriate levels (debug, info, warn, error, fatal)
2. **Metric Labels**: Keep cardinality low - avoid user IDs as labels
3. **Retention**: Set appropriate retention based on storage capacity
4. **Sampling**: Adjust Sentry sampling rates for production
5. **Alerting**: Start with critical alerts, add more as needed
6. **Dashboards**: Create role-specific dashboards (ops, business, devs)

## Cost Optimization

1. Use managed services for production (avoid maintenance overhead)
2. Set appropriate retention periods
3. Use sampling for high-volume tracing
4. Archive old metrics to cold storage
5. Monitor your monitoring costs!
