import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../middleware/auth.js';

vi.mock('@susharts/db', () => ({ prisma: {} }));
vi.mock('../../lib/firebase-admin.js', () => ({}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const empty = { items: [], subtotalInPaise: 0, itemCount: 0, hasIssues: false, removedVariantIds: [] };
const mockService = {
  getCart: vi.fn().mockResolvedValue(empty),
  addCartItem: vi.fn().mockResolvedValue(empty),
  setCartItemQuantity: vi.fn().mockResolvedValue(empty),
  removeCartItem: vi.fn().mockResolvedValue(empty),
  clearCart: vi.fn().mockResolvedValue(empty),
  mergeGuestCart: vi.fn().mockResolvedValue(empty),
  previewGuestCart: vi.fn().mockResolvedValue(empty),
};
vi.mock('./cart.service.js', () => mockService);

const { cartRouter } = await import('./cart.routes.js');
const { errorHandler } = await import('../../middleware/error-handler.js');

function appAs(role: AuthUser['role'] | null, id = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (role) req.user = { id, firebaseUid: 'f', email: 'a@b.c', role };
    next();
  });
  app.use('/cart', cartRouter);
  app.use(errorHandler);
  return app;
}

const V1 = '11111111-1111-4111-8111-111111111111';

beforeEach(() => vi.clearAllMocks());

describe('authorization', () => {
  it.each([
    ['get', '/cart'],
    ['delete', '/cart'],
    ['post', '/cart/items'],
    ['patch', `/cart/items/${V1}`],
    ['delete', `/cart/items/${V1}`],
    ['post', '/cart/merge'],
  ] as const)('%s %s requires sign-in', async (method, path) => {
    const res = await request(appAs(null))[method](path).send({});
    expect(res.status).toBe(401);
    expect(Object.values(mockService).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it('always acts on the signed-in user, never a client-supplied user id', async () => {
    await request(appAs('CUSTOMER', 'me'))
      .post('/cart/items')
      .send({ variantId: V1, quantity: 1, userId: 'someone-else' });
    expect(mockService.addCartItem).toHaveBeenCalledWith('me', { variantId: V1, quantity: 1 });
  });

  it('lets guests preview a cart without signing in', async () => {
    const res = await request(appAs(null)).post('/cart/preview').send({ items: [{ variantId: V1, quantity: 2 }] });
    expect(res.status).toBe(200);
    expect(mockService.previewGuestCart).toHaveBeenCalledOnce();
  });
});

describe('validation', () => {
  it.each([
    ['missing variant', {}],
    ['non-UUID variant', { variantId: 'abc', quantity: 1 }],
    ['zero quantity', { variantId: V1, quantity: 0 }],
    ['fractional quantity', { variantId: V1, quantity: 1.5 }],
    ['over the line limit', { variantId: V1, quantity: 21 }],
  ])('rejects %s', async (_label, body) => {
    const res = await request(appAs('CUSTOMER')).post('/cart/items').send(body);
    expect(res.status).toBe(400);
    expect(mockService.addCartItem).not.toHaveBeenCalled();
  });

  it('ignores any price sent by the client', async () => {
    await request(appAs('CUSTOMER')).post('/cart/items').send({ variantId: V1, quantity: 1, priceInPaise: 1 });
    expect(mockService.addCartItem).toHaveBeenCalledWith('user-1', { variantId: V1, quantity: 1 });
  });

  it('404s for a malformed variant id in the path', async () => {
    const res = await request(appAs('CUSTOMER')).patch('/cart/items/nope').send({ quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('rejects an oversized guest cart', async () => {
    const items = Array.from({ length: 51 }, () => ({ variantId: V1, quantity: 1 }));
    expect((await request(appAs(null)).post('/cart/preview').send({ items })).status).toBe(400);
  });
});
