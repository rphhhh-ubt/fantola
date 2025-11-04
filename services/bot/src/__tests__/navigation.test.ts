import { handleTextMessage } from '../handlers/text';
import { BotContext } from '../types';
import { I18n } from '../i18n';

describe('Navigation Handlers', () => {
  let mockContext: Partial<BotContext>;
  let mockReply: jest.Mock;

  beforeEach(() => {
    mockReply = jest.fn();
    mockContext = {
      message: {
        text: '',
      } as any,
      i18n: new I18n('en'),
      user: {
        id: 'user-123',
        telegramId: '123456789',
        firstName: 'Test',
        username: 'testuser',
        tier: 'Gift' as any,
        tokensBalance: 100,
        tokensSpent: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      reply: mockReply,
    };
  });

  describe('Product Card navigation', () => {
    it('should handle Product Card button (English)', async () => {
      mockContext.message!.text = '🎨 Product Card';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Product Card Generation'),
        expect.any(Object)
      );
    });

    it('should handle Product Card button (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = '🎨 Карточка товара';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Генерация карточки товара'),
        expect.any(Object)
      );
    });
  });

  describe('Sora Image navigation', () => {
    it('should handle Sora Image button (English)', async () => {
      mockContext.message!.text = '🎬 Sora Image';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Sora Image Generation'),
        expect.any(Object)
      );
    });

    it('should handle Sora Image button (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = '🎬 Sora изображение';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Генерация изображений Sora'),
        expect.any(Object)
      );
    });
  });

  describe('ChatGPT navigation', () => {
    it('should handle ChatGPT button (English)', async () => {
      mockContext.message!.text = '💬 ChatGPT';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('ChatGPT'),
        expect.any(Object)
      );
    });

    it('should handle ChatGPT button (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = '💬 ChatGPT';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('ChatGPT'),
        expect.any(Object)
      );
    });
  });

  describe('Profile navigation', () => {
    it('should handle My Profile button (English)', async () => {
      mockContext.message!.text = '👤 My Profile';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Your Profile'),
        expect.any(Object)
      );
    });

    it('should handle My Profile button (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = '👤 Мой профиль';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Ваш профиль'),
        expect.any(Object)
      );
    });

    it('should handle missing user gracefully', async () => {
      mockContext.user = null;
      mockContext.message!.text = '👤 My Profile';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Unable to load profile')
      );
    });
  });

  describe('Support navigation', () => {
    it('should handle Support button (English)', async () => {
      mockContext.message!.text = '❓ Support';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Support'),
        expect.any(Object)
      );
    });

    it('should handle Support button (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = '❓ Поддержка';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Поддержка'),
        expect.any(Object)
      );
    });
  });

  describe('Channel navigation', () => {
    it('should handle Channel button (English)', async () => {
      mockContext.message!.text = '📢 Channel';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Official Channel'),
        expect.any(Object)
      );
    });

    it('should handle Channel button (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = '📢 Канал';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Официальный канал'),
        expect.any(Object)
      );
    });
  });

  describe('User Chat navigation', () => {
    it('should handle User Chat button (English)', async () => {
      mockContext.message!.text = '💭 User Chat';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('User Chat'),
        expect.any(Object)
      );
    });

    it('should handle User Chat button (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = '💭 Чат с поддержкой';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Чат с поддержкой'),
        expect.any(Object)
      );
    });
  });

  describe('Back to Menu navigation', () => {
    it('should handle Back to Menu button (English)', async () => {
      mockContext.message!.text = '⬅️ Back to Menu';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Back to main menu'),
        expect.objectContaining({
          reply_markup: expect.anything(),
        })
      );
    });

    it('should handle Back to Menu button (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = '⬅️ Назад в меню';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Назад в главное меню'),
        expect.objectContaining({
          reply_markup: expect.anything(),
        })
      );
    });
  });

  describe('Unknown message handling', () => {
    it('should handle unknown messages (English)', async () => {
      mockContext.message!.text = 'Random text';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining("didn't understand"),
        expect.objectContaining({
          reply_markup: expect.anything(),
        })
      );
    });

    it('should handle unknown messages (Russian)', async () => {
      mockContext.i18n = new I18n('ru');
      mockContext.message!.text = 'Случайный текст';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('не понял'),
        expect.objectContaining({
          reply_markup: expect.anything(),
        })
      );
    });
  });

  describe('Case insensitivity', () => {
    it('should handle buttons case-insensitively', async () => {
      mockContext.message!.text = '🎨 PRODUCT CARD';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Product Card Generation'),
        expect.any(Object)
      );
    });

    it('should handle buttons with extra whitespace', async () => {
      mockContext.message!.text = '  🎨 Product Card  ';
      await handleTextMessage(mockContext as BotContext);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Product Card Generation'),
        expect.any(Object)
      );
    });
  });

  describe('Localization consistency', () => {
    it('should use consistent language throughout navigation', async () => {
      const i18n = new I18n('ru');
      mockContext.i18n = i18n;
      mockContext.message!.text = '🎨 Карточка товара';
      
      await handleTextMessage(mockContext as BotContext);

      // Should reply in Russian
      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Генерация'),
        expect.any(Object)
      );
    });

    it('should maintain language preference across multiple actions', async () => {
      const i18n = new I18n('ru');
      mockContext.i18n = i18n;

      // Action 1: View product card
      mockContext.message!.text = '🎨 Карточка товара';
      await handleTextMessage(mockContext as BotContext);
      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('токенов'),
        expect.any(Object)
      );

      // Action 2: View profile
      mockReply.mockClear();
      mockContext.message!.text = '👤 Мой профиль';
      await handleTextMessage(mockContext as BotContext);
      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('Ваш профиль'),
        expect.any(Object)
      );
    });
  });
});
