import { FastifyPluginAsync } from 'fastify';
import { GenerationsController } from '../../controllers/generations.controller';
import { GenerationsService } from '../../services/generations.service';

const generationsRoutes: FastifyPluginAsync = async (fastify) => {
  const generationsService = new GenerationsService(fastify.db);
  const controller = new GenerationsController(generationsService);

  // List generations
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Generations'],
        summary: 'List generations',
        description: 'Get a list of generations for the authenticated user',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed', 'canceled'],
              description: 'Filter by status',
            },
            type: {
              type: 'string',
              enum: ['product_card', 'sora', 'chat'],
              description: 'Filter by generation type',
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Filter by start date (ISO 8601)',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              description: 'Filter by end date (ISO 8601)',
            },
            limit: {
              type: 'string',
              pattern: '^[0-9]+$',
              description: 'Number of items to return (max 100)',
            },
            offset: {
              type: 'string',
              pattern: '^[0-9]+$',
              description: 'Number of items to skip',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        userId: { type: 'string' },
                        type: { type: 'string' },
                        status: { type: 'string' },
                        prompt: { type: 'string' },
                        resultUrls: { type: 'array', items: { type: 'string' } },
                        errorMessage: { type: 'string' },
                        tokensUsed: { type: 'number' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                        startedAt: { type: 'string', format: 'date-time' },
                        completedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  total: { type: 'number' },
                  limit: { type: 'number' },
                  offset: { type: 'number' },
                },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [fastify.authenticate],
    },
    controller.listGenerations.bind(controller)
  );

  // Get single generation
  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Generations'],
        summary: 'Get generation',
        description: 'Get a single generation by ID',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Generation ID',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  type: { type: 'string' },
                  status: { type: 'string' },
                  prompt: { type: 'string' },
                  resultUrls: { type: 'array', items: { type: 'string' } },
                  errorMessage: { type: 'string' },
                  tokensUsed: { type: 'number' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  startedAt: { type: 'string', format: 'date-time' },
                  completedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      onRequest: [fastify.authenticate],
    },
    controller.getGeneration.bind(controller)
  );
};

export default generationsRoutes;
