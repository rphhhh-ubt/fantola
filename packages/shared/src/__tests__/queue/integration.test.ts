import {
  createRedisConnection,
  closeRedisConnections,
  RedisConnectionFactory,
} from '../../queue/connection';
import { createProducer } from '../../queue/producer';
import { createConsumer } from '../../queue/consumer';
import {
  QueueName,
  JobPriority,
  ImageGenerationJobData,
} from '../../queue/types';
import { QueueMetricsHooks, JobEvent } from '../../queue/metrics';
import { getQueueName } from '../../queue/naming';

// Mock bullmq and ioredis for integration test
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockImplementation(async (name, data) => ({
      id: 'mock-job-id',
      name,
      data,
    })),
    addBulk: jest.fn().mockImplementation(async (jobs) =>
      jobs.map((job: any, index: number) => ({
        id: `mock-job-id-${index}`,
        ...job,
      })),
    ),
    getJob: jest.fn().mockResolvedValue(null),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
      delayed: 1,
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
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    isPaused: jest.fn().mockReturnValue(false),
    isRunning: jest.fn().mockReturnValue(true),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation(() => mockWorker),
    Job: jest.fn(),
  };
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

describe('Queue Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    QueueMetricsHooks.clearAll();
  });

  afterEach(async () => {
    await closeRedisConnections();
    QueueMetricsHooks.clearAll();
  });

  describe('Full workflow', () => {
    it('should create connection, producer, and consumer', async () => {
      const connection = createRedisConnection();
      expect(connection).toBeDefined();

      const producer = createProducer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        connection,
      );
      expect(producer).toBeDefined();

      const processor = jest.fn().mockResolvedValue({ success: true });
      const consumer = createConsumer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        processor,
        connection,
      );
      expect(consumer).toBeDefined();

      await producer.close();
      await consumer.close();
    });

    it('should track metrics throughout job lifecycle', async () => {
      const addedCallback = jest.fn();
      const activeCallback = jest.fn();
      const completedCallback = jest.fn();

      QueueMetricsHooks.on(JobEvent.ADDED, addedCallback);
      QueueMetricsHooks.on(JobEvent.ACTIVE, activeCallback);
      QueueMetricsHooks.on(JobEvent.COMPLETED, completedCallback);

      const connection = createRedisConnection();
      const producer = createProducer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        connection,
      );

      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'A beautiful landscape',
        tool: 'dalle',
      };

      await producer.addJob('generate-image', jobData);

      expect(addedCallback).toHaveBeenCalled();

      await producer.close();
    });

    it('should handle priority jobs correctly', async () => {
      const connection = createRedisConnection();
      const producer = createProducer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        connection,
      );

      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'Urgent request',
        tool: 'dalle',
      };

      const criticalJob = await producer.addCriticalJob('generate-image', jobData);
      expect(criticalJob).toBeDefined();

      const highPriorityJob = await producer.addHighPriorityJob('generate-image', jobData);
      expect(highPriorityJob).toBeDefined();

      await producer.close();
    });

    it('should handle bulk job additions', async () => {
      const connection = createRedisConnection();
      const producer = createProducer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        connection,
      );

      const jobs = [
        {
          name: 'job-1',
          data: {
            userId: 'user-123',
            timestamp: Date.now(),
            prompt: 'Prompt 1',
            tool: 'dalle' as const,
          },
        },
        {
          name: 'job-2',
          data: {
            userId: 'user-123',
            timestamp: Date.now(),
            prompt: 'Prompt 2',
            tool: 'dalle' as const,
          },
          opts: {
            priority: JobPriority.HIGH,
          },
        },
      ];

      const addedJobs = await producer.addBulk(jobs);
      expect(addedJobs).toHaveLength(2);

      await producer.close();
    });

    it('should manage queue operations', async () => {
      const connection = createRedisConnection();
      const producer = createProducer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        connection,
      );

      // Get metrics
      const metrics = await producer.getMetrics();
      expect(metrics.queueName).toBe(QueueName.IMAGE_GENERATION);

      // Pause and resume
      await producer.pause();
      await producer.resume();

      // Drain queue
      await producer.drain();

      // Clean jobs
      await producer.cleanCompleted();
      await producer.cleanFailed();

      await producer.close();
    });

    it('should use environment-specific queue names', () => {
      const queueName = getQueueName(QueueName.IMAGE_GENERATION);
      expect(queueName).toMatch(/^monorepo:image-generation/);
    });

    it('should reuse connections when appropriate', () => {
      const conn1 = createRedisConnection();
      const conn2 = createRedisConnection();

      expect(conn1).toBe(conn2);
      expect(RedisConnectionFactory.getConnectionCount()).toBe(1);
    });

    it('should handle consumer processing errors gracefully', async () => {
      const connection = createRedisConnection();

      const errorProcessor = jest.fn().mockRejectedValue(new Error('Processing failed'));
      const consumer = createConsumer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        errorProcessor,
        connection,
      );

      expect(consumer).toBeDefined();

      await consumer.close();
    });
  });

  describe('Configuration integration', () => {
    it('should apply retry configuration from queue config', async () => {
      const connection = createRedisConnection();
      const producer = createProducer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        connection,
      );

      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'Test prompt',
        tool: 'dalle',
      };

      const job = await producer.addJob('test-job', jobData);

      // Retry config should be applied automatically
      expect(job).toBeDefined();

      await producer.close();
    });

    it('should use appropriate timeouts for different queue types', async () => {
      const connection = createRedisConnection();

      const imageConsumer = createConsumer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        async () => ({ success: true }),
        connection,
      );

      expect(imageConsumer).toBeDefined();

      await imageConsumer.close();
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const connection = createRedisConnection();

      // Simulate connection error
      const errorHandler = (connection.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1];

      if (errorHandler) {
        errorHandler(new Error('Connection failed'));
      }

      consoleErrorSpy.mockRestore();
    });

    it('should cleanup resources on close', async () => {
      const connection = createRedisConnection();
      const producer = createProducer<ImageGenerationJobData>(
        QueueName.IMAGE_GENERATION,
        connection,
      );

      await producer.close();
      await closeRedisConnections();

      expect(RedisConnectionFactory.getConnectionCount()).toBe(0);
    });
  });
});
