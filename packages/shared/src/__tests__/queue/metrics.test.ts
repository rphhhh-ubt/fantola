import {
  QueueMetricsHooks,
  setupDefaultMetrics,
  setupMonitoringIntegration,
  MonitoringIntegration,
} from '../../queue/metrics';
import { JobEvent, QueueEventPayload } from '../../queue/types';

describe('QueueMetricsHooks', () => {
  beforeEach(() => {
    QueueMetricsHooks.clearAll();
  });

  afterEach(() => {
    QueueMetricsHooks.clearAll();
  });

  describe('on/off', () => {
    it('should register and execute event-specific hooks', async () => {
      const mockCallback = jest.fn();

      QueueMetricsHooks.on(JobEvent.COMPLETED, mockCallback);

      const payload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload);

      expect(mockCallback).toHaveBeenCalledWith(payload);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should remove event-specific hooks', async () => {
      const mockCallback = jest.fn();

      QueueMetricsHooks.on(JobEvent.COMPLETED, mockCallback);
      QueueMetricsHooks.off(JobEvent.COMPLETED, mockCallback);

      const payload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple hooks for same event', async () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      QueueMetricsHooks.on(JobEvent.COMPLETED, mockCallback1);
      QueueMetricsHooks.on(JobEvent.COMPLETED, mockCallback2);

      const payload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload);

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('onAll/offAll', () => {
    it('should register and execute global hooks for all events', async () => {
      const mockCallback = jest.fn();

      QueueMetricsHooks.onAll(mockCallback);

      const payload1: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      const payload2: QueueEventPayload = {
        jobId: 'test-job-2',
        queueName: 'test-queue',
        event: JobEvent.FAILED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload1);
      await QueueMetricsHooks.emit(payload2);

      expect(mockCallback).toHaveBeenCalledWith(payload1);
      expect(mockCallback).toHaveBeenCalledWith(payload2);
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it('should remove global hooks', async () => {
      const mockCallback = jest.fn();

      QueueMetricsHooks.onAll(mockCallback);
      QueueMetricsHooks.offAll(mockCallback);

      const payload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('clearEvent', () => {
    it('should clear all hooks for a specific event', async () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      QueueMetricsHooks.on(JobEvent.COMPLETED, mockCallback1);
      QueueMetricsHooks.on(JobEvent.COMPLETED, mockCallback2);

      QueueMetricsHooks.clearEvent(JobEvent.COMPLETED);

      const payload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload);

      expect(mockCallback1).not.toHaveBeenCalled();
      expect(mockCallback2).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should clear all hooks', async () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();
      const mockGlobalCallback = jest.fn();

      QueueMetricsHooks.on(JobEvent.COMPLETED, mockCallback1);
      QueueMetricsHooks.on(JobEvent.FAILED, mockCallback2);
      QueueMetricsHooks.onAll(mockGlobalCallback);

      QueueMetricsHooks.clearAll();

      const payload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload);

      expect(mockCallback1).not.toHaveBeenCalled();
      expect(mockCallback2).not.toHaveBeenCalled();
      expect(mockGlobalCallback).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should emit to both event-specific and global hooks', async () => {
      const eventCallback = jest.fn();
      const globalCallback = jest.fn();

      QueueMetricsHooks.on(JobEvent.COMPLETED, eventCallback);
      QueueMetricsHooks.onAll(globalCallback);

      const payload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload);

      expect(eventCallback).toHaveBeenCalledWith(payload);
      expect(globalCallback).toHaveBeenCalledWith(payload);
    });

    it('should handle errors in hooks gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Hook error');
      });
      const validCallback = jest.fn();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      QueueMetricsHooks.on(JobEvent.COMPLETED, errorCallback);
      QueueMetricsHooks.on(JobEvent.COMPLETED, validCallback);

      const payload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(payload);

      expect(errorCallback).toHaveBeenCalled();
      expect(validCallback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('createPayload', () => {
    it('should create payload from job', () => {
      const mockJob = {
        id: 'test-job-1',
        queueName: 'test-queue',
        data: { userId: 'user-123' },
      } as any;

      const payload = QueueMetricsHooks.createPayload(mockJob, JobEvent.COMPLETED);

      expect(payload).toEqual({
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        data: { userId: 'user-123' },
        error: undefined,
        timestamp: expect.any(Number),
      });
    });

    it('should include error if provided', () => {
      const mockJob = {
        id: 'test-job-1',
        queueName: 'test-queue',
        data: { userId: 'user-123' },
      } as any;

      const error = new Error('Job failed');
      const payload = QueueMetricsHooks.createPayload(mockJob, JobEvent.FAILED, error);

      expect(payload.error).toBe(error);
    });

    it('should handle job without ID', () => {
      const mockJob = {
        queueName: 'test-queue',
        data: { userId: 'user-123' },
      } as any;

      const payload = QueueMetricsHooks.createPayload(mockJob, JobEvent.COMPLETED);

      expect(payload.jobId).toBe('unknown');
    });
  });

  describe('getHookCount', () => {
    it('should return count for specific event', () => {
      QueueMetricsHooks.on(JobEvent.COMPLETED, jest.fn());
      QueueMetricsHooks.on(JobEvent.COMPLETED, jest.fn());
      QueueMetricsHooks.on(JobEvent.FAILED, jest.fn());

      expect(QueueMetricsHooks.getHookCount(JobEvent.COMPLETED)).toBe(2);
      expect(QueueMetricsHooks.getHookCount(JobEvent.FAILED)).toBe(1);
    });

    it('should return total count without event parameter', () => {
      QueueMetricsHooks.on(JobEvent.COMPLETED, jest.fn());
      QueueMetricsHooks.on(JobEvent.FAILED, jest.fn());
      QueueMetricsHooks.onAll(jest.fn());

      expect(QueueMetricsHooks.getHookCount()).toBe(3);
    });
  });

  describe('setupDefaultMetrics', () => {
    it('should setup default metrics hooks', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      setupDefaultMetrics();

      expect(QueueMetricsHooks.getHookCount()).toBeGreaterThan(0);

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('setupMonitoringIntegration', () => {
    it('should setup monitoring integration hooks', async () => {
      const mockMonitoring: MonitoringIntegration = {
        trackJobAdded: jest.fn(),
        trackJobCompleted: jest.fn(),
        trackJobFailed: jest.fn(),
        trackJobStalled: jest.fn(),
        trackQueueMetrics: jest.fn(),
      };

      setupMonitoringIntegration(mockMonitoring);

      const addedPayload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.ADDED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(addedPayload);

      expect(mockMonitoring.trackJobAdded).toHaveBeenCalledWith('test-queue', 'test-job-1');
    });

    it('should track job completion with duration', async () => {
      const mockMonitoring: MonitoringIntegration = {
        trackJobAdded: jest.fn(),
        trackJobCompleted: jest.fn(),
        trackJobFailed: jest.fn(),
        trackJobStalled: jest.fn(),
        trackQueueMetrics: jest.fn(),
      };

      setupMonitoringIntegration(mockMonitoring);

      const activePayload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.ACTIVE,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(activePayload);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const completedPayload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.COMPLETED,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(completedPayload);

      expect(mockMonitoring.trackJobCompleted).toHaveBeenCalledWith(
        'test-queue',
        'test-job-1',
        expect.any(Number),
      );

      const duration = (mockMonitoring.trackJobCompleted as jest.Mock).mock.calls[0][2];
      expect(duration).toBeGreaterThan(0);
    });

    it('should track job failures', async () => {
      const mockMonitoring: MonitoringIntegration = {
        trackJobAdded: jest.fn(),
        trackJobCompleted: jest.fn(),
        trackJobFailed: jest.fn(),
        trackJobStalled: jest.fn(),
        trackQueueMetrics: jest.fn(),
      };

      setupMonitoringIntegration(mockMonitoring);

      const error = new Error('Job failed');
      const failedPayload: QueueEventPayload = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        event: JobEvent.FAILED,
        error,
        timestamp: Date.now(),
      };

      await QueueMetricsHooks.emit(failedPayload);

      expect(mockMonitoring.trackJobFailed).toHaveBeenCalledWith('test-queue', 'test-job-1', error);
    });
  });
});
