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

The SvelteKit dev server emulates D1/R2 locally (miniflare), which is everything
Phase 0 exercises:

```sh
pnpm dev                 # apps/web on http://localhost:5173
```

To work on the Durable Object / Workflow worker in isolation:

```sh
pnpm dev:backend         # apps/backend via `wrangler dev`
```

Once web code actually calls `CHANNEL` / `PUBLISH` (Phase 1+), run both workers
together so the cross-worker bindings resolve via the dev registry:

```sh
pnpm --filter @announcing/web build
wrangler dev -c apps/web/wrangler.jsonc -c apps/backend/wrangler.jsonc
```

## 3. Deploy

Deploy the backend first (it defines the DO + Workflow that web binds to):

```sh
pnpm --filter @announcing/backend deploy
pnpm --filter @announcing/web build && pnpm --filter @announcing/web exec wrangler deploy
```

## Notes

- A channel's region is chosen at creation and is **immutable** (data migration).
- For EU-jurisdiction image storage, create the bucket with `--jurisdiction eu`
  and add `"jurisdiction": "eu"` to the R2 binding.
- `database_id` placeholders are committed on purpose so the config typechecks;
  real IDs are environment-specific.
