import type { JobsOptions, WorkerOptions, QueueOptions } from 'bullmq';
import { JobPriority } from './types';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
};

/**
 * Retry configurations by job type
 */
export const RETRY_CONFIGS: Record<string, { attempts: number; backoff: { type: string; delay: number } }> = {
  'image-generation': {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  'image-processing': {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
  'chat-processing': {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
  'payment-processing': {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
  'notification': {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 1000,
    },
  },
  'subscription-renewal': {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
  'sora-generation': {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
  'product-card-generation': {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
};

/**
 * Default job options
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: DEFAULT_RETRY_CONFIG.attempts,
  backoff: DEFAULT_RETRY_CONFIG.backoff,
  removeOnComplete: {
    age: 24 * 3600, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // 7 days
    count: 5000,
  },
};

/**
 * Default worker options
 */
export const DEFAULT_WORKER_OPTIONS: Partial<WorkerOptions> = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  lockDuration: 30000,
  maxStalledCount: 3,
  stalledInterval: 30000,
};

/**
 * Default queue options
 */
export const DEFAULT_QUEUE_OPTIONS: Partial<QueueOptions> = {
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
};

/**
 * Get retry configuration for a specific queue
 */
export function getRetryConfig(queueName: string): { attempts: number; backoff: { type: string; delay: number } } {
  return RETRY_CONFIGS[queueName] || DEFAULT_RETRY_CONFIG;
}

/**
 * Job prioritization helper
 */
export class JobPrioritization {
  /**
   * Get priority value from priority enum
   */
  static getPriorityValue(priority: JobPriority): number {
    return priority;
  }

  /**
   * Get priority from value
   */
  static getPriorityFromValue(value: number): JobPriority {
    const priorities = Object.values(JobPriority).filter(
      (p) => typeof p === 'number',
    ) as number[];

    const closest = priorities.reduce((prev, curr) => {
      return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
    });

    return closest as JobPriority;
  }

  /**
   * Compare two priorities (for sorting)
   */
  static compare(a: JobPriority, b: JobPriority): number {
    return a - b;
  }

  /**
   * Check if priority is higher than another
   */
  static isHigherThan(a: JobPriority, b: JobPriority): boolean {
    return a < b;
  }

  /**
   * Get priority label
   */
  static getLabel(priority: JobPriority): string {
    const labels: Record<JobPriority, string> = {
      [JobPriority.CRITICAL]: 'Critical',
      [JobPriority.HIGH]: 'High',
      [JobPriority.NORMAL]: 'Normal',
      [JobPriority.LOW]: 'Low',
      [JobPriority.BACKGROUND]: 'Background',
    };

    return labels[priority] || 'Unknown';
  }

  /**
   * Get priority from string
   */
  static fromString(priority: string): JobPriority {
    const map: Record<string, JobPriority> = {
      critical: JobPriority.CRITICAL,
      high: JobPriority.HIGH,
      normal: JobPriority.NORMAL,
      low: JobPriority.LOW,
      background: JobPriority.BACKGROUND,
    };

    return map[priority.toLowerCase()] || JobPriority.NORMAL;
  }

  /**
   * Create job options with priority
   */
  static createJobOptions(priority: JobPriority, baseOptions?: JobsOptions): JobsOptions {
    return {
      ...DEFAULT_JOB_OPTIONS,
      ...baseOptions,
      priority: this.getPriorityValue(priority),
    };
  }
}

/**
 * Timeout configurations by job type (in milliseconds)
 */
export const JOB_TIMEOUTS: Record<string, number> = {
  'image-generation': 5 * 60 * 1000, // 5 minutes
  'image-processing': 2 * 60 * 1000, // 2 minutes
  'chat-processing': 30 * 1000, // 30 seconds
  'payment-processing': 60 * 1000, // 1 minute
  'notification': 10 * 1000, // 10 seconds
  'subscription-renewal': 30 * 1000, // 30 seconds
  'sora-generation': 10 * 60 * 1000, // 10 minutes
  'product-card-generation': 5 * 60 * 1000, // 5 minutes
};

/**
 * Get timeout for a specific queue
 */
export function getJobTimeout(queueName: string): number {
  return JOB_TIMEOUTS[queueName] || 60000; // Default 1 minute
}

/**
 * Rate limit configurations by queue (jobs per second)
 */
export const RATE_LIMITS: Record<string, { max: number; duration: number }> = {
  'image-generation': { max: 10, duration: 1000 },
  'image-processing': { max: 50, duration: 1000 },
  'chat-processing': { max: 100, duration: 1000 },
  'payment-processing': { max: 20, duration: 1000 },
  'notification': { max: 100, duration: 1000 },
  'subscription-renewal': { max: 10, duration: 1000 },
  'sora-generation': { max: 5, duration: 1000 },
  'product-card-generation': { max: 10, duration: 1000 },
};

/**
 * Get rate limit for a specific queue
 */
export function getRateLimit(queueName: string): { max: number; duration: number } | undefined {
  return RATE_LIMITS[queueName];
}

/**
 * Map subscription tier to job priority
 */
export function getTierPriority(tier: string): JobPriority {
  const tierPriorityMap: Record<string, JobPriority> = {
    'Business': JobPriority.HIGH,
    'Professional': JobPriority.NORMAL,
    'Gift': JobPriority.LOW,
  };

  return tierPriorityMap[tier] || JobPriority.NORMAL;
}

/**
 * Check if tier should get priority boost
 */
export function shouldBoostPriority(tier: string): boolean {
  return tier === 'Business';
}
