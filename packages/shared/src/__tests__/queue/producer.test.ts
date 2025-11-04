import { QueueProducer, createProducer } from '../../queue/producer';
import { QueueName, JobPriority, ImageGenerationJobData } from '../../queue/types';
import { QueueMetricsHooks, JobEvent } from '../../queue/metrics';

// Mock bullmq
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockImplementation(async (name, data, opts) => ({
      id: 'mock-job-id',
      name,
      data,
      opts,
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

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn(),
    Job: jest.fn(),
  };
});

const { Queue } = require('bullmq');

describe('QueueProducer', () => {
  let mockRedis: any;
  let producer: QueueProducer<ImageGenerationJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    QueueMetricsHooks.clearAll();

    mockRedis = {
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };

    producer = new QueueProducer<ImageGenerationJobData>(
      QueueName.IMAGE_GENERATION,
      mockRedis,
    );
  });

  afterEach(() => {
    QueueMetricsHooks.clearAll();
  });

  describe('constructor', () => {
    it('should create a queue instance', () => {
      expect(Queue).toHaveBeenCalled();
    });

    it('should setup event listeners', () => {
      const mockQueue = (producer as any).queue;
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'A beautiful landscape',
        tool: 'dalle',
      };

      const job = await producer.addJob('generate-image', jobData);

      expect(job).toBeDefined();
      expect(job.data).toEqual(jobData);

      const mockQueue = (producer as any).queue;
      expect(mockQueue.add).toHaveBeenCalledWith(
        'generate-image',
        jobData,
        expect.objectContaining({
          attempts: expect.any(Number),
          backoff: expect.any(Object),
        }),
      );
    });

    it('should emit metrics event when job is added', async () => {
      const metricsCallback = jest.fn();
      QueueMetricsHooks.on(JobEvent.ADDED, metricsCallback);

      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'A beautiful landscape',
        tool: 'dalle',
      };

      await producer.addJob('generate-image', jobData);

      expect(metricsCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'mock-job-id',
          queueName: QueueName.IMAGE_GENERATION,
          event: JobEvent.ADDED,
        }),
      );
    });

    it('should apply priority to job options', async () => {
      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'A beautiful landscape',
        tool: 'dalle',
      };

      await producer.addJob('generate-image', jobData, {
        priority: JobPriority.HIGH,
      });

      const mockQueue = (producer as any).queue;
      const addCall = mockQueue.add.mock.calls[0];
      expect(addCall[2].priority).toBe(2); // HIGH priority = 2
    });
  });

  describe('addBulk', () => {
    it('should add multiple jobs in bulk', async () => {
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
        },
      ];

      const addedJobs = await producer.addBulk(jobs);

      expect(addedJobs).toHaveLength(2);

      const mockQueue = (producer as any).queue;
      expect(mockQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'job-1',
            data: jobs[0].data,
          }),
          expect.objectContaining({
            name: 'job-2',
            data: jobs[1].data,
          }),
        ]),
      );
    });

    it('should emit metrics events for bulk jobs', async () => {
      const metricsCallback = jest.fn();
      QueueMetricsHooks.on(JobEvent.ADDED, metricsCallback);

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
      ];

      await producer.addBulk(jobs);

      expect(metricsCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('addHighPriorityJob', () => {
    it('should add a job with high priority', async () => {
      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'A beautiful landscape',
        tool: 'dalle',
      };

      await producer.addHighPriorityJob('generate-image', jobData);

      const mockQueue = (producer as any).queue;
      const addCall = mockQueue.add.mock.calls[0];
      expect(addCall[2].priority).toBe(2); // HIGH priority = 2
    });
  });

  describe('addCriticalJob', () => {
    it('should add a job with critical priority', async () => {
      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'A beautiful landscape',
        tool: 'dalle',
      };

      await producer.addCriticalJob('generate-image', jobData);

      const mockQueue = (producer as any).queue;
      const addCall = mockQueue.add.mock.calls[0];
      expect(addCall[2].priority).toBe(1); // CRITICAL priority = 1
    });
  });

  describe('addDelayedJob', () => {
    it('should add a job with delay', async () => {
      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'A beautiful landscape',
        tool: 'dalle',
      };

      const delay = 5000;
      await producer.addDelayedJob('generate-image', jobData, delay);

      const mockQueue = (producer as any).queue;
      const addCall = mockQueue.add.mock.calls[0];
      expect(addCall[2].delay).toBe(5000);
    });
  });

  describe('addRepeatableJob', () => {
    it('should add a repeatable job', async () => {
      const jobData: ImageGenerationJobData = {
        userId: 'user-123',
        timestamp: Date.now(),
        prompt: 'A beautiful landscape',
        tool: 'dalle',
      };

      const pattern = '0 0 * * *'; // Daily at midnight
      await producer.addRepeatableJob('generate-image', jobData, pattern);

      const mockQueue = (producer as any).queue;
      const addCall = mockQueue.add.mock.calls[0];
      expect(addCall[2].repeat).toEqual({ pattern });
    });
  });

  describe('getMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await producer.getMetrics();

      expect(metrics).toEqual({
        queueName: QueueName.IMAGE_GENERATION,
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: false,
      });
    });
  });

  describe('pause/resume', () => {
    it('should pause the queue', async () => {
      await producer.pause();

      const mockQueue = (producer as any).queue;
      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should resume the queue', async () => {
      await producer.resume();

      const mockQueue = (producer as any).queue;
      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('drain', () => {
    it('should drain the queue', async () => {
      await producer.drain();

      const mockQueue = (producer as any).queue;
      expect(mockQueue.drain).toHaveBeenCalled();
    });
  });

  describe('cleanCompleted/cleanFailed', () => {
    it('should clean completed jobs', async () => {
      await producer.cleanCompleted(1000);

      const mockQueue = (producer as any).queue;
      expect(mockQueue.clean).toHaveBeenCalledWith(1000, 100, 'completed');
    });

    it('should clean failed jobs', async () => {
      await producer.cleanFailed(5000);

      const mockQueue = (producer as any).queue;
      expect(mockQueue.clean).toHaveBeenCalledWith(5000, 100, 'failed');
    });
  });

  describe('close', () => {
    it('should close the queue', async () => {
      await producer.close();

      const mockQueue = (producer as any).queue;
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  describe('createProducer helper', () => {
    it('should create a producer instance', () => {
      const newProducer = createProducer(QueueName.IMAGE_GENERATION, mockRedis);

      expect(newProducer).toBeInstanceOf(QueueProducer);
    });
  });
});
