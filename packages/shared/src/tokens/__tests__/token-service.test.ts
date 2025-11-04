import { PrismaClient, SubscriptionTier } from '@monorepo/database';
import { TokenService } from '../token-service';
import type { TokenMetrics } from '../types';

// Mock PrismaClient
jest.mock('@monorepo/database', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tokenOperation: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      deleteMany: jest.fn(),
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
    OperationType: {
      image_generation: 'image_generation',
      sora_image: 'sora_image',
      chatgpt_message: 'chatgpt_message',
      refund: 'refund',
      purchase: 'purchase',
      monthly_reset: 'monthly_reset',
    },
  };
});

describe('TokenService', () => {
  let prisma: PrismaClient;
  let tokenService: TokenService;
  let mockMetrics: jest.Mock<void, [TokenMetrics]>;
  let mockCacheInvalidation: jest.Mock<Promise<void>, [string]>;

  const mockUserId = 'user-123';
  const mockLedgerEntryId = 'ledger-456';

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
    mockMetrics = jest.fn();
    mockCacheInvalidation = jest.fn().mockResolvedValue(undefined);

    tokenService = new TokenService(prisma, {
      metricsCallback: mockMetrics,
      cacheInvalidationCallback: mockCacheInvalidation,
    });
  });

  describe('getBalance', () => {
    it('should return user balance', async () => {
      const mockUser = {
        id: mockUserId,
        tokensBalance: 100,
        tokensSpent: 50,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: new Date('2024-01-01'),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await tokenService.getBalance(mockUserId);

      expect(result).toEqual({
        userId: mockUserId,
        tokensBalance: 100,
        tokensSpent: 50,
        tier: SubscriptionTier.Gift,
        lastRenewalAt: mockUser.lastGiftClaimAt,
      });
    });

    it('should return null for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await tokenService.getBalance(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('debit', () => {
    it('should deduct tokens and create ledger entry', async () => {
      const mockUser = { tokensBalance: 100, tokensSpent: 20 };
      const mockLedgerEntry = { id: mockLedgerEntryId };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      const result = await tokenService.debit(mockUserId, {
        operationType: 'image_generation',
        amount: 10,
      });

      expect(result).toEqual({
        success: true,
        newBalance: 90,
        tokensSpent: 30,
        ledgerEntryId: mockLedgerEntryId,
      });

      expect(mockCacheInvalidation).toHaveBeenCalledWith(mockUserId);
      expect(mockMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'debit',
          userId: mockUserId,
          amount: 10,
          success: true,
        })
      );
    });

    it('should reject negative amounts', async () => {
      const result = await tokenService.debit(mockUserId, {
        operationType: 'image_generation',
        amount: -10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Debit amount must be positive');
    });

    it('should reject zero amounts', async () => {
      const result = await tokenService.debit(mockUserId, {
        operationType: 'image_generation',
        amount: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Debit amount must be positive');
    });

    it('should prevent overdraft by default', async () => {
      const mockUser = { tokensBalance: 5, tokensSpent: 20 };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        return callback(prisma);
      });

      const result = await tokenService.debit(mockUserId, {
        operationType: 'image_generation',
        amount: 10,
        allowOverdraft: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient tokens');
    });

    it('should allow overdraft when enabled', async () => {
      const mockUser = { tokensBalance: 5, tokensSpent: 20 };
      const mockLedgerEntry = { id: mockLedgerEntryId };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      const result = await tokenService.debit(mockUserId, {
        operationType: 'image_generation',
        amount: 10,
        allowOverdraft: true,
      });

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(-5);
      expect(result.tokensSpent).toBe(30);
    });

    it('should handle user not found error', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        return callback(prisma);
      });

      const result = await tokenService.debit(mockUserId, {
        operationType: 'image_generation',
        amount: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('credit', () => {
    it('should add tokens and create ledger entry', async () => {
      const mockUser = { tokensBalance: 100, tokensSpent: 20 };
      const mockLedgerEntry = { id: mockLedgerEntryId };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      const result = await tokenService.credit(mockUserId, {
        operationType: 'purchase',
        amount: 50,
      });

      expect(result).toEqual({
        success: true,
        newBalance: 150,
        tokensSpent: 20,
        ledgerEntryId: mockLedgerEntryId,
      });

      expect(mockCacheInvalidation).toHaveBeenCalledWith(mockUserId);
      expect(mockMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'credit',
          userId: mockUserId,
          amount: 50,
          success: true,
        })
      );
    });

    it('should reject negative amounts', async () => {
      const result = await tokenService.credit(mockUserId, {
        operationType: 'purchase',
        amount: -50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Credit amount must be positive');
    });

    it('should reject zero amounts', async () => {
      const result = await tokenService.credit(mockUserId, {
        operationType: 'purchase',
        amount: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Credit amount must be positive');
    });
  });

  describe('chargeForOperation', () => {
    it('should charge correct amount for image_generation', async () => {
      const mockUser = { tokensBalance: 100, tokensSpent: 20 };
      const mockLedgerEntry = { id: mockLedgerEntryId };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      const result = await tokenService.chargeForOperation(
        mockUserId,
        'image_generation'
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(90); // 100 - 10
    });

    it('should charge correct amount for chatgpt_message', async () => {
      const mockUser = { tokensBalance: 100, tokensSpent: 20 };
      const mockLedgerEntry = { id: mockLedgerEntryId };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      const result = await tokenService.chargeForOperation(
        mockUserId,
        'chatgpt_message'
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(95); // 100 - 5
    });

    it('should reject operations with zero cost', async () => {
      const result = await tokenService.chargeForOperation(mockUserId, 'refund');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation type does not have a cost');
    });
  });

  describe('canAfford', () => {
    it('should return true when user can afford operation', async () => {
      const mockUser = {
        id: mockUserId,
        tokensBalance: 100,
        tokensSpent: 50,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await tokenService.canAfford(mockUserId, 'image_generation');

      expect(result).toEqual({
        canAfford: true,
        balance: 100,
        cost: 10,
      });
    });

    it('should return false with deficit when user cannot afford', async () => {
      const mockUser = {
        id: mockUserId,
        tokensBalance: 5,
        tokensSpent: 50,
        tier: SubscriptionTier.Gift,
        lastGiftClaimAt: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await tokenService.canAfford(mockUserId, 'image_generation');

      expect(result).toEqual({
        canAfford: false,
        balance: 5,
        cost: 10,
        deficit: 5,
      });
    });

    it('should handle user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await tokenService.canAfford(mockUserId, 'image_generation');

      expect(result).toEqual({
        canAfford: false,
        balance: 0,
        cost: 10,
        deficit: 10,
      });
    });
  });

  describe('refund', () => {
    it('should add tokens with refund operation type', async () => {
      const mockUser = { tokensBalance: 100, tokensSpent: 20 };
      const mockLedgerEntry = { id: mockLedgerEntryId };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      const result = await tokenService.refund(mockUserId, 10, {
        reason: 'Generation failed',
      });

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(110);
    });
  });

  describe('resetBalance', () => {
    it('should reset balance to specified amount', async () => {
      const mockUser = { tokensBalance: 50, tokensSpent: 100 };
      const mockLedgerEntry = { id: mockLedgerEntryId };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      const result = await tokenService.resetBalance(mockUserId, 100);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(100);
    });

    it('should reject negative balance', async () => {
      const result = await tokenService.resetBalance(mockUserId, -10);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Balance cannot be negative');
    });

    it('should handle balance decrease', async () => {
      const mockUser = { tokensBalance: 100, tokensSpent: 50 };
      const mockLedgerEntry = { id: mockLedgerEntryId };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      const result = await tokenService.resetBalance(mockUserId, 50);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(50);
    });
  });

  describe('getOperationCost', () => {
    it('should return correct costs for operations', () => {
      expect(tokenService.getOperationCost('image_generation')).toBe(10);
      expect(tokenService.getOperationCost('sora_image')).toBe(10);
      expect(tokenService.getOperationCost('chatgpt_message')).toBe(5);
      expect(tokenService.getOperationCost('refund')).toBe(0);
    });
  });

  describe('transaction safety', () => {
    it('should rollback on transaction failure', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Transaction failed')
      );

      const result = await tokenService.debit(mockUserId, {
        operationType: 'image_generation',
        amount: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
      expect(mockMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Transaction failed',
        })
      );
    });
  });

  describe('metadata support', () => {
    it('should include metadata in ledger entry', async () => {
      const mockUser = { tokensBalance: 100, tokensSpent: 20 };
      const mockLedgerEntry = { id: mockLedgerEntryId };
      const metadata = { generationId: 'gen-123', model: 'dall-e-3' };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockLedgerEntry);

        return callback(prisma);
      });

      await tokenService.debit(mockUserId, {
        operationType: 'image_generation',
        amount: 10,
        metadata,
      });

      expect(prisma.tokenOperation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata,
        }),
      });
    });
  });
});
