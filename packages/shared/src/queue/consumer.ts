import { Worker, Job } from 'bullmq';
import type { WorkerOptions } from 'bullmq';
import type Redis from 'ioredis';
import { QueueName, JobData, JobResult } from './types';
import { getQueueName } from './naming';
import { DEFAULT_WORKER_OPTIONS, getJobTimeout } from './config';
import { QueueMetricsHooks, JobEvent } from './metrics';

/**
 * Job processor function type
 */
export type JobProcessor<T extends JobData = JobData> = (
  job: Job<T, JobResult>,
) => Promise<JobResult>;

/**
 * Queue consumer for processing jobs
 */
export class QueueConsumer<T extends JobData = JobData> {
  private worker: Worker<T, JobResult, string>;
  private queueName: QueueName;
  private processor: JobProcessor<T>;

  constructor(
    queueName: QueueName,
    processor: JobProcessor<T>,
    connection: Redis,
    options?: Partial<WorkerOptions>,
  ) {
    this.queueName = queueName;
    this.processor = processor;

    const fullQueueName = getQueueName(queueName);
    const timeout = getJobTimeout(queueName);

    this.worker = new Worker<T, JobResult, string>(
      fullQueueName,
      async (job) => this.processJob(job),
      {
        connection,
        ...DEFAULT_WORKER_OPTIONS,
        ...options,
        lockDuration: timeout,
      },
    );

    this.setupEventListeners();
  }

  /**
   * Process a job with error handling and metrics
   */
  private async processJob(job: Job<T, JobResult>): Promise<JobResult> {
    try {
      await QueueMetricsHooks.emit({
        jobId: job.id || 'unknown',
        queueName: this.queueName,
        event: JobEvent.ACTIVE,
        data: job.data,
        timestamp: Date.now(),
      });

      const result = await this.processor(job);

      await QueueMetricsHooks.emit({
        jobId: job.id || 'unknown',
        queueName: this.queueName,
        event: JobEvent.COMPLETED,
        data: job.data,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const err = error as Error;

      await QueueMetricsHooks.emit({
        jobId: job.id || 'unknown',
        queueName: this.queueName,
        event: JobEvent.FAILED,
        data: job.data,
        error: err,
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job: Job<T, JobResult>) => {
      console.log(`Job ${job.id} completed in queue ${this.queueName}`);
    });

    this.worker.on('failed', (job: Job<T, JobResult> | undefined, error: Error) => {
      console.error(`Job ${job?.id || 'unknown'} failed in queue ${this.queueName}:`, error);
    });

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`Job ${jobId} stalled in queue ${this.queueName}`);

      QueueMetricsHooks.emit({
        jobId,
        queueName: this.queueName,
        event: JobEvent.STALLED,
        timestamp: Date.now(),
      }).catch((err) => {
        console.error('Error emitting stalled event:', err);
      });
    });

    this.worker.on('error', (error: Error) => {
      console.error(`Worker error in queue ${this.queueName}:`, error);
    });

    this.worker.on('active', (job: Job<T, JobResult>) => {
      console.log(`Job ${job.id} is now active in queue ${this.queueName}`);
    });
  }

  /**
   * Update job progress
   */
  async updateProgress(job: Job<T, JobResult>, progress: number | object): Promise<void> {
    await job.updateProgress(progress);

    await QueueMetricsHooks.emit({
      jobId: job.id || 'unknown',
      queueName: this.queueName,
      event: JobEvent.PROGRESS,
      data: progress,
      timestamp: Date.now(),
    });
  }

  /**
   * Pause the worker
   */
  async pause(): Promise<void> {
    await this.worker.pause();
  }

  /**
   * Resume the worker
   */
  async resume(): Promise<void> {
    await this.worker.resume();
  }

  /**
   * Check if the worker is paused
   */
  isPaused(): boolean {
    return this.worker.isPaused();
  }

  /**
   * Check if the worker is running
   */
  isRunning(): boolean {
    return this.worker.isRunning();
  }

  /**
   * Get the underlying BullMQ worker instance
   */
  getWorker(): Worker<T, JobResult, string> {
    return this.worker;
  }

  /**
   * Close the worker
   */
  async close(): Promise<void> {
    await this.worker.close();
  }
}

/**
 * Create a queue consumer
 */
export function createConsumer<T extends JobData = JobData>(
  queueName: QueueName,
  processor: JobProcessor<T>,
  connection: Redis,
  options?: Partial<WorkerOptions>,
): QueueConsumer<T> {
  return new QueueConsumer<T>(queueName, processor, connection, options);
}
