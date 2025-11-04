import type { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import type {
  ImageProcessingJobData,
} from '@monorepo/shared';
import { QueueName } from '@monorepo/shared';
import { ExampleProcessor } from '../processors/example-processor';

// Mock database to avoid Prisma connection issues in tests
jest.mock('@monorepo/shared', () => ({
  ...jest.requireActual('@monorepo/shared'),
  db: {
    generation: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('WorkerService - Processor Integration', () => {
  let monitoring: Monitoring;

  beforeEach(() => {
    monitoring = new Monitoring({ service: 'worker-test' });
  });

  describe('Processor Execution', () => {
    it('should process a job successfully', async () => {
      const processor = new ExampleProcessor({ monitoring });
      const jobProcessor = processor.getProcessor();

      const mockJob = {
        id: 'test-job-1',
        data: {
          userId: 'user-123',
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle',
          timestamp: Date.now(),
        } as ImageProcessingJobData,
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<ImageProcessingJobData>;

      const result = await jobProcessor(mockJob);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        processedUrl: expect.stringContaining('processed'),
        tool: 'dalle',
        userId: 'user-123',
      });
      expect(mockJob.updateProgress).toHaveBeenCalled();
    });

    it('should handle job failure', async () => {
      const processor = new ExampleProcessor({ monitoring });
      const jobProcessor = processor.getProcessor();

      // Mock process method to throw error
      jest.spyOn(processor as any, 'process').mockRejectedValue(
        new Error('Processing failed')
      );

      const mockJob = {
        id: 'test-job-2',
        data: {
          userId: 'user-123',
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle',
          timestamp: Date.now(),
        } as ImageProcessingJobData,
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<ImageProcessingJobData>;

      const result = await jobProcessor(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Processing failed');
    });

    it('should track job retries', async () => {
      const processor = new ExampleProcessor({ monitoring });
      const jobProcessor = processor.getProcessor();

      jest.spyOn(processor as any, 'process').mockRejectedValue(
        new Error('Temporary failure')
      );

      const mockJob = {
        id: 'test-job-3',
        data: {
          userId: 'user-123',
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle',
          timestamp: Date.now(),
        } as ImageProcessingJobData,
        attemptsMade: 1,
        opts: {
          attempts: 3,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<ImageProcessingJobData>;

      const result = await jobProcessor(mockJob);

      expect(result.success).toBe(false);
      // Job should be retried (2 attempts left)
      expect(mockJob.attemptsMade).toBe(1);
      expect(mockJob.opts.attempts).toBe(3);
    });

    it('should move to dead letter after max retries', async () => {
      const processor = new ExampleProcessor({ monitoring });
      const jobProcessor = processor.getProcessor();

      jest.spyOn(processor as any, 'process').mockRejectedValue(
        new Error('Permanent failure')
      );

      const mockJob = {
        id: 'test-job-4',
        data: {
          userId: 'user-123',
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle',
          timestamp: Date.now(),
        } as ImageProcessingJobData,
        attemptsMade: 3,
        opts: {
          attempts: 3,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<ImageProcessingJobData>;

      const result = await jobProcessor(mockJob);

      expect(result.success).toBe(false);
      // No retries left - should be moved to dead letter
      expect(mockJob.attemptsMade).toBe(3);
    });

    it('should update progress during processing', async () => {
      const processor = new ExampleProcessor({ monitoring });
      const jobProcessor = processor.getProcessor();

      const mockJob = {
        id: 'test-job-5',
        data: {
          userId: 'user-123',
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle',
          timestamp: Date.now(),
        } as ImageProcessingJobData,
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<ImageProcessingJobData>;

      await jobProcessor(mockJob);

      // Should have called updateProgress multiple times
      expect(mockJob.updateProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          step: expect.any(String),
          progress: expect.any(Number),
        })
      );
      expect(mockJob.updateProgress).toHaveBeenCalledTimes(3);
    });

    it('should return error details on failure', async () => {
      const processor = new ExampleProcessor({ monitoring });
      const jobProcessor = processor.getProcessor();

      const customError = new Error('Custom error message');
      (customError as any).code = 'CUSTOM_ERROR';
      jest.spyOn(processor as any, 'process').mockRejectedValue(customError);

      const mockJob = {
        id: 'test-job-6',
        data: {
          userId: 'user-123',
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle',
          timestamp: Date.now(),
        } as ImageProcessingJobData,
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<ImageProcessingJobData>;

      const result = await jobProcessor(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Custom error message');
      expect(result.error?.code).toBe('CUSTOM_ERROR');
      expect(result.error?.stack).toBeDefined();
    });
  });

  describe('BaseProcessor', () => {
    it('should create a processor with correct queue name', () => {
      const processor = new ExampleProcessor({ monitoring });
      
      // Access protected property for testing
      expect((processor as any).queueName).toBe(QueueName.IMAGE_PROCESSING);
    });

    it('should use monitoring instance', () => {
      const processor = new ExampleProcessor({ monitoring });
      
      // Access protected property for testing
      expect((processor as any).monitoring).toBe(monitoring);
    });
  });

  describe('Job Result Format', () => {
    it('should return success result with data', async () => {
      const processor = new ExampleProcessor({ monitoring });
      const jobProcessor = processor.getProcessor();

      const mockJob = {
        id: 'test-job-7',
        data: {
          userId: 'user-123',
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle',
          timestamp: Date.now(),
          metadata: { foo: 'bar' },
        } as ImageProcessingJobData,
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<ImageProcessingJobData>;

      const result = await jobProcessor(mockJob);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
      expect(result.data).toHaveProperty('processedUrl');
      expect(result.data).toHaveProperty('tool', 'dalle');
      expect(result.data).toHaveProperty('userId', 'user-123');
      expect(result.data).toHaveProperty('timestamp');
    });

    it('should return error result on failure', async () => {
      const processor = new ExampleProcessor({ monitoring });
      const jobProcessor = processor.getProcessor();

      jest.spyOn(processor as any, 'process').mockRejectedValue(
        new Error('Test error')
      );

      const mockJob = {
        id: 'test-job-8',
        data: {
          userId: 'user-123',
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle',
          timestamp: Date.now(),
        } as ImageProcessingJobData,
        attemptsMade: 0,
        opts: {
          attempts: 3,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<ImageProcessingJobData>;

      const result = await jobProcessor(mockJob);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('message');
      expect(result.error).toHaveProperty('stack');
    });
  });
});
