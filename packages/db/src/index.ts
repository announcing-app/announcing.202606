import type { Continent, Role } from '@announcing/core';

/**
 * Row shapes for the global control layer (D1, primary in EU / weur).
 * Only the minimum personal data is stored: `google_sub` + `display_name`.
 *
 * SQL migrations live in ./migrations/d1 and are applied with
 * `wrangler d1 migrations apply` (see infra/README.md). The concrete tables are
 * authored in Phase 1; these interfaces describe their intended shape.
 */
export interface UserRow {
	google_sub: string;
	display_name: string;
}

export interface SessionRow {
	session_id: string;
	user_id: string;
	expires_at: number;
}

export interface ChannelRow {
	subdomain: string;
	channel_id: string;
	region: Continent;
	owner_user_id: string;
}

export interface MembershipRow {
	user_id: string;
	channel_id: string;
	role: Role;
}

/** Directory (relative to this package) holding the D1 SQL migrations. */
export const D1_MIGRATIONS_DIR = 'migrations/d1';
