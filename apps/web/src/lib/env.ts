/** Only VITE_-prefixed values reach the browser; never put secrets here. */
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not configured. Copy .env.example to .env.local.');
}

export const clientEnv = {
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
} as const;
