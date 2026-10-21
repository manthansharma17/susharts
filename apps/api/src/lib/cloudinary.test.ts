import { describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = {};
vi.mock('../config/env.js', () => ({ getEnv: () => env }));
vi.mock('./logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

const { getCloudinaryConfig, publicIdFromUrl, signParams } = await import('./cloudinary.js');

describe('signParams', () => {
  it('matches the example from the Cloudinary signature docs', () => {
    const signature = signParams(
      { eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: '1315060510' },
      'abcd',
    );
    expect(signature).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  it('is independent of key insertion order', () => {
    expect(signParams({ b: '2', a: '1' }, 's')).toBe(signParams({ a: '1', b: '2' }, 's'));
  });
});

describe('publicIdFromUrl', () => {
  const base = 'https://res.cloudinary.com/demo/image/upload';

  it('extracts the public_id from a versioned URL', () => {
    expect(publicIdFromUrl(`${base}/v1712345678/susharts/products/p1/abc.jpg`, 'demo')).toBe(
      'susharts/products/p1/abc',
    );
  });

  it('extracts the public_id from an unversioned URL', () => {
    expect(publicIdFromUrl(`${base}/susharts/products/p1/abc.webp`, 'demo')).toBe('susharts/products/p1/abc');
  });

  it.each([
    ['another cloud', 'https://res.cloudinary.com/other/image/upload/v1/susharts/x.jpg'],
    ['outside our folder', `${base}/v1/someone-else/x.jpg`],
    ['another host', 'https://evil.example.com/demo/image/upload/v1/susharts/x.jpg'],
    ['plain http', 'http://res.cloudinary.com/demo/image/upload/v1/susharts/x.jpg'],
    ['not a URL', 'not a url'],
  ])('returns null for %s', (_label, url) => {
    expect(publicIdFromUrl(url, 'demo')).toBeNull();
  });
});

describe('getCloudinaryConfig', () => {
  it('throws 503 when credentials are missing', () => {
    expect(() => getCloudinaryConfig()).toThrow(expect.objectContaining({ status: 503 }));
  });

  it('returns config when all credentials are set', () => {
    Object.assign(env, {
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    });
    expect(getCloudinaryConfig()).toEqual({ cloudName: 'demo', apiKey: 'key', apiSecret: 'secret' });
  });
});
