import { BotContext } from '../types';
import { AIService } from '../services/ai-service';
import { TokenService } from '@monorepo/shared';
import { OperationType } from '@monorepo/database';
import axios from 'axios';

export interface PhotoHandlerConfig {
  aiService: AIService;
  tokenService: TokenService;
}

export class PhotoHandler {
  private aiService: AIService;
  private tokenService: TokenService;

  constructor(config: PhotoHandlerConfig) {
    this.aiService = config.aiService;
    this.tokenService = config.tokenService;
  }

  /**
   * Handle photo message with vision
   */
  async handle(ctx: BotContext): Promise<void> {
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

      // Get photo from message
      const photo = ctx.message?.photo;
      if (!photo || photo.length === 0) {
        await ctx.reply('No photo found in message');
        return;
      }

      // Get largest photo
      const largestPhoto = photo[photo.length - 1];

      // Show typing indicator
      await ctx.replyWithChatAction('typing');

      // Download photo
      const file = await ctx.api.getFile(largestPhoto.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

      const imageResponse = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
      });

      const imageBuffer = Buffer.from(imageResponse.data);

      // Get caption or use default prompt
      const caption = ctx.message?.caption || 'What do you see in this image?';

      // Prepare messages
      const messages = [
        {
          role: 'user' as const,
          content: caption,
        },
      ];

      // Prepare images
      const images = [
        {
          data: imageBuffer,
          mimeType: 'image/jpeg',
        },
      ];

      // Send request to AI service (Gemini Vision)
      const response = await this.aiService.chatWithVision(messages, images);

      // Deduct tokens
      await this.tokenService.chargeForOperation(user.id, OperationType.chatgpt_message, {
        generationId: `vision-${Date.now()}`,
        metadata: {
          provider: response.provider,
          model: response.model,
          prompt: caption,
          hasImage: true,
        },
      });

      // Update conversation context
      ctx.session.conversationContext = {
        lastCommand: 'vision',
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
}
