import { apiErrorSchema } from '@susharts/shared';
import { clientEnv } from './env.js';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Thin wrapper over the native Fetch API. Every caller gets parsed JSON or a
 * typed ApiRequestError; no HTTP client library is used anywhere in the app.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(payload);
    throw new ApiRequestError(
      response.status,
      parsed.success ? parsed.data.error.code : 'UNKNOWN_ERROR',
      parsed.success ? parsed.data.error.message : `Request failed with status ${response.status}`,
    );
  }

  return payload as T;
}
