/**
 * Supported chat providers
 */
export enum ChatProvider {
  OPENROUTER = 'openrouter',
  GROQ = 'groq',
}

/**
 * Chat message role
 */
export type ChatRole = 'system' | 'user' | 'assistant';

/**
 * Chat message structure
 */
export interface ChatCompletionMessage {
  role: ChatRole;
  content: string;
}

/**
 * Chat completion request options
 */
export interface ChatCompletionOptions {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  user?: string;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  provider: ChatProvider;
  model: string;
  content: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Streaming chunk from chat completion
 */
export interface ChatCompletionChunk {
  delta: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: ChatProvider;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
  models: string[];
  costPerToken?: Record<string, { input: number; output: number }>;
}

/**
 * Chat client interface
 */
export interface IChatClient {
  provider: ChatProvider;
  isAvailable(): Promise<boolean>;
  createCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;
  createStreamingCompletion(
    options: ChatCompletionOptions,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown>;
  estimateCost(model: string, promptTokens: number, completionTokens: number): number;
}

/**
 * Provider selection strategy
 */
export enum SelectionStrategy {
  LOWEST_COST = 'lowest_cost',
  HIGHEST_PRIORITY = 'highest_priority',
  ROUND_ROBIN = 'round_robin',
}

/**
 * Provider selection options
 */
export interface ProviderSelectionOptions {
  model?: string;
  strategy?: SelectionStrategy;
  excludeProviders?: ChatProvider[];
  conversationId?: string;
}

/**
 * Chat service options
 */
export interface ChatServiceOptions {
  tokenServiceOptions?: {
    enableCache?: boolean;
    cacheInvalidationCallback?: (userId: string) => Promise<void>;
  };
  moderationEnabled?: boolean;
  maxConversationHistory?: number;
  defaultModel?: string;
  defaultProvider?: ChatProvider | undefined;
}

/**
 * Moderation result
 */
export interface ModerationResult {
  flagged: boolean;
  categories: {
    hate?: boolean;
    hateThreatening?: boolean;
    selfHarm?: boolean;
    sexual?: boolean;
    sexualMinors?: boolean;
    violence?: boolean;
    violenceGraphic?: boolean;
  };
  scores: Record<string, number>;
}

/**
 * Chat completion result with token deduction
 */
export interface ChatCompletionResult {
  response: ChatCompletionResponse;
  tokensDeducted: number;
  newBalance: number;
  conversationId: string;
  messageIds: {
    userMessageId: string;
    assistantMessageId: string;
  };
}

/**
 * Model pricing information
 */
export interface ModelPricing {
  model: string;
  provider: ChatProvider;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: ChatProvider;
  available: boolean;
  latency?: number;
  lastChecked: Date;
  error?: string;
}
