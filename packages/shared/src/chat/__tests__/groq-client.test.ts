import { GroqClient } from '../clients/groq-client';
import { ChatProvider } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('GroqClient', () => {
  let client: GroqClient;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    client = new GroqClient({
      apiKey: mockApiKey,
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with required config', () => {
      expect(client).toBeInstanceOf(GroqClient);
      expect(client.provider).toBe(ChatProvider.GROQ);
    });

    it('should throw error if API key is missing', () => {
      expect(() => new GroqClient({ apiKey: '' })).toThrow('Groq API key is required');
    });

    it('should use custom base URL if provided', () => {
      const customClient = new GroqClient({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.groq.com/api',
      });
      expect(customClient).toBeInstanceOf(GroqClient);
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
        'https://api.groq.com/openai/v1/models',
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
        id: 'chatcmpl-groq-123',
        model: 'llama-3.1-8b-instant',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I assist you today?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40,
        },
        system_fingerprint: 'fp_test',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.createCompletion({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Hello' }],
        user: 'user-123',
      });

      expect(result).toEqual({
        id: 'chatcmpl-groq-123',
        provider: ChatProvider.GROQ,
        model: 'llama-3.1-8b-instant',
        content: 'Hello! How can I assist you today?',
        finishReason: 'stop',
        usage: {
          promptTokens: 15,
          completionTokens: 25,
          totalTokens: 40,
        },
        cost: expect.any(Number),
        metadata: {
          provider: 'groq',
          model: 'llama-3.1-8b-instant',
          systemFingerprint: 'fp_test',
        },
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(
        client.createCompletion({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow('Groq API error: 429 - Rate limit exceeded');
    });

    it('should handle missing usage data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test',
          model: 'test-model',
          choices: [
            {
              message: { role: 'assistant', content: 'Test' },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await client.createCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.usage).toBeUndefined();
      expect(result.cost).toBeUndefined();
    });
  });

  describe('createStreamingCompletion', () => {
    it('should stream completion chunks', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Groq"}}]}\n',
        'data: {"choices":[{"delta":{"content":" is"}}]}\n',
        'data: {"choices":[{"delta":{"content":" fast"}}]}\n',
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
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Tell me about Groq' }],
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks).toEqual(['Groq', ' is', ' fast', '']);
    });

    it('should handle streaming errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      });

      const generator = client.createStreamingCompletion({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      await expect(generator.next()).rejects.toThrow('Groq API error: 503 - Service unavailable');
    });

    it('should handle null response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const generator = client.createStreamingCompletion({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      await expect(generator.next()).rejects.toThrow('Response body is null');
    });

    it('should handle usage data in stream', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Test"}}]}\n',
        'data: {"choices":[{"finish_reason":"stop","delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n',
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

      const chunks: any[] = [];
      for await (const chunk of client.createStreamingCompletion({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Hello' }],
      })) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for known models', () => {
      const cost = client.estimateCost('llama-3.1-8b-instant', 1000, 500);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBe((1000 / 1000) * 0.00005 + (500 / 1000) * 0.00008);
    });

    it('should estimate cost for large models', () => {
      const cost = client.estimateCost('llama-3.1-405b-reasoning', 1000, 500);
      expect(cost).toBeGreaterThan(0);
    });

    it('should use default pricing for unknown models', () => {
      const cost = client.estimateCost('unknown-model', 1000, 500);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBe((1000 / 1000) * 0.0001 + (500 / 1000) * 0.0001);
    });

    it('should handle zero tokens', () => {
      const cost = client.estimateCost('llama-3.1-8b-instant', 0, 0);
      expect(cost).toBe(0);
    });
  });
});
