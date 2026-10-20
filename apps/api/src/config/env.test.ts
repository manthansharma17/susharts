import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const base = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/susharts' };

describe('parseEnv', () => {
  it('applies defaults when optional variables are absent', () => {
    const env = parseEnv(base as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('splits and trims the CORS origin list', () => {
    const env = parseEnv({
      ...base,
      CORS_ORIGINS: 'https://a.com, https://b.com ,',
    } as NodeJS.ProcessEnv);
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => parseEnv({ ...base, PORT: 'abc' } as NodeJS.ProcessEnv)).toThrow(/PORT/);
  });
});
