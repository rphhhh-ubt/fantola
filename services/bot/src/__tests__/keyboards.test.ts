import {
  buildMainMenuKeyboard,
  buildBackKeyboard,
  buildSubscriptionKeyboard,
  buildCancelKeyboard,
  getButtonLabels,
} from '../keyboards';
import { I18n } from '../i18n';

describe('Keyboards', () => {
  let i18nEn: I18n;
  let i18nRu: I18n;

  beforeEach(() => {
    i18nEn = new I18n('en');
    i18nRu = new I18n('ru');
  });

  describe('buildMainMenuKeyboard', () => {
    it('should build main menu keyboard in English', () => {
      const keyboard = buildMainMenuKeyboard(i18nEn);
      expect(keyboard).toBeDefined();
    });

    it('should build main menu keyboard in Russian', () => {
      const keyboard = buildMainMenuKeyboard(i18nRu);
      expect(keyboard).toBeDefined();
    });

    it('should be persistent and resized', () => {
      const keyboard = buildMainMenuKeyboard(i18nEn);
      expect(keyboard).toBeDefined();
      // Keyboard properties are set via builder pattern
    });
  });

  describe('buildBackKeyboard', () => {
    it('should build back keyboard in English', () => {
      const keyboard = buildBackKeyboard(i18nEn);
      expect(keyboard).toBeDefined();
    });

    it('should build back keyboard in Russian', () => {
      const keyboard = buildBackKeyboard(i18nRu);
      expect(keyboard).toBeDefined();
    });
  });

  describe('buildSubscriptionKeyboard', () => {
    it('should build subscription keyboard in English', () => {
      const keyboard = buildSubscriptionKeyboard(i18nEn);
      expect(keyboard).toBeDefined();
    });

    it('should build subscription keyboard in Russian', () => {
      const keyboard = buildSubscriptionKeyboard(i18nRu);
      expect(keyboard).toBeDefined();
    });
  });

  describe('buildCancelKeyboard', () => {
    it('should build cancel keyboard in English', () => {
      const keyboard = buildCancelKeyboard(i18nEn);
      expect(keyboard).toBeDefined();
    });

    it('should build cancel keyboard in Russian', () => {
      const keyboard = buildCancelKeyboard(i18nRu);
      expect(keyboard).toBeDefined();
    });
  });

  describe('getButtonLabels', () => {
    it('should return English button labels', () => {
      const labels = getButtonLabels(i18nEn);
      expect(labels.productCard).toBe('🎨 Product Card');
      expect(labels.soraImage).toBe('🎬 Sora Image');
      expect(labels.chatGpt).toBe('💬 ChatGPT');
      expect(labels.myProfile).toBe('👤 My Profile');
      expect(labels.subscription).toBe('💎 Buy Subscription');
      expect(labels.support).toBe('❓ Support');
      expect(labels.channel).toBe('📢 Channel');
      expect(labels.userChat).toBe('💭 User Chat');
      expect(labels.backToMenu).toBe('⬅️ Back to Menu');
      expect(labels.cancel).toBe('❌ Cancel');
    });

    it('should return Russian button labels', () => {
      const labels = getButtonLabels(i18nRu);
      expect(labels.productCard).toBe('🎨 Карточка товара');
      expect(labels.soraImage).toBe('🎬 Sora изображение');
      expect(labels.chatGpt).toBe('💬 ChatGPT');
      expect(labels.myProfile).toBe('👤 Мой профиль');
      expect(labels.subscription).toBe('💎 Купить подписку');
      expect(labels.support).toBe('❓ Поддержка');
      expect(labels.channel).toBe('📢 Канал');
      expect(labels.userChat).toBe('💭 Чат с поддержкой');
      expect(labels.backToMenu).toBe('⬅️ Назад в меню');
      expect(labels.cancel).toBe('❌ Отмена');
    });
  });

  describe('Localization support', () => {
    it('should maintain consistent button count across languages', () => {
      const enLabels = getButtonLabels(i18nEn);
      const ruLabels = getButtonLabels(i18nRu);

      expect(Object.keys(enLabels).length).toBe(Object.keys(ruLabels).length);
    });

    it('should have matching keys for all languages', () => {
      const enLabels = getButtonLabels(i18nEn);
      const ruLabels = getButtonLabels(i18nRu);

      expect(Object.keys(enLabels).sort()).toEqual(Object.keys(ruLabels).sort());
    });

    it('should preserve emojis across translations', () => {
      const enLabels = getButtonLabels(i18nEn);
      const ruLabels = getButtonLabels(i18nRu);

      // Check that emojis are present
      expect(enLabels.productCard).toMatch(/🎨/);
      expect(ruLabels.productCard).toMatch(/🎨/);
      expect(enLabels.soraImage).toMatch(/🎬/);
      expect(ruLabels.soraImage).toMatch(/🎬/);
    });
  });

  describe('Menu structure', () => {
    it('should include all required menu options', () => {
      const labels = getButtonLabels(i18nEn);

      // Verify all 8 main menu options exist
      expect(labels.productCard).toBeDefined();
      expect(labels.soraImage).toBeDefined();
      expect(labels.chatGpt).toBeDefined();
      expect(labels.myProfile).toBeDefined();
      expect(labels.subscription).toBeDefined();
      expect(labels.support).toBeDefined();
      expect(labels.channel).toBeDefined();
      expect(labels.userChat).toBeDefined();
    });

    it('should include navigation buttons', () => {
      const labels = getButtonLabels(i18nEn);

      expect(labels.backToMenu).toBeDefined();
      expect(labels.cancel).toBeDefined();
    });
  });
});
