import { buildApp } from '../../app';
import { getApiConfig } from '@monorepo/config';
import { Monitoring } from '@monorepo/monitoring';
import { DatabaseClient, db } from '@monorepo/shared';
import { SubscriptionTier } from '@monorepo/database';

describe('Subscription Routes', () => {
  let app: any;
  let config: any;
  let monitoring: Monitoring;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    config = getApiConfig();
    monitoring = new Monitoring({ service: 'api-test', environment: 'test' });

    DatabaseClient.initialize({
      logQueries: false,
      onError: () => {},
    });

    app = await buildApp({ config, monitoring });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        telegramId: 888888888,
        username: 'subtest',
      },
    });

    const body = JSON.parse(loginResponse.body);
    testUserId = body.user.id;
    authToken = body.token;
  });

  afterAll(async () => {
    if (testUserId) {
      await db.subscriptionHistory.deleteMany({ where: { userId: testUserId } }).catch(() => {});
      await db.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await app.close();
    await DatabaseClient.disconnect();
  });

  describe('GET /api/v1/subscriptions/tiers', () => {
    it('should return subscription tier catalog', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/tiers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('tiers');
      expect(Array.isArray(body.tiers)).toBe(true);
      expect(body.tiers.length).toBeGreaterThan(0);

      const giftTier = body.tiers.find((t: any) => t.tier === 'Gift');
      expect(giftTier).toBeDefined();
      expect(giftTier.monthlyTokens).toBe(100);
      expect(giftTier.priceRubles).toBeNull();
      expect(giftTier.requiresChannel).toBe(true);

      const professionalTier = body.tiers.find((t: any) => t.tier === 'Professional');
      expect(professionalTier).toBeDefined();
      expect(professionalTier.monthlyTokens).toBe(2000);
      expect(professionalTier.priceRubles).toBe(1990);
    });
  });

  describe('GET /api/v1/subscriptions/status', () => {
    it('should return current subscription status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/status',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        userId: testUserId,
        tier: 'Gift',
        isActive: true,
        autoRenew: false,
      });
      expect(body.expiresAt).toBeNull();
      expect(body.daysRemaining).toBeNull();
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/status',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/subscriptions/activate', () => {
    it('should activate Professional subscription', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tier: 'Professional',
          durationDays: 30,
          autoRenew: true,
          priceRubles: 1990,
          paymentMethod: 'yookassa',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.status).toBeDefined();
      expect(body.status.tier).toBe('Professional');
      expect(body.status.autoRenew).toBe(true);
      expect(body.status.isActive).toBe(true);
      expect(body.status.daysRemaining).toBeGreaterThan(0);
      expect(body.historyId).toBeDefined();
    });

    it('should activate Business subscription', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tier: 'Business',
          durationDays: 30,
          autoRenew: false,
          priceRubles: 3490,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.status.tier).toBe('Business');
      expect(body.status.autoRenew).toBe(false);
    });

    it('should reject invalid tier', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tier: 'Invalid',
          durationDays: 30,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid durationDays', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tier: 'Professional',
          durationDays: -5,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        payload: {
          tier: 'Professional',
          durationDays: 30,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/subscriptions/history', () => {
    it('should return subscription history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/history',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('history');
      expect(Array.isArray(body.history)).toBe(true);
      expect(body.history.length).toBeGreaterThan(0);

      const latestEntry = body.history[0];
      expect(latestEntry).toHaveProperty('tier');
      expect(latestEntry).toHaveProperty('startedAt');
      expect(latestEntry).toHaveProperty('expiresAt');
      expect(latestEntry).toHaveProperty('autoRenew');
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/history',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/subscriptions/cancel', () => {
    it('should cancel subscription without immediate downgrade', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/cancel',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          reason: 'Testing cancellation',
          immediate: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.status).toBeDefined();
      expect(body.status.autoRenew).toBe(false);
      expect(body.status.tier).toBe('Business');
    });

    it('should cancel subscription with immediate downgrade', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/cancel',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          reason: 'Testing immediate cancellation',
          immediate: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.status.tier).toBe('Gift');
      expect(body.status.autoRenew).toBe(false);
      expect(body.status.expiresAt).toBeNull();
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/cancel',
        payload: {
          reason: 'Test',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Subscription lifecycle scenarios', () => {
    let lifecycleUserId: string;
    let lifecycleToken: string;

    beforeAll(async () => {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          telegramId: 777777777,
          username: 'lifecycle',
        },
      });

      const body = JSON.parse(loginResponse.body);
      lifecycleUserId = body.user.id;
      lifecycleToken = body.token;
    });

    afterAll(async () => {
      if (lifecycleUserId) {
        await db.subscriptionHistory
          .deleteMany({ where: { userId: lifecycleUserId } })
          .catch(() => {});
        await db.user.delete({ where: { id: lifecycleUserId } }).catch(() => {});
      }
    });

    it('should handle complete subscription lifecycle: Gift -> Professional -> Cancel -> Gift', async () => {
      let response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/status',
        headers: { authorization: `Bearer ${lifecycleToken}` },
      });
      let status = JSON.parse(response.body);
      expect(status.tier).toBe('Gift');

      response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: { authorization: `Bearer ${lifecycleToken}` },
        payload: {
          tier: 'Professional',
          durationDays: 30,
          autoRenew: true,
          priceRubles: 1990,
        },
      });
      expect(response.statusCode).toBe(200);
      status = JSON.parse(response.body).status;
      expect(status.tier).toBe('Professional');
      expect(status.autoRenew).toBe(true);

      response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/cancel',
        headers: { authorization: `Bearer ${lifecycleToken}` },
        payload: { reason: 'Test lifecycle', immediate: false },
      });
      expect(response.statusCode).toBe(200);
      status = JSON.parse(response.body).status;
      expect(status.tier).toBe('Professional');
      expect(status.autoRenew).toBe(false);

      response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/cancel',
        headers: { authorization: `Bearer ${lifecycleToken}` },
        payload: { immediate: true },
      });
      expect(response.statusCode).toBe(200);
      status = JSON.parse(response.body).status;
      expect(status.tier).toBe('Gift');

      response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/history',
        headers: { authorization: `Bearer ${lifecycleToken}` },
      });
      const history = JSON.parse(response.body).history;
      expect(history.length).toBeGreaterThan(0);
    });

    it('should handle tier upgrade: Professional -> Business', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: { authorization: `Bearer ${lifecycleToken}` },
        payload: {
          tier: 'Professional',
          durationDays: 30,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: { authorization: `Bearer ${lifecycleToken}` },
        payload: {
          tier: 'Business',
          durationDays: 30,
          priceRubles: 3490,
        },
      });

      expect(response.statusCode).toBe(200);
      const status = JSON.parse(response.body).status;
      expect(status.tier).toBe('Business');
    });

    it('should handle multiple activations and track in history', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: { authorization: `Bearer ${lifecycleToken}` },
        payload: { tier: 'Professional', durationDays: 30 },
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/activate',
        headers: { authorization: `Bearer ${lifecycleToken}` },
        payload: { tier: 'Business', durationDays: 30 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/history',
        headers: { authorization: `Bearer ${lifecycleToken}` },
      });

      const history = JSON.parse(response.body).history;
      expect(history.length).toBeGreaterThanOrEqual(2);

      const tiers = history.map((h: any) => h.tier);
      expect(tiers).toContain('Professional');
      expect(tiers).toContain('Business');
    });
  });
});
