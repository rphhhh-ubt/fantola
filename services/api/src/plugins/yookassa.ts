import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { YooKassaClient } from '@monorepo/shared';
import { PaymentService } from '../services/payment.service';

declare module 'fastify' {
  interface FastifyInstance {
    yookassaClient: YooKassaClient;
    paymentService: PaymentService;
  }
}

export interface YooKassaPluginOptions {
  shopId?: string;
  secretKey?: string;
}

const yookassaPlugin: FastifyPluginAsync<YooKassaPluginOptions> = async (
  fastify,
  options
) => {
  const shopId = options.shopId || process.env.YOOKASSA_SHOP_ID;
  const secretKey = options.secretKey || process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    fastify.log.warn('YooKassa credentials not configured - webhook processing will be disabled');
    return;
  }

  const yookassaClient = new YooKassaClient({
    shopId,
    secretKey,
  });

  const paymentService = new PaymentService(
    fastify.db,
    fastify.monitoring
  );

  fastify.decorate('yookassaClient', yookassaClient);
  fastify.decorate('paymentService', paymentService);

  fastify.log.info('YooKassa client initialized');
};

export default fp(yookassaPlugin, {
  name: 'yookassa-plugin',
  dependencies: ['database-plugin', 'monitoring-plugin'],
});
