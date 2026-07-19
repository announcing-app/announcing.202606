import type { RequestHandler } from './$types';
import { channelStub, rpc } from '$lib/server/channel';
import { requireEnv } from '$lib/server/platform';
import { buildAtomXml } from '@announcing/core';
import { error } from '@sveltejs/kit';

/** Atom feed — see rss.xml/+server.ts; identical policy, different format. */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const { channelId, region } = locals.channel!;
	const view = await rpc(channelStub(requireEnv(platform), channelId, region).getPublicView());
	if (!view)
		error(404);
	return new Response(buildAtomXml({ meta: view.meta, origin: url.origin, posts: view.posts }), {
		headers: {
			'content-type': 'application/atom+xml; charset=utf-8',
			'cache-control': 'public, max-age=60',
		},
	});
};
