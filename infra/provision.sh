#!/usr/bin/env bash
set -euo pipefail

# Provision the Cloudflare resources referenced by apps/web/wrangler.jsonc and
# apps/backend/wrangler.jsonc. Run once, after `wrangler login`.
# Cloudflare will error if a resource already exists, so this is safe to re-read
# before running but not idempotent on re-run.

echo "==> Creating D1 database 'announcing-control' (primary in EU / weur)…"
wrangler d1 create announcing-control --location weur

echo
echo "==> Creating R2 bucket 'announcing-images'…"
# For EU-jurisdiction storage instead use:  --jurisdiction eu
# (and add "jurisdiction": "eu" to the R2 binding in both wrangler.jsonc files).
wrangler r2 bucket create announcing-images --location weur

echo
echo "Done."
echo "Copy the D1 'database_id' printed above into the REPLACE_WITH_D1_DATABASE_ID"
echo "placeholders in apps/web/wrangler.jsonc and apps/backend/wrangler.jsonc."
