import type {
  IImageClient,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageGenerationServiceOptions,
  ProviderSelectionOptions,
  FailoverResult,
  ProviderHealth,
  CostTracking,
  ImageProvider,
} from './types';
import { ModerationService } from './providers/moderation-service';
import { ProviderSelector } from './providers/provider-selector';

/**
 * Main image generation service with provider abstraction,
 * failover, cost tracking, and content moderation
 */
export class ImageGenerationService {
  private readonly providerSelector: ProviderSelector;
  private readonly moderationService: ModerationService;
  private readonly options: Required<ImageGenerationServiceOptions>;
  private readonly costTracking: CostTracking[] = [];

  constructor(
    providerSelector: ProviderSelector,
    options: ImageGenerationServiceOptions = {},
  ) {
    this.providerSelector = providerSelector;
    this.moderationService = new ModerationService();
    this.options = {
      moderationEnabled: options.moderationEnabled ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      pollIntervalMs: options.pollIntervalMs ?? 5000,
      maxPollAttempts: options.maxPollAttempts ?? 60,
    };
  }

  /**
   * Generate an image with automatic provider selection and failover
   */
  async generateImage(
    request: ImageGenerationRequest,
    selectionOptions?: ProviderSelectionOptions,
  ): Promise<ImageGenerationResponse> {
    // Content moderation pre-check
    if (this.options.moderationEnabled) {
      const moderationResult = this.moderationService.moderate(request.prompt);
      if (moderationResult.flagged) {
        throw new Error(
          `Content moderation flagged: ${moderationResult.flaggedTerms?.join(', ')}`,
        );
      }
    }

    // Get failover order
    const providers = await this.providerSelector.getFailoverOrder(selectionOptions);

    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // Try each provider in order
    const result = await this.executeWithFailover(request, providers);

    if (!result.success || !result.response) {
      const errorMessages = result.errors.map((e) => `${e.provider}: ${e.error}`).join('; ');
      throw new Error(`All providers failed: ${errorMessages}`);
    }

    return result.response;
  }

  /**
   * Generate image with a specific provider (no failover)
   */
  async generateImageWithProvider(
    provider: ImageProvider,
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    // Content moderation pre-check
    if (this.options.moderationEnabled) {
      const moderationResult = this.moderationService.moderate(request.prompt);
      if (moderationResult.flagged) {
        throw new Error(
          `Content moderation flagged: ${moderationResult.flaggedTerms?.join(', ')}`,
        );
      }
    }

    const client = await this.providerSelector.selectProvider({
      excludeProviders: Array.from(
        new Set(Object.values({ FAL: 'fal', TOGETHER: 'together', REPLICATE: 'replicate' })),
      ).filter((p) => p !== provider) as ImageProvider[],
    });

    if (!client || client.provider !== provider) {
      throw new Error(`Provider ${provider} not available`);
    }

    return this.executeGeneration(client, request);
  }

  /**
   * Check provider health status
   */
  async getProviderHealth(): Promise<ProviderHealth[]> {
    const providers = await this.providerSelector.getFailoverOrder();
    const healthChecks = await Promise.all(
      providers.map(async (client) => {
        const startTime = Date.now();
        try {
          const available = await client.isAvailable();
          const latency = Date.now() - startTime;

          return {
            provider: client.provider,
            available,
            latency,
            lastChecked: new Date(),
          };
        } catch (error) {
          return {
            provider: client.provider,
            available: false,
            lastChecked: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );

    return healthChecks;
  }

  /**
   * Get cost tracking history
   */
  getCostTracking(): CostTracking[] {
    return [...this.costTracking];
  }

  /**
   * Get total cost across all providers
   */
  getTotalCost(): number {
    return this.costTracking.reduce((sum, tracking) => sum + tracking.cost, 0);
  }

  /**
   * Clear cost tracking history
   */
  clearCostTracking(): void {
    this.costTracking.length = 0;
  }

  /**
   * Get moderation service for custom configuration
   */
  getModerationService(): ModerationService {
    return this.moderationService;
  }

  private async executeWithFailover(
    request: ImageGenerationRequest,
    providers: IImageClient[],
  ): Promise<FailoverResult> {
    const errors: Array<{ provider: ImageProvider; error: string }> = [];
    let attemptCount = 0;

    for (const client of providers) {
      attemptCount++;

      try {
        const response = await this.executeGeneration(client, request);

        return {
          success: true,
          provider: client.provider,
          response,
          errors,
          attemptCount,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          provider: client.provider,
          error: errorMessage,
        });

        // Track failed attempt
        this.trackCost({
          provider: client.provider,
          model: request.model,
          cost: 0,
          timestamp: new Date(),
          successful: false,
          metadata: { error: errorMessage },
        });

        // If not the last provider, wait before retrying
        if (client !== providers[providers.length - 1]) {
          await this.delay(this.options.retryDelayMs);
        }
      }
    }

    return {
      success: false,
      errors,
      attemptCount,
    };
  }

  private async executeGeneration(
    client: IImageClient,
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        const response = await client.generateImage(request);

        // Track successful generation
        this.trackCost({
          provider: client.provider,
          model: request.model,
          cost: response.cost || 0,
          timestamp: new Date(),
          successful: true,
          metadata: {
            numImages: request.numImages || 1,
            width: request.width,
            height: request.height,
          },
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // If not the last attempt, wait before retrying
        if (attempt < this.options.maxRetries - 1) {
          await this.delay(this.options.retryDelayMs * (attempt + 1)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Generation failed after retries');
  }

  private trackCost(tracking: CostTracking): void {
    this.costTracking.push(tracking);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
