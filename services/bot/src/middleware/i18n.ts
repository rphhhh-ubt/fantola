import { BotContext } from '../types';
import { I18n, detectLanguage, Language } from '../i18n';

/**
 * I18n middleware
 * Initializes i18n instance for each request based on user's language preference
 */
export async function i18nMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  // Get language from session or detect from Telegram
  let language: Language = ctx.session.language || 'en';

  if (!ctx.session.language) {
    // Detect language from Telegram user's language_code
    const telegramLanguage = ctx.from?.language_code;
    language = detectLanguage(telegramLanguage);

    // Save detected language to session for future requests
    ctx.session.language = language;
  }

  // Initialize i18n instance
  ctx.i18n = new I18n(language);

  await next();
}
