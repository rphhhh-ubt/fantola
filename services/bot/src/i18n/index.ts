import { en, Messages } from './messages/en';
import { ru } from './messages/ru';

export type Language = 'en' | 'ru';

const messages: Record<Language, Messages> = {
  en,
  ru,
};

/**
 * Get messages for a specific language
 */
export function getMessages(language: Language = 'ru'): Messages {
  return messages[language] || messages.ru;
}

/**
 * Detect language from Telegram language code
 * Maps Telegram language codes to supported languages
 */
export function detectLanguage(telegramLanguageCode?: string): Language {
  if (!telegramLanguageCode) {
    return 'ru';
  }

  // Extract base language code (e.g., 'en' from 'en-US')
  const baseCode = telegramLanguageCode.split('-')[0].toLowerCase();

  // Map to supported languages
  if (baseCode === 'ru') {
    return 'ru';
  }

  // Default to Russian
  return 'ru';
}

/**
 * Interpolate variables in message strings
 * Example: t('Hello {name}!', { name: 'John' }) => 'Hello John!'
 */
export function interpolate(message: string, params?: Record<string, string | number>): string {
  if (!params) {
    return message;
  }

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }, message);
}

/**
 * Helper class for working with translations in a specific language
 */
export class I18n {
  private messages: Messages;
  public language: Language;

  constructor(language: Language = 'ru') {
    this.language = language;
    this.messages = getMessages(language);
  }

  /**
   * Get a message by key path
   * Example: t('commands.start.welcome')
   */
  t(keyPath: string, params?: Record<string, string | number>): string {
    const keys = keyPath.split('.');
    let value: any = this.messages;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) {
        return keyPath; // Return key path if translation not found
      }
    }

    if (typeof value === 'string') {
      return interpolate(value, params);
    }

    if (Array.isArray(value)) {
      return value.join('\n');
    }

    return String(value);
  }

  /**
   * Get button labels
   */
  get buttons() {
    return this.messages.buttons;
  }

  /**
   * Get command messages
   */
  get commands() {
    return this.messages.commands;
  }

  /**
   * Get feature messages
   */
  get features() {
    return this.messages.features;
  }

  /**
   * Get common messages
   */
  get common() {
    return this.messages.common;
  }

  /**
   * Get channel verification messages
   */
  get channelVerification() {
    return this.messages.channelVerification;
  }

  /**
   * Switch to a different language
   */
  setLanguage(language: Language): void {
    this.language = language;
    this.messages = getMessages(language);
  }
}

// Export message types
export type { Messages };
export { en, ru };
