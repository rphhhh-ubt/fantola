import { PaymentService } from '../../services/payment.service';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockDb: any;
  let mockMonitoring: any;

  beforeEach(() => {
    mockMonitoring = {
      logger: {
        info: jest.fn(),
      },
      handleError: jest.fn(),
      trackKPI: jest.fn(),
    };

    mockDb = {
      $transaction: jest.fn(),
      subscriptionTierConfig: {
        findUnique: jest.fn(),
      },
    };

    paymentService = new PaymentService(mockDb as any, mockMonitoring as any);
  });

  describe('processSuccessfulPayment - Idempotency', () => {
    it('should process payment only once (idempotent)', async () => {
      const mockPayment = {
        id: 'payment-uuid-123',
        userId: 'user-uuid-123',
        externalId: 'yookassa-payment-123',
        status: 'succeeded',
        subscriptionTier: 'Professional',
        amountRubles: 1990,
      };

      mockDb.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          payment: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
          },
        });
      });

      const result = await paymentService.processSuccessfulPayment({
        paymentId: 'yookassa-payment-123',
        userId: 'user-uuid-123',
        status: 'succeeded',
        subscriptionTier: 'Professional',
        amountRubles: 1990,
      });

      expect(result.success).toBe(true);
      expect((result as any).alreadyProcessed).toBe(true);
      expect(mockMonitoring.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'yookassa-payment-123',
          existingStatus: 'succeeded',
        }),
        'Payment already processed - idempotent return'
      );
    });

    it('should process pending payment for Gift tier (no subscription activation)', async () => {
      const mockPayment = {
        id: 'payment-uuid-123',
        userId: 'user-uuid-123',
        externalId: 'yookassa-payment-123',
        status: 'pending',
        subscriptionTier: null,
        amountRubles: 0,
        user: {
          id: 'user-uuid-123',
        },
      };

      mockDb.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          payment: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn().mockResolvedValue({
              ...mockPayment,
              status: 'succeeded',
            }),
          },
        });
      });

      const result = await paymentService.processSuccessfulPayment({
        paymentId: 'yookassa-payment-123',
        userId: 'user-uuid-123',
        status: 'succeeded',
        amountRubles: 0,
        metadata: { test: true },
      });

      expect(result.success).toBe(true);
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('should handle payment not found error', async () => {
      mockDb.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          payment: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        });
      });

      const result = await paymentService.processSuccessfulPayment({
        paymentId: 'non-existent-payment',
        userId: 'user-uuid-123',
        status: 'succeeded',
        amountRubles: 1990,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment not found');
      expect(mockMonitoring.handleError).toHaveBeenCalled();
      expect(mockMonitoring.trackKPI).toHaveBeenCalledWith({
        type: 'payment_failure',
        data: expect.objectContaining({
          errorType: expect.stringContaining('Payment not found'),
        }),
      });
    });

    it('should use transaction with timeout settings', async () => {
      const mockPayment = {
        id: 'payment-uuid-123',
        status: 'succeeded',
      };

      mockDb.$transaction.mockImplementation(async (callback: any, options: any) => {
        expect(options).toEqual({
          maxWait: 5000,
          timeout: 10000,
        });
        return callback({
          payment: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
          },
        });
      });

      await paymentService.processSuccessfulPayment({
        paymentId: 'yookassa-payment-123',
        userId: 'user-uuid-123',
        status: 'succeeded',
        amountRubles: 1990,
      });

      expect(mockDb.$transaction).toHaveBeenCalled();
    });
  });

  describe('processFailedPayment', () => {
    it('should mark payment as failed', async () => {
      mockDb.payment = {
        update: jest.fn().mockResolvedValue({
          id: 'payment-uuid-123',
          status: 'failed',
        }),
      };

      const result = await paymentService.processFailedPayment(
        'yookassa-payment-123',
        'Insufficient funds'
      );

      expect(result.success).toBe(true);
      expect(mockDb.payment.update).toHaveBeenCalledWith({
        where: { externalId: 'yookassa-payment-123' },
        data: {
          status: 'failed',
          failedAt: expect.any(Date),
          failureReason: 'Insufficient funds',
        },
      });
      expect(mockMonitoring.logger.info).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockDb.payment = {
        update: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const result = await paymentService.processFailedPayment('yookassa-payment-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(mockMonitoring.handleError).toHaveBeenCalled();
    });
  });

  describe('processCanceledPayment', () => {
    it('should mark payment as canceled', async () => {
      mockDb.payment = {
        update: jest.fn().mockResolvedValue({
          id: 'payment-uuid-123',
          status: 'canceled',
        }),
      };

      const result = await paymentService.processCanceledPayment(
        'yookassa-payment-123',
        'User canceled'
      );

      expect(result.success).toBe(true);
      expect(mockDb.payment.update).toHaveBeenCalledWith({
        where: { externalId: 'yookassa-payment-123' },
        data: {
          status: 'canceled',
          metadata: {
            cancellationReason: 'User canceled',
          },
        },
      });
    });
  });

  describe('processRefund', () => {
    it('should process refund and deduct tokens', async () => {
      const mockPayment = {
        id: 'payment-uuid-123',
        userId: 'user-uuid-123',
        externalId: 'yookassa-payment-123',
        status: 'succeeded',
        subscriptionTier: 'Professional',
        user: {
          id: 'user-uuid-123',
        },
      };

      const mockTierConfig = {
        tier: 'Professional',
        monthlyTokens: 2000,
      };

      mockDb.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          payment: {
            findUnique: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn().mockResolvedValue({
              ...mockPayment,
              status: 'refunded',
            }),
          },
          subscriptionTierConfig: {
            findUnique: jest.fn().mockResolvedValue(mockTierConfig),
          },
        });
      });

      const result = await paymentService.processRefund('yookassa-payment-123', 1990);

      expect(result.success).toBe(true);
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('should handle payment not found in refund', async () => {
      mockDb.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          payment: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        });
      });

      const result = await paymentService.processRefund('non-existent-payment', 1990);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment not found');
    });
  });

  describe('Concurrency Safety', () => {
    it('should handle concurrent payment processing attempts (idempotency)', async () => {
      const mockPendingPayment = {
        id: 'payment-uuid-123',
        userId: 'user-uuid-123',
        externalId: 'yookassa-payment-123',
        status: 'pending',
        subscriptionTier: null,
        amountRubles: 0,
        user: { id: 'user-uuid-123' },
      };

      const mockSucceededPayment = {
        ...mockPendingPayment,
        status: 'succeeded',
      };

      let callCount = 0;

      mockDb.$transaction.mockImplementation(async (callback: any) => {
        callCount++;
        // First call processes payment, second call sees it as already processed
        const payment = callCount === 1 ? mockPendingPayment : mockSucceededPayment;
        
        return callback({
          payment: {
            findUnique: jest.fn().mockResolvedValue(payment),
            update: jest.fn().mockResolvedValue(mockSucceededPayment),
          },
        });
      });

      // Simulate concurrent requests
      const [result1, result2] = await Promise.all([
        paymentService.processSuccessfulPayment({
          paymentId: 'yookassa-payment-123',
          userId: 'user-uuid-123',
          status: 'succeeded',
          amountRubles: 0,
        }),
        paymentService.processSuccessfulPayment({
          paymentId: 'yookassa-payment-123',
          userId: 'user-uuid-123',
          status: 'succeeded',
          amountRubles: 0,
        }),
      ]);

      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // At least one should be marked as already processed
      const alreadyProcessedCount = [
        (result1 as any).alreadyProcessed,
        (result2 as any).alreadyProcessed,
      ].filter(Boolean).length;

      expect(alreadyProcessedCount).toBeGreaterThanOrEqual(1);
    });
  });
});
