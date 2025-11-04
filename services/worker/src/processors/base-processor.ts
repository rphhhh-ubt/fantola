import type { Job } from 'bullmq';
import type { Monitoring } from '@monorepo/monitoring';
import { db, TokenService } from '@monorepo/shared';
import type {
  JobData,
  JobResult,
  JobProcessor,
  QueueName,
} from '@monorepo/shared';
import { GenerationStatus, OperationType } from '@monorepo/database';

/**
 * Processing context with database and monitoring
 */
export interface ProcessorContext {
  monitoring: Monitoring;
  tokenService?: TokenService;
}

/**
 * Token deduction options for processors
 */
export interface TokenDeductionConfig {
  enabled: boolean;
  operationType: OperationType;
  amount?: number;
  skipDeductionOnFailure?: boolean;
}

/**
 * Abstract base processor for all job types
 * Provides common functionality for status updates, retries, token deduction with rollback, and dead-letter handling
 */
export abstract class BaseProcessor<T extends JobData = JobData> {
  protected monitoring: Monitoring;
  protected queueName: QueueName;
  protected tokenService: TokenService;

  constructor(queueName: QueueName, context: ProcessorContext) {
    this.queueName = queueName;
    this.monitoring = context.monitoring;
    this.tokenService = context.tokenService || new TokenService(db);
  }

  /**
   * Get token deduction configuration for this processor
   * Override this method to customize token deduction behavior
   */
  protected getTokenDeductionConfig(): TokenDeductionConfig {
    return {
      enabled: false,
      operationType: 'image_generation' as OperationType,
    };
  }

  /**
   * Main job processor function
   * Wraps the actual processing with status updates, token deduction with rollback, and error handling
   */
  getProcessor(): JobProcessor<T> {
    return async (job: Job<T, JobResult>): Promise<JobResult> => {
      const jobId = job.id || 'unknown';
      const startTime = Date.now();
      const tokenConfig = this.getTokenDeductionConfig();
      let tokenLedgerEntryId: string | undefined;
      let tokensDeducted = false;

      this.monitoring.logger.info(
        {
          jobId,
          queue: this.queueName,
          attempt: job.attemptsMade,
          data: job.data,
          tokenDeduction: tokenConfig.enabled,
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
          // Deduct tokens ONLY after successful processing
          if (tokenConfig.enabled && (job.data as any).userId) {
            const deductionResult = await this.deductTokens(
              (job.data as any).userId,
              tokenConfig,
              { jobId, queue: this.queueName }
            );

            if (deductionResult.success) {
              tokensDeducted = true;
              tokenLedgerEntryId = deductionResult.ledgerEntryId;

              this.monitoring.logger.info(
                {
                  jobId,
                  userId: (job.data as any).userId,
                  tokensDeducted: deductionResult.amount,
                  newBalance: deductionResult.newBalance,
                  ledgerEntryId: tokenLedgerEntryId,
                },
                'Tokens deducted after successful processing'
              );
            } else {
              this.monitoring.logger.error(
                {
                  jobId,
                  userId: (job.data as any).userId,
                  error: deductionResult.error,
                },
                'Token deduction failed after successful processing'
              );

              throw new Error(`Token deduction failed: ${deductionResult.error}`);
            }
          }

          // Update status to completed
          await this.updateStatus(job, GenerationStatus.completed, result.data);

          this.monitoring.logger.info(
            {
              jobId,
              queue: this.queueName,
              processingTimeMs: processingTime,
              tokensDeducted,
            },
            'Job completed successfully'
          );

          this.monitoring.trackKPI({
            type: 'generation_success',
            data: { type: this.queueName, tokensDeducted },
          });
        } else {
          // Handle failed job (no token deduction for failed jobs unless configured)
          if (tokenConfig.enabled && !tokenConfig.skipDeductionOnFailure && (job.data as any).userId) {
            const deductionResult = await this.deductTokens(
              (job.data as any).userId,
              tokenConfig,
              { jobId, queue: this.queueName, failed: true }
            );

            if (deductionResult.success) {
              tokensDeducted = true;
              tokenLedgerEntryId = deductionResult.ledgerEntryId;

              this.monitoring.logger.info(
                {
                  jobId,
                  userId: (job.data as any).userId,
                  tokensDeducted: deductionResult.amount,
                  newBalance: deductionResult.newBalance,
                },
                'Tokens deducted for failed job (configured to deduct on failure)'
              );
            }
          }

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

        // Rollback tokens if they were deducted
        if (tokensDeducted && tokenLedgerEntryId && (job.data as any).userId) {
          await this.rollbackTokens(
            (job.data as any).userId,
            tokenConfig,
            tokenLedgerEntryId,
            { jobId, error: err.message }
          );
        }

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

  /**
   * Deduct tokens from user's balance
   */
  protected async deductTokens(
    userId: string,
    tokenConfig: TokenDeductionConfig,
    metadata?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    amount?: number;
    newBalance?: number;
    ledgerEntryId?: string;
    error?: string;
  }> {
    try {
      const amount = tokenConfig.amount || this.tokenService.getOperationCost(tokenConfig.operationType);

      this.monitoring.logger.debug(
        {
          userId,
          operationType: tokenConfig.operationType,
          amount,
          metadata,
        },
        'Deducting tokens'
      );

      const result = await this.tokenService.debit(userId, {
        operationType: tokenConfig.operationType,
        amount,
        allowOverdraft: false,
        metadata,
      });

      if (result.success) {
        this.monitoring.logger.info(
          {
            userId,
            amount,
            newBalance: result.newBalance,
            ledgerEntryId: result.ledgerEntryId,
          },
          'Token deduction successful'
        );

        return {
          success: true,
          amount,
          newBalance: result.newBalance,
          ledgerEntryId: result.ledgerEntryId,
        };
      } else {
        this.monitoring.logger.error(
          {
            userId,
            amount,
            error: result.error,
          },
          'Token deduction failed'
        );

        this.monitoring.alerts.alertQueueFailure(
          this.queueName,
          new Error(`Token deduction failed: ${result.error}`),
          { userId, amount }
        );

        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      const err = error as Error;
      this.monitoring.logger.error(
        {
          err,
          userId,
        },
        'Exception during token deduction'
      );

      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Rollback token deduction in case of processing failure
   */
  protected async rollbackTokens(
    userId: string,
    tokenConfig: TokenDeductionConfig,
    originalLedgerEntryId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const amount = tokenConfig.amount || this.tokenService.getOperationCost(tokenConfig.operationType);

      this.monitoring.logger.warn(
        {
          userId,
          amount,
          originalLedgerEntryId,
          metadata,
        },
        'Rolling back token deduction'
      );

      const result = await this.tokenService.credit(userId, {
        operationType: 'refund',
        amount,
        metadata: {
          ...metadata,
          rollback: true,
          originalLedgerEntryId,
          reason: 'Processing failure after token deduction',
        },
      });

      if (result.success) {
        this.monitoring.logger.info(
          {
            userId,
            amount,
            newBalance: result.newBalance,
            ledgerEntryId: result.ledgerEntryId,
          },
          'Token rollback successful'
        );

        this.monitoring.trackKPI({
          type: 'token_rollback',
          data: {
            userId,
            amount,
            queue: this.queueName,
          },
        });
      } else {
        this.monitoring.logger.error(
          {
            userId,
            amount,
            error: result.error,
          },
          'Token rollback failed - CRITICAL'
        );

        this.monitoring.alerts.alertQueueFailure(
          this.queueName,
          new Error(`Token rollback failed: ${result.error}`),
          {
            userId,
            amount,
            originalLedgerEntryId,
            severity: 'critical',
          }
        );
      }
    } catch (error) {
      const err = error as Error;
      this.monitoring.logger.error(
        {
          err,
          userId,
        },
        'Exception during token rollback - CRITICAL'
      );

      this.monitoring.alerts.alertQueueFailure(
        this.queueName,
        new Error(`Token rollback exception: ${err.message}`),
        {
          userId,
          severity: 'critical',
        }
      );
    }
  }
}
