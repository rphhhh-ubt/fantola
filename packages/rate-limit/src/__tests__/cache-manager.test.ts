import { MockRedisClient } from '@monorepo/test-utils';
import { CacheManager } from '../cache-manager';

describe('CacheManager', () => {
  let redis: MockRedisClient;
  let cache: CacheManager;

  beforeEach(() => {
    redis = new MockRedisClient();
    cache = new CacheManager(redis as any, 'test', 300);
  });

  afterEach(() => {
    redis.clear();
  });

  describe('get and set', () => {
    it('should set and get a value', async () => {
      await cache.set('key1', { name: 'test' });
      const value = await cache.get<{ name: string }>('key1');

      expect(value).toEqual({ name: 'test' });
    });

    it('should return null for non-existent key', async () => {
      const value = await cache.get('nonexistent');

      expect(value).toBeNull();
    });

    it('should set value with custom TTL', async () => {
      await cache.set('key1', 'value1', { ttl: 60 });
      const value = await cache.get('key1');

      expect(value).toBe('value1');
    });

    it('should handle complex objects', async () => {
      const obj = {
        id: '123',
        nested: { value: 42 },
        array: [1, 2, 3],
      };

      await cache.set('complex', obj);
      const value = await cache.get<typeof obj>('complex');

      expect(value).toEqual(obj);
    });
  });

  describe('getOrSet', () => {
    it('should fetch and cache on miss', async () => {
      const fetcher = jest.fn(async () => ({ data: 'fetched' }));

      const value1 = await cache.getOrSet('key1', fetcher);
      const value2 = await cache.getOrSet('key1', fetcher);

      expect(value1).toEqual({ data: 'fetched' });
      expect(value2).toEqual({ data: 'fetched' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should use cached value on hit', async () => {
      await cache.set('key1', 'cached');

      const fetcher = jest.fn(async () => 'fetched');
      const value = await cache.getOrSet('key1', fetcher);

      expect(value).toBe('cached');
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');

      const value = await cache.get('key1');
      expect(value).toBeNull();
    });

    it('should handle deleting non-existent key', async () => {
      await expect(cache.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      await cache.deleteMany(['key1', 'key2']);

      const value1 = await cache.get('key1');
      const value2 = await cache.get('key2');
      const value3 = await cache.get('key3');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
      expect(value3).toBe('value3');
    });

    it('should handle empty array', async () => {
      await expect(cache.deleteMany([])).resolves.not.toThrow();
    });
  });

  describe('tags', () => {
    it('should invalidate by tag', async () => {
      await cache.set('key1', 'value1', { tags: ['user:1'] });
      await cache.set('key2', 'value2', { tags: ['user:1'] });
      await cache.set('key3', 'value3', { tags: ['user:2'] });

      await cache.invalidateByTag('user:1');

      const value1 = await cache.get('key1');
      const value2 = await cache.get('key2');
      const value3 = await cache.get('key3');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
      expect(value3).toBe('value3');
    });

    it('should handle invalidating non-existent tag', async () => {
      await expect(cache.invalidateByTag('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('exists and ttl', () => {
    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');

      const exists1 = await cache.exists('key1');
      const exists2 = await cache.exists('key2');

      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });

    it('should return TTL for key', async () => {
      await cache.set('key1', 'value1', { ttl: 300 });

      const ttl = await cache.ttl('key1');

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('should return -2 for non-existent key', async () => {
      const ttl = await cache.ttl('nonexistent');

      expect(ttl).toBe(-2);
    });
  });

  describe('clear', () => {
    it('should clear all cache entries with prefix', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      const value1 = await cache.get('key1');
      const value2 = await cache.get('key2');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });
  });

  describe('warmCache', () => {
    it('should warm cache with multiple entries', async () => {
      await cache.warmCache([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3', options: { ttl: 60 } },
      ]);

      const value1 = await cache.get('key1');
      const value2 = await cache.get('key2');
      const value3 = await cache.get('key3');

      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      expect(value3).toBe('value3');
    });
  });

  describe('getMany and setMany', () => {
    it('should get multiple keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const values = await cache.getMany<string>(['key1', 'key2', 'key3']);

      expect(values.size).toBe(2);
      expect(values.get('key1')).toBe('value1');
      expect(values.get('key2')).toBe('value2');
      expect(values.has('key3')).toBe(false);
    });

    it('should set multiple keys', async () => {
      await cache.setMany([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2', ttl: 60 },
      ]);

      const value1 = await cache.get('key1');
      const value2 = await cache.get('key2');

      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
    });

    it('should handle empty arrays', async () => {
      await expect(cache.getMany([])).resolves.toEqual(new Map());
      await expect(cache.setMany([])).resolves.not.toThrow();
    });
  });

  describe('graceful degradation', () => {
    it('should not throw on set error', async () => {
      const brokenRedis = {
        set: jest.fn().mockRejectedValue(new Error('Redis error')),
      } as any;

      const brokenCache = new CacheManager(brokenRedis);

      await expect(brokenCache.set('key', 'value')).resolves.not.toThrow();
    });

    it('should return null on get error', async () => {
      const brokenRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis error')),
      } as any;

      const brokenCache = new CacheManager(brokenRedis);

      const value = await brokenCache.get('key');
      expect(value).toBeNull();
    });
  });
});
