import { FastifyPluginAsync } from 'fastify';
import healthRoutes from './health';
import authRoutes from './auth';
import subscriptionRoutes from './subscriptions';
import webhookRoutes from './webhooks';
import paymentRoutes from './payments';

const routes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(subscriptionRoutes, { prefix: '/subscriptions' });
  await fastify.register(webhookRoutes, { prefix: '/webhooks' });
  await fastify.register(paymentRoutes, { prefix: '/payments' });
};

export default routes;
