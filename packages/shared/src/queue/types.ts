import type { JobsOptions } from 'bullmq';

/**
 * Job priority levels
 */
export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
  BACKGROUND = 5,
}

/**
 * Queue names used across the system
 */
export enum QueueName {
  IMAGE_GENERATION = 'image-generation',
  IMAGE_PROCESSING = 'image-processing',
  CHAT_PROCESSING = 'chat-processing',
  PAYMENT_PROCESSING = 'payment-processing',
  NOTIFICATION = 'notification',
  SUBSCRIPTION_RENEWAL = 'subscription-renewal',
}

/**
 * Base job data interface that all jobs must extend
 */
export interface BaseJobData {
  userId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Image generation job data
 */
export interface ImageGenerationJobData extends BaseJobData {
  prompt: string;
  tool: 'dalle' | 'sora' | 'stable-diffusion';
  options?: {
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
  };
}

/**
 * Image processing job data
 */
export interface ImageProcessingJobData extends BaseJobData {
  sourceUrl: string;
  sourceBuffer?: Buffer;
  sourcePath?: string;
  tool: 'dalle' | 'sora' | 'stable-diffusion';
}

/**
 * Chat processing job data
 */
export interface ChatProcessingJobData extends BaseJobData {
  message: string;
  conversationId?: string;
  model?: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  };
}

/**
 * Payment processing job data
 */
export interface PaymentProcessingJobData extends BaseJobData {
  paymentId: string;
  provider: 'yookassa' | 'stripe' | 'manual';
  amount: number;
  currency: string;
  subscriptionTier?: string;
}

/**
 * Notification job data
 */
export interface NotificationJobData extends BaseJobData {
  type: 'telegram' | 'email' | 'webhook';
  recipient: string;
  subject?: string;
  message: string;
  templateId?: string;
}

/**
 * Subscription renewal job data
 */
export interface SubscriptionRenewalJobData extends BaseJobData {
  subscriptionTier: string;
  tokensToAdd: number;
}

/**
 * Union type of all job data types
 */
export type JobData =
  | ImageGenerationJobData
  | ImageProcessingJobData
  | ChatProcessingJobData
  | PaymentProcessingJobData
  | NotificationJobData
  | SubscriptionRenewalJobData;

/**
 * Job result interface
 */
export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Extended job options with our custom fields
 */
export interface ExtendedJobOptions extends JobsOptions {
  priority?: JobPriority;
}

/**
 * Queue metrics data
 */
export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Job events for monitoring
 */
export enum JobEvent {
  ADDED = 'added',
  ACTIVE = 'active',
  PROGRESS = 'progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STALLED = 'stalled',
  REMOVED = 'removed',
}

/**
 * Queue event payload
 */
export interface QueueEventPayload<T = unknown> {
  jobId: string;
  queueName: string;
  event: JobEvent;
  data?: T;
  error?: Error;
  timestamp: number;
}
