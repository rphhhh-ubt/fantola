import Redis from 'ioredis';
import { GenerationStatus } from '@monorepo/database';
import { GenerationType } from '../queue/events';

/**
 * Status update payload published to Redis
 */
export interface StatusUpdatePayload {
  generationId: string;
  userId: string;
  type: GenerationType;
  status: GenerationStatus;
  timestamp: number;
  metadata?: {
    tool?: string;
    prompt?: string;
    resultUrls?: string[];
    errorMessage?: string;
    tokensUsed?: number;
    [key: string]: unknown;
  };
}

/**
 * Redis pub/sub channel names
 */
export const REDIS_CHANNELS = {
  STATUS_UPDATES: 'generation:status-updates',
  USER_UPDATES: (userId: string) => `generation:user:${userId}`,
} as const;

/**
 * Publisher for generation status updates
 * Publishes status changes to Redis pub/sub channels
 */
export class StatusPublisher {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Publish a status update to Redis
   * Publishes to both:
   * - Global channel: generation:status-updates
   * - User-specific channel: generation:user:{userId}
   */
  async publishStatusUpdate(payload: StatusUpdatePayload): Promise<void> {
    const message = JSON.stringify(payload);

    // Publish to global channel
    await this.redis.publish(REDIS_CHANNELS.STATUS_UPDATES, message);

    // Publish to user-specific channel for targeted notifications
    await this.redis.publish(REDIS_CHANNELS.USER_UPDATES(payload.userId), message);
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
