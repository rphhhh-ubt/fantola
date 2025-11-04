import { getConfig } from '@monorepo/config';
import { isValidEmail, setupDatabaseShutdown, DatabaseClient } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';

async function main() {
  const config = getConfig();

  const monitoring = new Monitoring({
    service: 'api',
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
        monitoring.logger.info('Stopping metrics server...');
        // Add any cleanup logic here
      },
    ],
  });

  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
  }

  monitoring.logger.info(
    {
      port: config.port,
      environment: config.nodeEnv,
      metricsPort: config.metricsPort,
      metricsEnabled: config.enableMetrics,
    },
    'API service started'
  );

  monitoring.logger.debug(
    { result: isValidEmail('test@example.com') },
    'Email validation example'
  );

  monitoring.trackKPI({
    type: 'active_user',
    data: { userId: 'example-user' },
  });
}

main().catch((error) => {
  const monitoring = new Monitoring({ service: 'api' });
  monitoring.handleCriticalError(error, { context: 'startup' });
  process.exit(1);
});
