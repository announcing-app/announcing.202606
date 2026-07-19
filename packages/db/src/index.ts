import type { Continent, Role } from '@announcing/core';

/**
 * Row shapes for the global control layer (D1, primary in EU / weur), matching
 * ./migrations/d1. Only the minimum personal data is stored: `google_sub` +
 * `display_name`. Apply migrations with `wrangler d1 migrations apply`
 * (see infra/README.md).
 */

export interface UserRow {
	id: string;
	google_sub: string;
	display_name: string;
	created_at: number;
}

export interface SessionRow {
	/** sha256(token) — raw tokens are never stored. */
	id: string;
	user_id: string;
	expires_at: number;
	created_at: number;
}

export interface ChannelRow {
	subdomain: string;
	channel_id: string;
	region: Continent;
	owner_user_id: string;
	created_at: number;
}

export interface MembershipRow {
	user_id: string;
	channel_id: string;
	role: Role;
	created_at: number;
}

/** Directory (relative to this package) holding the D1 SQL migrations. */
export const D1_MIGRATIONS_DIR = 'migrations/d1';
