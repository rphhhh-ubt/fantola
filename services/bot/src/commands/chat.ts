import { BotContext } from '../types';

/**
 * Handle /chat command - initiate or continue conversation
 */
export async function handleChat(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  const user = ctx.user;

  if (!user) {
    await ctx.reply(i18n.common.profileError);
    return;
  }

  // Check if conversation exists
  const hasConversation = ctx.session.conversationContext?.messageCount && 
                          ctx.session.conversationContext.messageCount > 0;

  if (hasConversation) {
    const messageCount = ctx.session.conversationContext?.messageCount || 0;
    await ctx.reply(
      i18n.t('commands.chat.continueConversation', {
        count: messageCount,
      })
    );
  } else {
    await ctx.reply(i18n.commands.chat.start);
  }
}

/**
 * Handle /chatclear command - clear conversation history
 */
export async function handleChatClear(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  
  if (ctx.chatHandler) {
    ctx.chatHandler.clearContext(ctx);
    await ctx.reply(i18n.commands.chat.cleared);
  } else {
    await ctx.reply(i18n.common.error);
  }
}
