import { BotContext } from '../types';
import { AIService } from '../services/ai-service';
import { TokenService } from '@monorepo/shared';
import { OperationType } from '@monorepo/database';

export interface ChatHandlerConfig {
  aiService: AIService;
  tokenService: TokenService;
}

export class ChatHandler {
  private aiService: AIService;
  private tokenService: TokenService;

  constructor(config: ChatHandlerConfig) {
    this.aiService = config.aiService;
    this.tokenService = config.tokenService;
  }

  /**
   * Handle chat message
   */
  async handle(ctx: BotContext, messageText: string): Promise<void> {
    const user = ctx.user;
    const i18n = ctx.i18n;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    try {
      // Check if user can afford the operation
      const affordability = await this.tokenService.canAfford(user.id, OperationType.chatgpt_message);

      if (!affordability.canAfford) {
        await ctx.reply(
          i18n.t('common.insufficientTokens', {
            required: affordability.cost,
            available: affordability.balance,
          })
        );
        return;
      }

      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      // Prepare conversation context
      const conversationHistory = ctx.session.conversationContext?.lastPrompt
        ? [
            {
              role: 'assistant' as const,
              content: ctx.session.conversationContext.lastPrompt,
            },
          ]
        : [];

      const messages = [
        ...conversationHistory,
        {
          role: 'user' as const,
          content: messageText,
        },
      ];

      // Send request to AI service (Groq)
      const response = await this.aiService.chat(messages);

      // Deduct tokens
      await this.tokenService.chargeForOperation(user.id, OperationType.chatgpt_message, {
        generationId: `chat-${Date.now()}`,
        metadata: {
          provider: response.provider,
          model: response.model,
          prompt: messageText,
        },
      });

      // Update conversation context
      ctx.session.conversationContext = {
        lastCommand: 'chat',
        lastPrompt: response.content,
        messageCount: (ctx.session.conversationContext?.messageCount || 0) + 1,
      };

      // Send response
      await ctx.reply(response.content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('rate limit')) {
        await ctx.reply(i18n.common.rateLimitExceeded);
      } else {
        await ctx.reply(i18n.t('common.aiError', { error: errorMessage }));
      }
    }
  }

  /**
   * Handle streaming chat message (optional, for future enhancement)
   */
  async handleStream(ctx: BotContext, messageText: string): Promise<void> {
    const user = ctx.user;
    const i18n = ctx.i18n;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    try {
      // Check if user can afford the operation
      const affordability = await this.tokenService.canAfford(user.id, OperationType.chatgpt_message);

      if (!affordability.canAfford) {
        await ctx.reply(
          i18n.t('common.insufficientTokens', {
            required: affordability.cost,
            available: affordability.balance,
          })
        );
        return;
      }

      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      // Prepare conversation context
      const conversationHistory = ctx.session.conversationContext?.lastPrompt
        ? [
            {
              role: 'assistant' as const,
              content: ctx.session.conversationContext.lastPrompt,
            },
          ]
        : [];

      const messages = [
        ...conversationHistory,
        {
          role: 'user' as const,
          content: messageText,
        },
      ];

      // Stream response from AI service
      let fullResponse = '';
      let currentMessage: string | undefined;

      for await (const chunk of this.aiService.chatStream(messages)) {
        fullResponse += chunk;

        // Update message every few chunks (reduce API calls)
        if (fullResponse.length % 50 === 0) {
          if (!currentMessage) {
            const msg = await ctx.reply(fullResponse);
            currentMessage = msg.message_id.toString();
          } else {
            await ctx.api.editMessageText(ctx.chat!.id, parseInt(currentMessage), fullResponse);
          }
        }
      }

      // Send final message if not sent yet
      if (!currentMessage) {
        await ctx.reply(fullResponse);
      } else {
        await ctx.api.editMessageText(ctx.chat!.id, parseInt(currentMessage), fullResponse);
      }

      // Deduct tokens
      await this.tokenService.chargeForOperation(user.id, OperationType.chatgpt_message, {
        generationId: `chat-stream-${Date.now()}`,
        metadata: {
          provider: 'groq',
          prompt: messageText,
        },
      });

      // Update conversation context
      ctx.session.conversationContext = {
        lastCommand: 'chat',
        lastPrompt: fullResponse,
        messageCount: (ctx.session.conversationContext?.messageCount || 0) + 1,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('rate limit')) {
        await ctx.reply(i18n.common.rateLimitExceeded);
      } else {
        await ctx.reply(i18n.t('common.aiError', { error: errorMessage }));
      }
    }
  }
}
