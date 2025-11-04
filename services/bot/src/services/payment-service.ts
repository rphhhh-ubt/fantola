import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionTier, PaymentStatus, PaymentProvider } from '@monorepo/database';
import { db } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';

/**
 * YooKassa payment configuration
 */
export interface YooKassaConfig {
  shopId: string;
  secretKey: string;
  returnUrl?: string;
}

/**
 * Payment creation result
 */
export interface PaymentCreationResult {
  paymentId: string;
  confirmationUrl: string;
  amount: number;
  tier: SubscriptionTier;
}

/**
 * Payment confirmation result
 */
export interface PaymentConfirmationResult {
  success: boolean;
  userId: string;
  tier: SubscriptionTier;
  tokensAwarded: number;
  subscriptionExpiresAt: Date;
}

/**
 * Tier pricing and token allocation
 */
const TIER_CONFIG = {
  [SubscriptionTier.Gift]: {
    priceRubles: 0,
    tokens: 100,
    durationDays: 30,
  },
  [SubscriptionTier.Professional]: {
    priceRubles: 1990,
    tokens: 2000,
    durationDays: 30,
  },
  [SubscriptionTier.Business]: {
    priceRubles: 3490,
    tokens: 10000,
    durationDays: 30,
  },
};

/**
 * Payment service for handling YooKassa integration
 */
export class PaymentService {
  private config: YooKassaConfig;
  private monitoring: Monitoring;
  private apiUrl = 'https://api.yookassa.ru/v3';

  constructor(config: YooKassaConfig, monitoring: Monitoring) {
    this.config = config;
    this.monitoring = monitoring;
  }

  /**
   * Create payment link for subscription tier
   */
  async createPayment(
    userId: string,
    tier: SubscriptionTier,
    telegramId: number
  ): Promise<PaymentCreationResult> {
    if (tier === SubscriptionTier.Gift) {
      throw new Error('Cannot create payment for Gift tier');
    }

    const tierConfig = TIER_CONFIG[tier];
    const idempotenceKey = uuidv4();

    try {
      // Create payment record in database
      const payment = await db.payment.create({
        data: {
          userId,
          provider: PaymentProvider.yookassa,
          status: PaymentStatus.pending,
          amountRubles: tierConfig.priceRubles,
          currency: 'RUB',
          description: `Subscription: ${tier} tier`,
          externalId: idempotenceKey,
          subscriptionTier: tier,
          metadata: {
            telegramId,
            tier,
            tokens: tierConfig.tokens,
            durationDays: tierConfig.durationDays,
          },
        },
      });

      // Create payment in YooKassa
      const response = await axios.post(
        `${this.apiUrl}/payments`,
        {
          amount: {
            value: tierConfig.priceRubles.toFixed(2),
            currency: 'RUB',
          },
          confirmation: {
            type: 'redirect',
            return_url: this.config.returnUrl || 'https://t.me/your_bot',
          },
          capture: true,
          description: `Subscription: ${tier} tier`,
          metadata: {
            userId,
            paymentId: payment.id,
            telegramId,
            tier,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Idempotence-Key': idempotenceKey,
          },
          auth: {
            username: this.config.shopId,
            password: this.config.secretKey,
          },
        }
      );

      const yookassaPaymentId = response.data.id;
      const confirmationUrl = response.data.confirmation.confirmation_url;

      // Update payment with YooKassa ID
      await db.payment.update({
        where: { id: payment.id },
        data: {
          externalId: yookassaPaymentId,
          metadata: {
            ...(payment.metadata as object),
            yookassaId: yookassaPaymentId,
            confirmationUrl,
          },
        },
      });

      this.monitoring.logger.info(
        {
          userId,
          tier,
          paymentId: payment.id,
          yookassaPaymentId,
        },
        'Payment created successfully'
      );

      return {
        paymentId: payment.id,
        confirmationUrl,
        amount: tierConfig.priceRubles,
        tier,
      };
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        operation: 'createPayment',
        userId,
        tier,
      });
      throw new Error('Failed to create payment');
    }
  }

  /**
   * Confirm payment and update user subscription
   */
  async confirmPayment(externalId: string): Promise<PaymentConfirmationResult> {
    try {
      // Find payment by YooKassa ID
      const payment = await db.payment.findUnique({
        where: { externalId },
        include: { user: true },
      });

      if (!payment) {
        throw new Error(`Payment not found: ${externalId}`);
      }

      if (payment.status === PaymentStatus.succeeded) {
        this.monitoring.logger.warn(
          { paymentId: payment.id },
          'Payment already confirmed'
        );
        return this.buildConfirmationResult(payment);
      }

      const tier = payment.subscriptionTier! as SubscriptionTier;
      const tierConfig = TIER_CONFIG[tier];
      const now = new Date();
      const expiresAt = new Date(now.getTime() + tierConfig.durationDays * 24 * 60 * 60 * 1000);

      // Update payment, user subscription, and award tokens in a transaction
      await db.$transaction(async (tx: any) => {
        // Update payment status
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.succeeded,
            confirmedAt: now,
          },
        });

        // Update user subscription and tokens
        await tx.user.update({
          where: { id: payment.userId },
          data: {
            tier,
            subscriptionExpiresAt: expiresAt,
            tokensBalance: { increment: tierConfig.tokens },
          },
        });

        // Create subscription history record
        await tx.subscriptionHistory.create({
          data: {
            userId: payment.userId,
            tier,
            priceRubles: payment.amountRubles,
            paymentMethod: 'yookassa',
            startedAt: now,
            expiresAt,
            metadata: {
              paymentId: payment.id,
              yookassaId: externalId,
            },
          },
        });

        // Create token operation record
        await tx.tokenOperation.create({
          data: {
            userId: payment.userId,
            operationType: 'purchase',
            tokensAmount: tierConfig.tokens,
            balanceBefore: payment.user.tokensBalance,
            balanceAfter: payment.user.tokensBalance + tierConfig.tokens,
            metadata: {
              paymentId: payment.id,
              tier,
              source: 'subscription_purchase',
            },
          },
        });
      });

      this.monitoring.logger.info(
        {
          paymentId: payment.id,
          userId: payment.userId,
          tier,
          tokens: tierConfig.tokens,
        },
        'Payment confirmed and subscription activated'
      );

      this.monitoring.trackKPI({
        type: 'payment_conversion',
        data: {
          paymentMethod: 'yookassa',
          plan: tier,
          amount: payment.amountRubles,
        },
      });

      return {
        success: true,
        userId: payment.userId,
        tier,
        tokensAwarded: tierConfig.tokens,
        subscriptionExpiresAt: expiresAt,
      };
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        operation: 'confirmPayment',
        externalId,
      });

      // Try to mark payment as failed
      try {
        await db.payment.update({
          where: { externalId },
          data: {
            status: PaymentStatus.failed,
            failedAt: new Date(),
            failureReason: (error as Error).message,
          },
        });
      } catch (updateError) {
        // Ignore update error
      }

      throw new Error('Failed to confirm payment');
    }
  }

  /**
   * Get payment status from YooKassa
   */
  async getPaymentStatus(externalId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.apiUrl}/payments/${externalId}`, {
        auth: {
          username: this.config.shopId,
          password: this.config.secretKey,
        },
      });

      return response.data.status;
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        operation: 'getPaymentStatus',
        externalId,
      });
      throw new Error('Failed to get payment status');
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(externalId: string): Promise<void> {
    try {
      const payment = await db.payment.findUnique({
        where: { externalId },
      });

      if (!payment) {
        throw new Error(`Payment not found: ${externalId}`);
      }

      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.canceled,
          failedAt: new Date(),
        },
      });

      this.monitoring.logger.info(
        { paymentId: payment.id },
        'Payment canceled'
      );
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        operation: 'cancelPayment',
        externalId,
      });
      throw new Error('Failed to cancel payment');
    }
  }

  /**
   * Build confirmation result from payment
   */
  private buildConfirmationResult(payment: any): PaymentConfirmationResult {
    const tier = payment.subscriptionTier! as SubscriptionTier;
    const tierConfig = TIER_CONFIG[tier];

    return {
      success: true,
      userId: payment.userId,
      tier,
      tokensAwarded: tierConfig.tokens,
      subscriptionExpiresAt: payment.user.subscriptionExpiresAt,
    };
  }
}
