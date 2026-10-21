import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../middleware/auth.js';

vi.mock('@susharts/db', () => ({ prisma: {} }));
vi.mock('../../lib/firebase-admin.js', () => ({}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const service = {
  listProductReviews: vi.fn().mockResolvedValue({ items: [] }),
  createReview: vi.fn().mockResolvedValue({ id: 'r1' }),
  updateOwnReview: vi.fn().mockResolvedValue({ id: 'r1' }),
  deleteOwnReview: vi.fn().mockResolvedValue(undefined),
  refreshAggregates: vi.fn(),
};
vi.mock('./review.service.js', () => service);

const admin = {
  adminListReviews: vi.fn().mockResolvedValue({ items: [] }),
  adminModerateReview: vi.fn().mockResolvedValue({ id: 'r1' }),
  adminDeleteReview: vi.fn().mockResolvedValue(undefined),
};
vi.mock('../admin/admin-review.service.js', () => admin);

const { productReviewRouter, reviewRouter } = await import('./review.routes.js');
const { adminReviewRouter } = await import('../admin/admin-review.routes.js');
const { errorHandler } = await import('../../middleware/error-handler.js');

function appAs(role: AuthUser['role'] | null, id = 'u1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (role) req.user = { id, firebaseUid: 'f', email: 'a@b.c', role };
    next();
  });
  app.use('/products/:slug/reviews', productReviewRouter);
  app.use('/reviews', reviewRouter);
  app.use('/admin/reviews', adminReviewRouter);
  app.use(errorHandler);
  return app;
}

const ID = '11111111-1111-4111-8111-111111111111';
const valid = { rating: 5, title: 'Lovely', body: 'So pretty' };

beforeEach(() => vi.clearAllMocks());

describe('public review reading', () => {
  it('is readable without signing in, with no viewer id', async () => {
    const res = await request(appAs(null)).get('/products/tulip/reviews');
    expect(res.status).toBe(200);
    expect(service.listProductReviews).toHaveBeenCalledWith('tulip', expect.anything(), null);
  });

  it('passes the signed-in customer through', async () => {
    await request(appAs('CUSTOMER', 'me')).get('/products/tulip/reviews');
    expect(service.listProductReviews).toHaveBeenCalledWith('tulip', expect.anything(), 'me');
  });

  it('rejects an invalid sort or page size', async () => {
    expect((await request(appAs(null)).get('/products/tulip/reviews?sort=best')).status).toBe(400);
    expect((await request(appAs(null)).get('/products/tulip/reviews?limit=999')).status).toBe(400);
  });
});

describe('writing a review', () => {
  it('requires sign-in', async () => {
    expect((await request(appAs(null)).post('/products/tulip/reviews').send(valid)).status).toBe(
      401,
    );
    expect(service.createReview).not.toHaveBeenCalled();
  });

  it('always uses the signed-in user, never a client-supplied id', async () => {
    await request(appAs('CUSTOMER', 'me'))
      .post('/products/tulip/reviews')
      .send({ ...valid, userId: 'someone-else', status: 'PUBLISHED' });
    expect(service.createReview).toHaveBeenCalledWith('me', 'tulip', {
      rating: 5,
      title: 'Lovely',
      body: 'So pretty',
    });
  });

  it.each([
    ['no rating', { title: 'x' }],
    ['rating 0', { rating: 0 }],
    ['rating 6', { rating: 6 }],
    ['fractional rating', { rating: 4.5 }],
    ['an over-long body', { rating: 5, body: 'x'.repeat(2001) }],
  ])('rejects %s', async (_label, body) => {
    const res = await request(appAs('CUSTOMER')).post('/products/tulip/reviews').send(body);
    expect(res.status).toBe(400);
    expect(service.createReview).not.toHaveBeenCalled();
  });

  it('requires sign-in to edit or delete, and scopes to the owner', async () => {
    expect((await request(appAs(null)).patch(`/reviews/${ID}`).send(valid)).status).toBe(401);
    expect((await request(appAs(null)).delete(`/reviews/${ID}`)).status).toBe(401);

    await request(appAs('CUSTOMER', 'me')).delete(`/reviews/${ID}`);
    expect(service.deleteOwnReview).toHaveBeenCalledWith('me', ID);
  });

  it('404s for a malformed review id', async () => {
    expect((await request(appAs('CUSTOMER')).delete('/reviews/nope')).status).toBe(404);
  });
});

describe('admin moderation authorization', () => {
  it.each([
    ['get', '/admin/reviews'],
    ['patch', `/admin/reviews/${ID}`],
    ['delete', `/admin/reviews/${ID}`],
  ] as const)('%s %s: 401 signed out, 403 for customers', async (method, path) => {
    expect((await request(appAs(null))[method](path).send({})).status).toBe(401);
    expect((await request(appAs('CUSTOMER'))[method](path).send({})).status).toBe(403);
    expect(Object.values(admin).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it('requires a reason when hiding a review', async () => {
    const res = await request(appAs('ADMIN'))
      .patch(`/admin/reviews/${ID}`)
      .send({ status: 'HIDDEN' });
    expect(res.status).toBe(400);
    expect(admin.adminModerateReview).not.toHaveBeenCalled();
  });

  it('hides a review with a reason, recording the moderator', async () => {
    const res = await request(appAs('STAFF', 'staff-7'))
      .patch(`/admin/reviews/${ID}`)
      .send({ status: 'HIDDEN', reason: 'Abusive language' });
    expect(res.status).toBe(200);
    expect(admin.adminModerateReview).toHaveBeenCalledWith('staff-7', ID, {
      status: 'HIDDEN',
      reason: 'Abusive language',
    });
  });

  it('restores a review without a reason', async () => {
    const res = await request(appAs('ADMIN'))
      .patch(`/admin/reviews/${ID}`)
      .send({ status: 'PUBLISHED' });
    expect(res.status).toBe(200);
  });

  it('rejects an unknown status', async () => {
    expect(
      (await request(appAs('ADMIN')).patch(`/admin/reviews/${ID}`).send({ status: 'DELETED' }))
        .status,
    ).toBe(400);
  });

  it('permanently deletes for admins', async () => {
    expect((await request(appAs('ADMIN')).delete(`/admin/reviews/${ID}`)).status).toBe(204);
    expect(admin.adminDeleteReview).toHaveBeenCalledWith(ID);
  });
});
