import type { Redis } from 'ioredis';
import {
  SubscriptionTier,
  RATE_LIMITS,
  RateLimitResult,
} from './types';

export class RateLimiter {
  private readonly redis: Redis;
  private readonly keyPrefix: string = 'ratelimit';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async checkLimit(
    userId: string,
    tier: SubscriptionTier,
    operation: string = 'default'
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[tier];
    const now = Date.now();
    const minuteKey = `${this.keyPrefix}:${userId}:${operation}:minute`;
    const secondKey = `${this.keyPrefix}:${userId}:${operation}:second`;

    const [minuteAllowed, secondAllowed] = await Promise.all([
      this.checkSlidingWindow(minuteKey, config.requestsPerMinute, 60, now),
      this.checkTokenBucket(secondKey, config.burstPerSecond, 1, now),
    ]);

    if (!minuteAllowed.allowed) {
      return minuteAllowed;
    }

    if (!secondAllowed.allowed) {
      return secondAllowed;
    }

    return minuteAllowed;
  }

  private async checkSlidingWindow(
    key: string,
    limit: number,
    windowSeconds: number,
    now: number
  ): Promise<RateLimitResult> {
    const windowStart = now - windowSeconds * 1000;

    const multi = this.redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zcard(key);
    multi.zadd(key, now, `${now}-${Math.random()}`);
    multi.expire(key, windowSeconds + 1);

    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis transaction failed');
    }

    const count = results[1][1] as number;

    const allowed = count < limit;
    const remaining = Math.max(0, limit - count - 1);
    const resetAt = new Date(now + windowSeconds * 1000);
    const retryAfter = allowed ? undefined : Math.ceil(windowSeconds);

    if (!allowed) {
      await this.redis.del(`${key}:${now}`);
    }

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter,
    };
  }

  private async checkTokenBucket(
    key: string,
    capacity: number,
    windowSeconds: number,
    now: number
  ): Promise<RateLimitResult> {
    const bucketKey = `${key}:bucket`;
    const timestampKey = `${key}:timestamp`;

    const lastTimestamp = await this.redis.get(timestampKey);
    const currentTokens = await this.redis.get(bucketKey);

    let tokens = currentTokens ? parseInt(currentTokens, 10) : capacity;
    const lastTime = lastTimestamp ? parseInt(lastTimestamp, 10) : now;

    const elapsed = (now - lastTime) / 1000;
    const refillRate = capacity / windowSeconds;
    tokens = Math.min(capacity, tokens + elapsed * refillRate);

    if (tokens >= 1) {
      tokens -= 1;
      await this.redis.set(bucketKey, Math.floor(tokens).toString(), 'EX', windowSeconds + 1);
      await this.redis.set(timestampKey, now.toString(), 'EX', windowSeconds + 1);

      return {
        allowed: true,
        remaining: Math.floor(tokens),
        resetAt: new Date(now + windowSeconds * 1000),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now + (1 - tokens) * (windowSeconds / capacity) * 1000),
      retryAfter: Math.ceil((1 - tokens) * (windowSeconds / capacity)),
    };
  }

  async getRemainingLimit(
    userId: string,
    tier: SubscriptionTier,
    operation: string = 'default'
  ): Promise<number> {
    const config = RATE_LIMITS[tier];
    const minuteKey = `${this.keyPrefix}:${userId}:${operation}:minute`;
    const now = Date.now();
    const windowStart = now - 60 * 1000;

    await this.redis.zremrangebyscore(minuteKey, 0, windowStart);
    const count = await this.redis.zcard(minuteKey);

    return Math.max(0, config.requestsPerMinute - count);
  }

  async resetLimit(userId: string, operation: string = 'default'): Promise<void> {
    const minuteKey = `${this.keyPrefix}:${userId}:${operation}:minute`;
    const secondKey = `${this.keyPrefix}:${userId}:${operation}:second`;
    const bucketKey = `${secondKey}:bucket`;
    const timestampKey = `${secondKey}:timestamp`;

    await Promise.all([
      this.redis.del(minuteKey),
      this.redis.del(secondKey),
      this.redis.del(bucketKey),
      this.redis.del(timestampKey),
    ]);
  }

  async getUserStats(userId: string, operation: string = 'default'): Promise<{
    minuteCount: number;
    secondTokens: number;
  }> {
    const minuteKey = `${this.keyPrefix}:${userId}:${operation}:minute`;
    const secondKey = `${this.keyPrefix}:${userId}:${operation}:second:bucket`;
    const now = Date.now();
    const windowStart = now - 60 * 1000;

    await this.redis.zremrangebyscore(minuteKey, 0, windowStart);

    const [minuteCount, secondTokensStr] = await Promise.all([
      this.redis.zcard(minuteKey),
      this.redis.get(secondKey),
    ]);

    return {
      minuteCount,
      secondTokens: secondTokensStr ? parseInt(secondTokensStr, 10) : 0,
    };
  }
}
