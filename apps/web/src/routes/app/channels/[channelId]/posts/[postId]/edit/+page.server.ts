import type { Actions, PageServerLoad } from './$types';
import { rpc } from '$lib/server/channel';
import { loadChannelContext } from '$lib/server/dashboard';
import { requireUser } from '$lib/server/guard';
import { deleteImages, uploadPostImages } from '$lib/server/images';
import { requireEnv } from '$lib/server/platform';
import { parsePublishAction } from '$lib/server/posts';
import { publicChannelOrigin } from '$lib/urls';
import { LIMITS } from '@announcing/core';
import { error, fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params, platform, url }) => {
	const user = requireUser(locals);
	const { row, stub } = await loadChannelContext(requireEnv(platform), params.channelId);
	const post = await rpc(stub.getPostForEdit(user.id, params.postId));
	if (!post)
		error(404);
	return { channelId: row.channel_id, post, publicOrigin: publicChannelOrigin(url, row.subdomain) };
};

export const actions: Actions = {
	save: async ({ request, locals, params, platform }) => {
		const user = requireUser(locals);
		const env = requireEnv(platform);
		const { row, stub } = await loadChannelContext(env, params.channelId);
		const post = await rpc(stub.getPostForEdit(user.id, params.postId));
		if (!post)
			error(404);

		const form = await request.formData();
		const body = String(form.get('body') ?? '');
		// Checked "keep" boxes decide which existing images survive the edit.
		const keep = new Set(form.getAll('keep').map(String));
		const keptIds = post.imageIds.filter(id => keep.has(id));
		const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);

		if (body.trim().length === 0 || body.length > LIMITS.postBody)
			return fail(400, { error: 'body' as const, body });

		// Published posts get no publish controls in the form; the default mode
		// 'now' keeps them published (the DO rejects any other transition).
		const publish = parsePublishAction(form);
		if (!publish)
			return fail(400, { error: 'schedule' as const, body });

		const upload = await uploadPostImages(env, row.channel_id, files, keptIds.length);
		if (!upload.ok)
			return fail(400, { error: upload.reason, body });

		const imageIds = [...keptIds, ...upload.imageIds];
		try {
			await rpc(stub.updatePost(user.id, post.id, { body, imageIds, publish }));
		}
		catch (err) {
			await deleteImages(env, row.channel_id, upload.imageIds);
			throw err;
		}
		// Success: drop the images the edit removed (best effort).
		await deleteImages(env, row.channel_id, post.imageIds.filter(id => !keep.has(id)));
		redirect(303, `/channels/${row.channel_id}`);
	},

	delete: async ({ locals, params, platform }) => {
		const user = requireUser(locals);
		const env = requireEnv(platform);
		const { row, stub } = await loadChannelContext(env, params.channelId);
		const deleted = await rpc(stub.deletePost(user.id, params.postId));
		await deleteImages(env, row.channel_id, deleted.imageIds);
		redirect(303, `/channels/${row.channel_id}`);
	},
};
