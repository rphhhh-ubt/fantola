import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { Monitoring } from '@monorepo/monitoring';

const monitoringPlugin: FastifyPluginAsync<{ monitoring: Monitoring }> = async (
  fastify,
  opts
) => {
  fastify.log.info('Registering monitoring plugin');

  fastify.decorate('monitoring', opts.monitoring);

  fastify.addHook('onRequest', async (request) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      'Incoming request'
    );
  });

  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed'
    );
  });

  fastify.addHook('onError', async (request, reply, error) => {
    opts.monitoring.handleError(error, {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
    });
  });

  fastify.log.info('Monitoring plugin registered');
};

export default fp(monitoringPlugin, {
  name: 'monitoring',
});
