import type { PrismaClient, SubscriptionTier } from '@monorepo/database';
import type {
  SubscriptionStatus,
  SubscriptionActivationOptions,
  SubscriptionActivationResult,
  SubscriptionCancellationOptions,
  SubscriptionCancellationResult,
  ExpirationCheckResult,
  BatchExpirationCheckOptions,
  BatchExpirationCheckResult,
  SubscriptionServiceOptions,
} from './types';

/**
 * Service for managing subscription lifecycle
 */
export class SubscriptionService {
  private defaultGracePeriodDays: number;
  private onActivationHook?: (status: SubscriptionStatus) => Promise<void>;
  private onCancellationHook?: (status: SubscriptionStatus) => Promise<void>;
  private onExpirationHook?: (result: ExpirationCheckResult) => Promise<void>;

  constructor(
    private db: PrismaClient,
    options?: SubscriptionServiceOptions
  ) {
    this.defaultGracePeriodDays = options?.defaultGracePeriodDays || 0;
    this.onActivationHook = options?.onActivation;
    this.onCancellationHook = options?.onCancellation;
    this.onExpirationHook = options?.onExpiration;
  }

  /**
   * Get current subscription status for a user
   */
  async getStatus(userId: string): Promise<SubscriptionStatus> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tier: true,
        subscriptionExpiresAt: true,
        autoRenew: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const now = new Date();
    const isActive = this.isSubscriptionActive(user.tier, user.subscriptionExpiresAt, now);
    const daysRemaining = this.calculateDaysRemaining(user.subscriptionExpiresAt, now);

    return {
      userId: user.id,
      tier: user.tier,
      isActive,
      expiresAt: user.subscriptionExpiresAt,
      autoRenew: user.autoRenew,
      daysRemaining,
    };
  }

  /**
   * Activate a subscription for a user
   */
  async activateSubscription(
    options: SubscriptionActivationOptions
  ): Promise<SubscriptionActivationResult> {
    try {
      const result = await this.db.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: options.userId },
        });

        if (!user) {
          throw new Error(`User not found: ${options.userId}`);
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + options.durationDays * 24 * 60 * 60 * 1000);

        const updatedUser = await tx.user.update({
          where: { id: options.userId },
          data: {
            tier: options.tier,
            subscriptionExpiresAt: expiresAt,
            autoRenew: options.autoRenew ?? false,
          },
        });

        const historyEntry = await tx.subscriptionHistory.create({
          data: {
            userId: options.userId,
            tier: options.tier,
            priceRubles: options.priceRubles ?? null,
            paymentMethod: options.paymentMethod ?? null,
            startedAt: now,
            expiresAt,
            autoRenew: options.autoRenew ?? false,
            ...(options.metadata && { metadata: options.metadata as any }),
          },
        });

        const status: SubscriptionStatus = {
          userId: updatedUser.id,
          tier: updatedUser.tier,
          isActive: true,
          expiresAt: updatedUser.subscriptionExpiresAt,
          autoRenew: updatedUser.autoRenew,
          daysRemaining: this.calculateDaysRemaining(updatedUser.subscriptionExpiresAt, now),
        };

        return { status, historyId: historyEntry.id };
      });

      const callback = options.onActivation || this.onActivationHook;
      if (callback && result.status) {
        await callback(result.status);
      }

      return {
        success: true,
        status: result.status,
        historyId: result.historyId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel a subscription for a user
   */
  async cancelSubscription(
    options: SubscriptionCancellationOptions
  ): Promise<SubscriptionCancellationResult> {
    try {
      const result = await this.db.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: options.userId },
        });

        if (!user) {
          throw new Error(`User not found: ${options.userId}`);
        }

        const now = new Date();
        const updateData: {
          autoRenew: boolean;
          tier?: SubscriptionTier;
          subscriptionExpiresAt?: Date | null;
        } = {
          autoRenew: false,
        };

        if (options.immediate) {
          updateData.tier = 'Gift';
          updateData.subscriptionExpiresAt = null;
        }

        const updatedUser = await tx.user.update({
          where: { id: options.userId },
          data: updateData,
        });

        const latestHistory = await tx.subscriptionHistory.findFirst({
          where: { userId: options.userId },
          orderBy: { createdAt: 'desc' },
        });

        if (latestHistory && !latestHistory.canceledAt) {
          const dataUpdate: any = {
            canceledAt: now,
            cancellationReason: options.reason ?? null,
            autoRenew: false,
          };

          if (options.metadata) {
            dataUpdate.metadata = {
              ...(latestHistory.metadata as object),
              ...options.metadata,
            };
          }

          await tx.subscriptionHistory.update({
            where: { id: latestHistory.id },
            data: dataUpdate,
          });
        }

        const status: SubscriptionStatus = {
          userId: updatedUser.id,
          tier: updatedUser.tier,
          isActive: this.isSubscriptionActive(
            updatedUser.tier,
            updatedUser.subscriptionExpiresAt,
            now
          ),
          expiresAt: updatedUser.subscriptionExpiresAt,
          autoRenew: updatedUser.autoRenew,
          daysRemaining: this.calculateDaysRemaining(updatedUser.subscriptionExpiresAt, now),
        };

        return status;
      });

      const callback = options.onCancellation || this.onCancellationHook;
      if (callback) {
        await callback(result);
      }

      return {
        success: true,
        status: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check and process expired subscriptions
   */
  async checkExpiredSubscriptions(
    options?: BatchExpirationCheckOptions
  ): Promise<BatchExpirationCheckResult> {
    const limit = options?.limit || 100;
    const now = new Date();

    const expiredUsers = await this.db.user.findMany({
      where: {
        tier: { not: 'Gift' },
        subscriptionExpiresAt: { lt: now },
      },
      take: limit,
    });

    const results: ExpirationCheckResult[] = [];

    for (const user of expiredUsers) {
      try {
        const result = await this.db.$transaction(async (tx) => {
          const previousTier = user.tier;

          await tx.user.update({
            where: { id: user.id },
            data: {
              tier: 'Gift',
              autoRenew: false,
            },
          });

          const checkResult: ExpirationCheckResult = {
            userId: user.id,
            wasExpired: true,
            previousTier,
            newTier: 'Gift',
            notified: false,
          };

          return checkResult;
        });

        const callback = options?.onExpiration || this.onExpirationHook;
        if (callback) {
          await callback(result);
          result.notified = true;
        }

        results.push(result);
      } catch (error) {
        results.push({
          userId: user.id,
          wasExpired: false,
          notified: false,
        });
      }
    }

    return {
      totalChecked: expiredUsers.length,
      totalExpired: results.filter((r) => r.wasExpired).length,
      results,
    };
  }

  /**
   * Check if a subscription is active
   */
  private isSubscriptionActive(
    tier: SubscriptionTier,
    expiresAt: Date | null,
    now: Date
  ): boolean {
    if (tier === 'Gift') {
      return true;
    }

    if (!expiresAt) {
      return false;
    }

    const gracePeriod = this.defaultGracePeriodDays * 24 * 60 * 60 * 1000;
    const effectiveExpiryDate = new Date(expiresAt.getTime() + gracePeriod);

    return effectiveExpiryDate > now;
  }

  /**
   * Calculate days remaining until expiration
   */
  private calculateDaysRemaining(expiresAt: Date | null, now: Date): number | null {
    if (!expiresAt) {
      return null;
    }

    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }
}
