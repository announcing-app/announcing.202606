import type { RequestHandler } from './$types';
import { requireEnv } from '$lib/server/platform';
import { deleteSessionCookie, invalidateSession } from '$lib/server/session';
import { redirect } from '@sveltejs/kit';

// Plain <form method="post" action="/logout"> — SvelteKit's origin check
// already rejects cross-site form posts.
export const POST: RequestHandler = async ({ locals, cookies, platform }) => {
	if (locals.sessionId)
		await invalidateSession(requireEnv(platform).DB, locals.sessionId);
	deleteSessionCookie(cookies);
	redirect(303, '/login');
};
