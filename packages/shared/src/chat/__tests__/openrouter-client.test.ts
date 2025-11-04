import { OpenRouterClient } from '../clients/openrouter-client';
import { ChatProvider } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenRouterClient', () => {
  let client: OpenRouterClient;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    client = new OpenRouterClient({
      apiKey: mockApiKey,
      siteName: 'Test Site',
      siteUrl: 'https://test.com',
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with required config', () => {
      expect(client).toBeInstanceOf(OpenRouterClient);
      expect(client.provider).toBe(ChatProvider.OPENROUTER);
    });

    it('should throw error if API key is missing', () => {
      expect(() => new OpenRouterClient({ apiKey: '' })).toThrow('OpenRouter API key is required');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is available', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      const result = await client.isAvailable();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
          }),
        }),
      );
    });

    it('should return false when API is unavailable', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('createCompletion', () => {
    it('should create a successful completion', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'openai/gpt-3.5-turbo',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.createCompletion({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toEqual({
        id: 'chatcmpl-123',
        provider: ChatProvider.OPENROUTER,
        model: 'openai/gpt-3.5-turbo',
        content: 'Hello! How can I help you?',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        cost: expect.any(Number),
        metadata: {
          provider: 'openrouter',
          model: 'openai/gpt-3.5-turbo',
        },
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        client.createCompletion({
          model: 'openai/gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow('OpenRouter API error: 401 - Unauthorized');
    });

    it('should handle empty response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          model: 'test-model',
          choices: [],
        }),
      });

      const result = await client.createCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('');
    });
  });

  describe('createStreamingCompletion', () => {
    it('should stream completion chunks', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" there"}}]}\n',
        'data: {"choices":[{"delta":{"content":"!"}}]}\n',
        'data: {"choices":[{"finish_reason":"stop","delta":{}}]}\n',
        'data: [DONE]\n',
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          mockChunks.forEach((chunk) => {
            controller.enqueue(encoder.encode(chunk));
          });
          controller.close();
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const chunks: string[] = [];
      for await (const chunk of client.createStreamingCompletion({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks).toEqual(['Hello', ' there', '!', '']);
    });

    it('should handle streaming errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      const generator = client.createStreamingCompletion({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      await expect(generator.next()).rejects.toThrow('OpenRouter API error: 500 - Server error');
    });

    it('should handle null response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const generator = client.createStreamingCompletion({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      await expect(generator.next()).rejects.toThrow('Response body is null');
    });

    it('should skip invalid JSON lines', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Valid"}}]}\n',
        'data: invalid json\n',
        'data: {"choices":[{"delta":{"content":"!"}}]}\n',
        'data: [DONE]\n',
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          mockChunks.forEach((chunk) => {
            controller.enqueue(encoder.encode(chunk));
          });
          controller.close();
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const chunks: string[] = [];
      for await (const chunk of client.createStreamingCompletion({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks).toEqual(['Valid', '!']);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for known models', () => {
      const cost = client.estimateCost('openai/gpt-3.5-turbo', 1000, 500);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBe((1000 / 1000) * 0.0005 + (500 / 1000) * 0.0015);
    });

    it('should use default pricing for unknown models', () => {
      const cost = client.estimateCost('unknown-model', 1000, 500);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBe((1000 / 1000) * 0.001 + (500 / 1000) * 0.002);
    });

    it('should handle zero tokens', () => {
      const cost = client.estimateCost('openai/gpt-3.5-turbo', 0, 0);
      expect(cost).toBe(0);
    });
  });
});
