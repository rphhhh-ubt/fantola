import { FastifyPluginAsync } from 'fastify';
import { SoraController } from '../../controllers/sora.controller';
import { SoraService } from '../../services/sora.service';
import { StorageService } from '../../services/storage.service';
import { QueueService } from '../../services/queue.service';
import { TokenService } from '@monorepo/shared';
import { getApiConfig } from '@monorepo/config';

const soraRoutes: FastifyPluginAsync = async (fastify) => {
  const config = getApiConfig();
  
  // Initialize services
  const soraService = new SoraService(fastify.monitoring);
  const storageService = new StorageService(fastify.monitoring, config.storageBaseUrl);
  const tokenService = new TokenService();
  const queueService = new QueueService(
    fastify.monitoring,
    config.redisHost,
    config.redisPort,
    config.redisPassword
  );
  
  // Initialize controller
  const controller = new SoraController(
    soraService,
    storageService,
    tokenService,
    queueService,
    fastify.monitoring
  );
  
  // Register cleanup on close
  fastify.addHook('onClose', async () => {
    await queueService.close();
  });
  
  fastify.post(
    '/upload',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Upload images and prompt for Sora video generation',
        tags: ['Sora'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['prompt', 'images'],
          properties: {
            prompt: {
              type: 'string',
              minLength: 1,
              maxLength: 5000,
              description: 'Generation prompt',
            },
            images: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: {
                type: 'object',
                required: ['data', 'mimeType'],
                properties: {
                  data: {
                    type: 'string',
                    description: 'Base64 encoded image data',
                  },
                  mimeType: {
                    type: 'string',
                    enum: ['image/jpeg', 'image/png', 'image/webp'],
                  },
                },
              },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              moderationStatus: { type: 'string' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              reason: { type: 'string' },
              generationId: { type: 'string' },
            },
          },
          402: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              required: { type: 'number' },
              available: { type: 'number' },
            },
          },
        },
      },
    },
    controller.upload.bind(controller)
  );

  fastify.get(
    '/generation/:id',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Get Sora generation status and results',
        tags: ['Sora'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              moderationStatus: { type: 'string' },
              prompt: { type: 'string' },
              resultUrls: {
                type: 'array',
                items: { type: 'string' },
              },
              errorMessage: { type: 'string', nullable: true },
              tokensUsed: { type: 'number' },
              retryCount: { type: 'number' },
              createdAt: { type: 'string' },
              startedAt: { type: 'string', nullable: true },
              completedAt: { type: 'string', nullable: true },
              images: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    storageUrl: { type: 'string' },
                    size: { type: 'number' },
                    width: { type: 'number', nullable: true },
                    height: { type: 'number', nullable: true },
                    mimeType: { type: 'string' },
                    moderationStatus: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    controller.getGeneration.bind(controller)
  );

  fastify.post(
    '/generation/:id/retry',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Retry a failed Sora generation',
        tags: ['Sora'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    controller.retryGeneration.bind(controller)
  );
};

export default soraRoutes;
