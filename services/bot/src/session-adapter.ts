import { SessionData } from './types';
import Redis from 'ioredis';

/**
 * Redis-backed session storage adapter for Grammy
 * Stores session data with configurable TTL
 */
export class RedisSessionAdapter {
  private readonly prefix: string;
  private readonly ttl: number;

  constructor(
    private readonly redis: Redis,
    options?: {
      prefix?: string;
      ttl?: number; // Time-to-live in seconds
    }
  ) {
    this.prefix = options?.prefix ?? 'bot:session:';
    this.ttl = options?.ttl ?? 3600; // Default 1 hour
  }

  /**
   * Get session key for a chat
   */
  private getKey(chatId: number | string): string {
    return `${this.prefix}${chatId}`;
  }

  /**
   * Read session data from Redis
   */
  async read(key: string): Promise<SessionData | undefined> {
    const data = await this.redis.get(this.getKey(key));
    if (!data) {
      return undefined;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return undefined;
    }
  }

  /**
   * Write session data to Redis with TTL
   */
  async write(key: string, value: SessionData): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.set(this.getKey(key), serialized, 'EX', this.ttl);
  }

  /**
   * Delete session data from Redis
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));
  }

  /**
   * Check if session exists
   */
  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(this.getKey(key));
    return exists === 1;
  }
}
