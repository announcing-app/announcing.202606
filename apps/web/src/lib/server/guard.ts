import { redirect } from '@sveltejs/kit';

/**
 * hooks.server.ts already gates /app routes; this narrows the type (and
 * re-checks on routes outside the blanket guard, e.g. invite accept actions).
 */
export function requireUser(locals: App.Locals): NonNullable<App.Locals['user']> {
	if (!locals.user)
		redirect(303, '/login');
	return locals.user;
}

/** `next` redirect targets must stay on this origin. */
export function safeNext(next: string | null | undefined): string | null {
	if (next && next.startsWith('/') && !next.startsWith('//'))
		return next;
	return null;
}
