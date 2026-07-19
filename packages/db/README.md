# @announcing/db

Schema and persistence types for Announcing's two data layers.

## Global control layer — D1 (`announcing-control`, primary in EU / `weur`)

Holds only what must be globally unique or globally queryable, with minimum
personal data: `users`, `sessions`, `channels` (subdomain registry),
`memberships` (dashboard index).

- TypeScript row shapes: [`src/index.ts`](./src/index.ts)
- SQL migrations: [`migrations/d1/`](./migrations/d1/) — applied with
  `wrangler d1 migrations apply announcing-control` (see [`infra/README.md`](../../infra/README.md)).

## Regional data layer — ChannelDO SQLite (per channel)

The strongly-consistent source of truth for each channel's posts, members and
settings lives **inside the Durable Object**, not in D1. Its schema is defined
and migrated in code: [`apps/backend/src/channel-do.ts`](../../apps/backend/src/channel-do.ts).

> Membership permissions are owned by the ChannelDO. The `memberships` table in
> D1 is only an index for listing a user's channels.
