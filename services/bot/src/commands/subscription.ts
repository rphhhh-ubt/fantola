import { CommandContext } from 'grammy';
import { BotContext } from '../types';
import { buildSubscriptionKeyboard } from '../keyboards';

/**
 * Handle /subscription command
 * Show subscription plans and manage current subscription
 */
export async function handleSubscription(ctx: CommandContext<BotContext>): Promise<void> {
  const user = ctx.user;
  const i18n = ctx.i18n;

  if (!user) {
    await ctx.reply(i18n.common.profileError);
    return;
  }

  const subscriptionMessage = [
    i18n.commands.subscription.title,
    i18n.t('commands.subscription.currentPlan', { tier: user.tier }),
    i18n.commands.subscription.plans.gift,
    i18n.commands.subscription.plans.professional,
    i18n.commands.subscription.plans.business,
    i18n.commands.subscription.upgrade,
  ].join('\n');

  await ctx.reply(subscriptionMessage, {
    parse_mode: 'Markdown',
    reply_markup: buildSubscriptionKeyboard(i18n),
  });
}
