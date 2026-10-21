import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = {};
vi.mock('../config/env.js', () => ({ getEnv: () => env }));

const { getRazorpayConfig, getWebhookSecret, verifyPaymentSignature, verifyWebhookSignature } = await import(
  './razorpay.js'
);

const SECRET = 'test_key_secret';
const sign = (data: string | Buffer, secret = SECRET) => createHmac('sha256', secret).update(data).digest('hex');

describe('verifyPaymentSignature', () => {
  const orderId = 'order_IluGWxBm9U8zJ8';
  const paymentId = 'pay_IluGgFGYK2Rt5c';
  const valid = sign(`${orderId}|${paymentId}`);

  it('accepts HMAC-SHA256 of "order_id|payment_id" with the key secret', () => {
    expect(verifyPaymentSignature(orderId, paymentId, valid, SECRET)).toBe(true);
  });

  it.each([
    ['a different payment id', orderId, 'pay_other', valid, SECRET],
    ['a different order id', 'order_other', paymentId, valid, SECRET],
    ['the wrong secret', orderId, paymentId, valid, 'other_secret'],
    ['swapped id order', paymentId, orderId, valid, SECRET],
    ['a truncated signature', orderId, paymentId, valid.slice(0, 32), SECRET],
    ['an empty signature', orderId, paymentId, '', SECRET],
    ['non-hex garbage', orderId, paymentId, 'z'.repeat(64), SECRET],
  ])('rejects %s', (_label, o, p, signature, secret) => {
    expect(verifyPaymentSignature(o, p, signature, secret)).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  const body = Buffer.from('{"event":"payment.captured","payload":{}}');

  it('accepts HMAC-SHA256 of the exact raw body', () => {
    expect(verifyWebhookSignature(body, sign(body, 'whsec'), 'whsec')).toBe(true);
  });

  it('rejects a body changed after signing, even by whitespace', () => {
    const signature = sign(body, 'whsec');
    expect(verifyWebhookSignature(Buffer.from(`${body.toString()} `), signature, 'whsec')).toBe(false);
  });

  it('rejects the wrong secret', () => {
    expect(verifyWebhookSignature(body, sign(body, 'whsec'), 'other')).toBe(false);
  });
});

describe('configuration', () => {
  it('answers 503 until keys are configured', () => {
    expect(() => getRazorpayConfig()).toThrow(expect.objectContaining({ status: 503 }));
    expect(() => getWebhookSecret()).toThrow(expect.objectContaining({ status: 503 }));
  });

  it('returns keys once configured', () => {
    Object.assign(env, { RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'w' });
    expect(getRazorpayConfig()).toEqual({ keyId: 'rzp_test_x', keySecret: 's' });
    expect(getWebhookSecret()).toBe('w');
  });
});
