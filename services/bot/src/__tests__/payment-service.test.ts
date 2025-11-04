import { PaymentService, YooKassaConfig } from '../services/payment-service';
import { Monitoring } from '@monorepo/monitoring';
import { db, SubscriptionTier, PaymentStatus } from '@monorepo/database';
import axios from 'axios';

jest.mock('axios');
jest.mock('@monorepo/database', () => ({
  db: {
    payment: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    subscriptionHistory: {
      create: jest.fn(),
    },
    tokenOperation: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  SubscriptionTier: {
    Gift: 'Gift',
    Professional: 'Professional',
    Business: 'Business',
  },
  PaymentStatus: {
    pending: 'pending',
    succeeded: 'succeeded',
    failed: 'failed',
    canceled: 'canceled',
  },
  PaymentProvider: {
    yookassa: 'yookassa',
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let monitoring: Monitoring;
  let yookassaConfig: YooKassaConfig;

  beforeEach(() => {
    monitoring = new Monitoring({ service: 'bot-test' });
    yookassaConfig = {
      shopId: 'test-shop-id',
      secretKey: 'test-secret-key',
      returnUrl: 'https://t.me/test_bot',
    };
    paymentService = new PaymentService(yookassaConfig, monitoring);
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create payment for Professional tier', async () => {
      const userId = 'user-123';
      const tier = SubscriptionTier.Professional;
      const telegramId = 12345;

      const mockPayment = {
        id: 'payment-123',
        userId,
        provider: 'yookassa',
        status: PaymentStatus.pending,
        amountRubles: 1990,
        currency: 'RUB',
        externalId: expect.any(String),
        subscriptionTier: tier,
      };

      (db.payment.create as jest.Mock).mockResolvedValueOnce(mockPayment);
      (db.payment.update as jest.Mock).mockResolvedValueOnce({
        ...mockPayment,
        externalId: 'yookassa-payment-id',
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'yookassa-payment-id',
          confirmation: {
            confirmation_url: 'https://yookassa.ru/pay/yookassa-payment-id',
          },
        },
      });

      const result = await paymentService.createPayment(userId, tier, telegramId);

      expect(result).toEqual({
        paymentId: 'payment-123',
        confirmationUrl: 'https://yookassa.ru/pay/yookassa-payment-id',
        amount: 1990,
        tier,
      });

      expect(db.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          provider: 'yookassa',
          status: PaymentStatus.pending,
          amountRubles: 1990,
          subscriptionTier: tier,
        }),
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/payments',
        expect.objectContaining({
          amount: {
            value: '1990.00',
            currency: 'RUB',
          },
          capture: true,
        }),
        expect.objectContaining({
          auth: {
            username: yookassaConfig.shopId,
            password: yookassaConfig.secretKey,
          },
        })
      );
    });

    it('should create payment for Business tier', async () => {
      const userId = 'user-123';
      const tier = SubscriptionTier.Business;
      const telegramId = 12345;

      const mockPayment = {
        id: 'payment-123',
        userId,
        externalId: expect.any(String),
      };

      (db.payment.create as jest.Mock).mockResolvedValueOnce(mockPayment);
      (db.payment.update as jest.Mock).mockResolvedValueOnce(mockPayment);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'yookassa-payment-id',
          confirmation: {
            confirmation_url: 'https://yookassa.ru/pay/yookassa-payment-id',
          },
        },
      });

      const result = await paymentService.createPayment(userId, tier, telegramId);

      expect(result.amount).toBe(3490);
      expect(result.tier).toBe(SubscriptionTier.Business);
    });

    it('should throw error for Gift tier', async () => {
      await expect(
        paymentService.createPayment('user-123', SubscriptionTier.Gift, 12345)
      ).rejects.toThrow('Cannot create payment for Gift tier');
    });

    it('should handle YooKassa API errors', async () => {
      const userId = 'user-123';
      const tier = SubscriptionTier.Professional;
      const telegramId = 12345;

      (db.payment.create as jest.Mock).mockResolvedValueOnce({
        id: 'payment-123',
      });

      mockedAxios.post.mockRejectedValueOnce(new Error('YooKassa API error'));

      await expect(
        paymentService.createPayment(userId, tier, telegramId)
      ).rejects.toThrow('Failed to create payment');
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment and update user subscription', async () => {
      const externalId = 'yookassa-payment-id';
      const mockPayment = {
        id: 'payment-123',
        userId: 'user-123',
        status: PaymentStatus.pending,
        amountRubles: 1990,
        subscriptionTier: SubscriptionTier.Professional,
        user: {
          id: 'user-123',
          tokensBalance: 100,
        },
        metadata: {},
      };

      (db.payment.findUnique as jest.Mock).mockResolvedValueOnce(mockPayment);
      (db.$transaction as jest.Mock).mockImplementationOnce(async (callback) => {
        return callback({
          payment: {
            update: jest.fn().mockResolvedValueOnce({}),
          },
          user: {
            update: jest.fn().mockResolvedValueOnce({}),
          },
          subscriptionHistory: {
            create: jest.fn().mockResolvedValueOnce({}),
          },
          tokenOperation: {
            create: jest.fn().mockResolvedValueOnce({}),
          },
        });
      });

      const result = await paymentService.confirmPayment(externalId);

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.tier).toBe(SubscriptionTier.Professional);
      expect(result.tokensAwarded).toBe(2000);
      expect(result.subscriptionExpiresAt).toBeInstanceOf(Date);

      expect(db.$transaction).toHaveBeenCalled();
    });

    it('should handle already confirmed payments', async () => {
      const externalId = 'yookassa-payment-id';
      const mockPayment = {
        id: 'payment-123',
        userId: 'user-123',
        status: PaymentStatus.succeeded,
        subscriptionTier: SubscriptionTier.Professional,
        user: {
          tokensBalance: 2100,
          subscriptionExpiresAt: new Date(),
        },
      };

      (db.payment.findUnique as jest.Mock).mockResolvedValueOnce(mockPayment);

      const result = await paymentService.confirmPayment(externalId);

      expect(result.success).toBe(true);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent payment', async () => {
      (db.payment.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        paymentService.confirmPayment('non-existent-id')
      ).rejects.toThrow('Failed to confirm payment');
    });
  });

  describe('cancelPayment', () => {
    it('should cancel payment', async () => {
      const externalId = 'yookassa-payment-id';
      const mockPayment = {
        id: 'payment-123',
        status: PaymentStatus.pending,
      };

      (db.payment.findUnique as jest.Mock).mockResolvedValueOnce(mockPayment);
      (db.payment.update as jest.Mock).mockResolvedValueOnce({
        ...mockPayment,
        status: PaymentStatus.canceled,
      });

      await paymentService.cancelPayment(externalId);

      expect(db.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: expect.objectContaining({
          status: PaymentStatus.canceled,
          failedAt: expect.any(Date),
        }),
      });
    });

    it('should throw error for non-existent payment', async () => {
      (db.payment.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        paymentService.cancelPayment('non-existent-id')
      ).rejects.toThrow('Failed to cancel payment');
    });
  });

  describe('getPaymentStatus', () => {
    it('should get payment status from YooKassa', async () => {
      const externalId = 'yookassa-payment-id';

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          status: 'succeeded',
        },
      });

      const status = await paymentService.getPaymentStatus(externalId);

      expect(status).toBe('succeeded');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://api.yookassa.ru/v3/payments/${externalId}`,
        expect.objectContaining({
          auth: {
            username: yookassaConfig.shopId,
            password: yookassaConfig.secretKey,
          },
        })
      );
    });

    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(
        paymentService.getPaymentStatus('payment-id')
      ).rejects.toThrow('Failed to get payment status');
    });
  });
});
