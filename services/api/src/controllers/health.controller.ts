import { FastifyRequest } from 'fastify';
import { HealthResponse, HealthDetailedResponse } from '../schemas/health.schema';

export class HealthController {
  static async getHealth(): Promise<HealthResponse> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'api',
      version: '1.0.0',
    };
  }

  static async getHealthDetailed(request: FastifyRequest): Promise<HealthDetailedResponse> {
    const memoryUsage = process.memoryUsage();
    let dbConnected = false;

    try {
      await request.server.db.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch (error) {
      request.log.error({ error }, 'Database health check failed');
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'api',
      version: '1.0.0',
      database: {
        connected: dbConnected,
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
    };
  }
}
