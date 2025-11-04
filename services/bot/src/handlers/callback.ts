import { CallbackQueryContext } from 'grammy';
import { BotContext } from '../types';
import { PaymentService } from '../services/payment-service';
import { SubscriptionTier } from '@monorepo/database';

/**
 * Handle callback queries from inline keyboards
 */
export async function handleCallbackQuery(
  ctx: CallbackQueryContext<BotContext>,
  paymentService: PaymentService
): Promise<void> {
  const data = ctx.callbackQuery.data;

  if (!data) {
    await ctx.answerCallbackQuery('Invalid callback data');
    return;
  }

  // Handle tier purchase callbacks
  if (data.startsWith('buy_tier:')) {
    const tier = data.split(':')[1] as SubscriptionTier;
    await handleTierPurchase(ctx, tier, paymentService);
    return;
  }

  // Unknown callback
  await ctx.answerCallbackQuery('Unknown action');
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
    await ctx.answerCallbackQuery('Gift tier is free and cannot be purchased');
    return;
  }

  // Check if user already has this tier
  if (user.tier === tier) {
    const expiresAt = user.subscriptionExpiresAt;
    if (expiresAt && new Date(expiresAt) > new Date()) {
      await ctx.answerCallbackQuery(`You already have an active ${tier} subscription`);
      return;
    }
  }

  try {
    // Answer callback query immediately
    await ctx.answerCallbackQuery(i18n.common.loading);

    // Create payment link
    const telegramId = parseInt(user.telegramId);
    const payment = await paymentService.createPayment(user.id, tier, telegramId);

    const tierNames = {
      [SubscriptionTier.Professional]: i18n.language === 'ru' ? 'Professional' : 'Professional',
      [SubscriptionTier.Business]: i18n.language === 'ru' ? 'Business' : 'Business',
      [SubscriptionTier.Gift]: i18n.language === 'ru' ? 'Gift' : 'Gift',
    };

    const tierDescriptions = {
      [SubscriptionTier.Professional]: i18n.language === 'ru' 
        ? '2000 токенов/месяц, приоритетная поддержка' 
        : '2000 tokens/month, priority support',
      [SubscriptionTier.Business]: i18n.language === 'ru'
        ? '10000 токенов/месяц, премиум поддержка'
        : '10000 tokens/month, premium support',
      [SubscriptionTier.Gift]: '',
    };

    const message = [
      i18n.language === 'ru' ? '💳 *Оплата подписки*' : '💳 *Subscription Payment*',
      '',
      i18n.language === 'ru' ? `План: *${tierNames[tier]}*` : `Plan: *${tierNames[tier]}*`,
      tierDescriptions[tier],
      '',
      i18n.language === 'ru' ? `💰 Стоимость: *${payment.amount}₽*` : `💰 Amount: *${payment.amount}₽*`,
      '',
      i18n.language === 'ru' 
        ? '👉 Нажмите кнопку ниже для оплаты:' 
        : '👉 Click the button below to proceed with payment:',
    ].join('\n');

    // Send payment link with inline button
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: i18n.language === 'ru' ? '💳 Оплатить' : '💳 Pay Now',
              url: payment.confirmationUrl,
            },
          ],
        ],
      },
    });

    // Edit original message to show processing started
    await ctx.api.editMessageReplyMarkup(
      ctx.chat!.id,
      ctx.callbackQuery.message!.message_id,
      { reply_markup: { inline_keyboard: [] } }
    );
  } catch (error) {
    const i18n = ctx.i18n;
    await ctx.reply(
      i18n.language === 'ru'
        ? '❌ Ошибка при создании платежа. Пожалуйста, попробуйте позже.'
        : '❌ Failed to create payment. Please try again later.'
    );
  }
}
