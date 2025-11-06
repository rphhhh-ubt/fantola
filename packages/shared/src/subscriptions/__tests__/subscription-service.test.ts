import { PrismaClient, SubscriptionTier } from '@monorepo/database';
import { SubscriptionService } from '../subscription-service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SubscriptionStatus } from './types';

jest.mock('@monorepo/database', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    subscriptionHistory: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaClient)),
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    SubscriptionTier: {
      Gift: 'Gift',
      Professional: 'Professional',
      Business: 'Business',
    },
  };
});

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockDb: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new SubscriptionService(mockDb);
  });

  describe('getStatus', () => {
    it('should return subscription status for active paid tier', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const mockUser = {
        id: 'user-123',
        tier: SubscriptionTier.Professional,
        subscriptionExpiresAt: futureDate,
        autoRenew: true,
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser as any);

      const status = await service.getStatus('user-123');

      expect(status.userId).toBe('user-123');
      expect(status.tier).toBe(SubscriptionTier.Professional);
      expect(status.isActive).toBe(true);
      expect(status.autoRenew).toBe(true);
      expect(status.daysRemaining).toBeGreaterThan(0);
    });

    it('should return subscription status for expired tier', async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const mockUser = {
        id: 'user-123',
        tier: SubscriptionTier.Professional,
        subscriptionExpiresAt: pastDate,
        autoRenew: false,
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser as any);

      const status = await service.getStatus('user-123');

      expect(status.isActive).toBe(false);
      expect(status.daysRemaining).toBeLessThan(0);
    });

    it('should return status for Gift tier as always active', async () => {
      const mockUser = {
        id: 'user-123',
        tier: SubscriptionTier.Gift,
        subscriptionExpiresAt: null,
        autoRenew: false,
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser as any);

      const status = await service.getStatus('user-123');

      expect(status.tier).toBe(SubscriptionTier.Gift);
      expect(status.isActive).toBe(true);
      expect(status.expiresAt).toBeNull();
    });

    it('should throw error if user not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('user-123')).rejects.toThrow('User not found');
    });
  });

  describe('activateSubscription', () => {
    it('should activate subscription successfully', async () => {
      const mockUser = {
        id: 'user-123',
        tier: SubscriptionTier.Gift,
      };

      const mockUpdatedUser = {
        id: 'user-123',
        tier: SubscriptionTier.Professional,
        subscriptionExpiresAt: expect.any(Date),
        autoRenew: true,
      };

      const mockHistoryEntry = {
        id: 'history-123',
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser as any);
      mockDb.user.update.mockResolvedValue(mockUpdatedUser as any);
      mockDb.subscriptionHistory.create.mockResolvedValue(mockHistoryEntry as any);

      const result = await service.activateSubscription({
        userId: 'user-123',
        tier: SubscriptionTier.Professional,
        durationDays: 30,
        autoRenew: true,
        priceRubles: 1990,
        paymentMethod: 'yookassa',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status?.tier).toBe(SubscriptionTier.Professional);
      expect(result.historyId).toBe('history-123');
    });

    it('should call onActivation hook if provided', async () => {
      const onActivation = jest.fn();
      const mockUser = {
        id: 'user-123',
        tier: SubscriptionTier.Gift,
      };

      const now = new Date();
      const mockUpdatedUser = {
        id: 'user-123',
        tier: SubscriptionTier.Professional,
        subscriptionExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true,
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser as any);
      mockDb.user.update.mockResolvedValue(mockUpdatedUser as any);
      mockDb.subscriptionHistory.create.mockResolvedValue({ id: 'history-123' } as any);

      const result = await service.activateSubscription({
        userId: 'user-123',
        tier: SubscriptionTier.Professional,
        durationDays: 30,
        onActivation,
      });

      expect(result.success).toBe(true);
      expect(onActivation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          tier: SubscriptionTier.Professional,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockDb.user.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.activateSubscription({
        userId: 'user-123',
        tier: SubscriptionTier.Professional,
        durationDays: 30,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription without immediate downgrade', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const mockUser = {
        id: 'user-123',
        tier: SubscriptionTier.Professional,
        subscriptionExpiresAt: futureDate,
        autoRenew: true,
      };

      const mockUpdatedUser = {
        ...mockUser,
        autoRenew: false,
      };

      const mockHistory = {
        id: 'history-123',
        userId: 'user-123',
        canceledAt: null,
        metadata: null,
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser as any);
      mockDb.user.update.mockResolvedValue(mockUpdatedUser as any);
      mockDb.subscriptionHistory.findFirst.mockResolvedValue(mockHistory as any);
      mockDb.subscriptionHistory.update.mockResolvedValue({} as any);

      const result = await service.cancelSubscription({
        userId: 'user-123',
        reason: 'Too expensive',
        immediate: false,
      });

      expect(result.success).toBe(true);
      expect(result.status?.tier).toBe(SubscriptionTier.Professional);
      expect(result.status?.autoRenew).toBe(false);
      expect(result.status?.isActive).toBe(true);
    });

    it('should immediately downgrade to Gift tier when immediate=true', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const mockUser = {
        id: 'user-123',
        tier: SubscriptionTier.Professional,
        subscriptionExpiresAt: futureDate,
        autoRenew: true,
      };

      const mockUpdatedUser = {
        id: 'user-123',
        tier: SubscriptionTier.Gift,
        subscriptionExpiresAt: null,
        autoRenew: false,
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser as any);
      mockDb.user.update.mockResolvedValue(mockUpdatedUser as any);
      mockDb.subscriptionHistory.findFirst.mockResolvedValue({
        id: 'history-123',
        canceledAt: null,
      } as any);
      mockDb.subscriptionHistory.update.mockResolvedValue({} as any);

      const result = await service.cancelSubscription({
        userId: 'user-123',
        immediate: true,
      });

      expect(result.success).toBe(true);
      expect(result.status?.tier).toBe(SubscriptionTier.Gift);
      expect(result.status?.autoRenew).toBe(false);
    });

    it('should call onCancellation hook if provided', async () => {
      const onCancellation = jest.fn();
      const mockUser = {
        id: 'user-123',
        tier: SubscriptionTier.Professional,
        subscriptionExpiresAt: new Date(),
        autoRenew: true,
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser as any);
      mockDb.user.update.mockResolvedValue({ ...mockUser, autoRenew: false } as any);
      mockDb.subscriptionHistory.findFirst.mockResolvedValue(null);

      const result = await service.cancelSubscription({
        userId: 'user-123',
        onCancellation,
      });

      expect(result.success).toBe(true);
      expect(onCancellation).toHaveBeenCalled();
    });
  });

  describe('checkExpiredSubscriptions', () => {
    it('should process expired subscriptions', async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const expiredUsers = [
        {
          id: 'user-1',
          tier: SubscriptionTier.Professional,
          subscriptionExpiresAt: pastDate,
        },
        {
          id: 'user-2',
          tier: SubscriptionTier.Business,
          subscriptionExpiresAt: pastDate,
        },
      ];

      mockDb.user.findMany.mockResolvedValue(expiredUsers as any);
      mockDb.user.update.mockResolvedValue({} as any);

      const result = await service.checkExpiredSubscriptions({ limit: 10 });

      expect(result.totalChecked).toBe(2);
      expect(result.totalExpired).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].wasExpired).toBe(true);
      expect(result.results[0].previousTier).toBe(SubscriptionTier.Professional);
      expect(result.results[0].newTier).toBe(SubscriptionTier.Gift);
    });

    it('should not process Gift tier users', async () => {
      mockDb.user.findMany.mockResolvedValue([]);

      const result = await service.checkExpiredSubscriptions();

      expect(result.totalChecked).toBe(0);
      expect(result.totalExpired).toBe(0);
    });

    it('should call onExpiration hook for each expired subscription', async () => {
      const onExpiration = jest.fn();
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const expiredUsers = [
        {
          id: 'user-1',
          tier: SubscriptionTier.Professional,
          subscriptionExpiresAt: pastDate,
        },
      ];

      mockDb.user.findMany.mockResolvedValue(expiredUsers as any);
      mockDb.user.update.mockResolvedValue({} as any);

      const result = await service.checkExpiredSubscriptions({ onExpiration });

      expect(onExpiration).toHaveBeenCalledTimes(1);
      expect(result.results[0].notified).toBe(true);
    });
  });
});
