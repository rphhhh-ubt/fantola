import { CommandContext } from 'grammy';
import { BotContext } from '../types';
import { buildMainMenuKeyboard } from '../keyboards';
import { Monitoring } from '@monorepo/monitoring';

/**
 * Handle /start command
 * Welcome new users and show main menu
 */
export async function handleStart(
  ctx: CommandContext<BotContext>,
  monitoring: Monitoring
): Promise<void> {
  const user = ctx.user;
  
  if (!user) {
    await ctx.reply('Unable to identify user. Please try again.');
    return;
  }

  // Track active user KPI
  monitoring.trackKPI({
    type: 'active_user',
    data: {
      userId: user.id,
      telegramId: ctx.from?.id.toString(),
      username: ctx.from?.username,
    },
  });

  const welcomeMessage = `
👋 Welcome to AI Bot, ${user.firstName || 'User'}!

I can help you with:
🎨 Generate images using AI
💬 Chat with GPT-4
💎 Manage your subscription

Your current plan: *${user.tier}*
Available tokens: *${user.tokensBalance}*

Use the menu below to get started! 👇
  `.trim();

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: buildMainMenuKeyboard(),
  });
}
