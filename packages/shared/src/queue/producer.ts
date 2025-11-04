import { Queue, Job } from 'bullmq';
import type { JobsOptions } from 'bullmq';
import type Redis from 'ioredis';
import {
  QueueName,
  JobData,
  JobResult,
  ExtendedJobOptions,
  JobPriority,
} from './types';
import { getQueueName } from './naming';
import { DEFAULT_QUEUE_OPTIONS, JobPrioritization, getRetryConfig } from './config';
import { QueueMetricsHooks, JobEvent } from './metrics';

/**
 * Queue producer for publishing jobs
 */
export class QueueProducer<T extends JobData = JobData> {
  private queue: Queue<T, JobResult, string>;
  private queueName: QueueName;

  constructor(queueName: QueueName, connection: Redis) {
    this.queueName = queueName;
    const fullQueueName = getQueueName(queueName);

    this.queue = new Queue<T, JobResult, string>(fullQueueName, {
      connection,
      ...DEFAULT_QUEUE_OPTIONS,
    });

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for metrics
   */
  private setupEventListeners(): void {
    this.queue.on('error', (error) => {
      console.error(`Queue error (${this.queueName}):`, error);
    });
  }

  /**
   * Add a job to the queue
   */
  async addJob(
    name: string,
    data: T,
    options?: ExtendedJobOptions,
  ): Promise<Job<T, JobResult, string>> {
    const retryConfig = getRetryConfig(this.queueName);

    const jobOptions: JobsOptions = {
      ...retryConfig,
      ...options,
      priority: options?.priority
        ? JobPrioritization.getPriorityValue(options.priority)
        : undefined,
    };

    const job = await this.queue.add(name as any, data as any, jobOptions);

    await QueueMetricsHooks.emit({
      jobId: job.id || 'unknown',
      queueName: this.queueName,
      event: JobEvent.ADDED,
      data: job.data,
      timestamp: Date.now(),
    });

    return job;
  }

  /**
   * Add multiple jobs to the queue in bulk
   */
  async addBulk(
    jobs: Array<{ name: string; data: T; opts?: ExtendedJobOptions }>,
  ): Promise<Job<T, JobResult, string>[]> {
    const retryConfig = getRetryConfig(this.queueName);

    const bulkJobs = jobs.map((job) => ({
      name: job.name as any,
      data: job.data,
      opts: {
        ...retryConfig,
        ...job.opts,
        priority: job.opts?.priority
          ? JobPrioritization.getPriorityValue(job.opts.priority)
          : undefined,
      },
    }));

    const addedJobs = await this.queue.addBulk(bulkJobs as any);

    for (const job of addedJobs) {
      await QueueMetricsHooks.emit({
        jobId: job.id || 'unknown',
        queueName: this.queueName,
        event: JobEvent.ADDED,
        data: job.data,
        timestamp: Date.now(),
      });
    }

    return addedJobs;
  }

  /**
   * Add a job with high priority
   */
  async addHighPriorityJob(
    name: string,
    data: T,
    options?: ExtendedJobOptions,
  ): Promise<Job<T, JobResult, string>> {
    return this.addJob(name, data, {
      ...options,
      priority: JobPriority.HIGH,
    });
  }

  /**
   * Add a job with critical priority
   */
  async addCriticalJob(
    name: string,
    data: T,
    options?: ExtendedJobOptions,
  ): Promise<Job<T, JobResult, string>> {
    return this.addJob(name, data, {
      ...options,
      priority: JobPriority.CRITICAL,
    });
  }

  /**
   * Add a delayed job
   */
  async addDelayedJob(
    name: string,
    data: T,
    delay: number,
    options?: ExtendedJobOptions,
  ): Promise<Job<T, JobResult, string>> {
    return this.addJob(name, data, {
      ...options,
      delay,
    });
  }

  /**
   * Add a repeatable job
   */
  async addRepeatableJob(
    name: string,
    data: T,
    pattern: string,
    options?: ExtendedJobOptions,
  ): Promise<Job<T, JobResult, string>> {
    return this.addJob(name, data, {
      ...options,
      repeat: {
        pattern,
      },
    });
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<Job<T, JobResult, string> | undefined> {
    return this.queue.getJob(jobId);
  }

  /**
   * Remove a job by ID
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  /**
   * Get queue metrics
   */
  async getMetrics() {
    const counts = await this.queue.getJobCounts();
    const isPaused = await this.queue.isPaused();

    return {
      queueName: this.queueName,
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: isPaused,
    };
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
  }

  /**
   * Drain the queue (remove all waiting jobs)
   */
  async drain(): Promise<void> {
    await this.queue.drain();
  }

  /**
   * Clean completed jobs
   */
  async cleanCompleted(grace: number = 24 * 3600 * 1000): Promise<string[]> {
    return this.queue.clean(grace, 100, 'completed');
  }

  /**
   * Clean failed jobs
   */
  async cleanFailed(grace: number = 7 * 24 * 3600 * 1000): Promise<string[]> {
    return this.queue.clean(grace, 100, 'failed');
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue(): Queue<T, JobResult, string> {
    return this.queue;
  }

  /**
   * Close the queue
   */
  async close(): Promise<void> {
    await this.queue.close();
  }
}

/**
 * Create a queue producer
 */
export function createProducer<T extends JobData = JobData>(
  queueName: QueueName,
  connection: Redis,
): QueueProducer<T> {
  return new QueueProducer<T>(queueName, connection);
}
