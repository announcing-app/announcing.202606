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
pnpm dev          # apps/web at http://localhost:5173
```

| Command | Description |
| --- | --- |
| `pnpm dev` | Run the web app (Vite, local bindings emulated) |
| `pnpm dev:backend` | Run the DO / Workflow worker in isolation |
| `pnpm lint` / `pnpm lint:fix` | Lint (and fix) the whole repo |
| `pnpm typecheck` | Typecheck every package |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run Playwright e2e tests |
| `pnpm build` | Build all buildable packages |

First-time Cloudflare provisioning and deployment: see [infra/README.md](infra/README.md).
