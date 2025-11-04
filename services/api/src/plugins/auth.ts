import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import fastifyJwt from '@fastify/jwt';

const authPlugin: FastifyPluginAsync<{ jwtSecret: string }> = async (fastify, opts) => {
  fastify.log.info('Registering auth plugin');

  await fastify.register(fastifyJwt, {
    secret: opts.jwtSecret,
    sign: {
      expiresIn: '7d',
    },
  });

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  });

  fastify.log.info('Auth plugin registered');
};

export default fp(authPlugin, {
  name: 'auth',
});
