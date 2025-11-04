import type { PrismaClient, OperationType } from '@monorepo/database';
import { TokenLedger } from './token-ledger';
import type {
  TokenOperationResult,
  TokenBalance,
  TokenDebitOptions,
  TokenCreditOptions,
  TokenServiceOptions,
  TokenMetrics,
} from './types';
import { TOKEN_COSTS } from './types';

/**
 * Token Service
 * 
 * Comprehensive token accounting service that manages:
 * - Balance adjustments (debit/credit)
 * - Ledger entries for audit
 * - Usage tracking and analytics
 * - Transactional safety
 * - Overdraft protection
 * 
 * All operations are atomic and logged to the ledger.
 */
export class TokenService {
  private readonly ledger: TokenLedger;
  private readonly options: TokenServiceOptions;

  constructor(
    private readonly prisma: PrismaClient,
    options?: TokenServiceOptions
  ) {
    this.ledger = new TokenLedger(prisma);
    this.options = options || {};
  }

  /**
   * Get the ledger instance for direct access
   */
  getLedger(): TokenLedger {
    return this.ledger;
  }

  /**
   * Get user's current token balance
   */
  async getBalance(userId: string): Promise<TokenBalance | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tokensBalance: true,
        tokensSpent: true,
        tier: true,
        lastGiftClaimAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      tokensBalance: user.tokensBalance,
      tokensSpent: user.tokensSpent,
      tier: user.tier,
      lastRenewalAt: user.lastGiftClaimAt,
    };
  }

  /**
   * Debit tokens from user's balance with overdraft protection
   */
  async debit(
    userId: string,
    options: TokenDebitOptions
  ): Promise<TokenOperationResult> {
    const startTime = Date.now();

    try {
      // Validate amount
      if (options.amount <= 0) {
        return this.createErrorResult(0, 0, 'Debit amount must be positive');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // Get current balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { tokensBalance: true, tokensSpent: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        const balanceBefore = user.tokensBalance;

        // Check overdraft protection
        if (!options.allowOverdraft && balanceBefore < options.amount) {
          throw new Error(
            `Insufficient tokens. Required: ${options.amount}, Available: ${balanceBefore}`
          );
        }

        const newBalance = balanceBefore - options.amount;
        const newSpent = user.tokensSpent + options.amount;

        // Update user balance
        await tx.user.update({
          where: { id: userId },
          data: {
            tokensBalance: newBalance,
            tokensSpent: newSpent,
          },
        });

        // Create ledger entry (negative amount for debit)
        const ledgerEntry = await tx.tokenOperation.create({
          data: {
            userId,
            operationType: options.operationType,
            tokensAmount: -options.amount,
            balanceBefore,
            balanceAfter: newBalance,
            metadata: options.metadata ? (options.metadata as any) : undefined,
          },
        });

        return {
          success: true,
          newBalance,
          tokensSpent: newSpent,
          ledgerEntryId: ledgerEntry.id,
        };
      });

      // Invalidate cache if callback provided
      if (this.options.cacheInvalidationCallback) {
        await this.options.cacheInvalidationCallback(userId);
      }

      // Track metrics
      this.trackMetrics({
        operation: 'debit',
        userId,
        amount: options.amount,
        success: true,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.trackMetrics({
        operation: 'debit',
        userId,
        amount: options.amount,
        success: false,
        duration: Date.now() - startTime,
        error: errorMessage,
      });

      return this.createErrorResult(0, 0, errorMessage);
    }
  }

  /**
   * Credit tokens to user's balance
   */
  async credit(
    userId: string,
    options: TokenCreditOptions
  ): Promise<TokenOperationResult> {
    const startTime = Date.now();

    try {
      // Validate amount
      if (options.amount <= 0) {
        return this.createErrorResult(0, 0, 'Credit amount must be positive');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // Get current balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { tokensBalance: true, tokensSpent: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        const balanceBefore = user.tokensBalance;
        const newBalance = balanceBefore + options.amount;

        // Update user balance
        await tx.user.update({
          where: { id: userId },
          data: {
            tokensBalance: newBalance,
          },
        });

        // Create ledger entry (positive amount for credit)
        const ledgerEntry = await tx.tokenOperation.create({
          data: {
            userId,
            operationType: options.operationType,
            tokensAmount: options.amount,
            balanceBefore,
            balanceAfter: newBalance,
            metadata: options.metadata ? (options.metadata as any) : undefined,
          },
        });

        return {
          success: true,
          newBalance,
          tokensSpent: user.tokensSpent,
          ledgerEntryId: ledgerEntry.id,
        };
      });

      // Invalidate cache if callback provided
      if (this.options.cacheInvalidationCallback) {
        await this.options.cacheInvalidationCallback(userId);
      }

      // Track metrics
      this.trackMetrics({
        operation: 'credit',
        userId,
        amount: options.amount,
        success: true,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.trackMetrics({
        operation: 'credit',
        userId,
        amount: options.amount,
        success: false,
        duration: Date.now() - startTime,
        error: errorMessage,
      });

      return this.createErrorResult(0, 0, errorMessage);
    }
  }

  /**
   * Charge tokens for a specific operation (with cost lookup)
   */
  async chargeForOperation(
    userId: string,
    operationType: OperationType,
    metadata?: Record<string, unknown>
  ): Promise<TokenOperationResult> {
    const cost = TOKEN_COSTS[operationType];

    if (cost === 0) {
      return this.createErrorResult(0, 0, 'Operation type does not have a cost');
    }

    return this.debit(userId, {
      operationType,
      amount: cost,
      allowOverdraft: false,
      metadata,
    });
  }

  /**
   * Check if user can afford an operation
   */
  async canAfford(
    userId: string,
    operationType: OperationType
  ): Promise<{
    canAfford: boolean;
    balance: number;
    cost: number;
    deficit?: number;
  }> {
    const cost = TOKEN_COSTS[operationType];
    const balance = await this.getBalance(userId);

    if (!balance) {
      return {
        canAfford: false,
        balance: 0,
        cost,
        deficit: cost,
      };
    }

    const canAfford = balance.tokensBalance >= cost;

    return {
      canAfford,
      balance: balance.tokensBalance,
      cost,
      deficit: canAfford ? undefined : cost - balance.tokensBalance,
    };
  }

  /**
   * Refund tokens to a user
   */
  async refund(
    userId: string,
    amount: number,
    metadata?: Record<string, unknown>
  ): Promise<TokenOperationResult> {
    return this.credit(userId, {
      operationType: 'refund',
      amount,
      metadata,
    });
  }

  /**
   * Reset user's token balance to a specific amount
   */
  async resetBalance(
    userId: string,
    newBalance: number,
    operationType: OperationType = 'monthly_reset',
    metadata?: Record<string, unknown>
  ): Promise<TokenOperationResult> {
    const startTime = Date.now();

    try {
      if (newBalance < 0) {
        return this.createErrorResult(0, 0, 'Balance cannot be negative');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // Get current balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { tokensBalance: true, tokensSpent: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        const balanceBefore = user.tokensBalance;
        const difference = newBalance - balanceBefore;

        // Update user balance
        await tx.user.update({
          where: { id: userId },
          data: {
            tokensBalance: newBalance,
          },
        });

        // Create ledger entry
        const ledgerEntry = await tx.tokenOperation.create({
          data: {
            userId,
            operationType,
            tokensAmount: difference,
            balanceBefore,
            balanceAfter: newBalance,
            metadata: metadata ? (metadata as any) : undefined,
          },
        });

        return {
          success: true,
          newBalance,
          tokensSpent: user.tokensSpent,
          ledgerEntryId: ledgerEntry.id,
        };
      });

      // Invalidate cache
      if (this.options.cacheInvalidationCallback) {
        await this.options.cacheInvalidationCallback(userId);
      }

      // Track metrics
      this.trackMetrics({
        operation: 'reset_balance',
        userId,
        amount: newBalance,
        success: true,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.trackMetrics({
        operation: 'reset_balance',
        userId,
        amount: newBalance,
        success: false,
        duration: Date.now() - startTime,
        error: errorMessage,
      });

      return this.createErrorResult(0, 0, errorMessage);
    }
  }

  /**
   * Get operation cost
   */
  getOperationCost(operationType: OperationType): number {
    return TOKEN_COSTS[operationType];
  }

  /**
   * Create error result
   */
  private createErrorResult(
    newBalance: number,
    tokensSpent: number,
    error: string
  ): TokenOperationResult {
    return {
      success: false,
      newBalance,
      tokensSpent,
      error,
    };
  }

  /**
   * Track metrics if callback provided
   */
  private trackMetrics(metrics: TokenMetrics): void {
    if (this.options.metricsCallback) {
      this.options.metricsCallback(metrics);
    }
  }
}
