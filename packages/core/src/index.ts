export const APP_NAME = 'Announcing';

/**
 * Continents we place channel data in, matching Cloudflare location hints.
 * A channel's region is chosen at creation and is immutable thereafter.
 */
export const CONTINENTS = ['af', 'apac', 'eeur', 'enam', 'me', 'oc', 'sam', 'weur'] as const;
export type Continent = (typeof CONTINENTS)[number];

/** Channel member roles. Source of truth is the ChannelDO; D1 keeps an index. */
export type Role = 'owner' | 'editor';

/** Subdomains that may never be claimed as a channel name. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
	'www',
	'app',
	'api',
	'static',
	'assets',
	'admin',
	'mail',
	'cdn',
	'status',
	'help',
	'docs',
	'blog',
]);

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * A channel subdomain must be 3–63 chars, lowercase alphanumerics and hyphens,
 * no leading/trailing or doubled hyphens, and not a reserved word.
 */
export function isValidSubdomain(value: string): boolean {
	if (value.length < 3 || value.length > 63)
		return false;
	if (!SUBDOMAIN_RE.test(value))
		return false;
	if (value.includes('--'))
		return false;
	return !RESERVED_SUBDOMAINS.has(value);
}
