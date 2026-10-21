import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = {
  order: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  orderItem: { findMany: vi.fn() },
  productVariant: { updateMany: vi.fn() },
  orderStatusEvent: { create: vi.fn() },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(db)),
};
vi.mock('@susharts/db', () => ({ prisma: db }));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
const notify = {
  sendOrderNotification: vi.fn().mockResolvedValue('sent'),
  retryOrderNotifications: vi.fn().mockResolvedValue(0),
};
vi.mock('../notifications/order-notifications.js', () => notify);
vi.mock('../checkout/checkout.service.js', () => ({
  getOrderSummary: vi.fn().mockResolvedValue({}),
}));

const { adminListOrders, adminUpdateFulfillment } = await import('./admin-order.service.js');

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const paid = (fulfillmentStatus: string | null, status = 'PAID') => ({
  id: ORDER_ID,
  userId: 'u1',
  status,
  fulfillmentStatus,
});
const detail = {
  ...paid('PROCESSING'),
  user: { email: 'c@x.com' },
  payments: [],
  events: [],
  notifications: [],
  requiresReview: false,
  reviewReason: null,
  razorpayOrderId: 'order_1',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.order.updateMany.mockResolvedValue({ count: 1 });
  db.orderItem.findMany.mockResolvedValue([]);
});

function setOrder(o: unknown) {
  // First call is inside the transaction; later calls load the detail view.
  db.order.findUnique.mockResolvedValueOnce(o).mockResolvedValue(detail);
}

describe('adminUpdateFulfillment — transitions', () => {
  it.each([
    ['CONFIRMED', 'PROCESSING'],
    ['PROCESSING', 'SHIPPED'],
    ['SHIPPED', 'DELIVERED'],
    ['CONFIRMED', 'CANCELLED'],
    ['PROCESSING', 'CANCELLED'],
  ] as const)('allows %s → %s and records who did it', async (from, to) => {
    setOrder(paid(from));
    await adminUpdateFulfillment('staff-1', ORDER_ID, { from, to, note: 'n' });
    expect(db.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORDER_ID, status: 'PAID', fulfillmentStatus: from } }),
    );
    expect(db.orderStatusEvent.create).toHaveBeenCalledWith({
      data: { orderId: ORDER_ID, fromStatus: from, toStatus: to, actorId: 'staff-1', note: 'n' },
    });
  });

  it.each([
    ['CONFIRMED', 'SHIPPED'],
    ['CONFIRMED', 'DELIVERED'],
    ['SHIPPED', 'CANCELLED'],
    ['DELIVERED', 'CANCELLED'],
    ['CANCELLED', 'PROCESSING'],
    ['DELIVERED', 'PROCESSING'],
  ] as const)('rejects %s → %s', async (from, to) => {
    setOrder(paid(from));
    await expect(
      adminUpdateFulfillment('staff-1', ORDER_ID, { from, to, note: 'n' }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_TRANSITION',
    });
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['pending payment', paid(null, 'PENDING_PAYMENT')],
    ['expired', paid(null, 'EXPIRED')],
  ])('refuses to fulfil an unpaid (%s) order', async (_label, order) => {
    setOrder(order);
    await expect(
      adminUpdateFulfillment('staff-1', ORDER_ID, {
        from: 'CONFIRMED',
        to: 'PROCESSING',
        note: null,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'NOT_PAID' });
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it('never changes payment status', async () => {
    setOrder(paid('CONFIRMED'));
    await adminUpdateFulfillment('staff-1', ORDER_ID, {
      from: 'CONFIRMED',
      to: 'PROCESSING',
      note: null,
    });
    const { data } = db.order.updateMany.mock.calls[0]![0];
    expect(data).not.toHaveProperty('status');
    expect(data).not.toHaveProperty('paidAt');
  });

  it('409s when the order moved on since the staff member loaded it', async () => {
    setOrder(paid('SHIPPED'));
    await expect(
      adminUpdateFulfillment('staff-1', ORDER_ID, {
        from: 'PROCESSING',
        to: 'SHIPPED',
        note: null,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'STALE_STATUS' });
  });

  it('409s when a concurrent update wins the race', async () => {
    setOrder(paid('PROCESSING'));
    db.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      adminUpdateFulfillment('staff-1', ORDER_ID, {
        from: 'PROCESSING',
        to: 'SHIPPED',
        note: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.orderStatusEvent.create).not.toHaveBeenCalled();
    expect(notify.sendOrderNotification).not.toHaveBeenCalled();
  });

  it('404s for an unknown order', async () => {
    setOrder(null);
    await expect(
      adminUpdateFulfillment('staff-1', ORDER_ID, {
        from: 'CONFIRMED',
        to: 'PROCESSING',
        note: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('adminUpdateFulfillment — side effects', () => {
  it('stores tracking details and sends the shipment email once', async () => {
    setOrder(paid('PROCESSING'));
    await adminUpdateFulfillment('staff-1', ORDER_ID, {
      from: 'PROCESSING',
      to: 'SHIPPED',
      note: null,
      shippingCarrier: 'Delhivery',
      trackingNumber: 'DL1',
    });
    expect(db.order.updateMany.mock.calls[0]![0].data).toMatchObject({
      fulfillmentStatus: 'SHIPPED',
      shippingCarrier: 'Delhivery',
      trackingNumber: 'DL1',
    });
    expect(notify.sendOrderNotification).toHaveBeenCalledOnce();
    expect(notify.sendOrderNotification).toHaveBeenCalledWith(ORDER_ID, 'ORDER_SHIPPED');
  });

  it('sends no email for PROCESSING', async () => {
    setOrder(paid('CONFIRMED'));
    await adminUpdateFulfillment('staff-1', ORDER_ID, {
      from: 'CONFIRMED',
      to: 'PROCESSING',
      note: null,
    });
    expect(notify.sendOrderNotification).not.toHaveBeenCalled();
  });

  it('cancelling restocks tracked items, flags a refund, and emails the customer', async () => {
    setOrder(paid('CONFIRMED'));
    db.orderItem.findMany.mockResolvedValue([{ variantId: 'v1', quantity: 2 }]);
    await adminUpdateFulfillment('staff-1', ORDER_ID, {
      from: 'CONFIRMED',
      to: 'CANCELLED',
      note: 'Out of yarn',
    });
    expect(db.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'v1', stockQuantity: { not: null } },
      data: { stockQuantity: { increment: 2 } },
    });
    expect(db.order.updateMany.mock.calls[0]![0].data).toMatchObject({
      requiresReview: true,
      reviewReason: expect.stringContaining('REFUND_NEEDED'),
    });
    expect(notify.sendOrderNotification).toHaveBeenCalledWith(ORDER_ID, 'ORDER_CANCELLED');
  });

  it('an email failure does not undo the status change', async () => {
    setOrder(paid('SHIPPED'));
    notify.sendOrderNotification.mockResolvedValueOnce('failed');
    await expect(
      adminUpdateFulfillment('staff-1', ORDER_ID, { from: 'SHIPPED', to: 'DELIVERED', note: null }),
    ).resolves.toBeDefined();
    expect(db.order.updateMany).toHaveBeenCalledOnce();
  });
});

describe('adminListOrders', () => {
  it('paginates and applies filters', async () => {
    db.order.findMany.mockResolvedValue([]);
    db.order.count.mockResolvedValue(45);
    const result = await adminListOrders({
      page: 3,
      limit: 20,
      fulfillment: 'SHIPPED',
      review: true,
      search: 'SUS-1',
    });
    const args = db.order.findMany.mock.calls[0]![0];
    expect(args).toMatchObject({ skip: 40, take: 20 });
    expect(args.where).toMatchObject({ fulfillmentStatus: 'SHIPPED', requiresReview: true });
    expect(args.where.OR).toHaveLength(3);
    expect(result.pagination).toEqual({ page: 3, limit: 20, total: 45, totalPages: 3 });
  });
});
