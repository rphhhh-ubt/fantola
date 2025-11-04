import { getConfig } from '@monorepo/config';
import { formatDate, setupDatabaseShutdown, DatabaseClient } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';

async function main() {
  const config = getConfig();

  const monitoring = new Monitoring({
    service: 'bot',
    environment: config.nodeEnv,
  });

  // Initialize database client
  DatabaseClient.initialize({
    logQueries: config.nodeEnv === 'development',
    onError: (error, context) => {
      monitoring.handleError(error, context as Record<string, unknown>);
    },
  });

  // Setup graceful shutdown
  setupDatabaseShutdown({
    timeout: 10000,
    logger: (message) => monitoring.logger.info(message),
    cleanupHandlers: [
      async () => {
        monitoring.logger.info('Stopping bot...');
        // Add bot cleanup logic here
      },
    ],
  });

  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
  }

  monitoring.logger.info(
    {
      environment: config.nodeEnv,
      metricsPort: config.metricsPort,
      metricsEnabled: config.enableMetrics,
    },
    'Bot service started'
  );

  monitoring.logger.debug(
    { currentTime: formatDate(new Date()) },
    'Current time example'
  );

  monitoring.trackKPI({
    type: 'active_user',
    data: { userId: 'telegram-user-123' },
  });

  monitoring.trackKPI({
    type: 'generation_success',
    data: { type: 'text' },
  });
}

main().catch((error) => {
  const monitoring = new Monitoring({ service: 'bot' });
  monitoring.handleCriticalError(error, { context: 'startup' });
  process.exit(1);
});
