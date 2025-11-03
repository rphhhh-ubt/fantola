import { MockRedisClient } from '@monorepo/test-utils';
import { CacheManager } from '../cache-manager';
import { UserCache } from '../user-cache';
import { TokenBilling } from '../token-billing';
import { OperationType, SubscriptionTier } from '../types';

describe('TokenBilling', () => {
  let redis: MockRedisClient;
  let cacheManager: CacheManager;
  let userCache: UserCache;
  let tokenBilling: TokenBilling;

  beforeEach(() => {
    redis = new MockRedisClient();
    cacheManager = new CacheManager(redis as any, 'cache', 300);
    userCache = new UserCache(cacheManager);
    tokenBilling = new TokenBilling(userCache);
  });

  afterEach(() => {
    redis.clear();
  });

  describe('checkBalance', () => {
    it('should return true when user has sufficient balance', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 100, tokensSpent: 0 });

      const canAfford = await tokenBilling.checkBalance('user-1', OperationType.CHATGPT_MESSAGE);

      expect(canAfford).toBe(true);
    });

    it('should return false when user has insufficient balance', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 3, tokensSpent: 0 });

      const canAfford = await tokenBilling.checkBalance('user-1', OperationType.CHATGPT_MESSAGE);

      expect(canAfford).toBe(false);
    });

    it('should return false when balance not found', async () => {
      const canAfford = await tokenBilling.checkBalance('nonexistent', OperationType.CHATGPT_MESSAGE);

      expect(canAfford).toBe(false);
    });
  });

  describe('deductTokens', () => {
    it('should deduct tokens for ChatGPT message (5 tokens)', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 100, tokensSpent: 10 });

      const result = await tokenBilling.deductTokens('user-1', OperationType.CHATGPT_MESSAGE);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(95);

      const balance = await userCache.getTokenBalance('user-1');
      expect(balance?.tokensBalance).toBe(95);
      expect(balance?.tokensSpent).toBe(15);
    });

    it('should deduct tokens for image generation (10 tokens)', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 100, tokensSpent: 0 });

      const result = await tokenBilling.deductTokens('user-1', OperationType.IMAGE_GENERATION);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(90);

      const balance = await userCache.getTokenBalance('user-1');
      expect(balance?.tokensBalance).toBe(90);
      expect(balance?.tokensSpent).toBe(10);
    });

    it('should fail when insufficient tokens', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 3, tokensSpent: 0 });

      const result = await tokenBilling.deductTokens('user-1', OperationType.CHATGPT_MESSAGE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient tokens');
      expect(result.newBalance).toBe(3);
    });

    it('should fail when balance not found', async () => {
      const result = await tokenBilling.deductTokens('nonexistent', OperationType.CHATGPT_MESSAGE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('balance not found');
      expect(result.newBalance).toBe(0);
    });

    it('should call onBalanceUpdate callback', async () => {
      const onBalanceUpdate = jest.fn();
      const tokenBillingWithCallback = new TokenBilling(userCache, { onBalanceUpdate });

      await userCache.setTokenBalance('user-1', { tokensBalance: 100, tokensSpent: 0 });

      await tokenBillingWithCallback.deductTokens('user-1', OperationType.CHATGPT_MESSAGE);

      expect(onBalanceUpdate).toHaveBeenCalledWith('user-1', 95);
    });
  });

  describe('addTokens', () => {
    it('should add tokens to balance', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 50, tokensSpent: 50 });

      const result = await tokenBilling.addTokens('user-1', 100);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(150);

      const balance = await userCache.getTokenBalance('user-1');
      expect(balance?.tokensBalance).toBe(150);
      expect(balance?.tokensSpent).toBe(50);
    });

    it('should fail when balance not found', async () => {
      const result = await tokenBilling.addTokens('nonexistent', 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('balance not found');
    });

    it('should call onBalanceUpdate callback', async () => {
      const onBalanceUpdate = jest.fn();
      const tokenBillingWithCallback = new TokenBilling(userCache, { onBalanceUpdate });

      await userCache.setTokenBalance('user-1', { tokensBalance: 50, tokensSpent: 0 });

      await tokenBillingWithCallback.addTokens('user-1', 100);

      expect(onBalanceUpdate).toHaveBeenCalledWith('user-1', 150);
    });
  });

  describe('resetMonthlyTokens', () => {
    it('should reset tokens for Gift tier (100 tokens)', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 10, tokensSpent: 90 });

      const result = await tokenBilling.resetMonthlyTokens('user-1', SubscriptionTier.GIFT);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(100);

      const balance = await userCache.getTokenBalance('user-1');
      expect(balance?.tokensBalance).toBe(100);
      expect(balance?.tokensSpent).toBe(90);
    });

    it('should reset tokens for Professional tier (2000 tokens)', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 500, tokensSpent: 1500 });

      const result = await tokenBilling.resetMonthlyTokens('user-1', SubscriptionTier.PROFESSIONAL);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(2000);
    });

    it('should reset tokens for Business tier (10000 tokens)', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 2000, tokensSpent: 8000 });

      const result = await tokenBilling.resetMonthlyTokens('user-1', SubscriptionTier.BUSINESS);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(10000);
    });

    it('should initialize balance if not exists', async () => {
      const result = await tokenBilling.resetMonthlyTokens('new-user', SubscriptionTier.GIFT);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(100);

      const balance = await userCache.getTokenBalance('new-user');
      expect(balance?.tokensBalance).toBe(100);
      expect(balance?.tokensSpent).toBe(0);
    });
  });

  describe('getOperationCost', () => {
    it('should return correct cost for each operation type', () => {
      expect(tokenBilling.getOperationCost(OperationType.CHATGPT_MESSAGE)).toBe(5);
      expect(tokenBilling.getOperationCost(OperationType.IMAGE_GENERATION)).toBe(10);
      expect(tokenBilling.getOperationCost(OperationType.SORA_IMAGE)).toBe(10);
    });
  });

  describe('getTierAllocation', () => {
    it('should return correct allocation for each tier', () => {
      expect(tokenBilling.getTierAllocation(SubscriptionTier.GIFT)).toBe(100);
      expect(tokenBilling.getTierAllocation(SubscriptionTier.PROFESSIONAL)).toBe(2000);
      expect(tokenBilling.getTierAllocation(SubscriptionTier.BUSINESS)).toBe(10000);
    });
  });

  describe('getTierPrice', () => {
    it('should return correct price for each tier', () => {
      expect(tokenBilling.getTierPrice(SubscriptionTier.GIFT)).toBeNull();
      expect(tokenBilling.getTierPrice(SubscriptionTier.PROFESSIONAL)).toBe(1990);
      expect(tokenBilling.getTierPrice(SubscriptionTier.BUSINESS)).toBe(3490);
    });
  });

  describe('getBalance', () => {
    it('should return user balance', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 150, tokensSpent: 50 });

      const balance = await tokenBilling.getBalance('user-1');

      expect(balance).toEqual({ tokensBalance: 150, tokensSpent: 50 });
    });

    it('should return null for non-existent user', async () => {
      const balance = await tokenBilling.getBalance('nonexistent');

      expect(balance).toBeNull();
    });
  });

  describe('canAffordOperation', () => {
    it('should return detailed affordability info when can afford', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 100, tokensSpent: 0 });

      const result = await tokenBilling.canAffordOperation('user-1', OperationType.CHATGPT_MESSAGE);

      expect(result.canAfford).toBe(true);
      expect(result.balance).toBe(100);
      expect(result.cost).toBe(5);
      expect(result.deficit).toBeUndefined();
    });

    it('should return detailed affordability info when cannot afford', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 3, tokensSpent: 0 });

      const result = await tokenBilling.canAffordOperation('user-1', OperationType.CHATGPT_MESSAGE);

      expect(result.canAfford).toBe(false);
      expect(result.balance).toBe(3);
      expect(result.cost).toBe(5);
      expect(result.deficit).toBe(2);
    });

    it('should handle non-existent user', async () => {
      const result = await tokenBilling.canAffordOperation('nonexistent', OperationType.CHATGPT_MESSAGE);

      expect(result.canAfford).toBe(false);
      expect(result.balance).toBe(0);
      expect(result.cost).toBe(5);
      expect(result.deficit).toBe(5);
    });
  });

  describe('estimateOperations', () => {
    it('should estimate number of operations possible', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 100, tokensSpent: 0 });

      const chatMessages = await tokenBilling.estimateOperations('user-1', OperationType.CHATGPT_MESSAGE);
      const images = await tokenBilling.estimateOperations('user-1', OperationType.IMAGE_GENERATION);

      expect(chatMessages).toBe(20);
      expect(images).toBe(10);
    });

    it('should return 0 for insufficient balance', async () => {
      await userCache.setTokenBalance('user-1', { tokensBalance: 3, tokensSpent: 0 });

      const images = await tokenBilling.estimateOperations('user-1', OperationType.IMAGE_GENERATION);

      expect(images).toBe(0);
    });

    it('should return 0 for non-existent user', async () => {
      const operations = await tokenBilling.estimateOperations('nonexistent', OperationType.CHATGPT_MESSAGE);

      expect(operations).toBe(0);
    });
  });
});
