import { DatabaseClient, db, repository } from '../db';

describe('Database Connectivity Smoke Tests', () => {
  beforeAll(async () => {
    // Initialize database client
    DatabaseClient.initialize({
      logQueries: false,
    });
  });

  afterAll(async () => {
    // Disconnect after all tests
    await DatabaseClient.disconnect();
  });

  describe('Database Connection', () => {
    it('should connect to database successfully', async () => {
      const result = await db.$queryRaw`SELECT 1 as result`;
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should check database connection status', () => {
      expect(DatabaseClient.isConnected()).toBe(true);
    });

    it('should execute raw SQL queries', async () => {
      const result = await db.$queryRaw`SELECT NOW() as now`;
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Repository Helpers', () => {
    it('should check if model exists', async () => {
      // This will check if the User model is accessible
      // Even if there are no records, the model should exist
      const count = await repository.count('user');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle pagination', async () => {
      const result = await repository.paginate('user', {
        page: 1,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(typeof result.pagination.total).toBe('number');
      expect(typeof result.pagination.totalPages).toBe('number');
      expect(typeof result.pagination.hasNext).toBe('boolean');
      expect(typeof result.pagination.hasPrev).toBe('boolean');
    });

    it('should execute transactions', async () => {
      const result = await repository.transaction(async (tx) => {
        // Just verify transaction context works
        const count = await tx.user.count();
        return { success: true, count };
      });

      expect(result.success).toBe(true);
      expect(typeof result.count).toBe('number');
    });

    it('should check if records exist', async () => {
      const exists = await repository.exists('user', {});
      expect(typeof exists).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid model gracefully', async () => {
      await expect(
        repository.count('nonexistent_model')
      ).rejects.toThrow('Model nonexistent_model not found');
    });

    it('should handle invalid queries gracefully', async () => {
      await expect(
        db.$queryRaw`SELECT * FROM nonexistent_table`
      ).rejects.toThrow();
    });
  });

  describe('Middleware', () => {
    it('should normalize Prisma errors', async () => {
      try {
        // Try to create a user with invalid data to trigger validation error
        await db.user.create({
          data: {
            // @ts-expect-error - intentionally invalid data
            invalidField: 'test',
          },
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });
  });
});
