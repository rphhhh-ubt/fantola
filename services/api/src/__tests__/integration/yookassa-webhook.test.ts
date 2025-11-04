import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { getApiConfig } from '@monorepo/config';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/shared';
import { SubscriptionTier } from '@monorepo/database';

describe('YooKassa Webhook Integration', () => {
  let app: FastifyInstance;
  let monitoring: Monitoring;
  const webhookSecret = 'test-webhook-secret';

  beforeAll(async () => {
    monitoring = new Monitoring({ service: 'api-test' });
    const config = getApiConfig();

    process.env.YOOKASSA_SHOP_ID = 'test-shop-id';
    process.env.YOOKASSA_SECRET_KEY = webhookSecret;

    app = await buildApp({ config, monitoring });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.payment.deleteMany({});
    await db.user.deleteMany({});
  });

  const createSignature = (notification: any): string => {
    const notificationString = JSON.stringify(notification);
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(notificationString)
      .digest('hex');
  };

  describe('POST /api/v1/webhooks/yookassa', () => {
    it('should process payment.succeeded webhook', async () => {
      const user = await db.user.create({
        data: {
          telegramId: '123456789',
          username: 'testuser',
          tier: 'Gift',
          tokensBalance: 0,
        },
      });

      await db.subscriptionTierConfig.upsert({
        where: { tier: 'Professional' },
        create: {
          tier: 'Professional',
          monthlyTokens: 2000,
          priceRubles: 1990,
          requestsPerMinute: 50,
          burstPerSecond: 10,
          description: 'Professional tier',
        },
        update: {},
      });

      const payment = await db.payment.create({
        data: {
          userId: user.id,
          provider: 'yookassa',
          status: 'pending',
          amountRubles: 1990,
          currency: 'RUB',
          description: 'Professional subscription',
          externalId: 'payment-123',
          subscriptionTier: 'Professional',
          metadata: {
            userId: user.id,
            subscriptionTier: 'Professional',
          },
        },
      });

      const notification = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: 'payment-123',
          status: 'succeeded',
          amount: {
            value: '1990.00',
            currency: 'RUB',
          },
          created_at: new Date().toISOString(),
          test: true,
          paid: true,
          refundable: true,
          payment_method: {
            type: 'bank_card',
          },
          captured_at: new Date().toISOString(),
          metadata: {
            userId: user.id,
            subscriptionTier: 'Professional',
          },
        },
      };

      const signature = createSignature(notification);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/yookassa',
        headers: {
          'x-yookassa-signature': signature,
          'content-type': 'application/json',
        },
        payload: notification,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        message: 'Webhook processed',
      });

      const updatedPayment = await db.payment.findUnique({
        where: { externalId: 'payment-123' },
      });

      expect(updatedPayment?.status).toBe('succeeded');
      expect(updatedPayment?.confirmedAt).toBeTruthy();

      const updatedUser = await db.user.findUnique({
        where: { id: user.id },
      });

      expect(updatedUser?.tier).toBe('Professional');
      expect(updatedUser?.tokensBalance).toBe(2000);
      expect(updatedUser?.subscriptionExpiresAt).toBeTruthy();
    });

    it('should reject webhook with invalid signature', async () => {
      const notification = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: 'payment-123',
          status: 'succeeded',
          amount: {
            value: '1990.00',
            currency: 'RUB',
          },
          created_at: new Date().toISOString(),
          test: true,
          paid: true,
          refundable: true,
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/yookassa',
        headers: {
          'x-yookassa-signature': 'invalid-signature',
          'content-type': 'application/json',
        },
        payload: notification,
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        success: false,
        message: 'Invalid signature',
      });
    });

    it('should reject webhook without signature', async () => {
      const notification = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: 'payment-123',
          status: 'succeeded',
          amount: {
            value: '1990.00',
            currency: 'RUB',
          },
          created_at: new Date().toISOString(),
          test: true,
          paid: true,
          refundable: true,
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/yookassa',
        headers: {
          'content-type': 'application/json',
        },
        payload: notification,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        success: false,
        message: 'Missing signature header',
      });
    });

    it('should process payment.canceled webhook', async () => {
      const user = await db.user.create({
        data: {
          telegramId: '123456789',
          username: 'testuser',
          tier: 'Gift',
          tokensBalance: 0,
        },
      });

      await db.payment.create({
        data: {
          userId: user.id,
          provider: 'yookassa',
          status: 'pending',
          amountRubles: 1990,
          currency: 'RUB',
          description: 'Professional subscription',
          externalId: 'payment-456',
          subscriptionTier: 'Professional',
        },
      });

      const notification = {
        type: 'notification',
        event: 'payment.canceled',
        object: {
          id: 'payment-456',
          status: 'canceled',
          amount: {
            value: '1990.00',
            currency: 'RUB',
          },
          created_at: new Date().toISOString(),
          test: true,
          paid: false,
          refundable: false,
          cancellation_details: {
            party: 'merchant',
            reason: 'Canceled by user',
          },
        },
      };

      const signature = createSignature(notification);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/yookassa',
        headers: {
          'x-yookassa-signature': signature,
          'content-type': 'application/json',
        },
        payload: notification,
      });

      expect(response.statusCode).toBe(200);

      const updatedPayment = await db.payment.findUnique({
        where: { externalId: 'payment-456' },
      });

      expect(updatedPayment?.status).toBe('canceled');
    });

    it('should process refund.succeeded webhook', async () => {
      const user = await db.user.create({
        data: {
          telegramId: '123456789',
          username: 'testuser',
          tier: 'Professional',
          tokensBalance: 2000,
        },
      });

      await db.subscriptionTierConfig.upsert({
        where: { tier: 'Professional' },
        create: {
          tier: 'Professional',
          monthlyTokens: 2000,
          priceRubles: 1990,
          requestsPerMinute: 50,
          burstPerSecond: 10,
          description: 'Professional tier',
        },
        update: {},
      });

      await db.payment.create({
        data: {
          userId: user.id,
          provider: 'yookassa',
          status: 'succeeded',
          amountRubles: 1990,
          currency: 'RUB',
          description: 'Professional subscription',
          externalId: 'payment-789',
          subscriptionTier: 'Professional',
          confirmedAt: new Date(),
        },
      });

      const notification = {
        type: 'notification',
        event: 'refund.succeeded',
        object: {
          id: 'refund-123',
          payment_id: 'payment-789',
          status: 'succeeded',
          created_at: new Date().toISOString(),
          amount: {
            value: '1990.00',
            currency: 'RUB',
          },
        },
      };

      const signature = createSignature(notification);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/yookassa',
        headers: {
          'x-yookassa-signature': signature,
          'content-type': 'application/json',
        },
        payload: notification,
      });

      expect(response.statusCode).toBe(200);

      const updatedPayment = await db.payment.findUnique({
        where: { externalId: 'payment-789' },
      });

      expect(updatedPayment?.status).toBe('refunded');

      const updatedUser = await db.user.findUnique({
        where: { id: user.id },
      });

      expect(updatedUser?.tier).toBe('Gift');
    });

    it('should handle duplicate payment.succeeded webhook gracefully', async () => {
      const user = await db.user.create({
        data: {
          telegramId: '123456789',
          username: 'testuser',
          tier: 'Professional',
          tokensBalance: 2000,
          subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await db.payment.create({
        data: {
          userId: user.id,
          provider: 'yookassa',
          status: 'succeeded',
          amountRubles: 1990,
          currency: 'RUB',
          description: 'Professional subscription',
          externalId: 'payment-999',
          subscriptionTier: 'Professional',
          confirmedAt: new Date(),
        },
      });

      const notification = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: 'payment-999',
          status: 'succeeded',
          amount: {
            value: '1990.00',
            currency: 'RUB',
          },
          created_at: new Date().toISOString(),
          test: true,
          paid: true,
          refundable: true,
          metadata: {
            userId: user.id,
            subscriptionTier: 'Professional',
          },
        },
      };

      const signature = createSignature(notification);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/yookassa',
        headers: {
          'x-yookassa-signature': signature,
          'content-type': 'application/json',
        },
        payload: notification,
      });

      expect(response.statusCode).toBe(200);

      const updatedUser = await db.user.findUnique({
        where: { id: user.id },
      });

      expect(updatedUser?.tokensBalance).toBe(2000);
    });
  });
});
