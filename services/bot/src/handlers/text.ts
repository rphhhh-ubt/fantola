import { BotContext } from '../types';
import { MainMenuButtons, buildMainMenuKeyboard } from '../keyboards';

/**
 * Handle text messages - primarily keyboard button presses
 */
export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;

  if (!text) {
    return;
  }

  switch (text) {
    case MainMenuButtons.GENERATE_IMAGE:
      await handleGenerateImage(ctx);
      break;

    case MainMenuButtons.CHAT_GPT:
      await handleChatGPT(ctx);
      break;

    case MainMenuButtons.MY_PROFILE:
      await handleMyProfile(ctx);
      break;

    case MainMenuButtons.SUBSCRIPTION:
      await handleSubscriptionButton(ctx);
      break;

    case MainMenuButtons.HELP:
      await handleHelpButton(ctx);
      break;

    case '⬅️ Back to Menu':
      await handleBackToMenu(ctx);
      break;

    default:
      // Unknown message
      await ctx.reply(
        '❓ I didn\'t understand that. Please use the menu buttons below.',
        { reply_markup: buildMainMenuKeyboard() }
      );
  }
}

async function handleGenerateImage(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '🎨 *Image Generation*\n\n' +
      'This feature is coming soon! You\'ll be able to generate images using AI.\n\n' +
      'Supported models:\n' +
      '• DALL-E 3\n' +
      '• Stable Diffusion\n' +
      '• Sora (video-to-image)\n\n' +
      'Cost: 10 tokens per image',
    { parse_mode: 'Markdown' }
  );
}

async function handleChatGPT(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '💬 *ChatGPT*\n\n' +
      'This feature is coming soon! You\'ll be able to chat with GPT-4.\n\n' +
      'Features:\n' +
      '• Natural conversations\n' +
      '• Context awareness\n' +
      '• Multiple conversation threads\n\n' +
      'Cost: 5 tokens per message',
    { parse_mode: 'Markdown' }
  );
}

async function handleMyProfile(ctx: BotContext): Promise<void> {
  const user = ctx.user;

  if (!user) {
    await ctx.reply('Unable to load profile. Please try again.');
    return;
  }

  const profileMessage = `
👤 *Your Profile*

*Name:* ${user.firstName || 'N/A'}
*Plan:* ${user.tier}
*Tokens:* ${user.tokensBalance} available

Use /profile for detailed information.
  `.trim();

  await ctx.reply(profileMessage, { parse_mode: 'Markdown' });
}

async function handleSubscriptionButton(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '💎 Use /subscription to view and manage your subscription plans.',
    { parse_mode: 'Markdown' }
  );
}

async function handleHelpButton(ctx: BotContext): Promise<void> {
  await ctx.reply('📚 Use /help to see all available commands and features.');
}

async function handleBackToMenu(ctx: BotContext): Promise<void> {
  await ctx.reply('🏠 Back to main menu', {
    reply_markup: buildMainMenuKeyboard(),
  });
}
