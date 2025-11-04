import { FastifyPluginAsync } from 'fastify';
import yookassaWebhookRoutes from './yookassa';

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(yookassaWebhookRoutes, { prefix: '/yookassa' });
};

export default webhookRoutes;
