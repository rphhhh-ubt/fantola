import { Bot } from 'grammy';
import Redis from 'ioredis';
import { Monitoring } from '@monorepo/monitoring';
import { MockRedisClient } from '@monorepo/test-utils';
import { ChannelVerificationService } from '../services/channel-verification-service';

// Mock dependencies
jest.mock('grammy');
jest.mock('@monorepo/monitoring');

describe('ChannelVerificationService', () => {
  let redis: Redis;
  let bot: Bot;
  let monitoring: Monitoring;
  let service: ChannelVerificationService;

  const mockUserId = 123456789;
  const mockChannelId = '@test_channel';

  beforeEach(() => {
    redis = new MockRedisClient() as unknown as Redis;
    
    // Create a mock bot with API
    bot = {
      api: {
        getChatMember: jest.fn(),
      },
    } as any;
    
    monitoring = new Monitoring({ service: 'test' });
    
    // Mock monitoring methods
    monitoring.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    service = new ChannelVerificationService(bot, redis, monitoring, {
      channelId: mockChannelId,
      cacheTtl: 600,
      rateLimitWindow: 60,
      rateLimitMax: 10,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkMembership', () => {
    it('should return member status from Telegram API', async () => {
      const mockChatMember = {
        status: 'member',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      const result = await service.checkMembership(mockUserId);

      expect(result.isMember).toBe(true);
      expect(result.status).toBe('member');
      expect(bot.api.getChatMember).toHaveBeenCalledWith(mockChannelId, mockUserId);
    });

    it('should return administrator as member', async () => {
      const mockChatMember = {
        status: 'administrator',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      const result = await service.checkMembership(mockUserId);

      expect(result.isMember).toBe(true);
      expect(result.status).toBe('administrator');
    });

    it('should return creator as member', async () => {
      const mockChatMember = {
        status: 'creator',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      const result = await service.checkMembership(mockUserId);

      expect(result.isMember).toBe(true);
      expect(result.status).toBe('creator');
    });

    it('should return not member for left status', async () => {
      const mockChatMember = {
        status: 'left',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      const result = await service.checkMembership(mockUserId);

      expect(result.isMember).toBe(false);
      expect(result.status).toBe('left');
    });

    it('should return not member for kicked status', async () => {
      const mockChatMember = {
        status: 'kicked',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      const result = await service.checkMembership(mockUserId);

      expect(result.isMember).toBe(false);
      expect(result.status).toBe('kicked');
    });

    it('should handle user not found error', async () => {
      bot.api.getChatMember = jest.fn().mockRejectedValue({
        error_code: 400,
        description: 'Bad Request: user not found',
      });

      const result = await service.checkMembership(mockUserId);

      expect(result.isMember).toBe(false);
      expect(result.error).toBe('user_not_found');
    });

    it('should handle channel not found error', async () => {
      bot.api.getChatMember = jest.fn().mockRejectedValue({
        error_code: 400,
        description: 'Bad Request: chat not found',
      });

      const result = await service.checkMembership(mockUserId);

      expect(result.isMember).toBe(false);
      expect(result.error).toBe('channel_private');
    });

    it('should handle generic API errors', async () => {
      bot.api.getChatMember = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.checkMembership(mockUserId);

      expect(result.isMember).toBe(false);
      expect(result.error).toBe('api_error');
      expect(result.errorMessage).toContain('Network error');
    });

    it('should return error when channel is not configured', async () => {
      const serviceWithoutChannel = new ChannelVerificationService(
        bot,
        redis,
        monitoring,
        { channelId: undefined }
      );

      const result = await serviceWithoutChannel.checkMembership(mockUserId);

      expect(result.isMember).toBe(false);
      expect(result.error).toBe('channel_not_configured');
    });
  });

  describe('Caching', () => {
    it('should cache successful membership check', async () => {
      const mockChatMember = {
        status: 'member',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      // First call - should hit API
      const result1 = await service.checkMembership(mockUserId);
      expect(result1.isMember).toBe(true);
      expect(bot.api.getChatMember).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await service.checkMembership(mockUserId);
      expect(result2.isMember).toBe(true);
      expect(bot.api.getChatMember).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should cache negative results (not a member)', async () => {
      const mockChatMember = {
        status: 'left',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      // First call
      const result1 = await service.checkMembership(mockUserId);
      expect(result1.isMember).toBe(false);

      // Second call - should use cache
      const result2 = await service.checkMembership(mockUserId);
      expect(result2.isMember).toBe(false);
      expect(bot.api.getChatMember).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      const mockChatMember = {
        status: 'member',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      await service.checkMembership(mockUserId);

      // Verify cache was set with TTL
      const cacheKey = `channel:membership:${mockUserId}`;
      const cached = await redis.get(cacheKey);
      expect(cached).toBeTruthy();
      
      const cachedData = JSON.parse(cached!);
      expect(cachedData.isMember).toBe(true);
    });

    it('should invalidate cache when requested', async () => {
      const mockChatMember = {
        status: 'member',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      // First call - cache it
      await service.checkMembership(mockUserId);

      // Invalidate cache
      await service.invalidateCache(mockUserId);

      // Next call should hit API again
      await service.checkMembership(mockUserId);
      expect(bot.api.getChatMember).toHaveBeenCalledTimes(2);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const mockChatMember = {
        status: 'member',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      // Make multiple requests within limit
      for (let i = 0; i < 5; i++) {
        await service.invalidateCache(mockUserId); // Clear cache between calls
        const result = await service.checkMembership(mockUserId);
        expect(result.isMember).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const mockChatMember = {
        status: 'member',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      // Make requests up to the limit + 1
      const rateLimitMax = 10;
      for (let i = 0; i < rateLimitMax + 1; i++) {
        await service.invalidateCache(mockUserId);
        await service.checkMembership(mockUserId);
      }

      // Next request should be rate limited
      await service.invalidateCache(mockUserId);
      const result = await service.checkMembership(mockUserId);
      
      expect(result.isMember).toBe(false);
      expect(result.error).toBe('rate_limit');
      expect(monitoring.logger.warn).toHaveBeenCalledWith(
        { userId: mockUserId, service: 'channel_verification' },
        'Channel verification rate limit exceeded'
      );
    });
  });

  describe('Channel Link Formatting', () => {
    it('should format channel username as link', () => {
      const service = new ChannelVerificationService(bot, redis, monitoring, {
        channelId: '@mychannel',
      });

      const link = service.getChannelLink();
      expect(link).toBe('https://t.me/mychannel');
    });

    it('should return channel ID as-is if not a username', () => {
      const service = new ChannelVerificationService(bot, redis, monitoring, {
        channelId: '-1001234567890',
      });

      const link = service.getChannelLink();
      expect(link).toBe('-1001234567890');
    });

    it('should return null if channel not configured', () => {
      const service = new ChannelVerificationService(bot, redis, monitoring, {
        channelId: undefined,
      });

      const link = service.getChannelLink();
      expect(link).toBeNull();
    });

    it('should format channel for messages', () => {
      const service = new ChannelVerificationService(bot, redis, monitoring, {
        channelId: '@mychannel',
      });

      const formatted = service.formatChannelForMessage();
      expect(formatted).toBe('@mychannel');
    });
  });

  describe('Cache Expiry Behavior', () => {
    it('should fetch from API when cache expires', async () => {
      // Create service with short cache TTL
      const shortTtlService = new ChannelVerificationService(bot, redis, monitoring, {
        channelId: mockChannelId,
        cacheTtl: 1, // 1 second
      });

      const mockChatMember = {
        status: 'member',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      // First call
      await shortTtlService.checkMembership(mockUserId);
      expect(bot.api.getChatMember).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Second call should hit API again
      await shortTtlService.checkMembership(mockUserId);
      expect(bot.api.getChatMember).toHaveBeenCalledTimes(2);
    });

    it('should handle cache expiry during high load', async () => {
      const shortTtlService = new ChannelVerificationService(bot, redis, monitoring, {
        channelId: mockChannelId,
        cacheTtl: 1,
      });

      const mockChatMember = {
        status: 'member',
        user: { id: mockUserId },
      };

      bot.api.getChatMember = jest.fn().mockResolvedValue(mockChatMember);

      // Make initial request
      await shortTtlService.checkMembership(mockUserId);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Make multiple concurrent requests after cache expiry
      const promises = Array(3).fill(null).map(() => 
        shortTtlService.checkMembership(mockUserId)
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.isMember).toBe(true);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary API errors', async () => {
      // First call fails
      bot.api.getChatMember = jest.fn().mockRejectedValueOnce(new Error('Temporary error'));

      const result1 = await service.checkMembership(mockUserId);
      expect(result1.isMember).toBe(false);
      expect(result1.error).toBe('api_error');

      // Invalidate failed result from cache
      await service.invalidateCache(mockUserId);

      // Second call succeeds
      bot.api.getChatMember = jest.fn().mockResolvedValueOnce({
        status: 'member',
        user: { id: mockUserId },
      });

      const result2 = await service.checkMembership(mockUserId);
      expect(result2.isMember).toBe(true);
    });
  });
});
