import { ProductCardService } from '../product-card.service';
import { db } from '@monorepo/database';
import { ProductCardMode } from '../types';

jest.mock('@monorepo/database', () => ({
  db: {
    productCardGeneration: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('ProductCardService - Moderation', () => {
  let service: ProductCardService;

  beforeEach(() => {
    service = new ProductCardService();
    jest.clearAllMocks();
  });

  describe('moderateGeneration', () => {
    it('should approve generation with clean content', async () => {
      const mockGeneration = {
        id: 'gen-123',
        userId: 'user-123',
        productImageUrl: 'https://example.com/image.jpg',
        productImageKey: 'key-123',
        mode: ProductCardMode.CLEAN,
        textHeadline: 'New Product Launch',
        textSubheadline: 'Best Quality',
        textDescription: 'Amazing product for everyone',
        status: 'pending',
        moderationStatus: 'pending',
      };

      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(mockGeneration);
      (db.productCardGeneration.update as jest.Mock).mockResolvedValue({
        ...mockGeneration,
        moderationStatus: 'approved',
      });

      const result = await service.moderateGeneration('gen-123');

      expect(result.approved).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(db.productCardGeneration.update).toHaveBeenCalledWith({
        where: { id: 'gen-123' },
        data: {
          moderationStatus: 'approved',
          moderationReason: undefined,
          moderatedAt: expect.any(Date),
        },
      });
    });

    it('should reject generation with nudity keywords', async () => {
      const mockGeneration = {
        id: 'gen-456',
        userId: 'user-123',
        productImageUrl: 'https://example.com/image.jpg',
        productImageKey: 'key-456',
        mode: ProductCardMode.CLEAN,
        textHeadline: 'Nude Photography',
        textSubheadline: 'Explicit content',
        textDescription: 'NSFW material',
        status: 'pending',
        moderationStatus: 'pending',
      };

      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(mockGeneration);
      (db.productCardGeneration.update as jest.Mock).mockResolvedValue({
        ...mockGeneration,
        moderationStatus: 'rejected',
      });

      const result = await service.moderateGeneration('gen-456');

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('nude');
      expect(result.reason).toContain('explicit');
      expect(result.reason).toContain('nsfw');
      expect(result.categories.nudity).toBe(true);
      expect(db.productCardGeneration.update).toHaveBeenCalledWith({
        where: { id: 'gen-456' },
        data: {
          moderationStatus: 'rejected',
          moderationReason: expect.stringContaining('nude'),
          moderatedAt: expect.any(Date),
        },
      });
    });

    it('should reject generation with alcohol keywords', async () => {
      const mockGeneration = {
        id: 'gen-789',
        userId: 'user-123',
        productImageUrl: 'https://example.com/image.jpg',
        productImageKey: 'key-789',
        mode: ProductCardMode.CLEAN,
        textHeadline: 'Best Vodka',
        textSubheadline: 'Premium Spirits',
        textDescription: 'Enjoy drinking our beer and wine',
        status: 'pending',
        moderationStatus: 'pending',
      };

      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(mockGeneration);
      (db.productCardGeneration.update as jest.Mock).mockResolvedValue({
        ...mockGeneration,
        moderationStatus: 'rejected',
      });

      const result = await service.moderateGeneration('gen-789');

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('vodka');
      expect(result.reason).toContain('spirits');
      expect(result.reason).toContain('drinking');
      expect(result.reason).toContain('beer');
      expect(result.reason).toContain('wine');
      expect(result.categories.alcohol).toBe(true);
    });

    it('should reject generation with brand logos', async () => {
      const mockGeneration = {
        id: 'gen-101',
        userId: 'user-123',
        productImageUrl: 'https://example.com/image.jpg',
        productImageKey: 'key-101',
        mode: ProductCardMode.CLEAN,
        textHeadline: 'Nike Logo',
        textSubheadline: 'Coca-Cola Brand',
        textDescription: 'Apple and Google trademarks',
        status: 'pending',
        moderationStatus: 'pending',
      };

      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(mockGeneration);
      (db.productCardGeneration.update as jest.Mock).mockResolvedValue({
        ...mockGeneration,
        moderationStatus: 'rejected',
      });

      const result = await service.moderateGeneration('gen-101');

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('logo');
      expect(result.reason).toContain('nike');
      expect(result.reason).toContain('coca-cola');
      expect(result.reason).toContain('brand');
      expect(result.reason).toContain('apple');
      expect(result.reason).toContain('google');
      expect(result.reason).toContain('trademark');
      expect(result.categories.logos).toBe(true);
    });

    it('should reject generation with violence keywords', async () => {
      const mockGeneration = {
        id: 'gen-202',
        userId: 'user-123',
        productImageUrl: 'https://example.com/image.jpg',
        productImageKey: 'key-202',
        mode: ProductCardMode.CLEAN,
        textHeadline: 'Gun Violence',
        textSubheadline: 'Blood and Gore',
        textDescription: 'Weapon for war and attack',
        status: 'pending',
        moderationStatus: 'pending',
      };

      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(mockGeneration);
      (db.productCardGeneration.update as jest.Mock).mockResolvedValue({
        ...mockGeneration,
        moderationStatus: 'rejected',
      });

      const result = await service.moderateGeneration('gen-202');

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('gun');
      expect(result.reason).toContain('violence');
      expect(result.reason).toContain('blood');
      expect(result.reason).toContain('gore');
      expect(result.reason).toContain('weapon');
      expect(result.reason).toContain('war');
      expect(result.reason).toContain('attack');
      expect(result.categories.violence).toBe(true);
    });

    it('should handle generation with no text', async () => {
      const mockGeneration = {
        id: 'gen-303',
        userId: 'user-123',
        productImageUrl: 'https://example.com/image.jpg',
        productImageKey: 'key-303',
        mode: ProductCardMode.CLEAN,
        textHeadline: null,
        textSubheadline: null,
        textDescription: null,
        status: 'pending',
        moderationStatus: 'pending',
      };

      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(mockGeneration);
      (db.productCardGeneration.update as jest.Mock).mockResolvedValue({
        ...mockGeneration,
        moderationStatus: 'approved',
      });

      const result = await service.moderateGeneration('gen-303');

      expect(result.approved).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should throw error for non-existent generation', async () => {
      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.moderateGeneration('non-existent')).rejects.toThrow('Generation not found');
    });

    it('should reject generation with multiple category violations', async () => {
      const mockGeneration = {
        id: 'gen-404',
        userId: 'user-123',
        productImageUrl: 'https://example.com/image.jpg',
        productImageKey: 'key-404',
        mode: ProductCardMode.CLEAN,
        textHeadline: 'Nude Beer Logo',
        textSubheadline: 'Violence and alcohol',
        textDescription: 'Nike trademark with explicit content',
        status: 'pending',
        moderationStatus: 'pending',
      };

      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(mockGeneration);
      (db.productCardGeneration.update as jest.Mock).mockResolvedValue({
        ...mockGeneration,
        moderationStatus: 'rejected',
      });

      const result = await service.moderateGeneration('gen-404');

      expect(result.approved).toBe(false);
      expect(result.categories.nudity).toBe(true);
      expect(result.categories.alcohol).toBe(true);
      expect(result.categories.logos).toBe(true);
      expect(result.categories.violence).toBe(true);
      expect(result.categories.inappropriate).toBe(true);
    });

    it('should be case insensitive for keyword matching', async () => {
      const mockGeneration = {
        id: 'gen-505',
        userId: 'user-123',
        productImageUrl: 'https://example.com/image.jpg',
        productImageKey: 'key-505',
        mode: ProductCardMode.CLEAN,
        textHeadline: 'NUDE PHOTOGRAPHY',
        textSubheadline: 'EXPLICIT CONTENT',
        textDescription: 'NSFW MATERIAL',
        status: 'pending',
        moderationStatus: 'pending',
      };

      (db.productCardGeneration.findUnique as jest.Mock).mockResolvedValue(mockGeneration);
      (db.productCardGeneration.update as jest.Mock).mockResolvedValue({
        ...mockGeneration,
        moderationStatus: 'rejected',
      });

      const result = await service.moderateGeneration('gen-505');

      expect(result.approved).toBe(false);
      expect(result.categories.nudity).toBe(true);
    });
  });
});
