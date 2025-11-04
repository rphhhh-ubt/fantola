import { PrismaClient, SubscriptionTier } from '@monorepo/database';
import { MonthlyRenewalService } from '../monthly-renewal';

// Mock PrismaClient
jest.mock('@monorepo/database', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tokenOperation: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
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

describe('MonthlyRenewalService', () => {
  let prisma: PrismaClient;
  let renewalService: MonthlyRenewalService;

  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
    renewalService = new MonthlyRenewalService(prisma);
  });

  describe('checkEligibility', () => {
    it('should return eligible for user who never renewed', async () => {
      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: null,
        subscriptionExpiresAt: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await renewalService.checkEligibility(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        eligible: true,
      });
    });

    it('should return eligible when 30+ days since last renewal', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: thirtyOneDaysAgo,
        subscriptionExpiresAt: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await renewalService.checkEligibility(mockUserId);

      expect(result.eligible).toBe(true);
    });

    it('should return not eligible when less than 30 days since renewal', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: tenDaysAgo,
        subscriptionExpiresAt: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await renewalService.checkEligibility(mockUserId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Next renewal in 20 days');
      expect(result.daysUntilRenewal).toBe(20);
      expect(result.nextRenewalDate).toBeDefined();
    });

    it('should return not eligible for expired paid subscription', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Professional,
        lastGiftClaimAt: null,
        subscriptionExpiresAt: yesterday,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await renewalService.checkEligibility(mockUserId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Subscription expired');
    });

    it('should return eligible for active paid subscription', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Professional,
        lastGiftClaimAt: null,
        subscriptionExpiresAt: tomorrow,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await renewalService.checkEligibility(mockUserId);

      expect(result.eligible).toBe(true);
    });

    it('should return not eligible for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await renewalService.checkEligibility(mockUserId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('User not found');
    });
  });

  describe('renewUser', () => {
    it('should successfully renew eligible Gift tier user', async () => {
      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: null,
        subscriptionExpiresAt: null,
        tokensBalance: 50,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.tokenOperation.create as jest.Mock).mockResolvedValue({});

      const result = await renewalService.renewUser(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        tier: SubscriptionTier.Gift,
        tokensAdded: 100,
        newBalance: 150,
        previousBalance: 50,
        renewalDate: expect.any(Date),
        success: true,
      });
    });

    it('should successfully renew Professional tier user', async () => {
      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Professional,
        lastGiftClaimAt: null,
        subscriptionExpiresAt: new Date('2025-12-31'),
        tokensBalance: 100,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await renewalService.renewUser(mockUserId);

      expect(result.success).toBe(true);
      expect(result.tokensAdded).toBe(2000);
      expect(result.newBalance).toBe(2100);
    });

    it('should successfully renew Business tier user', async () => {
      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Business,
        lastGiftClaimAt: null,
        subscriptionExpiresAt: new Date('2025-12-31'),
        tokensBalance: 500,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await renewalService.renewUser(mockUserId);

      expect(result.success).toBe(true);
      expect(result.tokensAdded).toBe(10000);
      expect(result.newBalance).toBe(10500);
    });

    it('should fail renewal for ineligible user', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: tenDaysAgo,
        subscriptionExpiresAt: null,
        tokensBalance: 50,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await renewalService.renewUser(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Next renewal in');
    });

    it('should fail renewal for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await renewalService.renewUser(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should create ledger entry with metadata', async () => {
      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: null,
        subscriptionExpiresAt: null,
        tokensBalance: 50,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      await renewalService.renewUser(mockUserId);

      expect(prisma.tokenOperation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          operationType: 'monthly_reset',
          tokensAmount: 100,
          metadata: {
            tier: SubscriptionTier.Gift,
            renewalType: 'monthly',
          },
        }),
      });
    });

    it('should update lastGiftClaimAt timestamp', async () => {
      const mockUser = {
        id: mockUserId,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: null,
        subscriptionExpiresAt: null,
        tokensBalance: 50,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      await renewalService.renewUser(mockUserId);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: expect.objectContaining({
          lastGiftClaimAt: expect.any(Date),
        }),
      });
    });
  });

  describe('renewAllEligible', () => {
    it('should renew all eligible users', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: null,
        },
        {
          id: 'user-2',
          tier: SubscriptionTier.Professional,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: new Date('2025-12-31'),
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockUsers[0], tokensBalance: 50 })
        .mockResolvedValueOnce({ ...mockUsers[0], tokensBalance: 50 })
        .mockResolvedValueOnce({ ...mockUsers[1], tokensBalance: 100 })
        .mockResolvedValueOnce({ ...mockUsers[1], tokensBalance: 100 });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await renewalService.renewAllEligible();

      expect(result.totalProcessed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.renewals).toHaveLength(2);
    });

    it('should filter by tier', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await renewalService.renewAllEligible({
        tier: SubscriptionTier.Gift,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tier: SubscriptionTier.Gift },
        })
      );
    });

    it('should support limit option', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await renewalService.renewAllEligible({ limit: 100 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('should support dry run mode', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: null,
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUsers[0],
        tokensBalance: 50,
      });

      const result = await renewalService.renewAllEligible({ dryRun: true });

      expect(result.successful).toBe(1);
      expect(result.renewals[0].tokensAdded).toBe(100);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should continue on error when continueOnError is true', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: null,
        },
        {
          id: 'user-2',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: null,
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      
      // Mock sequence: checkEligibility for user-1, renewUser for user-1, checkEligibility for user-2, renewUser for user-2
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUsers[0]) // checkEligibility user-1
        .mockResolvedValueOnce(null) // renewUser user-1 fails - user not found
        .mockResolvedValueOnce(mockUsers[1]) // checkEligibility user-2
        .mockResolvedValueOnce({ ...mockUsers[1], tokensBalance: 50 }) // renewUser user-2
        .mockResolvedValueOnce({ ...mockUsers[1], tokensBalance: 50 }); // renewUser user-2 transaction

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await renewalService.renewAllEligible({
        continueOnError: true,
      });

      expect(result.totalProcessed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should stop on first error when continueOnError is false', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: null,
        },
        {
          id: 'user-2',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: null,
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      
      // Mock sequence: checkEligibility for user-1, renewUser for user-1 (fails)
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUsers[0]) // checkEligibility user-1
        .mockResolvedValueOnce(null); // renewUser user-1 fails

      const result = await renewalService.renewAllEligible({
        continueOnError: false,
      });

      expect(result.failed).toBe(1);
      expect(result.successful).toBe(0);
    });

    it('should skip ineligible users', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const mockUsers = [
        {
          id: 'user-1',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: tenDaysAgo, // Ineligible
          subscriptionExpiresAt: null,
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUsers[0]);

      const result = await renewalService.renewAllEligible();

      expect(result.totalProcessed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.renewals).toHaveLength(0);
    });
  });

  describe('getUsersDueForRenewal', () => {
    it('should return list of eligible user IDs', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: null,
        },
        {
          id: 'user-2',
          tier: SubscriptionTier.Gift,
          lastGiftClaimAt: null,
          subscriptionExpiresAt: null,
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUsers[0])
        .mockResolvedValueOnce(mockUsers[1]);

      const result = await renewalService.getUsersDueForRenewal();

      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('should filter by tier', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await renewalService.getUsersDueForRenewal(SubscriptionTier.Professional);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tier: SubscriptionTier.Professional },
        })
      );
    });
  });

  describe('getCronExpression', () => {
    it('should return daily cron expression', () => {
      const cron = renewalService.getCronExpression();

      expect(cron).toBe('0 2 * * *'); // 2 AM UTC daily
    });
  });
});
