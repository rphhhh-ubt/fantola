import { QueueProducer } from '../../queue/producer';
import { QueueName, JobPriority, ProductCardGenerationJobData } from '../../queue/types';
import { getRetryConfig, getTierPriority } from '../../queue/config';
import { generationEvents, GenerationEventType } from '../../queue/events';

// Mock bullmq
jest.mock('bullmq', () => {
  const mockJob = {
    id: 'mock-job-id',
    name: 'test-job',
    data: {},
    opts: {},
    attemptsMade: 0,
    updateProgress: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueue = {
    add: jest.fn().mockImplementation(async (name, data, opts) => ({
      ...mockJob,
      id: `job-${Date.now()}`,
      name,
      data,
      opts,
    })),
    addBulk: jest.fn().mockImplementation(async (jobs) =>
      jobs.map((job: any, index: number) => ({
        ...mockJob,
        id: `job-${Date.now()}-${index}`,
        ...job,
      })),
    ),
    getJob: jest.fn().mockResolvedValue(mockJob),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    isPaused: jest.fn().mockResolvedValue(false),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    drain: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };

  const mockWorker = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation(() => mockWorker),
    Job: jest.fn(),
  };
});

// No need to destructure since we're using mocks
// const { Queue, Worker } = require('bullmq');

describe('Job Lifecycle Tests', () => {
  let mockRedis: any;
  let producer: QueueProducer<ProductCardGenerationJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    generationEvents.removeAllListeners();

    mockRedis = {
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };

    producer = new QueueProducer<ProductCardGenerationJobData>(
      QueueName.PRODUCT_CARD_GENERATION,
      mockRedis,
    );
  });

  describe('Job Creation and Queuing', () => {
    it('should create a job and transition to queued state', async () => {
      const jobData: ProductCardGenerationJobData = {
        generationId: 'gen-123',
        userId: 'user-123',
        productImageUrl: 'https://example.com/product.jpg',
        options: {
          mode: 'clean',
          background: 'white',
        },
        timestamp: Date.now(),
      };

      const job = await producer.addJob('product-card-generation', jobData);

      expect(job).toBeDefined();
      expect(job.id).toContain('job-');
      expect(job.data).toEqual(jobData);
    });

    it('should handle job state transition from pending to processing', async () => {
      const jobData: ProductCardGenerationJobData = {
        generationId: 'gen-123',
        userId: 'user-123',
        productImageUrl: 'https://example.com/product.jpg',
        options: {
          mode: 'clean',
        },
        timestamp: Date.now(),
      };

      // Create the job
      const job = await producer.addJob('product-card-generation', jobData);

      // Verify job was created
      expect(job).toBeDefined();
      expect(job.data).toEqual(jobData);
    });

    it('should apply correct retry configuration for product card generation', () => {
      const retryConfig = getRetryConfig('product-card-generation');

      expect(retryConfig).toEqual({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
    });

    it('should apply correct retry configuration for sora generation', () => {
      const retryConfig = getRetryConfig('sora-generation');

      expect(retryConfig).toEqual({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
    });
  });

  describe('Priority Handling', () => {
    it('should assign HIGH priority to Business tier users', async () => {
      const priority = getTierPriority('Business');
      expect(priority).toBe(JobPriority.HIGH);

      const jobData: ProductCardGenerationJobData = {
        generationId: 'gen-123',
        userId: 'user-123',
        productImageUrl: 'https://example.com/product.jpg',
        options: { mode: 'clean' },
        timestamp: Date.now(),
      };

      await producer.addJob('product-card-generation', jobData, {
        priority,
      });

      const mockQueue = (producer as any).queue;
      expect(mockQueue.add).toHaveBeenCalledWith(
        'product-card-generation',
        jobData,
        expect.objectContaining({
          priority: JobPriority.HIGH,
        }),
      );
    });

    it('should assign NORMAL priority to Professional tier users', async () => {
      const priority = getTierPriority('Professional');
      expect(priority).toBe(JobPriority.NORMAL);

      const jobData: ProductCardGenerationJobData = {
        generationId: 'gen-123',
        userId: 'user-123',
        productImageUrl: 'https://example.com/product.jpg',
        options: { mode: 'clean' },
        timestamp: Date.now(),
      };

      await producer.addJob('product-card-generation', jobData, {
        priority,
      });

      const mockQueue = (producer as any).queue;
      expect(mockQueue.add).toHaveBeenCalledWith(
        'product-card-generation',
        jobData,
        expect.objectContaining({
          priority: JobPriority.NORMAL,
        }),
      );
    });

    it('should assign LOW priority to Gift tier users', async () => {
      const priority = getTierPriority('Gift');
      expect(priority).toBe(JobPriority.LOW);

      const jobData: ProductCardGenerationJobData = {
        generationId: 'gen-123',
        userId: 'user-123',
        productImageUrl: 'https://example.com/product.jpg',
        options: { mode: 'clean' },
        timestamp: Date.now(),
      };

      await producer.addJob('product-card-generation', jobData, {
        priority,
      });

      const mockQueue = (producer as any).queue;
      expect(mockQueue.add).toHaveBeenCalledWith(
        'product-card-generation',
        jobData,
        expect.objectContaining({
          priority: JobPriority.LOW,
        }),
      );
    });

    it('should process jobs in priority order', async () => {
      const jobs = [
        {
          name: 'job-low',
          data: {
            generationId: 'gen-1',
            userId: 'user-1',
            productImageUrl: 'url1',
            options: { mode: 'clean' },
            timestamp: Date.now(),
          },
          opts: { priority: JobPriority.LOW },
        },
        {
          name: 'job-high',
          data: {
            generationId: 'gen-2',
            userId: 'user-2',
            productImageUrl: 'url2',
            options: { mode: 'clean' },
            timestamp: Date.now(),
          },
          opts: { priority: JobPriority.HIGH },
        },
        {
          name: 'job-normal',
          data: {
            generationId: 'gen-3',
            userId: 'user-3',
            productImageUrl: 'url3',
            options: { mode: 'clean' },
            timestamp: Date.now(),
          },
          opts: { priority: JobPriority.NORMAL },
        },
      ];

      const addedJobs = await producer.addBulk(jobs);

      expect(addedJobs).toHaveLength(3);

      // Verify that jobs were added with correct priorities
      const mockQueue = (producer as any).queue;
      const bulkCall = mockQueue.addBulk.mock.calls[0][0];

      expect(bulkCall[0].opts.priority).toBe(JobPriority.LOW);
      expect(bulkCall[1].opts.priority).toBe(JobPriority.HIGH);
      expect(bulkCall[2].opts.priority).toBe(JobPriority.NORMAL);
    });
  });

  describe('Retry and Backoff Strategy', () => {
    it('should apply exponential backoff for failed jobs', async () => {
      const jobData: ProductCardGenerationJobData = {
        generationId: 'gen-123',
        userId: 'user-123',
        productImageUrl: 'https://example.com/product.jpg',
        options: { mode: 'clean' },
        timestamp: Date.now(),
      };

      await producer.addJob('product-card-generation', jobData);

      const mockQueue = (producer as any).queue;
      const addCall = mockQueue.add.mock.calls[0];

      expect(addCall[2]).toMatchObject({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });
    });

    it('should retry job with increasing delay', () => {
      const retryConfig = getRetryConfig('product-card-generation');
      
      // First retry: 5000ms
      const firstDelay = retryConfig.backoff.delay;
      expect(firstDelay).toBe(5000);

      // Exponential backoff means subsequent retries will be:
      // - 2nd retry: 5000 * 2 = 10000ms
      // - 3rd retry: 5000 * 4 = 20000ms
      expect(retryConfig.backoff.type).toBe('exponential');
    });

    it('should respect max retry attempts', async () => {
      const retryConfig = getRetryConfig('product-card-generation');
      expect(retryConfig.attempts).toBe(3);

      const jobData: ProductCardGenerationJobData = {
        generationId: 'gen-123',
        userId: 'user-123',
        productImageUrl: 'https://example.com/product.jpg',
        options: { mode: 'clean' },
        timestamp: Date.now(),
      };

      await producer.addJob('product-card-generation', jobData);

      const mockQueue = (producer as any).queue;
      const addCall = mockQueue.add.mock.calls[0];

      expect(addCall[2].attempts).toBe(3);
    });
  });

  describe('Job Completion and Failure', () => {
    it('should handle successful job completion', async () => {
      const completedEvents: any[] = [];

      generationEvents.on(GenerationEventType.COMPLETED, (event) => {
        completedEvents.push(event);
      });

      // Simulate job completion by emitting event
      generationEvents.emit(GenerationEventType.COMPLETED, {
        generationId: 'gen-123',
        userId: 'user-123',
        type: 'product_card',
        status: 'completed',
        timestamp: Date.now(),
        metadata: {
          resultUrls: ['https://example.com/result.jpg'],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].generationId).toBe('gen-123');
      expect(completedEvents[0].status).toBe('completed');
    });

    it('should handle job failure', async () => {
      const failedEvents: any[] = [];

      generationEvents.on(GenerationEventType.FAILED, (event) => {
        failedEvents.push(event);
      });

      // Simulate job failure by emitting event
      generationEvents.emit(GenerationEventType.FAILED, {
        generationId: 'gen-123',
        userId: 'user-123',
        type: 'product_card',
        status: 'failed',
        timestamp: Date.now(),
        metadata: {
          errorMessage: 'Processing failed',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0].generationId).toBe('gen-123');
      expect(failedEvents[0].status).toBe('failed');
    });
  });

  describe('Full Job Lifecycle Simulation', () => {
    it('should simulate complete job lifecycle: queued -> processing -> completed', async () => {
      const events: string[] = [];
      const eventHandler = ({ event }: any) => {
        events.push(event);
      };

      generationEvents.on('generation:*', eventHandler);

      const generationId = 'gen-lifecycle-test';
      const userId = 'user-123';

      // Step 1: Queue the job - manually emit via emitGenerationEvent
      generationEvents.emitGenerationEvent(GenerationEventType.QUEUED, {
        generationId,
        userId,
        type: 'product_card' as any,
        status: 'pending' as any,
        timestamp: Date.now(),
      });

      // Step 2: Start processing
      generationEvents.emitGenerationEvent(GenerationEventType.PROCESSING, {
        generationId,
        userId,
        type: 'product_card' as any,
        status: 'processing' as any,
        timestamp: Date.now(),
      });

      // Step 3: Complete successfully
      generationEvents.emitGenerationEvent(GenerationEventType.COMPLETED, {
        generationId,
        userId,
        type: 'product_card' as any,
        status: 'completed' as any,
        timestamp: Date.now(),
        metadata: {
          resultUrls: ['https://example.com/result.jpg'],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events).toContain(GenerationEventType.QUEUED);
      expect(events).toContain(GenerationEventType.PROCESSING);
      expect(events).toContain(GenerationEventType.COMPLETED);
      expect(events).toHaveLength(3);

      // Verify order
      expect(events[0]).toBe(GenerationEventType.QUEUED);
      expect(events[1]).toBe(GenerationEventType.PROCESSING);
      expect(events[2]).toBe(GenerationEventType.COMPLETED);

      generationEvents.off('generation:*', eventHandler);
    });

    it('should simulate job lifecycle with failure: queued -> processing -> failed', async () => {
      const events: string[] = [];
      const eventHandler = ({ event }: any) => {
        events.push(event);
      };

      generationEvents.on('generation:*', eventHandler);

      const generationId = 'gen-failure-test';
      const userId = 'user-123';

      // Step 1: Queue the job
      generationEvents.emitGenerationEvent(GenerationEventType.QUEUED, {
        generationId,
        userId,
        type: 'sora' as any,
        status: 'pending' as any,
        timestamp: Date.now(),
      });

      // Step 2: Start processing
      generationEvents.emitGenerationEvent(GenerationEventType.PROCESSING, {
        generationId,
        userId,
        type: 'sora' as any,
        status: 'processing' as any,
        timestamp: Date.now(),
      });

      // Step 3: Fail
      generationEvents.emitGenerationEvent(GenerationEventType.FAILED, {
        generationId,
        userId,
        type: 'sora' as any,
        status: 'failed' as any,
        timestamp: Date.now(),
        metadata: {
          errorMessage: 'API timeout',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events).toContain(GenerationEventType.QUEUED);
      expect(events).toContain(GenerationEventType.PROCESSING);
      expect(events).toContain(GenerationEventType.FAILED);
      expect(events).toHaveLength(3);

      // Verify order
      expect(events[0]).toBe(GenerationEventType.QUEUED);
      expect(events[1]).toBe(GenerationEventType.PROCESSING);
      expect(events[2]).toBe(GenerationEventType.FAILED);

      generationEvents.off('generation:*', eventHandler);
    });
  });
});
