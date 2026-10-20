# Susharts

Handmade crochet and pipe-cleaner e-commerce platform.

## Layout

| Path              | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `apps/web`        | Storefront + admin UI (React, Vite, Tailwind)       |
| `apps/api`        | REST API (Express, layered modules)                 |
| `packages/db`     | Prisma schema and client                            |
| `packages/shared` | Types and Zod contracts shared by web and api       |

`packages/*` are built artifacts; `pnpm typecheck`, `test` and `dev` compile them first.

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:generate
pnpm db:migrate        # requires a reachable PostgreSQL instance
pnpm dev               # api on :4000, web on :5173
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
