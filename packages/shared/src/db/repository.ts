import { PrismaClient } from '@monorepo/database';
import { db } from './client';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
}

export class RepositoryHelpers {
  constructor(private client: PrismaClient = db) {}

  /**
   * Execute a transaction with automatic error handling and rollback
   */
  async transaction<T>(
    callback: (tx: PrismaClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    return await this.client.$transaction(
      async (tx) => {
        return await callback(tx as PrismaClient);
      },
      {
        maxWait: options.maxWait || 5000,
        timeout: options.timeout || 10000,
        isolationLevel: options.isolationLevel,
      }
    );
  }

  /**
   * Paginate query results with metadata
   */
  async paginate<T>(
    model: string,
    options: PaginationOptions = {},
    where?: unknown,
    include?: unknown
  ): Promise<PaginationResult<T>> {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 10, 1), 100);
    const skip = (page - 1) * limit;

    // @ts-expect-error - Dynamic model access
    const modelClient = this.client[model];

    if (!modelClient) {
      throw new Error(`Model ${model} not found`);
    }

    const [data, total] = await Promise.all([
      modelClient.findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: options.orderBy || { id: 'desc' },
      }),
      modelClient.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as T[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Soft validation: Check if record exists without throwing
   */
  async exists(model: string, where: unknown): Promise<boolean> {
    // @ts-expect-error - Dynamic model access
    const modelClient = this.client[model];

    if (!modelClient) {
      throw new Error(`Model ${model} not found`);
    }

    const count = await modelClient.count({ where });
    return count > 0;
  }

  /**
   * Soft validation: Find record by unique field without throwing
   */
  async findUnique<T>(model: string, where: unknown, include?: unknown): Promise<T | null> {
    // @ts-expect-error - Dynamic model access
    const modelClient = this.client[model];

    if (!modelClient) {
      throw new Error(`Model ${model} not found`);
    }

    return modelClient.findUnique({ where, include }) as Promise<T | null>;
  }

  /**
   * Soft validation: Find first record matching criteria without throwing
   */
  async findFirst<T>(model: string, where: unknown, include?: unknown): Promise<T | null> {
    // @ts-expect-error - Dynamic model access
    const modelClient = this.client[model];

    if (!modelClient) {
      throw new Error(`Model ${model} not found`);
    }

    return modelClient.findFirst({ where, include }) as Promise<T | null>;
  }

  /**
   * Batch create records with automatic chunking
   */
  async batchCreate<T>(model: string, data: unknown[], chunkSize = 100): Promise<T[]> {
    // @ts-expect-error - Dynamic model access
    const modelClient = this.client[model];

    if (!modelClient) {
      throw new Error(`Model ${model} not found`);
    }

    const results: T[] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const created = await modelClient.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      results.push(created as T);
    }

    return results;
  }

  /**
   * Upsert: Create or update based on unique constraint
   */
  async upsert<T>(model: string, where: unknown, create: unknown, update: unknown): Promise<T> {
    // @ts-expect-error - Dynamic model access
    const modelClient = this.client[model];

    if (!modelClient) {
      throw new Error(`Model ${model} not found`);
    }

    return modelClient.upsert({
      where,
      create,
      update,
    }) as Promise<T>;
  }

  /**
   * Soft delete: Mark record as deleted without physical removal
   */
  async softDelete(model: string, where: unknown, deletedAtField = 'deletedAt'): Promise<void> {
    // @ts-expect-error - Dynamic model access
    const modelClient = this.client[model];

    if (!modelClient) {
      throw new Error(`Model ${model} not found`);
    }

    await modelClient.updateMany({
      where,
      data: {
        [deletedAtField]: new Date(),
      },
    });
  }

  /**
   * Count records matching criteria
   */
  async count(model: string, where?: unknown): Promise<number> {
    // @ts-expect-error - Dynamic model access
    const modelClient = this.client[model];

    if (!modelClient) {
      throw new Error(`Model ${model} not found`);
    }

    return modelClient.count({ where });
  }
}

// Export singleton instance
export const repository = new RepositoryHelpers(db);
