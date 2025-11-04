import { z } from 'zod';
import { workerConfigSchema, WorkerConfig } from './schemas';
import { loadEnv } from './env';

/**
 * Parse and validate Worker service configuration
 */
export function getWorkerConfig(): WorkerConfig {
  loadEnv();

  try {
    return workerConfigSchema.parse({
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
      
      // Storage config
      storageType: process.env.STORAGE_TYPE,
      storageBaseUrl: process.env.STORAGE_BASE_URL,
      storageLocalPath: process.env.STORAGE_LOCAL_PATH,
      s3Endpoint: process.env.S3_ENDPOINT,
      s3Region: process.env.S3_REGION,
      s3Bucket: process.env.S3_BUCKET,
      s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
      s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      
      // Worker-specific config
      workerConcurrency: process.env.WORKER_CONCURRENCY,
      workerReplicas: process.env.WORKER_REPLICAS,
      workerMaxJobsPerWorker: process.env.WORKER_MAX_JOBS_PER_WORKER,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid Worker configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Worker configuration validation failed');
    }
    throw error;
  }
}
