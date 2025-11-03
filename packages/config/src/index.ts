export interface Config {
  nodeEnv: string;
  port: number;
  logLevel: string;
  metricsPort: number;
  enableMetrics: boolean;
  sentryEnabled: boolean;
  sentryDsn?: string;
  sentryTracesSampleRate: number;
  sentryProfilesSampleRate: number;
  alertWebhookUrl?: string;
  redisUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
}

export function getConfig(): Config {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    metricsPort: parseInt(process.env.METRICS_PORT || '9091', 10),
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    sentryEnabled: process.env.SENTRY_ENABLED === 'true',
    sentryDsn: process.env.SENTRY_DSN,
    sentryTracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
    sentryProfilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '1.0'),
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
    redisUrl: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    redisPassword: process.env.REDIS_PASSWORD,
  };
}
