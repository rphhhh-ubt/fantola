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
  const i18n = ctx.i18n;
  
  if (!user) {
    await ctx.reply(i18n.common.error);
    return;
  }

  try {
    // Process onboarding (awards tokens if eligible, checks channel if configured)
    const onboardingResult = await processUserOnboarding(
      user,
      i18n,
      ctx.channelVerification
    );

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

    // Log channel verification result if performed
    if (onboardingResult.channelCheckRequired !== undefined) {
      monitoring.logger.info({
        userId: user.id,
        channelCheckRequired: onboardingResult.channelCheckRequired,
        channelCheckPassed: onboardingResult.channelCheckPassed,
      }, 'Channel verification performed');
    }

    // Update context with latest user data
    ctx.user = onboardingResult.user;

    await ctx.reply(onboardingResult.message, {
      parse_mode: 'Markdown',
      reply_markup: buildMainMenuKeyboard(i18n),
    });
  } catch (error) {
    monitoring.handleError(error as Error, {
      context: 'handleStart',
      userId: user.id,
    });

    await ctx.reply(i18n.common.error, {
      reply_markup: buildMainMenuKeyboard(i18n),
    });
  }
}
