import { PrismaClient, OperationType } from '@monorepo/database';
import { TokenLedger } from '../token-ledger';

// Mock PrismaClient
jest.mock('@monorepo/database', () => {
  const mockPrismaClient = {
    tokenOperation: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
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

describe('TokenLedger', () => {
  let prisma: PrismaClient;
  let ledger: TokenLedger;

  const mockUserId = 'user-123';
  const mockLedgerEntryId = 'ledger-456';

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
    ledger = new TokenLedger(prisma);
  });

  describe('createEntry', () => {
    it('should create a ledger entry', async () => {
      const mockEntry = {
        id: mockLedgerEntryId,
        userId: mockUserId,
        operationType: 'image_generation' as OperationType,
        tokensAmount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        createdAt: new Date(),
        metadata: { test: 'data' },
      };

      (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockEntry);

      const result = await ledger.createEntry(
        mockUserId,
        'image_generation',
        -10,
        100,
        90,
        { test: 'data' }
      );

      expect(result).toEqual({
        id: mockLedgerEntryId,
        userId: mockUserId,
        operationType: 'image_generation',
        tokensAmount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        createdAt: mockEntry.createdAt,
        metadata: { test: 'data' },
      });

      expect(prisma.tokenOperation.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          operationType: 'image_generation',
          tokensAmount: -10,
          balanceBefore: 100,
          balanceAfter: 90,
          metadata: { test: 'data' },
        },
      });
    });

    it('should create entry without metadata', async () => {
      const mockEntry = {
        id: mockLedgerEntryId,
        userId: mockUserId,
        operationType: 'image_generation' as OperationType,
        tokensAmount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        createdAt: new Date(),
        metadata: null,
      };

      (prisma.tokenOperation.create as jest.Mock).mockResolvedValue(mockEntry);

      const result = await ledger.createEntry(
        mockUserId,
        'image_generation',
        -10,
        100,
        90
      );

      // Null metadata becomes undefined in the mapping
      expect(result.metadata).toBeUndefined();
      
      expect(prisma.tokenOperation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: undefined,
        }),
      });
    });
  });

  describe('getUserEntries', () => {
    it('should retrieve user entries with default options', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          userId: mockUserId,
          operationType: 'image_generation' as OperationType,
          tokensAmount: -10,
          balanceBefore: 100,
          balanceAfter: 90,
          createdAt: new Date(),
          metadata: null,
        },
        {
          id: 'entry-2',
          userId: mockUserId,
          operationType: 'chatgpt_message' as OperationType,
          tokensAmount: -5,
          balanceBefore: 90,
          balanceAfter: 85,
          createdAt: new Date(),
          metadata: null,
        },
      ];

      (prisma.tokenOperation.findMany as jest.Mock).mockResolvedValue(mockEntries);

      const result = await ledger.getUserEntries(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].operationType).toBe('image_generation');
      expect(result[1].operationType).toBe('chatgpt_message');
    });

    it('should filter by operation type', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          userId: mockUserId,
          operationType: 'image_generation' as OperationType,
          tokensAmount: -10,
          balanceBefore: 100,
          balanceAfter: 90,
          createdAt: new Date(),
          metadata: null,
        },
      ];

      (prisma.tokenOperation.findMany as jest.Mock).mockResolvedValue(mockEntries);

      await ledger.getUserEntries(mockUserId, {
        operationType: 'image_generation',
      });

      expect(prisma.tokenOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            operationType: 'image_generation',
          }),
        })
      );
    });

    it('should support pagination', async () => {
      (prisma.tokenOperation.findMany as jest.Mock).mockResolvedValue([]);

      await ledger.getUserEntries(mockUserId, {
        limit: 10,
        offset: 20,
      });

      expect(prisma.tokenOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (prisma.tokenOperation.findMany as jest.Mock).mockResolvedValue([]);

      await ledger.getUserEntries(mockUserId, {
        startDate,
        endDate,
      });

      expect(prisma.tokenOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });
  });

  describe('getEntriesByType', () => {
    it('should retrieve entries by operation type', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          userId: 'user-1',
          operationType: 'image_generation' as OperationType,
          tokensAmount: -10,
          balanceBefore: 100,
          balanceAfter: 90,
          createdAt: new Date(),
          metadata: null,
        },
      ];

      (prisma.tokenOperation.findMany as jest.Mock).mockResolvedValue(mockEntries);

      const result = await ledger.getEntriesByType('image_generation');

      expect(result).toHaveLength(1);
      expect(result[0].operationType).toBe('image_generation');
    });
  });

  describe('getTotalSpent', () => {
    it('should calculate total tokens spent', async () => {
      (prisma.tokenOperation.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          tokensAmount: -50, // Negative amounts are debits
        },
      });

      const result = await ledger.getTotalSpent(mockUserId);

      expect(result).toBe(50); // Absolute value
      expect(prisma.tokenOperation.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            tokensAmount: { lt: 0 },
          }),
        })
      );
    });

    it('should return 0 when no operations found', async () => {
      (prisma.tokenOperation.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          tokensAmount: null,
        },
      });

      const result = await ledger.getTotalSpent(mockUserId);

      expect(result).toBe(0);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (prisma.tokenOperation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { tokensAmount: -25 },
      });

      await ledger.getTotalSpent(mockUserId, startDate, endDate);

      expect(prisma.tokenOperation.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });
  });

  describe('getTotalEarned', () => {
    it('should calculate total tokens earned', async () => {
      (prisma.tokenOperation.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          tokensAmount: 100, // Positive amounts are credits
        },
      });

      const result = await ledger.getTotalEarned(mockUserId);

      expect(result).toBe(100);
      expect(prisma.tokenOperation.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            tokensAmount: { gt: 0 },
          }),
        })
      );
    });

    it('should return 0 when no operations found', async () => {
      (prisma.tokenOperation.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          tokensAmount: null,
        },
      });

      const result = await ledger.getTotalEarned(mockUserId);

      expect(result).toBe(0);
    });
  });

  describe('getUserStatistics', () => {
    it('should return aggregate statistics', async () => {
      // Mock getTotalSpent
      (prisma.tokenOperation.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { tokensAmount: -50 } }) // spent
        .mockResolvedValueOnce({ _sum: { tokensAmount: 100 } }); // earned

      // Mock count
      (prisma.tokenOperation.count as jest.Mock).mockResolvedValue(15);

      const result = await ledger.getUserStatistics(mockUserId);

      expect(result).toEqual({
        totalSpent: 50,
        totalEarned: 100,
        netChange: 50, // 100 - 50
        operationCount: 15,
      });
    });

    it('should handle date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (prisma.tokenOperation.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { tokensAmount: -25 } })
        .mockResolvedValueOnce({ _sum: { tokensAmount: 50 } });

      (prisma.tokenOperation.count as jest.Mock).mockResolvedValue(8);

      const result = await ledger.getUserStatistics(
        mockUserId,
        startDate,
        endDate
      );

      expect(result).toEqual({
        totalSpent: 25,
        totalEarned: 50,
        netChange: 25,
        operationCount: 8,
      });
    });
  });

  describe('deleteOldEntries', () => {
    it('should delete entries older than specified date', async () => {
      const olderThan = new Date('2023-01-01');

      (prisma.tokenOperation.deleteMany as jest.Mock).mockResolvedValue({
        count: 42,
      });

      const result = await ledger.deleteOldEntries(olderThan);

      expect(result).toBe(42);
      expect(prisma.tokenOperation.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: olderThan,
          },
        },
      });
    });
  });
});
