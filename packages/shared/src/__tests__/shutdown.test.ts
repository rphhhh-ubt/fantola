import { ShutdownManager, DatabaseClient } from '../db';

describe('ShutdownManager', () => {
  let shutdownManager: ShutdownManager;
  let logMessages: string[];

  beforeEach(() => {
    logMessages = [];
    shutdownManager = new ShutdownManager({
      logger: (message: string) => {
        logMessages.push(message);
      },
    });

    // Initialize database for tests
    DatabaseClient.initialize();
  });

  afterEach(async () => {
    // Clean up after each test
    if (DatabaseClient.isConnected()) {
      await DatabaseClient.disconnect();
    }
  });

  describe('addCleanupHandler', () => {
    it('should register cleanup handler', () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      shutdownManager.addCleanupHandler(handler);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should execute cleanup handlers', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      shutdownManager.addCleanupHandler(handler1);
      shutdownManager.addCleanupHandler(handler2);

      await shutdownManager.shutdown();

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should disconnect database', async () => {
      expect(DatabaseClient.isConnected()).toBe(true);

      await shutdownManager.shutdown();

      expect(DatabaseClient.isConnected()).toBe(false);
    });

    it('should log shutdown events', async () => {
      await shutdownManager.shutdown();

      expect(logMessages).toContain('Manual shutdown triggered...');
      expect(logMessages).toContain('Manual shutdown completed');
    });

    it('should handle cleanup errors', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Cleanup failed'));

      shutdownManager.addCleanupHandler(handler);

      await expect(shutdownManager.shutdown()).rejects.toThrow('Cleanup failed');
      expect(logMessages.some((msg) => msg.includes('Error during manual shutdown'))).toBe(true);
    });

    it('should prevent multiple shutdowns', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      shutdownManager.addCleanupHandler(handler);

      await shutdownManager.shutdown();
      await shutdownManager.shutdown(); // Second call should do nothing

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('constructor', () => {
    it('should accept cleanup handlers in constructor', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      const manager = new ShutdownManager({
        cleanupHandlers: [handler],
        logger: (message: string) => {
          logMessages.push(message);
        },
      });

      await manager.shutdown();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should use default logger if not provided', () => {
      const manager = new ShutdownManager();
      expect(manager).toBeDefined();
    });
  });
});
