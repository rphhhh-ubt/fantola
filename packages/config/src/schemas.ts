import { z } from 'zod';

// Helper for boolean environment variables
const booleanString = z
  .string()
  .optional()
  .transform((val) => val === 'true')
  .default('false');

// Helper for number environment variables
const numberString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : defaultValue))
    .pipe(z.number());

// Helper for float environment variables
const floatString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : defaultValue))
    .pipe(z.number());

// Base configuration schema (common to all services)
export const baseConfigSchema = z.object({
  // Node environment
  nodeEnv: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  port: numberString(3000),

  // Logging
  logLevel: z
    .enum(['debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // Metrics and Monitoring
  enableMetrics: booleanString,
  metricsPort: numberString(9091),

  // Sentry
  sentryEnabled: booleanString,
  sentryDsn: z.string().optional(),
  sentryTracesSampleRate: floatString(1.0),
  sentryProfilesSampleRate: floatString(1.0),

  // Alerting
  alertWebhookUrl: z.string().optional(),

  // Redis
  redisHost: z.string().default('localhost'),
  redisPort: numberString(6379),
  redisPassword: z.string().optional(),
  redisUrl: z.string().optional(),
});

// Database configuration schema
export const databaseConfigSchema = z.object({
  postgresHost: z.string().default('localhost'),
  postgresPort: numberString(5432),
  postgresDb: z.string().default('monorepo'),
  postgresUser: z.string().default('postgres'),
  postgresPassword: z.string().default('postgres'),
  databaseUrl: z.string().optional(),
});

// Storage configuration schema
export const storageConfigSchema = z.object({
  storageType: z.enum(['local', 's3']).default('local'),
  storageBaseUrl: z.string().default('http://localhost/static'),
  storageLocalPath: z.string().default('/var/www/storage'),
  s3Endpoint: z.string().optional(),
  s3Region: z.string().default('us-east-1'),
  s3Bucket: z.string().optional(),
  s3AccessKeyId: z.string().optional(),
  s3SecretAccessKey: z.string().optional(),
});

// API configuration schema
export const apiConfigSchema = baseConfigSchema
  .merge(storageConfigSchema)
  .extend({
    apiPort: numberString(3000),
    apiBaseUrl: z.string().default('http://localhost:3000'),
    jwtSecret: z.string().min(1, 'JWT_SECRET is required'),
  });

// Bot configuration schema
export const botConfigSchema = baseConfigSchema.extend({
  telegramBotToken: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  telegramChannelId: z.string().optional(),
  telegramWebhookDomain: z.string().optional(),
  telegramWebhookPath: z.string().default('/webhook/telegram'),
  telegramWebhookUrl: z.string().optional(),
  telegramWebhookSecret: z.string().optional(),
  yookassaShopId: z.string().optional(),
  yookassaSecretKey: z.string().optional(),
  yookassaWebhookUrl: z.string().optional(),
  yookassaWebhookSecret: z.string().optional(),
  // API URL for product card generation
  apiBaseUrl: z.string().default('http://localhost:3000'),
  // AI providers
  groqApiKey: z.string().min(1, 'GROQ_API_KEY is required'),
  groqModel: z.string().default('llama-3.1-70b-versatile'),
  groqMaxTokens: numberString(2048),
  geminiApiKey: z.string().min(1, 'GEMINI_API_KEY is required'),
  geminiModel: z.string().default('gemini-1.5-flash'),
  geminiMaxTokens: numberString(2048),
});

// Worker configuration schema
export const workerConfigSchema = baseConfigSchema
  .merge(storageConfigSchema)
  .extend({
    workerConcurrency: numberString(5),
    workerReplicas: numberString(1),
    workerMaxJobsPerWorker: numberString(50),
  });

// Export types
export type BaseConfig = z.infer<typeof baseConfigSchema>;
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema> & DatabaseConfig;
export type BotConfig = z.infer<typeof botConfigSchema> & DatabaseConfig;
export type WorkerConfig = z.infer<typeof workerConfigSchema>;
