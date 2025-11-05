import { getApiConfig } from '@monorepo/config';
import { DatabaseClient, setupDatabaseShutdown, closeRedisConnections } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';
import { buildApp } from './app';
import Redis from 'ioredis';

async function bootstrap() {
  const config = getApiConfig();

  const monitoring = new Monitoring({
    service: 'api',
    environment: config.nodeEnv,
  });

  monitoring.logger.info(
    {
      nodeEnv: config.nodeEnv,
      port: config.apiPort,
      metricsEnabled: config.enableMetrics,
      metricsPort: config.metricsPort,
    },
    'Starting API service'
  );

  DatabaseClient.initialize({
    logQueries: config.nodeEnv === 'development',
    onError: (error, context) => {
      monitoring.handleError(error, context as Record<string, unknown>);
    },
  });

  // Create Redis connection for pub/sub
  const redis = new Redis({
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword,
  });

  const app = await buildApp({ config, monitoring, redis });

  const shutdownHandlers: Array<() => Promise<void>> = [];

  app.addHook('onClose', async () => {
    monitoring.logger.info('Fastify server closing...');
  });

  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
    shutdownHandlers.push(async () => {
      monitoring.logger.info('Stopping metrics server...');
    });
  }

  setupDatabaseShutdown({
    timeout: 10000,
    logger: (message) => monitoring.logger.info(message),
    cleanupHandlers: [
      async () => {
        monitoring.logger.info('Closing Fastify server...');
        await app.close();
      },
      async () => {
        monitoring.logger.info('Closing Redis connections...');
        await redis.quit();
        await closeRedisConnections();
      },
      ...shutdownHandlers,
    ],
  });

  try {
    await app.listen({
      port: config.apiPort,
      host: '0.0.0.0',
    });

    monitoring.logger.info(
      {
        port: config.apiPort,
        docs: `http://localhost:${config.apiPort}/docs`,
        health: `http://localhost:${config.apiPort}/api/v1/health`,
      },
      'API service started successfully'
    );
  } catch (err) {
    monitoring.handleCriticalError(err as Error, { context: 'server_start' });
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  const monitoring = new Monitoring({ service: 'api' });
  monitoring.handleCriticalError(error, { context: 'bootstrap' });
  process.exit(1);
});
