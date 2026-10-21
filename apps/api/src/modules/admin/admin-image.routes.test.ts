import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../middleware/auth.js';

vi.mock('@susharts/db', () => ({ prisma: {} }));
vi.mock('../../lib/firebase-admin.js', () => ({}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const mockService = {
  adminUploadImage: vi.fn(),
  adminUpdateImage: vi.fn(),
  adminReorderImages: vi.fn(),
  adminDeleteImage: vi.fn(),
  adminReplaceImage: vi.fn(),
};
vi.mock('./admin-image.service.js', () => mockService);

const { adminProductRouter } = await import('./admin-product.routes.js');
const { errorHandler } = await import('../../middleware/error-handler.js');

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function appAs(role: AuthUser['role'] | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (role) req.user = { id: 'u1', firebaseUid: 'f1', email: 'a@b.c', role };
    next();
  });
  app.use('/admin/products', adminProductRouter);
  app.use(errorHandler);
  return app;
}

const url = `/admin/products/${PRODUCT_ID}/images`;

beforeEach(() => vi.clearAllMocks());

describe('POST /admin/products/:productId/images', () => {
  it('401s without authentication', async () => {
    const res = await request(appAs(null)).post(url).attach('image', PNG, 'a.png');
    expect(res.status).toBe(401);
    expect(mockService.adminUploadImage).not.toHaveBeenCalled();
  });

  it('403s for customers', async () => {
    const res = await request(appAs('CUSTOMER')).post(url).attach('image', PNG, 'a.png');
    expect(res.status).toBe(403);
    expect(mockService.adminUploadImage).not.toHaveBeenCalled();
  });

  it('uploads for staff and passes alt text through', async () => {
    mockService.adminUploadImage.mockResolvedValue({ id: 'i1' });
    const res = await request(appAs('STAFF'))
      .post(url)
      .field('altText', '  Pink bunny  ')
      .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const [productId, file, altText] = mockService.adminUploadImage.mock.calls[0]!;
    expect(productId).toBe(PRODUCT_ID);
    expect(Buffer.compare(file.buffer, PNG)).toBe(0);
    expect(altText).toBe('Pink bunny');
  });

  it('413s for files over the size limit', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await request(appAs('ADMIN'))
      .post(url)
      .attach('image', big, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('400s for disallowed MIME types', async () => {
    const res = await request(appAs('ADMIN'))
      .post(url)
      .attach('image', Buffer.from('<svg/>'), { filename: 'a.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(mockService.adminUploadImage).not.toHaveBeenCalled();
  });

  it('400s when no file is sent', async () => {
    const res = await request(appAs('ADMIN')).post(url).field('altText', 'x');
    expect(res.status).toBe(400);
  });

  it('404s for a malformed product id', async () => {
    const res = await request(appAs('ADMIN'))
      .post('/admin/products/not-a-uuid/images')
      .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });
});

describe('other image routes', () => {
  it('validates the reorder body', async () => {
    const res = await request(appAs('ADMIN'))
      .put(`${url}/order`)
      .send({ imageIds: ['nope'] });
    expect(res.status).toBe(400);
    expect(mockService.adminReorderImages).not.toHaveBeenCalled();
  });

  it('deletes an image for admins', async () => {
    const res = await request(appAs('ADMIN')).delete(`/admin/products/images/${PRODUCT_ID}`);
    expect(res.status).toBe(204);
    expect(mockService.adminDeleteImage).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it('403s image deletion for customers', async () => {
    const res = await request(appAs('CUSTOMER')).delete(`/admin/products/images/${PRODUCT_ID}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /admin/products', () => {
  it('401s without authentication', async () => {
    expect((await request(appAs(null)).get('/admin/products')).status).toBe(401);
  });

  it('403s for customers', async () => {
    expect((await request(appAs('CUSTOMER')).get('/admin/products')).status).toBe(403);
  });

  it('400s for an invalid status filter', async () => {
    expect((await request(appAs('ADMIN')).get('/admin/products?status=DELETED')).status).toBe(400);
  });
});

describe('malformed ids', () => {
  it('404s instead of 500 for a non-UUID product id', async () => {
    const res = await request(appAs('ADMIN')).get('/admin/products/:id');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Product not found');
  });
});

describe('PUT /admin/products/images/:imageId/file', () => {
  const path = `/admin/products/images/${PRODUCT_ID}/file`;

  it('403s for customers', async () => {
    const res = await request(appAs('CUSTOMER'))
      .put(path)
      .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });

  it('replaces the file for admins', async () => {
    mockService.adminReplaceImage.mockResolvedValue({ id: PRODUCT_ID });
    const res = await request(appAs('ADMIN'))
      .put(path)
      .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
  });

  it('400s without a file', async () => {
    expect((await request(appAs('ADMIN')).put(path)).status).toBe(400);
  });
});
