import { Bot } from 'grammy';
import Redis from 'ioredis';
import { Monitoring } from '@monorepo/monitoring';

export interface ChannelMembershipResult {
  isMember: boolean;
  status?: 'member' | 'administrator' | 'creator' | 'restricted' | 'left' | 'kicked';
  error?: 'channel_not_configured' | 'user_not_found' | 'channel_private' | 'api_error' | 'rate_limit';
  errorMessage?: string;
}

export interface ChannelVerificationConfig {
  channelId?: string;
  cacheTtl?: number; // Cache TTL in seconds (default: 600 = 10 minutes)
  rateLimitWindow?: number; // Rate limit window in seconds (default: 60)
  rateLimitMax?: number; // Max checks per window (default: 10)
}

/**
 * Service for verifying Telegram channel membership with Redis caching
 * and rate limiting to prevent API abuse
 */
export class ChannelVerificationService {
  private bot: Bot;
  private redis: Redis;
  private monitoring: Monitoring;
  private config: Required<ChannelVerificationConfig>;

  constructor(
    bot: Bot,
    redis: Redis,
    monitoring: Monitoring,
    config: ChannelVerificationConfig = {}
  ) {
    this.bot = bot;
    this.redis = redis;
    this.monitoring = monitoring;
    this.config = {
      channelId: config.channelId || '',
      cacheTtl: config.cacheTtl || 600, // 10 minutes default
      rateLimitWindow: config.rateLimitWindow || 60, // 1 minute window
      rateLimitMax: config.rateLimitMax || 10, // 10 checks per minute
    };
  }

  /**
   * Get cache key for user channel membership
   */
  private getCacheKey(userId: number): string {
    return `channel:membership:${userId}`;
  }

  /**
   * Get rate limit key for user
   */
  private getRateLimitKey(userId: number): string {
    return `channel:ratelimit:${userId}`;
  }

  /**
   * Check if user has exceeded rate limit
   */
  private async checkRateLimit(userId: number): Promise<boolean> {
    const key = this.getRateLimitKey(userId);
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, this.config.rateLimitWindow);
    }

    return current <= this.config.rateLimitMax;
  }

  /**
   * Check channel membership via Telegram API
   */
  private async checkMembershipViaApi(
    userId: number,
    channelId: string
  ): Promise<ChannelMembershipResult> {
    try {
      const chatMember = await this.bot.api.getChatMember(channelId, userId);
      
      const status = chatMember.status;
      const isMember = ['member', 'administrator', 'creator'].includes(status);

      this.monitoring.logger.debug(
        { userId, channelId, status, isMember },
        'Channel membership checked'
      );

      return {
        isMember,
        status: status as ChannelMembershipResult['status'],
      };
    } catch (error: any) {
      this.monitoring.logger.error(
        { userId, channelId, error: error.message },
        'Error checking channel membership'
      );

      // Handle specific Telegram API errors
      if (error.error_code === 400) {
        if (error.description?.includes('user not found')) {
          return {
            isMember: false,
            error: 'user_not_found',
            errorMessage: 'User not found',
          };
        }
        if (error.description?.includes('chat not found')) {
          return {
            isMember: false,
            error: 'channel_private',
            errorMessage: 'Channel not found or is private',
          };
        }
      }

      return {
        isMember: false,
        error: 'api_error',
        errorMessage: error.message || 'Unknown API error',
      };
    }
  }

  /**
   * Get cached membership or check via API
   */
  async checkMembership(userId: number): Promise<ChannelMembershipResult> {
    // Check if channel is configured
    if (!this.config.channelId) {
      return {
        isMember: false,
        error: 'channel_not_configured',
        errorMessage: 'Channel ID not configured',
      };
    }

    // Check rate limit
    const withinLimit = await this.checkRateLimit(userId);
    if (!withinLimit) {
      this.monitoring.logger.warn(
        { userId, service: 'channel_verification' },
        'Channel verification rate limit exceeded'
      );

      return {
        isMember: false,
        error: 'rate_limit',
        errorMessage: 'Rate limit exceeded',
      };
    }

    // Check cache first
    const cacheKey = this.getCacheKey(userId);
    const cached = await this.redis.get(cacheKey);

    if (cached !== null) {
      const result = JSON.parse(cached) as ChannelMembershipResult;
      this.monitoring.logger.debug(
        { userId, cached: true, isMember: result.isMember },
        'Channel membership from cache'
      );
      return result;
    }

    // Check via API
    const result = await this.checkMembershipViaApi(userId, this.config.channelId);

    // Cache the result (cache both positive and negative results)
    await this.redis.setex(cacheKey, this.config.cacheTtl, JSON.stringify(result));

    return result;
  }

  /**
   * Invalidate cache for a user
   */
  async invalidateCache(userId: number): Promise<void> {
    const cacheKey = this.getCacheKey(userId);
    await this.redis.del(cacheKey);
    this.monitoring.logger.debug({ userId }, 'Channel membership cache invalidated');
  }

  /**
   * Get channel link for display
   */
  getChannelLink(): string | null {
    if (!this.config.channelId) {
      return null;
    }

    // If channel ID starts with @, it's a username
    if (this.config.channelId.startsWith('@')) {
      return `https://t.me/${this.config.channelId.substring(1)}`;
    }

    // Otherwise return the channel ID as-is (could be a link or ID)
    return this.config.channelId;
  }

  /**
   * Format channel for display in messages
   */
  formatChannelForMessage(): string {
    const link = this.getChannelLink();
    if (!link) {
      return '';
    }

    if (this.config.channelId.startsWith('@')) {
      return this.config.channelId;
    }

    return link;
  }
}
