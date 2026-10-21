/** Only VITE_-prefixed values reach the browser; never put secrets here. */
// Empty means the API is served from the same origin (the Vercel deployment).
// Local development points this at the separate API server.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export const clientEnv = {
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  },
} as const;
