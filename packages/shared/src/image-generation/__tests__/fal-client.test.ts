import { FalClient } from '../clients/fal-client';
import { ImageProvider } from '../types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('FalClient', () => {
  let client: FalClient;

  beforeEach(() => {
    client = new FalClient({
      apiKey: 'test-api-key',
    });
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => new FalClient({ apiKey: '' })).toThrow('fal.ai API key is required');
    });

    it('should use default base URL', () => {
      const testClient = new FalClient({ apiKey: 'test' });
      expect(testClient).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const testClient = new FalClient({
        apiKey: 'test',
        baseUrl: 'https://custom.fal.ai',
      });
      expect(testClient).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const available = await client.isAvailable();

      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/status'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Key test-api-key',
          }),
        }),
      );
    });

    it('should return false when API is unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  describe('generateImage', () => {
    it('should successfully generate an image', async () => {
      const requestId = 'req-123';
      const mockImages = ['https://fal.ai/image1.png'];

      // Mock submit response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: requestId }),
      });

      // Mock poll response (completed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'COMPLETED',
          request_id: requestId,
          model: 'fal-ai/flux/schnell',
          images: mockImages,
          cost: 0.003,
        }),
      });

      const response = await client.generateImage({
        prompt: 'A beautiful landscape',
        model: 'fal-ai/flux/schnell',
      });

      expect(response).toBeDefined();
      expect(response.id).toBe(requestId);
      expect(response.provider).toBe(ImageProvider.FAL);
      expect(response.images).toHaveLength(1);
      expect(response.images[0].url).toBe(mockImages[0]);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      await expect(
        client.generateImage({
          prompt: 'test',
          model: 'test-model',
        }),
      ).rejects.toThrow('fal.ai API error: 400');
    });

    it(
      'should handle job timeout',
      async () => {
        const shortTimeoutClient = new FalClient({
          apiKey: 'test',
          timeoutMs: 100,
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ request_id: 'req-123' }),
        });

        // Mock poll responses that never complete
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            status: 'IN_PROGRESS',
          }),
        });

        await expect(
          shortTimeoutClient.generateImage({
            prompt: 'test',
            model: 'test-model',
          }),
        ).rejects.toThrow('Job timeout exceeded');
      },
      10000,
    );

    it('should pass all request parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'req-123' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'COMPLETED',
          images: ['https://fal.ai/image.png'],
        }),
      });

      await client.generateImage({
        prompt: 'test prompt',
        model: 'test-model',
        width: 512,
        height: 768,
        numImages: 2,
        guidanceScale: 8.0,
        numInferenceSteps: 30,
        seed: 12345,
        negativePrompt: 'bad quality',
      });

      const submitCall = mockFetch.mock.calls[0];
      const body = JSON.parse(submitCall[1].body);

      expect(body.prompt).toBe('test prompt');
      expect(body.num_images).toBe(2);
      expect(body.guidance_scale).toBe(8.0);
      expect(body.num_inference_steps).toBe(30);
      expect(body.seed).toBe(12345);
      expect(body.negative_prompt).toBe('bad quality');
    });
  });

  describe('pollJob', () => {
    it('should return queued status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'IN_QUEUE',
        }),
      });

      const result = await client.pollJob('job-123');

      expect(result.status).toBe('queued');
      expect(result.progress).toBe(0);
    });

    it('should return in_progress status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'IN_PROGRESS',
          progress: 0.5,
        }),
      });

      const result = await client.pollJob('job-123');

      expect(result.status).toBe('in_progress');
      expect(result.progress).toBe(0.5);
    });

    it('should return completed status with result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'COMPLETED',
          request_id: 'job-123',
          images: ['https://fal.ai/image.png'],
        }),
      });

      const result = await client.pollJob('job-123');

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(1);
      expect(result.result).toBeDefined();
    });

    it('should return failed status with error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'FAILED',
          error: 'Generation failed',
        }),
      });

      const result = await client.pollJob('job-123');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Generation failed');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.pollJob('job-123');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Network error');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for known models', () => {
      const cost = client.estimateCost('fal-ai/flux/schnell', 1024, 1024, 1);

      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should scale cost with image size', () => {
      const cost1 = client.estimateCost('fal-ai/flux/schnell', 512, 512, 1);
      const cost2 = client.estimateCost('fal-ai/flux/schnell', 1024, 1024, 1);

      expect(cost2).toBeGreaterThan(cost1);
    });

    it('should scale cost with number of images', () => {
      const cost1 = client.estimateCost('fal-ai/flux/schnell', 1024, 1024, 1);
      const cost2 = client.estimateCost('fal-ai/flux/schnell', 1024, 1024, 2);

      expect(cost2).toBeGreaterThan(cost1);
      expect(cost2).toBeCloseTo(cost1 * 2, 5);
    });

    it('should use default cost for unknown models', () => {
      const cost = client.estimateCost('unknown-model', 1024, 1024, 1);

      expect(cost).toBeGreaterThan(0);
    });
  });
});
