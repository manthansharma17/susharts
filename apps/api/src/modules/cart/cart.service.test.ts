import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartVariant } from './cart.service.js';

const mockPrisma = {
  productVariant: { findUnique: vi.fn(), findMany: vi.fn() },
  cartItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock('@susharts/db', () => ({ prisma: mockPrisma }));

const {
  addCartItem,
  assertCanHold,
  buildCart,
  mergeGuestCart,
  previewGuestCart,
  setCartItemQuantity,
  toCartLine,
} = await import('./cart.service.js');

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

function variant(overrides: Partial<CartVariant> & { status?: CartVariant['product']['status'] } = {}): CartVariant {
  const { status = 'ACTIVE', ...rest } = overrides;
  return {
    id: V1,
    label: 'Default',
    sku: 'SKU-1',
    priceInPaise: 24900,
    compareAtPriceInPaise: null,
    stockQuantity: 5,
    isAvailable: true,
    product: {
      id: 'p1',
      slug: 'tulip',
      name: 'Tulip',
      status,
      fulfillmentType: 'READY_STOCK',
      productionDays: null,
      images: [{ url: 'https://img/1.jpg' }],
    },
    ...rest,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.cartItem.findMany.mockResolvedValue([]);
  mockPrisma.productVariant.findMany.mockResolvedValue([]);
});

describe('toCartLine', () => {
  it('prices the line from the variant in integer paise', () => {
    const line = toCartLine(variant(), 3);
    expect(line.lineTotalInPaise).toBe(74700);
    expect(line.issue).toBeNull();
    expect(line.product.heroImageUrl).toBe('https://img/1.jpg');
  });

  it('flags unavailable variants and inactive products', () => {
    expect(toCartLine(variant({ isAvailable: false }), 1).issue).toBe('UNAVAILABLE');
    expect(toCartLine(variant({ status: 'DRAFT' }), 1).issue).toBe('UNAVAILABLE');
    expect(toCartLine(variant({ status: 'ARCHIVED' }), 1).issue).toBe('UNAVAILABLE');
  });

  it('flags quantities above stock, but not unlimited (made-to-order) stock', () => {
    expect(toCartLine(variant({ stockQuantity: 2 }), 3).issue).toBe('INSUFFICIENT_STOCK');
    expect(toCartLine(variant({ stockQuantity: 0 }), 1).issue).toBe('INSUFFICIENT_STOCK');
    expect(toCartLine(variant({ stockQuantity: null }), 20).issue).toBeNull();
  });
});

describe('buildCart', () => {
  it('excludes lines with issues from the subtotal and reports removed variants', () => {
    const cart = buildCart(
      [
        { variantId: V1, quantity: 2 },
        { variantId: V2, quantity: 1 },
        { variantId: 'gone', quantity: 1 },
      ],
      [variant(), variant({ id: V2, priceInPaise: 10000, isAvailable: false })],
    );
    expect(cart.subtotalInPaise).toBe(49800);
    expect(cart.itemCount).toBe(3);
    expect(cart.hasIssues).toBe(true);
    expect(cart.removedVariantIds).toEqual(['gone']);
  });

  it('handles an empty cart', () => {
    expect(buildCart([], [])).toEqual({
      items: [],
      subtotalInPaise: 0,
      itemCount: 0,
      hasIssues: false,
      removedVariantIds: [],
    });
  });
});

describe('assertCanHold', () => {
  it.each([
    ['inactive product', variant({ status: 'DRAFT' }), 1, 409],
    ['switched-off variant', variant({ isAvailable: false }), 1, 409],
    ['over the per-line limit', variant({ stockQuantity: null }), 21, 400],
    ['over stock', variant({ stockQuantity: 2 }), 3, 409],
    ['out of stock', variant({ stockQuantity: 0 }), 1, 409],
  ])('rejects %s', (_label, v, qty, status) => {
    expect(() => assertCanHold(v, qty)).toThrow(expect.objectContaining({ status }));
  });

  it('accepts quantities within stock and unlimited stock', () => {
    expect(() => assertCanHold(variant({ stockQuantity: 3 }), 3)).not.toThrow();
    expect(() => assertCanHold(variant({ stockQuantity: null }), 20)).not.toThrow();
  });
});

describe('addCartItem', () => {
  it('adds to an existing line and validates the combined quantity against stock', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(variant({ stockQuantity: 5 }));
    mockPrisma.cartItem.findUnique.mockResolvedValue({ id: 'c1', quantity: 4 });

    await expect(addCartItem('u1', { variantId: V1, quantity: 2 })).rejects.toMatchObject({
      status: 409,
      code: 'INSUFFICIENT_STOCK',
      details: { availableQuantity: 5 },
    });
    expect(mockPrisma.cartItem.upsert).not.toHaveBeenCalled();
  });

  it('upserts the summed quantity for the signed-in user only', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(variant());
    mockPrisma.cartItem.findUnique.mockResolvedValue({ id: 'c1', quantity: 1 });

    await addCartItem('u1', { variantId: V1, quantity: 2 });

    expect(mockPrisma.cartItem.upsert).toHaveBeenCalledWith({
      where: { userId_variantId: { userId: 'u1', variantId: V1 } },
      create: { userId: 'u1', variantId: V1, quantity: 3 },
      update: { quantity: 3 },
    });
  });

  it('404s for unknown variants', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(null);
    await expect(addCartItem('u1', { variantId: V1, quantity: 1 })).rejects.toMatchObject({ status: 404 });
  });

  it('enforces the maximum number of lines', async () => {
    mockPrisma.productVariant.findUnique.mockResolvedValue(variant());
    mockPrisma.cartItem.findUnique.mockResolvedValue(null);
    mockPrisma.cartItem.count.mockResolvedValue(50);
    await expect(addCartItem('u1', { variantId: V1, quantity: 1 })).rejects.toMatchObject({ status: 400 });
  });
});

describe('setCartItemQuantity', () => {
  it('404s when the item is not in this user’s cart', async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValue(null);
    await expect(setCartItemQuantity('u1', V1, 2)).rejects.toMatchObject({ status: 404 });
    expect(mockPrisma.cartItem.findUnique).toHaveBeenCalledWith({
      where: { userId_variantId: { userId: 'u1', variantId: V1 } },
    });
  });

  it('rejects a quantity above stock', async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValue({ id: 'c1', quantity: 1 });
    mockPrisma.productVariant.findUnique.mockResolvedValue(variant({ stockQuantity: 2 }));
    await expect(setCartItemQuantity('u1', V1, 3)).rejects.toMatchObject({ status: 409 });
    expect(mockPrisma.cartItem.update).not.toHaveBeenCalled();
  });
});

describe('previewGuestCart', () => {
  it('combines duplicate lines and prices from the database', async () => {
    mockPrisma.productVariant.findMany.mockResolvedValue([variant()]);
    const cart = await previewGuestCart({
      items: [
        { variantId: V1, quantity: 1 },
        { variantId: V1, quantity: 2 },
      ],
    });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ quantity: 3, lineTotalInPaise: 74700 });
  });
});

describe('mergeGuestCart', () => {
  it('adds quantities, clamps to stock, and skips unavailable items', async () => {
    mockPrisma.productVariant.findMany.mockResolvedValue([
      variant({ stockQuantity: 4 }),
      variant({ id: V2, isAvailable: false }),
    ]);
    mockPrisma.cartItem.findMany.mockResolvedValueOnce([{ variantId: V1, quantity: 3 }]);

    await mergeGuestCart('u1', {
      items: [
        { variantId: V1, quantity: 5 },
        { variantId: V2, quantity: 1 },
      ],
    });

    expect(mockPrisma.cartItem.upsert).toHaveBeenCalledOnce();
    expect(mockPrisma.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { quantity: 4 }, create: { userId: 'u1', variantId: V1, quantity: 4 } }),
    );
  });

  it('clamps to the per-line limit for unlimited stock', async () => {
    mockPrisma.productVariant.findMany.mockResolvedValue([variant({ stockQuantity: null })]);
    mockPrisma.cartItem.findMany.mockResolvedValueOnce([]);

    await mergeGuestCart('u1', { items: [{ variantId: V1, quantity: 500 }] });

    expect(mockPrisma.cartItem.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { quantity: 20 } }));
  });
});
