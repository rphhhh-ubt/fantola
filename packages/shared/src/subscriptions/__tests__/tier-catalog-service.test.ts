import { PrismaClient, SubscriptionTier } from '@monorepo/database';
import { TierCatalogService } from '../tier-catalog-service';

jest.mock('@monorepo/database', () => {
  const mockPrismaClient = {
    subscriptionTierConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
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

describe('TierCatalogService', () => {
  let service: TierCatalogService;
  let mockDb: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new TierCatalogService(mockDb);
  });

  describe('getTierCatalog', () => {
    const mockTierConfigs = [
      {
        tier: SubscriptionTier.Gift,
        monthlyTokens: 100,
        priceRubles: null,
        requestsPerMinute: 10,
        burstPerSecond: 3,
        requiresChannel: true,
        description: 'Free tier',
        isActive: true,
        metadata: {
          features: ['DALL-E', 'ChatGPT'],
          limitations: ['Requires channel subscription'],
        },
      },
      {
        tier: SubscriptionTier.Professional,
        monthlyTokens: 2000,
        priceRubles: 1990,
        requestsPerMinute: 50,
        burstPerSecond: 10,
        requiresChannel: false,
        description: 'Professional tier',
        isActive: true,
        metadata: {
          features: ['All AI tools', 'Priority'],
        },
      },
      {
        tier: SubscriptionTier.Business,
        monthlyTokens: 10000,
        priceRubles: 3490,
        requestsPerMinute: 100,
        burstPerSecond: 20,
        requiresChannel: false,
        description: 'Business tier',
        isActive: false,
        metadata: {},
      },
    ];

    it('should return all active tiers by default', async () => {
      mockDb.subscriptionTierConfig.findMany.mockResolvedValue(
        mockTierConfigs.filter((t) => t.isActive) as any
      );

      const catalog = await service.getTierCatalog();

      expect(catalog).toHaveLength(2);
      expect(catalog[0].tier).toBe(SubscriptionTier.Gift);
      expect(catalog[0].features).toEqual(['DALL-E', 'ChatGPT']);
      expect(catalog[1].tier).toBe(SubscriptionTier.Professional);
    });

    it('should return all tiers including inactive when requested', async () => {
      mockDb.subscriptionTierConfig.findMany.mockResolvedValue(mockTierConfigs as any);

      const catalog = await service.getTierCatalog(true);

      expect(catalog).toHaveLength(3);
      expect(catalog.some((t) => !t.isActive)).toBe(true);
    });

    it('should handle empty metadata gracefully', async () => {
      mockDb.subscriptionTierConfig.findMany.mockResolvedValue([
        {
          ...mockTierConfigs[2],
          metadata: null,
        },
      ] as any);

      const catalog = await service.getTierCatalog(true);

      expect(catalog[0].features).toEqual([]);
      expect(catalog[0].limitations).toEqual([]);
    });
  });

  describe('getTierByName', () => {
    it('should return specific tier configuration', async () => {
      const mockConfig = {
        tier: SubscriptionTier.Professional,
        monthlyTokens: 2000,
        priceRubles: 1990,
        requestsPerMinute: 50,
        burstPerSecond: 10,
        requiresChannel: false,
        description: 'Professional tier',
        isActive: true,
        metadata: {
          features: ['All AI tools'],
        },
      };

      mockDb.subscriptionTierConfig.findUnique.mockResolvedValue(mockConfig as any);

      const tier = await service.getTierByName('Professional');

      expect(tier).toBeDefined();
      expect(tier?.tier).toBe(SubscriptionTier.Professional);
      expect(tier?.monthlyTokens).toBe(2000);
      expect(tier?.priceRubles).toBe(1990);
    });

    it('should return null for non-existent tier', async () => {
      mockDb.subscriptionTierConfig.findUnique.mockResolvedValue(null);

      const tier = await service.getTierByName('NonExistent');

      expect(tier).toBeNull();
    });
  });
});
