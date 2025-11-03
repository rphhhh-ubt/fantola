import { CacheManager } from './cache-manager';
import { UserProfile } from './types';

export interface UserTokenBalance {
  tokensBalance: number;
  tokensSpent: number;
}

export interface ChannelSubscriptionStatus {
  isSubscribed: boolean;
  subscribedAt: Date | null;
}

export class UserCache {
  private readonly cache: CacheManager;
  private readonly profileTtl: number = 300; // 5 minutes
  private readonly tokenBalanceTtl: number = 60; // 1 minute
  private readonly channelSubTtl: number = 600; // 10 minutes

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.cache.get<UserProfile>(`user:profile:${userId}`);
  }

  async setUserProfile(userId: string, profile: UserProfile): Promise<void> {
    await this.cache.set(`user:profile:${userId}`, profile, {
      ttl: this.profileTtl,
      tags: [`user:${userId}`],
    });
  }

  async getOrFetchUserProfile(
    userId: string,
    fetcher: () => Promise<UserProfile>
  ): Promise<UserProfile> {
    return this.cache.getOrSet(`user:profile:${userId}`, fetcher, {
      ttl: this.profileTtl,
      tags: [`user:${userId}`],
    });
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    await this.cache.delete(`user:profile:${userId}`);
  }

  async getTokenBalance(userId: string): Promise<UserTokenBalance | null> {
    return this.cache.get<UserTokenBalance>(`user:tokens:${userId}`);
  }

  async setTokenBalance(userId: string, balance: UserTokenBalance): Promise<void> {
    await this.cache.set(`user:tokens:${userId}`, balance, {
      ttl: this.tokenBalanceTtl,
      tags: [`user:${userId}`],
    });
  }

  async getOrFetchTokenBalance(
    userId: string,
    fetcher: () => Promise<UserTokenBalance>
  ): Promise<UserTokenBalance> {
    return this.cache.getOrSet(`user:tokens:${userId}`, fetcher, {
      ttl: this.tokenBalanceTtl,
      tags: [`user:${userId}`],
    });
  }

  async invalidateTokenBalance(userId: string): Promise<void> {
    await this.cache.delete(`user:tokens:${userId}`);
  }

  async getChannelSubscription(userId: string): Promise<ChannelSubscriptionStatus | null> {
    return this.cache.get<ChannelSubscriptionStatus>(`user:channel:${userId}`);
  }

  async setChannelSubscription(
    userId: string,
    status: ChannelSubscriptionStatus
  ): Promise<void> {
    await this.cache.set(`user:channel:${userId}`, status, {
      ttl: this.channelSubTtl,
      tags: [`user:${userId}`],
    });
  }

  async getOrFetchChannelSubscription(
    userId: string,
    fetcher: () => Promise<ChannelSubscriptionStatus>
  ): Promise<ChannelSubscriptionStatus> {
    return this.cache.getOrSet(`user:channel:${userId}`, fetcher, {
      ttl: this.channelSubTtl,
      tags: [`user:${userId}`],
    });
  }

  async invalidateChannelSubscription(userId: string): Promise<void> {
    await this.cache.delete(`user:channel:${userId}`);
  }

  async invalidateAllUserData(userId: string): Promise<void> {
    await this.cache.invalidateByTag(`user:${userId}`);
  }

  async warmUserCache(userId: string, data: {
    profile?: UserProfile;
    tokenBalance?: UserTokenBalance;
    channelSubscription?: ChannelSubscriptionStatus;
  }): Promise<void> {
    const entries: Array<{ key: string; value: any; options?: { ttl: number } }> = [];

    if (data.profile) {
      entries.push({
        key: `user:profile:${userId}`,
        value: data.profile,
        options: { ttl: this.profileTtl },
      });
    }

    if (data.tokenBalance) {
      entries.push({
        key: `user:tokens:${userId}`,
        value: data.tokenBalance,
        options: { ttl: this.tokenBalanceTtl },
      });
    }

    if (data.channelSubscription) {
      entries.push({
        key: `user:channel:${userId}`,
        value: data.channelSubscription,
        options: { ttl: this.channelSubTtl },
      });
    }

    await this.cache.warmCache(entries);
  }

  async batchGetProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    const keys = userIds.map((id) => `user:profile:${id}`);
    return this.cache.getMany<UserProfile>(keys);
  }

  async batchSetProfiles(profiles: Array<{ userId: string; profile: UserProfile }>): Promise<void> {
    const entries = profiles.map((p) => ({
      key: `user:profile:${p.userId}`,
      value: p.profile,
      ttl: this.profileTtl,
    }));

    await this.cache.setMany(entries);
  }
}
