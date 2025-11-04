import { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionTier, PaymentProvider } from '@monorepo/database';
import { YooKassaClient } from '@monorepo/shared';
import {
  CreatePaymentSessionRequest,
  CreatePaymentSessionResponse,
  ListPaymentsQuery,
  ListPaymentsResponse,
  GetPaymentResponse,
  PaymentItem,
} from '../schemas/payment.schema';

interface JWTPayload {
  userId: string;
  telegramId: number;
  username?: string;
  tier: string;
}

export class PaymentController {
  /**
   * Create a new payment session for subscription purchase
   */
  static async createPaymentSession(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<CreatePaymentSessionResponse> {
    const { subscriptionTier, returnUrl } = request.body as CreatePaymentSessionRequest;
    const payload = request.user as JWTPayload;
    const { db, yookassaClient, monitoring } = request.server as any;

    if (!yookassaClient) {
      return reply.code(503).send({
        error: 'Service Unavailable',
        message: 'Payment provider not configured',
        statusCode: 503,
      });
    }

    try {
      // Get tier configuration
      const tierConfig = await db.subscriptionTierConfig.findUnique({
        where: { tier: subscriptionTier },
      });

      if (!tierConfig) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Subscription tier not found: ${subscriptionTier}`,
          statusCode: 404,
        });
      }

      if (!tierConfig.isActive) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Subscription tier is not available',
          statusCode: 400,
        });
      }

      if (!tierConfig.priceRubles || tierConfig.priceRubles <= 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'This subscription tier is not available for purchase',
          statusCode: 400,
        });
      }

      // Create payment in database first
      const idempotenceKey = `payment_${payload.userId}_${subscriptionTier}_${Date.now()}`;

      // Create YooKassa payment
      const yookassaPayment = await (yookassaClient as YooKassaClient).createPayment(
        {
          amount: {
            value: tierConfig.priceRubles.toFixed(2),
            currency: 'RUB',
          },
          capture: true,
          confirmation: {
            type: 'redirect',
            return_url: returnUrl || `${process.env.API_BASE_URL}/payments/success`,
          },
          description: `Subscription: ${tierConfig.description}`,
          metadata: {
            userId: payload.userId,
            subscriptionTier,
            tier: subscriptionTier,
          },
        },
        idempotenceKey
      );

      // Store payment in database
      const payment = await db.payment.create({
        data: {
          userId: payload.userId,
          provider: PaymentProvider.yookassa,
          status: 'pending',
          amountRubles: tierConfig.priceRubles,
          currency: 'RUB',
          description: `Subscription: ${tierConfig.description}`,
          externalId: yookassaPayment.id,
          subscriptionTier: subscriptionTier as SubscriptionTier,
          metadata: {
            idempotenceKey,
            yookassaStatus: yookassaPayment.status,
            confirmation: yookassaPayment.confirmation,
          },
        },
      });

      monitoring.logger.info(
        {
          paymentId: payment.id,
          externalId: yookassaPayment.id,
          userId: payload.userId,
          tier: subscriptionTier,
          amount: tierConfig.priceRubles,
        },
        'Payment session created'
      );

      return {
        paymentId: payment.id,
        confirmationUrl: yookassaPayment.confirmation?.confirmation_url || '',
        externalId: yookassaPayment.id,
        amount: tierConfig.priceRubles,
        currency: 'RUB',
        status: 'pending',
        expiresAt: yookassaPayment.expires_at,
      };
    } catch (error) {
      monitoring.handleError(error as Error, {
        context: 'createPaymentSession',
        userId: payload.userId,
        subscriptionTier,
      });

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create payment session',
        statusCode: 500,
      });
    }
  }

  /**
   * List user's payment history
   */
  static async listPayments(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ListPaymentsResponse> {
    const { limit = 20, offset = 0, status } = request.query as ListPaymentsQuery;
    const payload = request.user as JWTPayload;
    const { db, monitoring } = request.server as any;

    try {
      const where = {
        userId: payload.userId,
        ...(status && { status }),
      };

      const [payments, total] = await Promise.all([
        db.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.payment.count({ where }),
      ]);

      const items: PaymentItem[] = payments.map((payment: any) => ({
        id: payment.id,
        externalId: payment.externalId,
        provider: payment.provider,
        status: payment.status,
        amountRubles: payment.amountRubles,
        currency: payment.currency,
        description: payment.description,
        subscriptionTier: payment.subscriptionTier,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
        confirmedAt: payment.confirmedAt?.toISOString() || null,
        failedAt: payment.failedAt?.toISOString() || null,
        failureReason: payment.failureReason,
        metadata: payment.metadata || null,
      }));

      monitoring.logger.info(
        { userId: payload.userId, count: items.length, total },
        'Payments listed'
      );

      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      monitoring.handleError(error as Error, {
        context: 'listPayments',
        userId: payload.userId,
      });

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve payments',
        statusCode: 500,
      });
    }
  }

  /**
   * Get a specific payment by ID
   */
  static async getPayment(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<GetPaymentResponse> {
    const { id } = (request.params as { id: string });
    const payload = request.user as JWTPayload;
    const { db, monitoring } = request.server as any;

    try {
      const payment = await db.payment.findFirst({
        where: {
          id,
          userId: payload.userId,
        },
      });

      if (!payment) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Payment not found',
          statusCode: 404,
        });
      }

      return {
        id: payment.id,
        externalId: payment.externalId,
        provider: payment.provider,
        status: payment.status,
        amountRubles: payment.amountRubles,
        currency: payment.currency,
        description: payment.description,
        subscriptionTier: payment.subscriptionTier,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
        confirmedAt: payment.confirmedAt?.toISOString() || null,
        failedAt: payment.failedAt?.toISOString() || null,
        failureReason: payment.failureReason,
        metadata: payment.metadata || null,
      };
    } catch (error) {
      monitoring.handleError(error as Error, {
        context: 'getPayment',
        userId: payload.userId,
        paymentId: id,
      });

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve payment',
        statusCode: 500,
      });
    }
  }
}
