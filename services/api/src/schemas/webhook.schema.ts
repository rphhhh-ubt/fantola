import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const amountSchema = z.object({
  value: z.string(),
  currency: z.string(),
});

const paymentMethodSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  saved: z.boolean().optional(),
  title: z.string().optional(),
});

const confirmationSchema = z.object({
  type: z.enum(['redirect', 'embedded', 'external']),
  confirmation_url: z.string().optional(),
  return_url: z.string().optional(),
});

const cancellationDetailsSchema = z.object({
  party: z.string(),
  reason: z.string(),
});

const paymentObjectSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'waiting_for_capture', 'succeeded', 'canceled']),
  amount: amountSchema,
  income_amount: amountSchema.optional(),
  description: z.string().optional(),
  payment_method: paymentMethodSchema.optional(),
  captured_at: z.string().optional(),
  created_at: z.string(),
  expires_at: z.string().optional(),
  confirmation: confirmationSchema.optional(),
  test: z.boolean(),
  paid: z.boolean(),
  refundable: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
  cancellation_details: cancellationDetailsSchema.optional(),
});

const refundObjectSchema = z.object({
  id: z.string(),
  payment_id: z.string(),
  status: z.enum(['pending', 'succeeded', 'canceled']),
  created_at: z.string(),
  amount: amountSchema,
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const yookassaWebhookNotificationSchema = z.object({
  type: z.literal('notification'),
  event: z.enum(['payment.succeeded', 'payment.canceled', 'refund.succeeded']),
  object: z.union([paymentObjectSchema, refundObjectSchema]),
});

export type YooKassaWebhookNotification = z.infer<typeof yookassaWebhookNotificationSchema>;
export type YooKassaPaymentObject = z.infer<typeof paymentObjectSchema>;
export type YooKassaRefundObject = z.infer<typeof refundObjectSchema>;

export const webhookNotificationJsonSchema = zodToJsonSchema(
  yookassaWebhookNotificationSchema,
  'yookassaWebhookNotificationSchema'
);

export const webhookResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const webhookResponseJsonSchema = zodToJsonSchema(
  webhookResponseSchema,
  'webhookResponseSchema'
);
