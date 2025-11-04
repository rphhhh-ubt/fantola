import { FastifyPluginAsync } from 'fastify';
import { ProductCardController } from '../../controllers/product-card.controller';
import { ProductCardService } from '@monorepo/shared';
import { StorageService } from '../../services/storage.service';
import { QueueService } from '../../services/queue.service';
import { TokenService } from '@monorepo/shared';
import { getApiConfig } from '@monorepo/config';
import { db } from '@monorepo/database';

const productCardRoutes: FastifyPluginAsync = async (fastify) => {
  const config = getApiConfig();

  const productCardService = new ProductCardService();
  const storageService = new StorageService(fastify.monitoring, config.storageBaseUrl);
  const tokenService = new TokenService(db);
  const queueService = new QueueService(
    fastify.monitoring,
    config.redisHost,
    config.redisPort,
    config.redisPassword
  );

  const controller = new ProductCardController(
    productCardService,
    storageService,
    tokenService,
    queueService,
    fastify.monitoring
  );

  fastify.addHook('onClose', async () => {
    await queueService.close();
  });

  fastify.post(
    '/upload',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Upload product photo and create product card generation',
        tags: ['Product Card'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['productImage', 'options'],
          properties: {
            productImage: {
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
            options: {
              type: 'object',
              required: ['mode'],
              properties: {
                mode: {
                  type: 'string',
                  enum: ['clean', 'infographics'],
                  description: 'Card mode',
                },
                background: {
                  type: 'string',
                  description: 'Background description',
                },
                pose: {
                  type: 'string',
                  description: 'Product pose/angle',
                },
                textHeadline: {
                  type: 'string',
                  description: 'Headline text',
                },
                textSubheadline: {
                  type: 'string',
                  description: 'Subheadline text',
                },
                textDescription: {
                  type: 'string',
                  description: 'Description text',
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
        description: 'Get product card generation status and results',
        tags: ['Product Card'],
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
              productImageUrl: { type: 'string' },
              mode: { type: 'string' },
              background: { type: 'string', nullable: true },
              pose: { type: 'string', nullable: true },
              textHeadline: { type: 'string', nullable: true },
              textSubheadline: { type: 'string', nullable: true },
              textDescription: { type: 'string', nullable: true },
              resultUrls: {
                type: 'array',
                items: { type: 'string' },
              },
              errorMessage: { type: 'string', nullable: true },
              tokensUsed: { type: 'number' },
              retryCount: { type: 'number' },
              parentGenerationId: { type: 'string', nullable: true },
              createdAt: { type: 'string' },
              startedAt: { type: 'string', nullable: true },
              completedAt: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    controller.getGeneration.bind(controller)
  );

  fastify.post(
    '/generation/:id/generate-more',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Generate more variants of a product card',
        tags: ['Product Card'],
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
        body: {
          type: 'object',
          properties: {
            options: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  enum: ['clean', 'infographics'],
                },
                background: {
                  type: 'string',
                },
                pose: {
                  type: 'string',
                },
                textHeadline: {
                  type: 'string',
                },
                textSubheadline: {
                  type: 'string',
                },
                textDescription: {
                  type: 'string',
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
    controller.generateMore.bind(controller)
  );

  fastify.post(
    '/generation/:id/edit',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Edit a product card with new options',
        tags: ['Product Card'],
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
        body: {
          type: 'object',
          required: ['options'],
          properties: {
            options: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  enum: ['clean', 'infographics'],
                },
                background: {
                  type: 'string',
                },
                pose: {
                  type: 'string',
                },
                textHeadline: {
                  type: 'string',
                },
                textSubheadline: {
                  type: 'string',
                },
                textDescription: {
                  type: 'string',
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
    controller.editCard.bind(controller)
  );
};

export default productCardRoutes;
