import type { PrismaClient, TokenOperation, OperationType } from '@monorepo/database';
import type { TokenLedgerEntry } from './types';

/**
 * Token Ledger
 * 
 * Manages the token operation ledger for audit and compliance.
 * All token operations are logged to the database for full traceability.
 */
export class TokenLedger {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a ledger entry for a token operation
   */
  async createEntry(
    userId: string,
    operationType: OperationType,
    tokensAmount: number,
    balanceBefore: number,
    balanceAfter: number,
    metadata?: Record<string, unknown>
  ): Promise<TokenLedgerEntry> {
    const entry = await this.prisma.tokenOperation.create({
      data: {
        userId,
        operationType,
        tokensAmount,
        balanceBefore,
        balanceAfter,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });

    return this.mapToLedgerEntry(entry);
  }

  /**
   * Get ledger entries for a user
   */
  async getUserEntries(
    userId: string,
    options?: {
      operationType?: OperationType;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<TokenLedgerEntry[]> {
    const entries = await this.prisma.tokenOperation.findMany({
      where: {
        userId,
        operationType: options?.operationType,
        createdAt: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });

    return entries.map((entry) => this.mapToLedgerEntry(entry));
  }

  /**
   * Get ledger entries by operation type
   */
  async getEntriesByType(
    operationType: OperationType,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<TokenLedgerEntry[]> {
    const entries = await this.prisma.tokenOperation.findMany({
      where: {
        operationType,
        createdAt: {
          gte: options?.startDate,
          lte: options?.endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });

    return entries.map((entry) => this.mapToLedgerEntry(entry));
  }

  /**
   * Get total tokens spent by user for a period
   */
  async getTotalSpent(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const result = await this.prisma.tokenOperation.aggregate({
      where: {
        userId,
        tokensAmount: { lt: 0 }, // Negative amounts are debits
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        tokensAmount: true,
      },
    });

    return Math.abs(result._sum.tokensAmount || 0);
  }

  /**
   * Get total tokens earned/credited by user for a period
   */
  async getTotalEarned(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const result = await this.prisma.tokenOperation.aggregate({
      where: {
        userId,
        tokensAmount: { gt: 0 }, // Positive amounts are credits
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        tokensAmount: true,
      },
    });

    return result._sum.tokensAmount || 0;
  }

  /**
   * Get aggregate statistics for a user
   */
  async getUserStatistics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalSpent: number;
    totalEarned: number;
    netChange: number;
    operationCount: number;
  }> {
    const [totalSpent, totalEarned, operationCount] = await Promise.all([
      this.getTotalSpent(userId, startDate, endDate),
      this.getTotalEarned(userId, startDate, endDate),
      this.prisma.tokenOperation.count({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    return {
      totalSpent,
      totalEarned,
      netChange: totalEarned - totalSpent,
      operationCount,
    };
  }

  /**
   * Delete old ledger entries (for GDPR compliance)
   */
  async deleteOldEntries(olderThan: Date): Promise<number> {
    const result = await this.prisma.tokenOperation.deleteMany({
      where: {
        createdAt: {
          lt: olderThan,
        },
      },
    });

    return result.count;
  }

  /**
   * Map Prisma TokenOperation to TokenLedgerEntry
   */
  private mapToLedgerEntry(operation: TokenOperation): TokenLedgerEntry {
    return {
      id: operation.id,
      userId: operation.userId,
      operationType: operation.operationType,
      tokensAmount: operation.tokensAmount,
      balanceBefore: operation.balanceBefore,
      balanceAfter: operation.balanceAfter,
      createdAt: operation.createdAt,
      metadata: operation.metadata ? (operation.metadata as Record<string, unknown>) : undefined,
    };
  }
}
