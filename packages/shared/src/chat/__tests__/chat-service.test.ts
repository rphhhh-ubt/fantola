import { ChatService } from '../chat-service';
import { OpenRouterClient } from '../clients/openrouter-client';
import { GroqClient } from '../clients/groq-client';
import { SelectionStrategy } from '../types';
import { OperationType } from '@monorepo/database';

// Mock fetch globally
global.fetch = jest.fn();

// Mock Prisma client
const mockPrismaClient: any = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  tokenOperation: {
    create: jest.fn(),
  },
  chatMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrismaClient)),
};

describe('ChatService', () => {
  let chatService: ChatService;
  let openrouterClient: OpenRouterClient;
  let groqClient: GroqClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    openrouterClient = new OpenRouterClient({ apiKey: 'test-openrouter-key' });
    groqClient = new GroqClient({ apiKey: 'test-groq-key' });
    chatService = new ChatService(mockPrismaClient as any, [openrouterClient, groqClient], {
      moderationEnabled: true,
      defaultModel: 'llama-3.1-8b-instant',
    });

    // Setup mock user with sufficient balance
    mockPrismaClient.user.findUnique.mockResolvedValue({
      id: 'user-123',
      tokensBalance: 100,
      tokensSpent: 0,
      tier: 'Gift',
    });

    mockPrismaClient.user.update.mockResolvedValue({
      id: 'user-123',
      tokensBalance: 95,
      tokensSpent: 5,
    });

    mockPrismaClient.tokenOperation.create.mockResolvedValue({
      id: 'op-123',
      userId: 'user-123',
      operationType: OperationType.chatgpt_message,
      tokensAmount: 5,
      balanceBefore: 100,
      balanceAfter: 95,
    });

    mockPrismaClient.chatMessage.create.mockResolvedValue({
      id: 'msg-123',
      userId: 'user-123',
      role: 'user',
      content: 'Hello',
      model: 'llama-3.1-8b-instant',
      conversationId: 'conv-123',
    });

    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  describe('createCompletion', () => {
    beforeEach(() => {
      // Setup default fetch mock for non-streaming requests
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/models')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'chatcmpl-123',
            model: 'llama-3.1-8b-instant',
            choices: [
              {
                message: { role: 'assistant', content: 'Hello! How can I help?' },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 15,
              total_tokens: 25,
            },
          }),
        });
      });
    });

    it('should create a chat completion successfully', async () => {
      const result = await chatService.createCompletion('user-123', [
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('tokensDeducted');
      expect(result).toHaveProperty('newBalance');
      expect(result).toHaveProperty('conversationId');
      expect(result).toHaveProperty('messageIds');
      expect(result.response.content).toBe('Hello! How can I help?');
      expect(result.tokensDeducted).toBe(5);
      expect(mockPrismaClient.chatMessage.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error when user has insufficient tokens', async () => {
      mockPrismaClient.user.findUnique.mockReset();
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'user-123',
        tokensBalance: 0,
        tokensSpent: 0,
        tier: 'Gift',
      });

      await expect(
        chatService.createCompletion('user-123', [{ role: 'user', content: 'Hello' }]),
      ).rejects.toThrow();
    });

    it('should flag inappropriate content when moderation is enabled', async () => {
      await expect(
        chatService.createCompletion('user-123', [
          { role: 'user', content: 'I hate violence' },
        ]),
      ).rejects.toThrow('Message flagged by moderation system');
    });

    it('should not moderate when moderation is disabled', async () => {
      const serviceWithoutModeration = new ChatService(
        mockPrismaClient as any,
        [groqClient],
        { moderationEnabled: false },
      );

      const result = await serviceWithoutModeration.createCompletion('user-123', [
        { role: 'user', content: 'I hate violence' },
      ]);

      expect(result).toBeDefined();
    });

    it('should select provider based on strategy', async () => {
      const result = await chatService.createCompletion(
        'user-123',
        [{ role: 'user', content: 'Hello' }],
        { strategy: SelectionStrategy.HIGHEST_PRIORITY },
      );

      expect(result).toBeDefined();
    });

    it('should handle custom model', async () => {
      const result = await chatService.createCompletion(
        'user-123',
        [{ role: 'user', content: 'Hello' }],
        { model: 'custom-model' },
      );

      expect(result.response.model).toBe('llama-3.1-8b-instant');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/models')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          text: async () => 'Internal server error',
        });
      });

      await expect(
        chatService.createCompletion('user-123', [{ role: 'user', content: 'Hello' }]),
      ).rejects.toThrow();
    });
  });

  describe('createStreamingCompletion', () => {
    it('should stream completion chunks', async () => {
      const mockChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" there"}}]}\n',
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

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/models')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
          ok: true,
          body: stream,
        });
      });

      const chunks: string[] = [];
      const generator = chatService.createStreamingCompletion('user-123', [
        { role: 'user', content: 'Hello' },
      ]);

      for await (const chunk of generator) {
        chunks.push(chunk.delta);
      }

      expect(chunks.join('')).toBe('Hello there');
      expect(mockPrismaClient.chatMessage.create).toHaveBeenCalledTimes(2);
    });

    it('should throw error for insufficient tokens', async () => {
      mockPrismaClient.user.findUnique.mockReset();
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'user-123',
        tokensBalance: 0,
        tokensSpent: 0,
        tier: 'Gift',
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {}\n'));
          controller.close();
        },
      });

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/models')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
          ok: true,
          body: stream,
        });
      });

      const generator = chatService.createStreamingCompletion('user-123', [
        { role: 'user', content: 'Hello' },
      ]);

      await expect(generator.next()).rejects.toThrow();
    });

    it('should flag inappropriate content in streaming', async () => {
      const generator = chatService.createStreamingCompletion('user-123', [
        { role: 'user', content: 'I hate violence' },
      ]);

      await expect(generator.next()).rejects.toThrow('Message flagged by moderation system');
    });
  });

  describe('getConversationHistory', () => {
    it('should retrieve conversation history', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId: 'user-123',
          role: 'user',
          content: 'Hello',
          conversationId: 'conv-123',
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          userId: 'user-123',
          role: 'assistant',
          content: 'Hi there!',
          conversationId: 'conv-123',
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.chatMessage.findMany.mockResolvedValueOnce(mockMessages);

      const history = await chatService.getConversationHistory('user-123', 'conv-123');

      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('should respect conversation history limit', async () => {
      mockPrismaClient.chatMessage.findMany.mockResolvedValueOnce([]);

      await chatService.getConversationHistory('user-123', 'conv-123', 10);

      expect(mockPrismaClient.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          conversationId: 'conv-123',
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 10,
      });
    });

    it('should return empty array for non-existent conversation', async () => {
      mockPrismaClient.chatMessage.findMany.mockResolvedValueOnce([]);

      const history = await chatService.getConversationHistory('user-123', 'non-existent');

      expect(history).toHaveLength(0);
    });
  });

  describe('getProviderHealth', () => {
    it('should return health status for all providers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const health = await chatService.getProviderHealth();

      expect(health).toHaveLength(2);
      expect(health[0]).toHaveProperty('provider');
      expect(health[0]).toHaveProperty('available');
      expect(health[0]).toHaveProperty('lastChecked');
    });

    it('should report unhealthy providers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const health = await chatService.getProviderHealth();

      expect(health.every((h) => !h.available)).toBe(true);
    });
  });
});
