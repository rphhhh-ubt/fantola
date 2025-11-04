import type {
  IImageClient,
  ImageGenerationRequest,
  ImageGenerationResponse,
  JobPollResult,
  JobStatus,
} from '../types';
import { ImageProvider } from '../types';

/**
 * fal.ai API client
 * https://fal.ai/docs
 */
export class FalClient implements IImageClient {
  public readonly provider = ImageProvider.FAL;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: { apiKey: string; baseUrl?: string; timeoutMs?: number }) {
    if (!config.apiKey) {
      throw new Error('fal.ai API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://queue.fal.run';
    this.timeoutMs = config.timeoutMs || 300000; // 5 minutes
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
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

    // Submit job to fal.ai queue
    const submitResponse = await fetch(`${this.baseUrl}/${request.model}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        prompt: request.prompt,
        image_size: this.getImageSize(request.width, request.height),
        num_images: request.numImages || 1,
        guidance_scale: request.guidanceScale || 7.5,
        num_inference_steps: request.numInferenceSteps || 50,
        seed: request.seed,
        negative_prompt: request.negativePrompt,
      }),
    });

    if (!submitResponse.ok) {
      const error = await submitResponse.text();
      throw new Error(`fal.ai API error: ${submitResponse.status} - ${error}`);
    }

    const submitData: any = await submitResponse.json();
    const requestId = submitData.request_id;

    // Poll for completion
    const result = await this.pollJobUntilComplete(requestId, startTime);

    if (result.status !== 'completed' || !result.result) {
      throw new Error(result.error || 'Job failed to complete');
    }

    return result.result;
  }

  async pollJob(jobId: string): Promise<JobPollResult> {
    try {
      const response = await fetch(`${this.baseUrl}/requests/${jobId}/status`, {
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
        case 'IN_QUEUE':
          return {
            status: 'queued' as JobStatus,
            progress: 0,
          };
        case 'IN_PROGRESS':
          return {
            status: 'in_progress' as JobStatus,
            progress: data.progress || 0.5,
          };
        case 'COMPLETED':
          return {
            status: 'completed' as JobStatus,
            progress: 1,
            result: this.parseResponse(data),
          };
        case 'FAILED':
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
    // fal.ai pricing (example - should be fetched from API or config)
    const baseModels: Record<string, number> = {
      'fal-ai/flux/schnell': 0.003,
      'fal-ai/flux/dev': 0.025,
      'fal-ai/flux-pro': 0.05,
      'fal-ai/stable-diffusion-xl': 0.02,
      'fal-ai/stable-diffusion-v3-medium': 0.035,
    };

    const baseCost = baseModels[model] || 0.02;
    const pixels = width * height;
    const pixelMultiplier = pixels / (1024 * 1024); // 1MP baseline

    return baseCost * pixelMultiplier * numImages;
  }

  private async pollJobUntilComplete(
    requestId: string,
    startTime: number,
  ): Promise<JobPollResult> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5 second intervals

    while (attempts < maxAttempts) {
      const elapsed = Date.now() - startTime;
      if (elapsed > this.timeoutMs) {
        return {
          status: 'failed' as JobStatus,
          error: 'Job timeout exceeded',
        };
      }

      const result = await this.pollJob(requestId);

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
    const images = Array.isArray(data.images)
      ? data.images.map((img: any) => ({
          url: typeof img === 'string' ? img : img.url,
          width: img.width,
          height: img.height,
        }))
      : [];

    return {
      id: data.request_id,
      provider: this.provider,
      model: data.model || 'unknown',
      images,
      cost: data.cost,
      metadata: {
        seed: data.seed,
        guidanceScale: data.guidance_scale,
        inferenceSteps: data.num_inference_steps,
      },
      timings: {
        queueTime: data.queue_time,
        processingTime: data.inference_time,
        totalTime: (data.queue_time || 0) + (data.inference_time || 0),
      },
    };
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Key ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private getImageSize(width?: number, height?: number): string {
    const w = width || 1024;
    const h = height || 1024;

    // fal.ai prefers specific size formats
    if (w === h) {
      return 'square';
    } else if (w > h) {
      return 'landscape_16_9';
    } else {
      return 'portrait_9_16';
    }
  }
}
