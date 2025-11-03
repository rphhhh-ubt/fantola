import { MockRedisClient } from '@monorepo/test-utils';
import { CacheManager } from '../cache-manager';
import { UserCache } from '../user-cache';
import { UserProfile, SubscriptionTier } from '../types';

describe('UserCache', () => {
  let redis: MockRedisClient;
  let cacheManager: CacheManager;
  let userCache: UserCache;

  beforeEach(() => {
    redis = new MockRedisClient();
    cacheManager = new CacheManager(redis as any, 'cache', 300);
    userCache = new UserCache(cacheManager);
  });

  afterEach(() => {
    redis.clear();
  });

  describe('User Profile', () => {
    const mockProfile: UserProfile = {
      id: 'user-123',
      telegramId: '12345',
      username: 'testuser',
      tier: SubscriptionTier.PROFESSIONAL,
      subscriptionExpiresAt: new Date('2024-12-31'),
      tokensBalance: 2000,
      tokensSpent: 0,
      channelSubscribedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should set and get user profile', async () => {
      await userCache.setUserProfile('user-123', mockProfile);
      const profile = await userCache.getUserProfile('user-123');

      expect(profile).toMatchObject({
        id: mockProfile.id,
        telegramId: mockProfile.telegramId,
        username: mockProfile.username,
        tier: mockProfile.tier,
        tokensBalance: mockProfile.tokensBalance,
        tokensSpent: mockProfile.tokensSpent,
      });
    });

    it('should return null for non-existent profile', async () => {
      const profile = await userCache.getUserProfile('nonexistent');

      expect(profile).toBeNull();
    });

    it('should fetch profile on cache miss', async () => {
      const fetcher = jest.fn(async () => mockProfile);

      const profile = await userCache.getOrFetchUserProfile('user-123', fetcher);

      expect(profile).toEqual(mockProfile);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should use cached profile on cache hit', async () => {
      await userCache.setUserProfile('user-123', mockProfile);

      const fetcher = jest.fn(async () => mockProfile);
      const profile = await userCache.getOrFetchUserProfile('user-123', fetcher);

      expect(profile).toMatchObject({
        id: mockProfile.id,
        telegramId: mockProfile.telegramId,
        username: mockProfile.username,
        tier: mockProfile.tier,
      });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should invalidate user profile', async () => {
      await userCache.setUserProfile('user-123', mockProfile);
      await userCache.invalidateUserProfile('user-123');

      const profile = await userCache.getUserProfile('user-123');

      expect(profile).toBeNull();
    });
  });

  describe('Token Balance', () => {
    const mockBalance = {
      tokensBalance: 1500,
      tokensSpent: 500,
    };

    it('should set and get token balance', async () => {
      await userCache.setTokenBalance('user-123', mockBalance);
      const balance = await userCache.getTokenBalance('user-123');

      expect(balance).toEqual(mockBalance);
    });

    it('should return null for non-existent balance', async () => {
      const balance = await userCache.getTokenBalance('nonexistent');

      expect(balance).toBeNull();
    });

    it('should fetch balance on cache miss', async () => {
      const fetcher = jest.fn(async () => mockBalance);

      const balance = await userCache.getOrFetchTokenBalance('user-123', fetcher);

      expect(balance).toEqual(mockBalance);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should use cached balance on cache hit', async () => {
      await userCache.setTokenBalance('user-123', mockBalance);

      const fetcher = jest.fn(async () => mockBalance);
      const balance = await userCache.getOrFetchTokenBalance('user-123', fetcher);

      expect(balance).toEqual(mockBalance);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should invalidate token balance', async () => {
      await userCache.setTokenBalance('user-123', mockBalance);
      await userCache.invalidateTokenBalance('user-123');

      const balance = await userCache.getTokenBalance('user-123');

      expect(balance).toBeNull();
    });
  });

  describe('Channel Subscription', () => {
    const mockSubscription = {
      isSubscribed: true,
      subscribedAt: new Date('2024-01-01'),
    };

    it('should set and get channel subscription', async () => {
      await userCache.setChannelSubscription('user-123', mockSubscription);
      const subscription = await userCache.getChannelSubscription('user-123');

      expect(subscription).toMatchObject({
        isSubscribed: mockSubscription.isSubscribed,
      });
    });

    it('should return null for non-existent subscription', async () => {
      const subscription = await userCache.getChannelSubscription('nonexistent');

      expect(subscription).toBeNull();
    });

    it('should fetch subscription on cache miss', async () => {
      const fetcher = jest.fn(async () => mockSubscription);

      const subscription = await userCache.getOrFetchChannelSubscription('user-123', fetcher);

      expect(subscription).toEqual(mockSubscription);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should use cached subscription on cache hit', async () => {
      await userCache.setChannelSubscription('user-123', mockSubscription);

      const fetcher = jest.fn(async () => mockSubscription);
      const subscription = await userCache.getOrFetchChannelSubscription('user-123', fetcher);

      expect(subscription).toMatchObject({
        isSubscribed: mockSubscription.isSubscribed,
      });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should invalidate channel subscription', async () => {
      await userCache.setChannelSubscription('user-123', mockSubscription);
      await userCache.invalidateChannelSubscription('user-123');

      const subscription = await userCache.getChannelSubscription('user-123');

      expect(subscription).toBeNull();
    });
  });

  describe('invalidateAllUserData', () => {
    it('should invalidate all user data', async () => {
      const mockProfile: UserProfile = {
        id: 'user-123',
        telegramId: '12345',
        username: 'testuser',
        tier: SubscriptionTier.GIFT,
        subscriptionExpiresAt: null,
        tokensBalance: 100,
        tokensSpent: 0,
        channelSubscribedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await userCache.setUserProfile('user-123', mockProfile);
      await userCache.setTokenBalance('user-123', { tokensBalance: 100, tokensSpent: 0 });
      await userCache.setChannelSubscription('user-123', { isSubscribed: true, subscribedAt: new Date() });

      await userCache.invalidateAllUserData('user-123');

      const profile = await userCache.getUserProfile('user-123');
      const balance = await userCache.getTokenBalance('user-123');
      const subscription = await userCache.getChannelSubscription('user-123');

      expect(profile).toBeNull();
      expect(balance).toBeNull();
      expect(subscription).toBeNull();
    });
  });

  describe('warmUserCache', () => {
    it('should warm cache with all user data', async () => {
      const mockProfile: UserProfile = {
        id: 'user-123',
        telegramId: '12345',
        username: 'testuser',
        tier: SubscriptionTier.PROFESSIONAL,
        subscriptionExpiresAt: new Date(),
        tokensBalance: 2000,
        tokensSpent: 0,
        channelSubscribedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBalance = { tokensBalance: 2000, tokensSpent: 0 };
      const mockSubscription = { isSubscribed: true, subscribedAt: new Date() };

      await userCache.warmUserCache('user-123', {
        profile: mockProfile,
        tokenBalance: mockBalance,
        channelSubscription: mockSubscription,
      });

      const profile = await userCache.getUserProfile('user-123');
      const balance = await userCache.getTokenBalance('user-123');
      const subscription = await userCache.getChannelSubscription('user-123');

      expect(profile).toMatchObject({
        id: mockProfile.id,
        tier: mockProfile.tier,
      });
      expect(balance).toEqual(mockBalance);
      expect(subscription).toMatchObject({
        isSubscribed: mockSubscription.isSubscribed,
      });
    });

    it('should warm cache with partial data', async () => {
      const mockBalance = { tokensBalance: 1500, tokensSpent: 500 };

      await userCache.warmUserCache('user-123', {
        tokenBalance: mockBalance,
      });

      const profile = await userCache.getUserProfile('user-123');
      const balance = await userCache.getTokenBalance('user-123');

      expect(profile).toBeNull();
      expect(balance).toEqual(mockBalance);
    });
  });

  describe('Batch Operations', () => {
    it('should batch get profiles', async () => {
      const profile1: UserProfile = {
        id: 'user-1',
        telegramId: '1',
        username: 'user1',
        tier: SubscriptionTier.GIFT,
        subscriptionExpiresAt: null,
        tokensBalance: 100,
        tokensSpent: 0,
        channelSubscribedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const profile2: UserProfile = {
        ...profile1,
        id: 'user-2',
        telegramId: '2',
        username: 'user2',
      };

      await userCache.setUserProfile('user-1', profile1);
      await userCache.setUserProfile('user-2', profile2);

      const profiles = await userCache.batchGetProfiles(['user-1', 'user-2', 'user-3']);

      expect(profiles.size).toBe(2);
      const values = Array.from(profiles.values());
      expect(values.length).toBe(2);
      expect(values[0]).toMatchObject({ id: expect.any(String), tier: 'Gift' });
      expect(values[1]).toMatchObject({ id: expect.any(String), tier: 'Gift' });
    });

    it('should batch set profiles', async () => {
      const profile1: UserProfile = {
        id: 'user-1',
        telegramId: '1',
        username: 'user1',
        tier: SubscriptionTier.GIFT,
        subscriptionExpiresAt: null,
        tokensBalance: 100,
        tokensSpent: 0,
        channelSubscribedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const profile2: UserProfile = {
        ...profile1,
        id: 'user-2',
        telegramId: '2',
        username: 'user2',
      };

      await userCache.batchSetProfiles([
        { userId: 'user-1', profile: profile1 },
        { userId: 'user-2', profile: profile2 },
      ]);

      const result1 = await userCache.getUserProfile('user-1');
      const result2 = await userCache.getUserProfile('user-2');

      expect(result1).toMatchObject({ id: profile1.id, tier: profile1.tier });
      expect(result2).toMatchObject({ id: profile2.id, tier: profile2.tier });
    });
  });
});
