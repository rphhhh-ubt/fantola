import { FastifyPluginAsync } from 'fastify';
import healthRoutes from './health';
import authRoutes from './auth';

const routes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(authRoutes, { prefix: '/auth' });
};

export default routes;
