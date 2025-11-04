import { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionService } from '../services/subscription.service';
import {
  activateSubscriptionRequestSchema,
  cancelSubscriptionRequestSchema,
} from '../schemas/subscription.schema';

export class SubscriptionController {
  static async getTierCatalog(request: FastifyRequest, reply: FastifyReply) {
    const subscriptionService = new SubscriptionService(request.server.db);

    try {
      const tiers = await subscriptionService.getTierCatalog();
      return reply.status(200).send({ tiers });
    } catch (error) {
      request.server.log.error({ error }, 'Failed to fetch tier catalog');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch tier catalog',
      });
    }
  }

  static async getSubscriptionStatus(request: FastifyRequest, reply: FastifyReply) {
    const subscriptionService = new SubscriptionService(request.server.db);
    const userId = (request as any).user?.id;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    try {
      const status = await subscriptionService.getSubscriptionStatus(userId);
      return reply.status(200).send({
        ...status,
        expiresAt: status.expiresAt?.toISOString() || null,
      });
    } catch (error) {
      request.server.log.error({ error, userId }, 'Failed to fetch subscription status');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch subscription status',
      });
    }
  }

  static async activateSubscription(request: FastifyRequest, reply: FastifyReply) {
    const subscriptionService = new SubscriptionService(request.server.db);
    const userId = (request as any).user?.id;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    try {
      const data = activateSubscriptionRequestSchema.parse(request.body);

      const result = await subscriptionService.activateSubscription({
        userId,
        tier: data.tier,
        durationDays: data.durationDays,
        autoRenew: data.autoRenew,
        priceRubles: data.priceRubles,
        paymentMethod: data.paymentMethod,
      });

      if (!result.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: result.error || 'Failed to activate subscription',
        });
      }

      return reply.status(200).send({
        success: result.success,
        status: result.status
          ? {
              ...result.status,
              expiresAt: result.status.expiresAt?.toISOString() || null,
            }
          : undefined,
        historyId: result.historyId,
      });
    } catch (error) {
      request.server.log.error({ error, userId }, 'Failed to activate subscription');
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation Error',
          message: error.message,
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to activate subscription',
      });
    }
  }

  static async cancelSubscription(request: FastifyRequest, reply: FastifyReply) {
    const subscriptionService = new SubscriptionService(request.server.db);
    const userId = (request as any).user?.id;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    try {
      const data = cancelSubscriptionRequestSchema.parse(request.body);

      const result = await subscriptionService.cancelSubscription({
        userId,
        reason: data.reason,
        immediate: data.immediate,
      });

      if (!result.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: result.error || 'Failed to cancel subscription',
        });
      }

      return reply.status(200).send({
        success: result.success,
        status: result.status
          ? {
              ...result.status,
              expiresAt: result.status.expiresAt?.toISOString() || null,
            }
          : undefined,
      });
    } catch (error) {
      request.server.log.error({ error, userId }, 'Failed to cancel subscription');
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation Error',
          message: error.message,
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to cancel subscription',
      });
    }
  }

  static async getSubscriptionHistory(request: FastifyRequest, reply: FastifyReply) {
    const subscriptionService = new SubscriptionService(request.server.db);
    const userId = (request as any).user?.id;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    try {
      const history = await subscriptionService.getSubscriptionHistory(userId);
      return reply.status(200).send({
        history: history.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          startedAt: item.startedAt.toISOString(),
          expiresAt: item.expiresAt?.toISOString() || null,
          canceledAt: item.canceledAt?.toISOString() || null,
        })),
      });
    } catch (error) {
      request.server.log.error({ error, userId }, 'Failed to fetch subscription history');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch subscription history',
      });
    }
  }
}
