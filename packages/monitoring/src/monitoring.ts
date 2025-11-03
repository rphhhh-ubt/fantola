import { createLogger, Logger, LoggerConfig } from './logger';
import { MetricsCollector, MetricsConfig } from './metrics';
import { initializeSentry, SentryConfig, captureException } from './sentry';
import { AlertManager, AlertConfig } from './alerts';

export interface MonitoringConfig {
  service: string;
  environment?: string;
  logger?: Partial<LoggerConfig>;
  metrics?: Partial<MetricsConfig>;
  sentry?: Partial<SentryConfig>;
  alerts?: Partial<Omit<AlertConfig, 'logger'>>;
}

export class Monitoring {
  public logger: Logger;
  public metrics: MetricsCollector;
  public alerts: AlertManager;
  private service: string;

  constructor(config: MonitoringConfig) {
    this.service = config.service;

    this.logger = createLogger({
      service: config.service,
      environment: config.environment || process.env.NODE_ENV || 'development',
      level: config.logger?.level || process.env.LOG_LEVEL || 'info',
      pretty: config.logger?.pretty ?? (config.environment === 'development'),
      ...config.logger,
    });

    this.metrics = new MetricsCollector({
      service: config.service,
      enableDefaultMetrics: config.metrics?.enableDefaultMetrics !== false,
      ...config.metrics,
    });

    initializeSentry({
      service: config.service,
      environment: config.environment || process.env.NODE_ENV || 'development',
      dsn: process.env.SENTRY_DSN,
      enabled: process.env.SENTRY_ENABLED === 'true',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '1.0'),
      ...config.sentry,
    });

    this.alerts = new AlertManager({
      logger: this.logger,
      webhookUrl: process.env.ALERT_WEBHOOK_URL,
      enableSentry: process.env.SENTRY_ENABLED === 'true',
      ...config.alerts,
    });
  }

  async startMetricsServer(port?: number): Promise<void> {
    const metricsPort = port || parseInt(process.env.METRICS_PORT || '9091', 10);
    
    const http = await import('http');
    
    const server = http.createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', 'text/plain');
        const metrics = await this.metrics.getMetrics();
        res.end(metrics);
      } else if (req.url === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', service: this.service }));
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    server.listen(metricsPort, () => {
      this.logger.info({ port: metricsPort }, `Metrics server started on port ${metricsPort}`);
    });
  }

  handleError(error: Error, context?: Record<string, any>): void {
    this.logger.error({ err: error, ...context }, error.message);
    this.metrics.trackError(error.name, 'high');
    
    if (process.env.SENTRY_ENABLED === 'true') {
      captureException(error, context);
    }
  }

  handleCriticalError(error: Error, context?: Record<string, any>): void {
    this.logger.fatal({ err: error, ...context }, error.message);
    this.metrics.trackError(error.name, 'critical');
    this.alerts.alertCriticalError(error, context);
    
    if (process.env.SENTRY_ENABLED === 'true') {
      captureException(error, context);
    }
  }

  trackKPI(kpi: {
    type: 'active_user' | 'generation_success' | 'generation_failure' | 'token_spend' | 'payment_conversion' | 'payment_failure';
    data: Record<string, any>;
  }): void {
    switch (kpi.type) {
      case 'active_user':
        this.metrics.trackActiveUser(kpi.data.userId);
        this.logger.debug({ userId: kpi.data.userId }, 'Active user tracked');
        break;
      
      case 'generation_success':
        this.metrics.trackGenerationSuccess(kpi.data.type);
        this.logger.info({ type: kpi.data.type }, 'Generation succeeded');
        break;
      
      case 'generation_failure':
        this.metrics.trackGenerationFailure(kpi.data.type, kpi.data.errorType);
        this.logger.warn({ type: kpi.data.type, errorType: kpi.data.errorType }, 'Generation failed');
        break;
      
      case 'token_spend':
        this.metrics.trackTokenSpend(kpi.data.tokens, kpi.data.model, kpi.data.type);
        this.logger.debug({
          tokens: kpi.data.tokens,
          model: kpi.data.model,
          type: kpi.data.type,
        }, 'Tokens spent');
        break;
      
      case 'payment_conversion':
        this.metrics.trackPaymentConversion(kpi.data.paymentMethod, kpi.data.plan);
        this.logger.info({
          paymentMethod: kpi.data.paymentMethod,
          plan: kpi.data.plan,
        }, 'Payment conversion tracked');
        break;
      
      case 'payment_failure':
        this.metrics.trackPaymentFailure(kpi.data.paymentMethod, kpi.data.errorType);
        this.alerts.alertPaymentFailure(kpi.data.paymentId, new Error(kpi.data.errorType), kpi.data);
        this.logger.error({
          paymentMethod: kpi.data.paymentMethod,
          errorType: kpi.data.errorType,
        }, 'Payment failed');
        break;
    }
  }
}
