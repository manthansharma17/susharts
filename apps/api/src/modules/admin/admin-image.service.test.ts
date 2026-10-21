import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  product: { findUnique: vi.fn() },
  productImage: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
};
vi.mock('@susharts/db', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const mockCloudinary = {
  CLOUDINARY_ROOT_FOLDER: 'susharts',
  uploadImage: vi.fn(),
  destroyImage: vi.fn(),
  getCloudinaryConfig: vi.fn(() => ({ cloudName: 'demo', apiKey: 'k', apiSecret: 's' })),
  publicIdFromUrl: vi.fn(() => 'susharts/products/p1/abc'),
};
vi.mock('../../lib/cloudinary.js', () => mockCloudinary);

const { adminDeleteImage, adminReorderImages, adminUploadImage, detectImageType } = await import(
  './admin-image.service.js'
);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

beforeEach(() => vi.clearAllMocks());

describe('detectImageType', () => {
  it('recognises JPEG, PNG, and WebP signatures', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(WEBP)).toBe('image/webp');
  });

  it('rejects other content even if it claims to be an image', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('adminUploadImage', () => {
  it('404s when the product does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);
    await expect(adminUploadImage('p1', { buffer: PNG }, null)).rejects.toMatchObject({ status: 404 });
    expect(mockCloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('rejects files whose bytes are not an allowed image type', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    await expect(
      adminUploadImage('p1', { buffer: Buffer.from('hello') }, null),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockCloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('rejects uploads beyond the per-product image limit', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    mockPrisma.productImage.aggregate.mockResolvedValue({ _count: 10, _max: { position: 9 } });
    await expect(adminUploadImage('p1', { buffer: PNG }, null)).rejects.toMatchObject({ status: 400 });
    expect(mockCloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('uploads under the product folder and appends after the last position', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    mockPrisma.productImage.aggregate.mockResolvedValue({ _count: 2, _max: { position: 4 } });
    mockCloudinary.uploadImage.mockResolvedValue({ url: 'https://res.cloudinary.com/demo/x.png' });
    mockPrisma.productImage.create.mockImplementation(({ data }) => Promise.resolve({ id: 'i1', ...data }));

    const image = await adminUploadImage('p1', { buffer: PNG }, 'A pink bunny');

    const [, type, publicId] = mockCloudinary.uploadImage.mock.calls[0]!;
    expect(type).toBe('image/png');
    expect(publicId).toMatch(/^susharts\/products\/p1\/[0-9a-f-]{36}$/);
    expect(image).toMatchObject({ productId: 'p1', position: 5, altText: 'A pink bunny' });
  });

  it('starts at position 0 for the first image', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    mockPrisma.productImage.aggregate.mockResolvedValue({ _count: 0, _max: { position: null } });
    mockCloudinary.uploadImage.mockResolvedValue({ url: 'u' });
    mockPrisma.productImage.create.mockImplementation(({ data }) => Promise.resolve(data));

    expect(await adminUploadImage('p1', { buffer: JPEG }, null)).toMatchObject({ position: 0 });
  });

  it('removes the uploaded asset if saving the row fails', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    mockPrisma.productImage.aggregate.mockResolvedValue({ _count: 0, _max: { position: null } });
    mockCloudinary.uploadImage.mockResolvedValue({ url: 'u' });
    mockPrisma.productImage.create.mockRejectedValue(new Error('db down'));

    await expect(adminUploadImage('p1', { buffer: PNG }, null)).rejects.toThrow('db down');
    expect(mockCloudinary.destroyImage).toHaveBeenCalledWith('susharts/products/p1/abc');
  });
});

describe('adminReorderImages', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

  it('rejects a list that does not match the product images exactly', async () => {
    mockPrisma.productImage.findMany.mockResolvedValue(ids.map((id) => ({ id })));

    for (const imageIds of [[ids[0]!], [ids[0]!, ids[0]!], [ids[0]!, '33333333-3333-4333-8333-333333333333']]) {
      await expect(adminReorderImages('p1', { imageIds })).rejects.toMatchObject({ status: 400 });
    }
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('404s for a product that does not exist', async () => {
    mockPrisma.productImage.findMany.mockResolvedValue([]);
    mockPrisma.product.findUnique.mockResolvedValue(null);
    await expect(adminReorderImages('p1', { imageIds: [ids[0]!] })).rejects.toMatchObject({ status: 404 });
  });

  it('writes positions in the requested order', async () => {
    mockPrisma.productImage.findMany.mockResolvedValue(ids.map((id) => ({ id })));
    mockPrisma.$transaction.mockResolvedValue([]);

    await adminReorderImages('p1', { imageIds: [ids[1]!, ids[0]!] });

    expect(mockPrisma.productImage.update).toHaveBeenNthCalledWith(1, { where: { id: ids[1] }, data: { position: 0 } });
    expect(mockPrisma.productImage.update).toHaveBeenNthCalledWith(2, { where: { id: ids[0] }, data: { position: 1 } });
  });
});

describe('adminDeleteImage', () => {
  it('404s for a missing image', async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue(null);
    await expect(adminDeleteImage('i1')).rejects.toMatchObject({ status: 404 });
  });

  it('deletes the row, closes position gaps, then deletes the asset', async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({ id: 'i1', productId: 'p1', url: 'u' });
    const tx = {
      productImage: {
        delete: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', position: 0 },
          { id: 'b', position: 2 },
        ]),
        update: vi.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation((fn: (t: typeof tx) => Promise<void>) => fn(tx));

    await adminDeleteImage('i1');

    expect(tx.productImage.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
    expect(tx.productImage.update).toHaveBeenCalledOnce();
    expect(tx.productImage.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { position: 1 } });
    expect(mockCloudinary.destroyImage).toHaveBeenCalledWith('susharts/products/p1/abc');
  });

  it('still succeeds if Cloudinary deletion fails', async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({ id: 'i1', productId: 'p1', url: 'u' });
    mockPrisma.$transaction.mockResolvedValue(undefined);
    mockCloudinary.destroyImage.mockRejectedValue(new Error('cloudinary down'));

    await expect(adminDeleteImage('i1')).resolves.toBeUndefined();
  });
});
