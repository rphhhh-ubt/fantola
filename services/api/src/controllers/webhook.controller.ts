import { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from '../services/payment.service';
import { yookassaWebhookNotificationSchema, YooKassaWebhookNotification } from '../schemas/webhook.schema';

export class WebhookController {
  /**
   * Handle YooKassa webhook notifications
   */
  static async handleYooKassaWebhook(
    request: FastifyRequest<{
      Body: YooKassaWebhookNotification;
    }>,
    reply: FastifyReply
  ) {
    const { monitoring, yookassaClient, paymentService } = request.server as any;

    try {
      const signature = request.headers['x-yookassa-signature'] as string;

      if (!signature) {
        request.log.warn('Missing YooKassa signature header');
        return reply.code(400).send({
          success: false,
          message: 'Missing signature header',
        });
      }

      const isValid = yookassaClient.validateWebhookSignature(request.body, signature);

      if (!isValid) {
        request.log.warn(
          { event: request.body.event },
          'Invalid YooKassa webhook signature'
        );
        return reply.code(401).send({
          success: false,
          message: 'Invalid signature',
        });
      }

      const notification = yookassaWebhookNotificationSchema.parse(request.body);

      request.log.info(
        {
          event: notification.event,
          objectId: notification.object.id,
        },
        'Processing YooKassa webhook'
      );

      switch (notification.event) {
        case 'payment.succeeded':
          await WebhookController.handlePaymentSucceeded(
            notification,
            paymentService,
            request.log
          );
          break;

        case 'payment.canceled':
          await WebhookController.handlePaymentCanceled(
            notification,
            paymentService,
            request.log
          );
          break;

        case 'refund.succeeded':
          await WebhookController.handleRefundSucceeded(
            notification,
            paymentService,
            request.log
          );
          break;

        default:
          request.log.warn(
            { event: notification.event },
            'Unknown webhook event'
          );
      }

      return reply.code(200).send({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      request.log.error(
        { error, body: request.body },
        'Failed to process YooKassa webhook'
      );

      monitoring.handleError(error as Error, {
        context: 'handleYooKassaWebhook',
        body: request.body,
      });

      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Handle payment.succeeded event
   * Idempotent: Multiple calls with same payment ID will only process once
   */
  private static async handlePaymentSucceeded(
    notification: YooKassaWebhookNotification,
    paymentService: PaymentService,
    logger: any
  ) {
    const payment = notification.object as any;

    const userId = payment.metadata?.userId as string;

    if (!userId) {
      logger.warn(
        { paymentId: payment.id },
        'Payment metadata missing userId'
      );
      return;
    }

    // Idempotency is handled in processSuccessfulPayment via transaction
    // It checks if payment is already succeeded and returns early
    const result = await paymentService.processSuccessfulPayment({
      paymentId: payment.id,
      userId,
      status: 'succeeded',
      subscriptionTier: payment.metadata?.subscriptionTier,
      amountRubles: Math.round(parseFloat(payment.amount.value)),
      metadata: {
        paymentMethod: payment.payment_method?.type,
        capturedAt: payment.captured_at,
        webhookProcessedAt: new Date().toISOString(),
      },
    });

    if (result.success) {
      logger.info(
        {
          paymentId: payment.id,
          userId,
          tokensGranted: result.tokensGranted,
          subscriptionActivated: result.subscriptionActivated,
          alreadyProcessed: (result as any).alreadyProcessed || false,
        },
        'Payment succeeded webhook processed'
      );
    } else {
      logger.error(
        { paymentId: payment.id, error: result.error },
        'Failed to process payment succeeded webhook'
      );
    }
  }

  /**
   * Handle payment.canceled event
   */
  private static async handlePaymentCanceled(
    notification: YooKassaWebhookNotification,
    paymentService: PaymentService,
    logger: any
  ) {
    const payment = notification.object as any;

    const result = await paymentService.processCanceledPayment(
      payment.id,
      payment.cancellation_details?.reason
    );

    if (result.success) {
      logger.info(
        { paymentId: payment.id },
        'Payment canceled webhook processed'
      );
    } else {
      logger.error(
        { paymentId: payment.id, error: result.error },
        'Failed to process payment canceled webhook'
      );
    }
  }

  /**
   * Handle refund.succeeded event
   */
  private static async handleRefundSucceeded(
    notification: YooKassaWebhookNotification,
    paymentService: PaymentService,
    logger: any
  ) {
    const refund = notification.object as any;

    const result = await paymentService.processRefund(
      refund.payment_id,
      parseFloat(refund.amount.value)
    );

    if (result.success) {
      logger.info(
        { refundId: refund.id, paymentId: refund.payment_id },
        'Refund succeeded webhook processed'
      );
    } else {
      logger.error(
        { refundId: refund.id, error: result.error },
        'Failed to process refund succeeded webhook'
      );
    }
  }
}
