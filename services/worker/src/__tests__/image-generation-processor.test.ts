import { describe, expect, it, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/shared';
import { ImageGenerationProcessor } from '../processors/image-generation-processor';
import { StorageConfig } from '../storage';

describe('ImageGenerationProcessor', () => {
  let processor: ImageGenerationProcessor;
  let monitoring: Monitoring;
  let userId: string;

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

    processor = new ImageGenerationProcessor({
      monitoring,
      storageConfig,
    });

    // Create test user
    const user = await db.user.create({
      data: {
        telegramId: 'test-image-gen-user',
        username: 'imagetestuser',
        tier: 'Professional',
        tokensBalance: 1000,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up
    await db.generation.deleteMany({ where: { userId } });
    await db.tokenOperation.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  });

  beforeEach(async () => {
    // Reset user balance
    await db.user.update({
      where: { id: userId },
      data: {
        tokensBalance: 1000,
        tokensSpent: 0,
      },
    });

    // Clean up existing generations
    await db.generation.deleteMany({ where: { userId } });
  });

  describe('process', () => {
    it('should successfully process an image generation job', async () => {
      // Create generation record
      const generation = await db.generation.create({
        data: {
          userId,
          tool: 'dalle',
          status: 'pending',
          prompt: 'A beautiful landscape',
          tokensUsed: 10,
        },
      });

      const job = {
        id: 'test-job-image-gen',
        data: {
          userId,
          prompt: 'A beautiful landscape',
          tool: 'dalle',
          options: {
            size: '1024x1024',
            n: 1,
          },
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(true);
      expect(result.data?.resultUrls).toBeDefined();
      expect(result.data?.resultUrls.length).toBeGreaterThan(0);

      // Verify generation was updated
      const updatedGeneration = await db.generation.findUnique({
        where: { id: generation.id },
      });

      expect(updatedGeneration?.status).toBe('completed');
      expect(updatedGeneration?.completedAt).not.toBeNull();
      expect(updatedGeneration?.resultUrls.length).toBeGreaterThan(0);

      // Verify tokens were deducted
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(990); // 1000 - 10
      expect(user?.tokensSpent).toBe(10);
    });

    it('should handle multiple images', async () => {
      // Create generation record
      const generation = await db.generation.create({
        data: {
          userId,
          tool: 'dalle',
          status: 'pending',
          prompt: 'A beautiful landscape',
          tokensUsed: 10,
        },
      });

      const job = {
        id: 'test-job-multi-images',
        data: {
          userId,
          prompt: 'A beautiful landscape',
          tool: 'dalle',
          options: {
            size: '1024x1024',
            n: 3,
          },
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(true);
      expect(result.data?.resultUrls.length).toBe(3);

      // Verify generation was updated
      const updatedGeneration = await db.generation.findUnique({
        where: { id: generation.id },
      });

      expect(updatedGeneration?.status).toBe('completed');
      expect(updatedGeneration?.resultUrls.length).toBe(3);
    });

    it('should handle generation failure', async () => {
      // Create generation record
      const generation = await db.generation.create({
        data: {
          userId,
          tool: 'dalle',
          status: 'pending',
          prompt: 'Test prompt',
          tokensUsed: 10,
        },
      });

      // Create a job with invalid data to trigger failure
      const job = {
        id: 'test-job-failure',
        data: {
          userId: 'non-existent-user',
          prompt: 'Test prompt',
          tool: 'dalle',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify tokens were NOT deducted for failed job
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(1000); // Unchanged
      expect(user?.tokensSpent).toBe(0);
    });

    it('should handle insufficient tokens', async () => {
      // Set user balance to insufficient amount
      await db.user.update({
        where: { id: userId },
        data: {
          tokensBalance: 5,
        },
      });

      // Create generation record
      const generation = await db.generation.create({
        data: {
          userId,
          tool: 'dalle',
          status: 'pending',
          prompt: 'Test prompt',
          tokensUsed: 10,
        },
      });

      const job = {
        id: 'test-job-insufficient',
        data: {
          userId,
          prompt: 'Test prompt',
          tool: 'dalle',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Token deduction failed');

      // Verify balance is unchanged
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true },
      });

      expect(user?.tokensBalance).toBe(5); // Unchanged
    });
  });

  describe('Tool Mapping', () => {
    it('should correctly map dall-e tool', async () => {
      const generation = await db.generation.create({
        data: {
          userId,
          tool: 'dalle',
          status: 'pending',
          prompt: 'Test prompt',
          tokensUsed: 10,
        },
      });

      const job = {
        id: 'test-job-dalle',
        data: {
          userId,
          prompt: 'Test prompt',
          tool: 'dalle',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(true);

      const updatedGeneration = await db.generation.findUnique({
        where: { id: generation.id },
      });

      expect(updatedGeneration?.status).toBe('completed');
    });

    it('should correctly map stable-diffusion tool', async () => {
      const generation = await db.generation.create({
        data: {
          userId,
          tool: 'stable_diffusion',
          status: 'pending',
          prompt: 'Test prompt',
          tokensUsed: 10,
        },
      });

      const job = {
        id: 'test-job-sd',
        data: {
          userId,
          prompt: 'Test prompt',
          tool: 'stable-diffusion',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(true);

      const updatedGeneration = await db.generation.findUnique({
        where: { id: generation.id },
      });

      expect(updatedGeneration?.status).toBe('completed');
    });
  });
});
