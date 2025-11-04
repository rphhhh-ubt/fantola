import { getBotConfig } from '@monorepo/config';
import { setupDatabaseShutdown, DatabaseClient } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';
import Redis from 'ioredis';
import { createBot, startPolling, startWebhook, stopBot } from './bot';
import { RunnerHandle } from '@grammyjs/runner';
import { BotMode } from './types';

async function main() {
  const config = getBotConfig();

  // Initialize monitoring
  const monitoring = new Monitoring({
    service: 'bot',
    environment: config.nodeEnv,
  });

  monitoring.logger.info({ environment: config.nodeEnv }, 'Starting bot service...');

  // Initialize database client
  DatabaseClient.initialize({
    logQueries: config.nodeEnv === 'development',
    onError: (error, context) => {
      monitoring.handleError(error, context as Record<string, unknown>);
    },
  });

  // Initialize Redis client
  const redis = config.redisUrl
    ? new Redis(config.redisUrl)
    : new Redis({
        host: config.redisHost,
        port: config.redisPort,
        password: config.redisPassword,
      });

  redis.on('error', (error) => {
    monitoring.handleError(error, { context: 'redis' });
  });

  redis.on('connect', () => {
    monitoring.logger.info('Redis connected');
  });

  // Initialize bot with optional channel verification and payment service
  const yookassaConfig =
    config.yookassaShopId && config.yookassaSecretKey
      ? {
          shopId: config.yookassaShopId,
          secretKey: config.yookassaSecretKey,
          returnUrl: 'https://t.me/your_bot',
        }
      : undefined;

  const aiConfig = {
    groqApiKey: config.groqApiKey,
    groqModel: config.groqModel,
    groqMaxTokens: config.groqMaxTokens,
    geminiApiKey: config.geminiApiKey,
    geminiModel: config.geminiModel,
    geminiMaxTokens: config.geminiMaxTokens,
  };

  const bot = createBot(
    config.telegramBotToken,
    redis,
    monitoring,
    aiConfig,
    config.apiBaseUrl,
    config.telegramChannelId,
    yookassaConfig
  );

  // Determine bot mode (polling for dev, webhook for prod)
  const botMode: BotMode = config.nodeEnv === 'development' ? 'polling' : 'webhook';
  let runner: RunnerHandle | null = null;

  // Start bot based on mode
  if (botMode === 'polling') {
    runner = await startPolling(bot, monitoring);
  } else {
    await startWebhook(
      bot,
      {
        mode: 'webhook',
        webhookDomain: config.telegramWebhookDomain,
        webhookPath: config.telegramWebhookPath || '/webhook/telegram',
        webhookSecret: config.telegramWebhookSecret,
      },
      monitoring
    );
  }

  // Setup graceful shutdown
  setupDatabaseShutdown({
    timeout: 10000,
    logger: (message) => monitoring.logger.info(message),
    cleanupHandlers: [
      async () => {
        await stopBot(bot, runner, monitoring);
      },
      async () => {
        monitoring.logger.info('Disconnecting Redis...');
        await redis.quit();
      },
    ],
  });

  // Start metrics server if enabled
  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
  }

  monitoring.logger.info(
    {
      mode: botMode,
      metricsEnabled: config.enableMetrics,
      metricsPort: config.metricsPort,
    },
    'Bot service started successfully'
  );
}

main().catch((error) => {
  const monitoring = new Monitoring({ service: 'bot' });
  monitoring.handleCriticalError(error, { context: 'startup' });
  process.exit(1);
});
