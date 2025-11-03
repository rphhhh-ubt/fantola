import { MockRedisClient, MockDatabaseClient, mockConsole } from '@monorepo/test-utils';

describe('API Service', () => {
  let redisClient: MockRedisClient;
  let dbClient: MockDatabaseClient;

  beforeEach(() => {
    redisClient = new MockRedisClient();
    dbClient = new MockDatabaseClient();
  });

  afterEach(() => {
    redisClient.clear();
    dbClient.clear();
  });

  describe('Redis Client', () => {
    it('should set and get values', async () => {
      await redisClient.set('key1', 'value1');
      const result = await redisClient.get('key1');

      expect(result).toBe('value1');
    });

    it('should handle expiration', async () => {
      await redisClient.set('key1', 'value1', { EX: 1 });

      jest.useFakeTimers();
      jest.advanceTimersByTime(2000);

      const result = await redisClient.get('key1');
      expect(result).toBeNull();

      jest.useRealTimers();
    });

    it('should delete keys', async () => {
      await redisClient.set('key1', 'value1');
      const deleted = await redisClient.del('key1');

      expect(deleted).toBe(1);
      expect(await redisClient.get('key1')).toBeNull();
    });

    it('should check key existence', async () => {
      await redisClient.set('key1', 'value1');

      expect(await redisClient.exists('key1')).toBe(1);
      expect(await redisClient.exists('nonexistent')).toBe(0);
    });
  });

  describe('Database Client', () => {
    it('should execute SELECT queries', async () => {
      const result = await dbClient.query('SELECT * FROM users');

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
      expect(dbClient.getQueries()).toHaveLength(1);
    });

    it('should execute INSERT queries', async () => {
      const result = await dbClient.query('INSERT INTO users (name) VALUES ($1)', ['John']);

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].id).toBeDefined();
    });

    it('should track query history', async () => {
      await dbClient.query('SELECT * FROM users');
      await dbClient.query('INSERT INTO users (name) VALUES ($1)', ['John']);

      const queries = dbClient.getQueries();
      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toContain('SELECT');
      expect(queries[1].params).toEqual(['John']);
    });
  });

  describe('Console Mocking', () => {
    it('should mock console methods', () => {
      const consoleMock = mockConsole();

      console.log('test log');
      console.error('test error');

      expect(consoleMock.log).toHaveBeenCalledWith('test log');
      expect(consoleMock.error).toHaveBeenCalledWith('test error');

      consoleMock.log.mockRestore();
      consoleMock.error.mockRestore();
    });
  });
});
