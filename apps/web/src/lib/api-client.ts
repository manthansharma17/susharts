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

let tokenProvider: (() => Promise<string | null>) | undefined;

export function setTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenProvider ? await tokenProvider() : null;

  const response = await fetch(`${clientEnv.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      // FormData bodies need the browser to set the multipart boundary itself.
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
