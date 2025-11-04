import { FastifyPluginAsync } from 'fastify';
import { SubscriptionController } from '../../controllers/subscription.controller';
import {
  tierCatalogResponseJsonSchema,
  subscriptionStatusResponseJsonSchema,
  activateSubscriptionRequestJsonSchema,
  activateSubscriptionResponseJsonSchema,
  cancelSubscriptionRequestJsonSchema,
  cancelSubscriptionResponseJsonSchema,
  subscriptionHistoryResponseJsonSchema,
} from '../../schemas/subscription.schema';
import { errorResponseJsonSchema } from '../../schemas/auth.schema';

const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/tiers',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Get all available subscription tiers',
        response: {
          200: tierCatalogResponseJsonSchema,
          500: errorResponseJsonSchema,
        },
      },
    },
    SubscriptionController.getTierCatalog
  );

  fastify.get(
    '/status',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['subscriptions'],
        description: 'Get current user subscription status',
        security: [{ bearerAuth: [] }],
        response: {
          200: subscriptionStatusResponseJsonSchema,
          401: errorResponseJsonSchema,
          500: errorResponseJsonSchema,
        },
      },
    },
    SubscriptionController.getSubscriptionStatus
  );

  fastify.post(
    '/activate',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['subscriptions'],
        description: 'Activate a subscription for the current user',
        security: [{ bearerAuth: [] }],
        body: activateSubscriptionRequestJsonSchema,
        response: {
          200: activateSubscriptionResponseJsonSchema,
          400: errorResponseJsonSchema,
          401: errorResponseJsonSchema,
          500: errorResponseJsonSchema,
        },
      },
    },
    SubscriptionController.activateSubscription
  );

  fastify.post(
    '/cancel',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['subscriptions'],
        description: 'Cancel the current user subscription',
        security: [{ bearerAuth: [] }],
        body: cancelSubscriptionRequestJsonSchema,
        response: {
          200: cancelSubscriptionResponseJsonSchema,
          400: errorResponseJsonSchema,
          401: errorResponseJsonSchema,
          500: errorResponseJsonSchema,
        },
      },
    },
    SubscriptionController.cancelSubscription
  );

  fastify.get(
    '/history',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['subscriptions'],
        description: 'Get subscription history for the current user',
        security: [{ bearerAuth: [] }],
        response: {
          200: subscriptionHistoryResponseJsonSchema,
          401: errorResponseJsonSchema,
          500: errorResponseJsonSchema,
        },
      },
    },
    SubscriptionController.getSubscriptionHistory
  );
};

export default subscriptionRoutes;
