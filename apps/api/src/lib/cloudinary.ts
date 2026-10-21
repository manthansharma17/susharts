import { createHash } from 'node:crypto';
import { getEnv } from '../config/env.js';
import { HttpError } from './http-error.js';
import { logger } from './logger.js';

/** Every asset we upload lives under this prefix; nothing outside it is ever deleted. */
export const CLOUDINARY_ROOT_FOLDER = 'susharts';

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const env = getEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new HttpError(503, 'IMAGES_NOT_CONFIGURED', 'Image storage is not configured');
  }
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
}

/** Cloudinary signature: SHA-1 of the alphabetically sorted `key=value` pairs joined by `&`, plus the secret. */
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

async function callCloudinary(
  config: CloudinaryConfig,
  action: 'upload' | 'destroy',
  params: Record<string, string>,
  file?: Blob,
): Promise<Record<string, unknown>> {
  const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  for (const [key, value] of Object.entries(signed)) form.append(key, value);
  form.append('api_key', config.apiKey);
  form.append('signature', signParams(signed, config.apiSecret));
  if (file) form.append('file', file);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/${action}`,
    { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) },
  );
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = (body.error as { message?: string } | undefined)?.message ?? `HTTP ${response.status}`;
    throw new Error(`Cloudinary ${action} failed: ${message}`);
  }
  return body;
}

export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  publicId: string,
): Promise<{ url: string }> {
  const config = getCloudinaryConfig();
  let body: Record<string, unknown>;
  try {
    body = await callCloudinary(
      config,
      'upload',
      { public_id: publicId, overwrite: 'false' },
      new Blob([buffer], { type: mimeType }),
    );
  } catch (err) {
    logger.error({ err }, 'Cloudinary upload failed');
    throw new HttpError(502, 'UPLOAD_FAILED', 'Image upload failed');
  }
  if (typeof body.secure_url !== 'string') {
    throw new HttpError(502, 'UPLOAD_FAILED', 'Image upload failed');
  }
  return { url: body.secure_url };
}

export async function destroyImage(publicId: string): Promise<void> {
  const config = getCloudinaryConfig();
  await callCloudinary(config, 'destroy', { public_id: publicId, invalidate: 'true' });
}

/**
 * Recovers the public_id from a delivery URL we stored. Returns null for URLs
 * from another cloud or outside our folder, so those are never deleted.
 */
export function publicIdFromUrl(url: string, cloudName: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null;

  const prefix = `/${cloudName}/image/upload/`;
  if (!parsed.pathname.startsWith(prefix)) return null;

  const match = /^(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(parsed.pathname.slice(prefix.length));
  const publicId = match?.[1];
  if (!publicId || !publicId.startsWith(`${CLOUDINARY_ROOT_FOLDER}/`)) return null;
  return decodeURIComponent(publicId);
}
