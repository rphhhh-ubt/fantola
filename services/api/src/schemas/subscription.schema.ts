import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const subscriptionTierEnum = z.enum(['Gift', 'Professional', 'Business']);

export const tierCatalogEntrySchema = z.object({
  tier: subscriptionTierEnum,
  monthlyTokens: z.number(),
  priceRubles: z.number().nullable(),
  requestsPerMinute: z.number(),
  burstPerSecond: z.number(),
  requiresChannel: z.boolean(),
  description: z.string(),
  isActive: z.boolean(),
  features: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
});

export const subscriptionStatusSchema = z.object({
  userId: z.string().uuid(),
  tier: subscriptionTierEnum,
  isActive: z.boolean(),
  expiresAt: z.date().nullable(),
  autoRenew: z.boolean(),
  daysRemaining: z.number().nullable(),
});

export const activateSubscriptionRequestSchema = z.object({
  tier: subscriptionTierEnum,
  durationDays: z.number().int().positive(),
  autoRenew: z.boolean().optional().default(false),
  priceRubles: z.number().optional(),
  paymentMethod: z.string().optional(),
});

export const cancelSubscriptionRequestSchema = z.object({
  reason: z.string().optional(),
  immediate: z.boolean().optional().default(false),
});

export const subscriptionHistoryItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  tier: subscriptionTierEnum,
  priceRubles: z.number().nullable(),
  paymentMethod: z.string().nullable(),
  startedAt: z.date(),
  expiresAt: z.date().nullable(),
  canceledAt: z.date().nullable(),
  cancellationReason: z.string().nullable(),
  autoRenew: z.boolean(),
});

// JSON Schema conversions
export const tierCatalogResponseJsonSchema = zodToJsonSchema(
  z.object({
    tiers: z.array(tierCatalogEntrySchema),
  }),
  { target: 'openApi3' }
);

export const subscriptionStatusResponseJsonSchema = zodToJsonSchema(
  subscriptionStatusSchema.extend({
    expiresAt: z.string().nullable(),
  }),
  { target: 'openApi3' }
);

export const activateSubscriptionRequestJsonSchema = zodToJsonSchema(
  activateSubscriptionRequestSchema,
  { target: 'openApi3' }
);

export const activateSubscriptionResponseJsonSchema = zodToJsonSchema(
  z.object({
    success: z.boolean(),
    status: subscriptionStatusSchema
      .extend({
        expiresAt: z.string().nullable(),
      })
      .optional(),
    historyId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
  { target: 'openApi3' }
);

export const cancelSubscriptionRequestJsonSchema = zodToJsonSchema(
  cancelSubscriptionRequestSchema,
  { target: 'openApi3' }
);

export const cancelSubscriptionResponseJsonSchema = zodToJsonSchema(
  z.object({
    success: z.boolean(),
    status: subscriptionStatusSchema
      .extend({
        expiresAt: z.string().nullable(),
      })
      .optional(),
    error: z.string().optional(),
  }),
  { target: 'openApi3' }
);

export const subscriptionHistoryResponseJsonSchema = zodToJsonSchema(
  z.object({
    history: z.array(
      subscriptionHistoryItemSchema.extend({
        createdAt: z.string(),
        startedAt: z.string(),
        expiresAt: z.string().nullable(),
        canceledAt: z.string().nullable(),
      })
    ),
  }),
  { target: 'openApi3' }
);
