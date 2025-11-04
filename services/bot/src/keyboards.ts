import { Keyboard } from 'grammy';

/**
 * Main navigation keyboard buttons
 */
export const MainMenuButtons = {
  GENERATE_IMAGE: '🎨 Generate Image',
  CHAT_GPT: '💬 Chat with GPT',
  MY_PROFILE: '👤 My Profile',
  SUBSCRIPTION: '💎 Subscription',
  HELP: '❓ Help',
} as const;

/**
 * Build main menu keyboard with navigation buttons
 */
export function buildMainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text(MainMenuButtons.GENERATE_IMAGE)
    .text(MainMenuButtons.CHAT_GPT)
    .row()
    .text(MainMenuButtons.MY_PROFILE)
    .text(MainMenuButtons.SUBSCRIPTION)
    .row()
    .text(MainMenuButtons.HELP)
    .resized()
    .persistent();
}

/**
 * Build back keyboard for returning to main menu
 */
export function buildBackKeyboard(): Keyboard {
  return new Keyboard().text('⬅️ Back to Menu').resized().persistent();
}

/**
 * Build subscription tier selection keyboard
 */
export function buildSubscriptionKeyboard(): Keyboard {
  return new Keyboard()
    .text('💎 Professional - 2000 tokens')
    .row()
    .text('🏢 Business - 10000 tokens')
    .row()
    .text('⬅️ Back to Menu')
    .resized()
    .persistent();
}

/**
 * Build cancel keyboard for canceling current operation
 */
export function buildCancelKeyboard(): Keyboard {
  return new Keyboard().text('❌ Cancel').resized().persistent();
}
