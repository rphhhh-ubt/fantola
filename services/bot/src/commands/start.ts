import { CommandContext } from 'grammy';
import { BotContext } from '../types';
import { buildMainMenuKeyboard } from '../keyboards';
import { Monitoring } from '@monorepo/monitoring';
import { processUserOnboarding } from '../services';

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

  try {
    // Process onboarding (awards tokens if eligible)
    const onboardingResult = await processUserOnboarding(user);

    // Track active user KPI
    monitoring.trackKPI({
      type: 'active_user',
      data: {
        userId: user.id,
        telegramId: ctx.from?.id.toString(),
        username: ctx.from?.username,
        isNewUser: onboardingResult.isNewUser,
        tokensAwarded: onboardingResult.tokensAwarded,
      },
    });

    // Log token award for new users
    if (onboardingResult.tokensAwarded > 0) {
      monitoring.logger.info({
        userId: user.id,
        tokensAwarded: onboardingResult.tokensAwarded,
        isNewUser: onboardingResult.isNewUser,
        newBalance: onboardingResult.user.tokensBalance,
      }, 'Gift tokens awarded to user');
    }

    // Update context with latest user data
    ctx.user = onboardingResult.user;

    await ctx.reply(onboardingResult.message, {
      parse_mode: 'Markdown',
      reply_markup: buildMainMenuKeyboard(),
    });
  } catch (error) {
    monitoring.handleError(error as Error, {
      context: 'handleStart',
      userId: user.id,
    });

    await ctx.reply(
      'An error occurred during onboarding. Please try again later.',
      { reply_markup: buildMainMenuKeyboard() }
    );
  }
}
