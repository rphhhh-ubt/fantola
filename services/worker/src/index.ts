import { getConfig } from '@monorepo/config';
import { formatDate } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';

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

  simulateJobProcessing(monitoring);
}

function simulateJobProcessing(monitoring: Monitoring): void {
  const queueName = 'image-generation';
  const jobType = 'image';

  monitoring.logger.info({ queueName, jobType }, 'Starting job processing');

  const endTimer = monitoring.metrics.startJobTimer(queueName, jobType);

  try {
    monitoring.metrics.setActiveJobs(queueName, 1);

    monitoring.logger.debug('Processing job...');

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
