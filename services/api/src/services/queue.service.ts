import { Queue } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { createRedisConnection, QueueName } from '@monorepo/shared';

export interface SoraGenerationJob {
  generationId: string;
  userId: string;
  prompt: string;
  imageUrls: string[];
}

export class QueueService {
  private soraQueue: Queue;
  private monitoring: Monitoring;

  constructor(monitoring: Monitoring, redisHost: string, redisPort: number, redisPassword?: string) {
    const connection = createRedisConnection({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    });

    this.soraQueue = new Queue(QueueName.SORA_GENERATION, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
          age: 3600,
        },
        removeOnFail: {
          count: 1000,
        },
      },
    });

    this.monitoring = monitoring;
  }

  async queueSoraGeneration(data: SoraGenerationJob): Promise<void> {
    await this.soraQueue.add('sora-generation', data, {
      jobId: data.generationId,
    });

    this.monitoring.logger.info(
      {
        generationId: data.generationId,
        userId: data.userId,
        imageCount: data.imageUrls.length,
      },
      'Sora generation job queued'
    );
  }

  async close(): Promise<void> {
    await this.soraQueue.close();
  }
}
