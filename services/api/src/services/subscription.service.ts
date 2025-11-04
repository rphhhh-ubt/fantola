import { PrismaClient } from '@monorepo/database';
import {
  SubscriptionService as SharedSubscriptionService,
  TierCatalogService,
  type SubscriptionStatus,
  type TierCatalogEntry,
  type SubscriptionActivationOptions,
  type SubscriptionActivationResult,
  type SubscriptionCancellationOptions,
  type SubscriptionCancellationResult,
} from '@monorepo/shared';

export class SubscriptionService {
  private subscriptionService: SharedSubscriptionService;
  private tierCatalogService: TierCatalogService;

  constructor(private db: PrismaClient) {
    this.subscriptionService = new SharedSubscriptionService(db);
    this.tierCatalogService = new TierCatalogService(db);
  }

  async getTierCatalog(includeInactive = false): Promise<TierCatalogEntry[]> {
    return this.tierCatalogService.getTierCatalog(includeInactive);
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    return this.subscriptionService.getStatus(userId);
  }

  async activateSubscription(
    options: SubscriptionActivationOptions
  ): Promise<SubscriptionActivationResult> {
    return this.subscriptionService.activateSubscription(options);
  }

  async cancelSubscription(
    options: SubscriptionCancellationOptions
  ): Promise<SubscriptionCancellationResult> {
    return this.subscriptionService.cancelSubscription(options);
  }

  async getSubscriptionHistory(userId: string, limit = 10): Promise<any[]> {
    return this.db.subscriptionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
