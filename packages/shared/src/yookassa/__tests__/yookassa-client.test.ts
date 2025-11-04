import crypto from 'crypto';
import { YooKassaClient, YooKassaClientError } from '../yookassa-client';
import type { YooKassaCreatePaymentRequest, YooKassaWebhookNotification } from '../types';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('YooKassaClient', () => {
  let client: YooKassaClient;
  const shopId = 'test-shop-id';
  const secretKey = 'test-secret-key';

  beforeEach(() => {
    client = new YooKassaClient({
      shopId,
      secretKey,
      apiUrl: 'https://api.yookassa.ru/v3',
    });
    mockFetch.mockClear();
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const request: YooKassaCreatePaymentRequest = {
        amount: {
          value: '100.00',
          currency: 'RUB',
        },
        description: 'Test payment',
        confirmation: {
          type: 'redirect',
          return_url: 'https://example.com/return',
        },
      };

      const mockResponse = {
        id: 'payment-123',
        status: 'pending',
        amount: request.amount,
        description: request.description,
        created_at: '2024-01-01T00:00:00Z',
        confirmation: {
          type: 'redirect',
          confirmation_url: 'https://yookassa.ru/checkout/123',
        },
        test: false,
        paid: false,
        refundable: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.createPayment(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Idempotence-Key': expect.any(String),
          }),
          body: JSON.stringify(request),
        })
      );
    });

    it('should use custom idempotence key', async () => {
      const request: YooKassaCreatePaymentRequest = {
        amount: { value: '100.00', currency: 'RUB' },
      };
      const idempotenceKey = 'custom-key-123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'payment-123', status: 'pending' }),
      });

      await client.createPayment(request, idempotenceKey);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotence-Key': idempotenceKey,
          }),
        })
      );
    });
  });

  describe('getPayment', () => {
    it('should get payment by ID', async () => {
      const paymentId = 'payment-123';
      const mockResponse = {
        id: paymentId,
        status: 'succeeded',
        amount: { value: '100.00', currency: 'RUB' },
        paid: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getPayment(paymentId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.yookassa.ru/v3/payments/${paymentId}`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('capturePayment', () => {
    it('should capture a payment', async () => {
      const paymentId = 'payment-123';
      const mockResponse = {
        id: paymentId,
        status: 'succeeded',
        paid: true,
        captured_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.capturePayment(paymentId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.yookassa.ru/v3/payments/${paymentId}/capture`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should capture with partial amount', async () => {
      const paymentId = 'payment-123';
      const captureRequest = {
        amount: { value: '50.00', currency: 'RUB' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: paymentId, status: 'succeeded' }),
      });

      await client.capturePayment(paymentId, captureRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(captureRequest),
        })
      );
    });
  });

  describe('cancelPayment', () => {
    it('should cancel a payment', async () => {
      const paymentId = 'payment-123';
      const mockResponse = {
        id: paymentId,
        status: 'canceled',
        cancellation_details: {
          party: 'merchant',
          reason: 'Canceled by merchant',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.cancelPayment(paymentId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.yookassa.ru/v3/payments/${paymentId}/cancel`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('createRefund', () => {
    it('should create a refund', async () => {
      const refundRequest = {
        payment_id: 'payment-123',
        amount: { value: '100.00', currency: 'RUB' },
        description: 'Test refund',
      };

      const mockResponse = {
        id: 'refund-123',
        payment_id: refundRequest.payment_id,
        status: 'succeeded',
        amount: refundRequest.amount,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.createRefund(refundRequest);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/refunds',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(refundRequest),
        })
      );
    });
  });

  describe('getRefund', () => {
    it('should get refund by ID', async () => {
      const refundId = 'refund-123';
      const mockResponse = {
        id: refundId,
        payment_id: 'payment-123',
        status: 'succeeded',
        amount: { value: '100.00', currency: 'RUB' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getRefund(refundId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.yookassa.ru/v3/refunds/${refundId}`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      const notification: YooKassaWebhookNotification = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: 'payment-123',
          status: 'succeeded',
          amount: { value: '100.00', currency: 'RUB' },
          created_at: '2024-01-01T00:00:00Z',
          test: false,
          paid: true,
          refundable: true,
        },
      };

      const notificationString = JSON.stringify(notification);
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(notificationString)
        .digest('hex');

      const isValid = client.validateWebhookSignature(notification, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const notification: YooKassaWebhookNotification = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: 'payment-123',
          status: 'succeeded',
          amount: { value: '100.00', currency: 'RUB' },
          created_at: '2024-01-01T00:00:00Z',
          test: false,
          paid: true,
          refundable: true,
        },
      };

      const invalidSignature = 'invalid-signature';

      const isValid = client.validateWebhookSignature(notification, invalidSignature);

      expect(isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw YooKassaClientError on API error', async () => {
      const errorResponse = {
        type: 'error',
        id: 'error-123',
        code: 'invalid_request',
        description: 'Invalid amount',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse,
      });

      await expect(
        client.createPayment({ amount: { value: '0', currency: 'RUB' } })
      ).rejects.toThrow(YooKassaClientError);
    });

    it('should handle timeout', async () => {
      const shortTimeoutClient = new YooKassaClient({
        shopId,
        secretKey,
        timeout: 100,
      });

      mockFetch.mockImplementationOnce(
        () => new Promise((_resolve, reject) => {
          setTimeout(() => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          }, 150);
        })
      );

      await expect(
        shortTimeoutClient.createPayment({ amount: { value: '100', currency: 'RUB' } })
      ).rejects.toThrow('Request timeout');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.createPayment({ amount: { value: '100', currency: 'RUB' } })
      ).rejects.toThrow(YooKassaClientError);
    });
  });

  describe('authentication', () => {
    it('should include Basic auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'payment-123' }),
      });

      await client.createPayment({ amount: { value: '100', currency: 'RUB' } });

      const expectedAuth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Basic ${expectedAuth}`,
          }),
        })
      );
    });
  });
});
