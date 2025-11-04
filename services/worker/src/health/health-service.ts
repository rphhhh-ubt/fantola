import type { Monitoring } from '@monorepo/monitoring';
import type { Worker } from 'bullmq';

/**
 * Worker health status
 */
export interface WorkerHealth {
  healthy: boolean;
  uptime: number;
  lastHeartbeat: number;
  activeJobs: number;
  processedJobs: number;
  failedJobs: number;
  queues: QueueHealth[];
}

/**
 * Queue health information
 */
export interface QueueHealth {
  name: string;
  isPaused: boolean;
  isRunning: boolean;
  activeJobs: number;
}

/**
 * Health reporting and heartbeat service
 */
export class HealthService {
  private monitoring: Monitoring;
  private workers: Map<string, Worker>;
  private startTime: number;
  private lastHeartbeat: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private processedJobs: number = 0;
  private failedJobs: number = 0;

  constructor(monitoring: Monitoring) {
    this.monitoring = monitoring;
    this.workers = new Map();
    this.startTime = Date.now();
    this.lastHeartbeat = Date.now();
  }

  /**
   * Register a worker for health monitoring
   */
  registerWorker(name: string, worker: Worker): void {
    this.workers.set(name, worker);

    // Listen to worker events to track metrics
    worker.on('completed', () => {
      this.processedJobs++;
    });

    worker.on('failed', () => {
      this.failedJobs++;
    });

    this.monitoring.logger.info(
      { workerName: name },
      'Worker registered for health monitoring'
    );
  }

  /**
   * Unregister a worker
   */
  unregisterWorker(name: string): void {
    this.workers.delete(name);
    this.monitoring.logger.info(
      { workerName: name },
      'Worker unregistered from health monitoring'
    );
  }

  /**
   * Start heartbeat reporting
   */
  startHeartbeat(intervalMs: number = 30000): void {
    if (this.heartbeatInterval) {
      this.monitoring.logger.warn('Heartbeat already started');
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);

    this.monitoring.logger.info(
      { intervalMs },
      'Heartbeat started'
    );
  }

  /**
   * Stop heartbeat reporting
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.monitoring.logger.info('Heartbeat stopped');
    }
  }

  /**
   * Send a heartbeat signal
   */
  private sendHeartbeat(): void {
    this.lastHeartbeat = Date.now();

    const health = this.getHealth();

    this.monitoring.logger.debug(
      {
        uptime: health.uptime,
        activeJobs: health.activeJobs,
        processedJobs: health.processedJobs,
        failedJobs: health.failedJobs,
        queues: health.queues.length,
      },
      'Worker heartbeat'
    );

    // Update metrics
    for (const queueHealth of health.queues) {
      this.monitoring.metrics.setActiveJobs(queueHealth.name, queueHealth.activeJobs);
    }
  }

  /**
   * Get current health status
   */
  getHealth(): WorkerHealth {
    const now = Date.now();
    const uptime = now - this.startTime;

    // Calculate total active jobs across all workers
    let totalActiveJobs = 0;
    const queues: QueueHealth[] = [];

    for (const [name, worker] of this.workers.entries()) {
      const activeCount = worker.isRunning() ? 1 : 0; // Simplified - in production, use worker.getActiveCount()
      totalActiveJobs += activeCount;

      queues.push({
        name,
        isPaused: worker.isPaused(),
        isRunning: worker.isRunning(),
        activeJobs: activeCount,
      });
    }

    const healthy = this.isHealthy();

    return {
      healthy,
      uptime,
      lastHeartbeat: this.lastHeartbeat,
      activeJobs: totalActiveJobs,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      queues,
    };
  }

  /**
   * Check if worker is healthy
   */
  isHealthy(): boolean {
    const now = Date.now();
    const timeSinceHeartbeat = now - this.lastHeartbeat;

    // Worker is unhealthy if:
    // 1. No heartbeat in the last 60 seconds
    // 2. All workers are paused
    // 3. Too many failures recently

    if (timeSinceHeartbeat > 60000) {
      return false;
    }

    const allPaused = Array.from(this.workers.values()).every((w) => w.isPaused());
    if (allPaused && this.workers.size > 0) {
      return false;
    }

    // Check failure rate
    const totalJobs = this.processedJobs + this.failedJobs;
    if (totalJobs > 10) {
      const failureRate = this.failedJobs / totalJobs;
      if (failureRate > 0.5) {
        // More than 50% failure rate
        return false;
      }
    }

    return true;
  }

  /**
   * Reset health counters
   */
  resetCounters(): void {
    this.processedJobs = 0;
    this.failedJobs = 0;
    this.monitoring.logger.info('Health counters reset');
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get formatted health report
   */
  getHealthReport(): string {
    const health = this.getHealth();
    const uptimeSeconds = Math.floor(health.uptime / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);

    const lines = [
      '=== Worker Health Report ===',
      `Status: ${health.healthy ? '✓ HEALTHY' : '✗ UNHEALTHY'}`,
      `Uptime: ${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
      `Active Jobs: ${health.activeJobs}`,
      `Processed: ${health.processedJobs}`,
      `Failed: ${health.failedJobs}`,
      '',
      'Queues:',
      ...health.queues.map(
        (q) =>
          `  - ${q.name}: ${q.isRunning ? '✓ Running' : '✗ Stopped'} ${q.isPaused ? '(Paused)' : ''}`
      ),
    ];

    return lines.join('\n');
  }
}
