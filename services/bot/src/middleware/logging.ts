import { Middleware } from 'grammy';
import { BotContext } from '../types';
import { Monitoring } from '@monorepo/monitoring';

/**
 * Logging middleware - logs all incoming updates
 */
export function loggingMiddleware(monitoring: Monitoring): Middleware<BotContext> {
  return async (ctx, next) => {
    const start = Date.now();
    
    monitoring.logger.debug(
      {
        updateId: ctx.update.update_id,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        messageText: ctx.message?.text,
        callbackData: ctx.callbackQuery?.data,
      },
      'Incoming update'
    );

    await next();

    const duration = Date.now() - start;
    monitoring.logger.debug(
      {
        updateId: ctx.update.update_id,
        duration,
      },
      'Update processed'
    );
  };
}
