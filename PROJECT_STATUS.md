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

**Database connected.** Supabase project `tqowmbdrqselsuftwsfg` in `ap-south-1`
(Mumbai) via the Session Pooler on port 5432. Migration
`20261020193108_init_identity_and_categories` is applied; `User`, `Category` and
the `UserRole` enum exist in the live database. The built API returns
`{"status":"ok","checks":{"database":"up"}}`.

## Decisions

- Money is stored and transported as integer paise; no floats in pricing.
- `packages/*` export compiled `dist/`, so the compiled API resolves them at
  runtime on Render without bundling.
- `getEnv()` is lazy so modules are unit-testable without a full environment.
- API error responses all use `{ error: { code, message, details? } }`.
- Express 4 (not 5) for stable typings with `helmet`/`pino-http`.
- Supabase **Session Pooler (5432)** for both runtime and migrations. The
  transaction pooler (6543) is unusable for `prisma migrate`, which needs
  session-level advisory locks; the direct connection is IPv6-only and so
  unreliable from Render. Because one URI serves both roles, the schema needs
  no `directUrl`.
- Env files are loaded by Node's native `--env-file-if-exists=.env`, not
  `dotenv`. The `-if-exists` form keeps Render working, where variables come
  from the dashboard and no `.env` file exists.
- Mumbai region chosen over the initial Tokyo project for customer latency.
- Razorpay webhooks will need a raw-body parser mounted before `express.json`;
  noted in `apps/api/src/app.ts`.

## Open issues

- **The database password was shared in plaintext in a chat transcript and
  must be rotated** (Supabase > Project Settings > Database > reset password,
  then re-run the helper that writes it into the two ignored `.env` files).
- The abandoned Tokyo Supabase project should be deleted so it is not a
  forgotten open credential.
- `DATABASE_URL` is duplicated in `packages/db/.env` and `apps/api/.env` and
  the two must stay in sync. Worth collapsing to one root `.env` later.
- No credentials yet for Firebase Admin, Cloudinary, Razorpay or Resend. The
  required variable names are listed in `apps/api/.env.example`; no
  integration is stubbed or faked.
- No git remote is configured, so nothing has been pushed off this machine.
- `pnpm` was installed globally via npm because `corepack enable` needs
  administrator rights on this machine.

## Next task

Phase 2 — catalogue domain: products, variants, images, pricing and stock
models; admin CRUD with reordering and archiving; public read endpoints with
filtering and pagination.
