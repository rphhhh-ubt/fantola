import { BotContext } from '../types';
import { InlineKeyboard } from 'grammy';
import { TokenService } from '@monorepo/shared';
import { OperationType } from '@monorepo/database';
import { ProductCardMode } from '@monorepo/shared';
import axios from 'axios';

export interface ProductCardHandlerConfig {
  apiBaseUrl: string;
  tokenService: TokenService;
}

export class ProductCardHandler {
  private apiBaseUrl: string;
  private tokenService: TokenService;

  constructor(config: ProductCardHandlerConfig) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.tokenService = config.tokenService;
  }

  async handleStart(ctx: BotContext): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    await ctx.reply(
      '🎨 *Product Card Generator*\n\n' +
      'Create professional product images with AI!\n\n' +
      '📸 Please send me a photo of your product to get started.\n\n' +
      '💰 Cost: *10 tokens* per generation',
      { parse_mode: 'Markdown' }
    );

    ctx.session.productCardContext = {
      step: 'awaiting_photo',
    };
  }

  async handlePhoto(ctx: BotContext): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    if (!ctx.session.productCardContext || ctx.session.productCardContext.step !== 'awaiting_photo') {
      return;
    }

    const photo = ctx.message?.photo;
    if (!photo || photo.length === 0) {
      await ctx.reply('No photo found in message');
      return;
    }

    await ctx.replyWithChatAction('typing');

    const largestPhoto = photo[photo.length - 1];
    const file = await ctx.api.getFile(largestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const imageResponse = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    const imageBase64 = imageBuffer.toString('base64');

    ctx.session.productCardContext = {
      step: 'awaiting_mode',
      productImage: {
        data: imageBase64,
        mimeType: 'image/jpeg',
      },
    };

    const keyboard = new InlineKeyboard()
      .text('✨ Clean', 'pc_mode_clean')
      .text('📊 Infographics', 'pc_mode_infographics');

    await ctx.reply(
      '✅ Photo received!\n\n' +
      'Choose a card mode:\n' +
      '• *Clean* - Minimal, professional look\n' +
      '• *Infographics* - Data-rich, detailed view',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async handleModeSelection(ctx: BotContext, mode: ProductCardMode): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    if (!ctx.session.productCardContext || !ctx.session.productCardContext.productImage) {
      await ctx.reply('Please start over by sending a product photo.');
      return;
    }

    ctx.session.productCardContext.mode = mode;
    ctx.session.productCardContext.step = 'awaiting_options';

    const keyboard = new InlineKeyboard()
      .text('🎨 Add Background', 'pc_opt_background').row()
      .text('📐 Set Pose', 'pc_opt_pose').row()
      .text('✍️ Add Text', 'pc_opt_text').row()
      .text('✅ Generate Now', 'pc_generate');

    await ctx.editMessageText(
      `✅ Mode selected: *${mode === ProductCardMode.CLEAN ? 'Clean' : 'Infographics'}*\n\n` +
      'Optional: Customize your card\n' +
      '• Add custom background\n' +
      '• Set product pose/angle\n' +
      '• Add text (headline, subheadline, description)\n\n' +
      'Or generate with defaults!',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async handleOptions(ctx: BotContext, option: string): Promise<void> {
    const i18n = ctx.i18n;

    if (!ctx.session.productCardContext || ctx.session.productCardContext.step !== 'awaiting_options') {
      return;
    }

    ctx.session.productCardContext.currentOption = option;

    let promptMessage = '';
    switch (option) {
      case 'background':
        promptMessage = '🎨 Describe the background you want (e.g., "white studio", "outdoor nature", "gradient blue")';
        break;
      case 'pose':
        promptMessage = '📐 Describe the product pose/angle (e.g., "front view", "45 degree angle", "floating")';
        break;
      case 'text':
        promptMessage = '✍️ Enter text in format:\nHeadline | Subheadline | Description\n\nExample:\nNew Product | Best Quality | Description here';
        break;
    }

    await ctx.editMessageText(promptMessage);
    ctx.session.productCardContext.step = 'awaiting_input';
  }

  async handleOptionInput(ctx: BotContext, input: string): Promise<void> {
    if (!ctx.session.productCardContext || ctx.session.productCardContext.step !== 'awaiting_input') {
      return;
    }

    const option = ctx.session.productCardContext.currentOption;

    if (!ctx.session.productCardContext.options) {
      ctx.session.productCardContext.options = {};
    }

    switch (option) {
      case 'background':
        ctx.session.productCardContext.options.background = input;
        break;
      case 'pose':
        ctx.session.productCardContext.options.pose = input;
        break;
      case 'text':
        const parts = input.split('|').map(p => p.trim());
        if (parts.length >= 1) ctx.session.productCardContext.options.textHeadline = parts[0];
        if (parts.length >= 2) ctx.session.productCardContext.options.textSubheadline = parts[1];
        if (parts.length >= 3) ctx.session.productCardContext.options.textDescription = parts[2];
        break;
    }

    ctx.session.productCardContext.step = 'awaiting_options';

    const keyboard = new InlineKeyboard()
      .text('🎨 Add Background', 'pc_opt_background').row()
      .text('📐 Set Pose', 'pc_opt_pose').row()
      .text('✍️ Add Text', 'pc_opt_text').row()
      .text('✅ Generate Now', 'pc_generate');

    await ctx.reply(
      '✅ Option saved!\n\nContinue customizing or generate now.',
      { reply_markup: keyboard }
    );
  }

  async handleGenerate(ctx: BotContext): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    if (!ctx.session.productCardContext || !ctx.session.productCardContext.productImage || !ctx.session.productCardContext.mode) {
      await ctx.reply('Please start over by sending a product photo.');
      return;
    }

    const affordability = await this.tokenService.canAfford(user.id, OperationType.product_card);

    if (!affordability.canAfford) {
      await ctx.reply(
        i18n.t('common.insufficientTokens', {
          required: affordability.cost,
          available: affordability.balance,
        })
      );
      return;
    }

    await ctx.editMessageText('⏳ Generating your product card...');

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/product-card/upload`,
        {
          productImage: ctx.session.productCardContext.productImage,
          options: {
            mode: ctx.session.productCardContext.mode,
            ...ctx.session.productCardContext.options,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${user.telegramId}`,
          },
        }
      );

      ctx.session.productCardContext = {
        step: 'completed',
        generationId: response.data.id,
      };

      await ctx.reply(
        '✅ *Generation Started!*\n\n' +
        `Generation ID: \`${response.data.id}\`\n\n` +
        'I\'ll notify you when it\'s ready. This usually takes 1-2 minutes.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        if (errorData?.reason) {
          await ctx.reply(`❌ Content moderation failed: ${errorData.reason}`);
        } else {
          await ctx.reply(`❌ Error: ${errorData?.error || error.message}`);
        }
      } else {
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    }
  }

  async handleGenerationComplete(ctx: BotContext, generationId: string, resultUrls: string[]): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('🔄 Generate More', `pc_more_${generationId}`)
      .text('✏️ Edit Card', `pc_edit_${generationId}`);

    await ctx.reply(
      '✅ *Product Card Ready!*\n\n' +
      'Your product card has been generated successfully!',
      { parse_mode: 'Markdown' }
    );

    for (const url of resultUrls) {
      await ctx.replyWithPhoto(url, {
        reply_markup: keyboard,
      });
    }
  }

  async handleGenerateMore(ctx: BotContext, generationId: string): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    const affordability = await this.tokenService.canAfford(user.id, OperationType.product_card);

    if (!affordability.canAfford) {
      await ctx.reply(
        i18n.t('common.insufficientTokens', {
          required: affordability.cost,
          available: affordability.balance,
        })
      );
      return;
    }

    await ctx.editMessageCaption('⏳ Generating more variants...');

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/product-card/generation/${generationId}/generate-more`,
        {},
        {
          headers: {
            Authorization: `Bearer ${user.telegramId}`,
          },
        }
      );

      await ctx.reply(
        '✅ *New Generation Started!*\n\n' +
        `Generation ID: \`${response.data.id}\`\n\n` +
        'I\'ll notify you when it\'s ready.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        await ctx.reply(`❌ Error: ${error.response?.data?.error || error.message}`);
      } else {
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    }
  }

  async handleEdit(ctx: BotContext, generationId: string): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    ctx.session.productCardContext = {
      step: 'editing',
      generationId,
    };

    const keyboard = new InlineKeyboard()
      .text('🎨 Change Background', 'pc_edit_opt_background').row()
      .text('📐 Change Pose', 'pc_edit_opt_pose').row()
      .text('✍️ Change Text', 'pc_edit_opt_text').row()
      .text('✅ Apply Changes', 'pc_edit_apply');

    await ctx.editMessageCaption(
      '✏️ *Edit Card*\n\n' +
      'What would you like to change?',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }

  async handleEditApply(ctx: BotContext): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    if (!ctx.session.productCardContext || !ctx.session.productCardContext.generationId || !ctx.session.productCardContext.options) {
      await ctx.reply('No changes to apply.');
      return;
    }

    const affordability = await this.tokenService.canAfford(user.id, OperationType.product_card);

    if (!affordability.canAfford) {
      await ctx.reply(
        i18n.t('common.insufficientTokens', {
          required: affordability.cost,
          available: affordability.balance,
        })
      );
      return;
    }

    await ctx.editMessageText('⏳ Applying changes...');

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/product-card/generation/${ctx.session.productCardContext.generationId}/edit`,
        {
          options: ctx.session.productCardContext.options,
        },
        {
          headers: {
            Authorization: `Bearer ${user.telegramId}`,
          },
        }
      );

      await ctx.reply(
        '✅ *Edit Applied!*\n\n' +
        `Generation ID: \`${response.data.id}\`\n\n` +
        'I\'ll notify you when it\'s ready.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        await ctx.reply(`❌ Error: ${error.response?.data?.error || error.message}`);
      } else {
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    }
  }
}
