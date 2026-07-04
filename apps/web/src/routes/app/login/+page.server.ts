import type { Actions, PageServerLoad } from './$types';
import { DEV_LOGIN_NAME_RE, devAuthEnabled, devGoogleSub, googleConfigured } from '$lib/server/auth';
import { createUser, getUserByGoogleSub } from '$lib/server/db';
import { safeNext } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';
import { createSession, setSessionCookie } from '$lib/server/session';
import { randomId } from '@announcing/core';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = ({ locals, url, platform }) => {
	if (locals.user)
		redirect(303, safeNext(url.searchParams.get('next')) ?? '/');
	const env = requireEnv(platform);
	return {
		googleEnabled: googleConfigured(env),
		devEnabled: devAuthEnabled(env),
		next: safeNext(url.searchParams.get('next')),
		oauthError: url.searchParams.get('error') !== null,
	};
};

export const actions: Actions = {
	/**
	 * Dev-only login (no IdP): finds or creates a `dev:{name}` user. Rejected
	 * outright unless dev auth is enabled — see devAuthEnabled for the rules.
	 */
	dev: async ({ request, cookies, platform, url }) => {
		const env = requireEnv(platform);
		if (!devAuthEnabled(env))
			return fail(403, { error: 'dev_disabled' as const });

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().toLowerCase();
		if (!DEV_LOGIN_NAME_RE.test(name))
			return fail(400, { error: 'dev_name_invalid' as const });

		let user = await getUserByGoogleSub(env.DB, devGoogleSub(name));
		if (!user) {
			user = { id: randomId('usr'), google_sub: devGoogleSub(name), display_name: name, created_at: Date.now() };
			await createUser(env.DB, user);
		}
		const session = await createSession(env.DB, user.id);
		setSessionCookie(cookies, session.token, session.expiresAt);
		redirect(303, safeNext(url.searchParams.get('next')) ?? '/');
	},
};
