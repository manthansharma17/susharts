import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../apps/api/dist/app.js';

/**
 * Vercel serverless entry point. Everything under /api/* is rewritten here by
 * vercel.json, and the Express app routes it exactly as it does locally.
 *
 * The app is built once per container and reused across invocations, so warm
 * requests skip Express and Prisma setup.
 */
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  // Express matches on req.url, and its routes are mounted under /api/v1.
  // Vercel normally passes the original path through; this guards the case
  // where the rewrite hands us the path without its /api prefix.
  if (req.url && !req.url.startsWith('/api/') && req.url !== '/api') {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  (app as unknown as (q: IncomingMessage, s: ServerResponse) => void)(req, res);
}
