import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  uptime: z.number(),
  service: z.string(),
  version: z.string(),
});

export const healthDetailedResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  uptime: z.number(),
  service: z.string(),
  version: z.string(),
  database: z.object({
    connected: z.boolean(),
  }),
  memory: z.object({
    heapUsed: z.number(),
    heapTotal: z.number(),
    rss: z.number(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type HealthDetailedResponse = z.infer<typeof healthDetailedResponseSchema>;

export const healthResponseJsonSchema = zodToJsonSchema(healthResponseSchema, 'healthResponse');
export const healthDetailedResponseJsonSchema = zodToJsonSchema(
  healthDetailedResponseSchema,
  'healthDetailedResponse'
);
