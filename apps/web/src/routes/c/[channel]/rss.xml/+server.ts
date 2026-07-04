import type { RequestHandler } from './$types';
import { channelStub, rpc } from '$lib/server/channel';
import { requireEnv } from '$lib/server/platform';
import { buildRssXml } from '@announcing/core';
import { error } from '@sveltejs/kit';

/**
 * RSS 2.0 feed of a channel's published posts. Same data and cache policy as
 * the public HTML page (edge-cached via hooks, no cookies, no tracking).
 */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const { channelId, region } = locals.channel!;
	const view = await rpc(channelStub(requireEnv(platform), channelId, region).getPublicView());
	if (!view)
		error(404);
	return new Response(buildRssXml({ meta: view.meta, origin: url.origin, posts: view.posts }), {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'public, max-age=60',
		},
	});
};
