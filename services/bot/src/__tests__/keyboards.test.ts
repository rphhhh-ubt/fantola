import {
  buildMainMenuKeyboard,
  buildBackKeyboard,
  buildSubscriptionKeyboard,
  buildCancelKeyboard,
  MainMenuButtons,
} from '../keyboards';

describe('Keyboards', () => {
  describe('MainMenuButtons', () => {
    it('should have all button labels defined', () => {
      expect(MainMenuButtons.GENERATE_IMAGE).toBe('🎨 Generate Image');
      expect(MainMenuButtons.CHAT_GPT).toBe('💬 Chat with GPT');
      expect(MainMenuButtons.MY_PROFILE).toBe('👤 My Profile');
      expect(MainMenuButtons.SUBSCRIPTION).toBe('💎 Subscription');
      expect(MainMenuButtons.HELP).toBe('❓ Help');
    });
  });

  describe('buildMainMenuKeyboard', () => {
    it('should build main menu keyboard', () => {
      const keyboard = buildMainMenuKeyboard();

      expect(keyboard).toBeDefined();
      // Keyboard is built with Grammy's builder pattern
      // We just verify it's created without errors
    });
  });

  describe('buildBackKeyboard', () => {
    it('should build back keyboard', () => {
      const keyboard = buildBackKeyboard();

      expect(keyboard).toBeDefined();
    });
  });

  describe('buildSubscriptionKeyboard', () => {
    it('should build subscription keyboard', () => {
      const keyboard = buildSubscriptionKeyboard();

      expect(keyboard).toBeDefined();
    });
  });

  describe('buildCancelKeyboard', () => {
    it('should build cancel keyboard', () => {
      const keyboard = buildCancelKeyboard();

      expect(keyboard).toBeDefined();
    });
  });
});
