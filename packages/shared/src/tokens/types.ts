import type { OperationType, SubscriptionTier } from '@monorepo/database';

/**
 * Token operation result
 */
export interface TokenOperationResult {
  success: boolean;
  newBalance: number;
  tokensSpent: number;
  ledgerEntryId?: string;
  error?: string;
}

/**
 * Token balance information
 */
export interface TokenBalance {
  userId: string;
  tokensBalance: number;
  tokensSpent: number;
  tier: SubscriptionTier;
  lastRenewalAt?: Date | null;
}

/**
 * Token ledger entry
 */
export interface TokenLedgerEntry {
  id: string;
  userId: string;
  operationType: OperationType;
  tokensAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Token debit options
 */
export interface TokenDebitOptions {
  operationType: OperationType;
  amount: number;
  allowOverdraft?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Token credit options
 */
export interface TokenCreditOptions {
  operationType: OperationType;
  amount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Monthly renewal result
 */
export interface MonthlyRenewalResult {
  userId: string;
  tier: SubscriptionTier;
  tokensAdded: number;
  newBalance: number;
  previousBalance: number;
  renewalDate: Date;
  success: boolean;
  error?: string;
}

/**
 * Renewal eligibility check
 */
export interface RenewalEligibility {
  userId: string;
  eligible: boolean;
  reason?: string;
  nextRenewalDate?: Date;
  daysUntilRenewal?: number;
}

/**
 * Token costs per operation
 */
export const TOKEN_COSTS: Record<OperationType, number> = {
  image_generation: 10,
  sora_image: 10,
  product_card: 10,
  chatgpt_message: 5,
  refund: 0,
  purchase: 0,
  monthly_reset: 0,
};

/**
 * Monthly token allocations per tier
 */
export const MONTHLY_TOKEN_ALLOCATIONS: Record<SubscriptionTier, number> = {
  Gift: 100,
  Professional: 2000,
  Business: 10000,
};

/**
 * Renewal periods in days per tier
 */
export const RENEWAL_PERIODS: Record<SubscriptionTier, number> = {
  Gift: 30, // Monthly
  Professional: 30, // Monthly
  Business: 30, // Monthly
};

/**
 * Options for token service
 */
export interface TokenServiceOptions {
  enableCache?: boolean;
  cacheInvalidationCallback?: (userId: string) => Promise<void>;
  metricsCallback?: (metrics: TokenMetrics) => void;
}

/**
 * Token metrics for monitoring
 */
export interface TokenMetrics {
  operation: string;
  userId: string;
  amount: number;
  success: boolean;
  duration: number;
  error?: string;
}

/**
 * Batch renewal options
 */
export interface BatchRenewalOptions {
  tier?: SubscriptionTier;
  limit?: number;
  dryRun?: boolean;
  continueOnError?: boolean;
}

/**
 * Batch renewal result
 */
export interface BatchRenewalResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  renewals: MonthlyRenewalResult[];
  errors: Array<{ userId: string; error: string }>;
}
