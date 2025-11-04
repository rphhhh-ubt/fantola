import { FastifyPluginAsync } from 'fastify';
import { HealthController } from '../../controllers/health.controller';
import {
  healthResponseJsonSchema,
  healthDetailedResponseJsonSchema,
} from '../../schemas/health.schema';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        tags: ['health'],
        description: 'Basic health check',
        response: {
          200: healthResponseJsonSchema,
        },
      },
    },
    HealthController.getHealth
  );

  fastify.get(
    '/detailed',
    {
      schema: {
        tags: ['health'],
        description: 'Detailed health check with database and memory info',
        response: {
          200: healthDetailedResponseJsonSchema,
        },
      },
    },
    HealthController.getHealthDetailed
  );
};

export default healthRoutes;
