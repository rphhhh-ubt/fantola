import { FastifyPluginAsync } from 'fastify';
import { WebhookController } from '../../controllers/webhook.controller';
import {
  webhookNotificationJsonSchema,
  webhookResponseJsonSchema,
} from '../../schemas/webhook.schema';

const yookassaWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        tags: ['webhooks'],
        description: 'YooKassa payment notification webhook',
        body: webhookNotificationJsonSchema,
        response: {
          200: webhookResponseJsonSchema,
          400: webhookResponseJsonSchema,
          401: webhookResponseJsonSchema,
          500: webhookResponseJsonSchema,
        },
      },
    },
    WebhookController.handleYooKassaWebhook
  );
};

export default yookassaWebhookRoutes;
