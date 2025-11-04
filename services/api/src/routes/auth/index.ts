import { FastifyPluginAsync } from 'fastify';
import { AuthController } from '../../controllers/auth.controller';
import {
  loginRequestJsonSchema,
  loginResponseJsonSchema,
  errorResponseJsonSchema,
} from '../../schemas/auth.schema';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/login',
    {
      schema: {
        tags: ['auth'],
        description: 'Login or register user via Telegram ID',
        body: loginRequestJsonSchema,
        response: {
          200: loginResponseJsonSchema,
          400: errorResponseJsonSchema,
        },
      },
    },
    AuthController.login
  );

  fastify.get(
    '/me',
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ['auth'],
        description: 'Get current authenticated user',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              telegramId: { type: 'number' },
              username: { type: 'string', nullable: true },
              tier: { type: 'string' },
              tokensBalance: { type: 'number' },
              tokensSpent: { type: 'number' },
            },
          },
          401: errorResponseJsonSchema,
          404: errorResponseJsonSchema,
        },
      },
    },
    AuthController.getMe
  );
};

export default authRoutes;
