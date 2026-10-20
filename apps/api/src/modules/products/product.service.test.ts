import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Prisma before importing the service.
const mockPrisma = {
  product: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  category: { findUnique: vi.fn() },
};

vi.mock('@susharts/db', () => ({ prisma: mockPrisma }));

// Import after the mock is registered.
const { listProducts, getProductBySlug } = await import('./product.service.js');

const baseProduct = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'crochet-flower',
  name: 'Crochet Flower',
  shortDescription: 'A handmade flower',
  status: 'ACTIVE',
  fulfillmentType: 'READY_STOCK',
  categoryId: '00000000-0000-0000-0000-000000000010',
  createdAt: new Date('2026-01-01'),
  images: [{ id: 'img1', url: 'https://cdn.example.com/img.jpg', altText: 'flower', position: 0 }],
  variants: [
    {
      id: 'var1',
      label: 'Default',
      sku: 'CF-001',
      priceInPaise: 29900,
      compareAtPriceInPaise: null,
      stockQuantity: 5,
      isAvailable: true,
      position: 0,
    },
  ],
};

describe('listProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated results for an empty query', async () => {
    mockPrisma.product.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([baseProduct]);

    const result = await listProducts({
      page: 1,
      limit: 20,
      sort: 'position',
      order: 'asc',
    });

    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.slug).toBe('crochet-flower');
    expect(result.items[0]!.minPriceInPaise).toBe(29900);
    expect(result.items[0]!.isAvailable).toBe(true);
    expect(result.items[0]!.heroImage).toEqual(baseProduct.images[0]);
  });

  it('filters by category slug including children', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: 'cat1',
      children: [{ id: 'cat2' }],
    });
    mockPrisma.product.count.mockResolvedValue(0);
    mockPrisma.product.findMany.mockResolvedValue([]);

    await listProducts({
      page: 1,
      limit: 20,
      sort: 'position',
      order: 'asc',
      category: 'crochet',
    });

    const countCall = mockPrisma.product.count.mock.calls[0]![0]!;
    expect(countCall.where.categoryId).toEqual({ in: ['cat1', 'cat2'] });
  });

  it('returns empty for unknown category slug', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const result = await listProducts({
      page: 1,
      limit: 20,
      sort: 'position',
      order: 'asc',
      category: 'unknown',
    });

    expect(result.items).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('picks the lowest available variant price', async () => {
    const product = {
      ...baseProduct,
      variants: [
        { ...baseProduct.variants[0]!, priceInPaise: 50000, position: 0 },
        { ...baseProduct.variants[0]!, id: 'var2', priceInPaise: 29900, position: 1 },
      ],
    };
    mockPrisma.product.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([product]);

    const result = await listProducts({
      page: 1,
      limit: 20,
      sort: 'position',
      order: 'asc',
    });

    expect(result.items[0]!.minPriceInPaise).toBe(29900);
  });

  it('sets isAvailable false when no variants are available', async () => {
    const product = {
      ...baseProduct,
      variants: [{ ...baseProduct.variants[0]!, isAvailable: false }],
    };
    mockPrisma.product.count.mockResolvedValue(1);
    mockPrisma.product.findMany.mockResolvedValue([product]);

    const result = await listProducts({
      page: 1,
      limit: 20,
      sort: 'position',
      order: 'asc',
    });

    expect(result.items[0]!.isAvailable).toBe(false);
  });
});

describe('getProductBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns product detail for an active product', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...baseProduct,
      description: 'A detailed description',
      productionDays: null,
      metaTitle: null,
      metaDescription: null,
      category: {
        id: 'cat1',
        slug: 'crochet',
        name: 'Crochet',
        parent: null,
      },
    });

    const result = await getProductBySlug('crochet-flower');

    expect(result.slug).toBe('crochet-flower');
    expect(result.description).toBe('A detailed description');
    expect(result.variants).toEqual(baseProduct.variants);
    expect(result.category.slug).toBe('crochet');
  });

  it('throws 404 for a non-existent slug', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(getProductBySlug('nonexistent')).rejects.toThrow('Product not found');
  });

  it('throws 404 for a draft product', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...baseProduct,
      status: 'DRAFT',
      description: null,
      productionDays: null,
      metaTitle: null,
      metaDescription: null,
      category: { id: 'cat1', slug: 'crochet', name: 'Crochet', parent: null },
    });

    await expect(getProductBySlug('crochet-flower')).rejects.toThrow('Product not found');
  });
});
