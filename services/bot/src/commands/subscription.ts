import { CommandContext, InlineKeyboard } from 'grammy';
import { BotContext } from '../types';
import { SubscriptionTier } from '@monorepo/database';

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

  // Show current subscription status
  const subscriptionStatus = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt) > new Date()
      ? i18n.t('commands.profile.statusActive', { 
          date: new Date(user.subscriptionExpiresAt).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US') 
        })
      : i18n.commands.profile.statusExpired
    : i18n.commands.profile.statusNone;

  const subscriptionMessage = [
    i18n.commands.subscription.title,
    '',
    i18n.t('commands.subscription.currentPlan', { tier: user.tier }),
    `${i18n.commands.profile.status} ${subscriptionStatus}`,
    `${i18n.commands.profile.available} ${user.tokensBalance} ${i18n.common.tokens}`,
    '',
    i18n.commands.subscription.plans.gift,
    i18n.commands.subscription.plans.professional,
    i18n.commands.subscription.plans.business,
    '',
    i18n.commands.subscription.upgrade,
  ].join('\n');

  // Create inline keyboard with tier options
  const keyboard = new InlineKeyboard();
  
  // Only show paid tiers for purchase
  if (user.tier !== SubscriptionTier.Professional) {
    keyboard.text('💎 Professional - 1990₽', 'buy_tier:Professional');
  }
  
  if (user.tier !== SubscriptionTier.Business) {
    keyboard.row().text('🏢 Business - 3490₽', 'buy_tier:Business');
  }

  await ctx.reply(subscriptionMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
