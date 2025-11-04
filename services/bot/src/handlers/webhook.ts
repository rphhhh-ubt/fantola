import { Bot } from 'grammy';
import crypto from 'crypto';
import { BotContext } from '../types';
import { PaymentService } from '../services/payment-service';
import { Monitoring } from '@monorepo/monitoring';
import { SubscriptionTier } from '@monorepo/database';

/**
 * YooKassa webhook notification
 */
export interface YooKassaWebhookNotification {
  type: string;
  event: string;
  object: {
    id: string;
    status: string;
    paid: boolean;
    amount: {
      value: string;
      currency: string;
    };
    metadata: {
      userId: string;
      paymentId: string;
      telegramId: number;
      tier: SubscriptionTier;
    };
  };
}

/**
 * Verify YooKassa webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return hash === signature;
}

/**
 * Handle YooKassa webhook notification
 */
export async function handleYooKassaWebhook(
  notification: YooKassaWebhookNotification,
  paymentService: PaymentService,
  bot: Bot<BotContext>,
  monitoring: Monitoring
): Promise<void> {
  try {
    const { type, event, object: payment } = notification;

    monitoring.logger.info(
      {
        type,
        event,
        paymentId: payment.id,
        status: payment.status,
      },
      'Received YooKassa webhook'
    );

    // Handle payment.succeeded event
    if (event === 'payment.succeeded' && payment.paid) {
      const confirmationResult = await paymentService.confirmPayment(payment.id);

      // Send success notification to user
      await sendPaymentSuccessNotification(
        bot,
        parseInt(payment.metadata.telegramId.toString()),
        confirmationResult.tier,
        confirmationResult.tokensAwarded,
        confirmationResult.subscriptionExpiresAt,
        monitoring
      );
    }
    // Handle payment.canceled event
    else if (event === 'payment.canceled') {
      await paymentService.cancelPayment(payment.id);

      // Send cancellation notification to user
      await sendPaymentCanceledNotification(
        bot,
        parseInt(payment.metadata.telegramId.toString()),
        monitoring
      );
    }
    // Handle payment.waiting_for_capture event (auto-capture is enabled, so this shouldn't happen)
    else if (event === 'payment.waiting_for_capture') {
      monitoring.logger.warn(
        { paymentId: payment.id },
        'Payment waiting for capture (unexpected with auto-capture enabled)'
      );
    }
  } catch (error) {
    monitoring.handleError(error as Error, {
      operation: 'handleYooKassaWebhook',
      notification,
    });

    // Send error notification to user if possible
    if (notification.object.metadata?.telegramId) {
      try {
        await sendPaymentErrorNotification(
          bot,
          parseInt(notification.object.metadata.telegramId.toString()),
          monitoring
        );
      } catch (notificationError) {
        monitoring.logger.error(
          { error: notificationError },
          'Failed to send error notification'
        );
      }
    }

    throw error;
  }
}

/**
 * Send payment success notification to user
 */
async function sendPaymentSuccessNotification(
  bot: Bot<BotContext>,
  telegramId: number,
  tier: SubscriptionTier,
  tokensAwarded: number,
  expiresAt: Date,
  monitoring: Monitoring
): Promise<void> {
  try {
    const expiryDate = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const message = [
      '✅ *Payment Successful!*',
      '',
      `🎉 Your *${tier}* subscription has been activated!`,
      '',
      `💎 *${tokensAwarded}* tokens have been added to your balance.`,
      `📅 Expires on: *${expiryDate}*`,
      '',
      '👉 Start using your subscription with /start',
    ].join('\n');

    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'Markdown',
    });

    monitoring.logger.info(
      { telegramId, tier, tokensAwarded },
      'Sent payment success notification'
    );
  } catch (error) {
    monitoring.handleError(error as Error, {
      operation: 'sendPaymentSuccessNotification',
      telegramId,
    });
  }
}

/**
 * Send payment canceled notification to user
 */
async function sendPaymentCanceledNotification(
  bot: Bot<BotContext>,
  telegramId: number,
  monitoring: Monitoring
): Promise<void> {
  try {
    const message = [
      '❌ *Payment Canceled*',
      '',
      'Your payment has been canceled.',
      '',
      '💡 You can try again anytime with /subscription',
    ].join('\n');

    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'Markdown',
    });

    monitoring.logger.info(
      { telegramId },
      'Sent payment canceled notification'
    );
  } catch (error) {
    monitoring.handleError(error as Error, {
      operation: 'sendPaymentCanceledNotification',
      telegramId,
    });
  }
}

/**
 * Send payment error notification to user
 */
async function sendPaymentErrorNotification(
  bot: Bot<BotContext>,
  telegramId: number,
  monitoring: Monitoring
): Promise<void> {
  try {
    const message = [
      '❌ *Payment Error*',
      '',
      'There was an error processing your payment.',
      '',
      '💡 Please try again or contact support: /help',
    ].join('\n');

    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'Markdown',
    });

    monitoring.logger.info(
      { telegramId },
      'Sent payment error notification'
    );
  } catch (error) {
    monitoring.handleError(error as Error, {
      operation: 'sendPaymentErrorNotification',
      telegramId,
    });
  }
}
