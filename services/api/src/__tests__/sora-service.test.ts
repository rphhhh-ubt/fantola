import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SoraService } from '../services/sora.service';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/database';

describe('SoraService', () => {
  let service: SoraService;
  let monitoring: Monitoring;
  let userId: string;

  beforeAll(async () => {
    monitoring = new Monitoring({
      service: 'sora-service-test',
      environment: 'test',
    });

    service = new SoraService(monitoring);

    // Create test user
    const user = await db.user.create({
      data: {
        telegramId: 'test-sora-service-user',
        username: 'soraservicetest',
        tier: 'Professional',
        tokensBalance: 1000,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up
    await db.soraGeneration.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  });

  describe('createGeneration', () => {
    it('should create a new generation', async () => {
      const result = await service.createGeneration({
        userId,
        prompt: 'Test prompt',
        images: [
          {
            buffer: Buffer.from('test-image'),
            mimeType: 'image/jpeg',
            size: 1024,
            width: 1920,
            height: 1080,
          },
        ],
      });

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('pending');
      expect(result.moderationStatus).toBe('pending');

      // Verify in database
      const generation = await db.soraGeneration.findUnique({
        where: { id: result.id },
      });

      expect(generation).toBeTruthy();
      expect(generation?.prompt).toBe('Test prompt');
    });

    it('should reject empty prompt', async () => {
      await expect(
        service.createGeneration({
          userId,
          prompt: '',
          images: [
            {
              buffer: Buffer.from('test-image'),
              mimeType: 'image/jpeg',
              size: 1024,
            },
          ],
        })
      ).rejects.toThrow('Prompt is required');
    });

    it('should reject no images', async () => {
      await expect(
        service.createGeneration({
          userId,
          prompt: 'Test prompt',
          images: [],
        })
      ).rejects.toThrow('At least one image is required');
    });

    it('should reject more than 4 images', async () => {
      await expect(
        service.createGeneration({
          userId,
          prompt: 'Test prompt',
          images: [
            { buffer: Buffer.from('1'), mimeType: 'image/jpeg', size: 1024 },
            { buffer: Buffer.from('2'), mimeType: 'image/jpeg', size: 1024 },
            { buffer: Buffer.from('3'), mimeType: 'image/jpeg', size: 1024 },
            { buffer: Buffer.from('4'), mimeType: 'image/jpeg', size: 1024 },
            { buffer: Buffer.from('5'), mimeType: 'image/jpeg', size: 1024 },
          ],
        })
      ).rejects.toThrow('Maximum 4 images allowed');
    });

    it('should reject invalid image types', async () => {
      await expect(
        service.createGeneration({
          userId,
          prompt: 'Test prompt',
          images: [
            {
              buffer: Buffer.from('test-image'),
              mimeType: 'image/gif',
              size: 1024,
            },
          ],
        })
      ).rejects.toThrow('Invalid image type');
    });

    it('should reject oversized images', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await expect(
        service.createGeneration({
          userId,
          prompt: 'Test prompt',
          images: [
            {
              buffer: largeBuffer,
              mimeType: 'image/jpeg',
              size: largeBuffer.length,
            },
          ],
        })
      ).rejects.toThrow('Image size exceeds maximum');
    });
  });

  describe('moderateGeneration', () => {
    it('should approve valid generation', async () => {
      const generation = await service.createGeneration({
        userId,
        prompt: 'Test moderation',
        images: [
          {
            buffer: Buffer.from('test-image'),
            mimeType: 'image/jpeg',
            size: 1024,
          },
        ],
      });

      await service.storeImages(
        generation.id,
        [
          {
            buffer: Buffer.from('test-image'),
            mimeType: 'image/jpeg',
            size: 1024,
          },
        ],
        [
          {
            storageKey: 'test-key',
            storageUrl: 'http://example.com/test.jpg',
          },
        ]
      );

      const result = await service.moderateGeneration(generation.id);

      expect(result.approved).toBe(true);

      // Verify in database
      const updatedGeneration = await db.soraGeneration.findUnique({
        where: { id: generation.id },
      });

      expect(updatedGeneration?.moderationStatus).toBe('approved');
    });
  });

  describe('getGeneration', () => {
    it('should retrieve generation with images', async () => {
      const generation = await service.createGeneration({
        userId,
        prompt: 'Test retrieval',
        images: [
          {
            buffer: Buffer.from('test-image'),
            mimeType: 'image/jpeg',
            size: 1024,
          },
        ],
      });

      await service.storeImages(
        generation.id,
        [
          {
            buffer: Buffer.from('test-image'),
            mimeType: 'image/jpeg',
            size: 1024,
          },
        ],
        [
          {
            storageKey: 'test-key',
            storageUrl: 'http://example.com/test.jpg',
          },
        ]
      );

      const result = await service.getGeneration(generation.id);

      expect(result.id).toBe(generation.id);
      expect(result.images).toHaveLength(1);
      expect(result.user).toBeTruthy();
    });

    it('should throw for non-existent generation', async () => {
      await expect(
        service.getGeneration('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Generation not found');
    });
  });

  describe('retryGeneration', () => {
    it('should retry failed generation', async () => {
      const generation = await db.soraGeneration.create({
        data: {
          userId,
          prompt: 'Test retry',
          status: 'failed',
          moderationStatus: 'approved',
          errorMessage: 'Test error',
        },
      });

      await service.retryGeneration(generation.id);

      const updated = await db.soraGeneration.findUnique({
        where: { id: generation.id },
      });

      expect(updated?.status).toBe('pending');
      expect(updated?.retryCount).toBe(1);
      expect(updated?.errorMessage).toBeNull();
    });

    it('should reject retry of non-failed generation', async () => {
      const generation = await db.soraGeneration.create({
        data: {
          userId,
          prompt: 'Test retry',
          status: 'completed',
          moderationStatus: 'approved',
        },
      });

      await expect(service.retryGeneration(generation.id)).rejects.toThrow(
        'Only failed generations can be retried'
      );
    });
  });

  describe('updateGenerationStatus', () => {
    it('should update generation status and data', async () => {
      const generation = await service.createGeneration({
        userId,
        prompt: 'Test status update',
        images: [
          {
            buffer: Buffer.from('test-image'),
            mimeType: 'image/jpeg',
            size: 1024,
          },
        ],
      });

      const resultUrls = ['http://example.com/result1.mp4', 'http://example.com/result2.mp4'];
      const completedAt = new Date();

      await service.updateGenerationStatus(generation.id, 'completed', {
        resultUrls,
        completedAt,
        tokensUsed: 10,
      });

      const updated = await db.soraGeneration.findUnique({
        where: { id: generation.id },
      });

      expect(updated?.status).toBe('completed');
      expect(updated?.resultUrls).toEqual(resultUrls);
      expect(updated?.tokensUsed).toBe(10);
    });
  });
});
