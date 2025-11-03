export enum SubscriptionTier {
  GIFT = 'Gift',
  PROFESSIONAL = 'Professional',
  BUSINESS = 'Business',
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstPerSecond: number;
}

export const RATE_LIMITS: Record<SubscriptionTier, RateLimitConfig> = {
  [SubscriptionTier.GIFT]: {
    requestsPerMinute: 10,
    burstPerSecond: 3,
  },
  [SubscriptionTier.PROFESSIONAL]: {
    requestsPerMinute: 50,
    burstPerSecond: 10,
  },
  [SubscriptionTier.BUSINESS]: {
    requestsPerMinute: 100,
    burstPerSecond: 20,
  },
};

export interface TokenAllocation {
  monthlyTokens: number;
  priceRubles: number | null;
}

export const TOKEN_ALLOCATIONS: Record<SubscriptionTier, TokenAllocation> = {
  [SubscriptionTier.GIFT]: {
    monthlyTokens: 100,
    priceRubles: null,
  },
  [SubscriptionTier.PROFESSIONAL]: {
    monthlyTokens: 2000,
    priceRubles: 1990,
  },
  [SubscriptionTier.BUSINESS]: {
    monthlyTokens: 10000,
    priceRubles: 3490,
  },
};

export enum OperationType {
  IMAGE_GENERATION = 'image_generation',
  SORA_IMAGE = 'sora_image',
  CHATGPT_MESSAGE = 'chatgpt_message',
}

export const TOKEN_COSTS: Record<OperationType, number> = {
  [OperationType.IMAGE_GENERATION]: 10,
  [OperationType.SORA_IMAGE]: 10,
  [OperationType.CHATGPT_MESSAGE]: 5,
};

export interface UserProfile {
  id: string;
  telegramId: string;
  username: string | null;
  tier: SubscriptionTier;
  subscriptionExpiresAt: Date | null;
  tokensBalance: number;
  tokensSpent: number;
  channelSubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface TokenDeductionResult {
  success: boolean;
  newBalance: number;
  error?: string;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}
