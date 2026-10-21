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

**Phase 3 — authentication, authorization, and admin catalog APIs.**

Backend:
- Firebase Admin SDK (`firebase-admin@13`) verifies ID tokens server-side.
  Env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- `authenticate` middleware runs on every request; extracts and verifies Bearer
  token, upserts user in PostgreSQL via `syncUser`, attaches `req.user`.
  Disabled accounts get 403.
- `requireAuth()` middleware rejects unauthenticated requests (401).
- `requireRole(...roles)` middleware enforces RBAC (403 for insufficient
  permissions). New users default to `CUSTOMER`; role promotion is admin-only.
- `GET /api/v1/auth/me` — returns the authenticated user's id, email, role.

Admin catalog endpoints (all require `ADMIN` or `STAFF` role):
- `POST /api/v1/admin/products` — create product (validates category exists).
- `GET /api/v1/admin/products/:id` — admin detail with all variants/images.
- `PATCH /api/v1/admin/products/:id` — partial update (validates category if changed).
- `POST /api/v1/admin/products/:id/archive` — set status to ARCHIVED.
- `POST /api/v1/admin/products/:productId/variants` — add variant (validates SKU unique).
- `PATCH /api/v1/admin/products/variants/:variantId` — update variant.
- `DELETE /api/v1/admin/products/variants/:variantId` — delete variant.
- `PATCH /api/v1/admin/products/variants/:variantId/inventory` — safe stock update.

Frontend:
- Firebase JS SDK (`firebase@11.2`) with Google sign-in popup flow.
- `AuthProvider` context: manages Firebase auth state, exposes `signInWithGoogle`,
  `signOut`, `getIdToken`.
- `apiFetch` automatically attaches `Authorization: Bearer <token>` when
  a user is signed in.
- SiteLayout shows Google sign-in button or user avatar + sign-out.
- Firebase web config env vars: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (public by design).

Shared Zod schemas: `createProductSchema`, `updateProductSchema`,
`createVariantSchema`, `updateVariantSchema`, `updateInventorySchema`,
`currentUserSchema`.

85 tests passing (env validation, auth middleware, role enforcement, admin
product service, admin validation, product query, product service). All
typecheck, lint, build clean. No schema migration required — the `User` model
was created in Phase 1.

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
- `authenticate` middleware runs globally (on every request) so public
  endpoints still work without a token; `requireAuth`/`requireRole` are
  applied per-route.
- User sync is an upsert by `firebaseUid`: first login creates a `CUSTOMER`
  row; subsequent logins update email/name/photo and `lastLoginAt`.
- Admin routes live under `/api/v1/admin/` to keep them separate from
  public storefront routes.
- `stripUndefined` utility removes `undefined` keys from partial-update
  payloads before passing them to Prisma, working around
  `exactOptionalPropertyTypes: true`.
- Firebase web config values are public by design (they identify the project
  but don't grant write access); the private key stays server-side only.

**Phase 4 — customer storefront.**

Design (revised to baby pink after Phase 4 review):
- Soft baby-pink aesthetic: blush backgrounds and accents, rose-brown text,
  rounded display headings (Fredoka) and Nunito body text via Google Fonts.
- Tailwind palette: `blush` (pinks) and `cocoa` (text) tokens.
- Announcement bar, logo with bow, header search, category pill nav, hero
  banner with SVG decorations, category circles, trust strip.
- Wishlist/cart icons and shipping/payment claims from the reference mockup
  were intentionally left out until those features and policies exist.
- Responsive layout with mobile-first breakpoints; 16px side gutter.

Pages:
- **HomePage** — hero section (forest-700), category cards with child tags,
  featured products grid (newest 8), brand story section.
- **ShopPage** — full product grid with URL-driven filter state (`useSearchParams`).
  Search input, category dropdown, sort selector (featured/name/price/newest),
  pagination with page count.
- **CategoryPage** — category-specific browsing with breadcrumbs, subcategory
  pill links, product grid, pagination. Handles parent/child relationships.
- **ProductDetailPage** — image gallery with thumbnail strip, variant selector
  (button-style with disabled state), stock badge (out of stock / made to order
  / low stock / in stock), price with compare-at strikethrough, SKU/category/
  production time details, full description.
- **NotFoundPage** — themed 404 with navigation back to home.

Shared components:
- `Spinner` / `PageSpinner` — loading indicators.
- `EmptyState` — empty result display with optional action link.
- `ErrorMessage` — error display with optional retry button.
- `Price` — formatted INR display with optional compare-at price.
- `ProductCard` — product summary card with image, badges, price.
- `Breadcrumbs` — navigation breadcrumb trail.

Custom hook:
- `useApi<T>(path)` — generic data fetching with loading/error/refetch,
  AbortController cleanup, null path to skip fetch.

All pages connect to existing backend APIs (`/api/v1/products`,
`/api/v1/products/:slug`, `/api/v1/categories`). Empty database handled
gracefully with EmptyState components. No fabricated data.

85 tests passing. All typecheck, lint, build clean.

**Phase 5 — product images and Cloudinary.**

Backend (all behind `requireAuth()` + `requireRole('ADMIN', 'STAFF')`, which
run before the upload body is parsed):
- `POST /api/v1/admin/products/:productId/images` — multipart, field `image`
  (+ optional `altText`). Appends after the last position.
- `PUT /api/v1/admin/products/:productId/images/order` — body
  `{ imageIds: [...] }`; must list every image of that product exactly once.
- `PATCH /api/v1/admin/products/images/:imageId` — body `{ altText }`.
- `DELETE /api/v1/admin/products/images/:imageId` — deletes the row, closes
  position gaps, then deletes the Cloudinary asset (best-effort, logged).

Validation: JPEG/PNG/WebP only, checked against the declared MIME type
(multer filter) *and* the file's signature bytes; 5 MB max (413
`FILE_TOO_LARGE`); 10 images per product; malformed IDs answer 404; reorder
IDs must belong to the product.

Cloudinary is called with signed `fetch` requests (`apps/api/src/lib/cloudinary.ts`);
no SDK dependency. Assets go to `susharts/products/<productId>/<uuid>`. The
existing `ProductImage` schema is used unchanged — `public_id` is derived from
the stored delivery URL, and only URLs on our cloud under `susharts/` are
ever deleted. If the DB insert fails after upload, the asset is removed.

Env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
(server-only, optional at boot; image endpoints answer 503
`IMAGES_NOT_CONFIGURED` until all three are set).

Frontend:
- `/admin/products/:id/images` — upload (multi-file, client-side type/size/count
  checks), alt text editing, move earlier/later, delete. Shows sign-in / no
  access states; the server remains the authority on roles.
- Product detail page shows a "Manage images" link to ADMIN/STAFF users
  (role from `GET /api/v1/auth/me`).
- `apiFetch` no longer forces a JSON `Content-Type` on `FormData` bodies.

Dependencies: `multer@2.4.0`, `@types/multer@2.0.0` (API only).

Admin panel (`/admin`, separate layout from the storefront):
- Gate: not signed in → Google sign-in card; signed in without ADMIN/STAFF
  role → "No access" with switch-account; role comes from `GET /api/v1/auth/me`.
- `/admin` — product list (all statuses) with search, status filter,
  pagination, thumbnail, price-from, image count, "Manage images" link.
- `/admin/products/:id/images` — image manager (now inside the admin layout).
- Storefront header shows an "Admin" button to admins only.
- New endpoint `GET /api/v1/admin/products?page&limit&search&status`.
- Only one account holds a privileged role: one ADMIN, no STAFF accounts.
- `/admin/products/new` — create a product with its first price/stock option
  (rupees in the form, converted to integer paise without floats).
- `/admin/products/:id` — edit details (name, slug, category, descriptions,
  visibility, fulfilment, production days) and add/edit/delete options.
- Category picker with inline "+ New" category (main or one level under one).
- `/admin/categories` — create, edit (name, slug, description, parent), move
  up/down, archive/restore, delete (only when it has no products or
  sub-categories; otherwise 409 with the reason).
- Endpoints under `/api/v1/admin/categories`: `GET /` (tree incl. archived,
  with product counts), `POST /`, `PATCH /:id`, `PUT /order`, `DELETE /:id`.
  Two-level tree enforced on create and move.
- Malformed IDs on admin endpoints answer 404 instead of 500.
- Prisma unique violations (duplicate slug/SKU) answer 409 `CONFLICT`
  instead of 500.

144 tests passing (59 new: Cloudinary signing and URL parsing, image service,
upload route auth/size/type checks, admin product list, categories, 409s). All typecheck, lint, build clean.

**Phase 6 — cart.**

Schema: new `CartItem` table (migration `20261021042437_add_cart_items`, applied):
`userId`, `variantId`, `quantity`; unique per user+variant; cascades on user or
variant deletion; DB `CHECK (quantity > 0)`. Prices are never stored in the cart.

API (`/api/v1/cart`, all require sign-in except preview; always scoped to `req.user`):
- `GET /`, `DELETE /` (clear), `POST /items` (add; sums with existing line),
  `PATCH /items/:variantId` (set quantity), `DELETE /items/:variantId`.
- `POST /merge` — folds a guest cart in after sign-in: quantities add up, clamped
  to stock and the per-line limit; unavailable items are skipped.
- `POST /preview` (public) — prices a guest cart from the DB; stores nothing.
- Responses are a server-computed `CartResponse`: lines with live price, line
  total, `availableQuantity`, and `issue` (`UNAVAILABLE` / `INSUFFICIENT_STOCK`);
  subtotal excludes lines with issues.
- Validation: product must be ACTIVE and variant available; quantity 1–20 per
  line; ≤ 50 lines; quantity ≤ stock unless stock is unlimited (null, e.g. made
  to order). Errors: 409 `UNAVAILABLE`, 409 `INSUFFICIENT_STOCK` (with
  `availableQuantity`), 400 for limits, 404 for unknown items.

Frontend:
- `CartProvider`: signed-in carts live on the server; guest carts in
  `localStorage` (`susharts.guestCart.v1`), priced via `/cart/preview`. On sign-in
  the guest cart is merged, then cleared locally.
- Header cart icon with item count; `/cart` page with quantity changes, remove,
  clear, summary, made-to-order notes, and loading/empty/error/changed-item
  states. Checkout button is disabled ("coming soon").
- Product page: quantity picker + Add to cart, "Sold out" when unavailable.

Customization: the schema has no personalization fields, so the only option is
choosing a variant. Free-text customization would need a schema change.

180 tests passing (36 new: cart pricing/issue logic, stock validation, merge
clamping, user scoping, auth, input validation). All typecheck, lint, build clean.

**Phase 7 — checkout and Razorpay payments.**

Schema (migration `20261021044747_add_orders_and_payments`, applied; additive):
- `Order` — customer + delivery details, `subtotalInPaise`, `shippingInPaise`,
  `totalInPaise`, status `PENDING_PAYMENT | PAID | CANCELLED | EXPIRED`,
  `razorpayOrderId` (unique), `expiresAt`, `paidAt`, `requiresReview` +
  `reviewReason`.
- `OrderItem` — immutable snapshot (name, slug, variant label, SKU, unit price,
  quantity, line total, fulfilment type, production days, `stockReserved`).
- `Payment` — one row per Razorpay payment id (`AUTHORIZED | CAPTURED | FAILED`).
- `WebhookEvent` — processed webhook event ids.
- DB checks: total = subtotal + shipping; line total = unit × qty; qty > 0;
  `ProductVariant.stockQuantity` never negative.

Flow:
1. `POST /api/v1/checkout` (signed in) — validates address; expires stale
   orders and cancels the customer's previous open checkout; re-reads cart,
   prices, availability, and stock inside a transaction; reserves tracked stock
   with conditional decrements (`stockQuantity >= qty`); writes the order and
   snapshots; then creates the Razorpay order server-side. If Razorpay fails,
   the reservation is released (502). Returns the public key id only.
2. Browser opens Razorpay Checkout (official `checkout.js`).
3. `POST /api/v1/checkout/:orderId/verify` — checks ownership, that the
   Razorpay order id matches, verifies `HMAC_SHA256(order_id|payment_id,
   key_secret)` in constant time, then fetches the payment from Razorpay's API
   and only marks paid if it is captured for the exact amount/currency
   (authorized payments are captured server-side).
4. `POST /api/v1/webhooks/razorpay` — raw-body HMAC verification with the
   webhook secret; handles `payment.authorized`, `payment.captured`,
   `payment.failed`, `order.paid`; dedupes by `X-Razorpay-Event-Id`.
5. `POST /api/v1/checkout/:orderId/cancel` (modal dismissed) and lazy expiry
   after 30 minutes release reserved stock.
6. `GET /api/v1/checkout/orders/:orderId` — owner-only summary for the
   confirmation page.

Safety: PAID transition is a conditional update, so callback + webhook races or
repeats apply once; captured payments are never downgraded by stale events;
amount mismatches and second captures are flagged `requiresReview` (not marked
paid / not double-processed); a payment arriving after expiry re-reserves stock,
or is recorded PAID + `requiresReview` if stock is gone. Paid items are removed
from the cart.

Frontend: `/checkout` (sign-in required; contact + address form with
client-side checks mirroring the server; summary; "Pay ₹X"), Razorpay modal
with failure messages and cancel handling, `/orders/:id` confirmation with
short polling while payment confirmation is pending. Cart "Proceed to
checkout" enabled when the cart has no issues.

Assumed business rules (confirm): free shipping (`SHIPPING_FEE_IN_PAISE = 0`),
prices tax-inclusive, India-only delivery, 30-minute stock reservation.

Env (server only, optional at boot; 503 until set): `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. No new dependencies.

236 tests passing (56 new: signature verification incl. tampering, server
pricing and snapshots, stock reservation/release, oversell prevention,
duplicate/late/failed/mismatched payments, webhook signature + dedupe,
authorization, validation). All typecheck, lint, build clean.

**Post-Phase 7 additions (committed):** product gallery (thumbnails, hover zoom,
swipe, lightbox), Buy now, +/- quantity stepper, pink dropdown styling, photo
crop/rotate/adjust before upload, edit/replace existing photos
(`PUT /api/v1/admin/products/images/:imageId/file`).

**Phase 8 — orders and notifications.**

Migration `…_add_fulfillment_audit_notifications` (applied; additive):
- `Order`: `fulfillmentStatus` (`CONFIRMED | PROCESSING | SHIPPED | DELIVERED |
  CANCELLED`), `shippingCarrier`, `trackingNumber`, `shippedAt`, `deliveredAt`,
  `fulfillmentCancelledAt`. Existing paid orders backfilled to `CONFIRMED`.
  DB check: fulfillment status only on `PAID` orders.
- `OrderStatusEvent` — audit trail (from, to, actor user or null = system,
  note, timestamp).
- `EmailNotification` — one row per (order, type), unique; status
  `PENDING | SENT | FAILED`, attempts, last error, provider id.

Payment vs fulfillment: `Order.status` (payment) changes only via verified
Razorpay payments (Phase 7). Staff only move `fulfillmentStatus`. On verified
payment the order becomes `CONFIRMED` with a system audit event.

Customer API (signed in, own orders only; others' orders → 404):
- `GET /api/v1/orders?page&limit` (limit ≤ 50), `GET /api/v1/orders/:id`.

Admin API (`ADMIN`/`STAFF`):
- `GET /api/v1/admin/orders?page&limit&status&fulfillment&search&review`
- `GET /api/v1/admin/orders/:id` — detail + payments, audit history, emails,
  allowed next steps.
- `PATCH /api/v1/admin/orders/:id/fulfillment` — `{ from, to, note,
  shippingCarrier?, trackingNumber? }`. Allowed: CONFIRMED→PROCESSING→SHIPPED→
  DELIVERED; CONFIRMED/PROCESSING→CANCELLED (reason required). Rejects unpaid
  orders (409 `NOT_PAID`), invalid moves (400), stale `from` / concurrent
  updates (409 `STALE_STATUS`). Cancel restocks tracked items and flags
  `requiresReview: REFUND_NEEDED` (refund manually in Razorpay).
- `POST /api/v1/admin/orders/:id/notifications/retry`.

Emails (Resend over HTTPS, no SDK): order confirmed (after verified payment),
payment failed (only when an order with a failed attempt is released),
shipped (with courier/tracking), delivered, cancelled. Never sent twice: the
unique (order, type) row, a compare-and-swap claim on `attempts`, and the
notification id as Resend `Idempotency-Key`. Failures are recorded and never
thrown — orders/payments are unaffected; max 5 attempts; admin "Retry failed".
HTML escapes all customer/catalog text.

Frontend: `/orders` (paginated history), `/orders/:id` (detail: items,
snapshots, totals, payment + fulfillment status, progress tracker, tracking,
address, timestamps; also the post-payment confirmation page), "My orders" in
the header. Admin: `/admin/orders` (filters, search, review flag) and
`/admin/orders/:id` (fulfilment actions, history with actor, payments, emails).

298 tests passing (50 new: customer ownership + pagination, admin authz,
transition matrix, unpaid/stale/concurrent rejection, payment status never
touched, cancel restock, email idempotency/claims/retries/failures, HTML
escaping, confirmation/payment-failed hooks). All typecheck, lint, build clean.

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
- `authenticate` middleware runs globally (on every request) so public
  endpoints still work without a token; `requireAuth`/`requireRole` are
  applied per-route.
- User sync is an upsert by `firebaseUid`: first login creates a `CUSTOMER`
  row; subsequent logins update email/name/photo and `lastLoginAt`.
- Admin routes live under `/api/v1/admin/` to keep them separate from
  public storefront routes.
- `stripUndefined` utility removes `undefined` keys from partial-update
  payloads before passing them to Prisma, working around
  `exactOptionalPropertyTypes: true`.
- Firebase web config values are public by design (they identify the project
  but don't grant write access); the private key stays server-side only.
- Filter state (search, category, sort, page) lives in URL search params
  so links are shareable and browser back/forward works naturally.

## Open issues

- Razorpay keys and webhook not configured yet (checkout returns 503).
- Refunds are manual (Razorpay dashboard); cancelled-after-payment orders are
  flagged `REFUND_NEEDED` but the flag isn't cleared automatically.
- Resend not configured yet: emails are recorded as FAILED ("Email is not
  configured") and can be retried from the admin order page once keys are set.
- Emails that fail are retried only via the admin button (no background job);
  after 5 attempts they stop.
- Stale-order expiry runs lazily when a checkout starts; no background job.
- Webhook must be reachable publicly for production; locally the browser
  verify call is the primary path.

- Cloudinary credentials not yet set in `apps/api/.env` (uploads return 503
  until they are). Razorpay and Resend credentials also not configured.
- Archiving a main category hides it from the menu, but its products still
  appear in the shop and search (product visibility is controlled per product).
- Admin form pages have no automated UI tests; API behaviour is covered.
- `ProductImage` has no `publicId` column; deletion relies on parsing our own
  stored URL. Adding the column is a small optional migration if images ever
  come from other sources.
- `DATABASE_URL` duplicated in two `.env` files.
- The abandoned Tokyo Supabase project should be deleted.
- Firebase credentials need to be configured for the API to run auth flows
  in development (download service-account JSON from Firebase Console).
- Firebase private key was briefly visible in `.env.example` (now replaced
  with empty placeholder); key should be rotated.

## Next task

Phase 8 complete; next phase not started; awaiting explicit request.

### Phase 8 setup and manual testing
1. Resend: create an account, verify your sending domain (DNS records), create
   an API key. In `apps/api/.env` set `RESEND_API_KEY`, `EMAIL_FROM`
   (e.g. `Susharts <orders@yourdomain.com>`), optionally `EMAIL_REPLY_TO`,
   and `PUBLIC_WEB_URL` (storefront URL for email links). Restart the API.
2. With Razorpay test keys set, buy something → `/orders/:id` shows
   "Confirmed"; the admin order page shows a SENT "Order confirmation" email.
3. In `/admin/orders/:id`: Start preparing → Mark as shipped (enter courier
   and tracking) → Mark as delivered. Check the customer receives shipped and
   delivered emails, the history lists your email as actor, and the customer
   page shows the progress tracker.
4. Cancel a CONFIRMED order (reason required): stock returns, customer is
   emailed, order shows "Needs review" for the refund.
5. Pay with Razorpay's failure test card, then close the modal → a
   "Payment failed" email is sent once.
6. Repeat a status update from a stale tab → 409, no duplicate email.
