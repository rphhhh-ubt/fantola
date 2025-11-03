import { MockRedisClient } from '@monorepo/test-utils';
import { RateLimiter } from '../rate-limiter';
import { SubscriptionTier } from '../types';

describe('RateLimiter', () => {
  let redis: MockRedisClient;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    redis = new MockRedisClient();
    rateLimiter = new RateLimiter(redis as any);
  });

  afterEach(() => {
    redis.clear();
  });

  describe('checkLimit', () => {
    it('should allow request within rate limit', async () => {
      const result = await rateLimiter.checkLimit('user-1', SubscriptionTier.GIFT);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should enforce Gift tier limits (10 requests/minute)', async () => {
      const userId = 'user-gift';
      const results = [];

      for (let i = 0; i < 11; i++) {
        const result = await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);
        results.push(result);
      }

      const allowed = results.filter((r) => r.allowed);
      const denied = results.filter((r) => !r.allowed);

      expect(allowed.length).toBeLessThanOrEqual(10);
      expect(denied.length).toBeGreaterThan(0);
      if (denied.length > 0) {
        expect(denied[0].retryAfter).toBeDefined();
      }
    });

    it('should enforce Professional tier limits (50 requests/minute)', async () => {
      const userId = 'user-pro';
      const results = [];

      for (let i = 0; i < 51; i++) {
        const result = await rateLimiter.checkLimit(userId, SubscriptionTier.PROFESSIONAL);
        results.push(result);
      }

      const allowed = results.filter((r) => r.allowed);
      const denied = results.filter((r) => !r.allowed);

      expect(allowed.length).toBeLessThanOrEqual(50);
      expect(denied.length).toBeGreaterThan(0);
    });

    it('should enforce Business tier limits (100 requests/minute)', async () => {
      const userId = 'user-biz';
      const results = [];

      for (let i = 0; i < 101; i++) {
        const result = await rateLimiter.checkLimit(userId, SubscriptionTier.BUSINESS);
        results.push(result);
      }

      const allowed = results.filter((r) => r.allowed);
      const denied = results.filter((r) => !r.allowed);

      expect(allowed.length).toBeLessThanOrEqual(100);
      expect(denied.length).toBeGreaterThan(0);
    });

    it('should enforce burst limits', async () => {
      const userId = 'user-burst';
      const results = [];

      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);
        results.push(result);
      }

      const allowed = results.filter((r) => r.allowed);
      expect(allowed.length).toBeGreaterThan(0);
      expect(allowed.length).toBeLessThanOrEqual(3);
    });

    it('should return retryAfter when rate limited', async () => {
      const userId = 'user-retry';

      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);
      }

      const result = await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should isolate limits per operation', async () => {
      const userId = 'user-ops';

      const result1 = await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT, 'image');
      const result2 = await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT, 'chat');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('should isolate limits per user', async () => {
      const result1 = await rateLimiter.checkLimit('user-1', SubscriptionTier.GIFT);
      const result2 = await rateLimiter.checkLimit('user-2', SubscriptionTier.GIFT);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('getRemainingLimit', () => {
    it('should return remaining requests', async () => {
      const userId = 'user-remaining';

      await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);
      const remaining = await rateLimiter.getRemainingLimit(userId, SubscriptionTier.GIFT);

      expect(remaining).toBeLessThan(10);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it('should return full limit for new user', async () => {
      const remaining = await rateLimiter.getRemainingLimit('new-user', SubscriptionTier.GIFT);

      expect(remaining).toBe(10);
    });
  });

  describe('resetLimit', () => {
    it('should reset user limits', async () => {
      const userId = 'user-reset';

      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);
      }

      await rateLimiter.resetLimit(userId);

      const result = await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);
      expect(result.allowed).toBe(true);
    });

    it('should reset specific operation limits', async () => {
      const userId = 'user-reset-op';

      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT, 'image');
      }

      await rateLimiter.resetLimit(userId, 'image');

      const result = await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT, 'image');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const userId = 'user-stats';

      await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);
      await rateLimiter.checkLimit(userId, SubscriptionTier.GIFT);

      const stats = await rateLimiter.getUserStats(userId);

      expect(stats.minuteCount).toBe(2);
      expect(stats).toHaveProperty('secondTokens');
    });

    it('should return zero stats for new user', async () => {
      const stats = await rateLimiter.getUserStats('new-user');

      expect(stats.minuteCount).toBe(0);
      expect(stats.secondTokens).toBe(0);
    });
  });
});
