import { RedisConnectionFactory, createRedisConnection } from '../../queue/connection';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((config: any) => {
    const listeners: Record<string, Array<(...args: any[]) => void>> = {};

    return {
      on: jest.fn((event: string, callback: (...args: any[]) => void) => {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(callback);
      }),
      emit: jest.fn((event: string, ...args: any[]) => {
        if (listeners[event]) {
          listeners[event].forEach((callback) => callback(...args));
        }
      }),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
      _config: config,
      _listeners: listeners,
    };
  });
});

describe('RedisConnectionFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await RedisConnectionFactory.closeAllConnections();
  });

  describe('createConnection', () => {
    it('should create a new Redis connection with default config', () => {
      const connection = RedisConnectionFactory.createConnection('test');

      expect(connection).toBeDefined();
      expect(connection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(connection.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(connection.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(connection.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should create a new Redis connection with custom config', () => {
      const config = {
        host: 'custom-redis',
        port: 6380,
        password: 'secret',
        db: 1,
      };

      const connection = RedisConnectionFactory.createConnection('custom', config);

      expect(connection).toBeDefined();
      expect((connection as any)._config).toMatchObject({
        host: 'custom-redis',
        port: 6380,
        password: 'secret',
        db: 1,
      });
    });

    it('should create a new Redis connection with URL', () => {
      const config = {
        url: 'redis://localhost:6379/0',
      };

      const connection = RedisConnectionFactory.createConnection('url-test', config);

      expect(connection).toBeDefined();
      expect((connection as any)._config).toBe('redis://localhost:6379/0');
    });

    it('should reuse existing connection with same config', () => {
      const connection1 = RedisConnectionFactory.createConnection('reuse');
      const connection2 = RedisConnectionFactory.createConnection('reuse');

      expect(connection1).toBe(connection2);
    });

    it('should create different connections with different configs', () => {
      const connection1 = RedisConnectionFactory.createConnection('test1', { host: 'host1' });
      const connection2 = RedisConnectionFactory.createConnection('test1', { host: 'host2' });

      expect(connection1).not.toBe(connection2);
    });
  });

  describe('getConnection', () => {
    it('should return existing connection', () => {
      const created = RedisConnectionFactory.createConnection('get-test');
      const retrieved = RedisConnectionFactory.getConnection('get-test');

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existing connection', () => {
      const retrieved = RedisConnectionFactory.getConnection('non-existing');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('closeConnection', () => {
    it('should close a specific connection', async () => {
      const connection = RedisConnectionFactory.createConnection('close-test');
      await RedisConnectionFactory.closeConnection('close-test');

      expect(connection.quit).toHaveBeenCalled();
      expect(RedisConnectionFactory.hasConnection('close-test')).toBe(false);
    });

    it('should not throw if connection does not exist', async () => {
      await expect(
        RedisConnectionFactory.closeConnection('non-existing'),
      ).resolves.not.toThrow();
    });
  });

  describe('closeAllConnections', () => {
    it('should close all connections', async () => {
      const conn1 = RedisConnectionFactory.createConnection('test1');
      const conn2 = RedisConnectionFactory.createConnection('test2');

      await RedisConnectionFactory.closeAllConnections();

      expect(conn1.quit).toHaveBeenCalled();
      expect(conn2.quit).toHaveBeenCalled();
      expect(RedisConnectionFactory.getConnectionCount()).toBe(0);
    });
  });

  describe('getConnectionCount', () => {
    it('should return the correct number of connections', () => {
      expect(RedisConnectionFactory.getConnectionCount()).toBe(0);

      RedisConnectionFactory.createConnection('count1');
      expect(RedisConnectionFactory.getConnectionCount()).toBe(1);

      RedisConnectionFactory.createConnection('count2');
      expect(RedisConnectionFactory.getConnectionCount()).toBe(2);
    });
  });

  describe('hasConnection', () => {
    it('should return true if connection exists', () => {
      RedisConnectionFactory.createConnection('exists');
      expect(RedisConnectionFactory.hasConnection('exists')).toBe(true);
    });

    it('should return false if connection does not exist', () => {
      expect(RedisConnectionFactory.hasConnection('does-not-exist')).toBe(false);
    });
  });

  describe('setDefaultConfig', () => {
    it('should update default configuration', () => {
      const newConfig = {
        host: 'new-redis',
        port: 6380,
      };

      RedisConnectionFactory.setDefaultConfig(newConfig);

      const connection = RedisConnectionFactory.createConnection('default-config-test');
      expect((connection as any)._config).toMatchObject({
        host: 'new-redis',
        port: 6380,
      });
    });
  });

  describe('createRedisConnection helper', () => {
    it('should create a connection using the factory', () => {
      const connection = createRedisConnection();

      expect(connection).toBeDefined();
      expect(RedisConnectionFactory.hasConnection('default')).toBe(true);
    });

    it('should create a connection with custom config', () => {
      const config = {
        host: 'custom-host',
        port: 6380,
      };

      const connection = createRedisConnection(config);

      expect(connection).toBeDefined();
      expect((connection as any)._config).toMatchObject({
        host: 'custom-host',
        port: 6380,
      });
    });
  });
});
