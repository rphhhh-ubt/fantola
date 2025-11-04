import { RepositoryHelpers, db } from '../db';

describe('RepositoryHelpers', () => {
  let repository: RepositoryHelpers;

  beforeAll(async () => {
    repository = new RepositoryHelpers(db);
  });

  afterAll(async () => {
    // Clean up test data if any
    await db.$disconnect();
  });

  describe('count', () => {
    it('should count records', async () => {
      const count = await repository.count('user');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for invalid model', async () => {
      await expect(repository.count('invalid')).rejects.toThrow(
        'Model invalid not found'
      );
    });
  });

  describe('exists', () => {
    it('should check if records exist', async () => {
      const exists = await repository.exists('user', {});
      expect(typeof exists).toBe('boolean');
    });
  });

  describe('paginate', () => {
    it('should paginate results with default options', async () => {
      const result = await repository.paginate('user');

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should paginate with custom page and limit', async () => {
      const result = await repository.paginate('user', {
        page: 2,
        limit: 5,
      });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
    });

    it('should enforce minimum page', async () => {
      const result = await repository.paginate('user', {
        page: 0,
        limit: 10,
      });

      expect(result.pagination.page).toBe(1);
    });

    it('should enforce maximum limit', async () => {
      const result = await repository.paginate('user', {
        page: 1,
        limit: 200,
      });

      expect(result.pagination.limit).toBe(100);
    });

    it('should calculate pagination metadata correctly', async () => {
      const result = await repository.paginate('user', {
        page: 1,
        limit: 10,
      });

      expect(result.pagination.totalPages).toBe(
        Math.ceil(result.pagination.total / result.pagination.limit)
      );
      expect(result.pagination.hasPrev).toBe(false);
    });
  });

  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      const result = await repository.transaction(async (tx) => {
        const count = await tx.user.count();
        return { count };
      });

      expect(result).toBeDefined();
      expect(typeof result.count).toBe('number');
    });

    it('should rollback transaction on error', async () => {
      await expect(
        repository.transaction(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should accept transaction options', async () => {
      const result = await repository.transaction(
        async (tx) => {
          const count = await tx.user.count();
          return { count };
        },
        {
          maxWait: 5000,
          timeout: 10000,
        }
      );

      expect(result).toBeDefined();
    });
  });

  describe('findUnique', () => {
    it('should return null for non-existent record', async () => {
      const result = await repository.findUnique('user', {
        telegramId: 'non-existent-id',
      });

      expect(result).toBeNull();
    });
  });

  describe('findFirst', () => {
    it('should return null for non-existent record', async () => {
      const result = await repository.findFirst('user', {
        telegramId: 'non-existent-id',
      });

      expect(result).toBeNull();
    });
  });
});
