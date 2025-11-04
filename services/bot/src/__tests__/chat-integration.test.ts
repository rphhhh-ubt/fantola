import { ChatHandler } from '../handlers/chat-handler';
import { AIService } from '../services/ai-service';
import { TokenService } from '@monorepo/shared';
import { OperationType, db } from '@monorepo/database';
import { BotContext, SessionData } from '../types';
import { I18n } from '../i18n';

// Mock dependencies
jest.mock('@monorepo/database', () => ({
  db: {
    chatMessage: {
      create: jest.fn(),
    },
  },
  OperationType: {
    chatgpt_message: 'chatgpt_message',
  },
}));

describe('Chat Integration Tests', () => {
  let chatHandler: ChatHandler;
  let mockAIService: jest.Mocked<AIService>;
  let mockTokenService: jest.Mocked<TokenService>;
  let mockContext: BotContext;

  beforeEach(() => {
    // Mock AI service
    mockAIService = {
      chat: jest.fn(),
      chatStream: jest.fn(),
      chatWithVision: jest.fn(),
      getUsageStats: jest.fn(),
    } as any;

    // Mock token service
    mockTokenService = {
      canAfford: jest.fn(),
      chargeForOperation: jest.fn(),
    } as any;

    // Create chat handler
    chatHandler = new ChatHandler({
      aiService: mockAIService,
      tokenService: mockTokenService,
    });

    // Create mock context
    mockContext = {
      user: {
        id: 'test-user-id',
        telegramId: '12345',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        tokensBalance: 100,
      },
      session: {} as SessionData,
      i18n: new I18n('en'),
      reply: jest.fn(),
      replyWithChatAction: jest.fn(),
      api: {
        editMessageText: jest.fn(),
      },
      chat: {
        id: 12345,
      },
    } as any;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Conversation Flow', () => {
    it('should start a new conversation without history', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chat.mockResolvedValue({
        content: 'Hello! How can I help you today?',
        provider: 'groq',
        model: 'llama-3.1-70b-versatile',
      });

      // Execute
      await chatHandler.handle(mockContext, 'Hello');

      // Verify affordability check
      expect(mockTokenService.canAfford).toHaveBeenCalledWith(
        'test-user-id',
        OperationType.chatgpt_message
      );

      // Verify AI service call with no history
      expect(mockAIService.chat).toHaveBeenCalledWith([
        {
          role: 'user',
          content: 'Hello',
        },
      ]);

      // Verify token deduction
      expect(mockTokenService.chargeForOperation).toHaveBeenCalledWith(
        'test-user-id',
        OperationType.chatgpt_message,
        expect.objectContaining({
          metadata: expect.objectContaining({
            provider: 'groq',
            model: 'llama-3.1-70b-versatile',
            prompt: 'Hello',
          }),
        })
      );

      // Verify chat messages logged to database
      expect(db.chatMessage.create).toHaveBeenCalledTimes(2);
      expect(db.chatMessage.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          userId: 'test-user-id',
          role: 'user',
          content: 'Hello',
          tokensUsed: 5,
        }),
      });
      expect(db.chatMessage.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          userId: 'test-user-id',
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        }),
      });

      // Verify response
      expect(mockContext.reply).toHaveBeenCalledWith('Hello! How can I help you today?');

      // Verify conversation context updated
      expect(mockContext.session.conversationContext).toBeDefined();
      expect(mockContext.session.conversationContext?.messageCount).toBe(1);
      expect(mockContext.session.conversationContext?.history).toHaveLength(2);
    });

    it('should maintain conversation context across multiple messages', async () => {
      // Setup initial conversation
      mockContext.session.conversationContext = {
        conversationId: 'test-conversation-id',
        messageCount: 1,
        lastCommand: 'chat',
        lastPrompt: 'Hello! How can I help you today?',
        history: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hello! How can I help you today?' },
        ],
      };

      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 95,
      });

      mockAIService.chat.mockResolvedValue({
        content: 'I can help you with various tasks. What would you like to do?',
        provider: 'groq',
        model: 'llama-3.1-70b-versatile',
      });

      // Execute
      await chatHandler.handle(mockContext, 'What can you do?');

      // Verify AI service call includes history
      expect(mockAIService.chat).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hello! How can I help you today?' },
        { role: 'user', content: 'What can you do?' },
      ]);

      // Verify conversation context updated with new messages
      expect(mockContext.session.conversationContext?.messageCount).toBe(2);
      expect(mockContext.session.conversationContext?.history).toHaveLength(4);
      expect(mockContext.session.conversationContext?.conversationId).toBe('test-conversation-id');
    });

    it('should limit conversation history to MAX_CONTEXT_MESSAGES (10)', async () => {
      // Setup conversation with 10 messages (5 exchanges)
      const history = [];
      for (let i = 0; i < 12; i++) {
        history.push({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Message ${i}`,
        });
      }

      mockContext.session.conversationContext = {
        conversationId: 'test-conversation-id',
        messageCount: 6,
        lastCommand: 'chat',
        lastPrompt: 'Message 11',
        history,
      };

      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 90,
      });

      mockAIService.chat.mockResolvedValue({
        content: 'Response to new message',
        provider: 'groq',
        model: 'llama-3.1-70b-versatile',
      });

      // Execute
      await chatHandler.handle(mockContext, 'New message');

      // Verify only last 10 messages are sent to AI
      expect(mockAIService.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: 'user', content: 'New message' },
        ])
      );
      const callArgs = mockAIService.chat.mock.calls[0][0];
      expect(callArgs.length).toBeLessThanOrEqual(11); // 10 from history + 1 new
    });
  });

  describe('Token Quota Checks', () => {
    it('should reject message when user has insufficient tokens', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: false,
        cost: 5,
        balance: 2,
      });

      // Execute
      await chatHandler.handle(mockContext, 'Hello');

      // Verify affordability check
      expect(mockTokenService.canAfford).toHaveBeenCalledWith(
        'test-user-id',
        OperationType.chatgpt_message
      );

      // Verify AI service NOT called
      expect(mockAIService.chat).not.toHaveBeenCalled();

      // Verify token NOT deducted
      expect(mockTokenService.chargeForOperation).not.toHaveBeenCalled();

      // Verify error message sent
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient tokens')
      );

      // Verify no chat messages logged
      expect(db.chatMessage.create).not.toHaveBeenCalled();
    });

    it('should deduct tokens only after successful AI response', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chat.mockResolvedValue({
        content: 'Test response',
        provider: 'groq',
        model: 'llama-3.1-70b-versatile',
      });

      // Execute
      await chatHandler.handle(mockContext, 'Test message');

      // Verify token deduction happens after AI call
      const aiCallOrder = mockAIService.chat.mock.invocationCallOrder[0];
      const tokenCallOrder = mockTokenService.chargeForOperation.mock.invocationCallOrder[0];
      expect(tokenCallOrder).toBeGreaterThan(aiCallOrder);

      // Verify correct amount deducted
      expect(mockTokenService.chargeForOperation).toHaveBeenCalledWith(
        'test-user-id',
        OperationType.chatgpt_message,
        expect.any(Object)
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit exceeded error', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chat.mockRejectedValue(
        new Error('Rate limit exceeded. Daily limit: 14400 requests')
      );

      // Execute
      await chatHandler.handle(mockContext, 'Test message');

      // Verify rate limit message sent
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded')
      );

      // Verify tokens NOT deducted when rate limited
      expect(mockTokenService.chargeForOperation).not.toHaveBeenCalled();

      // Verify no chat messages logged
      expect(db.chatMessage.create).not.toHaveBeenCalled();
    });

    it('should provide fallback message when AI service fails', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chat.mockRejectedValue(new Error('API connection failed'));

      // Execute
      await chatHandler.handle(mockContext, 'Test message');

      // Verify error message sent
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('AI Error')
      );

      // Verify tokens NOT deducted on error
      expect(mockTokenService.chargeForOperation).not.toHaveBeenCalled();
    });
  });

  describe('Streaming with Typing Indicators', () => {
    it('should handle streaming response with typing indicators', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      // Mock streaming generator
      async function* mockStreamGenerator() {
        yield 'Hello ';
        yield 'there! ';
        yield 'How ';
        yield 'can ';
        yield 'I ';
        yield 'help?';
      }

      mockAIService.chatStream = jest.fn().mockReturnValue(mockStreamGenerator());

      // Execute
      await chatHandler.handleStream(mockContext, 'Hello');

      // Verify typing indicator shown
      expect(mockContext.replyWithChatAction).toHaveBeenCalledWith('typing');

      // Verify streaming called
      expect(mockAIService.chatStream).toHaveBeenCalled();

      // Verify response sent
      expect(mockContext.reply).toHaveBeenCalled();

      // Verify tokens deducted
      expect(mockTokenService.chargeForOperation).toHaveBeenCalled();

      // Verify chat messages logged
      expect(db.chatMessage.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Context Clearing', () => {
    it('should clear conversation context', () => {
      // Setup
      mockContext.session.conversationContext = {
        conversationId: 'test-conversation-id',
        messageCount: 5,
        lastCommand: 'chat',
        lastPrompt: 'Some response',
        history: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      // Execute
      chatHandler.clearContext(mockContext);

      // Verify context cleared
      expect(mockContext.session.conversationContext).toBeUndefined();
    });
  });

  describe('Database Logging', () => {
    it('should log both user and assistant messages to database', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chat.mockResolvedValue({
        content: 'AI response',
        provider: 'groq',
        model: 'llama-3.1-70b-versatile',
      });

      // Execute
      await chatHandler.handle(mockContext, 'User message');

      // Verify both messages logged
      expect(db.chatMessage.create).toHaveBeenCalledTimes(2);

      // Verify user message
      expect(db.chatMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user-id',
          role: 'user',
          content: 'User message',
          tokensUsed: 5,
          conversationId: expect.any(String),
        }),
      });

      // Verify assistant message
      expect(db.chatMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user-id',
          role: 'assistant',
          content: 'AI response',
          model: 'llama-3.1-70b-versatile',
          conversationId: expect.any(String),
        }),
      });
    });

    it('should use same conversationId for all messages in a conversation', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chat.mockResolvedValue({
        content: 'Response',
        provider: 'groq',
        model: 'llama-3.1-70b-versatile',
      });

      // First message
      await chatHandler.handle(mockContext, 'First message');

      const firstConversationId = (db.chatMessage.create as jest.Mock).mock.calls[0][0].data
        .conversationId;

      // Second message
      await chatHandler.handle(mockContext, 'Second message');

      const secondConversationId = (db.chatMessage.create as jest.Mock).mock.calls[2][0].data
        .conversationId;

      // Verify same conversationId used
      expect(firstConversationId).toBe(secondConversationId);
    });
  });
});
