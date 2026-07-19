# Announcing

Non-profit, donation-funded announcements platform. It lets organisations reach
their audience without SNS lock-in, ads, or tracking — and readers need no account.

See [docs/PLAN.md](docs/PLAN.md) for the full plan and architecture.

## Stack

- **SvelteKit** on **Cloudflare Workers** (`@sveltejs/adapter-cloudflare`)
- **Durable Objects (SQLite)** per channel — the regional data layer
- **D1** — global control layer (users / sessions / channel registry / memberships)
- **R2** — images · **Workflows** — async pipelines
- **paraglide** i18n (ja / en) · **Vitest** + **Playwright** · **@antfu/eslint-config**

## Layout

```
apps/web         SvelteKit app (SSR + API + dashboard + public pages) — Cloudflare Worker
apps/backend     Durable Objects + Workflows — Cloudflare Worker (bound by web via script_name)
packages/core    Domain logic + shared types
packages/db      D1 schema / migrations + persistence types
infra/           Provisioning + deployment notes
```

## Develop

```sh
pnpm install
pnpm dev:backend  # terminal 1: DO / Workflow worker (cross-worker bindings via dev registry)
pnpm dev          # terminal 2: apps/web at http://localhost:5173
```

Then open `http://app.localhost:5173` (dashboard, passwordless dev login) and
`http://{channel}.localhost:5173` (public pages). See
[infra/README.md](infra/README.md) for details.

| Command | Description |
| --- | --- |
| `pnpm dev` | Run the web app (Vite; applies local D1 migrations first) |
| `pnpm dev:backend` | Run the DO / Workflow worker (required alongside `pnpm dev`) |
| `pnpm db:migrate` | Apply D1 migrations to the local dev database |
| `pnpm lint` / `pnpm lint:fix` | Lint (and fix) the whole repo |
| `pnpm typecheck` | Typecheck every package |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Build + run Playwright e2e (multi-worker `wrangler dev`) |
| `pnpm build` | Build all buildable packages |

First-time Cloudflare provisioning and deployment: see [infra/README.md](infra/README.md).
