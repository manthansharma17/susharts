import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  product: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  category: { findUnique: vi.fn() },
  productVariant: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('@susharts/db', () => ({ prisma: mockPrisma }));

const {
  adminListProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminArchiveProduct,
  adminGetProduct,
  adminCreateVariant,
  adminUpdateVariant,
  adminDeleteVariant,
  adminUpdateInventory,
} = await import('./admin-product.service.js');

describe('adminCreateProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  const validProduct = {
    name: 'Test',
    slug: 'test',
    categoryId: 'cat-1',
    shortDescription: null,
    description: null,
    status: 'DRAFT' as const,
    fulfillmentType: 'READY_STOCK' as const,
    productionDays: null,
    metaTitle: null,
    metaDescription: null,
    position: 0,
  };

  it('creates a product when category exists', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    mockPrisma.product.create.mockResolvedValue({ id: 'prod-1', name: 'Test' });

    const result = await adminCreateProduct(validProduct);

    expect(result.id).toBe('prod-1');
    expect(mockPrisma.product.create).toHaveBeenCalledOnce();
  });

  it('throws 400 when category does not exist', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    await expect(
      adminCreateProduct({ ...validProduct, categoryId: 'bad-id' }),
    ).rejects.toThrow('Category not found');
  });
});

describe('adminUpdateProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a product', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    mockPrisma.product.update.mockResolvedValue({ id: 'prod-1', name: 'Updated' });

    const result = await adminUpdateProduct('prod-1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('throws 404 when product does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(adminUpdateProduct('bad-id', { name: 'X' })).rejects.toThrow(
      'Product not found',
    );
  });

  it('validates category exists when updating categoryId', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    mockPrisma.category.findUnique.mockResolvedValue(null);

    await expect(
      adminUpdateProduct('prod-1', { categoryId: 'bad-cat' }),
    ).rejects.toThrow('Category not found');
  });
});

describe('adminArchiveProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archives a product', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    mockPrisma.product.update.mockResolvedValue({ id: 'prod-1', status: 'ARCHIVED' });

    const result = await adminArchiveProduct('prod-1');
    expect(result.status).toBe('ARCHIVED');
  });

  it('throws 404 when product does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);
    await expect(adminArchiveProduct('bad-id')).rejects.toThrow('Product not found');
  });
});

describe('adminGetProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns product with variants and images', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      variants: [],
      images: [],
      category: { id: 'cat-1', parent: null },
    });

    const result = await adminGetProduct('prod-1');
    expect(result.id).toBe('prod-1');
  });

  it('throws 404 when product does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);
    await expect(adminGetProduct('bad-id')).rejects.toThrow('Product not found');
  });
});

describe('adminCreateVariant', () => {
  beforeEach(() => vi.clearAllMocks());

  const validVariant = {
    label: 'Default',
    sku: 'SKU-1',
    priceInPaise: 10000,
    compareAtPriceInPaise: null,
    stockQuantity: null,
    lowStockThreshold: 5,
    position: 0,
    isAvailable: true,
  };

  it('creates a variant', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    mockPrisma.productVariant.create.mockResolvedValue({ id: 'var-1', sku: 'SKU-1' });

    const result = await adminCreateVariant('prod-1', validVariant);

    expect(result.sku).toBe('SKU-1');
  });

  it('throws 404 when product does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      adminCreateVariant('bad-id', validVariant),
    ).rejects.toThrow('Product not found');
  });
});

describe('adminUpdateVariant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a variant', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({ id: 'var-1' });
    mockPrisma.productVariant.update.mockResolvedValue({ id: 'var-1', label: 'Large' });

    const result = await adminUpdateVariant('var-1', { label: 'Large' });
    expect(result.label).toBe('Large');
  });

  it('throws 404 when variant does not exist', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(null);
    await expect(adminUpdateVariant('bad-id', { label: 'X' })).rejects.toThrow(
      'Variant not found',
    );
  });
});

describe('adminDeleteVariant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a variant', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({ id: 'var-1' });
    mockPrisma.productVariant.delete.mockResolvedValue({});

    await adminDeleteVariant('var-1');
    expect(mockPrisma.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'var-1' } });
  });

  it('throws 404 when variant does not exist', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(null);
    await expect(adminDeleteVariant('bad-id')).rejects.toThrow('Variant not found');
  });
});

describe('adminUpdateInventory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates stock quantity', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({ id: 'var-1' });
    mockPrisma.productVariant.update.mockResolvedValue({ id: 'var-1', stockQuantity: 50 });

    const result = await adminUpdateInventory('var-1', { stockQuantity: 50 });
    expect(result.stockQuantity).toBe(50);
  });

  it('updates stock and availability together', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({ id: 'var-1' });
    mockPrisma.productVariant.update.mockResolvedValue({
      id: 'var-1',
      stockQuantity: 0,
      isAvailable: false,
    });

    const result = await adminUpdateInventory('var-1', {
      stockQuantity: 0,
      isAvailable: false,
    });
    expect(result.isAvailable).toBe(false);
  });

  it('allows setting stockQuantity to null (unlimited)', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue({ id: 'var-1' });
    mockPrisma.productVariant.update.mockResolvedValue({ id: 'var-1', stockQuantity: null });

    const result = await adminUpdateInventory('var-1', { stockQuantity: null });
    expect(result.stockQuantity).toBeNull();
  });

  it('throws 404 when variant does not exist', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(null);
    await expect(
      adminUpdateInventory('bad-id', { stockQuantity: 10 }),
    ).rejects.toThrow('Variant not found');
  });
});

describe('adminListProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes drafts, maps rows, and paginates', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        slug: 'bunny',
        name: 'Bunny',
        status: 'DRAFT',
        updatedAt: new Date('2026-10-01T00:00:00Z'),
        category: { name: 'Plushies' },
        images: [{ url: 'https://img/1.jpg' }],
        variants: [{ priceInPaise: 50000 }, { priceInPaise: 35000 }],
        _count: { images: 3 },
      },
    ]);
    mockPrisma.product.count.mockResolvedValue(21);

    const result = await adminListProducts({ page: 2, limit: 20 });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 20, take: 20 }),
    );
    expect(result.items[0]).toEqual({
      id: 'p1',
      slug: 'bunny',
      name: 'Bunny',
      status: 'DRAFT',
      categoryName: 'Plushies',
      heroImageUrl: 'https://img/1.jpg',
      imageCount: 3,
      variantCount: 2,
      minPriceInPaise: 35000,
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 });
  });

  it('filters by status and searches name or slug', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await adminListProducts({ page: 1, limit: 20, status: 'ACTIVE', search: 'rose' });

    const { where } = mockPrisma.product.findMany.mock.calls[0]![0];
    expect(where.status).toBe('ACTIVE');
    expect(where.OR).toHaveLength(2);
  });
});
