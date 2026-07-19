import { isValidSubdomain } from './channel';

/**
 * Host-based routing: one SvelteKit worker serves three kinds of hosts.
 *
 *   announcing.app / www.announcing.app   → landing
 *   app.announcing.app                    → dashboard (authenticated)
 *   {channel}.announcing.app              → public channel (anonymous, cached)
 *
 * Local dev mirrors production with `*.localhost`, which browsers and the
 * macOS/Linux resolvers map to loopback: `localhost:5173` (landing),
 * `app.localhost:5173` (dashboard), `{channel}.localhost:5173` (channel).
 */
export type HostInfo
	= | { kind: 'landing' }
		| { kind: 'dashboard' }
		| { kind: 'channel'; subdomain: string }
		| { kind: 'unknown' };

export const DASHBOARD_SUBDOMAIN = 'app';

function classifySubdomain(sub: string): HostInfo {
	if (sub === DASHBOARD_SUBDOMAIN)
		return { kind: 'dashboard' };
	if (sub === 'www')
		return { kind: 'landing' };
	if (isValidSubdomain(sub))
		return { kind: 'channel', subdomain: sub };
	return { kind: 'unknown' };
}

/**
 * Classify a request hostname (no port). `baseHost` is the production apex
 * (e.g. `announcing.app`, from PUBLIC_BASE_HOST); the localhost family is
 * always recognized so dev needs no configuration. Unknown hosts (e.g.
 * `*.workers.dev` before DNS is wired up) are the caller's decision.
 */
export function classifyHost(hostname: string, baseHost?: string): HostInfo {
	const host = hostname.toLowerCase();

	if (host === 'localhost' || host === '127.0.0.1' || host === '::1')
		return { kind: 'landing' };
	if (host.endsWith('.localhost'))
		return classifySubdomain(host.slice(0, -'.localhost'.length));

	const base = baseHost?.toLowerCase();
	if (base) {
		if (host === base)
			return { kind: 'landing' };
		if (host.endsWith(`.${base}`))
			return classifySubdomain(host.slice(0, -(base.length + 1)));
	}
	return { kind: 'unknown' };
}
