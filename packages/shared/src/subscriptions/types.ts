import type { SubscriptionTier } from '@monorepo/database';

/**
 * Subscription status
 */
export interface SubscriptionStatus {
  userId: string;
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: Date | null;
  autoRenew: boolean;
  daysRemaining: number | null;
}

/**
 * Tier catalog entry
 */
export interface TierCatalogEntry {
  tier: SubscriptionTier;
  monthlyTokens: number;
  priceRubles: number | null;
  requestsPerMinute: number;
  burstPerSecond: number;
  requiresChannel: boolean;
  description: string;
  isActive: boolean;
  features?: string[];
  limitations?: string[];
}

/**
 * Subscription activation options
 */
export interface SubscriptionActivationOptions {
  userId: string;
  tier: SubscriptionTier;
  durationDays: number;
  autoRenew?: boolean;
  priceRubles?: number;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
  onActivation?: (status: SubscriptionStatus) => Promise<void>;
}

/**
 * Subscription activation result
 */
export interface SubscriptionActivationResult {
  success: boolean;
  status?: SubscriptionStatus;
  historyId?: string;
  error?: string;
}

/**
 * Subscription cancellation options
 */
export interface SubscriptionCancellationOptions {
  userId: string;
  reason?: string;
  immediate?: boolean;
  metadata?: Record<string, unknown>;
  onCancellation?: (status: SubscriptionStatus) => Promise<void>;
}

/**
 * Subscription cancellation result
 */
export interface SubscriptionCancellationResult {
  success: boolean;
  status?: SubscriptionStatus;
  error?: string;
}

/**
 * Expiration check result
 */
export interface ExpirationCheckResult {
  userId: string;
  wasExpired: boolean;
  previousTier?: SubscriptionTier;
  newTier?: SubscriptionTier;
  notified: boolean;
}

/**
 * Batch expiration check options
 */
export interface BatchExpirationCheckOptions {
  limit?: number;
  onExpiration?: (result: ExpirationCheckResult) => Promise<void>;
}

/**
 * Batch expiration check result
 */
export interface BatchExpirationCheckResult {
  totalChecked: number;
  totalExpired: number;
  results: ExpirationCheckResult[];
}

/**
 * Subscription service options
 */
export interface SubscriptionServiceOptions {
  onActivation?: (status: SubscriptionStatus) => Promise<void>;
  onCancellation?: (status: SubscriptionStatus) => Promise<void>;
  onExpiration?: (result: ExpirationCheckResult) => Promise<void>;
  defaultGracePeriodDays?: number;
}
