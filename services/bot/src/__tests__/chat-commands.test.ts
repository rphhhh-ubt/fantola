import { handleChat, handleChatClear } from '../commands/chat';
import { BotContext, SessionData } from '../types';
import { I18n } from '../i18n';
import { ChatHandler } from '../handlers/chat-handler';

describe('Chat Commands', () => {
  let mockContext: BotContext;
  let mockChatHandler: jest.Mocked<ChatHandler>;

  beforeEach(() => {
    mockChatHandler = {
      handle: jest.fn(),
      handleStream: jest.fn(),
      clearContext: jest.fn(),
    } as any;

    mockContext = {
      user: {
        id: 'test-user-id',
        telegramId: '12345',
        username: 'testuser',
        tokensBalance: 100,
      },
      session: {} as SessionData,
      i18n: new I18n('en'),
      reply: jest.fn(),
      chatHandler: mockChatHandler,
    } as any;

    jest.clearAllMocks();
  });

  describe('/chat command', () => {
    it('should show start message for new conversation', async () => {
      // Execute
      await handleChat(mockContext);

      // Verify start message shown
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Conversational Chat Started')
      );
    });

    it('should show continue message for existing conversation', async () => {
      // Setup existing conversation
      mockContext.session.conversationContext = {
        messageCount: 5,
        lastCommand: 'chat',
        lastPrompt: 'Previous response',
        conversationId: 'test-conversation-id',
        history: [],
      };

      // Execute
      await handleChat(mockContext);

      // Verify continue message with count
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('5')
      );
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Continuing Conversation')
      );
    });

    it('should handle missing user gracefully', async () => {
      // Setup
      mockContext.user = undefined;

      // Execute
      await handleChat(mockContext);

      // Verify error message
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('profile')
      );
    });
  });

  describe('/chatclear command', () => {
    it('should clear conversation context', async () => {
      // Setup
      mockContext.session.conversationContext = {
        messageCount: 5,
        lastCommand: 'chat',
        lastPrompt: 'Previous response',
        conversationId: 'test-conversation-id',
        history: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      };

      // Execute
      await handleChatClear(mockContext);

      // Verify clearContext called
      expect(mockChatHandler.clearContext).toHaveBeenCalledWith(mockContext);

      // Verify confirmation message
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Conversation Cleared')
      );
    });

    it('should handle missing chat handler', async () => {
      // Setup
      mockContext.chatHandler = undefined;

      // Execute
      await handleChatClear(mockContext);

      // Verify error message
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
    });
  });
});
