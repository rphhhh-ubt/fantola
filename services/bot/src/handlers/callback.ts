import { CallbackQueryContext } from 'grammy';
import { InlineKeyboardMarkup } from 'grammy/types';
import { BotContext } from '../types';
import { PaymentService } from '../services/payment-service';
import { SubscriptionTier } from '@monorepo/database';
import { ProductCardMode } from '@monorepo/shared';

/**
 * Handle callback queries from inline keyboards
 */
export async function handleCallbackQuery(
  ctx: CallbackQueryContext<BotContext>,
  paymentService: PaymentService
): Promise<void> {
  const data = ctx.callbackQuery.data;
  const i18n = ctx.i18n;

  if (!data) {
    await ctx.answerCallbackQuery(i18n.callback.invalidData);
    return;
  }

  // Handle tier purchase callbacks
  if (data.startsWith('buy_tier:')) {
    const tier = data.split(':')[1] as SubscriptionTier;
    await handleTierPurchase(ctx, tier, paymentService);
    return;
  }

  // Handle product card callbacks
  if (data.startsWith('pc_')) {
    await handleProductCardCallback(ctx, data);
    return;
  }

  // Unknown callback
  await ctx.answerCallbackQuery(i18n.callback.unknownAction);
}

/**
 * Handle tier purchase request
 */
async function handleTierPurchase(
  ctx: CallbackQueryContext<BotContext>,
  tier: SubscriptionTier,
  paymentService: PaymentService
): Promise<void> {
  const user = ctx.user;
  const i18n = ctx.i18n;

  if (!user) {
    await ctx.answerCallbackQuery(i18n.common.profileError);
    return;
  }

  // Cannot purchase Gift tier
  if (tier === SubscriptionTier.Gift) {
    await ctx.answerCallbackQuery(i18n.callback.giftCannotBuy);
    return;
  }

  // Check if user already has this tier
  if (user.tier === tier) {
    const expiresAt = user.subscriptionExpiresAt;
    if (expiresAt && new Date(expiresAt) > new Date()) {
      await ctx.answerCallbackQuery(i18n.t('callback.alreadySubscribed', { tier }));
      return;
    }
  }

  try {
    // Answer callback query immediately
    await ctx.answerCallbackQuery(i18n.common.loading);

    // Create payment link
    const telegramId = parseInt(user.telegramId);
    const payment = await paymentService.createPayment(user.id, tier, telegramId);

    const tierDescriptions = {
      [SubscriptionTier.Professional]: i18n.callback.tierDescriptions.professional,
      [SubscriptionTier.Business]: i18n.callback.tierDescriptions.business,
      [SubscriptionTier.Gift]: '',
    };

    const message = [
      i18n.callback.subscriptionPayment,
      '',
      i18n.t('callback.plan', { tier }),
      tierDescriptions[tier],
      '',
      i18n.t('callback.amount', { amount: payment.amount }),
      '',
      i18n.callback.clickToPay,
    ].join('\n');

    // Send payment link with inline button
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: i18n.callback.payNow,
              url: payment.confirmationUrl,
            },
          ],
        ],
      },
    });

    // Edit original message to show processing started
    const emptyMarkup: InlineKeyboardMarkup = { inline_keyboard: [] };
    await ctx.editMessageReplyMarkup({ reply_markup: emptyMarkup });
  } catch (error) {
    await ctx.reply(i18n.callback.paymentCreationFailed);
  }
}

/**
 * Handle product card callback
 */
async function handleProductCardCallback(
  ctx: CallbackQueryContext<BotContext>,
  data: string
): Promise<void> {
  const i18n = ctx.i18n;
  await ctx.answerCallbackQuery();

  if (!ctx.productCardHandler) {
    await ctx.reply(i18n.productCard.handlerNotAvailable);
    return;
  }

  // Mode selection
  if (data === 'pc_mode_clean') {
    await ctx.productCardHandler.handleModeSelection(ctx, ProductCardMode.CLEAN);
    return;
  }
  if (data === 'pc_mode_infographics') {
    await ctx.productCardHandler.handleModeSelection(ctx, ProductCardMode.INFOGRAPHICS);
    return;
  }

  // Option selection
  if (data === 'pc_opt_background') {
    await ctx.productCardHandler.handleOptions(ctx, 'background');
    return;
  }
  if (data === 'pc_opt_pose') {
    await ctx.productCardHandler.handleOptions(ctx, 'pose');
    return;
  }
  if (data === 'pc_opt_text') {
    await ctx.productCardHandler.handleOptions(ctx, 'text');
    return;
  }

  // Generate
  if (data === 'pc_generate') {
    await ctx.productCardHandler.handleGenerate(ctx);
    return;
  }

  // Generate more
  if (data.startsWith('pc_more_')) {
    const generationId = data.replace('pc_more_', '');
    await ctx.productCardHandler.handleGenerateMore(ctx, generationId);
    return;
  }

  // Edit
  if (data.startsWith('pc_edit_')) {
    const generationId = data.replace('pc_edit_', '');
    await ctx.productCardHandler.handleEdit(ctx, generationId);
    return;
  }

  // Edit options
  if (data === 'pc_edit_opt_background') {
    await ctx.productCardHandler.handleOptions(ctx, 'background');
    return;
  }
  if (data === 'pc_edit_opt_pose') {
    await ctx.productCardHandler.handleOptions(ctx, 'pose');
    return;
  }
  if (data === 'pc_edit_opt_text') {
    await ctx.productCardHandler.handleOptions(ctx, 'text');
    return;
  }

  // Apply edit
  if (data === 'pc_edit_apply') {
    await ctx.productCardHandler.handleEditApply(ctx);
    return;
  }
}
