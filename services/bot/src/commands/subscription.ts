import { CommandContext } from 'grammy';
import { BotContext } from '../types';
import { buildSubscriptionKeyboard } from '../keyboards';

/**
 * Handle /subscription command
 * Show subscription plans and manage current subscription
 */
export async function handleSubscription(ctx: CommandContext<BotContext>): Promise<void> {
  const user = ctx.user;

  if (!user) {
    await ctx.reply('Unable to load subscription info. Please try again.');
    return;
  }

  const subscriptionMessage = `
💎 *Subscription Plans*

*Current Plan:* ${user.tier}
*Available Tokens:* ${user.tokensBalance}

📦 *Available Plans*

*🎁 Gift (Free)*
• 100 tokens/month
• Basic features
• Requires channel subscription

*💎 Professional*
• 2000 tokens/month
• All AI models
• Priority support
• Price: 1990₽/month

*🏢 Business*
• 10000 tokens/month
• All features
• Highest priority
• Advanced analytics
• Price: 3490₽/month

🪙 *Token Costs*
• Image Generation: 10 tokens
• Sora Image: 10 tokens
• ChatGPT Message: 5 tokens

Select a plan below to upgrade or manage your subscription:
  `.trim();

  await ctx.reply(subscriptionMessage, {
    parse_mode: 'Markdown',
    reply_markup: buildSubscriptionKeyboard(),
  });
}
