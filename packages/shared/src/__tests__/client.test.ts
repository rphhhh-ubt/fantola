import { DatabaseClient, db } from '../db';

describe('DatabaseClient', () => {
  afterEach(async () => {
    await DatabaseClient.disconnect();
  });

  describe('initialize', () => {
    it('should initialize database client', () => {
      const client = DatabaseClient.initialize();
      expect(client).toBeDefined();
      expect(DatabaseClient.isConnected()).toBe(true);
    });

    it('should return same instance on multiple calls', () => {
      const client1 = DatabaseClient.initialize();
      const client2 = DatabaseClient.initialize();
      expect(client1).toBe(client2);
    });

    it('should accept options', () => {
      const client = DatabaseClient.initialize({
        logQueries: true,
      });
      expect(client).toBeDefined();
    });

    it('should accept onError callback', () => {
      const onError = jest.fn();
      const client = DatabaseClient.initialize({
        onError,
      });
      expect(client).toBeDefined();
    });
  });

  describe('getInstance', () => {
    it('should return existing instance', () => {
      DatabaseClient.initialize();
      const instance = DatabaseClient.getInstance();
      expect(instance).toBeDefined();
    });

    it('should initialize if not exists', () => {
      const instance = DatabaseClient.getInstance();
      expect(instance).toBeDefined();
      expect(DatabaseClient.isConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect database', async () => {
      DatabaseClient.initialize();
      expect(DatabaseClient.isConnected()).toBe(true);

      await DatabaseClient.disconnect();
      expect(DatabaseClient.isConnected()).toBe(false);
    });

    it('should be idempotent', async () => {
      DatabaseClient.initialize();
      await DatabaseClient.disconnect();
      await DatabaseClient.disconnect();
      expect(DatabaseClient.isConnected()).toBe(false);
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', async () => {
      await DatabaseClient.disconnect();
      expect(DatabaseClient.isConnected()).toBe(false);
    });

    it('should return true when connected', () => {
      DatabaseClient.initialize();
      expect(DatabaseClient.isConnected()).toBe(true);
    });
  });

  describe('singleton export', () => {
    it('should export singleton db instance', () => {
      expect(db).toBeDefined();
      expect(db.$connect).toBeDefined();
      expect(db.$disconnect).toBeDefined();
    });
  });

  describe('error normalization', () => {
    beforeEach(() => {
      DatabaseClient.initialize();
    });

    it('should handle validation errors', async () => {
      try {
        await db.user.create({
          data: {
            // @ts-expect-error - intentionally invalid
            invalid: 'test',
          },
        });
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle not found errors gracefully', async () => {
      try {
        await db.user.update({
          where: { telegramId: 'non-existent-telegram-id-999999' },
          data: { username: 'test' },
        });
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });
  });
});
