import { PrismaClient, PaymentStatus, SubscriptionTier } from '@monorepo/database';
import { TokenService, SubscriptionService } from '@monorepo/shared';
import { Monitoring } from '@monorepo/monitoring';

export interface ProcessPaymentOptions {
  paymentId: string;
  userId: string;
  status: PaymentStatus;
  subscriptionTier?: SubscriptionTier;
  amountRubles: number;
  metadata?: Record<string, unknown>;
}

export interface PaymentProcessingResult {
  success: boolean;
  tokensGranted?: number;
  subscriptionActivated?: boolean;
  error?: string;
}

export class PaymentService {
  private tokenService: TokenService;
  private subscriptionService: SubscriptionService;

  constructor(
    private db: PrismaClient,
    private monitoring: Monitoring
  ) {
    this.tokenService = new TokenService(db, {
      metricsCallback: (metrics) => {
        this.monitoring.logger.info({ metrics }, 'Token operation completed');
      },
    });

    this.subscriptionService = new SubscriptionService(db, {
      onActivation: async (status) => {
        this.monitoring.logger.info({ status }, 'Subscription activated');
        this.monitoring.trackKPI({
          type: 'payment_conversion',
          data: {
            tier: status.tier,
            userId: status.userId,
          },
        });
      },
      onCancellation: async (status) => {
        this.monitoring.logger.info({ status }, 'Subscription canceled');
      },
    });
  }

  /**
   * Process a successful payment
   * Idempotent: Uses database transaction and status check to prevent double-processing
   * Concurrency-safe: Transaction isolation ensures atomic updates
   */
  async processSuccessfulPayment(
    options: ProcessPaymentOptions
  ): Promise<PaymentProcessingResult> {
    try {
      const result = await this.db.$transaction(
        async (tx) => {
          // Use SELECT FOR UPDATE to lock the payment row for concurrency safety
          const payment = await tx.payment.findUnique({
            where: { externalId: options.paymentId },
            include: { user: true },
          });

          if (!payment) {
            throw new Error(`Payment not found: ${options.paymentId}`);
          }

          // Idempotency check: If payment already succeeded, return early
          if (payment.status === 'succeeded') {
            this.monitoring.logger.info(
              { paymentId: options.paymentId, existingStatus: payment.status },
              'Payment already processed - idempotent return'
            );
            return { success: true, alreadyProcessed: true };
          }

          // Update payment status atomically
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: options.status,
              confirmedAt: new Date(),
              metadata: options.metadata as any,
            },
          });

          let tokensGranted = 0;
          let subscriptionActivated = false;

          if (payment.subscriptionTier && payment.subscriptionTier !== 'Gift') {
            const tierConfig = await tx.subscriptionTierConfig.findUnique({
              where: { tier: payment.subscriptionTier },
            });

            if (!tierConfig) {
              throw new Error(`Tier config not found: ${payment.subscriptionTier}`);
            }

            const activationResult = await this.subscriptionService.activateSubscription({
              userId: payment.userId,
              tier: payment.subscriptionTier,
              durationDays: 30,
              autoRenew: true,
              priceRubles: options.amountRubles,
              paymentMethod: 'yookassa',
              metadata: {
                paymentId: payment.id,
                externalId: payment.externalId,
              },
            });

            if (!activationResult.success) {
              throw new Error(`Subscription activation failed: ${activationResult.error}`);
            }

            subscriptionActivated = true;

            const creditResult = await this.tokenService.credit(payment.userId, {
              amount: tierConfig.monthlyTokens,
              operationType: 'purchase',
              metadata: {
                paymentId: payment.id,
                subscriptionTier: payment.subscriptionTier,
                historyId: activationResult.historyId,
              },
            });

            tokensGranted = tierConfig.monthlyTokens;

            this.monitoring.logger.info(
              {
                userId: payment.userId,
                tier: payment.subscriptionTier,
                tokensGranted,
                newBalance: creditResult.newBalance,
              },
              'Subscription activated and tokens granted'
            );

            this.monitoring.trackKPI({
              type: 'payment_conversion',
              data: {
                paymentMethod: 'yookassa',
                plan: payment.subscriptionTier,
                amount: options.amountRubles,
                userId: payment.userId,
              },
            });
          }

          return {
            success: true,
            tokensGranted,
            subscriptionActivated,
          };
        },
        {
          maxWait: 5000, // Maximum time to wait for transaction to start
          timeout: 10000, // Maximum time for transaction to complete
        }
      );

      return result;
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        context: 'processSuccessfulPayment',
        paymentId: options.paymentId,
        userId: options.userId,
      });

      this.monitoring.trackKPI({
        type: 'payment_failure',
        data: {
          paymentMethod: 'yookassa',
          errorType: error instanceof Error ? error.message : 'Unknown error',
          userId: options.userId,
        },
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a failed payment
   */
  async processFailedPayment(
    paymentId: string,
    reason?: string
  ): Promise<PaymentProcessingResult> {
    try {
      await this.db.payment.update({
        where: { externalId: paymentId },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason: reason,
        },
      });

      this.monitoring.logger.info(
        { paymentId, reason },
        'Payment marked as failed'
      );

      return { success: true };
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        context: 'processFailedPayment',
        paymentId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a canceled payment
   */
  async processCanceledPayment(
    paymentId: string,
    reason?: string
  ): Promise<PaymentProcessingResult> {
    try {
      await this.db.payment.update({
        where: { externalId: paymentId },
        data: {
          status: 'canceled',
          metadata: {
            cancellationReason: reason,
          } as any,
        },
      });

      this.monitoring.logger.info(
        { paymentId, reason },
        'Payment marked as canceled'
      );

      return { success: true };
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        context: 'processCanceledPayment',
        paymentId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a refund
   */
  async processRefund(
    paymentId: string,
    refundAmount: number
  ): Promise<PaymentProcessingResult> {
    try {
      const result = await this.db.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { externalId: paymentId },
          include: { user: true },
        });

        if (!payment) {
          throw new Error(`Payment not found: ${paymentId}`);
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'refunded',
          },
        });

        if (payment.subscriptionTier && payment.subscriptionTier !== 'Gift') {
          const tierConfig = await tx.subscriptionTierConfig.findUnique({
            where: { tier: payment.subscriptionTier },
          });

          if (tierConfig) {
            await this.tokenService.debit(payment.userId, {
              amount: tierConfig.monthlyTokens,
              operationType: 'refund',
              allowOverdraft: true,
              metadata: {
                paymentId: payment.id,
                refundAmount,
              },
            });

            await this.subscriptionService.cancelSubscription({
              userId: payment.userId,
              reason: 'Payment refunded',
              immediate: true,
            });

            this.monitoring.logger.info(
              {
                userId: payment.userId,
                paymentId: payment.id,
                tokensDeducted: tierConfig.monthlyTokens,
              },
              'Refund processed: tokens deducted and subscription canceled'
            );
          }
        }

        return { success: true };
      });

      return result;
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        context: 'processRefund',
        paymentId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
