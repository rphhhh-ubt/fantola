import {
  DEFAULT_RETRY_CONFIG,
  RETRY_CONFIGS,
  DEFAULT_JOB_OPTIONS,
  DEFAULT_WORKER_OPTIONS,
  DEFAULT_QUEUE_OPTIONS,
  getRetryConfig,
  JobPrioritization,
  getJobTimeout,
  JOB_TIMEOUTS,
  getRateLimit,
  RATE_LIMITS,
} from '../../queue/config';
import { JobPriority } from '../../queue/types';

describe('Queue Configuration', () => {
  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_RETRY_CONFIG).toEqual({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
    });
  });

  describe('RETRY_CONFIGS', () => {
    it('should have configurations for all queue types', () => {
      expect(RETRY_CONFIGS['image-generation']).toBeDefined();
      expect(RETRY_CONFIGS['image-processing']).toBeDefined();
      expect(RETRY_CONFIGS['chat-processing']).toBeDefined();
      expect(RETRY_CONFIGS['payment-processing']).toBeDefined();
      expect(RETRY_CONFIGS['notification']).toBeDefined();
      expect(RETRY_CONFIGS['subscription-renewal']).toBeDefined();
    });

    it('should have correct payment processing config', () => {
      expect(RETRY_CONFIGS['payment-processing']).toEqual({
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      });
    });
  });

  describe('getRetryConfig', () => {
    it('should return config for known queue', () => {
      const config = getRetryConfig('image-generation');

      expect(config).toEqual(RETRY_CONFIGS['image-generation']);
    });

    it('should return default config for unknown queue', () => {
      const config = getRetryConfig('unknown-queue');

      expect(config).toEqual(DEFAULT_RETRY_CONFIG);
    });
  });

  describe('DEFAULT_JOB_OPTIONS', () => {
    it('should include retry config', () => {
      expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
      expect(DEFAULT_JOB_OPTIONS.backoff).toBeDefined();
    });

    it('should have removeOnComplete settings', () => {
      expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toEqual({
        age: 24 * 3600,
        count: 1000,
      });
    });

    it('should have removeOnFail settings', () => {
      expect(DEFAULT_JOB_OPTIONS.removeOnFail).toEqual({
        age: 7 * 24 * 3600,
        count: 5000,
      });
    });
  });

  describe('DEFAULT_WORKER_OPTIONS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_WORKER_OPTIONS.concurrency).toBe(5);
      expect(DEFAULT_WORKER_OPTIONS.lockDuration).toBe(30000);
      expect(DEFAULT_WORKER_OPTIONS.maxStalledCount).toBe(3);
      expect(DEFAULT_WORKER_OPTIONS.stalledInterval).toBe(30000);
    });
  });

  describe('DEFAULT_QUEUE_OPTIONS', () => {
    it('should include default job options', () => {
      expect(DEFAULT_QUEUE_OPTIONS.defaultJobOptions).toBe(DEFAULT_JOB_OPTIONS);
    });
  });

  describe('JobPrioritization', () => {
    describe('getPriorityValue', () => {
      it('should return correct numeric value for each priority', () => {
        expect(JobPrioritization.getPriorityValue(JobPriority.CRITICAL)).toBe(1);
        expect(JobPrioritization.getPriorityValue(JobPriority.HIGH)).toBe(2);
        expect(JobPrioritization.getPriorityValue(JobPriority.NORMAL)).toBe(3);
        expect(JobPrioritization.getPriorityValue(JobPriority.LOW)).toBe(4);
        expect(JobPrioritization.getPriorityValue(JobPriority.BACKGROUND)).toBe(5);
      });
    });

    describe('getPriorityFromValue', () => {
      it('should return correct priority for exact values', () => {
        expect(JobPrioritization.getPriorityFromValue(1)).toBe(JobPriority.CRITICAL);
        expect(JobPrioritization.getPriorityFromValue(2)).toBe(JobPriority.HIGH);
        expect(JobPrioritization.getPriorityFromValue(3)).toBe(JobPriority.NORMAL);
      });

      it('should return closest priority for approximate values', () => {
        expect(JobPrioritization.getPriorityFromValue(1.4)).toBe(JobPriority.CRITICAL);
        expect(JobPrioritization.getPriorityFromValue(2.6)).toBe(JobPriority.NORMAL);
      });
    });

    describe('compare', () => {
      it('should return negative when a has higher priority than b', () => {
        expect(JobPrioritization.compare(JobPriority.CRITICAL, JobPriority.HIGH)).toBeLessThan(0);
      });

      it('should return positive when a has lower priority than b', () => {
        expect(JobPrioritization.compare(JobPriority.LOW, JobPriority.NORMAL)).toBeGreaterThan(0);
      });

      it('should return zero when priorities are equal', () => {
        expect(JobPrioritization.compare(JobPriority.NORMAL, JobPriority.NORMAL)).toBe(0);
      });
    });

    describe('isHigherThan', () => {
      it('should return true when a has higher priority than b', () => {
        expect(JobPrioritization.isHigherThan(JobPriority.CRITICAL, JobPriority.HIGH)).toBe(true);
        expect(JobPrioritization.isHigherThan(JobPriority.HIGH, JobPriority.NORMAL)).toBe(true);
      });

      it('should return false when a has lower or equal priority than b', () => {
        expect(JobPrioritization.isHigherThan(JobPriority.LOW, JobPriority.NORMAL)).toBe(false);
        expect(JobPrioritization.isHigherThan(JobPriority.NORMAL, JobPriority.NORMAL)).toBe(false);
      });
    });

    describe('getLabel', () => {
      it('should return correct label for each priority', () => {
        expect(JobPrioritization.getLabel(JobPriority.CRITICAL)).toBe('Critical');
        expect(JobPrioritization.getLabel(JobPriority.HIGH)).toBe('High');
        expect(JobPrioritization.getLabel(JobPriority.NORMAL)).toBe('Normal');
        expect(JobPrioritization.getLabel(JobPriority.LOW)).toBe('Low');
        expect(JobPrioritization.getLabel(JobPriority.BACKGROUND)).toBe('Background');
      });
    });

    describe('fromString', () => {
      it('should parse priority from string', () => {
        expect(JobPrioritization.fromString('critical')).toBe(JobPriority.CRITICAL);
        expect(JobPrioritization.fromString('high')).toBe(JobPriority.HIGH);
        expect(JobPrioritization.fromString('normal')).toBe(JobPriority.NORMAL);
      });

      it('should be case-insensitive', () => {
        expect(JobPrioritization.fromString('CRITICAL')).toBe(JobPriority.CRITICAL);
        expect(JobPrioritization.fromString('High')).toBe(JobPriority.HIGH);
      });

      it('should return NORMAL for unknown string', () => {
        expect(JobPrioritization.fromString('unknown')).toBe(JobPriority.NORMAL);
      });
    });

    describe('createJobOptions', () => {
      it('should create job options with priority', () => {
        const options = JobPrioritization.createJobOptions(JobPriority.HIGH);

        expect(options.priority).toBe(2);
        expect(options.attempts).toBe(3);
      });

      it('should merge with base options', () => {
        const baseOptions = {
          delay: 5000,
        };

        const options = JobPrioritization.createJobOptions(JobPriority.CRITICAL, baseOptions);

        expect(options.priority).toBe(1);
        expect(options.delay).toBe(5000);
        expect(options.attempts).toBe(3);
      });
    });
  });

  describe('JOB_TIMEOUTS', () => {
    it('should have timeouts for all queue types', () => {
      expect(JOB_TIMEOUTS['image-generation']).toBe(5 * 60 * 1000);
      expect(JOB_TIMEOUTS['image-processing']).toBe(2 * 60 * 1000);
      expect(JOB_TIMEOUTS['chat-processing']).toBe(30 * 1000);
      expect(JOB_TIMEOUTS['payment-processing']).toBe(60 * 1000);
      expect(JOB_TIMEOUTS['notification']).toBe(10 * 1000);
      expect(JOB_TIMEOUTS['subscription-renewal']).toBe(30 * 1000);
    });
  });

  describe('getJobTimeout', () => {
    it('should return timeout for known queue', () => {
      expect(getJobTimeout('image-generation')).toBe(5 * 60 * 1000);
    });

    it('should return default timeout for unknown queue', () => {
      expect(getJobTimeout('unknown-queue')).toBe(60000);
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have rate limits for all queue types', () => {
      expect(RATE_LIMITS['image-generation']).toEqual({ max: 10, duration: 1000 });
      expect(RATE_LIMITS['image-processing']).toEqual({ max: 50, duration: 1000 });
      expect(RATE_LIMITS['chat-processing']).toEqual({ max: 100, duration: 1000 });
    });
  });

  describe('getRateLimit', () => {
    it('should return rate limit for known queue', () => {
      expect(getRateLimit('image-generation')).toEqual({ max: 10, duration: 1000 });
    });

    it('should return undefined for unknown queue', () => {
      expect(getRateLimit('unknown-queue')).toBeUndefined();
    });
  });
});
