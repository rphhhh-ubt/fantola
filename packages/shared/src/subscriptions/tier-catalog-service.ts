import type { PrismaClient } from '@monorepo/database';
import type { TierCatalogEntry } from './types';

/**
 * Service for fetching subscription tier catalog
 */
export class TierCatalogService {
  constructor(private db: PrismaClient) {}

  /**
   * Get all active subscription tiers
   */
  async getTierCatalog(includeInactive = false): Promise<TierCatalogEntry[]> {
    const configs = await this.db.subscriptionTierConfig.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [
        { priceRubles: 'asc' },
        { monthlyTokens: 'asc' },
      ],
    });

    return configs.map((config) => this.mapToTierCatalogEntry(config));
  }

  /**
   * Get a specific tier configuration
   */
  async getTierByName(tierName: string): Promise<TierCatalogEntry | null> {
    const config = await this.db.subscriptionTierConfig.findUnique({
      where: { tier: tierName as any },
    });

    if (!config) {
      return null;
    }

    return this.mapToTierCatalogEntry(config);
  }

  /**
   * Map database config to catalog entry
   */
  private mapToTierCatalogEntry(config: any): TierCatalogEntry {
    const metadata = config.metadata as any;

    return {
      tier: config.tier,
      monthlyTokens: config.monthlyTokens,
      priceRubles: config.priceRubles,
      requestsPerMinute: config.requestsPerMinute,
      burstPerSecond: config.burstPerSecond,
      requiresChannel: config.requiresChannel,
      description: config.description,
      isActive: config.isActive,
      features: metadata?.features || [],
      limitations: metadata?.limitations || [],
    };
  }
}
