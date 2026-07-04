import type { PageServerLoad } from './$types';
import { channelStub, rpc } from '$lib/server/channel';
import { requireEnv } from '$lib/server/platform';
import { renderBodyHtml } from '@announcing/core';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params, platform, setHeaders }) => {
	const { channelId, region } = locals.channel!;
	const result = await rpc(channelStub(requireEnv(platform), channelId, region).getPublicPost(params.postId));
	if (!result)
		error(404);

	locals.contentLocale = result.meta.locale;
	setHeaders({ 'cache-control': 'public, max-age=60' });

	return {
		meta: result.meta,
		post: { ...result.post, bodyHtml: renderBodyHtml(result.post.body) },
	};
};
