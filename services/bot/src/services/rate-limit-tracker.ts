import Redis from 'ioredis';
import { Monitoring } from '@monorepo/monitoring';

export interface ProviderLimits {
  dailyLimit: number;
  minuteLimit: number;
  warningThreshold: number;
}

export interface UsageStats {
  dailyUsage: number;
  dailyLimit: number;
  minuteUsage: number;
  minuteLimit: number;
  percentUsed: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

const GROQ_LIMITS: ProviderLimits = {
  dailyLimit: 14400,
  minuteLimit: 300,
  warningThreshold: 0.9,
};

const GEMINI_LIMITS: ProviderLimits = {
  dailyLimit: 1500,
  minuteLimit: 15,
  warningThreshold: 0.9,
};

export class RateLimitTracker {
  private redis: Redis;
  private monitoring?: Monitoring;

  constructor(redis: Redis, monitoring?: Monitoring) {
    this.redis = redis;
    this.monitoring = monitoring;
  }

  /**
   * Check if Groq request can be made
   */
  async checkGroqLimit(): Promise<UsageStats> {
    return this.checkLimit('groq', GROQ_LIMITS);
  }

  /**
   * Check if Gemini request can be made
   */
  async checkGeminiLimit(): Promise<UsageStats> {
    return this.checkLimit('gemini', GEMINI_LIMITS);
  }

  /**
   * Increment Groq usage counter
   */
  async incrementGroq(): Promise<void> {
    await this.increment('groq', GROQ_LIMITS);
  }

  /**
   * Increment Gemini usage counter
   */
  async incrementGemini(): Promise<void> {
    await this.increment('gemini', GEMINI_LIMITS);
  }

  /**
   * Get current usage stats for a provider
   */
  async getStats(provider: 'groq' | 'gemini'): Promise<UsageStats> {
    const limits = provider === 'groq' ? GROQ_LIMITS : GEMINI_LIMITS;
    return this.checkLimit(provider, limits);
  }

  /**
   * Check rate limit for a provider
   */
  private async checkLimit(provider: string, limits: ProviderLimits): Promise<UsageStats> {
    const dailyKey = this.getDailyKey(provider);
    const minuteKey = this.getMinuteKey(provider);

    const [dailyUsage, minuteUsage] = await Promise.all([
      this.redis.get(dailyKey).then((val) => (val ? parseInt(val, 10) : 0)),
      this.redis.get(minuteKey).then((val) => (val ? parseInt(val, 10) : 0)),
    ]);

    const percentUsed = dailyUsage / limits.dailyLimit;
    const isNearLimit = percentUsed >= limits.warningThreshold;
    const isAtLimit = dailyUsage >= limits.dailyLimit || minuteUsage >= limits.minuteLimit;

    if (isNearLimit && this.monitoring) {
      this.monitoring.logger.warn(
        {
          provider,
          dailyUsage,
          dailyLimit: limits.dailyLimit,
          percentUsed: Math.round(percentUsed * 100),
        },
        `${provider} usage is near limit`
      );
    }

    return {
      dailyUsage,
      dailyLimit: limits.dailyLimit,
      minuteUsage,
      minuteLimit: limits.minuteLimit,
      percentUsed,
      isNearLimit,
      isAtLimit,
    };
  }

  /**
   * Increment usage counter for a provider
   */
  private async increment(provider: string, limits: ProviderLimits): Promise<void> {
    const dailyKey = this.getDailyKey(provider);
    const minuteKey = this.getMinuteKey(provider);

    const pipeline = this.redis.pipeline();

    // Increment daily counter
    pipeline.incr(dailyKey);
    pipeline.expire(dailyKey, this.getSecondsUntilMidnight());

    // Increment minute counter
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60);

    await pipeline.exec();

    // Log usage stats
    if (this.monitoring) {
      const stats = await this.checkLimit(provider, limits);
      
      if (stats.isNearLimit) {
        this.monitoring.logger.warn(
          {
            provider,
            stats,
          },
          `${provider} usage is near limit (${Math.round(stats.percentUsed * 100)}%)`
        );
      }

      this.monitoring.logger.debug(
        {
          provider,
          dailyUsage: stats.dailyUsage,
          dailyLimit: stats.dailyLimit,
          percentUsed: Math.round(stats.percentUsed * 100),
        },
        `${provider} request tracked`
      );
    }
  }

  /**
   * Get daily key for provider
   */
  private getDailyKey(provider: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `ai:rate-limit:${provider}:daily:${date}`;
  }

  /**
   * Get minute key for provider
   */
  private getMinuteKey(provider: string): string {
    const now = new Date();
    const minute = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;
    const date = now.toISOString().split('T')[0];
    return `ai:rate-limit:${provider}:minute:${date}:${minute}`;
  }

  /**
   * Get seconds until midnight UTC
   */
  private getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  /**
   * Format error message for rate limit exceeded
   */
  formatRateLimitError(provider: 'groq' | 'gemini', stats: UsageStats): string {
    const limits = provider === 'groq' ? GROQ_LIMITS : GEMINI_LIMITS;

    if (stats.minuteUsage >= limits.minuteLimit) {
      return `${provider === 'groq' ? 'Groq' : 'Gemini'} rate limit exceeded (${limits.minuteLimit} requests/minute). Please wait a minute and try again.`;
    }

    if (stats.dailyUsage >= limits.dailyLimit) {
      return `Daily ${provider === 'groq' ? 'Groq' : 'Gemini'} limit reached (${limits.dailyLimit} requests). Please try again tomorrow.`;
    }

    return `Rate limit exceeded. Please try again later.`;
  }
}
