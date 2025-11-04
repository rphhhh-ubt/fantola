/**
 * YooKassa API types and interfaces
 * API Documentation: https://yookassa.ru/developers/api
 */

export type YooKassaPaymentStatus =
  | 'pending'
  | 'waiting_for_capture'
  | 'succeeded'
  | 'canceled';

export type YooKassaRefundStatus = 'pending' | 'succeeded' | 'canceled';

export interface YooKassaAmount {
  value: string;
  currency: string;
}

export interface YooKassaPaymentMethod {
  type: string;
  id?: string;
  saved?: boolean;
  title?: string;
}

export interface YooKassaRecipient {
  gateway_id?: string;
  account_id?: string;
}

export interface YooKassaConfirmation {
  type: 'redirect' | 'embedded' | 'external';
  confirmation_url?: string;
  return_url?: string;
  enforcement?: 'online' | 'offline';
}

export interface YooKassaCancellationDetails {
  party: 'yoo_money' | 'payment_network' | 'merchant';
  reason: string;
}

export interface YooKassaAuthorizationDetails {
  rrn?: string;
  auth_code?: string;
  three_d_secure?: {
    applied: boolean;
  };
}

export interface YooKassaPayment {
  id: string;
  status: YooKassaPaymentStatus;
  amount: YooKassaAmount;
  income_amount?: YooKassaAmount;
  description?: string;
  recipient?: YooKassaRecipient;
  payment_method?: YooKassaPaymentMethod;
  captured_at?: string;
  created_at: string;
  expires_at?: string;
  confirmation?: YooKassaConfirmation;
  test: boolean;
  refunded_amount?: YooKassaAmount;
  paid: boolean;
  refundable: boolean;
  receipt_registration?: string;
  metadata?: Record<string, unknown>;
  cancellation_details?: YooKassaCancellationDetails;
  authorization_details?: YooKassaAuthorizationDetails;
}

export interface YooKassaCreatePaymentRequest {
  amount: YooKassaAmount;
  description?: string;
  receipt?: YooKassaReceipt;
  recipient?: YooKassaRecipient;
  payment_method_data?: YooKassaPaymentMethod;
  confirmation?: YooKassaConfirmation;
  save_payment_method?: boolean;
  capture?: boolean;
  client_ip?: string;
  metadata?: Record<string, unknown>;
  merchant_customer_id?: string;
}

export interface YooKassaCapturePaymentRequest {
  amount?: YooKassaAmount;
  receipt?: YooKassaReceipt;
}

export interface YooKassaCancelPaymentRequest {
  cancellation_details?: {
    party?: 'merchant';
    reason?: string;
  };
}

export interface YooKassaRefund {
  id: string;
  payment_id: string;
  status: YooKassaRefundStatus;
  created_at: string;
  amount: YooKassaAmount;
  description?: string;
  receipt_registration?: string;
  metadata?: Record<string, unknown>;
}

export interface YooKassaCreateRefundRequest {
  payment_id: string;
  amount: YooKassaAmount;
  description?: string;
  receipt?: YooKassaReceipt;
}

export interface YooKassaReceipt {
  customer: {
    email?: string;
    phone?: string;
  };
  items: YooKassaReceiptItem[];
  tax_system_code?: number;
  email?: string;
  phone?: string;
}

export interface YooKassaReceiptItem {
  description: string;
  quantity: string;
  amount: YooKassaAmount;
  vat_code: number;
  payment_mode?: string;
  payment_subject?: string;
}

export interface YooKassaWebhookNotification {
  type: 'notification';
  event: 'payment.succeeded' | 'payment.canceled' | 'refund.succeeded';
  object: YooKassaPayment | YooKassaRefund;
}

export interface YooKassaClientConfig {
  shopId: string;
  secretKey: string;
  apiUrl?: string;
  timeout?: number;
}

export interface YooKassaError {
  type: string;
  id: string;
  code: string;
  description: string;
  parameter?: string;
}
