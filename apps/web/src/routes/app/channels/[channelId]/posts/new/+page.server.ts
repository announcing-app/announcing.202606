import type { Actions, PageServerLoad } from './$types';
import { rpc } from '$lib/server/channel';
import { loadChannelContext } from '$lib/server/dashboard';
import { requireUser } from '$lib/server/guard';
import { deleteImages, uploadPostImages } from '$lib/server/images';
import { requireEnv } from '$lib/server/platform';
import { LIMITS, sortableId } from '@announcing/core';
import { error, fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params, platform }) => {
	const user = requireUser(locals);
	const { row, stub } = await loadChannelContext(requireEnv(platform), params.channelId);
	if (!(await rpc(stub.getRole(user.id))))
		error(403);
	return { channelId: row.channel_id };
};

export const actions: Actions = {
	default: async ({ request, locals, params, platform }) => {
		const user = requireUser(locals);
		const env = requireEnv(platform);
		const { row, stub } = await loadChannelContext(env, params.channelId);

		// Check the role before uploading anything, so non-members can't leave
		// orphan objects in R2. The DO re-checks on createPost regardless.
		if (!(await rpc(stub.getRole(user.id))))
			error(403);

		const form = await request.formData();
		const body = String(form.get('body') ?? '');
		const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);

		if (body.trim().length === 0 || body.length > LIMITS.postBody)
			return fail(400, { error: 'body' as const, body });

		const upload = await uploadPostImages(env, row.channel_id, files);
		if (!upload.ok)
			return fail(400, { error: upload.reason, body });

		try {
			await rpc(stub.createPost(user.id, { id: sortableId(), body, imageIds: upload.imageIds }));
		}
		catch (err) {
			await deleteImages(env, row.channel_id, upload.imageIds);
			throw err;
		}
		redirect(303, `/channels/${row.channel_id}`);
	},
};
