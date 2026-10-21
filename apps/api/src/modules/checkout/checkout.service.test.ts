import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RazorpayLib from '../../lib/razorpay.js';

type RazorpayModule = typeof RazorpayLib;

// A single mock serves as both the client and the transaction handle.
const db = {
  order: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  orderItem: { findMany: vi.fn() },
  productVariant: { findMany: vi.fn(), updateMany: vi.fn() },
  cartItem: { findMany: vi.fn(), deleteMany: vi.fn() },
  payment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  webhookEvent: { findUnique: vi.fn(), create: vi.fn() },
  orderStatusEvent: { create: vi.fn() },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(db)),
};
vi.mock('@susharts/db', () => ({ prisma: db }));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
const notify = { sendOrderNotification: vi.fn().mockResolvedValue('sent') };
vi.mock('../notifications/order-notifications.js', () => notify);

const KEY_SECRET = 'test_secret';
const rzp = {
  getRazorpayConfig: vi.fn(() => ({ keyId: 'rzp_test_key', keySecret: KEY_SECRET })),
  createRazorpayOrder: vi.fn(),
  fetchRazorpayPayment: vi.fn(),
  captureRazorpayPayment: vi.fn(),
};
vi.mock('../../lib/razorpay.js', async (importOriginal) => ({
  ...(await importOriginal<RazorpayModule>()),
  ...rzp,
}));

const { applyPayment, createCheckout, handleWebhookEvent, releaseOrder, verifyCheckoutPayment } =
  await import('./checkout.service.js');

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const V1 = '22222222-2222-4222-8222-222222222222';
const V2 = '33333333-3333-4333-8333-333333333333';

const input = {
  customerName: 'Asha',
  email: 'asha@example.com',
  phone: '9876543210',
  addressLine1: '1 MG Road',
  addressLine2: null,
  city: 'Pune',
  state: 'Maharashtra' as const,
  postalCode: '411001',
};

function variant(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    label: 'Default',
    sku: `SKU-${id.slice(0, 4)}`,
    priceInPaise: 69900,
    compareAtPriceInPaise: null,
    stockQuantity: 5,
    isAvailable: true,
    product: {
      id: 'p1',
      slug: 'tulip',
      name: 'Tulip',
      status: 'ACTIVE',
      fulfillmentType: 'READY_STOCK',
      productionDays: null,
      images: [],
    },
    ...overrides,
  };
}

const pendingOrder = {
  id: ORDER_ID,
  userId: 'u1',
  status: 'PENDING_PAYMENT',
  totalInPaise: 139800,
  currency: 'INR',
  razorpayOrderId: 'order_RZP1',
};

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_1',
    order_id: 'order_RZP1',
    amount: 139800,
    currency: 'INR',
    status: 'captured',
    method: 'upi',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.order.findMany.mockResolvedValue([]);
  db.order.updateMany.mockResolvedValue({ count: 1 });
  db.orderItem.findMany.mockResolvedValue([]);
  db.productVariant.updateMany.mockResolvedValue({ count: 1 });
  db.payment.findUnique.mockResolvedValue(null);
  db.payment.count.mockResolvedValue(1);
  db.order.findUniqueOrThrow.mockResolvedValue({ ...pendingOrder, status: 'PAID' });
  db.order.findFirst.mockResolvedValue(null);
  db.webhookEvent.findUnique.mockResolvedValue(null);
  db.webhookEvent.create.mockResolvedValue({});
  rzp.getRazorpayConfig.mockReturnValue({ keyId: 'rzp_test_key', keySecret: KEY_SECRET });
});

describe('createCheckout — pricing and stock', () => {
  beforeEach(() => {
    db.cartItem.findMany.mockResolvedValue([
      { variantId: V1, quantity: 2 },
      { variantId: V2, quantity: 1 },
    ]);
    db.order.create.mockImplementation(({ data }) => Promise.resolve({ id: ORDER_ID, ...data }));
    rzp.createRazorpayOrder.mockResolvedValue({
      id: 'order_RZP1',
      amount: 0,
      currency: 'INR',
      status: 'created',
    });
  });

  it('prices every line from the database and snapshots it on the order', async () => {
    db.productVariant.findMany.mockResolvedValue([
      variant(V1),
      variant(V2, { priceInPaise: 25000, stockQuantity: null }),
    ]);

    const session = await createCheckout({ id: 'u1' }, input);

    const { data } = db.order.create.mock.calls[0]![0];
    expect(data).toMatchObject({
      subtotalInPaise: 164800,
      shippingInPaise: 0,
      totalInPaise: 164800,
    });
    expect(data.items.create).toEqual([
      expect.objectContaining({
        variantId: V1,
        unitPriceInPaise: 69900,
        quantity: 2,
        lineTotalInPaise: 139800,
        stockReserved: true,
        productName: 'Tulip',
      }),
      expect.objectContaining({
        variantId: V2,
        unitPriceInPaise: 25000,
        quantity: 1,
        lineTotalInPaise: 25000,
        stockReserved: false,
      }),
    ]);
    expect(rzp.createRazorpayOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountInPaise: 164800 }),
    );
    expect(session).toMatchObject({
      amountInPaise: 164800,
      razorpayOrderId: 'order_RZP1',
      razorpayKeyId: 'rzp_test_key',
    });
    expect(JSON.stringify(session)).not.toContain(KEY_SECRET);
  });

  it('reserves tracked stock with a conditional decrement and leaves unlimited stock alone', async () => {
    db.productVariant.findMany.mockResolvedValue([
      variant(V1),
      variant(V2, { stockQuantity: null }),
    ]);
    await createCheckout({ id: 'u1' }, input);
    expect(db.productVariant.updateMany).toHaveBeenCalledOnce();
    expect(db.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: V1, stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } },
    });
  });

  it('fails with 409 and creates no order when stock ran out concurrently', async () => {
    db.productVariant.findMany.mockResolvedValue([variant(V1), variant(V2)]);
    db.productVariant.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(createCheckout({ id: 'u1' }, input)).rejects.toMatchObject({
      status: 409,
      code: 'INSUFFICIENT_STOCK',
    });
    expect(db.order.create).not.toHaveBeenCalled();
    expect(rzp.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['an inactive product', variant(V1, { product: { ...variant(V1).product, status: 'DRAFT' } })],
    ['a switched-off variant', variant(V1, { isAvailable: false })],
    ['more requested than stocked', variant(V1, { stockQuantity: 1 })],
  ])('rejects %s with CART_CHANGED', async (_label, v1) => {
    db.productVariant.findMany.mockResolvedValue([v1, variant(V2)]);
    await expect(createCheckout({ id: 'u1' }, input)).rejects.toMatchObject({
      status: 409,
      code: 'CART_CHANGED',
    });
    expect(db.order.create).not.toHaveBeenCalled();
  });

  it('rejects an empty cart', async () => {
    db.cartItem.findMany.mockResolvedValue([]);
    await expect(createCheckout({ id: 'u1' }, input)).rejects.toMatchObject({ status: 400 });
  });

  it('fails fast with 503 before touching stock when payments are not configured', async () => {
    rzp.getRazorpayConfig.mockImplementation(() => {
      throw Object.assign(new Error('Payments are not configured'), { status: 503 });
    });
    await expect(createCheckout({ id: 'u1' }, input)).rejects.toMatchObject({ status: 503 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('releases the reservation if Razorpay order creation fails', async () => {
    db.productVariant.findMany.mockResolvedValue([variant(V1), variant(V2)]);
    rzp.createRazorpayOrder.mockRejectedValue(new Error('network'));
    db.orderItem.findMany.mockResolvedValue([{ variantId: V1, quantity: 2 }]);

    await expect(createCheckout({ id: 'u1' }, input)).rejects.toMatchObject({ status: 502 });
    expect(db.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORDER_ID, status: 'PENDING_PAYMENT' } }),
    );
    expect(db.productVariant.updateMany).toHaveBeenLastCalledWith({
      where: { id: V1, stockQuantity: { not: null } },
      data: { stockQuantity: { increment: 2 } },
    });
  });

  it('cancels an earlier open checkout and returns its stock first', async () => {
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'old-order' }]);
    db.productVariant.findMany.mockResolvedValue([variant(V1), variant(V2)]);
    await createCheckout({ id: 'u1' }, input);
    expect(db.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old-order', status: 'PENDING_PAYMENT' } }),
    );
  });
});

describe('releaseOrder', () => {
  it('returns stock once; a repeated release is a no-op', async () => {
    db.orderItem.findMany.mockResolvedValue([{ variantId: V1, quantity: 2 }]);
    expect(await releaseOrder(ORDER_ID, 'CANCELLED')).toBe(true);
    db.order.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await releaseOrder(ORDER_ID, 'CANCELLED')).toBe(false);
    expect(db.productVariant.updateMany).toHaveBeenCalledOnce();
  });
});

describe('verifyCheckoutPayment', () => {
  const signature = createHmac('sha256', KEY_SECRET).update('order_RZP1|pay_1').digest('hex');
  const body = {
    razorpay_order_id: 'order_RZP1',
    razorpay_payment_id: 'pay_1',
    razorpay_signature: signature,
  };

  beforeEach(() => {
    db.order.findFirst.mockResolvedValue({
      ...pendingOrder,
      items: [],
      events: [],
      payments: [],
      createdAt: new Date(),
      expiresAt: new Date(),
      paidAt: null,
      fulfillmentStatus: null,
      shippedAt: null,
      deliveredAt: null,
    });
    db.order.findUnique.mockResolvedValue(pendingOrder);
  });

  it('404s for another customer’s order', async () => {
    db.order.findFirst.mockResolvedValue(null);
    await expect(verifyCheckoutPayment('intruder', ORDER_ID, body)).rejects.toMatchObject({
      status: 404,
    });
    expect(db.order.findFirst).toHaveBeenCalledWith({
      where: { id: ORDER_ID, userId: 'intruder' },
    });
  });

  it('rejects a forged signature without asking Razorpay or marking anything paid', async () => {
    await expect(
      verifyCheckoutPayment('u1', ORDER_ID, { ...body, razorpay_signature: 'a'.repeat(64) }),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_SIGNATURE' });
    expect(rzp.fetchRazorpayPayment).not.toHaveBeenCalled();
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a payment for a different Razorpay order', async () => {
    await expect(
      verifyCheckoutPayment('u1', ORDER_ID, { ...body, razorpay_order_id: 'order_OTHER' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('confirms with Razorpay before marking the order paid', async () => {
    rzp.fetchRazorpayPayment.mockResolvedValue(payment());
    await verifyCheckoutPayment('u1', ORDER_ID, body);
    expect(rzp.fetchRazorpayPayment).toHaveBeenCalledWith('pay_1');
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paidAt: expect.any(Date), fulfillmentStatus: 'CONFIRMED' },
    });
  });

  it('does not mark paid when Razorpay says the payment has not completed', async () => {
    rzp.fetchRazorpayPayment.mockResolvedValue(payment({ status: 'created' }));
    await verifyCheckoutPayment('u1', ORDER_ID, body);
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });
});

describe('applyPayment', () => {
  beforeEach(() => db.order.findUnique.mockResolvedValue(pendingOrder));

  it('marks a captured payment paid and clears the purchased items from the cart', async () => {
    db.orderItem.findMany.mockResolvedValue([{ variantId: V1 }]);
    await applyPayment(payment());
    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        razorpayPaymentId: 'pay_1',
        status: 'CAPTURED',
        amountInPaise: 139800,
      }),
    });
    expect(db.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', variantId: { in: [V1] } },
    });
  });

  it('is idempotent: a duplicate callback/webhook does not re-transition or touch stock', async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 });
    db.payment.findUnique.mockResolvedValue({ id: 'p-row', status: 'CAPTURED' });
    await applyPayment(payment());
    expect(db.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(db.productVariant.updateMany).not.toHaveBeenCalled();
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it('flags a second captured payment on an already-paid order', async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 });
    db.payment.count.mockResolvedValue(2);
    await applyPayment(payment({ id: 'pay_2' }));
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { requiresReview: true, reviewReason: expect.stringContaining('DUPLICATE_PAYMENT') },
    });
  });

  it('captures an authorized payment for the server-side amount', async () => {
    rzp.captureRazorpayPayment.mockResolvedValue(payment());
    await applyPayment(payment({ status: 'authorized' }));
    expect(rzp.captureRazorpayPayment).toHaveBeenCalledWith('pay_1', 139800);
    expect(db.order.updateMany).toHaveBeenCalled();
  });

  it('never marks paid when the amount does not match, and flags it', async () => {
    await applyPayment(payment({ amount: 100 }));
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: { requiresReview: true, reviewReason: expect.stringContaining('AMOUNT_MISMATCH') },
    });
  });

  it('records a failed attempt without changing the order, so the customer can retry', async () => {
    await applyPayment(
      payment({ status: 'failed', error_code: 'BAD_REQUEST_ERROR', error_description: 'declined' }),
    );
    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'FAILED', errorDescription: 'declined' }),
    });
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it('does not downgrade a captured payment when a stale failure event arrives', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'p-row', status: 'CAPTURED' });
    await applyPayment(payment({ status: 'failed' }));
    expect(db.payment.update).not.toHaveBeenCalled();
  });

  it('re-reserves stock when payment lands after the reservation was released', async () => {
    db.order.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    db.order.findUniqueOrThrow.mockResolvedValue({ ...pendingOrder, status: 'EXPIRED' });
    db.orderItem.findMany.mockResolvedValue([{ variantId: V1, quantity: 2 }]);
    await applyPayment(payment());
    expect(db.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: V1, stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } },
    });
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it('records a late payment as paid-but-needs-review when the stock is gone', async () => {
    db.order.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    db.order.findUniqueOrThrow.mockResolvedValue({ ...pendingOrder, status: 'CANCELLED' });
    db.orderItem.findMany.mockResolvedValue([{ variantId: V1, quantity: 2 }]);
    db.productVariant.updateMany.mockResolvedValue({ count: 0 });
    await applyPayment(payment());
    expect(db.order.updateMany).toHaveBeenLastCalledWith({
      where: { id: ORDER_ID, status: { in: ['CANCELLED', 'EXPIRED'] } },
      data: expect.objectContaining({
        status: 'PAID',
        fulfillmentStatus: 'CONFIRMED',
        requiresReview: true,
      }),
    });
  });

  it('ignores payments for unknown orders', async () => {
    db.order.findUnique.mockResolvedValue(null);
    expect(await applyPayment(payment())).toBeNull();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('handleWebhookEvent', () => {
  const event = { event: 'payment.captured', payload: { payment: { entity: payment() } } };

  it('processes a new event and records its id afterwards', async () => {
    db.order.findUnique.mockResolvedValue(pendingOrder);
    await handleWebhookEvent('evt_1', event);
    expect(db.order.updateMany).toHaveBeenCalled();
    expect(db.webhookEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt_1', event: 'payment.captured' },
    });
  });

  it('skips a duplicate delivery of the same event', async () => {
    db.webhookEvent.findUnique.mockResolvedValue({ id: 'evt_1' });
    await handleWebhookEvent('evt_1', event);
    expect(db.order.findUnique).not.toHaveBeenCalled();
  });

  it('acknowledges unrelated events without acting', async () => {
    await handleWebhookEvent('evt_2', { event: 'refund.created', payload: {} });
    expect(db.order.findUnique).not.toHaveBeenCalled();
    expect(db.webhookEvent.create).toHaveBeenCalled();
  });
});

describe('Phase 8 hooks', () => {
  beforeEach(() => db.order.findUnique.mockResolvedValue(pendingOrder));

  it('confirms fulfillment with a system audit event and sends the confirmation email', async () => {
    await applyPayment(payment());
    expect(db.orderStatusEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: ORDER_ID,
        fromStatus: null,
        toStatus: 'CONFIRMED',
        actorId: null,
        note: 'Payment verified',
      },
    });
    expect(notify.sendOrderNotification).toHaveBeenCalledWith(ORDER_ID, 'ORDER_CONFIRMED');
  });

  it('does not write a second audit event for a repeated payment callback', async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 });
    db.payment.findUnique.mockResolvedValue({ id: 'p-row', status: 'CAPTURED' });
    await applyPayment(payment());
    expect(db.orderStatusEvent.create).not.toHaveBeenCalled();
    // The notifier is called but is itself idempotent (one row per order+type).
    expect(notify.sendOrderNotification).toHaveBeenCalledWith(ORDER_ID, 'ORDER_CONFIRMED');
  });

  it('never sends a confirmation for a failed or mismatched payment', async () => {
    await applyPayment(payment({ status: 'failed' }));
    await applyPayment(payment({ amount: 1 }));
    expect(notify.sendOrderNotification).not.toHaveBeenCalled();
  });

  it('a confirmation email failure does not affect the payment outcome', async () => {
    notify.sendOrderNotification.mockRejectedValueOnce(new Error('smtp down'));
    await expect(applyPayment(payment())).resolves.toBe(ORDER_ID);
  });

  it('sends a payment-failed email only when a released order had a failed attempt', async () => {
    db.payment.count.mockResolvedValueOnce(0);
    await releaseOrder(ORDER_ID, 'CANCELLED');
    expect(notify.sendOrderNotification).not.toHaveBeenCalled();

    db.payment.count.mockResolvedValueOnce(1);
    await releaseOrder(ORDER_ID, 'EXPIRED');
    expect(notify.sendOrderNotification).toHaveBeenCalledWith(ORDER_ID, 'PAYMENT_FAILED');
  });
});
