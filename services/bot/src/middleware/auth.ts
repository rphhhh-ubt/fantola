import { Middleware } from 'grammy';
import { BotContext } from '../types';
import { db } from '@monorepo/shared';
import { SubscriptionTier } from '@monorepo/database';

/**
 * Authentication middleware - ensures user exists in database
 * Automatically creates new users with Gift tier on first interaction
 */
export function authMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    const telegramUser = ctx.from;
    
    if (!telegramUser) {
      await ctx.reply('Unable to identify user. Please try again.');
      return;
    }

    try {
      // Find or create user
      let user = await db.user.findUnique({
        where: { telegramId: telegramUser.id.toString() },
      });

      if (!user) {
        // Create new user with Gift tier
        user = await db.user.create({
          data: {
            telegramId: telegramUser.id.toString(),
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            tier: SubscriptionTier.Gift,
            tokensBalance: 100, // Gift tier default
          },
        });
      }

      // Attach user to context
      ctx.user = user;

      // Update session with user info
      ctx.session.userId = user.id;
      ctx.session.telegramId = telegramUser.id;
      ctx.session.username = telegramUser.username;

      await next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      await ctx.reply('An error occurred. Please try again later.');
    }
  };
}
