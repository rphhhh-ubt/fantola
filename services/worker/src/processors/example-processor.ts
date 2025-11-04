import type { Job } from 'bullmq';
import type {
  JobResult,
  ImageProcessingJobData,
} from '@monorepo/shared';
import { QueueName } from '@monorepo/shared';
import { BaseProcessor, ProcessorContext } from './base-processor';

/**
 * Example processor for testing
 * Demonstrates how to implement a concrete processor
 */
export class ExampleProcessor extends BaseProcessor<ImageProcessingJobData> {
  constructor(context: ProcessorContext) {
    super(QueueName.IMAGE_PROCESSING, context);
  }

  /**
   * Process the job - implement your business logic here
   */
  protected async process(
    job: Job<ImageProcessingJobData, JobResult>
  ): Promise<JobResult> {
    const { userId, sourceUrl, tool, metadata } = job.data;

    this.monitoring.logger.info(
      {
        jobId: job.id,
        userId,
        tool,
        sourceUrl,
      },
      'Processing example job'
    );

    // Simulate progress updates
    await this.updateProgress(job, { step: 'downloading', progress: 0.2 });
    await this.sleep(100);

    await this.updateProgress(job, { step: 'processing', progress: 0.5 });
    await this.sleep(100);

    await this.updateProgress(job, { step: 'uploading', progress: 0.8 });
    await this.sleep(100);

    // Simulate some processing
    const result = {
      processedUrl: `${sourceUrl}-processed`,
      tool,
      userId,
      timestamp: Date.now(),
      metadata,
    };

    return {
      success: true,
      data: result,
      metadata: {
        processingTime: 300,
      },
    };
  }

  /**
   * Helper to simulate async work
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
