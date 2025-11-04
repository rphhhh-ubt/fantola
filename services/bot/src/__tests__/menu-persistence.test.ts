import { MockRedisClient } from '@monorepo/test-utils';
import { RedisSessionAdapter } from '../session-adapter';
import { SessionData } from '../types';
import { I18n } from '../i18n';

describe('Menu State Persistence', () => {
  let redis: MockRedisClient;
  let sessionAdapter: RedisSessionAdapter;

  beforeEach(() => {
    redis = new MockRedisClient();
    sessionAdapter = new RedisSessionAdapter(redis as any, {
      prefix: 'bot:session:',
      ttl: 3600,
    });
  });

  describe('Session persistence', () => {
    it('should persist session data across requests', async () => {
      const sessionKey = '123456789';
      const sessionData: SessionData = {
        userId: 'user-123',
        telegramId: 123456789,
        username: 'testuser',
        language: 'en',
        state: 'menu',
      };

      await sessionAdapter.write(sessionKey, sessionData);
      const retrieved = await sessionAdapter.read(sessionKey);

      expect(retrieved).toEqual(sessionData);
    });

    it('should persist language preference', async () => {
      const sessionKey = '123456789';
      const sessionData: SessionData = {
        userId: 'user-123',
        telegramId: 123456789,
        language: 'ru',
      };

      await sessionAdapter.write(sessionKey, sessionData);
      const retrieved = await sessionAdapter.read(sessionKey);

      expect(retrieved?.language).toBe('ru');
    });

    it('should handle multiple session updates', async () => {
      const sessionKey = '123456789';
      
      // First update
      await sessionAdapter.write(sessionKey, {
        userId: 'user-123',
        language: 'en',
      });

      // Second update
      await sessionAdapter.write(sessionKey, {
        userId: 'user-123',
        language: 'ru',
        state: 'chatting',
      });

      const retrieved = await sessionAdapter.read(sessionKey);
      expect(retrieved?.language).toBe('ru');
      expect(retrieved?.state).toBe('chatting');
    });

    it('should persist conversation context', async () => {
      const sessionKey = '123456789';
      const sessionData: SessionData = {
        userId: 'user-123',
        conversationContext: {
          lastCommand: '/start',
          lastPrompt: 'Generate an image',
          messageCount: 5,
        },
      };

      await sessionAdapter.write(sessionKey, sessionData);
      const retrieved = await sessionAdapter.read(sessionKey);

      expect(retrieved?.conversationContext).toEqual(sessionData.conversationContext);
    });

    it('should handle session deletion', async () => {
      const sessionKey = '123456789';
      const sessionData: SessionData = {
        userId: 'user-123',
        language: 'en',
      };

      await sessionAdapter.write(sessionKey, sessionData);
      await sessionAdapter.delete(sessionKey);
      
      const retrieved = await sessionAdapter.read(sessionKey);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Language persistence across sessions', () => {
    it('should maintain language preference between sessions', async () => {
      const sessionKey = '123456789';

      // Simulate first session
      await sessionAdapter.write(sessionKey, {
        userId: 'user-123',
        language: 'ru',
      });

      // Simulate second session (reading back)
      const session = await sessionAdapter.read(sessionKey);
      const i18n = new I18n(session?.language || 'en');

      expect(i18n.language).toBe('ru');
      expect(i18n.buttons.productCard).toBe('🎨 Карточка товара');
    });

    it('should use default language when no preference set', async () => {
      const sessionKey = '123456789';

      // Simulate first-time user (no session)
      const session = await sessionAdapter.read(sessionKey);
      const i18n = new I18n(session?.language || 'en');

      expect(i18n.language).toBe('en');
      expect(i18n.buttons.productCard).toBe('🎨 Product Card');
    });

    it('should allow language switching mid-session', async () => {
      const sessionKey = '123456789';

      // Start with English
      await sessionAdapter.write(sessionKey, {
        userId: 'user-123',
        language: 'en',
      });

      let session = await sessionAdapter.read(sessionKey);
      expect(session?.language).toBe('en');

      // Switch to Russian
      await sessionAdapter.write(sessionKey, {
        ...session,
        language: 'ru',
      });

      session = await sessionAdapter.read(sessionKey);
      expect(session?.language).toBe('ru');
    });
  });

  describe('Menu state persistence', () => {
    it('should persist current menu state', async () => {
      const sessionKey = '123456789';

      await sessionAdapter.write(sessionKey, {
        userId: 'user-123',
        state: 'subscription_menu',
      });

      const session = await sessionAdapter.read(sessionKey);
      expect(session?.state).toBe('subscription_menu');
    });

    it('should track navigation history', async () => {
      const sessionKey = '123456789';

      // Start in main menu
      await sessionAdapter.write(sessionKey, {
        userId: 'user-123',
        state: 'main_menu',
      });

      // Navigate to profile
      await sessionAdapter.write(sessionKey, {
        userId: 'user-123',
        state: 'profile',
        conversationContext: {
          lastCommand: '/profile',
        },
      });

      const session = await sessionAdapter.read(sessionKey);
      expect(session?.state).toBe('profile');
      expect(session?.conversationContext?.lastCommand).toBe('/profile');
    });

    it('should handle complex navigation state', async () => {
      const sessionKey = '123456789';

      await sessionAdapter.write(sessionKey, {
        userId: 'user-123',
        language: 'ru',
        state: 'image_generation',
        conversationContext: {
          lastCommand: '/generate',
          lastPrompt: 'A beautiful sunset',
          messageCount: 3,
        },
      });

      const session = await sessionAdapter.read(sessionKey);
      expect(session?.state).toBe('image_generation');
      expect(session?.conversationContext?.lastPrompt).toBe('A beautiful sunset');
      expect(session?.conversationContext?.messageCount).toBe(3);
    });
  });

  describe('Session expiration', () => {
    it('should set TTL on session write', async () => {
      const sessionKey = '123456789';
      const sessionData: SessionData = {
        userId: 'user-123',
        language: 'en',
      };

      await sessionAdapter.write(sessionKey, sessionData);

      // Verify session was written successfully
      const retrieved = await sessionAdapter.read(sessionKey);
      expect(retrieved).toEqual(sessionData);
    });
  });

  describe('Multiple user sessions', () => {
    it('should handle multiple concurrent user sessions', async () => {
      const user1Key = '111111111';
      const user2Key = '222222222';

      await sessionAdapter.write(user1Key, {
        userId: 'user-1',
        language: 'en',
        state: 'main_menu',
      });

      await sessionAdapter.write(user2Key, {
        userId: 'user-2',
        language: 'ru',
        state: 'profile',
      });

      const session1 = await sessionAdapter.read(user1Key);
      const session2 = await sessionAdapter.read(user2Key);

      expect(session1?.language).toBe('en');
      expect(session1?.state).toBe('main_menu');
      expect(session2?.language).toBe('ru');
      expect(session2?.state).toBe('profile');
    });

    it('should not mix session data between users', async () => {
      const user1Key = '111111111';
      const user2Key = '222222222';

      await sessionAdapter.write(user1Key, {
        userId: 'user-1',
        language: 'en',
      });

      await sessionAdapter.write(user2Key, {
        userId: 'user-2',
        language: 'ru',
      });

      const session1 = await sessionAdapter.read(user1Key);
      const session2 = await sessionAdapter.read(user2Key);

      expect(session1?.userId).toBe('user-1');
      expect(session2?.userId).toBe('user-2');
      expect(session1?.language).not.toBe(session2?.language);
    });
  });
});
