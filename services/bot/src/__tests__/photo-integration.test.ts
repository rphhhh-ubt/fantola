import { PhotoHandler } from '../handlers/photo-handler';
import { AIService } from '../services/ai-service';
import { TokenService } from '@monorepo/shared';
import { db } from '@monorepo/database';
import { BotContext, SessionData } from '../types';
import { I18n } from '../i18n';
import axios from 'axios';

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

jest.mock('axios');

describe('Photo Handler Integration Tests', () => {
  let photoHandler: PhotoHandler;
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

    // Create photo handler
    photoHandler = new PhotoHandler({
      aiService: mockAIService,
      tokenService: mockTokenService,
    });

    // Create mock context with photo
    mockContext = {
      user: {
        id: 'test-user-id',
        telegramId: '12345',
        username: 'testuser',
        tokensBalance: 100,
      },
      message: {
        photo: [
          { file_id: 'test-file-id-1', width: 100, height: 100 },
          { file_id: 'test-file-id-2', width: 800, height: 600 },
        ],
        caption: 'What is in this image?',
      },
      session: {} as SessionData,
      i18n: new I18n('en'),
      reply: jest.fn(),
      replyWithChatAction: jest.fn(),
      api: {
        getFile: jest.fn().mockResolvedValue({ file_path: 'photos/test.jpg' }),
        token: 'test-bot-token',
      },
    } as any;

    // Mock axios for image download
    (axios.get as jest.Mock).mockResolvedValue({
      data: Buffer.from('fake-image-data'),
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Image Analysis with Context', () => {
    it('should analyze photo and maintain conversation context', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chatWithVision.mockResolvedValue({
        content: 'I see a beautiful landscape with mountains and a lake.',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
      });

      // Execute
      await photoHandler.handle(mockContext);

      // Verify file downloaded
      expect(mockContext.api.getFile).toHaveBeenCalledWith('test-file-id-2');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.telegram.org/file/bottest-bot-token/photos/test.jpg',
        { responseType: 'arraybuffer' }
      );

      // Verify AI service called with image
      expect(mockAIService.chatWithVision).toHaveBeenCalledWith(
        [{ role: 'user', content: 'What is in this image?' }],
        [{ data: expect.any(Buffer), mimeType: 'image/jpeg' }]
      );

      // Verify both messages logged to database
      expect(db.chatMessage.create).toHaveBeenCalledTimes(2);

      // Verify user message with image metadata
      expect(db.chatMessage.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          userId: 'test-user-id',
          role: 'user',
          content: 'What is in this image?',
          metadata: expect.objectContaining({
            hasImage: true,
          }),
        }),
      });

      // Verify assistant message with vision metadata
      expect(db.chatMessage.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          userId: 'test-user-id',
          role: 'assistant',
          content: 'I see a beautiful landscape with mountains and a lake.',
          metadata: expect.objectContaining({
            vision: true,
          }),
        }),
      });

      // Verify conversation context updated
      expect(mockContext.session.conversationContext).toBeDefined();
      expect(mockContext.session.conversationContext?.history).toHaveLength(2);
      expect(mockContext.session.conversationContext?.history?.[0].content).toContain('[Image]');
    });

    it('should use default prompt when no caption provided', async () => {
      // Setup - remove caption
      mockContext.message!.caption = undefined;

      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chatWithVision.mockResolvedValue({
        content: 'This is a test image.',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
      });

      // Execute
      await photoHandler.handle(mockContext);

      // Verify default prompt used
      expect(mockAIService.chatWithVision).toHaveBeenCalledWith(
        [{ role: 'user', content: 'What do you see in this image?' }],
        expect.any(Array)
      );
    });

    it('should handle insufficient tokens for photo analysis', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: false,
        cost: 5,
        balance: 2,
      });

      // Execute
      await photoHandler.handle(mockContext);

      // Verify AI service NOT called
      expect(mockAIService.chatWithVision).not.toHaveBeenCalled();

      // Verify error message sent
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient tokens')
      );

      // Verify no messages logged
      expect(db.chatMessage.create).not.toHaveBeenCalled();
    });

    it('should maintain same conversation ID across text and photo messages', async () => {
      // Setup with existing conversation
      mockContext.session.conversationContext = {
        conversationId: 'existing-conversation-id',
        messageCount: 2,
        lastCommand: 'chat',
        lastPrompt: 'Previous response',
        history: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chatWithVision.mockResolvedValue({
        content: 'I see an image.',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
      });

      // Execute
      await photoHandler.handle(mockContext);

      // Verify same conversation ID used
      expect(db.chatMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'existing-conversation-id',
        }),
      });

      // Verify history includes previous messages
      expect(mockContext.session.conversationContext?.history?.length).toBeGreaterThan(2);
    });
  });

  describe('Rate Limiting and Errors', () => {
    it('should handle rate limit exceeded for vision API', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chatWithVision.mockRejectedValue(
        new Error('Rate limit exceeded for Gemini')
      );

      // Execute
      await photoHandler.handle(mockContext);

      // Verify rate limit message sent
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded')
      );

      // Verify tokens NOT deducted
      expect(mockTokenService.chargeForOperation).not.toHaveBeenCalled();

      // Verify no messages logged
      expect(db.chatMessage.create).not.toHaveBeenCalled();
    });

    it('should handle vision API errors gracefully', async () => {
      // Setup
      mockTokenService.canAfford.mockResolvedValue({
        canAfford: true,
        cost: 5,
        balance: 100,
      });

      mockAIService.chatWithVision.mockRejectedValue(new Error('Vision API unavailable'));

      // Execute
      await photoHandler.handle(mockContext);

      // Verify error message sent
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('AI Error')
      );

      // Verify tokens NOT deducted
      expect(mockTokenService.chargeForOperation).not.toHaveBeenCalled();
    });
  });
});
