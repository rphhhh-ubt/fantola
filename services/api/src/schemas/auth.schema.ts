import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

export const loginRequestSchema = z.object({
  telegramId: z.number().int().positive(),
  username: z.string().optional(),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    telegramId: z.number(),
    username: z.string().nullable(),
    tier: z.string(),
  }),
});

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number().optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const loginRequestJsonSchema = zodToJsonSchema(loginRequestSchema, 'loginRequest');
export const loginResponseJsonSchema = zodToJsonSchema(loginResponseSchema, 'loginResponse');
export const errorResponseJsonSchema = zodToJsonSchema(errorResponseSchema, 'errorResponse');
