import { z } from 'zod';
import { apiConfigSchema, databaseConfigSchema, ApiConfig } from './schemas';
import { loadEnv } from './env';

/**
 * Parse and validate API service configuration
 */
export function getApiConfig(): ApiConfig {
  loadEnv();

  try {
    const baseConfig = apiConfigSchema.parse({
      // Base config
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      logLevel: process.env.LOG_LEVEL,
      enableMetrics: process.env.ENABLE_METRICS,
      metricsPort: process.env.METRICS_PORT,
      sentryEnabled: process.env.SENTRY_ENABLED,
      sentryDsn: process.env.SENTRY_DSN,
      sentryTracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
      sentryProfilesSampleRate: process.env.SENTRY_PROFILES_SAMPLE_RATE,
      alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
      redisHost: process.env.REDIS_HOST,
      redisPort: process.env.REDIS_PORT,
      redisPassword: process.env.REDIS_PASSWORD,
      redisUrl: process.env.REDIS_URL,
      
      // API-specific config
      apiPort: process.env.API_PORT,
      apiBaseUrl: process.env.API_BASE_URL,
      jwtSecret: process.env.JWT_SECRET,
    });

    const dbConfig = databaseConfigSchema.parse({
      postgresHost: process.env.POSTGRES_HOST,
      postgresPort: process.env.POSTGRES_PORT,
      postgresDb: process.env.POSTGRES_DB,
      postgresUser: process.env.POSTGRES_USER,
      postgresPassword: process.env.POSTGRES_PASSWORD,
      databaseUrl: process.env.DATABASE_URL,
    });

    return { ...baseConfig, ...dbConfig };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid API configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('API configuration validation failed');
    }
    throw error;
  }
}
