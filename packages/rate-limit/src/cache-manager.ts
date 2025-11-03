import type { Redis } from 'ioredis';
import { CacheOptions } from './types';

export class CacheManager {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly defaultTtl: number;

  constructor(redis: Redis, keyPrefix: string = 'cache', defaultTtl: number = 300) {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
    this.defaultTtl = defaultTtl;
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(this.buildKey(key));
      if (!data) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch (error) {
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl ?? this.defaultTtl;
      const redisKey = this.buildKey(key);

      await this.redis.set(redisKey, JSON.stringify(value), 'EX', ttl);

      if (options?.tags && options.tags.length > 0) {
        await this.addToTags(redisKey, options.tags, ttl);
      }
    } catch (error) {
      // Graceful degradation - log but don't throw
      console.error('Cache set error:', error);
    }
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, options);
    return value;
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.buildKey(key));
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    try {
      const redisKeys = keys.map((k) => this.buildKey(k));
      await this.redis.del(...redisKeys);
    } catch (error) {
      console.error('Cache deleteMany error:', error);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    try {
      const tagKey = this.buildTagKey(tag);
      const keys = await this.redis.smembers(tagKey);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      await this.redis.del(tagKey);
    } catch (error) {
      console.error('Cache invalidateByTag error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.buildKey(key));
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(this.buildKey(key));
    } catch (error) {
      return -2;
    }
  }

  async clear(): Promise<void> {
    try {
      const pattern = `${this.keyPrefix}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  private buildTagKey(tag: string): string {
    return `${this.keyPrefix}:tag:${tag}`;
  }

  private async addToTags(key: string, tags: string[], ttl: number): Promise<void> {
    const multi = this.redis.multi();

    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);
      multi.sadd(tagKey, key);
      multi.expire(tagKey, ttl + 60);
    }

    await multi.exec();
  }

  async warmCache<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    const multi = this.redis.multi();

    for (const entry of entries) {
      const ttl = entry.options?.ttl ?? this.defaultTtl;
      const redisKey = this.buildKey(entry.key);
      multi.set(redisKey, JSON.stringify(entry.value), 'EX', ttl);
    }

    await multi.exec();
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    if (keys.length === 0) {
      return new Map();
    }

    try {
      const redisKeys = keys.map((k) => this.buildKey(k));
      const values = await this.redis.mget(...redisKeys);

      const result = new Map<string, T>();
      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            result.set(key, JSON.parse(value) as T);
          } catch {
            // Skip invalid JSON
          }
        }
      });

      return result;
    } catch (error) {
      return new Map();
    }
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      const multi = this.redis.multi();

      for (const entry of entries) {
        const ttl = entry.ttl ?? this.defaultTtl;
        const redisKey = this.buildKey(entry.key);
        multi.set(redisKey, JSON.stringify(entry.value), 'EX', ttl);
      }

      await multi.exec();
    } catch (error) {
      console.error('Cache setMany error:', error);
    }
  }
}
