import { describe, expect, it } from 'vitest';
import { productListQuerySchema } from '@susharts/shared';

describe('productListQuerySchema', () => {
  it('applies defaults for an empty query', () => {
    const result = productListQuerySchema.parse({});
    expect(result).toEqual({
      page: 1,
      limit: 20,
      sort: 'position',
      order: 'asc',
    });
  });

  it('coerces string page and limit to numbers', () => {
    const result = productListQuerySchema.parse({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('rejects page 0', () => {
    expect(() => productListQuerySchema.parse({ page: '0' })).toThrow();
  });

  it('rejects limit above 100', () => {
    expect(() => productListQuerySchema.parse({ limit: '101' })).toThrow();
  });

  it('accepts valid category slug', () => {
    const result = productListQuerySchema.parse({ category: 'crochet' });
    expect(result.category).toBe('crochet');
  });

  it('accepts valid sort fields', () => {
    for (const field of ['createdAt', 'name', 'position', 'price'] as const) {
      expect(productListQuerySchema.parse({ sort: field }).sort).toBe(field);
    }
  });

  it('rejects invalid sort field', () => {
    expect(() => productListQuerySchema.parse({ sort: 'invalid' })).toThrow();
  });

  it('accepts fulfillment type filter', () => {
    const result = productListQuerySchema.parse({ fulfillment: 'MADE_TO_ORDER' });
    expect(result.fulfillment).toBe('MADE_TO_ORDER');
  });

  it('coerces inStock string to boolean', () => {
    expect(productListQuerySchema.parse({ inStock: 'true' }).inStock).toBe(true);
    expect(productListQuerySchema.parse({ inStock: 'false' }).inStock).toBe(false);
  });

  it('truncates search to 200 characters', () => {
    const longSearch = 'a'.repeat(201);
    expect(() => productListQuerySchema.parse({ search: longSearch })).toThrow();
  });

  it('passes through a 200-char search', () => {
    const search = 'a'.repeat(200);
    expect(productListQuerySchema.parse({ search }).search).toBe(search);
  });
});
