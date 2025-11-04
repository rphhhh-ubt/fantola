import { getConfig } from '@monorepo/config';
import { formatDate } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';
import { ImageProcessor } from './processors/image-processor';
import { ImageTool, ImageProcessingJob } from './types';
import { StorageConfig } from './storage';

async function main() {
  const config = getConfig();

  const monitoring = new Monitoring({
    service: 'worker',
    environment: config.nodeEnv,
  });

  if (config.enableMetrics) {
    await monitoring.startMetricsServer(config.metricsPort);
  }

  monitoring.logger.info(
    {
      environment: config.nodeEnv,
      metricsPort: config.metricsPort,
      metricsEnabled: config.enableMetrics,
    },
    'Worker service started'
  );

  monitoring.logger.info(
    { startTime: formatDate(new Date()) },
    'Processing jobs started'
  );

  const storageType = (process.env.STORAGE_TYPE || 's3') as 'local' | 's3';
  const storageConfig: StorageConfig = {
    type: storageType,
    baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost/static',
    localBasePath: process.env.STORAGE_LOCAL_PATH || '/var/www/storage',
    s3: {
      bucket: process.env.S3_BUCKET || 'image-processing',
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  };

  monitoring.logger.info(
    { storageType, baseUrl: storageConfig.baseUrl },
    'Storage configuration initialized'
  );

  const imageProcessor = new ImageProcessor(storageConfig, monitoring);

  await simulateJobProcessing(monitoring, imageProcessor);
}

async function simulateJobProcessing(
  monitoring: Monitoring,
  imageProcessor: ImageProcessor
): Promise<void> {
  const queueName = 'image-generation';
  const jobType = 'image';

  monitoring.logger.info({ queueName, jobType }, 'Starting job processing');

  const endTimer = monitoring.metrics.startJobTimer(queueName, jobType);

  try {
    monitoring.metrics.setActiveJobs(queueName, 1);

    monitoring.logger.debug('Processing job...');

    const sampleJob: ImageProcessingJob = {
      id: `job-${Date.now()}`,
      tool: ImageTool.DALL_E,
      sourceUrl: 'https://example.com/sample-image.jpg',
      userId: 'user-123',
      metadata: {
        prompt: 'A beautiful landscape',
      },
    };

    const result = await imageProcessor.processImage(sampleJob);

    if (result.success) {
      monitoring.logger.info(
        {
          jobId: result.jobId,
          variants: result.variants.length,
          processingTimeMs: result.processingTimeMs,
        },
        'Image processed successfully'
      );
    }

    monitoring.trackKPI({
      type: 'token_spend',
      data: { tokens: 1500, model: 'dall-e-3', type: 'image' },
    });

    monitoring.trackKPI({
      type: 'generation_success',
      data: { type: jobType },
    });

    monitoring.logger.info({ queueName, jobType }, 'Job completed successfully');
  } catch (error) {
    monitoring.metrics.trackQueueFailure(queueName, (error as Error).name);
    monitoring.alerts.alertQueueFailure(queueName, error as Error, {
      jobType,
      timestamp: new Date().toISOString(),
    });

    monitoring.trackKPI({
      type: 'generation_failure',
      data: { type: jobType, errorType: (error as Error).name },
    });

    monitoring.logger.error({ err: error, queueName, jobType }, 'Job failed');
  } finally {
    endTimer();
    monitoring.metrics.setActiveJobs(queueName, 0);
  }
}

main().catch((error) => {
  const monitoring = new Monitoring({ service: 'worker' });
  monitoring.handleCriticalError(error, { context: 'startup' });
  process.exit(1);
});
