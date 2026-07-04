import { dev } from '$app/environment';
import { Google } from 'arctic';

/**
 * Google OAuth (OIDC) via arctic — the only production IdP in Phase 1
 * (plan §3.5). We request the bare `openid` scope: the only claim we keep is
 * the immutable `sub`; display names are chosen by the user at onboarding, so
 * no profile data is ever fetched.
 */

export function googleConfigured(env: Env): boolean {
	return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function googleClient(env: Env, origin: string): Google {
	return new Google(
		env.GOOGLE_CLIENT_ID ?? '',
		env.GOOGLE_CLIENT_SECRET ?? '',
		`${origin}/auth/google/callback`,
	);
}

export const GOOGLE_SCOPES = ['openid'];

/**
 * Dev login: create/reuse a local user without any IdP, so the whole product
 * is drivable offline (and in e2e). Enabled in `vite dev` automatically, or
 * with DEV_AUTH=1 (set via .dev.vars / --var, which are never deployed).
 * Dev users are namespaced under google_sub `dev:{name}` — even if the flag
 * ever leaked into production, they could not collide with a real Google sub
 * (real subs are numeric).
 */
export function devAuthEnabled(env: Env): boolean {
	return dev || env.DEV_AUTH === '1';
}

export const DEV_LOGIN_NAME_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;

export function devGoogleSub(name: string): string {
	return `dev:${name}`;
}
