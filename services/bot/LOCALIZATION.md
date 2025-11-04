# Bot Localization System

This document describes the localization (i18n) system implemented for the Telegram bot.

## Overview

The bot supports multiple languages (currently English and Russian) with automatic language detection based on the user's Telegram settings. The language preference is stored in the user's session and persists across conversations.

## Supported Languages

- **English (en)** - Default language
- **Russian (ru)**

## Architecture

### Core Components

1. **I18n Class** (`src/i18n/index.ts`)
   - Main interface for accessing translated messages
   - Supports variable interpolation
   - Type-safe message access

2. **Message Files**
   - `src/i18n/messages/en.ts` - English translations
   - `src/i18n/messages/ru.ts` - Russian translations

3. **I18n Middleware** (`src/middleware/i18n.ts`)
   - Automatically detects user language from Telegram
   - Initializes i18n instance in context
   - Saves language preference to session

4. **Session Storage**
   - Language preference stored in `SessionData.language`
   - Persists across bot restarts (stored in Redis)

## Message Structure

Messages are organized into four main categories:

### Buttons
All navigation button labels:
- Product Card
- Sora Image
- ChatGPT
- My Profile
- Buy Subscription
- Support
- Channel
- User Chat
- Back to Menu
- Cancel

### Commands
Messages for bot commands:
- `/start` - Welcome and onboarding messages
- `/help` - Help text and feature descriptions
- `/profile` - Profile information display
- `/subscription` - Subscription plans and pricing

### Features
Detailed descriptions for each feature:
- Product Card generation
- Sora Image generation
- ChatGPT conversations
- Support information
- Channel benefits
- User chat

### Common
Reusable messages across the bot:
- Error messages
- Loading states
- Success messages
- Token insufficiency warnings
- Rate limit messages

## Usage Examples

### In Command Handlers

```typescript
export async function handleHelp(ctx: CommandContext<BotContext>): Promise<void> {
  const i18n = ctx.i18n;

  const helpMessage = [
    i18n.commands.help.title,
    '',
    ...i18n.commands.help.commands,
    i18n.commands.help.features,
  ].join('\n');

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}
```

### With Variable Interpolation

```typescript
const message = i18n.t('commands.start.newUser', { tokens: 100 });
// Result (EN): "As a new user, you received 100 free tokens!"
// Result (RU): "Как новый пользователь, вы получили 100 бесплатных токенов!"
```

### Building Localized Keyboards

```typescript
const keyboard = buildMainMenuKeyboard(ctx.i18n);
// Keyboard buttons will be in the user's preferred language
```

### Accessing Message Properties

```typescript
// Direct property access
const title = i18n.commands.help.title;

// Using t() method with key path
const title = i18n.t('commands.help.title');

// Get button labels
const buttons = i18n.buttons;
```

## Adding a New Language

To add support for a new language:

1. Create a new message file: `src/i18n/messages/[lang].ts`

```typescript
import { Messages } from './en';

export const fr: Messages = {
  buttons: {
    productCard: '🎨 Carte de Produit',
    // ... translate all buttons
  },
  commands: {
    // ... translate all commands
  },
  features: {
    // ... translate all features
  },
  common: {
    // ... translate all common messages
  },
};
```

2. Update `src/i18n/index.ts`:

```typescript
import { fr } from './messages/fr';

export type Language = 'en' | 'ru' | 'fr';

const messages: Record<Language, Messages> = {
  en,
  ru,
  fr,
};

export function detectLanguage(telegramLanguageCode?: string): Language {
  if (!telegramLanguageCode) return 'en';
  
  const baseCode = telegramLanguageCode.split('-')[0].toLowerCase();
  
  if (baseCode === 'ru') return 'ru';
  if (baseCode === 'fr') return 'fr';
  
  return 'en';
}
```

3. Run tests to ensure consistency:

```bash
pnpm --filter bot test
```

## Language Detection

The system automatically detects the user's language based on:

1. **Session Preference** (highest priority)
   - If user has a saved language preference in their session

2. **Telegram Language Code** (fallback)
   - Extracted from `ctx.from?.language_code`
   - Maps to supported languages (e.g., 'en-US' → 'en')

3. **Default Language** (last resort)
   - Falls back to English if detection fails

## Session Persistence

Language preferences are stored in Redis sessions:

```typescript
interface SessionData {
  userId?: string;
  telegramId?: number;
  username?: string;
  language?: Language;  // Persisted language preference
  state?: string;
  conversationContext?: {...};
}
```

Sessions expire after 1 hour of inactivity but can be configured.

## Testing

Comprehensive tests are available:

- **Unit Tests**: `src/__tests__/i18n.test.ts`
  - Language detection
  - Message interpolation
  - I18n class methods

- **Integration Tests**: `src/__tests__/menu-persistence.test.ts`
  - Session persistence
  - Language preference across sessions
  - Menu state tracking

- **Navigation Tests**: `src/__tests__/navigation.test.ts`
  - Button handlers in different languages
  - Localization consistency

Run all tests:

```bash
pnpm --filter bot test
```

Run specific test suite:

```bash
pnpm --filter bot test i18n
```

## Best Practices

1. **Always use i18n** - Never hardcode user-facing text
2. **Consistent structure** - Maintain same message structure across languages
3. **Preserve emojis** - Keep emojis consistent across translations
4. **Test translations** - Run tests to verify message structure consistency
5. **Variable naming** - Use clear variable names in interpolation: `{tokens}`, `{date}`, `{count}`
6. **Context awareness** - Access i18n from `ctx.i18n` in all handlers
7. **Default language** - Always provide English as fallback

## Type Safety

The system is fully type-safe:

```typescript
// TypeScript will autocomplete and validate message keys
const message = i18n.commands.help.title;  // ✓ Type-safe
const invalid = i18n.commands.invalid;     // ✗ Type error
```

All languages must implement the `Messages` interface from `en.ts` to ensure consistency.

## Middleware Order

The i18n middleware must be placed in the correct position:

```typescript
// 1. Session middleware (must be first)
bot.use(session({...}));

// 2. Logging middleware
bot.use(loggingMiddleware(monitoring));

// 3. I18n middleware (after session, before auth)
bot.use(i18nMiddleware);

// 4. Auth middleware
bot.use(authMiddleware());
```

This order ensures:
- Session data is available for language preference
- i18n is initialized before handlers need it
- All subsequent middleware has access to i18n

## Migration Notes

When migrating from hardcoded messages:

1. Identify all user-facing text
2. Move to appropriate message category
3. Replace with i18n calls
4. Add tests for new messages
5. Verify all languages have translations

Example migration:

```typescript
// Before
await ctx.reply('Welcome to AI Bot!');

// After
await ctx.reply(i18n.commands.start.welcome);
```

## Performance Considerations

- Messages are loaded once at startup
- I18n instance is created per request (lightweight)
- Language detection cached in session
- No database queries for translations
- Minimal memory footprint

## Future Enhancements

Potential improvements:

- [ ] Dynamic language switching command (`/language`)
- [ ] Admin panel for translation management
- [ ] Crowdsourced translations
- [ ] Pluralization support
- [ ] Number/date formatting per locale
- [ ] Translation completion tracking
- [ ] More languages (Spanish, German, French, etc.)
