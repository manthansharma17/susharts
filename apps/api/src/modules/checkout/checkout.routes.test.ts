import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../middleware/auth.js';

vi.mock('@susharts/db', () => ({ prisma: {} }));
vi.mock('../../lib/firebase-admin.js', () => ({}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../config/env.js', () => ({ getEnv: () => ({ RAZORPAY_WEBHOOK_SECRET: 'whsec_test' }) }));

const service = {
  createCheckout: vi.fn().mockResolvedValue({ orderId: 'o1' }),
  verifyCheckoutPayment: vi.fn().mockResolvedValue({}),
  cancelCheckout: vi.fn().mockResolvedValue({}),
  getOrderSummary: vi.fn().mockResolvedValue({}),
  handleWebhookEvent: vi.fn().mockResolvedValue(undefined),
};
vi.mock('./checkout.service.js', () => service);

const { checkoutRouter, razorpayWebhook } = await import('./checkout.routes.js');
const { errorHandler } = await import('../../middleware/error-handler.js');

function appAs(role: AuthUser['role'] | null) {
  const app = express();
  app.post('/webhooks/razorpay', ...razorpayWebhook);
  app.use(express.json());
  app.use((req, _res, next) => {
    if (role) req.user = { id: 'u1', firebaseUid: 'f', email: 'a@b.c', role };
    next();
  });
  app.use('/checkout', checkoutRouter);
  app.use(errorHandler);
  return app;
}

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const valid = {
  customerName: 'Asha',
  email: 'asha@example.com',
  phone: '+91 98765-43210',
  addressLine1: '1 MG Road',
  city: 'Pune',
  state: 'Maharashtra',
  postalCode: '411001',
};

beforeEach(() => vi.clearAllMocks());

describe('checkout routes', () => {
  it.each([
    ['post', '/checkout'],
    ['post', `/checkout/${ORDER_ID}/verify`],
    ['post', `/checkout/${ORDER_ID}/cancel`],
    ['get', `/checkout/orders/${ORDER_ID}`],
  ] as const)('%s %s requires sign-in', async (method, path) => {
    expect((await request(appAs(null))[method](path).send({})).status).toBe(401);
  });

  it('normalises the phone number and ignores client-sent totals', async () => {
    await request(appAs('CUSTOMER')).post('/checkout').send({ ...valid, totalInPaise: 1, items: [] });
    const [, input] = service.createCheckout.mock.calls[0]!;
    expect(input.phone).toBe('9876543210');
    expect(input).not.toHaveProperty('totalInPaise');
    expect(input).not.toHaveProperty('items');
  });

  it.each([
    ['a bad PIN code', { postalCode: '011001' }],
    ['a bad phone', { phone: '12345' }],
    ['an unknown state', { state: 'Atlantis' }],
    ['a bad email', { email: 'nope' }],
    ['a blank address', { addressLine1: '  ' }],
  ])('rejects %s', async (_label, patch) => {
    const res = await request(appAs('CUSTOMER')).post('/checkout').send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(service.createCheckout).not.toHaveBeenCalled();
  });

  it('rejects a malformed signature before calling the service', async () => {
    const res = await request(appAs('CUSTOMER'))
      .post(`/checkout/${ORDER_ID}/verify`)
      .send({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'xyz' });
    expect(res.status).toBe(400);
    expect(service.verifyCheckoutPayment).not.toHaveBeenCalled();
  });
});

describe('POST /webhooks/razorpay', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } });
  const sig = (raw: string, secret = 'whsec_test') => createHmac('sha256', secret).update(raw).digest('hex');

  it('accepts a correctly signed event without any user session', async () => {
    const res = await request(appAs(null))
      .post('/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sig(body))
      .set('X-Razorpay-Event-Id', 'evt_1')
      .send(body);
    expect(res.status).toBe(200);
    expect(service.handleWebhookEvent).toHaveBeenCalledWith('evt_1', JSON.parse(body));
  });

  it.each([
    ['a wrong signature', () => sig(body, 'other')],
    ['no signature', () => undefined],
  ])('rejects %s', async (_label, makeSig) => {
    const req = request(appAs(null)).post('/webhooks/razorpay').set('Content-Type', 'application/json');
    const s = makeSig();
    if (s) req.set('X-Razorpay-Signature', s);
    const res = await req.send(body);
    expect(res.status).toBe(400);
    expect(service.handleWebhookEvent).not.toHaveBeenCalled();
  });
});
