import { describe, expect, it, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/shared';
import { ProductCardProcessor } from '../processors/product-card-processor';
import { StorageConfig } from '../storage';

describe('ProductCardProcessor', () => {
  let processor: ProductCardProcessor;
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

    processor = new ProductCardProcessor({
      monitoring,
      storageConfig,
    });

    // Create test user
    const user = await db.user.create({
      data: {
        telegramId: 'test-product-card-user',
        username: 'productcarduser',
        tier: 'Professional',
        tokensBalance: 1000,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up
    await db.productCardGeneration.deleteMany({ where: { userId } });
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
    await db.productCardGeneration.deleteMany({ where: { userId } });
    await db.tokenOperation.deleteMany({ where: { userId } });
  });

  describe('process', () => {
    it('should successfully process a clean mode product card', async () => {
      // Create generation record
      const generation = await db.productCardGeneration.create({
        data: {
          userId,
          status: 'pending',
          mode: 'clean',
          productImageUrl: 'http://example.com/product.jpg',
          productImageKey: 'temp/product-123.jpg',
          moderationStatus: 'approved',
        },
      });

      const job = {
        id: 'test-job-product-card-clean',
        data: {
          generationId: generation.id,
          userId,
          productImageUrl: 'http://example.com/product.jpg',
          options: {
            mode: 'clean',
            background: '#ffffff',
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
      const updatedGeneration = await db.productCardGeneration.findUnique({
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

    it('should successfully process an infographics mode product card', async () => {
      // Create generation record
      const generation = await db.productCardGeneration.create({
        data: {
          userId,
          status: 'pending',
          mode: 'infographics',
          productImageUrl: 'http://example.com/product.jpg',
          productImageKey: 'temp/product-456.jpg',
          textHeadline: 'New Product',
          textSubheadline: 'Best Quality',
          textDescription: 'Amazing features',
          moderationStatus: 'approved',
        },
      });

      const job = {
        id: 'test-job-product-card-info',
        data: {
          generationId: generation.id,
          userId,
          productImageUrl: 'http://example.com/product.jpg',
          options: {
            mode: 'infographics',
            background: '#f0f0f0',
            textHeadline: 'New Product',
            textSubheadline: 'Best Quality',
            textDescription: 'Amazing features',
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
      expect(result.data?.resultUrls.length).toBeGreaterThan(0);

      // Verify generation was updated
      const updatedGeneration = await db.productCardGeneration.findUnique({
        where: { id: generation.id },
      });

      expect(updatedGeneration?.status).toBe('completed');
      expect(updatedGeneration?.resultUrls.length).toBeGreaterThan(0);

      // Verify tokens were deducted
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(990);
      expect(user?.tokensSpent).toBe(10);
    });

    it('should handle generation failure', async () => {
      // Create generation record
      const generation = await db.productCardGeneration.create({
        data: {
          userId,
          status: 'pending',
          mode: 'clean',
          productImageUrl: 'invalid-url',
          productImageKey: 'temp/invalid.jpg',
          moderationStatus: 'approved',
        },
      });

      const job = {
        id: 'test-job-product-card-failure',
        data: {
          generationId: generation.id,
          userId,
          productImageUrl: 'invalid-url',
          options: {
            mode: 'clean',
          },
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

      // Verify generation was updated with error
      const updatedGeneration = await db.productCardGeneration.findUnique({
        where: { id: generation.id },
      });

      expect(updatedGeneration?.status).toBe('failed');
      expect(updatedGeneration?.errorMessage).toBeTruthy();

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
      const generation = await db.productCardGeneration.create({
        data: {
          userId,
          status: 'pending',
          mode: 'clean',
          productImageUrl: 'http://example.com/product.jpg',
          productImageKey: 'temp/product-789.jpg',
          moderationStatus: 'approved',
        },
      });

      const job = {
        id: 'test-job-product-card-insufficient',
        data: {
          generationId: generation.id,
          userId,
          productImageUrl: 'http://example.com/product.jpg',
          options: {
            mode: 'clean',
          },
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

  describe('Custom Options', () => {
    it('should handle custom background colors', async () => {
      const generation = await db.productCardGeneration.create({
        data: {
          userId,
          status: 'pending',
          mode: 'clean',
          productImageUrl: 'http://example.com/product.jpg',
          productImageKey: 'temp/product.jpg',
          background: '#ff0000',
          moderationStatus: 'approved',
        },
      });

      const job = {
        id: 'test-job-custom-bg',
        data: {
          generationId: generation.id,
          userId,
          productImageUrl: 'http://example.com/product.jpg',
          options: {
            mode: 'clean',
            background: '#ff0000',
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
    });

    it('should handle custom pose options', async () => {
      const generation = await db.productCardGeneration.create({
        data: {
          userId,
          status: 'pending',
          mode: 'infographics',
          productImageUrl: 'http://example.com/product.jpg',
          productImageKey: 'temp/product.jpg',
          pose: 'centered',
          moderationStatus: 'approved',
        },
      });

      const job = {
        id: 'test-job-custom-pose',
        data: {
          generationId: generation.id,
          userId,
          productImageUrl: 'http://example.com/product.jpg',
          options: {
            mode: 'infographics',
            pose: 'centered',
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
    });
  });
});
