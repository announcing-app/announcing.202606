# infra

Cloudflare provisioning and deployment notes for Announcing.

There is no separate "infra worker": each deployable worker keeps its own
`wrangler.jsonc` next to its code (`apps/web`, `apps/backend`). This directory
holds the cross-cutting setup: how to create the shared resources and how the
bindings line up.

## Bindings overview

| Binding   | Type            | Defined in       | Used from        |
| --------- | --------------- | ---------------- | ---------------- |
| `DB`      | D1              | both workers     | web + workflows  |
| `IMAGES`  | R2              | both workers     | web + workflows  |
| `CHANNEL` | Durable Object  | `apps/backend`   | web (cross-worker via `script_name`) |
| `PUBLISH` | Workflow        | `apps/backend`   | web (cross-worker via `script_name`) |
| `ASSETS`  | Static assets   | `apps/web`       | web (SvelteKit)  |

`ChannelDO` and `PublishWorkflow` are **named exports** of the `announcing-backend`
worker. The `announcing-web` worker binds to them by name + `script_name`, because
the SvelteKit adapter only emits a default export.

## 1. Provision shared resources

After `wrangler login`, run:

```sh
./infra/provision.sh
```

This creates the D1 database (`announcing-control`, EU/`weur`) and the R2 bucket
(`announcing-images`). Copy the printed D1 `database_id` into the
`REPLACE_WITH_D1_DATABASE_ID` placeholders in both `wrangler.jsonc` files.

## 2. Local development

Everything runs locally (miniflare emulates D1 / R2 / DO / Workflows / Cache);
no Cloudflare account is needed. Run the two workers in two terminals — the
dev registry resolves the cross-worker `CHANNEL` / `PUBLISH` bindings:

```sh
pnpm dev:backend         # terminal 1: apps/backend via `wrangler dev` (DO/Workflows)
pnpm dev                 # terminal 2: apps/web via vite (applies D1 migrations first)
```

Hosts mirror production through `*.localhost` (resolves to loopback):

| URL | Surface |
| --- | --- |
| `http://localhost:5173` | landing |
| `http://app.localhost:5173` | dashboard (log in via the dev login) |
| `http://{channel}.localhost:5173` | public channel pages |

- **Login**: `vite dev` enables the passwordless dev login automatically; real
  Google OAuth needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in
  `apps/web/.dev.vars` (see `.dev.vars.example`).
- **D1 migrations** (`packages/db/migrations/d1`) are applied to local state by
  `pnpm db:migrate` — `pnpm dev` / `pnpm preview` run it automatically.
- The built app can be exercised with `pnpm --filter @announcing/web preview`
  (single-process multi-config `wrangler dev` on :4173, dev auth via `--var`).
  Playwright e2e (`pnpm test:e2e`) builds and drives exactly that.
- Local workerd cannot emulate DO **jurisdictions**; `lib/server/channel.ts`
  falls back to the plain namespace for that specific error (dev only, logged).

## 3. Deploy

Deploy the backend first (it defines the DO + Workflow that web binds to):

```sh
pnpm --filter @announcing/backend deploy
pnpm --filter @announcing/web build && pnpm --filter @announcing/web exec wrangler deploy
```

One-time setup for the web worker:

```sh
cd apps/web
wrangler d1 migrations apply announcing-control --remote   # global control schema
wrangler secret put GOOGLE_CLIENT_ID                       # Google OAuth client
wrangler secret put GOOGLE_CLIENT_SECRET
```

The Google OAuth client must allow the redirect URI
`https://app.announcing.app/auth/google/callback`. The production apex is the
`PUBLIC_BASE_HOST` var in `apps/web/wrangler.jsonc`. Never set `DEV_AUTH` in
production.

## Notes

- A channel's region is chosen at creation and is **immutable** (data migration).
- Channel regions use Cloudflare's DO location hints (`afr`/`apac`/`eeur`/`enam`/
  `me`/`oc`/`sam`/`weur`/`wnam`); `weur`/`eeur` channels are created with
  `jurisdiction: 'eu'` instead of a hint.
- For EU-jurisdiction image storage, create the bucket with `--jurisdiction eu`
  and add `"jurisdiction": "eu"` to the R2 binding.
- `database_id` placeholders are committed on purpose so the config typechecks;
  real IDs are environment-specific.
