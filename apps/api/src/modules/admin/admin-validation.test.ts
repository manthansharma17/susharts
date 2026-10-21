import { describe, expect, it } from 'vitest';
import {
  createProductSchema,
  createVariantSchema,
  updateInventorySchema,
  updateProductSchema,
  updateVariantSchema,
} from '@susharts/shared';

describe('createProductSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = createProductSchema.parse({
      name: 'Test Product',
      slug: 'test-product',
      categoryId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.status).toBe('DRAFT');
    expect(result.fulfillmentType).toBe('READY_STOCK');
    expect(result.position).toBe(0);
    expect(result.shortDescription).toBeNull();
  });

  it('rejects empty name', () => {
    expect(() =>
      createProductSchema.parse({
        name: '',
        slug: 'test',
        categoryId: '00000000-0000-0000-0000-000000000001',
      }),
    ).toThrow();
  });

  it('rejects invalid slug format', () => {
    expect(() =>
      createProductSchema.parse({
        name: 'Test',
        slug: 'Invalid Slug!',
        categoryId: '00000000-0000-0000-0000-000000000001',
      }),
    ).toThrow();
  });

  it('rejects non-uuid categoryId', () => {
    expect(() =>
      createProductSchema.parse({
        name: 'Test',
        slug: 'test',
        categoryId: 'not-a-uuid',
      }),
    ).toThrow();
  });

  it('accepts all optional fields', () => {
    const result = createProductSchema.parse({
      name: 'Full Product',
      slug: 'full-product',
      categoryId: '00000000-0000-0000-0000-000000000001',
      shortDescription: 'Short desc',
      description: 'Long description here',
      status: 'ACTIVE',
      fulfillmentType: 'MADE_TO_ORDER',
      productionDays: 7,
      metaTitle: 'SEO Title',
      metaDescription: 'SEO Description',
      position: 5,
    });
    expect(result.status).toBe('ACTIVE');
    expect(result.productionDays).toBe(7);
  });
});

describe('updateProductSchema', () => {
  it('accepts partial updates', () => {
    const result = updateProductSchema.parse({ name: 'New Name' });
    expect(result.name).toBe('New Name');
  });

  it('rejects empty object', () => {
    expect(() => updateProductSchema.parse({})).toThrow('At least one field must be provided');
  });
});

describe('createVariantSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = createVariantSchema.parse({
      sku: 'SKU-001',
      priceInPaise: 29900,
    });
    expect(result.label).toBe('Default');
    expect(result.isAvailable).toBe(true);
    expect(result.stockQuantity).toBeNull();
  });

  it('rejects zero price', () => {
    expect(() =>
      createVariantSchema.parse({ sku: 'SKU-001', priceInPaise: 0 }),
    ).toThrow();
  });

  it('rejects negative price', () => {
    expect(() =>
      createVariantSchema.parse({ sku: 'SKU-001', priceInPaise: -100 }),
    ).toThrow();
  });
});

describe('updateVariantSchema', () => {
  it('accepts partial updates', () => {
    const result = updateVariantSchema.parse({ label: 'Large' });
    expect(result.label).toBe('Large');
  });

  it('rejects empty object', () => {
    expect(() => updateVariantSchema.parse({})).toThrow();
  });
});

describe('updateInventorySchema', () => {
  it('accepts stock quantity update', () => {
    const result = updateInventorySchema.parse({ stockQuantity: 50 });
    expect(result.stockQuantity).toBe(50);
  });

  it('accepts null stock quantity (unlimited)', () => {
    const result = updateInventorySchema.parse({ stockQuantity: null });
    expect(result.stockQuantity).toBeNull();
  });

  it('accepts stock and availability together', () => {
    const result = updateInventorySchema.parse({ stockQuantity: 0, isAvailable: false });
    expect(result.stockQuantity).toBe(0);
    expect(result.isAvailable).toBe(false);
  });

  it('rejects negative stock', () => {
    expect(() => updateInventorySchema.parse({ stockQuantity: -1 })).toThrow();
  });
});
