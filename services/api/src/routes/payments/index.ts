import { FastifyPluginAsync } from 'fastify';
import { PaymentController } from '../../controllers/payment.controller';
import {
  createPaymentSessionRequestJsonSchema,
  createPaymentSessionResponseJsonSchema,
  listPaymentsQueryJsonSchema,
  listPaymentsResponseJsonSchema,
  getPaymentResponseJsonSchema,
} from '../../schemas/payment.schema';
import { errorResponseJsonSchema } from '../../schemas/auth.schema';

const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  // Create payment session
  fastify.post(
    '/sessions',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['payments'],
        description: 'Create a payment session for subscription purchase',
        security: [{ bearerAuth: [] }],
        body: createPaymentSessionRequestJsonSchema,
        response: {
          200: createPaymentSessionResponseJsonSchema,
          400: errorResponseJsonSchema,
          401: errorResponseJsonSchema,
          404: errorResponseJsonSchema,
          503: errorResponseJsonSchema,
        },
      },
    },
    PaymentController.createPaymentSession
  );

  // List user payments
  fastify.get(
    '/',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['payments'],
        description: 'List user payment history',
        security: [{ bearerAuth: [] }],
        querystring: listPaymentsQueryJsonSchema,
        response: {
          200: listPaymentsResponseJsonSchema,
          401: errorResponseJsonSchema,
          500: errorResponseJsonSchema,
        },
      },
    },
    PaymentController.listPayments
  );

  // Get specific payment
  fastify.get(
    '/:id',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['payments'],
        description: 'Get a specific payment by ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: getPaymentResponseJsonSchema,
          401: errorResponseJsonSchema,
          404: errorResponseJsonSchema,
          500: errorResponseJsonSchema,
        },
      },
    },
    PaymentController.getPayment
  );
};

export default paymentRoutes;
