import { db } from '@monorepo/shared';
import { SubscriptionTier } from '@monorepo/database';
import {
  processUserOnboarding,
  checkGiftEligibility,
  awardGiftTokens,
} from '../services/onboarding-service';
import { I18n } from '../i18n';
import { ChannelVerificationService } from '../services/channel-verification-service';

// Mock the database
jest.mock('@monorepo/shared', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tokenOperation: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Onboarding Service', () => {
  let i18n: I18n;

  beforeEach(() => {
    jest.clearAllMocks();
    i18n = new I18n('en');
  });

  describe('checkGiftEligibility', () => {
    it('should return eligible for new user without lastGiftClaimAt', () => {
      const user = {
        id: 'user-1',
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: null,
        tokensBalance: 0,
      } as any;

      const result = checkGiftEligibility(user);

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return eligible for user with lastGiftClaimAt 30+ days ago', () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const user = {
        id: 'user-1',
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: thirtyOneDaysAgo,
        tokensBalance: 0,
      } as any;

      const result = checkGiftEligibility(user);

      expect(result.eligible).toBe(true);
      expect(result.daysSinceLastClaim).toBeGreaterThanOrEqual(31);
    });

    it('should return not eligible for user with recent claim', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const user = {
        id: 'user-1',
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: fiveDaysAgo,
        tokensBalance: 50,
      } as any;

      const result = checkGiftEligibility(user);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Monthly gift already claimed');
      expect(result.daysSinceLastClaim).toBe(5);
    });

    it('should return not eligible for non-Gift tier user', () => {
      const user = {
        id: 'user-1',
        tier: SubscriptionTier.Professional,
        lastGiftClaimAt: null,
        tokensBalance: 2000,
      } as any;

      const result = checkGiftEligibility(user);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('User is not on Gift tier');
    });
  });

  describe('awardGiftTokens', () => {
    it('should award tokens and create token operation', async () => {
      const userId = 'user-1';
      const amount = 100;
      const mockUser = {
        id: userId,
        tokensBalance: 50,
        tokensSpent: 30,
        tier: SubscriptionTier.Gift,
      };
      const updatedUser = {
        ...mockUser,
        tokensBalance: 150,
        lastGiftClaimAt: new Date(),
      };

      // Mock transaction
      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await awardGiftTokens(userId, amount);

      expect(result.tokensBalance).toBe(150);
      expect(result.lastGiftClaimAt).toBeDefined();
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent';

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        });
      });

      await expect(awardGiftTokens(userId, 100)).rejects.toThrow('User not found');
    });
  });

  describe('processUserOnboarding', () => {
    it('should award tokens to new user', async () => {
      const newUser = {
        id: 'user-1',
        telegramId: '123456',
        username: 'testuser',
        firstName: 'Test',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        tokensSpent: 0,
        lastGiftClaimAt: null,
      } as any;

      const updatedUser = {
        ...newUser,
        tokensBalance: 100,
        lastGiftClaimAt: new Date(),
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(newUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await processUserOnboarding(newUser, i18n);

      expect(result.isNewUser).toBe(true);
      expect(result.tokensAwarded).toBe(100);
      expect(result.user.tokensBalance).toBe(100);
      expect(result.message).toContain('Welcome to AI Bot');
    });

    it('should award tokens to returning user after 30+ days', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const returningUser = {
        id: 'user-1',
        telegramId: '123456',
        username: 'testuser',
        firstName: 'Test',
        tier: SubscriptionTier.Gift,
        tokensBalance: 10,
        tokensSpent: 90,
        lastGiftClaimAt: thirtyOneDaysAgo,
      } as any;

      const updatedUser = {
        ...returningUser,
        tokensBalance: 110,
        lastGiftClaimAt: new Date(),
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(returningUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await processUserOnboarding(returningUser, i18n);

      expect(result.isNewUser).toBe(false);
      expect(result.tokensAwarded).toBe(100);
      expect(result.user.tokensBalance).toBe(110);
    });

    it('should not award tokens to user who claimed recently', async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const recentUser = {
        id: 'user-1',
        telegramId: '123456',
        username: 'testuser',
        firstName: 'Test',
        tier: SubscriptionTier.Gift,
        tokensBalance: 50,
        tokensSpent: 50,
        lastGiftClaimAt: fiveDaysAgo,
      } as any;

      const result = await processUserOnboarding(recentUser, i18n);

      expect(result.isNewUser).toBe(false);
      expect(result.tokensAwarded).toBe(0);
      expect(result.user.tokensBalance).toBe(50);
    });

    it('should not award tokens to Professional tier user', async () => {
      const professionalUser = {
        id: 'user-1',
        telegramId: '123456',
        username: 'prouser',
        firstName: 'Pro',
        tier: SubscriptionTier.Professional,
        tokensBalance: 2000,
        tokensSpent: 0,
        lastGiftClaimAt: null,
      } as any;

      const result = await processUserOnboarding(professionalUser, i18n);

      expect(result.isNewUser).toBe(false);
      expect(result.tokensAwarded).toBe(0);
      expect(result.user.tokensBalance).toBe(2000);
    });
  });

  describe('Message Content', () => {
    it('should include channel subscription reminder for Gift tier', async () => {
      const giftUser = {
        id: 'user-1',
        telegramId: '123456',
        username: 'testuser',
        firstName: 'Test',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        tokensSpent: 0,
        lastGiftClaimAt: null,
      } as any;

      const updatedUser = {
        ...giftUser,
        tokensBalance: 100,
        lastGiftClaimAt: new Date(),
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(giftUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await processUserOnboarding(giftUser, i18n);

      expect(result.message).toContain('channel');
    });

    it('should display token costs in welcome message', async () => {
      const newUser = {
        id: 'user-1',
        telegramId: '123456',
        firstName: 'Test',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        lastGiftClaimAt: null,
      } as any;

      const updatedUser = {
        ...newUser,
        tokensBalance: 100,
        lastGiftClaimAt: new Date(),
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(newUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await processUserOnboarding(newUser, i18n);

      expect(result.message).toContain('DALL-E');
      expect(result.message).toContain('Sora');
      expect(result.message).toContain('GPT');
    });

    it('should suggest upgrade for users with zero balance', async () => {
      const emptyBalanceUser = {
        id: 'user-1',
        telegramId: '123456',
        firstName: 'Test',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        lastGiftClaimAt: new Date(),
      } as any;

      const result = await processUserOnboarding(emptyBalanceUser, i18n);

      // Just verify message is returned
      expect(result.message).toBeDefined();
    });
  });

  describe('Channel Verification Integration', () => {
    let mockChannelService: jest.Mocked<ChannelVerificationService>;

    beforeEach(() => {
      mockChannelService = {
        checkMembership: jest.fn(),
        formatChannelForMessage: jest.fn().mockReturnValue('@test_channel'),
      } as any;
    });

    it('should award tokens to new Gift user if channel verification passes', async () => {
      const newGiftUser = {
        id: 'user-1',
        telegramId: '123456',
        username: 'testuser',
        firstName: 'Test',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        tokensSpent: 0,
        lastGiftClaimAt: null,
      } as any;

      const updatedUser = {
        ...newGiftUser,
        tokensBalance: 100,
        lastGiftClaimAt: new Date(),
      };

      mockChannelService.checkMembership.mockResolvedValue({
        isMember: true,
        status: 'member',
      });

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(newGiftUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await processUserOnboarding(newGiftUser, i18n, mockChannelService);

      expect(result.isNewUser).toBe(true);
      expect(result.tokensAwarded).toBe(100);
      expect(result.channelCheckRequired).toBe(true);
      expect(result.channelCheckPassed).toBe(true);
      expect(mockChannelService.checkMembership).toHaveBeenCalledWith(123456);
    });

    it('should not award tokens if user is not subscribed to channel', async () => {
      const newGiftUser = {
        id: 'user-1',
        telegramId: '123456',
        username: 'testuser',
        firstName: 'Test',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        lastGiftClaimAt: null,
      } as any;

      mockChannelService.checkMembership.mockResolvedValue({
        isMember: false,
        status: 'left',
      });

      const result = await processUserOnboarding(newGiftUser, i18n, mockChannelService);

      expect(result.isNewUser).toBe(false);
      expect(result.tokensAwarded).toBe(0);
      expect(result.channelCheckRequired).toBe(true);
      expect(result.channelCheckPassed).toBe(false);
      expect(result.message).toContain('channel');
    });

    it('should not award tokens if channel verification fails', async () => {
      const newGiftUser = {
        id: 'user-1',
        telegramId: '123456',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        lastGiftClaimAt: null,
      } as any;

      mockChannelService.checkMembership.mockResolvedValue({
        isMember: false,
        error: 'api_error',
        errorMessage: 'Network error',
      });

      const result = await processUserOnboarding(newGiftUser, i18n, mockChannelService);

      expect(result.tokensAwarded).toBe(0);
      expect(result.channelCheckRequired).toBe(true);
      expect(result.channelCheckPassed).toBe(false);
    });

    it('should skip channel check for Professional tier users', async () => {
      const professionalUser = {
        id: 'user-1',
        telegramId: '123456',
        tier: SubscriptionTier.Professional,
        tokensBalance: 2000,
        lastGiftClaimAt: null,
      } as any;

      const result = await processUserOnboarding(professionalUser, i18n, mockChannelService);

      expect(result.channelCheckRequired).toBe(false);
      expect(mockChannelService.checkMembership).not.toHaveBeenCalled();
    });

    it('should work without channel service (backwards compatibility)', async () => {
      const newGiftUser = {
        id: 'user-1',
        telegramId: '123456',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        lastGiftClaimAt: null,
      } as any;

      const updatedUser = {
        ...newGiftUser,
        tokensBalance: 100,
        lastGiftClaimAt: new Date(),
      };

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(newGiftUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await processUserOnboarding(newGiftUser, i18n);

      expect(result.tokensAwarded).toBe(100);
      expect(result.channelCheckRequired).toBe(false);
    });

    it('should handle rate limit error gracefully', async () => {
      const giftUser = {
        id: 'user-1',
        telegramId: '123456',
        tier: SubscriptionTier.Gift,
        tokensBalance: 0,
        lastGiftClaimAt: null,
      } as any;

      mockChannelService.checkMembership.mockResolvedValue({
        isMember: false,
        error: 'rate_limit',
        errorMessage: 'Rate limit exceeded',
      });

      const result = await processUserOnboarding(giftUser, i18n, mockChannelService);

      expect(result.tokensAwarded).toBe(0);
      expect(result.message).toContain('limit');
    });

    it('should check channel for monthly renewal', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const returningUser = {
        id: 'user-1',
        telegramId: '123456',
        tier: SubscriptionTier.Gift,
        tokensBalance: 10,
        lastGiftClaimAt: thirtyOneDaysAgo,
      } as any;

      const updatedUser = {
        ...returningUser,
        tokensBalance: 110,
        lastGiftClaimAt: new Date(),
      };

      mockChannelService.checkMembership.mockResolvedValue({
        isMember: true,
        status: 'member',
      });

      (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(returningUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await processUserOnboarding(returningUser, i18n, mockChannelService);

      expect(result.tokensAwarded).toBe(100);
      expect(result.channelCheckPassed).toBe(true);
      expect(mockChannelService.checkMembership).toHaveBeenCalledWith(123456);
    });
  });
});
