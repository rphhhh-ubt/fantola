import {
  OperationType,
  TOKEN_COSTS,
  TokenDeductionResult,
  SubscriptionTier,
  TOKEN_ALLOCATIONS,
} from './types';
import { UserCache, UserTokenBalance } from './user-cache';

export interface TokenBillingOptions {
  onBalanceUpdate?: (userId: string, newBalance: number) => Promise<void>;
}

export class TokenBilling {
  private readonly userCache: UserCache;
  private readonly options?: TokenBillingOptions;

  constructor(userCache: UserCache, options?: TokenBillingOptions) {
    this.userCache = userCache;
    this.options = options;
  }

  async checkBalance(userId: string, operation: OperationType): Promise<boolean> {
    const cost = TOKEN_COSTS[operation];
    const balance = await this.userCache.getTokenBalance(userId);

    if (!balance) {
      return false;
    }

    return balance.tokensBalance >= cost;
  }

  async deductTokens(
    userId: string,
    operation: OperationType
  ): Promise<TokenDeductionResult> {
    const cost = TOKEN_COSTS[operation];
    const balance = await this.userCache.getTokenBalance(userId);

    if (!balance) {
      return {
        success: false,
        newBalance: 0,
        error: 'User balance not found. Please try again.',
      };
    }

    if (balance.tokensBalance < cost) {
      return {
        success: false,
        newBalance: balance.tokensBalance,
        error: `Insufficient tokens. You need ${cost} tokens but have ${balance.tokensBalance}.`,
      };
    }

    const newBalance = balance.tokensBalance - cost;
    const newSpent = balance.tokensSpent + cost;

    await this.userCache.setTokenBalance(userId, {
      tokensBalance: newBalance,
      tokensSpent: newSpent,
    });

    if (this.options?.onBalanceUpdate) {
      await this.options.onBalanceUpdate(userId, newBalance);
    }

    return {
      success: true,
      newBalance,
    };
  }

  async addTokens(userId: string, amount: number): Promise<TokenDeductionResult> {
    const balance = await this.userCache.getTokenBalance(userId);

    if (!balance) {
      return {
        success: false,
        newBalance: 0,
        error: 'User balance not found.',
      };
    }

    const newBalance = balance.tokensBalance + amount;

    await this.userCache.setTokenBalance(userId, {
      tokensBalance: newBalance,
      tokensSpent: balance.tokensSpent,
    });

    if (this.options?.onBalanceUpdate) {
      await this.options.onBalanceUpdate(userId, newBalance);
    }

    return {
      success: true,
      newBalance,
    };
  }

  async resetMonthlyTokens(userId: string, tier: SubscriptionTier): Promise<TokenDeductionResult> {
    const allocation = TOKEN_ALLOCATIONS[tier];
    const balance = await this.userCache.getTokenBalance(userId);

    const newBalance = allocation.monthlyTokens;

    await this.userCache.setTokenBalance(userId, {
      tokensBalance: newBalance,
      tokensSpent: balance?.tokensSpent || 0,
    });

    if (this.options?.onBalanceUpdate) {
      await this.options.onBalanceUpdate(userId, newBalance);
    }

    return {
      success: true,
      newBalance,
    };
  }

  getOperationCost(operation: OperationType): number {
    return TOKEN_COSTS[operation];
  }

  getTierAllocation(tier: SubscriptionTier): number {
    return TOKEN_ALLOCATIONS[tier].monthlyTokens;
  }

  getTierPrice(tier: SubscriptionTier): number | null {
    return TOKEN_ALLOCATIONS[tier].priceRubles;
  }

  async getBalance(userId: string): Promise<UserTokenBalance | null> {
    return this.userCache.getTokenBalance(userId);
  }

  async canAffordOperation(userId: string, operation: OperationType): Promise<{
    canAfford: boolean;
    balance: number;
    cost: number;
    deficit?: number;
  }> {
    const cost = TOKEN_COSTS[operation];
    const balance = await this.userCache.getTokenBalance(userId);

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

  async estimateOperations(userId: string, operation: OperationType): Promise<number> {
    const cost = TOKEN_COSTS[operation];
    const balance = await this.userCache.getTokenBalance(userId);

    if (!balance) {
      return 0;
    }

    return Math.floor(balance.tokensBalance / cost);
  }
}
