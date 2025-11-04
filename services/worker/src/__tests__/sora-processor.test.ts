import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SoraProcessor } from '../processors/sora-processor';
import { Monitoring } from '@monorepo/monitoring';
import { StorageConfig } from '../storage';
import { db } from '@monorepo/database';
import { Job } from 'bullmq';

describe('SoraProcessor', () => {
  let processor: SoraProcessor;
  let monitoring: Monitoring;
  let userId: string;
  let generationId: string;

  const storageConfig: StorageConfig = {
    type: 'local',
    baseUrl: 'http://localhost:3001/storage',
    localBasePath: '/tmp/test-storage',
    s3: {
      bucket: 'test-bucket',
      region: 'us-east-1',
    },
  };

  beforeAll(async () => {
    monitoring = new Monitoring({
      service: 'worker-test',
      environment: 'test',
    });

    processor = new SoraProcessor({
      monitoring,
      storageConfig,
    });

    // Create test user
    const user = await db.user.create({
      data: {
        telegramId: 'test-sora-user',
        username: 'soratestuser',
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

  beforeEach(async () => {
    // Create a fresh generation for each test
    const generation = await db.soraGeneration.create({
      data: {
        userId,
        prompt: 'Test prompt for Sora generation',
        status: 'pending',
        moderationStatus: 'approved',
      },
    });
    generationId = generation.id;
  });

  describe('process', () => {
    it('should successfully process a Sora generation job (happy path)', async () => {
      const job = {
        id: 'test-job-id',
        data: {
          generationId,
          userId,
          prompt: 'Test prompt',
          imageUrls: ['http://example.com/image1.jpg'],
          timestamp: Date.now(),
        },
      } as Job;

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.generationId).toBe(generationId);
      expect(result.resultUrls).toHaveLength(3); // 3 resolutions

      // Verify database was updated
      const generation = await db.soraGeneration.findUnique({
        where: { id: generationId },
      });

      expect(generation?.status).toBe('completed');
      expect(generation?.resultUrls).toHaveLength(3);
      expect(generation?.completedAt).not.toBeNull();
    });

    it('should handle processing failure and update database', async () => {
      // Create a job with invalid data to trigger failure
      const job = {
        id: 'test-job-id-fail',
        data: {
          generationId,
          userId,
          prompt: 'Test prompt',
          imageUrls: ['invalid-url'], // This will cause download to fail
          timestamp: Date.now(),
        },
      } as Job;

      await expect(processor.process(job)).rejects.toThrow();

      // Verify database was updated with error
      const generation = await db.soraGeneration.findUnique({
        where: { id: generationId },
      });

      expect(generation?.status).toBe('failed');
      expect(generation?.errorMessage).toBeTruthy();
    });

    it('should generate multiple resolution outputs', async () => {
      const job = {
        id: 'test-job-id-multi-res',
        data: {
          generationId,
          userId,
          prompt: 'Test prompt',
          imageUrls: ['http://example.com/image1.jpg'],
          timestamp: Date.now(),
        },
      } as Job;

      const result = await processor.process(job);

      expect(result.resultUrls).toHaveLength(3);
      expect(result.resultUrls.some((url: string) => url.includes('1080p'))).toBe(true);
      expect(result.resultUrls.some((url: string) => url.includes('720p'))).toBe(true);
      expect(result.resultUrls.some((url: string) => url.includes('480p'))).toBe(true);
    });

    it('should handle retry scenarios', async () => {
      // First, mark generation as failed
      await db.soraGeneration.update({
        where: { id: generationId },
        data: {
          status: 'failed',
          errorMessage: 'Initial failure',
          retryCount: 1,
        },
      });

      // Update status back to pending for retry
      await db.soraGeneration.update({
        where: { id: generationId },
        data: {
          status: 'pending',
        },
      });

      const job = {
        id: 'test-job-id-retry',
        data: {
          generationId,
          userId,
          prompt: 'Test prompt',
          imageUrls: ['http://example.com/image1.jpg'],
          timestamp: Date.now(),
        },
      } as Job;

      const result = await processor.process(job);

      expect(result.success).toBe(true);

      // Verify generation was updated
      const generation = await db.soraGeneration.findUnique({
        where: { id: generationId },
      });

      expect(generation?.status).toBe('completed');
      expect(generation?.retryCount).toBe(1); // Should remain at 1
    });

    it('should update processing status correctly', async () => {
      const job = {
        id: 'test-job-id-status',
        data: {
          generationId,
          userId,
          prompt: 'Test prompt',
          imageUrls: ['http://example.com/image1.jpg'],
          timestamp: Date.now(),
        },
      } as Job;

      // Start processing
      const processPromise = processor.process(job);

      // Check status was updated to processing
      // (This is a race condition, so we might need to wait a bit)
      await new Promise((resolve) => setTimeout(resolve, 100));

      let generation = await db.soraGeneration.findUnique({
        where: { id: generationId },
      });

      expect(['processing', 'completed']).toContain(generation?.status);

      // Wait for completion
      await processPromise;

      generation = await db.soraGeneration.findUnique({
        where: { id: generationId },
      });

      expect(generation?.status).toBe('completed');
      expect(generation?.startedAt).not.toBeNull();
      expect(generation?.completedAt).not.toBeNull();
    });
  });

  describe('Multi-image support', () => {
    it('should handle multiple input images', async () => {
      const job = {
        id: 'test-job-id-multi',
        data: {
          generationId,
          userId,
          prompt: 'Test prompt with multiple images',
          imageUrls: [
            'http://example.com/image1.jpg',
            'http://example.com/image2.jpg',
            'http://example.com/image3.jpg',
          ],
          timestamp: Date.now(),
        },
      } as Job;

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.resultUrls).toHaveLength(3); // 3 resolutions
    });
  });
});
