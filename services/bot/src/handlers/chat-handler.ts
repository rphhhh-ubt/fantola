import { BotContext } from '../types';
import { AIService } from '../services/ai-service';
import { TokenService } from '@monorepo/shared';
import { OperationType, db } from '@monorepo/database';
import { v4 as uuidv4 } from 'uuid';

export interface ChatHandlerConfig {
  aiService: AIService;
  tokenService: TokenService;
}

export class ChatHandler {
  private aiService: AIService;
  private tokenService: TokenService;
  private readonly MAX_CONTEXT_MESSAGES = 10;

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

      // Get or create conversation ID
      const conversationId = ctx.session.conversationContext?.conversationId || uuidv4();

      // Get conversation history from session
      const conversationHistory = ctx.session.conversationContext?.history || [];
      
      // Build messages array with history
      const messages = [
        ...conversationHistory.slice(-this.MAX_CONTEXT_MESSAGES),
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
          conversationId,
        },
      });

      // Log user message to database
      await db.chatMessage.create({
        data: {
          userId: user.id,
          role: 'user',
          content: messageText,
          conversationId,
          tokensUsed: affordability.cost,
          metadata: {
            provider: response.provider,
            model: response.model,
          },
        },
      });

      // Log assistant message to database
      await db.chatMessage.create({
        data: {
          userId: user.id,
          role: 'assistant',
          content: response.content,
          model: response.model,
          conversationId,
          metadata: {
            provider: response.provider,
          },
        },
      });

      // Update conversation context in session
      const updatedHistory = [
        ...conversationHistory.slice(-this.MAX_CONTEXT_MESSAGES),
        {
          role: 'user' as const,
          content: messageText,
        },
        {
          role: 'assistant' as const,
          content: response.content,
        },
      ];

      ctx.session.conversationContext = {
        lastCommand: 'chat',
        lastPrompt: response.content,
        messageCount: (ctx.session.conversationContext?.messageCount || 0) + 1,
        conversationId,
        history: updatedHistory,
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
   * Handle streaming chat message (with typing indicators)
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

      // Get or create conversation ID
      const conversationId = ctx.session.conversationContext?.conversationId || uuidv4();

      // Get conversation history from session
      const conversationHistory = ctx.session.conversationContext?.history || [];
      
      // Build messages array with history
      const messages = [
        ...conversationHistory.slice(-this.MAX_CONTEXT_MESSAGES),
        {
          role: 'user' as const,
          content: messageText,
        },
      ];

      // Stream response from AI service
      let fullResponse = '';
      let currentMessage: string | undefined;
      let lastTypingIndicator = Date.now();

      for await (const chunk of this.aiService.chatStream(messages)) {
        fullResponse += chunk;

        // Send typing indicator periodically (every 5 seconds)
        const now = Date.now();
        if (now - lastTypingIndicator > 5000) {
          await ctx.replyWithChatAction('typing');
          lastTypingIndicator = now;
        }

        // Update message every 50 characters (reduce API calls)
        if (fullResponse.length % 50 === 0 && fullResponse.length > 0) {
          if (!currentMessage) {
            const msg = await ctx.reply(fullResponse);
            currentMessage = msg.message_id.toString();
          } else {
            try {
              await ctx.api.editMessageText(ctx.chat!.id, parseInt(currentMessage), fullResponse);
            } catch (editError) {
              // Ignore edit errors (message might be identical)
            }
          }
        }
      }

      // Send final message if not sent yet
      if (!currentMessage) {
        await ctx.reply(fullResponse);
      } else {
        try {
          await ctx.api.editMessageText(ctx.chat!.id, parseInt(currentMessage), fullResponse);
        } catch (editError) {
          // If final edit fails, send as new message
          await ctx.reply(fullResponse);
        }
      }

      // Deduct tokens
      await this.tokenService.chargeForOperation(user.id, OperationType.chatgpt_message, {
        generationId: `chat-stream-${Date.now()}`,
        metadata: {
          provider: 'groq',
          prompt: messageText,
          conversationId,
          streaming: true,
        },
      });

      // Log user message to database
      await db.chatMessage.create({
        data: {
          userId: user.id,
          role: 'user',
          content: messageText,
          conversationId,
          tokensUsed: affordability.cost,
          metadata: {
            provider: 'groq',
            streaming: true,
          },
        },
      });

      // Log assistant message to database
      await db.chatMessage.create({
        data: {
          userId: user.id,
          role: 'assistant',
          content: fullResponse,
          model: 'groq',
          conversationId,
          metadata: {
            provider: 'groq',
            streaming: true,
          },
        },
      });

      // Update conversation context in session
      const updatedHistory = [
        ...conversationHistory.slice(-this.MAX_CONTEXT_MESSAGES),
        {
          role: 'user' as const,
          content: messageText,
        },
        {
          role: 'assistant' as const,
          content: fullResponse,
        },
      ];

      ctx.session.conversationContext = {
        lastCommand: 'chat',
        lastPrompt: fullResponse,
        messageCount: (ctx.session.conversationContext?.messageCount || 0) + 1,
        conversationId,
        history: updatedHistory,
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

  /**
   * Clear conversation context
   */
  clearContext(ctx: BotContext): void {
    ctx.session.conversationContext = undefined;
  }
}
