import {
  MockTelegramBot,
  createMockTelegramUpdate,
  createMockTelegramMessage,
} from '@monorepo/test-utils';

describe('Bot Service', () => {
  let mockBot: MockTelegramBot;

  beforeEach(() => {
    mockBot = new MockTelegramBot();
  });

  afterEach(() => {
    mockBot.clearSentMessages();
    mockBot.clearMockResponses();
  });

  describe('Telegram Bot', () => {
    it('should send a message', async () => {
      const chatId = 12345;
      const text = 'Hello, World!';

      const result = await mockBot.sendMessage(chatId, text);

      expect(result.text).toBe(text);
      expect(result.chat.id).toBe(chatId);
      expect(mockBot.getSentMessages()).toHaveLength(1);
      expect(mockBot.getSentMessages()[0].text).toBe(text);
    });

    it('should handle multiple messages', async () => {
      await mockBot.sendMessage(12345, 'First message');
      await mockBot.sendMessage(12345, 'Second message');

      expect(mockBot.getSentMessages()).toHaveLength(2);
    });
  });

  describe('Mock Updates', () => {
    it('should create telegram update', () => {
      const update = createMockTelegramUpdate();

      expect(update.update_id).toBeDefined();
      expect(update.message).toBeDefined();
      expect(update.message?.from?.username).toBe('testuser');
    });

    it('should create telegram message', () => {
      const message = createMockTelegramMessage({ text: 'Custom text' });

      expect(message.message_id).toBeDefined();
      expect(message.text).toBe('Custom text');
    });

    it('should override default values', () => {
      const update = createMockTelegramUpdate({
        message: {
          message_id: 999,
          chat: { id: 999, type: 'group' },
          date: 1234567890,
          text: 'Custom message',
        },
      });

      expect(update.message?.text).toBe('Custom message');
      expect(update.message?.chat.type).toBe('group');
    });
  });
});
