import type { Actions, PageServerLoad } from './$types';
import { updateDisplayName } from '$lib/server/db';
import { requireUser } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';
import { LIMITS } from '@announcing/core';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return { displayName: user.displayName };
};

export const actions: Actions = {
	default: async ({ request, locals, platform }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const displayName = String(form.get('display_name') ?? '').trim();
		if (displayName.length === 0 || displayName.length > LIMITS.displayName)
			return fail(400, { error: true });
		await updateDisplayName(requireEnv(platform).DB, user.id, displayName);
		redirect(303, '/');
	},
};
