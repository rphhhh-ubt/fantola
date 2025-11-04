import { Keyboard } from 'grammy';
import { I18n } from './i18n';

/**
 * Build main menu keyboard with navigation buttons
 */
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
    .text(buttons.userChat)
    .resized()
    .persistent();
}

/**
 * Build back keyboard for returning to main menu
 */
export function buildBackKeyboard(i18n: I18n): Keyboard {
  const { buttons } = i18n;
  
  return new Keyboard()
    .text(buttons.backToMenu)
    .resized()
    .persistent();
}

/**
 * Build subscription tier selection keyboard
 */
export function buildSubscriptionKeyboard(i18n: I18n): Keyboard {
  return new Keyboard()
    .text('💎 Professional - 2000 tokens')
    .row()
    .text('🏢 Business - 10000 tokens')
    .row()
    .text(i18n.buttons.backToMenu)
    .resized()
    .persistent();
}

/**
 * Build cancel keyboard for canceling current operation
 */
export function buildCancelKeyboard(i18n: I18n): Keyboard {
  const { buttons } = i18n;
  
  return new Keyboard()
    .text(buttons.cancel)
    .resized()
    .persistent();
}

/**
 * Get button labels for a specific language (for handler matching)
 */
export function getButtonLabels(i18n: I18n) {
  return i18n.buttons;
}
