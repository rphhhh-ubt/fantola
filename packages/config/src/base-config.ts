import { z } from 'zod';
import { baseConfigSchema, databaseConfigSchema, BaseConfig, DatabaseConfig } from './schemas';
import { loadEnv } from './env';

/**
 * Parse and validate base configuration
 */
export function getBaseConfig(): BaseConfig {
  loadEnv();

  try {
    return baseConfigSchema.parse({
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
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid base configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Configuration validation failed');
    }
    throw error;
  }
}

/**
 * Parse and validate database configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
  loadEnv();

  try {
    return databaseConfigSchema.parse({
      postgresHost: process.env.POSTGRES_HOST,
      postgresPort: process.env.POSTGRES_PORT,
      postgresDb: process.env.POSTGRES_DB,
      postgresUser: process.env.POSTGRES_USER,
      postgresPassword: process.env.POSTGRES_PASSWORD,
      databaseUrl: process.env.DATABASE_URL,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid database configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Configuration validation failed');
    }
    throw error;
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use service-specific config functions instead (getApiConfig, getBotConfig, getWorkerConfig)
 */
export function getConfig(): BaseConfig {
  return getBaseConfig();
}

/**
 * Compute the Redis URL from individual components or use the provided URL
 */
export function getRedisUrl(config: BaseConfig): string {
  if (config.redisUrl) {
    return config.redisUrl;
  }
  
  const auth = config.redisPassword ? `:${config.redisPassword}@` : '';
  return `redis://${auth}${config.redisHost}:${config.redisPort}`;
}

/**
 * Compute the database URL from individual components or use the provided URL
 */
export function getDatabaseUrl(dbConfig: DatabaseConfig): string {
  if (dbConfig.databaseUrl) {
    return dbConfig.databaseUrl;
  }
  
  return `postgresql://${dbConfig.postgresUser}:${dbConfig.postgresPassword}@${dbConfig.postgresHost}:${dbConfig.postgresPort}/${dbConfig.postgresDb}`;
}
