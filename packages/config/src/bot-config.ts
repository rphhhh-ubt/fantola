import { z } from 'zod';
import { botConfigSchema, databaseConfigSchema, BotConfig } from './schemas';
import { loadEnv } from './env';

/**
 * Parse and validate Bot service configuration
 */
export function getBotConfig(): BotConfig {
  loadEnv();

  try {
    const baseConfig = botConfigSchema.parse({
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
      
      // Bot-specific config
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramWebhookDomain: process.env.TELEGRAM_WEBHOOK_DOMAIN,
      telegramWebhookPath: process.env.TELEGRAM_WEBHOOK_PATH,
      telegramWebhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
      
      // Payment config (YooKassa)
      yookassaShopId: process.env.YOOKASSA_SHOP_ID,
      yookassaSecretKey: process.env.YOOKASSA_SECRET_KEY,
      yookassaWebhookUrl: process.env.YOOKASSA_WEBHOOK_URL,
      yookassaWebhookSecret: process.env.YOOKASSA_WEBHOOK_SECRET,
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
      console.error('❌ Invalid Bot configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Bot configuration validation failed');
    }
    throw error;
  }
}
