import { QueueConsumer, createConsumer, JobProcessor } from '../../queue/consumer';
import { QueueName, ImageProcessingJobData } from '../../queue/types';
import { QueueMetricsHooks, JobEvent } from '../../queue/metrics';

// Mock bullmq
jest.mock('bullmq', () => {
  let processorFn: any = null;
  const mockWorker = {
    on: jest.fn(),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    isPaused: jest.fn().mockReturnValue(false),
    isRunning: jest.fn().mockReturnValue(true),
    close: jest.fn().mockResolvedValue(undefined),
    _setProcessor: (fn: any) => {
      processorFn = fn;
    },
    _getProcessor: () => processorFn,
  };

  return {
    Queue: jest.fn(),
    Worker: jest.fn().mockImplementation((_queueName, processor, _options) => {
      mockWorker._setProcessor(processor);
      return mockWorker;
    }),
    Job: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Worker } = require('bullmq');

describe('QueueConsumer', () => {
  let mockRedis: any;
  let mockProcessor: jest.MockedFunction<JobProcessor<ImageProcessingJobData>>;
  let consumer: QueueConsumer<ImageProcessingJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    QueueMetricsHooks.clearAll();

    mockRedis = {
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };

    mockProcessor = jest.fn().mockResolvedValue({
      success: true,
      data: { message: 'Job completed' },
    });

    consumer = new QueueConsumer<ImageProcessingJobData>(
      QueueName.IMAGE_PROCESSING,
      mockProcessor,
      mockRedis
    );
  });

  afterEach(() => {
    QueueMetricsHooks.clearAll();
  });

  describe('constructor', () => {
    it('should create a worker instance', () => {
      expect(Worker).toHaveBeenCalled();
    });

    it('should setup event listeners', () => {
      const mockWorker = (consumer as any).worker;
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('active', expect.any(Function));
    });
  });

  describe('processJob', () => {
    it('should process a job successfully', async () => {
      const mockJob = {
        id: 'test-job-1',
        data: {
          userId: 'user-123',
          timestamp: Date.now(),
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle' as const,
        },
        updateProgress: jest.fn(),
      };

      const mockWorker = (consumer as any).worker;
      const processor = mockWorker._getProcessor();

      const result = await processor(mockJob);

      expect(mockProcessor).toHaveBeenCalledWith(mockJob);
      expect(result).toEqual({
        success: true,
        data: { message: 'Job completed' },
      });
    });

    it('should emit active and completed events', async () => {
      const activeCallback = jest.fn();
      const completedCallback = jest.fn();

      QueueMetricsHooks.on(JobEvent.ACTIVE, activeCallback);
      QueueMetricsHooks.on(JobEvent.COMPLETED, completedCallback);

      const mockJob = {
        id: 'test-job-1',
        data: {
          userId: 'user-123',
          timestamp: Date.now(),
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle' as const,
        },
        updateProgress: jest.fn(),
      };

      const mockWorker = (consumer as any).worker;
      const processor = mockWorker._getProcessor();

      await processor(mockJob);

      expect(activeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'test-job-1',
          event: JobEvent.ACTIVE,
        })
      );

      expect(completedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'test-job-1',
          event: JobEvent.COMPLETED,
        })
      );
    });

    it('should handle job processing errors', async () => {
      const error = new Error('Processing failed');
      mockProcessor.mockRejectedValue(error);

      const failedCallback = jest.fn();
      QueueMetricsHooks.on(JobEvent.FAILED, failedCallback);

      const mockJob = {
        id: 'test-job-1',
        data: {
          userId: 'user-123',
          timestamp: Date.now(),
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle' as const,
        },
        updateProgress: jest.fn(),
      };

      const mockWorker = (consumer as any).worker;
      const processor = mockWorker._getProcessor();

      await expect(processor(mockJob)).rejects.toThrow('Processing failed');

      expect(failedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'test-job-1',
          event: JobEvent.FAILED,
          error,
        })
      );
    });
  });

  describe('updateProgress', () => {
    it('should update job progress and emit event', async () => {
      const progressCallback = jest.fn();
      QueueMetricsHooks.on(JobEvent.PROGRESS, progressCallback);

      const mockJob = {
        id: 'test-job-1',
        data: {
          userId: 'user-123',
          timestamp: Date.now(),
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle' as const,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as any;

      await consumer.updateProgress(mockJob, 50);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'test-job-1',
          event: JobEvent.PROGRESS,
          data: 50,
        })
      );
    });

    it('should support object progress', async () => {
      const mockJob = {
        id: 'test-job-1',
        data: {
          userId: 'user-123',
          timestamp: Date.now(),
          sourceUrl: 'https://example.com/image.jpg',
          tool: 'dalle' as const,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      } as any;

      const progress = { step: 'processing', percentage: 75 };
      await consumer.updateProgress(mockJob, progress);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(progress);
    });
  });

  describe('pause/resume', () => {
    it('should pause the worker', async () => {
      await consumer.pause();

      const mockWorker = (consumer as any).worker;
      expect(mockWorker.pause).toHaveBeenCalled();
    });

    it('should resume the worker', async () => {
      await consumer.resume();

      const mockWorker = (consumer as any).worker;
      expect(mockWorker.resume).toHaveBeenCalled();
    });
  });

  describe('isPaused', () => {
    it('should return paused state', () => {
      const isPaused = consumer.isPaused();

      const mockWorker = (consumer as any).worker;
      expect(mockWorker.isPaused).toHaveBeenCalled();
      expect(isPaused).toBe(false);
    });
  });

  describe('isRunning', () => {
    it('should return running state', () => {
      const isRunning = consumer.isRunning();

      const mockWorker = (consumer as any).worker;
      expect(mockWorker.isRunning).toHaveBeenCalled();
      expect(isRunning).toBe(true);
    });
  });

  describe('close', () => {
    it('should close the worker', async () => {
      await consumer.close();

      const mockWorker = (consumer as any).worker;
      expect(mockWorker.close).toHaveBeenCalled();
    });
  });

  describe('getWorker', () => {
    it('should return the underlying worker instance', () => {
      const worker = consumer.getWorker();

      expect(worker).toBeDefined();
      expect(worker).toBe((consumer as any).worker);
    });
  });

  describe('createConsumer helper', () => {
    it('should create a consumer instance', () => {
      const processor: JobProcessor<ImageProcessingJobData> = async () => ({
        success: true,
      });

      const newConsumer = createConsumer(QueueName.IMAGE_PROCESSING, processor, mockRedis);

      expect(newConsumer).toBeInstanceOf(QueueConsumer);
    });

    it('should accept custom worker options', () => {
      const processor: JobProcessor<ImageProcessingJobData> = async () => ({
        success: true,
      });

      const options = {
        concurrency: 10,
        lockDuration: 60000,
      };

      const newConsumer = createConsumer(QueueName.IMAGE_PROCESSING, processor, mockRedis, options);

      expect(newConsumer).toBeInstanceOf(QueueConsumer);
      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          concurrency: 10,
          lockDuration: expect.any(Number), // Will be overridden by timeout
        })
      );
    });
  });
});
