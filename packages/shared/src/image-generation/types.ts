/**
 * Supported image generation providers
 */
export enum ImageProvider {
  FAL = 'fal',
  TOGETHER = 'together',
  REPLICATE = 'replicate',
}

/**
 * Image generation request options
 */
export interface ImageGenerationRequest {
  prompt: string;
  model: string;
  width?: number;
  height?: number;
  numImages?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  seed?: number;
  negativePrompt?: string;
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  id: string;
  provider: ImageProvider;
  model: string;
  images: Array<{
    url: string;
    width?: number;
    height?: number;
  }>;
  cost?: number;
  metadata?: Record<string, unknown>;
  timings?: {
    queueTime?: number;
    processingTime?: number;
    totalTime?: number;
  };
}

/**
 * Job status for long-running operations
 */
export enum JobStatus {
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

/**
 * Job polling result
 */
export interface JobPollResult {
  status: JobStatus;
  progress?: number;
  result?: ImageGenerationResponse;
  error?: string;
}

/**
 * Image client interface
 */
export interface IImageClient {
  provider: ImageProvider;
  isAvailable(): Promise<boolean>;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
  pollJob(jobId: string): Promise<JobPollResult>;
  estimateCost(model: string, width: number, height: number, numImages: number): number;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: ImageProvider;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
  models: string[];
  costPerImage?: Record<string, number>;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Provider selection strategy
 */
export enum SelectionStrategy {
  LOWEST_COST = 'lowest_cost',
  HIGHEST_PRIORITY = 'highest_priority',
  ROUND_ROBIN = 'round_robin',
  FAILOVER = 'failover',
}

/**
 * Provider selection options
 */
export interface ProviderSelectionOptions {
  model?: string;
  strategy?: SelectionStrategy;
  excludeProviders?: ImageProvider[];
}

/**
 * Moderation categories for content filtering
 */
export interface ModerationResult {
  flagged: boolean;
  categories: {
    nudity?: boolean;
    alcohol?: boolean;
    logos?: boolean;
    violence?: boolean;
    inappropriate?: boolean;
  };
  scores?: Record<string, number>;
  flaggedTerms?: string[];
}

/**
 * Image generation service options
 */
export interface ImageGenerationServiceOptions {
  moderationEnabled?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: ImageProvider;
  available: boolean;
  latency?: number;
  lastChecked: Date;
  error?: string;
}

/**
 * Cost tracking information
 */
export interface CostTracking {
  provider: ImageProvider;
  model: string;
  cost: number;
  timestamp: Date;
  successful: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Failover result
 */
export interface FailoverResult {
  success: boolean;
  provider?: ImageProvider;
  response?: ImageGenerationResponse;
  errors: Array<{
    provider: ImageProvider;
    error: string;
  }>;
  attemptCount: number;
}
