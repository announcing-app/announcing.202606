import type { RequestHandler } from './$types';
import { requireEnv } from '$lib/server/platform';
import { IMAGE_ID_RE, imageR2Key } from '@announcing/core';
import { error } from '@sveltejs/kit';

/**
 * Post images, straight from R2. Image ids are unique per upload and objects
 * never change, so responses are immutable and edge-cached by the hooks.
 */
export const GET: RequestHandler = async ({ locals, params, platform }) => {
	if (!IMAGE_ID_RE.test(params.imageId))
		error(404);
	const env = requireEnv(platform);
	const object = await env.IMAGES.get(imageR2Key(locals.channel!.channelId, params.imageId));
	if (!object)
		error(404);

	// Headers are built from the plain-string metadata (not writeHttpMetadata):
	// vite dev's platform proxy cannot marshal a Headers instance across the
	// miniflare boundary, and these values are ours from upload time anyway.
	return new Response(object.body as unknown as BodyInit, {
		headers: {
			'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
			'cache-control': object.httpMetadata?.cacheControl ?? 'public, max-age=31536000, immutable',
			'etag': object.httpEtag,
		},
	});
};
