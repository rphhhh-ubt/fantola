import type {
  IImageClient,
  ImageGenerationRequest,
  ImageGenerationResponse,
  JobPollResult,
  JobStatus,
  ImageProvider,
} from '@monorepo/shared';

export interface MockImageResponse {
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
 * Base mock client for image generation providers
 */
abstract class BaseMockImageClient implements IImageClient {
  abstract provider: ImageProvider;
  protected mockResponses: MockImageResponse[] = [];
  protected mockErrors: Error[] = [];
  protected calls: Array<{ request: ImageGenerationRequest }> = [];
  protected shouldFail = false;
  protected availabilityStatus = true;
  protected pollResults: Map<string, JobPollResult[]> = new Map();

  async isAvailable(): Promise<boolean> {
    return this.availabilityStatus;
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    this.calls.push({ request });

    if (this.shouldFail) {
      if (this.mockErrors.length > 0) {
        throw this.mockErrors.shift()!;
      }
      throw new Error(`${this.provider} generation failed`);
    }

    if (this.mockResponses.length > 0) {
      return this.mockResponses.shift()!;
    }

    return this.createDefaultResponse(request);
  }

  async pollJob(jobId: string): Promise<JobPollResult> {
    const results = this.pollResults.get(jobId);
    if (results && results.length > 0) {
      return results.shift()!;
    }

    return {
      status: 'completed' as JobStatus,
      progress: 1,
      result: this.createDefaultResponse({
        prompt: 'test prompt',
        model: 'test-model',
      }),
    };
  }

  estimateCost(_model: string, _width: number, _height: number, numImages: number): number {
    return 0.02 * numImages;
  }

  setMockResponse(response: MockImageResponse): void {
    this.mockResponses.push(response);
  }

  setMockResponses(responses: MockImageResponse[]): void {
    this.mockResponses = [...responses];
  }

  setMockError(error: Error): void {
    this.mockErrors.push(error);
  }

  setMockErrors(errors: Error[]): void {
    this.mockErrors = [...errors];
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  setAvailabilityStatus(status: boolean): void {
    this.availabilityStatus = status;
  }

  setPollResults(jobId: string, results: JobPollResult[]): void {
    this.pollResults.set(jobId, results);
  }

  getCalls(): Array<{ request: ImageGenerationRequest }> {
    return this.calls;
  }

  clearCalls(): void {
    this.calls = [];
  }

  clearMockResponses(): void {
    this.mockResponses = [];
  }

  clearMockErrors(): void {
    this.mockErrors = [];
  }

  reset(): void {
    this.clearCalls();
    this.clearMockResponses();
    this.clearMockErrors();
    this.shouldFail = false;
    this.availabilityStatus = true;
    this.pollResults.clear();
  }

  protected abstract createDefaultResponse(request: ImageGenerationRequest): ImageGenerationResponse;
}

/**
 * Mock fal.ai client
 */
export class MockFalClient extends BaseMockImageClient {
  public readonly provider: ImageProvider = 'fal' as ImageProvider;

  protected createDefaultResponse(request: ImageGenerationRequest): ImageGenerationResponse {
    return {
      id: `fal-${Date.now()}`,
      provider: this.provider,
      model: request.model,
      images: [
        {
          url: `https://fal.ai/mock/image-${Date.now()}.png`,
          width: request.width || 1024,
          height: request.height || 1024,
        },
      ],
      cost: 0.02,
      metadata: {
        seed: request.seed || 12345,
        guidanceScale: request.guidanceScale || 7.5,
      },
      timings: {
        queueTime: 100,
        processingTime: 2000,
        totalTime: 2100,
      },
    };
  }
}

/**
 * Mock Together.ai client
 */
export class MockTogetherClient extends BaseMockImageClient {
  public readonly provider: ImageProvider = 'together' as ImageProvider;

  protected createDefaultResponse(request: ImageGenerationRequest): ImageGenerationResponse {
    return {
      id: `together-${Date.now()}`,
      provider: this.provider,
      model: request.model,
      images: [
        {
          url: `https://together.ai/mock/image-${Date.now()}.png`,
          width: request.width || 1024,
          height: request.height || 1024,
        },
      ],
      cost: 0.015,
      metadata: {
        seed: request.seed || 54321,
        steps: request.numInferenceSteps || 50,
      },
      timings: {
        totalTime: 1800,
      },
    };
  }
}

/**
 * Mock Replicate client
 */
export class MockReplicateClient extends BaseMockImageClient {
  public readonly provider: ImageProvider = 'replicate' as ImageProvider;

  protected createDefaultResponse(request: ImageGenerationRequest): ImageGenerationResponse {
    return {
      id: `replicate-${Date.now()}`,
      provider: this.provider,
      model: request.model,
      images: [
        {
          url: `https://replicate.com/mock/image-${Date.now()}.png`,
          width: request.width || 1024,
          height: request.height || 1024,
        },
      ],
      cost: 0.025,
      metadata: {
        version: request.model,
      },
      timings: {
        queueTime: 150,
        processingTime: 2500,
        totalTime: 2650,
      },
    };
  }
}

/**
 * Helper to create a mock image response
 */
export function createMockImageResponse(
  overrides?: Partial<MockImageResponse>,
): MockImageResponse {
  return {
    id: `mock-${Date.now()}`,
    provider: 'fal' as ImageProvider,
    model: 'test-model',
    images: [
      {
        url: `https://mock.com/image-${Date.now()}.png`,
        width: 1024,
        height: 1024,
      },
    ],
    cost: 0.02,
    metadata: {},
    timings: {
      totalTime: 2000,
    },
    ...overrides,
  };
}
