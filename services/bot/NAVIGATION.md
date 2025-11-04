# Bot Navigation System

This document describes the navigation menu system and user flow in the Telegram bot.

## Overview

The bot features a persistent reply keyboard with 8 main menu options, providing easy access to all features. All menus are localized and support both English and Russian languages.

## Main Menu Structure

### Row 1: AI Generation Features
- **🎨 Product Card** - Generate professional product images with DALL-E
- **🎬 Sora Image** - Create cinematic images with Sora AI

### Row 2: Interaction Features  
- **💬 ChatGPT** - Have natural conversations with GPT-4
- **👤 My Profile** - View profile, token balance, and statistics

### Row 3: Account Management
- **💎 Buy Subscription** - View and upgrade subscription plans
- **❓ Support** - Get help and contact support team

### Row 4: Community & Communication
- **📢 Channel** - Join official channel for updates
- **💭 User Chat** - Chat with support team

## Navigation Flow

```
Main Menu (8 buttons)
├── Product Card → Feature info + "Coming Soon"
├── Sora Image → Feature info + "Coming Soon"
├── ChatGPT → Feature info + "Coming Soon"
├── My Profile → Profile summary
├── Buy Subscription → Subscription plans → Back
├── Support → Contact options
├── Channel → Channel benefits
└── User Chat → Support chat + "Coming Soon"
```

## Menu Features

### Persistent Keyboard
- Always visible at bottom of chat
- Survives bot restarts
- Stored in session state
- Responsive button layout

### Localized Buttons
All buttons adapt to user's language:

**English:**
- 🎨 Product Card
- 🎬 Sora Image
- 💬 ChatGPT
- 👤 My Profile
- 💎 Buy Subscription
- ❓ Support
- 📢 Channel
- 💭 User Chat

**Russian:**
- 🎨 Карточка товара
- 🎬 Sora изображение
- 💬 ChatGPT
- 👤 Мой профиль
- 💎 Купить подписку
- ❓ Поддержка
- 📢 Канал
- 💭 Чат с поддержкой

### Case-Insensitive Matching
Button handlers are case-insensitive and whitespace-tolerant:

```typescript
// All these work:
"🎨 Product Card"
"🎨 product card"
"  🎨 Product Card  "
```

## Button Handlers

### Product Card (🎨)
**Purpose:** Generate professional product images for e-commerce

**Features:**
- DALL-E 3 powered generation
- High quality 1024x1024 images
- Natural language descriptions
- Perfect for e-commerce

**Cost:** 10 tokens per image

**Status:** Coming soon

**Handler:** `handleProductCard()` in `src/handlers/text.ts`

### Sora Image (🎬)
**Purpose:** Create cinematic quality images with Sora AI

**Features:**
- Cinematic quality output
- Video-to-image conversion
- Unique artistic style

**Cost:** 10 tokens per image

**Status:** Coming soon

**Handler:** `handleSoraImage()` in `src/handlers/text.ts`

### ChatGPT (💬)
**Purpose:** Natural conversations with GPT-4

**Features:**
- Context-aware responses
- Multiple conversation threads
- Smart and helpful assistant

**Cost:** 5 tokens per message

**Status:** Coming soon

**Handler:** `handleChatGPT()` in `src/handlers/text.ts`

### My Profile (👤)
**Purpose:** View user account information

**Shows:**
- Name and username
- Current subscription tier
- Token balance (available/spent)
- Account statistics

**Cost:** Free

**Status:** Active

**Handler:** `handleMyProfile()` in `src/handlers/text.ts`

### Buy Subscription (💎)
**Purpose:** View and upgrade subscription plans

**Shows:**
- Current plan
- Available tiers (Gift, Professional, Business)
- Token allocations
- Pricing
- Rate limits

**Cost:** Free to view

**Status:** Active (payment flow coming soon)

**Handler:** `handleSubscriptionButton()` in `src/handlers/text.ts`

### Support (❓)
**Purpose:** Get help and contact support

**Provides:**
- Email contact: support@aibot.example
- Telegram support bot: @support_bot
- Documentation link
- Help prompt

**Cost:** Free

**Status:** Active

**Handler:** `handleSupport()` in `src/handlers/text.ts`

### Channel (📢)
**Purpose:** Join official channel for updates

**Benefits:**
- Free Gift tier tokens
- Latest features and updates
- Exclusive promotions
- Tips and tricks

**Action:** Subscribe to channel

**Cost:** Free

**Status:** Active

**Handler:** `handleChannel()` in `src/handlers/text.ts`

### User Chat (💭)
**Purpose:** Direct chat with support team

**Features:**
- Real-time support
- Issue reporting
- Question answering

**Cost:** Free

**Status:** Coming soon

**Handler:** `handleUserChat()` in `src/handlers/text.ts`

## Back Navigation

A "Back to Menu" button (⬅️) is available in sub-menus to return to the main menu:

```typescript
buildBackKeyboard(i18n)
```

**Handler:** `handleBackToMenu()` in `src/handlers/text.ts`

## Unknown Input Handling

If user sends text that doesn't match any button:

**English:** "❓ I didn't understand that. Please use the menu buttons below."

**Russian:** "❓ Я не понял. Пожалуйста, используйте кнопки меню ниже."

The main menu is shown again for easy recovery.

## Session Persistence

### State Tracking
The navigation state is persisted in Redis sessions:

```typescript
interface SessionData {
  userId?: string;
  telegramId?: number;
  username?: string;
  language?: Language;
  state?: string;  // Current menu/screen
  conversationContext?: {
    lastCommand?: string;
    lastPrompt?: string;
    messageCount?: number;
  };
}
```

### Benefits
- Survives bot restarts
- Maintains context across conversations
- Enables conversation history
- Supports multi-step workflows

### TTL
Sessions expire after 1 hour of inactivity (configurable in `src/bot.ts`).

## Keyboard Building

### Main Menu
```typescript
const keyboard = buildMainMenuKeyboard(i18n);
// Returns 4x2 grid of persistent buttons
```

### Back Button
```typescript
const keyboard = buildBackKeyboard(i18n);
// Returns single back button
```

### Subscription Selection
```typescript
const keyboard = buildSubscriptionKeyboard(i18n);
// Returns subscription tier options + back button
```

### Cancel Operation
```typescript
const keyboard = buildCancelKeyboard(i18n);
// Returns single cancel button
```

## Adding New Navigation Options

To add a new menu button:

1. **Add to message files** (`src/i18n/messages/en.ts` and `ru.ts`):

```typescript
buttons: {
  // ... existing buttons
  newFeature: '✨ New Feature',
}

features: {
  newFeature: {
    title: '✨ *New Feature*',
    description: 'Description of the feature',
    features: ['• Feature 1', '• Feature 2'],
    cost: '\n💰 Cost: *X tokens*',
    comingSoon: '\n🚧 This feature is coming soon!',
  },
}
```

2. **Update keyboard builder** (`src/keyboards.ts`):

```typescript
export function buildMainMenuKeyboard(i18n: I18n): Keyboard {
  const { buttons } = i18n;
  
  return new Keyboard()
    .text(buttons.productCard)
    .text(buttons.soraImage)
    .row()
    .text(buttons.chatGpt)
    .text(buttons.myProfile)
    .row()
    .text(buttons.subscription)
    .text(buttons.support)
    .row()
    .text(buttons.channel)
    .text(buttons.newFeature)  // Add here
    .resized()
    .persistent();
}
```

3. **Create handler** (`src/handlers/text.ts`):

```typescript
async function handleNewFeature(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  const feature = i18n.features.newFeature;

  const message = [
    feature.title,
    '',
    feature.description,
    '',
    ...feature.features,
    feature.cost,
    feature.comingSoon,
  ].join('\n');

  await ctx.reply(message, { parse_mode: 'Markdown' });
}
```

4. **Register in text handler**:

```typescript
export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  const i18n = ctx.i18n;
  const buttons = getButtonLabels(i18n);

  if (!text) return;

  if (isButtonMatch(text, buttons.newFeature)) {
    await handleNewFeature(ctx);
  } else if (...) {
    // ... other handlers
  }
}
```

5. **Add tests** (`src/__tests__/navigation.test.ts`):

```typescript
describe('New Feature navigation', () => {
  it('should handle New Feature button (English)', async () => {
    mockContext.message!.text = '✨ New Feature';
    await handleTextMessage(mockContext as BotContext);

    expect(mockReply).toHaveBeenCalledWith(
      expect.stringContaining('New Feature'),
      expect.any(Object)
    );
  });
});
```

## Testing Navigation

### Run All Tests
```bash
pnpm --filter bot test
```

### Run Navigation Tests Only
```bash
pnpm --filter bot test navigation
```

### Run Menu Persistence Tests
```bash
pnpm --filter bot test menu-persistence
```

### Test Coverage
- Button matching (case-insensitive)
- Localization (EN/RU)
- Session persistence
- State tracking
- Unknown input handling
- Profile loading errors
- Multiple languages

## Performance Considerations

### Keyboard Caching
Keyboards are built on-demand but are lightweight:
- No database queries
- Fast string operations
- Minimal memory usage

### Session Storage
- Stored in Redis (fast in-memory access)
- TTL-based expiration (automatic cleanup)
- Efficient serialization (JSON)

### Button Matching
- Simple string comparison
- Case-insensitive with trim
- O(1) lookup via if/else chain

## User Experience

### Design Principles
1. **Consistency** - Same layout across sessions
2. **Clarity** - Clear button labels with emojis
3. **Accessibility** - Works on all Telegram clients
4. **Responsiveness** - Instant feedback on button press
5. **Error Recovery** - Easy return to main menu
6. **Localization** - Native language support

### Best Practices
- Keep menu shallow (max 2-3 levels)
- Provide back navigation
- Show clear status messages
- Use consistent emoji indicators
- Maintain button order
- Test on mobile devices

## Troubleshooting

### Keyboard Not Showing
- Check bot.ts middleware order
- Verify session adapter is working
- Ensure i18n middleware is registered
- Check Redis connection

### Wrong Language
- Verify user's Telegram language_code
- Check session.language value
- Test language detection logic
- Clear session and retry

### Button Not Working
- Check handler registration
- Verify button label matches
- Test case-insensitive matching
- Check i18n message structure

### State Not Persisting
- Verify Redis is running
- Check session TTL setting
- Test session adapter
- Verify session write calls

## Future Enhancements

Potential improvements:

- [ ] Inline keyboards for some actions
- [ ] Deep linking support
- [ ] Breadcrumb navigation
- [ ] Recently used features
- [ ] Customizable menu layouts
- [ ] Favorites/shortcuts
- [ ] Menu analytics
- [ ] A/B testing support
- [ ] Voice command navigation
- [ ] Gesture-based navigation (web app)
