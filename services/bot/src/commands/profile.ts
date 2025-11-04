import { CommandContext } from 'grammy';
import { BotContext } from '../types';
import { SubscriptionTier } from '@monorepo/database';

/**
 * Handle /profile command
 * Show user profile information
 */
export async function handleProfile(ctx: CommandContext<BotContext>): Promise<void> {
  const user = ctx.user;
  const i18n = ctx.i18n;

  if (!user) {
    await ctx.reply(i18n.common.profileError);
    return;
  }

  const subscriptionStatus = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt) > new Date()
      ? i18n.t('commands.profile.statusActive', { 
          date: new Date(user.subscriptionExpiresAt).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US') 
        })
      : i18n.commands.profile.statusExpired
    : i18n.commands.profile.statusNone;

  // Check channel subscription status for Gift tier users
  let channelStatus = '';
  if (user.tier === SubscriptionTier.Gift && ctx.channelVerification) {
    const telegramId = parseInt(user.telegramId);
    const membershipResult = await ctx.channelVerification.checkMembership(telegramId);
    
    const statusText = membershipResult.isMember 
      ? i18n.channelVerification.status.subscribed
      : i18n.channelVerification.status.notSubscribed;
    
    channelStatus = `\n\n📢 *${i18n.channelVerification.subscriptionRequired}*\n${statusText}`;
    
    // Add warning if not subscribed
    if (!membershipResult.isMember) {
      const channel = ctx.channelVerification.formatChannelForMessage();
      channelStatus += `\n\n⚠️ ${i18n.t('channelVerification.notSubscribed', { channel })}`;
    }
  }

  const profileMessage = `
${i18n.commands.profile.title}

${i18n.commands.profile.name} ${user.firstName || 'N/A'} ${user.lastName || ''}
${i18n.commands.profile.username} @${user.username || 'N/A'}
${i18n.commands.profile.telegramId} ${user.telegramId}

${i18n.commands.profile.subscriptionTitle}

${i18n.commands.profile.currentTier} ${user.tier}
${i18n.commands.profile.status} ${subscriptionStatus}${channelStatus}

${i18n.commands.profile.tokenBalanceTitle}

${i18n.commands.profile.available} ${user.tokensBalance} ${i18n.common.tokens}
${i18n.commands.profile.totalSpent} ${user.tokensSpent || 0} ${i18n.common.tokens}

${i18n.commands.profile.statisticsTitle}

${i18n.commands.profile.memberSince} ${new Date(user.createdAt).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}
${i18n.commands.profile.lastActive} ${new Date(user.updatedAt).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}
  `.trim();

  await ctx.reply(profileMessage, { parse_mode: 'Markdown' });
}
