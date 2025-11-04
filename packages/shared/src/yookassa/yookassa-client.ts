import crypto from 'crypto';
import type {
  YooKassaClientConfig,
  YooKassaCreatePaymentRequest,
  YooKassaPayment,
  YooKassaCapturePaymentRequest,
  YooKassaCancelPaymentRequest,
  YooKassaCreateRefundRequest,
  YooKassaRefund,
  YooKassaWebhookNotification,
  YooKassaError,
} from './types';

/**
 * YooKassa API Client
 * Implements payment creation, capture, cancellation, and refund functionality
 * API Documentation: https://yookassa.ru/developers/api
 */
export class YooKassaClient {
  private readonly shopId: string;
  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly timeout: number;

  constructor(config: YooKassaClientConfig) {
    this.shopId = config.shopId;
    this.secretKey = config.secretKey;
    this.apiUrl = config.apiUrl || 'https://api.yookassa.ru/v3';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Create a new payment
   */
  async createPayment(
    request: YooKassaCreatePaymentRequest,
    idempotenceKey?: string
  ): Promise<YooKassaPayment> {
    const key = idempotenceKey || this.generateIdempotenceKey();
    
    return this.request<YooKassaPayment>('/payments', {
      method: 'POST',
      body: request,
      idempotenceKey: key,
    });
  }

  /**
   * Get payment information
   */
  async getPayment(paymentId: string): Promise<YooKassaPayment> {
    return this.request<YooKassaPayment>(`/payments/${paymentId}`, {
      method: 'GET',
    });
  }

  /**
   * Capture a payment (for two-step payments)
   */
  async capturePayment(
    paymentId: string,
    request?: YooKassaCapturePaymentRequest,
    idempotenceKey?: string
  ): Promise<YooKassaPayment> {
    const key = idempotenceKey || this.generateIdempotenceKey();
    
    return this.request<YooKassaPayment>(`/payments/${paymentId}/capture`, {
      method: 'POST',
      body: request || {},
      idempotenceKey: key,
    });
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(
    paymentId: string,
    request?: YooKassaCancelPaymentRequest,
    idempotenceKey?: string
  ): Promise<YooKassaPayment> {
    const key = idempotenceKey || this.generateIdempotenceKey();
    
    return this.request<YooKassaPayment>(`/payments/${paymentId}/cancel`, {
      method: 'POST',
      body: request || {},
      idempotenceKey: key,
    });
  }

  /**
   * Create a refund
   */
  async createRefund(
    request: YooKassaCreateRefundRequest,
    idempotenceKey?: string
  ): Promise<YooKassaRefund> {
    const key = idempotenceKey || this.generateIdempotenceKey();
    
    return this.request<YooKassaRefund>('/refunds', {
      method: 'POST',
      body: request,
      idempotenceKey: key,
    });
  }

  /**
   * Get refund information
   */
  async getRefund(refundId: string): Promise<YooKassaRefund> {
    return this.request<YooKassaRefund>(`/refunds/${refundId}`, {
      method: 'GET',
    });
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(
    notification: YooKassaWebhookNotification,
    signature: string
  ): boolean {
    const notificationString = JSON.stringify(notification);
    const hash = crypto
      .createHmac('sha256', this.secretKey)
      .update(notificationString)
      .digest('hex');
    
    return hash === signature;
  }

  /**
   * Generate idempotence key for request deduplication
   */
  private generateIdempotenceKey(): string {
    return crypto.randomUUID();
  }

  /**
   * Make HTTP request to YooKassa API
   */
  private async request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: any;
      idempotenceKey?: string;
    }
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const auth = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');

    const headers: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    if (options.idempotenceKey) {
      headers['Idempotence-Key'] = options.idempotenceKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const error = data as YooKassaError;
        throw new YooKassaClientError(
          error.description || 'Unknown error',
          error.code,
          error.type,
          response.status
        );
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof YooKassaClientError) {
        throw error;
      }

      if ((error as any).name === 'AbortError') {
        throw new YooKassaClientError(
          'Request timeout',
          'timeout',
          'request_timeout',
          408
        );
      }

      throw new YooKassaClientError(
        error instanceof Error ? error.message : 'Network error',
        'network_error',
        'network_error',
        0
      );
    }
  }
}

/**
 * Custom error class for YooKassa API errors
 */
export class YooKassaClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public type: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'YooKassaClientError';
  }
}
