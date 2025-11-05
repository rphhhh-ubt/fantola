import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ApiConfig } from '@monorepo/config';
import { Monitoring } from '@monorepo/monitoring';
import databasePlugin from './plugins/database';
import monitoringPlugin from './plugins/monitoring';
import authPlugin from './plugins/auth';
import yookassaPlugin from './plugins/yookassa';
import websocketPlugin from './plugins/websocket';
import routes from './routes';
import { swaggerConfig, swaggerUiConfig } from './config/swagger';
import Redis from 'ioredis';

export interface AppOptions {
  config: ApiConfig;
  monitoring: Monitoring;
  redis?: Redis;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { config, monitoring, redis } = options;

  const app = Fastify({
    logger: monitoring.logger as any,
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    trustProxy: true,
  });

  await app.register(sensible);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    cache: 10000,
  });

  await app.register(swagger, swaggerConfig);
  await app.register(swaggerUi, swaggerUiConfig);

  await app.register(databasePlugin);
  await app.register(monitoringPlugin, { monitoring });
  await app.register(authPlugin, { jwtSecret: config.jwtSecret });
  await app.register(yookassaPlugin, {
    shopId: process.env.YOOKASSA_SHOP_ID,
    secretKey: process.env.YOOKASSA_SECRET_KEY,
  });

  // Register WebSocket support if Redis is available
  if (redis) {
    await app.register(websocketPlugin, { redis });
  }

  await app.register(routes, { prefix: '/api/v1' });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error, url: request.url, method: request.method }, 'Request error');

    monitoring.handleError(error, {
      url: request.url,
      method: request.method,
    });

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    reply.code(statusCode).send({
      error: error.name || 'Error',
      message,
      statusCode,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      statusCode: 404,
    });
  });

  return app;
}
