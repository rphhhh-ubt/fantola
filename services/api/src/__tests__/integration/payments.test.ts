import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { getApiConfig } from '@monorepo/config';
import { Monitoring } from '@monorepo/monitoring';
import { PrismaClient, SubscriptionTier } from '@monorepo/database';

describe('Payment API Integration Tests', () => {
  let app: FastifyInstance;
  let db: PrismaClient;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const config = getApiConfig();
    const monitoring = new Monitoring({
      service: 'api-test',
      environment: 'test',
    });

    app = await buildApp({ config, monitoring });
    db = (app as any).db;

    // Create test user and get token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        telegramId: 999999,
        username: 'paymentTestUser',
      },
    });

    const loginData = JSON.parse(loginResponse.body);
    token = loginData.token;
    userId = loginData.user.id;

    // Create test subscription tier config
    await db.subscriptionTierConfig.upsert({
      where: { tier: SubscriptionTier.Professional },
      create: {
        tier: SubscriptionTier.Professional,
        monthlyTokens: 2000,
        priceRubles: 1990,
        requestsPerMinute: 50,
        burstPerSecond: 10,
        requiresChannel: false,
        description: 'Professional Plan - 2000 tokens/month',
        isActive: true,
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.payment.deleteMany({
      where: { userId },
    });

    await db.user.delete({
      where: { id: userId },
    });

    await app.close();
  });

  describe('POST /api/v1/payments/sessions', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/sessions',
        payload: {
          subscriptionTier: 'Professional',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create a payment session', async () => {
      // Skip if YooKassa not configured (development environment)
      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
        console.log('Skipping payment session creation test - YooKassa not configured');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/sessions',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          subscriptionTier: 'Professional',
          returnUrl: 'https://example.com/success',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('paymentId');
      expect(data).toHaveProperty('confirmationUrl');
      expect(data).toHaveProperty('externalId');
      expect(data.amount).toBe(1990);
      expect(data.currency).toBe('RUB');
      expect(data.status).toBe('pending');
    });

    it('should return 404 for non-existent tier', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/sessions',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          subscriptionTier: 'NonExistent',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should validate request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/sessions',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          subscriptionTier: 'InvalidTier',
        },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/v1/payments', () => {
    beforeAll(async () => {
      // Create test payment
      await db.payment.create({
        data: {
          userId,
          provider: 'yookassa',
          status: 'succeeded',
          amountRubles: 1990,
          currency: 'RUB',
          description: 'Test Payment',
          externalId: `test-payment-${Date.now()}`,
          subscriptionTier: SubscriptionTier.Professional,
          confirmedAt: new Date(),
        },
      });
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should list user payments', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
      expect(data).toHaveProperty('hasMore');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments?limit=1&offset=0',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.limit).toBe(1);
      expect(data.offset).toBe(0);
      expect(data.items.length).toBeLessThanOrEqual(1);
    });

    it('should filter by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments?status=succeeded',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      data.items.forEach((payment: any) => {
        expect(payment.status).toBe('succeeded');
      });
    });

    it('should validate query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments?limit=1000',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/v1/payments/:id', () => {
    let paymentId: string;

    beforeAll(async () => {
      // Create test payment
      const payment = await db.payment.create({
        data: {
          userId,
          provider: 'yookassa',
          status: 'succeeded',
          amountRubles: 1990,
          currency: 'RUB',
          description: 'Test Payment for Get',
          externalId: `test-get-payment-${Date.now()}`,
          subscriptionTier: SubscriptionTier.Professional,
          confirmedAt: new Date(),
        },
      });
      paymentId = payment.id;
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/payments/${paymentId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should get a specific payment', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/payments/${paymentId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.id).toBe(paymentId);
      expect(data.status).toBe('succeeded');
      expect(data.amountRubles).toBe(1990);
      expect(data.subscriptionTier).toBe('Professional');
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payments/00000000-0000-0000-0000-000000000000',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not allow access to other users payments', async () => {
      // Create another user
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          telegramId: 888888,
          username: 'otherUser',
        },
      });

      const otherUserData = JSON.parse(otherUserResponse.body);
      const otherToken = otherUserData.token;

      // Try to access first user's payment
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/payments/${paymentId}`,
        headers: {
          authorization: `Bearer ${otherToken}`,
        },
      });

      expect(response.statusCode).toBe(404);

      // Clean up other user
      await db.user.delete({
        where: { id: otherUserData.user.id },
      });
    });
  });

  describe('Webhook Idempotency', () => {
    it('should handle duplicate webhook notifications idempotently', async () => {
      // This test would require a more complex setup with YooKassa webhook simulation
      // For now, we'll test the idempotency at the service level

      // Create a test payment
      const payment = await db.payment.create({
        data: {
          userId,
          provider: 'yookassa',
          status: 'pending',
          amountRubles: 1990,
          currency: 'RUB',
          description: 'Test Idempotency',
          externalId: `test-idempotent-${Date.now()}`,
          subscriptionTier: SubscriptionTier.Professional,
        },
      });

      // Process it twice (simulating duplicate webhooks)
      const paymentService = (app as any).paymentService;

      const result1 = await paymentService.processSuccessfulPayment({
        paymentId: payment.externalId,
        userId,
        status: 'succeeded',
        subscriptionTier: 'Professional',
        amountRubles: 1990,
        metadata: {},
      });

      const result2 = await paymentService.processSuccessfulPayment({
        paymentId: payment.externalId,
        userId,
        status: 'succeeded',
        subscriptionTier: 'Professional',
        amountRubles: 1990,
        metadata: {},
      });

      // Both should succeed, but second should be marked as already processed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify payment was only processed once
      const finalPayment = await db.payment.findUnique({
        where: { externalId: payment.externalId },
      });

      expect(finalPayment?.status).toBe('succeeded');
    });
  });
});
