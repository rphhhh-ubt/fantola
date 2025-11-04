import type { Job } from 'bullmq';
import type { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/shared';
import type {
  JobData,
  JobResult,
  JobProcessor,
  QueueName,
} from '@monorepo/shared';
import { GenerationStatus } from '@monorepo/database';

/**
 * Processing context with database and monitoring
 */
export interface ProcessorContext {
  monitoring: Monitoring;
}

/**
 * Abstract base processor for all job types
 * Provides common functionality for status updates, retries, and dead-letter handling
 */
export abstract class BaseProcessor<T extends JobData = JobData> {
  protected monitoring: Monitoring;
  protected queueName: QueueName;

  constructor(queueName: QueueName, context: ProcessorContext) {
    this.queueName = queueName;
    this.monitoring = context.monitoring;
  }

  /**
   * Main job processor function
   * Wraps the actual processing with status updates and error handling
   */
  getProcessor(): JobProcessor<T> {
    return async (job: Job<T, JobResult>): Promise<JobResult> => {
      const jobId = job.id || 'unknown';
      const startTime = Date.now();

      this.monitoring.logger.info(
        {
          jobId,
          queue: this.queueName,
          attempt: job.attemptsMade,
          data: job.data,
        },
        'Processing job'
      );

      try {
        // Update status to processing
        await this.updateStatus(job, GenerationStatus.processing);

        // Execute the actual processing logic
        const result = await this.process(job);

        const processingTime = Date.now() - startTime;

        if (result.success) {
          // Update status to completed
          await this.updateStatus(job, GenerationStatus.completed, result.data);

          this.monitoring.logger.info(
            {
              jobId,
              queue: this.queueName,
              processingTimeMs: processingTime,
            },
            'Job completed successfully'
          );

          this.monitoring.trackKPI({
            type: 'generation_success',
            data: { type: this.queueName },
          });
        } else {
          // Handle failed job
          await this.handleFailure(job, new Error(result.error?.message || 'Job failed'));
        }

        return result;
      } catch (error) {
        const processingTime = Date.now() - startTime;
        const err = error as Error;

        this.monitoring.logger.error(
          {
            err,
            jobId,
            queue: this.queueName,
            attempt: job.attemptsMade,
            processingTimeMs: processingTime,
          },
          'Job processing failed'
        );

        // Handle job failure
        await this.handleFailure(job, err);

        // Return error result
        return {
          success: false,
          error: {
            message: err.message,
            code: (err as any).code,
            stack: err.stack,
          },
        };
      }
    };
  }

  /**
   * Abstract method to be implemented by specific processors
   */
  protected abstract process(job: Job<T, JobResult>): Promise<JobResult>;

  /**
   * Update job status in database
   */
  protected async updateStatus(
    job: Job<T, JobResult>,
    status: GenerationStatus,
    resultData?: any
  ): Promise<void> {
    try {
      const jobData = job.data as any;
      
      // Try to find generation record by job ID or user ID
      // This is a stub - actual implementation depends on your job data structure
      const generation = await db.generation.findFirst({
        where: {
          userId: jobData.userId,
          status: {
            in: [GenerationStatus.pending, GenerationStatus.processing],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (generation) {
        await db.generation.update({
          where: { id: generation.id },
          data: {
            status,
            resultUrls: resultData?.urls || generation.resultUrls,
            completedAt: status === GenerationStatus.completed ? new Date() : null,
            errorMessage: status === GenerationStatus.failed ? resultData?.error : null,
          },
        });

        this.monitoring.logger.debug(
          {
            generationId: generation.id,
            status,
          },
          'Updated generation status'
        );
      }
    } catch (error) {
      // Don't fail the job if status update fails
      this.monitoring.logger.warn(
        {
          err: error,
          jobId: job.id,
        },
        'Failed to update job status in database'
      );
    }
  }

  /**
   * Handle job failure with retry logic
   */
  protected async handleFailure(job: Job<T, JobResult>, error: Error): Promise<void> {
    const jobId = job.id || 'unknown';
    const attemptsLeft = (job.opts.attempts || 3) - job.attemptsMade;

    this.monitoring.logger.warn(
      {
        jobId,
        queue: this.queueName,
        attempt: job.attemptsMade,
        attemptsLeft,
        error: error.message,
      },
      'Job failed, handling retry or dead-letter'
    );

    if (attemptsLeft > 0) {
      // Will be retried automatically by BullMQ
      this.monitoring.logger.info(
        {
          jobId,
          attemptsLeft,
        },
        'Job will be retried'
      );
    } else {
      // No more retries - move to dead letter
      await this.moveToDeadLetter(job, error);
    }

    // Update status to failed
    await this.updateStatus(job, GenerationStatus.failed, { error: error.message });

    this.monitoring.trackKPI({
      type: 'generation_failure',
      data: {
        type: this.queueName,
        errorType: error.name,
      },
    });
  }

  /**
   * Move job to dead letter queue (stub for now)
   * In production, you might want to:
   * - Store in a separate database table
   * - Send to a monitoring service
   * - Trigger alerts
   */
  protected async moveToDeadLetter(job: Job<T, JobResult>, error: Error): Promise<void> {
    const jobId = job.id || 'unknown';

    this.monitoring.logger.error(
      {
        jobId,
        queue: this.queueName,
        data: job.data,
        error: error.message,
        stack: error.stack,
      },
      'Job moved to dead letter queue'
    );

    // Stub: In production, implement actual dead-letter storage
    // For example:
    // - Store in Redis with a TTL
    // - Store in a separate PostgreSQL table
    // - Send to a monitoring service like Sentry
    // - Trigger an alert via webhook

    this.monitoring.alerts.alertQueueFailure(this.queueName, error, {
      jobId,
      data: job.data,
      attempts: job.attemptsMade,
    });
  }

  /**
   * Update job progress
   */
  protected async updateProgress(
    job: Job<T, JobResult>,
    progress: number | object
  ): Promise<void> {
    await job.updateProgress(progress);

    this.monitoring.logger.debug(
      {
        jobId: job.id,
        progress,
      },
      'Job progress updated'
    );
  }
}
