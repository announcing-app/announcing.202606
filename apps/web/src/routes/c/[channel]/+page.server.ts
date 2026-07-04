import type { PageServerLoad } from './$types';
import { channelStub, rpc } from '$lib/server/channel';
import { requireEnv } from '$lib/server/platform';
import { renderBodyHtml } from '@announcing/core';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, platform, setHeaders }) => {
	const { channelId, region } = locals.channel!;
	const view = await rpc(channelStub(requireEnv(platform), channelId, region).getPublicView());
	if (!view)
		error(404);

	locals.contentLocale = view.meta.locale;
	// Edge cache (Cache API in hooks) + browsers: short TTL; edits show up
	// within a minute. Immutable revision URLs come with Phase 2.
	setHeaders({ 'cache-control': 'public, max-age=60' });

	return {
		meta: view.meta,
		posts: view.posts.map(post => ({ ...post, bodyHtml: renderBodyHtml(post.body) })),
	};
};
