import { describe, expect, it } from 'vitest';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  updateInventorySchema,
} from '@susharts/shared';

describe('createProductSchema', () => {
  const validInput = {
    name: 'Crochet Flower',
    slug: 'crochet-flower',
    categoryId: '00000000-0000-0000-0000-000000000001',
  };

  it('accepts valid minimal input', () => {
    const result = createProductSchema.parse(validInput);
    expect(result.name).toBe('Crochet Flower');
    expect(result.status).toBe('DRAFT');
    expect(result.fulfillmentType).toBe('READY_STOCK');
  });

  it('rejects empty name', () => {
    expect(() => createProductSchema.parse({ ...validInput, name: '' })).toThrow();
  });

  it('rejects invalid slug format', () => {
    expect(() => createProductSchema.parse({ ...validInput, slug: 'Bad Slug!' })).toThrow();
  });

  it('accepts valid slug with hyphens', () => {
    const result = createProductSchema.parse({ ...validInput, slug: 'my-product-123' });
    expect(result.slug).toBe('my-product-123');
  });

  it('rejects invalid categoryId', () => {
    expect(() =>
      createProductSchema.parse({ ...validInput, categoryId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects metaTitle over 70 chars', () => {
    expect(() =>
      createProductSchema.parse({ ...validInput, metaTitle: 'a'.repeat(71) }),
    ).toThrow();
  });

  it('rejects metaDescription over 160 chars', () => {
    expect(() =>
      createProductSchema.parse({ ...validInput, metaDescription: 'a'.repeat(161) }),
    ).toThrow();
  });
});

describe('updateProductSchema', () => {
  it('accepts a partial update', () => {
    const result = updateProductSchema.parse({ name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
  });

  it('rejects an empty update', () => {
    expect(() => updateProductSchema.parse({})).toThrow('At least one field');
  });
});

describe('createVariantSchema', () => {
  const validInput = {
    sku: 'CF-001',
    priceInPaise: 29900,
  };

  it('accepts valid input with defaults', () => {
    const result = createVariantSchema.parse(validInput);
    expect(result.label).toBe('Default');
    expect(result.isAvailable).toBe(true);
    expect(result.stockQuantity).toBeNull();
  });

  it('rejects zero price', () => {
    expect(() => createVariantSchema.parse({ ...validInput, priceInPaise: 0 })).toThrow();
  });

  it('rejects negative stockQuantity', () => {
    expect(() =>
      createVariantSchema.parse({ ...validInput, stockQuantity: -1 }),
    ).toThrow();
  });
});

describe('updateVariantSchema', () => {
  it('accepts partial update', () => {
    const result = updateVariantSchema.parse({ priceInPaise: 39900 });
    expect(result.priceInPaise).toBe(39900);
  });

  it('rejects empty update', () => {
    expect(() => updateVariantSchema.parse({})).toThrow('At least one field');
  });
});

describe('updateInventorySchema', () => {
  it('accepts stock update', () => {
    const result = updateInventorySchema.parse({ stockQuantity: 10 });
    expect(result.stockQuantity).toBe(10);
  });

  it('accepts null stockQuantity for unlimited', () => {
    const result = updateInventorySchema.parse({ stockQuantity: null });
    expect(result.stockQuantity).toBeNull();
  });

  it('accepts combined stock and availability update', () => {
    const result = updateInventorySchema.parse({ stockQuantity: 0, isAvailable: false });
    expect(result.stockQuantity).toBe(0);
    expect(result.isAvailable).toBe(false);
  });
});
