import type { Reroute } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { deLocalizeUrl } from '$lib/paraglide/runtime';
import { classifyHost } from '@announcing/core';

/**
 * Host-based routing (plan §3.4): one worker serves three surfaces, mapped to
 * internal route groups by rewriting the pathname.
 *
 *   app.{base}       →  /app/*    dashboard
 *   {channel}.{base} →  /c/{channel}/*  public channel pages
 *   {base}, www      →  /*        landing
 *
 * hooks.server.ts re-checks host↔route-group agreement, so a direct hit on
 * /app/* or /c/* from the wrong host 404s instead of leaking through.
 */
export const reroute: Reroute = ({ url }) => {
	const pathname = deLocalizeUrl(url).pathname;
	const host = classifyHost(url.hostname, env.PUBLIC_BASE_HOST);
	if (host.kind === 'dashboard')
		return `/app${pathname === '/' ? '' : pathname}`;
	if (host.kind === 'channel')
		return `/c/${host.subdomain}${pathname === '/' ? '' : pathname}`;
	return pathname;
};
