import type { Monitoring } from '@monorepo/monitoring';
import type { Redis } from 'ioredis';
import {
  QueueConsumer,
  QueueName,
  createConsumer,
} from '@monorepo/shared';
import type { BaseProcessor } from '../processors/base-processor';
import { HealthService } from '../health/health-service';

/**
 * Worker configuration
 */
export interface WorkerConfig {
  concurrency?: number;
  maxJobsPerWorker?: number;
  enableHealthChecks?: boolean;
  heartbeatInterval?: number;
}

/**
 * Processor registration
 */
export interface ProcessorRegistration {
  queueName: QueueName;
  processor: BaseProcessor<any>;
  concurrency?: number;
}

/**
 * Main worker service that orchestrates job processing
 * Manages multiple queue consumers with concurrency control
 */
export class WorkerService {
  private monitoring: Monitoring;
  private redis: Redis;
  private config: WorkerConfig;
  private consumers: Map<string, QueueConsumer<any>>;
  private healthService: HealthService;
  private isRunning: boolean = false;

  constructor(
    monitoring: Monitoring,
    redis: Redis,
    config: WorkerConfig = {}
  ) {
    this.monitoring = monitoring;
    this.redis = redis;
    this.config = {
      concurrency: config.concurrency || 5,
      maxJobsPerWorker: config.maxJobsPerWorker || 50,
      enableHealthChecks: config.enableHealthChecks ?? true,
      heartbeatInterval: config.heartbeatInterval || 30000,
    };
    this.consumers = new Map();
    this.healthService = new HealthService(monitoring);
  }

  /**
   * Register a processor for a specific queue
   */
  registerProcessor(registration: ProcessorRegistration): void {
    const { queueName, processor, concurrency } = registration;

    if (this.consumers.has(queueName)) {
      throw new Error(`Processor for queue ${queueName} already registered`);
    }

    const consumer = createConsumer(
      queueName,
      processor.getProcessor(),
      this.redis,
      {
        concurrency: concurrency || this.config.concurrency,
        limiter: {
          max: this.config.maxJobsPerWorker || 50,
          duration: 1000,
        },
      }
    );

    this.consumers.set(queueName, consumer);
    this.healthService.registerWorker(queueName, consumer.getWorker());

    this.monitoring.logger.info(
      {
        queueName,
        concurrency: concurrency || this.config.concurrency,
      },
      'Processor registered'
    );
  }

  /**
   * Unregister a processor
   */
  async unregisterProcessor(queueName: QueueName): Promise<void> {
    const consumer = this.consumers.get(queueName);
    if (!consumer) {
      this.monitoring.logger.warn(
        { queueName },
        'Attempted to unregister non-existent processor'
      );
      return;
    }

    await consumer.close();
    this.consumers.delete(queueName);
    this.healthService.unregisterWorker(queueName);

    this.monitoring.logger.info(
      { queueName },
      'Processor unregistered'
    );
  }

  /**
   * Start all registered workers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.monitoring.logger.warn('Worker service already running');
      return;
    }

    this.isRunning = true;

    this.monitoring.logger.info(
      {
        queues: Array.from(this.consumers.keys()),
        concurrency: this.config.concurrency,
      },
      'Starting worker service'
    );

    // Start health checks
    if (this.config.enableHealthChecks) {
      this.healthService.startHeartbeat(this.config.heartbeatInterval);
    }

    this.monitoring.logger.info('Worker service started successfully');
  }

  /**
   * Stop all workers gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.monitoring.logger.warn('Worker service not running');
      return;
    }

    this.monitoring.logger.info('Stopping worker service gracefully...');

    // Stop health checks
    this.healthService.stopHeartbeat();

    // Close all consumers
    const closePromises = Array.from(this.consumers.entries()).map(
      async ([queueName, consumer]) => {
        this.monitoring.logger.info({ queueName }, 'Closing consumer');
        await consumer.close();
      }
    );

    await Promise.all(closePromises);

    this.consumers.clear();
    this.isRunning = false;

    this.monitoring.logger.info('Worker service stopped');
  }

  /**
   * Pause all workers
   */
  async pauseAll(): Promise<void> {
    this.monitoring.logger.info('Pausing all workers');

    const pausePromises = Array.from(this.consumers.values()).map((consumer) =>
      consumer.pause()
    );

    await Promise.all(pausePromises);

    this.monitoring.logger.info('All workers paused');
  }

  /**
   * Resume all workers
   */
  async resumeAll(): Promise<void> {
    this.monitoring.logger.info('Resuming all workers');

    const resumePromises = Array.from(this.consumers.values()).map((consumer) =>
      consumer.resume()
    );

    await Promise.all(resumePromises);

    this.monitoring.logger.info('All workers resumed');
  }

  /**
   * Pause a specific worker
   */
  async pause(queueName: QueueName): Promise<void> {
    const consumer = this.consumers.get(queueName);
    if (!consumer) {
      throw new Error(`No consumer found for queue ${queueName}`);
    }

    await consumer.pause();
    this.monitoring.logger.info({ queueName }, 'Worker paused');
  }

  /**
   * Resume a specific worker
   */
  async resume(queueName: QueueName): Promise<void> {
    const consumer = this.consumers.get(queueName);
    if (!consumer) {
      throw new Error(`No consumer found for queue ${queueName}`);
    }

    await consumer.resume();
    this.monitoring.logger.info({ queueName }, 'Worker resumed');
  }

  /**
   * Get health status
   */
  getHealth() {
    return this.healthService.getHealth();
  }

  /**
   * Get health report
   */
  getHealthReport(): string {
    return this.healthService.getHealthReport();
  }

  /**
   * Check if service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get registered queue names
   */
  getRegisteredQueues(): string[] {
    return Array.from(this.consumers.keys());
  }

  /**
   * Get consumer for a specific queue
   */
  getConsumer(queueName: QueueName): QueueConsumer<any> | undefined {
    return this.consumers.get(queueName);
  }
}
