# Project status

Updated: 2026-10-21

## Completed

**Phase 1 — repository foundation.** pnpm monorepo (`apps/web`, `apps/api`,
`packages/db`, `packages/shared`) with strict TypeScript, ESLint, Prettier.
API boots with validated env, Helmet, CORS allowlist, pino request logging, a
layered `/api/v1/health` route that really pings PostgreSQL, and a typed error
handler. Web app has a Tailwind design base, router shell, native-fetch API
client and a status panel that reads the health endpoint.

**Database connected.** Supabase project in `ap-south-1` (Mumbai) via Session
Pooler on port 5432. Env files rotated and working.

**Phase 2 — product catalog.** Prisma schema extended with `Product`,
`ProductVariant`, `ProductImage`, plus `ProductStatus` and `FulfillmentType`
enums. Migration `20261020200730_add_product_catalog` applied to live DB.

Public read-only API endpoints:
- `GET /api/v1/products` — paginated, filterable (category, search, fulfillment,
  inStock), sortable (createdAt, name, position, price). Excludes DRAFT/ARCHIVED.
- `GET /api/v1/products/:slug` — full detail with variants, images, category tree.
- `GET /api/v1/categories` — non-archived category tree for storefront navigation.

Shared Zod contracts for query validation, response shapes, pagination. 23 tests
passing (env validation, product query validation, product service with mocked
Prisma). All typecheck, lint, build clean.

Admin write operations (create/update/archive products, manage inventory) are
designed at the service layer but not exposed as endpoints. They will be wired
once Firebase authentication and role-based authorization are implemented.

## Decisions

- Money is stored and transported as integer paise; no floats in pricing.
- `packages/*` export compiled `dist/`.
- `getEnv()` is lazy so modules are unit-testable without a full environment.
- API error responses all use `{ error: { code, message, details? } }`.
- Express 4 (not 5) for stable typings.
- Supabase Session Pooler (5432) for both runtime and migrations.
- Env files loaded by Node's native `--env-file-if-exists=.env`.
- Products use slug-based lookup (public), UUID internally.
- Category filter matches the category and all its children.
- Price sorting is in-memory (acceptable for ≤100 items per page) because
  the min-price lives on variants, not the product row.
- `ProductVariant.stockQuantity` is nullable: null means unlimited
  (made-to-order items).
- Cloudinary is behind a service boundary: `ProductImage.url` stores the CDN
  URL but the upload integration lands in a later phase.

## Open issues

- No Firebase Admin credentials: admin write endpoints cannot be exposed yet.
- No Cloudinary, Razorpay, or Resend credentials configured.
- `DATABASE_URL` duplicated in two `.env` files.
- The abandoned Tokyo Supabase project should be deleted.

## Next task

Phase 3 — Firebase authentication: Google sign-in on the frontend, Firebase
Admin SDK verification on the backend, auth middleware, role-based access
control, and admin write endpoints for catalog management.
