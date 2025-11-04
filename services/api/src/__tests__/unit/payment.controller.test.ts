import { PaymentController } from '../../controllers/payment.controller';
import { FastifyRequest, FastifyReply } from 'fastify';

describe('PaymentController', () => {
  describe('createPaymentSession', () => {
    it('should create a payment session successfully', async () => {
      const mockTierConfig = {
        tier: 'Professional',
        monthlyTokens: 2000,
        priceRubles: 1990,
        isActive: true,
        description: 'Professional Plan',
      };

      const mockYooKassaPayment = {
        id: 'yookassa-payment-123',
        status: 'pending',
        confirmation: {
          type: 'redirect',
          confirmation_url: 'https://yookassa.ru/checkout/123',
        },
        expires_at: '2024-01-01T12:00:00Z',
      };

      const mockPayment = {
        id: 'payment-uuid-123',
        userId: 'user-uuid-123',
        provider: 'yookassa',
        status: 'pending',
        amountRubles: 1990,
        currency: 'RUB',
        externalId: 'yookassa-payment-123',
        subscriptionTier: 'Professional',
      };

      const mockDb = {
        subscriptionTierConfig: {
          findUnique: jest.fn().mockResolvedValue(mockTierConfig),
        },
        payment: {
          create: jest.fn().mockResolvedValue(mockPayment),
        },
      };

      const mockYooKassaClient = {
        createPayment: jest.fn().mockResolvedValue(mockYooKassaPayment),
      };

      const mockMonitoring = {
        logger: {
          info: jest.fn(),
        },
        handleError: jest.fn(),
      };

      const request = {
        body: {
          subscriptionTier: 'Professional',
          returnUrl: 'https://example.com/success',
        },
        user: {
          userId: 'user-uuid-123',
          telegramId: 123456,
          username: 'testuser',
          tier: 'Gift',
        },
        server: {
          db: mockDb,
          yookassaClient: mockYooKassaClient,
          monitoring: mockMonitoring,
        },
      } as unknown as FastifyRequest;

      const reply = {} as FastifyReply;

      const result = await PaymentController.createPaymentSession(request, reply);

      expect(result).toEqual({
        paymentId: 'payment-uuid-123',
        confirmationUrl: 'https://yookassa.ru/checkout/123',
        externalId: 'yookassa-payment-123',
        amount: 1990,
        currency: 'RUB',
        status: 'pending',
        expiresAt: '2024-01-01T12:00:00Z',
      });

      expect(mockDb.subscriptionTierConfig.findUnique).toHaveBeenCalledWith({
        where: { tier: 'Professional' },
      });

      expect(mockYooKassaClient.createPayment).toHaveBeenCalled();
      expect(mockDb.payment.create).toHaveBeenCalled();
      expect(mockMonitoring.logger.info).toHaveBeenCalled();
    });

    it('should return 404 if tier not found', async () => {
      const mockDb = {
        subscriptionTierConfig: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      const mockMonitoring = {
        logger: { info: jest.fn() },
        handleError: jest.fn(),
      };

      const request = {
        body: {
          subscriptionTier: 'NonExistent',
        },
        user: {
          userId: 'user-uuid-123',
        },
        server: {
          db: mockDb,
          yookassaClient: {},
          monitoring: mockMonitoring,
        },
      } as unknown as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as FastifyReply;

      await PaymentController.createPaymentSession(request, reply);

      expect(reply.code).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Subscription tier not found: NonExistent',
        statusCode: 404,
      });
    });

    it('should return 503 if payment provider not configured', async () => {
      const request = {
        body: {
          subscriptionTier: 'Professional',
        },
        user: {
          userId: 'user-uuid-123',
        },
        server: {
          db: {},
          yookassaClient: null,
          monitoring: { logger: { info: jest.fn() } },
        },
      } as unknown as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as FastifyReply;

      await PaymentController.createPaymentSession(request, reply);

      expect(reply.code).toHaveBeenCalledWith(503);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: 'Payment provider not configured',
        statusCode: 503,
      });
    });
  });

  describe('listPayments', () => {
    it('should list user payments with pagination', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          externalId: 'ext-1',
          provider: 'yookassa',
          status: 'succeeded',
          amountRubles: 1990,
          currency: 'RUB',
          description: 'Professional Plan',
          subscriptionTier: 'Professional',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          confirmedAt: new Date('2024-01-01'),
          failedAt: null,
          failureReason: null,
          metadata: null,
        },
      ];

      const mockDb = {
        payment: {
          findMany: jest.fn().mockResolvedValue(mockPayments),
          count: jest.fn().mockResolvedValue(1),
        },
      };

      const mockMonitoring = {
        logger: { info: jest.fn() },
        handleError: jest.fn(),
      };

      const request = {
        query: {
          limit: 20,
          offset: 0,
        },
        user: {
          userId: 'user-uuid-123',
        },
        server: {
          db: mockDb,
          monitoring: mockMonitoring,
        },
      } as unknown as FastifyRequest;

      const reply = {} as FastifyReply;

      const result = await PaymentController.listPayments(request, reply);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(mockDb.payment.findMany).toHaveBeenCalled();
      expect(mockDb.payment.count).toHaveBeenCalled();
    });

    it('should filter payments by status', async () => {
      const mockDb = {
        payment: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };

      const mockMonitoring = {
        logger: { info: jest.fn() },
        handleError: jest.fn(),
      };

      const request = {
        query: {
          limit: 20,
          offset: 0,
          status: 'succeeded',
        },
        user: {
          userId: 'user-uuid-123',
        },
        server: {
          db: mockDb,
          monitoring: mockMonitoring,
        },
      } as unknown as FastifyRequest;

      const reply = {} as FastifyReply;

      await PaymentController.listPayments(request, reply);

      expect(mockDb.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-uuid-123',
            status: 'succeeded',
          },
        })
      );
    });
  });

  describe('getPayment', () => {
    it('should get a specific payment', async () => {
      const mockPayment = {
        id: 'payment-1',
        externalId: 'ext-1',
        provider: 'yookassa',
        status: 'succeeded',
        amountRubles: 1990,
        currency: 'RUB',
        description: 'Professional Plan',
        subscriptionTier: 'Professional',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        confirmedAt: new Date('2024-01-01'),
        failedAt: null,
        failureReason: null,
        metadata: null,
      };

      const mockDb = {
        payment: {
          findFirst: jest.fn().mockResolvedValue(mockPayment),
        },
      };

      const mockMonitoring = {
        logger: { info: jest.fn() },
        handleError: jest.fn(),
      };

      const request = {
        params: {
          id: 'payment-1',
        },
        user: {
          userId: 'user-uuid-123',
        },
        server: {
          db: mockDb,
          monitoring: mockMonitoring,
        },
      } as unknown as FastifyRequest;

      const reply = {} as FastifyReply;

      const result = await PaymentController.getPayment(request, reply);

      expect(result.id).toBe('payment-1');
      expect(result.status).toBe('succeeded');
      expect(mockDb.payment.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'payment-1',
          userId: 'user-uuid-123',
        },
      });
    });

    it('should return 404 if payment not found', async () => {
      const mockDb = {
        payment: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      const mockMonitoring = {
        logger: { info: jest.fn() },
        handleError: jest.fn(),
      };

      const request = {
        params: {
          id: 'payment-1',
        },
        user: {
          userId: 'user-uuid-123',
        },
        server: {
          db: mockDb,
          monitoring: mockMonitoring,
        },
      } as unknown as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as FastifyReply;

      await PaymentController.getPayment(request, reply);

      expect(reply.code).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Payment not found',
        statusCode: 404,
      });
    });
  });
});
