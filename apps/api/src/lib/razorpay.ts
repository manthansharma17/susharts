import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../config/env.js';
import { HttpError } from './http-error.js';

const API_BASE = 'https://api.razorpay.com/v1';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

export function getRazorpayConfig(): RazorpayConfig {
  const env = getEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', 'Payments are not configured');
  }
  return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
}

export function getWebhookSecret(): string {
  const secret = getEnv().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', 'Payment webhooks are not configured');
  return secret;
}

function safeEqualHex(expectedHex: string, actual: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(actual, 'hex');
  // Length check first: timingSafeEqual throws on unequal lengths.
  return received.length === expected.length && timingSafeEqual(expected, received);
}

/**
 * Razorpay standard checkout: signature = HMAC_SHA256(`${order_id}|${payment_id}`, key_secret).
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  const expected = createHmac('sha256', keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Webhooks: signature = HMAC_SHA256(raw request body, webhook secret). Must use the exact raw bytes. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string, webhookSecret: string): boolean {
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const { keyId, keySecret } = getRazorpayConfig();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const description = (payload.error as { description?: string } | undefined)?.description;
    throw new Error(`Razorpay ${method} ${path} failed (${response.status}): ${description ?? 'unknown error'}`);
  }
  return payload as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
}

export function createRazorpayOrder(input: {
  amountInPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  return call('POST', '/orders', {
    amount: input.amountInPaise,
    currency: 'INR',
    receipt: input.receipt,
    notes: input.notes,
  });
}

export function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return call('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

export function captureRazorpayPayment(paymentId: string, amountInPaise: number): Promise<RazorpayPayment> {
  return call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, {
    amount: amountInPaise,
    currency: 'INR',
  });
}
