import type {
  IImageClient,
  ImageGenerationRequest,
  ImageGenerationResponse,
  JobPollResult,
  JobStatus,
} from '../types';
import { ImageProvider } from '../types';

/**
 * Replicate API client
 * https://replicate.com/docs/reference/http
 */
export class ReplicateClient implements IImageClient {
  public readonly provider = ImageProvider.REPLICATE;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: { apiKey: string; baseUrl?: string; timeoutMs?: number }) {
    if (!config.apiKey) {
      throw new Error('Replicate API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.replicate.com/v1';
    this.timeoutMs = config.timeoutMs || 300000; // 5 minutes
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();

    // Create prediction
    const createResponse = await fetch(`${this.baseUrl}/predictions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        version: request.model,
        input: {
          prompt: request.prompt,
          width: request.width || 1024,
          height: request.height || 1024,
          num_outputs: request.numImages || 1,
          guidance_scale: request.guidanceScale || 7.5,
          num_inference_steps: request.numInferenceSteps || 50,
          seed: request.seed,
          negative_prompt: request.negativePrompt,
        },
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Replicate API error: ${createResponse.status} - ${error}`);
    }

    const predictionData: any = await createResponse.json();
    const predictionId = predictionData.id;

    // Poll for completion
    const result = await this.pollJobUntilComplete(predictionId, startTime);

    if (result.status !== 'completed' || !result.result) {
      throw new Error(result.error || 'Prediction failed to complete');
    }

    return result.result;
  }

  async pollJob(jobId: string): Promise<JobPollResult> {
    try {
      const response = await fetch(`${this.baseUrl}/predictions/${jobId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          status: 'failed' as JobStatus,
          error: `Failed to poll job: ${response.status} - ${error}`,
        };
      }

      const data: any = await response.json();

      switch (data.status) {
        case 'starting':
        case 'queued':
          return {
            status: 'queued' as JobStatus,
            progress: 0,
          };
        case 'processing':
          return {
            status: 'in_progress' as JobStatus,
            progress: 0.5,
          };
        case 'succeeded':
          return {
            status: 'completed' as JobStatus,
            progress: 1,
            result: this.parseResponse(data),
          };
        case 'failed':
        case 'canceled':
          return {
            status: 'failed' as JobStatus,
            error: data.error || 'Prediction failed',
          };
        default:
          return {
            status: 'queued' as JobStatus,
          };
      }
    } catch (error) {
      return {
        status: 'failed' as JobStatus,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  estimateCost(_model: string, width: number, height: number, numImages: number): number {
    // Replicate pricing (example - should be fetched from API or config)
    // Replicate charges per second of GPU time
    const estimatedSeconds = 10; // Average generation time
    const costPerSecond = 0.00025; // Example GPU cost

    const pixels = width * height;
    const pixelMultiplier = pixels / (1024 * 1024); // 1MP baseline
    const timeMultiplier = pixelMultiplier * 0.5; // Larger images take longer

    return costPerSecond * estimatedSeconds * (1 + timeMultiplier) * numImages;
  }

  private async pollJobUntilComplete(
    predictionId: string,
    startTime: number,
  ): Promise<JobPollResult> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5 second intervals

    while (attempts < maxAttempts) {
      const elapsed = Date.now() - startTime;
      if (elapsed > this.timeoutMs) {
        return {
          status: 'failed' as JobStatus,
          error: 'Prediction timeout exceeded',
        };
      }

      const result = await this.pollJob(predictionId);

      if (result.status === 'completed' || result.status === 'failed') {
        return result;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    return {
      status: 'failed' as JobStatus,
      error: 'Max poll attempts exceeded',
    };
  }

  private parseResponse(data: any): ImageGenerationResponse {
    const output = data.output;
    let images: Array<{ url: string; width?: number; height?: number }> = [];

    if (Array.isArray(output)) {
      images = output.map((url: string) => ({ url }));
    } else if (typeof output === 'string') {
      images = [{ url: output }];
    }

    const metrics = data.metrics || {};
    const queueTime = metrics.predict_time ? metrics.predict_time * 1000 : undefined;

    return {
      id: data.id,
      provider: this.provider,
      model: data.version || 'unknown',
      images,
      cost: this.calculateCostFromMetrics(metrics),
      metadata: {
        version: data.version,
        input: data.input,
      },
      timings: {
        queueTime: queueTime,
        processingTime: queueTime,
        totalTime: queueTime,
      },
    };
  }

  private calculateCostFromMetrics(metrics: any): number | undefined {
    if (metrics.predict_time) {
      // Replicate charges per second
      const seconds = metrics.predict_time;
      const costPerSecond = 0.00025;
      return seconds * costPerSecond;
    }
    return undefined;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Token ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}
