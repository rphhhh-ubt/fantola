import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

// Enums
export const subscriptionTierSchema = z.enum(['Gift', 'Professional', 'Business']);
export const paymentStatusSchema = z.enum(['pending', 'succeeded', 'failed', 'canceled', 'refunded']);
export const paymentProviderSchema = z.enum(['yookassa', 'stripe', 'manual']);

// Create Payment Session Request
export const createPaymentSessionRequestSchema = z.object({
  subscriptionTier: subscriptionTierSchema,
  returnUrl: z.string().url().optional(),
});

// Create Payment Session Response
export const createPaymentSessionResponseSchema = z.object({
  paymentId: z.string(),
  confirmationUrl: z.string().url(),
  externalId: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: paymentStatusSchema,
  expiresAt: z.string().optional(),
});

// List Payments Query Parameters
export const listPaymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: paymentStatusSchema.optional(),
});

// Payment Item Response
export const paymentItemSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  provider: paymentProviderSchema,
  status: paymentStatusSchema,
  amountRubles: z.number(),
  currency: z.string(),
  description: z.string(),
  subscriptionTier: subscriptionTierSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  confirmedAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

// List Payments Response
export const listPaymentsResponseSchema = z.object({
  items: z.array(paymentItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});

// Get Payment Response (single payment)
export const getPaymentResponseSchema = paymentItemSchema;

// Types
export type CreatePaymentSessionRequest = z.infer<typeof createPaymentSessionRequestSchema>;
export type CreatePaymentSessionResponse = z.infer<typeof createPaymentSessionResponseSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type PaymentItem = z.infer<typeof paymentItemSchema>;
export type ListPaymentsResponse = z.infer<typeof listPaymentsResponseSchema>;
export type GetPaymentResponse = z.infer<typeof getPaymentResponseSchema>;

// JSON Schemas for OpenAPI
export const createPaymentSessionRequestJsonSchema = zodToJsonSchema(
  createPaymentSessionRequestSchema,
  'createPaymentSessionRequest'
);

export const createPaymentSessionResponseJsonSchema = zodToJsonSchema(
  createPaymentSessionResponseSchema,
  'createPaymentSessionResponse'
);

export const listPaymentsQueryJsonSchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    status: { type: 'string', enum: ['pending', 'succeeded', 'failed', 'canceled', 'refunded'] },
  },
};

export const listPaymentsResponseJsonSchema = zodToJsonSchema(
  listPaymentsResponseSchema,
  'listPaymentsResponse'
);

export const getPaymentResponseJsonSchema = zodToJsonSchema(
  getPaymentResponseSchema,
  'getPaymentResponse'
);
