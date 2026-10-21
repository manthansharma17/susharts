import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../middleware/auth.js';

const mockPrisma = {
  category: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn().mockResolvedValue({ _max: { position: null } }),
  },
  $transaction: vi.fn(),
};
vi.mock('@susharts/db', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/firebase-admin.js', () => ({}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { adminCategoryRouter } = await import('./admin-category.routes.js');
const { errorHandler } = await import('../../middleware/error-handler.js');

function appAs(role: AuthUser['role'] | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (role) req.user = { id: 'u1', firebaseUid: 'f1', email: 'a@b.c', role };
    next();
  });
  app.use('/admin/categories', adminCategoryRouter);
  app.use(errorHandler);
  return app;
}

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const body = { name: 'Flowers', slug: 'flowers' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.category.aggregate.mockResolvedValue({ _max: { position: null } });
});

describe('POST /admin/categories', () => {
  it('401s without authentication and 403s for customers', async () => {
    expect((await request(appAs(null)).post('/admin/categories').send(body)).status).toBe(401);
    expect((await request(appAs('CUSTOMER')).post('/admin/categories').send(body)).status).toBe(403);
    expect(mockPrisma.category.create).not.toHaveBeenCalled();
  });

  it('creates a top-level category', async () => {
    mockPrisma.category.create.mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data }));
    const res = await request(appAs('ADMIN')).post('/admin/categories').send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Flowers', slug: 'flowers', parentId: null });
  });

  it('rejects an invalid slug', async () => {
    const res = await request(appAs('ADMIN')).post('/admin/categories').send({ ...body, slug: 'Bad Slug' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing parent', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    const res = await request(appAs('ADMIN'))
      .post('/admin/categories')
      .send({ ...body, parentId: PARENT_ID });
    expect(res.status).toBe(400);
  });

  it('rejects a third nesting level', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: PARENT_ID, parentId: 'root', isArchived: false });
    const res = await request(appAs('ADMIN'))
      .post('/admin/categories')
      .send({ ...body, parentId: PARENT_ID });
    expect(res.status).toBe(400);
    expect(mockPrisma.category.create).not.toHaveBeenCalled();
  });

  it('answers 409 for a duplicate slug', async () => {
    mockPrisma.category.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['slug'] } }),
    );
    const res = await request(appAs('ADMIN')).post('/admin/categories').send(body);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: 'A record with this slug already exists' });
  });
});

const CAT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';

describe('GET /admin/categories', () => {
  it('returns a tree including archived categories with product counts', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      { id: PARENT_ID, parentId: null, slug: 'a', name: 'A', description: null, position: 0, isArchived: false, _count: { products: 2 } },
      { id: CAT_ID, parentId: PARENT_ID, slug: 'b', name: 'B', description: null, position: 0, isArchived: true, _count: { products: 0 } },
    ]);
    const res = await request(appAs('ADMIN')).get('/admin/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: PARENT_ID, productCount: 2 });
    expect(res.body[0].children[0]).toMatchObject({ id: CAT_ID, isArchived: true });
  });

  it('403s for customers', async () => {
    expect((await request(appAs('CUSTOMER')).get('/admin/categories')).status).toBe(403);
  });
});

describe('PATCH /admin/categories/:id', () => {
  it('renames and archives', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: CAT_ID, parentId: null, _count: { children: 0 } });
    mockPrisma.category.update.mockResolvedValue({ id: CAT_ID });
    const res = await request(appAs('ADMIN'))
      .patch(`/admin/categories/${CAT_ID}`)
      .send({ name: 'New name', isArchived: true });
    expect(res.status).toBe(200);
    expect(mockPrisma.category.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { name: 'New name', isArchived: true },
    });
  });

  it('refuses to nest a category that has its own sub-categories', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: CAT_ID, parentId: null, _count: { children: 1 } });
    const res = await request(appAs('ADMIN')).patch(`/admin/categories/${CAT_ID}`).send({ parentId: OTHER_ID });
    expect(res.status).toBe(400);
    expect(mockPrisma.category.update).not.toHaveBeenCalled();
  });

  it('refuses to place a category inside itself', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: CAT_ID, parentId: null, _count: { children: 0 } });
    const res = await request(appAs('ADMIN')).patch(`/admin/categories/${CAT_ID}`).send({ parentId: CAT_ID });
    expect(res.status).toBe(400);
  });

  it('404s for unknown and malformed ids', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    expect((await request(appAs('ADMIN')).patch(`/admin/categories/${CAT_ID}`).send({ name: 'x' })).status).toBe(404);
    expect((await request(appAs('ADMIN')).patch('/admin/categories/nope').send({ name: 'x' })).status).toBe(404);
  });

  it('rejects an empty body', async () => {
    expect((await request(appAs('ADMIN')).patch(`/admin/categories/${CAT_ID}`).send({})).status).toBe(400);
  });
});

describe('PUT /admin/categories/order', () => {
  it('rejects a list that is not exactly the siblings', async () => {
    mockPrisma.category.findMany.mockResolvedValue([{ id: CAT_ID }, { id: OTHER_ID }]);
    const res = await request(appAs('ADMIN'))
      .put('/admin/categories/order')
      .send({ parentId: null, categoryIds: [CAT_ID] });
    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes positions in order', async () => {
    mockPrisma.category.findMany.mockResolvedValue([{ id: CAT_ID }, { id: OTHER_ID }]);
    mockPrisma.$transaction.mockResolvedValue([]);
    const res = await request(appAs('ADMIN'))
      .put('/admin/categories/order')
      .send({ parentId: null, categoryIds: [OTHER_ID, CAT_ID] });
    expect(res.status).toBe(204);
    expect(mockPrisma.category.update).toHaveBeenNthCalledWith(1, { where: { id: OTHER_ID }, data: { position: 0 } });
  });
});

describe('DELETE /admin/categories/:id', () => {
  it('409s when the category still has products', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: CAT_ID, _count: { products: 3, children: 0 } });
    const res = await request(appAs('ADMIN')).delete(`/admin/categories/${CAT_ID}`);
    expect(res.status).toBe(409);
    expect(mockPrisma.category.delete).not.toHaveBeenCalled();
  });

  it('409s when the category has sub-categories', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: CAT_ID, _count: { products: 0, children: 1 } });
    expect((await request(appAs('ADMIN')).delete(`/admin/categories/${CAT_ID}`)).status).toBe(409);
  });

  it('deletes an empty category', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: CAT_ID, _count: { products: 0, children: 0 } });
    expect((await request(appAs('ADMIN')).delete(`/admin/categories/${CAT_ID}`)).status).toBe(204);
    expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: CAT_ID } });
  });
});
