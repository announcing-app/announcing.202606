import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';
import { getTextDirection, locales } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getChannelBySubdomain } from '$lib/server/db';
import { requireEnv } from '$lib/server/platform';
import { deleteSessionCookie, SESSION_COOKIE, setSessionCookie, validateSessionToken } from '$lib/server/session';
import { classifyHost } from '@announcing/core';
import { error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

/**
 * Classify the host, pin route groups to their hosts, resolve the channel
 * registry row for channel hosts, and serve public channel pages through the
 * edge cache (Cache API). Cached responses are immutable-per-URL renders; the
 * TTL comes from the cache-control header each public route sets.
 */
const handleHosts: Handle = async ({ event, resolve }) => {
	const host = classifyHost(event.url.hostname, publicEnv.PUBLIC_BASE_HOST);
	event.locals.host = host;
	event.locals.user = null;

	const routeId = event.route.id;
	if (routeId?.startsWith('/app') && host.kind !== 'dashboard')
		error(404);
	if (routeId?.startsWith('/c/') && host.kind !== 'channel')
		error(404);

	if (host.kind !== 'channel')
		return resolve(event);

	// -- public channel host ---------------------------------------------------
	// (workers-types' Response/DOM Response mismatch makes the casts necessary)
	const platform = event.platform;
	const cache = !dev && event.request.method === 'GET' ? platform?.caches.default : undefined;
	if (cache) {
		const cached = await cache.match(event.url.href);
		if (cached)
			return cached as unknown as Response;
	}

	const row = await getChannelBySubdomain(requireEnv(platform).DB, host.subdomain);
	if (!row)
		error(404);
	event.locals.channel = { channelId: row.channel_id, subdomain: row.subdomain, region: row.region };

	const response = await resolve(event);

	const cc = response.headers.get('cache-control') ?? '';
	if (cache && response.status === 200 && /(?:s-maxage|max-age)=[1-9]/.test(cc) && !response.headers.has('set-cookie'))
		platform?.ctx.waitUntil(cache.put(event.url.href, response.clone() as unknown as Parameters<typeof cache.put>[1]));
	return response;
};

/** Paths under /app that must work without a session. */
const PUBLIC_APP_ROUTES = ['/app/login', '/app/auth/', '/app/invites/'];

/**
 * Sessions are resolved on dashboard hosts only — landing and public channel
 * pages never read cookies, which keeps them tracking-free and cacheable.
 */
const handleAuth: Handle = async ({ event, resolve }) => {
	if (event.locals.host.kind !== 'dashboard')
		return resolve(event);

	const env = requireEnv(event.platform);
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = await validateSessionToken(env.DB, token);
		if (session) {
			event.locals.user = { id: session.user.id, displayName: session.user.display_name };
			event.locals.sessionId = session.sessionId;
			if (session.renewedExpiresAt)
				setSessionCookie(event.cookies, token, session.renewedExpiresAt);
		}
		else {
			deleteSessionCookie(event.cookies);
		}
	}

	const routeId = event.route.id ?? '';
	const isPublic = PUBLIC_APP_ROUTES.some(p => routeId === p || routeId.startsWith(p));
	if (routeId.startsWith('/app') && !isPublic) {
		if (!event.locals.user) {
			const next = event.url.pathname === '/' ? '' : `?next=${encodeURIComponent(event.url.pathname)}`;
			redirect(303, `/login${next}`);
		}
		// First login: force choosing a display name before anything else.
		if (event.locals.user.displayName === '' && routeId !== '/app/onboarding' && routeId !== '/app/logout')
			redirect(303, '/onboarding');
	}
	return resolve(event);
};

/**
 * UI locale via paraglide (cookie → Accept-Language → base). Public channel
 * pages override <html lang> with the channel's own locale (set by their loads
 * into locals.contentLocale) so cached HTML is byte-stable per URL.
 */
const handleParaglide: Handle = ({ event, resolve }) => paraglideMiddleware(event.request, ({ request, locale }) => {
	event.request = request;

	return resolve(event, {
		transformPageChunk: ({ html }) => {
			const lang = (locales as readonly string[]).includes(event.locals.contentLocale ?? '')
				? event.locals.contentLocale!
				: locale;
			return html.replace('%paraglide.lang%', lang).replace('%paraglide.dir%', getTextDirection(lang as typeof locale));
		},
	});
});

export const handle: Handle = sequence(handleHosts, handleAuth, handleParaglide);
