import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../middleware/auth.js';

const db = { order: { findMany: vi.fn(), count: vi.fn() } };
vi.mock('@susharts/db', () => ({ prisma: db }));
vi.mock('../../lib/firebase-admin.js', () => ({}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
const checkout = { getOrderSummary: vi.fn() };
vi.mock('../checkout/checkout.service.js', () => checkout);
const adminService = {
  adminListOrders: vi.fn().mockResolvedValue({ items: [], pagination: {} }),
  adminGetOrder: vi.fn().mockResolvedValue({}),
  adminUpdateFulfillment: vi.fn().mockResolvedValue({}),
  adminRetryOrderEmails: vi.fn().mockResolvedValue({}),
};
vi.mock('../admin/admin-order.service.js', () => adminService);

const { ordersRouter } = await import('./orders.routes.js');
const { adminOrderRouter } = await import('../admin/admin-order.routes.js');
const { errorHandler } = await import('../../middleware/error-handler.js');
const { HttpError } = await import('../../lib/http-error.js');

function appAs(role: AuthUser['role'] | null, id = 'customer-1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (role) req.user = { id, firebaseUid: 'f', email: 'a@b.c', role };
    next();
  });
  app.use('/orders', ordersRouter);
  app.use('/admin/orders', adminOrderRouter);
  app.use(errorHandler);
  return app;
}

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => vi.clearAllMocks());

describe('customer orders', () => {
  it('requires sign-in', async () => {
    expect((await request(appAs(null)).get('/orders')).status).toBe(401);
    expect((await request(appAs(null)).get(`/orders/${ORDER_ID}`)).status).toBe(401);
  });

  it('lists only the signed-in customer’s orders with pagination', async () => {
    db.order.findMany.mockResolvedValue([
      {
        id: ORDER_ID,
        orderNumber: 'SUS-1',
        status: 'PAID',
        fulfillmentStatus: 'SHIPPED',
        totalInPaise: 139800,
        createdAt: new Date('2026-10-01'),
        paidAt: new Date('2026-10-01'),
        items: [
          { productName: 'Tulip', quantity: 2 },
          { productName: 'Rose', quantity: 1 },
        ],
      },
    ]);
    db.order.count.mockResolvedValue(11);
    const res = await request(appAs('CUSTOMER', 'me')).get(
      '/orders?page=2&limit=5&userId=someone-else',
    );
    expect(res.status).toBe(200);
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'me' }, skip: 5, take: 5 }),
    );
    expect(res.body.pagination).toEqual({ page: 2, limit: 5, total: 11, totalPages: 3 });
    expect(res.body.items[0]).toMatchObject({
      itemCount: 3,
      firstItemName: 'Tulip',
      fulfillmentStatus: 'SHIPPED',
    });
  });

  it('rejects an out-of-range page size', async () => {
    expect((await request(appAs('CUSTOMER')).get('/orders?limit=500')).status).toBe(400);
  });

  it('looks up details scoped to the signed-in customer', async () => {
    checkout.getOrderSummary.mockResolvedValue({ id: ORDER_ID });
    await request(appAs('CUSTOMER', 'me')).get(`/orders/${ORDER_ID}`);
    expect(checkout.getOrderSummary).toHaveBeenCalledWith('me', ORDER_ID);
  });

  it('404s for another customer’s order (no information leak)', async () => {
    checkout.getOrderSummary.mockRejectedValue(HttpError.notFound('Order not found'));
    const res = await request(appAs('CUSTOMER', 'intruder')).get(`/orders/${ORDER_ID}`);
    expect(res.status).toBe(404);
  });

  it('404s for a malformed id without querying', async () => {
    expect((await request(appAs('CUSTOMER')).get('/orders/not-a-uuid')).status).toBe(404);
    expect(checkout.getOrderSummary).not.toHaveBeenCalled();
  });
});

describe('admin orders authorization and validation', () => {
  it.each([
    ['get', '/admin/orders'],
    ['get', `/admin/orders/${ORDER_ID}`],
    ['patch', `/admin/orders/${ORDER_ID}/fulfillment`],
    ['post', `/admin/orders/${ORDER_ID}/notifications/retry`],
  ] as const)('%s %s: 401 signed out, 403 for customers', async (method, path) => {
    expect((await request(appAs(null))[method](path).send({})).status).toBe(401);
    expect((await request(appAs('CUSTOMER'))[method](path).send({})).status).toBe(403);
    expect(Object.values(adminService).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it('passes the acting staff member through for the audit trail', async () => {
    await request(appAs('STAFF', 'staff-9'))
      .patch(`/admin/orders/${ORDER_ID}/fulfillment`)
      .send({ from: 'CONFIRMED', to: 'PROCESSING' });
    expect(adminService.adminUpdateFulfillment).toHaveBeenCalledWith(
      'staff-9',
      ORDER_ID,
      expect.objectContaining({ from: 'CONFIRMED', to: 'PROCESSING' }),
    );
  });

  it.each([
    ['a payment status as target', { from: 'CONFIRMED', to: 'PAID' }],
    ['CONFIRMED as target', { from: 'PROCESSING', to: 'CONFIRMED' }],
    ['a missing from', { to: 'PROCESSING' }],
    ['cancellation without a reason', { from: 'CONFIRMED', to: 'CANCELLED' }],
  ])('rejects %s', async (_label, body) => {
    const res = await request(appAs('ADMIN'))
      .patch(`/admin/orders/${ORDER_ID}/fulfillment`)
      .send(body);
    expect(res.status).toBe(400);
    expect(adminService.adminUpdateFulfillment).not.toHaveBeenCalled();
  });

  it('validates list filters', async () => {
    expect((await request(appAs('ADMIN')).get('/admin/orders?fulfillment=LOST')).status).toBe(400);
    expect((await request(appAs('ADMIN')).get('/admin/orders?status=PAID&page=2')).status).toBe(
      200,
    );
  });
});
