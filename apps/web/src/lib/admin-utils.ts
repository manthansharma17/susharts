import { ApiRequestError } from './api-client.js';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

const RUPEES_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

/** "199.5" → 19950. Returns null for blank input, NaN for invalid input. */
export function rupeesToPaise(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!RUPEES_PATTERN.test(trimmed)) return Number.NaN;
  const [whole = '0', fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function paiseToRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '';
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`;
}

/** Blank → null (unlimited); otherwise a non-negative integer or NaN. */
export function parseStock(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return /^\d{1,6}$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export function errorText(err: unknown): string {
  return err instanceof ApiRequestError || err instanceof Error ? err.message : 'Something went wrong';
}
