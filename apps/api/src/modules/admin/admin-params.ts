import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';

const uuidParam = z.string().uuid();

/** Malformed IDs would make Prisma throw a 500; treat them as not found instead. */
export function parseId(value: string | undefined, label: string): string {
  const result = uuidParam.safeParse(value);
  if (!result.success) throw HttpError.notFound(`${label} not found`);
  return result.data;
}
