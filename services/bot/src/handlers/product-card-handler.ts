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

    await ctx.reply(i18n.productCard.start, { parse_mode: 'Markdown' });

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

    if (
      !ctx.session.productCardContext ||
      ctx.session.productCardContext.step !== 'awaiting_photo'
    ) {
      return;
    }

    const photo = ctx.message?.photo;
    if (!photo || photo.length === 0) {
      await ctx.reply(i18n.productCard.noPhoto);
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
      .text(i18n.productCard.buttons.clean, 'pc_mode_clean')
      .text(i18n.productCard.buttons.infographics, 'pc_mode_infographics');

    await ctx.reply(i18n.productCard.photoReceived, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  async handleModeSelection(ctx: BotContext, mode: ProductCardMode): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    if (!ctx.session.productCardContext || !ctx.session.productCardContext.productImage) {
      await ctx.reply(i18n.productCard.startOver);
      return;
    }

    ctx.session.productCardContext.mode = mode;
    ctx.session.productCardContext.step = 'awaiting_options';

    const keyboard = new InlineKeyboard()
      .text(i18n.productCard.buttons.addBackground, 'pc_opt_background')
      .row()
      .text(i18n.productCard.buttons.setPose, 'pc_opt_pose')
      .row()
      .text(i18n.productCard.buttons.addText, 'pc_opt_text')
      .row()
      .text(i18n.productCard.buttons.generateNow, 'pc_generate');

    const modeText =
      mode === ProductCardMode.CLEAN ? i18n.productCard.clean : i18n.productCard.infographics;

    await ctx.editMessageText(i18n.t('productCard.modeSelected', { mode: modeText }), {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  async handleOptions(ctx: BotContext, option: string): Promise<void> {
    const i18n = ctx.i18n;

    if (
      !ctx.session.productCardContext ||
      ctx.session.productCardContext.step !== 'awaiting_options'
    ) {
      return;
    }

    ctx.session.productCardContext.currentOption = option;

    let promptMessage = '';
    switch (option) {
      case 'background':
        promptMessage = i18n.productCard.promptBackground;
        break;
      case 'pose':
        promptMessage = i18n.productCard.promptPose;
        break;
      case 'text':
        promptMessage = i18n.productCard.promptText;
        break;
    }

    await ctx.editMessageText(promptMessage);
    ctx.session.productCardContext.step = 'awaiting_input';
  }

  async handleOptionInput(ctx: BotContext, input: string): Promise<void> {
    const i18n = ctx.i18n;

    if (
      !ctx.session.productCardContext ||
      ctx.session.productCardContext.step !== 'awaiting_input'
    ) {
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
      case 'text': {
        const parts = input.split('|').map((p) => p.trim());
        if (parts.length >= 1) ctx.session.productCardContext.options.textHeadline = parts[0];
        if (parts.length >= 2) ctx.session.productCardContext.options.textSubheadline = parts[1];
        if (parts.length >= 3) ctx.session.productCardContext.options.textDescription = parts[2];
        break;
      }
    }

    ctx.session.productCardContext.step = 'awaiting_options';

    const keyboard = new InlineKeyboard()
      .text(i18n.productCard.buttons.addBackground, 'pc_opt_background')
      .row()
      .text(i18n.productCard.buttons.setPose, 'pc_opt_pose')
      .row()
      .text(i18n.productCard.buttons.addText, 'pc_opt_text')
      .row()
      .text(i18n.productCard.buttons.generateNow, 'pc_generate');

    await ctx.reply(i18n.productCard.optionSaved, { reply_markup: keyboard });
  }

  async handleGenerate(ctx: BotContext): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    if (
      !ctx.session.productCardContext ||
      !ctx.session.productCardContext.productImage ||
      !ctx.session.productCardContext.mode
    ) {
      await ctx.reply(i18n.productCard.startOver);
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

    await ctx.editMessageText(i18n.productCard.generating);

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

      await ctx.reply(i18n.t('productCard.generationStarted', { id: response.data.id }), {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        if (errorData?.reason) {
          await ctx.reply(i18n.t('productCard.moderationFailed', { reason: errorData.reason }));
        } else {
          await ctx.reply(`❌ ${i18n.common.error} ${errorData?.error || error.message}`);
        }
      } else {
        await ctx.reply(i18n.common.error);
      }
    }
  }

  async handleGenerationComplete(
    ctx: BotContext,
    generationId: string,
    resultUrls: string[]
  ): Promise<void> {
    const i18n = ctx.i18n;

    const keyboard = new InlineKeyboard()
      .text(i18n.productCard.buttons.generateMore, `pc_more_${generationId}`)
      .text(i18n.productCard.buttons.editCard, `pc_edit_${generationId}`);

    await ctx.reply(i18n.productCard.generationReady, { parse_mode: 'Markdown' });

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

    const callbackMessage = ctx.callbackQuery?.message;
    if (callbackMessage) {
      await ctx.api.editMessageCaption({
        chat_id: callbackMessage.chat.id,
        message_id: callbackMessage.message_id,
        caption: i18n.productCard.generatingMore,
        parse_mode: 'HTML',
      });
    }

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

      await ctx.reply(i18n.t('productCard.newGenerationStarted', { id: response.data.id }), {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        await ctx.reply(`❌ ${i18n.common.error} ${error.response?.data?.error || error.message}`);
      } else {
        await ctx.reply(i18n.common.error);
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
      .text(i18n.productCard.buttons.changeBackground, 'pc_edit_opt_background')
      .row()
      .text(i18n.productCard.buttons.changePose, 'pc_edit_opt_pose')
      .row()
      .text(i18n.productCard.buttons.changeText, 'pc_edit_opt_text')
      .row()
      .text(i18n.productCard.buttons.applyChanges, 'pc_edit_apply');

    const callbackMessage = ctx.callbackQuery?.message;
    if (!callbackMessage) {
      return;
    }

    const editCaptionHtml = i18n.productCard.editCard.replace(/\*(.*?)\*/g, '<b>$1</b>');

    await ctx.api.editMessageCaption({
      chat_id: callbackMessage.chat.id,
      message_id: callbackMessage.message_id,
      caption: editCaptionHtml,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  async handleEditApply(ctx: BotContext): Promise<void> {
    const i18n = ctx.i18n;
    const user = ctx.user;

    if (!user) {
      await ctx.reply(i18n.common.profileError);
      return;
    }

    if (
      !ctx.session.productCardContext ||
      !ctx.session.productCardContext.generationId ||
      !ctx.session.productCardContext.options
    ) {
      await ctx.reply(i18n.productCard.noChanges);
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

    await ctx.editMessageText(i18n.productCard.applyingChanges);

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

      await ctx.reply(i18n.t('productCard.editApplied', { id: response.data.id }), {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        await ctx.reply(`❌ ${i18n.common.error} ${error.response?.data?.error || error.message}`);
      } else {
        await ctx.reply(i18n.common.error);
      }
    }
  }
}
