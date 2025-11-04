import { RedisSessionAdapter } from '../session-adapter';
import { MockRedisClient } from '@monorepo/test-utils';
import { SessionData } from '../types';

describe('RedisSessionAdapter', () => {
  let redis: MockRedisClient;
  let adapter: RedisSessionAdapter;

  beforeEach(() => {
    redis = new MockRedisClient() as any;
    adapter = new RedisSessionAdapter(redis as any, {
      prefix: 'test:session:',
      ttl: 60,
    });
  });

  afterEach(async () => {
    // Clear all keys
    const keys = await redis.keys('*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('read', () => {
    it('should read session data from Redis', async () => {
      const sessionData: SessionData = {
        userId: 'user-123',
        telegramId: 12345,
        username: 'testuser',
      };

      await redis.set('test:session:chat123', JSON.stringify(sessionData), 'EX', '60');

      const result = await adapter.read('chat123');

      expect(result).toEqual(sessionData);
    });

    it('should return undefined if session does not exist', async () => {
      const result = await adapter.read('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return undefined if JSON parsing fails', async () => {
      await redis.set('test:session:chat123', 'invalid json');

      const result = await adapter.read('chat123');

      expect(result).toBeUndefined();
    });
  });

  describe('write', () => {
    it('should write session data to Redis with TTL', async () => {
      const sessionData: SessionData = {
        userId: 'user-456',
        telegramId: 67890,
        username: 'anotheruser',
      };

      await adapter.write('chat456', sessionData);

      const stored = await redis.get('test:session:chat456');
      expect(JSON.parse(stored as string)).toEqual(sessionData);
    });

    it('should handle complex session data', async () => {
      const sessionData: SessionData = {
        userId: 'user-789',
        telegramId: 11111,
        username: 'complexuser',
        state: 'generating_image',
        conversationContext: {
          lastCommand: '/generate',
          lastPrompt: 'A beautiful sunset',
          messageCount: 5,
        },
      };

      await adapter.write('chat789', sessionData);

      const result = await adapter.read('chat789');
      expect(result).toEqual(sessionData);
    });
  });

  describe('delete', () => {
    it('should delete session data from Redis', async () => {
      const sessionData: SessionData = { userId: 'user-delete' };
      await adapter.write('chat-delete', sessionData);

      await adapter.delete('chat-delete');

      const result = await adapter.read('chat-delete');
      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true if session exists', async () => {
      const sessionData: SessionData = { userId: 'user-exists' };
      await adapter.write('chat-exists', sessionData);

      const exists = await adapter.has('chat-exists');

      expect(exists).toBe(true);
    });

    it('should return false if session does not exist', async () => {
      const exists = await adapter.has('nonexistent');

      expect(exists).toBe(false);
    });
  });
});
