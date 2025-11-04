import { I18n, detectLanguage, interpolate, getMessages } from '../i18n';

describe('I18n', () => {
  describe('detectLanguage', () => {
    it('should detect Russian language', () => {
      expect(detectLanguage('ru')).toBe('ru');
      expect(detectLanguage('ru-RU')).toBe('ru');
    });

    it('should detect English language', () => {
      expect(detectLanguage('en')).toBe('en');
      expect(detectLanguage('en-US')).toBe('en');
      expect(detectLanguage('en-GB')).toBe('en');
    });

    it('should default to English for unsupported languages', () => {
      expect(detectLanguage('fr')).toBe('en');
      expect(detectLanguage('de')).toBe('en');
      expect(detectLanguage('es')).toBe('en');
    });

    it('should default to English for undefined', () => {
      expect(detectLanguage(undefined)).toBe('en');
    });
  });

  describe('interpolate', () => {
    it('should interpolate single variable', () => {
      const result = interpolate('Hello {name}!', { name: 'John' });
      expect(result).toBe('Hello John!');
    });

    it('should interpolate multiple variables', () => {
      const result = interpolate('You have {count} {items}', { 
        count: 5, 
        items: 'tokens' 
      });
      expect(result).toBe('You have 5 tokens');
    });

    it('should interpolate same variable multiple times', () => {
      const result = interpolate('{name} says {name} is great', { name: 'AI' });
      expect(result).toBe('AI says AI is great');
    });

    it('should handle no params', () => {
      const result = interpolate('Hello world');
      expect(result).toBe('Hello world');
    });

    it('should handle empty params', () => {
      const result = interpolate('Hello {name}', {});
      expect(result).toBe('Hello {name}');
    });
  });

  describe('getMessages', () => {
    it('should return English messages by default', () => {
      const messages = getMessages();
      expect(messages.buttons.productCard).toBe('🎨 Product Card');
    });

    it('should return English messages explicitly', () => {
      const messages = getMessages('en');
      expect(messages.buttons.productCard).toBe('🎨 Product Card');
    });

    it('should return Russian messages', () => {
      const messages = getMessages('ru');
      expect(messages.buttons.productCard).toBe('🎨 Карточка товара');
    });
  });

  describe('I18n class', () => {
    describe('constructor', () => {
      it('should initialize with English by default', () => {
        const i18n = new I18n();
        expect(i18n.language).toBe('en');
      });

      it('should initialize with specified language', () => {
        const i18n = new I18n('ru');
        expect(i18n.language).toBe('ru');
      });
    });

    describe('t() method', () => {
      it('should translate simple key path', () => {
        const i18n = new I18n('en');
        const result = i18n.t('common.loading');
        expect(result).toBe('⏳ Processing...');
      });

      it('should translate nested key path', () => {
        const i18n = new I18n('en');
        const result = i18n.t('commands.help.title');
        expect(result).toBe('📚 *Available Commands*');
      });

      it('should interpolate variables', () => {
        const i18n = new I18n('en');
        const result = i18n.t('commands.start.newUser', { tokens: 100 });
        expect(result).toContain('100');
      });

      it('should handle arrays', () => {
        const i18n = new I18n('en');
        const result = i18n.t('commands.start.features');
        expect(result).toContain('DALL-E');
        expect(result).toContain('Sora');
      });

      it('should return key path for missing translation', () => {
        const i18n = new I18n('en');
        const result = i18n.t('missing.key.path');
        expect(result).toBe('missing.key.path');
      });

      it('should translate in Russian', () => {
        const i18n = new I18n('ru');
        const result = i18n.t('common.loading');
        expect(result).toBe('⏳ Обработка...');
      });
    });

    describe('buttons property', () => {
      it('should return button labels in English', () => {
        const i18n = new I18n('en');
        expect(i18n.buttons.productCard).toBe('🎨 Product Card');
        expect(i18n.buttons.chatGpt).toBe('💬 ChatGPT');
      });

      it('should return button labels in Russian', () => {
        const i18n = new I18n('ru');
        expect(i18n.buttons.productCard).toBe('🎨 Карточка товара');
        expect(i18n.buttons.chatGpt).toBe('💬 ChatGPT');
      });
    });

    describe('commands property', () => {
      it('should return command messages', () => {
        const i18n = new I18n('en');
        expect(i18n.commands.help.title).toBeDefined();
        expect(i18n.commands.start.welcome).toBeDefined();
      });
    });

    describe('features property', () => {
      it('should return feature messages', () => {
        const i18n = new I18n('en');
        expect(i18n.features.productCard.title).toBeDefined();
        expect(i18n.features.chatGpt.description).toBeDefined();
      });
    });

    describe('common property', () => {
      it('should return common messages', () => {
        const i18n = new I18n('en');
        expect(i18n.common.error).toBeDefined();
        expect(i18n.common.success).toBeDefined();
      });
    });

    describe('setLanguage() method', () => {
      it('should switch language', () => {
        const i18n = new I18n('en');
        expect(i18n.buttons.productCard).toBe('🎨 Product Card');
        
        i18n.setLanguage('ru');
        expect(i18n.language).toBe('ru');
        expect(i18n.buttons.productCard).toBe('🎨 Карточка товара');
      });

      it('should work with method chaining', () => {
        const i18n = new I18n('en');
        i18n.setLanguage('ru');
        expect(i18n.t('common.success')).toBe('✅ Успешно!');
      });
    });
  });

  describe('Message consistency', () => {
    it('should have matching structure for all languages', () => {
      const enMessages = getMessages('en');
      const ruMessages = getMessages('ru');

      // Check buttons
      expect(Object.keys(enMessages.buttons)).toEqual(Object.keys(ruMessages.buttons));

      // Check commands structure
      expect(Object.keys(enMessages.commands)).toEqual(Object.keys(ruMessages.commands));

      // Check features structure
      expect(Object.keys(enMessages.features)).toEqual(Object.keys(ruMessages.features));

      // Check common messages
      expect(Object.keys(enMessages.common)).toEqual(Object.keys(ruMessages.common));
    });
  });
});
