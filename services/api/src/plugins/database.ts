import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { db, DatabaseClient } from '@monorepo/shared';

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.log.info('Registering database plugin');

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    fastify.log.info('Disconnecting database...');
    await DatabaseClient.disconnect();
  });

  fastify.log.info('Database plugin registered');
};

export default fp(databasePlugin, {
  name: 'database',
});
