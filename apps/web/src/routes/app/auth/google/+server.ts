import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { GOOGLE_SCOPES, googleClient, googleConfigured } from '$lib/server/auth';
import { safeNext } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';
import { error, redirect } from '@sveltejs/kit';
import { generateCodeVerifier, generateState } from 'arctic';

const COOKIE_OPTS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	secure: !dev,
	maxAge: 60 * 10,
} as const;

export const GET: RequestHandler = ({ platform, cookies, url }) => {
	const env = requireEnv(platform);
	if (!googleConfigured(env))
		error(404);

	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	cookies.set('google_oauth_state', state, COOKIE_OPTS);
	cookies.set('google_oauth_verifier', codeVerifier, COOKIE_OPTS);
	const next = safeNext(url.searchParams.get('next'));
	if (next)
		cookies.set('google_oauth_next', next, COOKIE_OPTS);

	const google = googleClient(env, url.origin);
	redirect(302, google.createAuthorizationURL(state, codeVerifier, GOOGLE_SCOPES).toString());
};
