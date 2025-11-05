import Redis from 'ioredis';
import { StatusUpdatePayload, REDIS_CHANNELS } from './status-publisher';

/**
 * Callback for status updates
 */
export type StatusUpdateCallback = (payload: StatusUpdatePayload) => void | Promise<void>;

/**
 * Subscriber for generation status updates
 * Subscribes to Redis pub/sub channels and invokes callbacks
 */
export class StatusSubscriber {
  private redis: Redis;
  private callbacks: Map<string, Set<StatusUpdateCallback>>;

  constructor(redis: Redis) {
    this.redis = redis;
    this.callbacks = new Map();

    // Set up message handler
    this.redis.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });
  }

  /**
   * Subscribe to all status updates
   */
  async subscribeAll(callback: StatusUpdateCallback): Promise<void> {
    const channel = REDIS_CHANNELS.STATUS_UPDATES;

    if (!this.callbacks.has(channel)) {
      this.callbacks.set(channel, new Set());
      await this.redis.subscribe(channel);
    }

    this.callbacks.get(channel)!.add(callback);
  }

  /**
   * Subscribe to status updates for a specific user
   */
  async subscribeUser(userId: string, callback: StatusUpdateCallback): Promise<void> {
    const channel = REDIS_CHANNELS.USER_UPDATES(userId);

    if (!this.callbacks.has(channel)) {
      this.callbacks.set(channel, new Set());
      await this.redis.subscribe(channel);
    }

    this.callbacks.get(channel)!.add(callback);
  }

  /**
   * Unsubscribe from all status updates
   */
  async unsubscribeAll(callback: StatusUpdateCallback): Promise<void> {
    const channel = REDIS_CHANNELS.STATUS_UPDATES;
    const callbacks = this.callbacks.get(channel);

    if (callbacks) {
      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.callbacks.delete(channel);
        await this.redis.unsubscribe(channel);
      }
    }
  }

  /**
   * Unsubscribe from user-specific status updates
   */
  async unsubscribeUser(userId: string, callback: StatusUpdateCallback): Promise<void> {
    const channel = REDIS_CHANNELS.USER_UPDATES(userId);
    const callbacks = this.callbacks.get(channel);

    if (callbacks) {
      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.callbacks.delete(channel);
        await this.redis.unsubscribe(channel);
      }
    }
  }

  /**
   * Handle incoming message from Redis
   */
  private handleMessage(channel: string, message: string): void {
    try {
      const payload: StatusUpdatePayload = JSON.parse(message);
      const callbacks = this.callbacks.get(channel);

      if (callbacks) {
        callbacks.forEach((callback) => {
          // Call callback asynchronously to avoid blocking
          Promise.resolve(callback(payload)).catch((error) => {
            console.error('Error in status update callback:', error);
          });
        });
      }
    } catch (error) {
      console.error('Error parsing status update message:', error);
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
