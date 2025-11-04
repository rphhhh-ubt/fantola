import { CommandContext } from 'grammy';
import { BotContext } from '../types';

/**
 * Handle /profile command
 * Show user profile information
 */
export async function handleProfile(ctx: CommandContext<BotContext>): Promise<void> {
  const user = ctx.user;

  if (!user) {
    await ctx.reply('Unable to load profile. Please try again.');
    return;
  }

  const subscriptionStatus = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt) > new Date()
      ? `Active until ${new Date(user.subscriptionExpiresAt).toLocaleDateString()}`
      : 'Expired'
    : 'No active subscription';

  const profileMessage = `
👤 *Your Profile*

*Name:* ${user.firstName || 'N/A'} ${user.lastName || ''}
*Username:* @${user.username || 'N/A'}
*Telegram ID:* ${user.telegramId}

💎 *Subscription*

*Current Tier:* ${user.tier}
*Status:* ${subscriptionStatus}

🪙 *Token Balance*

*Available:* ${user.tokensBalance} tokens
*Total Spent:* ${user.tokensSpent || 0} tokens

📊 *Statistics*

*Member since:* ${new Date(user.createdAt).toLocaleDateString()}
*Last active:* ${new Date(user.updatedAt).toLocaleDateString()}
  `.trim();

  await ctx.reply(profileMessage, { parse_mode: 'Markdown' });
}
