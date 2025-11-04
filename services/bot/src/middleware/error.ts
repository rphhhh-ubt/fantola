import { ErrorHandler } from 'grammy';
import { BotContext } from '../types';
import { Monitoring } from '@monorepo/monitoring';

/**
 * Global error handler for Grammy bot
 * Logs errors and sends user-friendly messages
 */
export function createErrorHandler(monitoring: Monitoring): ErrorHandler<BotContext> {
  return async (err) => {
    const ctx = err.ctx;
    const error = err.error;

    // Ensure error is an Error object
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Log error with context
    monitoring.handleError(errorObj, {
      updateId: ctx.update.update_id,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      messageText: ctx.message?.text,
    });

    // Track error metric
    monitoring.trackKPI({
      type: 'generation_failure',
      data: {
        type: 'bot_error',
        errorType: errorObj.name,
      },
    });

    // Send user-friendly error message
    try {
      await ctx.reply(
        '❌ An error occurred while processing your request. Please try again or contact support if the issue persists.',
        { parse_mode: 'Markdown' }
      );
    } catch (replyError) {
      // Log if we can't even send the error message
      monitoring.logger.error(
        { error: replyError, originalError: error },
        'Failed to send error message to user'
      );
    }
  };
}
