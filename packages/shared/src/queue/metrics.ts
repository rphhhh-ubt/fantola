import type { Job } from 'bullmq';
import { JobEvent, QueueEventPayload } from './types';

// Re-export JobEvent for convenience
export { JobEvent };

/**
 * Metrics callback type
 */
export type MetricsCallback = (payload: QueueEventPayload) => void | Promise<void>;

/**
 * Metrics hooks for queue monitoring
 */
export class QueueMetricsHooks {
  private static hooks: Map<JobEvent, MetricsCallback[]> = new Map();
  private static globalHooks: MetricsCallback[] = [];

  /**
   * Register a hook for a specific event
   */
  static on(event: JobEvent, callback: MetricsCallback): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    this.hooks.get(event)!.push(callback);
  }

  /**
   * Register a global hook that fires for all events
   */
  static onAll(callback: MetricsCallback): void {
    this.globalHooks.push(callback);
  }

  /**
   * Remove a hook for a specific event
   */
  static off(event: JobEvent, callback: MetricsCallback): void {
    const hooks = this.hooks.get(event);
    if (!hooks) return;

    const index = hooks.indexOf(callback);
    if (index > -1) {
      hooks.splice(index, 1);
    }
  }

  /**
   * Remove a global hook
   */
  static offAll(callback: MetricsCallback): void {
    const index = this.globalHooks.indexOf(callback);
    if (index > -1) {
      this.globalHooks.splice(index, 1);
    }
  }

  /**
   * Clear all hooks for a specific event
   */
  static clearEvent(event: JobEvent): void {
    this.hooks.delete(event);
  }

  /**
   * Clear all hooks
   */
  static clearAll(): void {
    this.hooks.clear();
    this.globalHooks = [];
  }

  /**
   * Emit an event to all registered hooks
   */
  static async emit(payload: QueueEventPayload): Promise<void> {
    const eventHooks = this.hooks.get(payload.event) || [];
    const allHooks = [...eventHooks, ...this.globalHooks];

    const promises = allHooks.map((hook) => {
      try {
        return Promise.resolve(hook(payload));
      } catch (error) {
        console.error('Error in metrics hook:', error);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Create a payload from a job
   */
  static createPayload<T = unknown>(
    job: Job<T>,
    event: JobEvent,
    error?: Error,
  ): QueueEventPayload<T> {
    return {
      jobId: job.id || 'unknown',
      queueName: job.queueName,
      event,
      data: job.data,
      error,
      timestamp: Date.now(),
    };
  }

  /**
   * Get the number of hooks registered for an event
   */
  static getHookCount(event?: JobEvent): number {
    if (event) {
      return (this.hooks.get(event) || []).length;
    }

    let total = this.globalHooks.length;
    for (const hooks of this.hooks.values()) {
      total += hooks.length;
    }

    return total;
  }
}

/**
 * Default metrics collection (placeholder)
 * This can be replaced with actual monitoring integration
 */
export function setupDefaultMetrics(): void {
  QueueMetricsHooks.onAll(async (payload) => {
    console.log(
      `[Queue Metrics] ${payload.queueName} - ${payload.event} - Job: ${payload.jobId}`,
    );
  });

  QueueMetricsHooks.on(JobEvent.FAILED, async (payload) => {
    console.error(
      `[Queue Error] ${payload.queueName} - Job ${payload.jobId} failed:`,
      payload.error,
    );
  });

  QueueMetricsHooks.on(JobEvent.COMPLETED, async (payload) => {
    console.log(
      `[Queue Success] ${payload.queueName} - Job ${payload.jobId} completed`,
    );
  });
}

/**
 * Integration with monitoring package (placeholder)
 */
export interface MonitoringIntegration {
  trackJobAdded(queueName: string, jobId: string): void;
  trackJobCompleted(queueName: string, jobId: string, duration: number): void;
  trackJobFailed(queueName: string, jobId: string, error: Error): void;
  trackJobStalled(queueName: string, jobId: string): void;
  trackQueueMetrics(queueName: string, metrics: Record<string, number>): void;
}

/**
 * Setup metrics integration with monitoring package
 */
export function setupMonitoringIntegration(monitoring: MonitoringIntegration): void {
  const jobTimestamps = new Map<string, number>();

  QueueMetricsHooks.on(JobEvent.ADDED, async (payload) => {
    monitoring.trackJobAdded(payload.queueName, payload.jobId);
  });

  QueueMetricsHooks.on(JobEvent.ACTIVE, async (payload) => {
    jobTimestamps.set(payload.jobId, Date.now());
  });

  QueueMetricsHooks.on(JobEvent.COMPLETED, async (payload) => {
    const startTime = jobTimestamps.get(payload.jobId);
    const duration = startTime ? Date.now() - startTime : 0;
    monitoring.trackJobCompleted(payload.queueName, payload.jobId, duration);
    jobTimestamps.delete(payload.jobId);
  });

  QueueMetricsHooks.on(JobEvent.FAILED, async (payload) => {
    if (payload.error) {
      monitoring.trackJobFailed(payload.queueName, payload.jobId, payload.error);
    }
    jobTimestamps.delete(payload.jobId);
  });

  QueueMetricsHooks.on(JobEvent.STALLED, async (payload) => {
    monitoring.trackJobStalled(payload.queueName, payload.jobId);
  });
}
