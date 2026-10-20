# Project status

Updated: 2026-10-21

## Completed

**Phase 1 — repository foundation.** pnpm monorepo (`apps/web`, `apps/api`,
`packages/db`, `packages/shared`) with strict TypeScript, ESLint, Prettier.
API boots with validated env, Helmet, CORS allowlist, pino request logging, a
layered `/api/v1/health` route that really pings PostgreSQL, and a typed error
handler. Web app has a Tailwind design base, router shell, native-fetch API
client and a status panel that reads the health endpoint. Prisma schema covers
`User` (Firebase UID, roles) and a self-referencing `Category` tree.

## Decisions

- Money is stored and transported as integer paise; no floats in pricing.
- `packages/*` export compiled `dist/`, so the compiled API resolves them at
  runtime on Render without bundling.
- `getEnv()` is lazy so modules are unit-testable without a full environment.
- API error responses all use `{ error: { code, message, details? } }`.
- Express 4 (not 5) for stable typings with `helmet`/`pino-http`.
- Razorpay webhooks will need a raw-body parser mounted before `express.json`;
  noted in `apps/api/src/app.ts`.

## Open issues / missing configuration

- No PostgreSQL reachable in this environment, so `prisma migrate dev` has not
  been run and no migration files exist yet. Needed: a `DATABASE_URL` pointing
  at a real database.
- No credentials supplied yet for Firebase Admin, Cloudinary, Razorpay or
  Resend. The required variable names are listed in `apps/api/.env.example`;
  no integration is stubbed or faked.
- `pnpm` was installed globally via npm because `corepack enable` needs
  administrator rights on this machine.

## Next task

Phase 2 — catalogue domain: products, variants, images, pricing and stock
models; admin CRUD with reordering and archiving; public read endpoints with
filtering and pagination.
