import type {
  IImageClient,
  ImageGenerationRequest,
  ImageGenerationResponse,
  JobPollResult,
  JobStatus,
} from '../types';
import { ImageProvider } from '../types';

/**
 * Together.ai API client
 * https://docs.together.ai/docs/inference-rest
 */
export class TogetherClient implements IImageClient {
  public readonly provider = ImageProvider.TOGETHER;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    if (!config.apiKey) {
      throw new Error('Together.ai API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.together.xyz/v1';
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

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        width: request.width || 1024,
        height: request.height || 1024,
        n: request.numImages || 1,
        steps: request.numInferenceSteps || 50,
        seed: request.seed,
        negative_prompt: request.negativePrompt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Together.ai API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    const endTime = Date.now();

    return this.parseResponse(data, startTime, endTime);
  }

  async pollJob(jobId: string): Promise<JobPollResult> {
    try {
      const response = await fetch(`${this.baseUrl}/images/generations/${jobId}`, {
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
        case 'queued':
          return {
            status: 'queued' as JobStatus,
            progress: 0,
          };
        case 'processing':
          return {
            status: 'in_progress' as JobStatus,
            progress: data.progress || 0.5,
          };
        case 'completed':
          return {
            status: 'completed' as JobStatus,
            progress: 1,
            result: this.parseResponse(data, 0, 0),
          };
        case 'failed':
          return {
            status: 'failed' as JobStatus,
            error: data.error || 'Job failed',
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

  estimateCost(model: string, width: number, height: number, numImages: number): number {
    // Together.ai pricing (example - should be fetched from API or config)
    const baseModels: Record<string, number> = {
      'black-forest-labs/FLUX.1-schnell': 0.003,
      'black-forest-labs/FLUX.1-dev': 0.025,
      'stabilityai/stable-diffusion-xl-base-1.0': 0.02,
      'stabilityai/stable-diffusion-2-1': 0.01,
      'runwayml/stable-diffusion-v1-5': 0.008,
    };

    const baseCost = baseModels[model] || 0.015;
    const pixels = width * height;
    const pixelMultiplier = pixels / (1024 * 1024); // 1MP baseline

    return baseCost * pixelMultiplier * numImages;
  }

  private parseResponse(
    data: any,
    startTime: number,
    endTime: number,
  ): ImageGenerationResponse {
    const images =
      data.data?.map((item: any) => ({
        url: item.url || item.b64_json,
        width: item.width,
        height: item.height,
      })) || [];

    return {
      id: data.id || `together-${Date.now()}`,
      provider: this.provider,
      model: data.model || 'unknown',
      images,
      cost: this.calculateCostFromResponse(data),
      metadata: {
        seed: data.seed,
        steps: data.steps,
      },
      timings:
        startTime && endTime
          ? {
              totalTime: endTime - startTime,
            }
          : undefined,
    };
  }

  private calculateCostFromResponse(data: any): number | undefined {
    if (data.usage?.cost) {
      return data.usage.cost;
    }

    if (data.model && data.data?.length) {
      const width = data.data[0]?.width || 1024;
      const height = data.data[0]?.height || 1024;
      return this.estimateCost(data.model, width, height, data.data.length);
    }

    return undefined;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}
