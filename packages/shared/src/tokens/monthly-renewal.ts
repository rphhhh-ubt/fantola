import type { PrismaClient, SubscriptionTier } from '@monorepo/database';
import { TokenService } from './token-service';
import type {
  MonthlyRenewalResult,
  RenewalEligibility,
  BatchRenewalOptions,
  BatchRenewalResult,
} from './types';
import { MONTHLY_TOKEN_ALLOCATIONS, RENEWAL_PERIODS } from './types';

/**
 * Monthly Renewal Service
 * 
 * Handles monthly token renewal for all subscription tiers.
 * Ensures users receive their monthly token allocation based on their tier.
 */
export class MonthlyRenewalService {
  private readonly tokenService: TokenService;

  constructor(private readonly prisma: PrismaClient) {
    this.tokenService = new TokenService(prisma);
  }

  /**
   * Check if a user is eligible for monthly renewal
   */
  async checkEligibility(userId: string): Promise<RenewalEligibility> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tier: true,
        lastGiftClaimAt: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) {
      return {
        userId,
        eligible: false,
        reason: 'User not found',
      };
    }

    // Check if subscription is active for paid tiers
    if (user.tier !== 'Gift') {
      const now = new Date();
      if (user.subscriptionExpiresAt && user.subscriptionExpiresAt < now) {
        return {
          userId,
          eligible: false,
          reason: 'Subscription expired',
        };
      }
    }

    // Check renewal period
    const renewalPeriod = RENEWAL_PERIODS[user.tier];
    const lastRenewal = user.lastGiftClaimAt;

    if (!lastRenewal) {
      // Never renewed before - eligible
      return {
        userId,
        eligible: true,
      };
    }

    const daysSinceRenewal = this.getDaysSince(lastRenewal);
    
    if (daysSinceRenewal >= renewalPeriod) {
      return {
        userId,
        eligible: true,
      };
    }

    // Not yet eligible
    const daysUntilRenewal = renewalPeriod - daysSinceRenewal;
    const nextRenewalDate = new Date(lastRenewal);
    nextRenewalDate.setDate(nextRenewalDate.getDate() + renewalPeriod);

    return {
      userId,
      eligible: false,
      reason: `Next renewal in ${daysUntilRenewal} days`,
      nextRenewalDate,
      daysUntilRenewal,
    };
  }

  /**
   * Renew tokens for a single user
   */
  async renewUser(userId: string): Promise<MonthlyRenewalResult> {
    try {
      // Check eligibility first
      const eligibility = await this.checkEligibility(userId);

      if (!eligibility.eligible) {
        const balance = await this.tokenService.getBalance(userId);
        return {
          userId,
          tier: balance?.tier || 'Gift',
          tokensAdded: 0,
          newBalance: balance?.tokensBalance || 0,
          previousBalance: balance?.tokensBalance || 0,
          renewalDate: new Date(),
          success: false,
          error: eligibility.reason || 'Not eligible for renewal',
        };
      }

      // Get user info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tier: true,
          tokensBalance: true,
        },
      });

      if (!user) {
        return this.createErrorResult(userId, 'User not found');
      }

      const tokensToAdd = MONTHLY_TOKEN_ALLOCATIONS[user.tier];
      const previousBalance = user.tokensBalance;

      // Perform renewal in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Add tokens
        const newBalance = previousBalance + tokensToAdd;

        await tx.user.update({
          where: { id: userId },
          data: {
            tokensBalance: newBalance,
            lastGiftClaimAt: new Date(),
          },
        });

        // Create ledger entry
        await tx.tokenOperation.create({
          data: {
            userId,
            operationType: 'monthly_reset',
            tokensAmount: tokensToAdd,
            balanceBefore: previousBalance,
            balanceAfter: newBalance,
            metadata: {
              tier: user.tier,
              renewalType: 'monthly',
            },
          },
        });

        return {
          userId,
          tier: user.tier,
          tokensAdded: tokensToAdd,
          newBalance,
          previousBalance,
          renewalDate: new Date(),
          success: true,
        };
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResult(userId, errorMessage);
    }
  }

  /**
   * Renew tokens for all eligible users (batch operation)
   */
  async renewAllEligible(
    options?: BatchRenewalOptions
  ): Promise<BatchRenewalResult> {
    const result: BatchRenewalResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      renewals: [],
      errors: [],
    };

    try {
      // Build query
      const where: any = {};
      
      if (options?.tier) {
        where.tier = options.tier;
      }

      // Get all users
      const users = await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          tier: true,
          lastGiftClaimAt: true,
          subscriptionExpiresAt: true,
        },
        take: options?.limit,
      });

      result.totalProcessed = users.length;

      // Process each user
      for (const user of users) {
        try {
          const eligibility = await this.checkEligibility(user.id);

          if (!eligibility.eligible) {
            continue; // Skip ineligible users
          }

          // Dry run - don't actually renew
          if (options?.dryRun) {
            const tokensToAdd = MONTHLY_TOKEN_ALLOCATIONS[user.tier];
            const balance = await this.tokenService.getBalance(user.id);
            
            result.renewals.push({
              userId: user.id,
              tier: user.tier,
              tokensAdded: tokensToAdd,
              newBalance: (balance?.tokensBalance || 0) + tokensToAdd,
              previousBalance: balance?.tokensBalance || 0,
              renewalDate: new Date(),
              success: true,
            });
            result.successful++;
            continue;
          }

          // Perform actual renewal
          const renewalResult = await this.renewUser(user.id);
          result.renewals.push(renewalResult);

          if (renewalResult.success) {
            result.successful++;
          } else {
            result.failed++;
            result.errors.push({
              userId: user.id,
              error: renewalResult.error || 'Unknown error',
            });

            // Stop on first error if continueOnError is false
            if (!options?.continueOnError) {
              break;
            }
          }
        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            userId: user.id,
            error: errorMessage,
          });

          if (!options?.continueOnError) {
            break;
          }
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({
        userId: 'batch',
        error: errorMessage,
      });
      return result;
    }
  }

  /**
   * Get users due for renewal
   */
  async getUsersDueForRenewal(tier?: SubscriptionTier): Promise<string[]> {
    const where: any = {};
    
    if (tier) {
      where.tier = tier;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
      },
    });

    const eligibleUsers: string[] = [];

    for (const user of users) {
      const eligibility = await this.checkEligibility(user.id);
      if (eligibility.eligible) {
        eligibleUsers.push(user.id);
      }
    }

    return eligibleUsers;
  }

  /**
   * Schedule renewal job (returns cron expression)
   * 
   * This method returns the recommended cron expression for scheduling
   * the renewal job. The actual scheduling should be done by the caller
   * using their preferred job scheduler (BullMQ, node-cron, etc.)
   */
  getCronExpression(): string {
    // Run daily at 2 AM UTC
    return '0 2 * * *';
  }

  /**
   * Get days since a date
   */
  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Create error result
   */
  private createErrorResult(
    userId: string,
    error: string
  ): MonthlyRenewalResult {
    return {
      userId,
      tier: 'Gift',
      tokensAdded: 0,
      newBalance: 0,
      previousBalance: 0,
      renewalDate: new Date(),
      success: false,
      error,
    };
  }
}
