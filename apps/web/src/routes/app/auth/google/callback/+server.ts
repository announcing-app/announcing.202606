import type { RequestHandler } from './$types';
import { googleClient, googleConfigured } from '$lib/server/auth';
import { createUser, getUserByGoogleSub } from '$lib/server/db';
import { safeNext } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';
import { createSession, setSessionCookie } from '$lib/server/session';
import { randomId } from '@announcing/core';
import { redirect } from '@sveltejs/kit';
import { decodeIdToken } from 'arctic';

/**
 * OAuth callback: verify state, exchange the code, and keep exactly one claim
 * — the immutable `sub`. First-time users are created with an empty display
 * name; hooks then force them through /onboarding to pick one (plan §3.5).
 */
export const GET: RequestHandler = async ({ platform, cookies, url }) => {
	const env = requireEnv(platform);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('google_oauth_state');
	const codeVerifier = cookies.get('google_oauth_verifier');
	const next = safeNext(cookies.get('google_oauth_next'));
	for (const name of ['google_oauth_state', 'google_oauth_verifier', 'google_oauth_next'])
		cookies.delete(name, { path: '/' });

	if (!googleConfigured(env) || !code || !state || !storedState || !codeVerifier || state !== storedState)
		redirect(303, '/login?error=oauth');

	let googleSub: string;
	try {
		const google = googleClient(env, url.origin);
		const tokens = await google.validateAuthorizationCode(code, codeVerifier);
		const claims = decodeIdToken(tokens.idToken()) as { sub?: unknown };
		if (typeof claims.sub !== 'string' || claims.sub === '')
			throw new TypeError('id_token missing sub');
		googleSub = claims.sub;
	}
	catch (err) {
		console.error('google oauth callback failed', err);
		redirect(303, '/login?error=oauth');
	}

	let user = await getUserByGoogleSub(env.DB, googleSub);
	if (!user) {
		user = { id: randomId('usr'), google_sub: googleSub, display_name: '', created_at: Date.now() };
		await createUser(env.DB, user);
	}
	const session = await createSession(env.DB, user.id);
	setSessionCookie(cookies, session.token, session.expiresAt);
	redirect(303, user.display_name === '' ? '/onboarding' : (next ?? '/'));
};
