import { imageR2Key, LIMITS, sniffImageType, sortableId } from '@announcing/core';

/**
 * Post images in R2. Keys are `{channelId}/{imageId}`; the imageId is minted
 * server-side and the content type comes from magic-byte sniffing — the
 * client-declared type is ignored (plan §6). Objects are immutable: an edit
 * uploads new ids, so public image URLs can be cached forever.
 */

export type ImageUploadResult
	= | { ok: true; imageIds: string[] }
		| { ok: false; reason: 'too_many' | 'too_large' | 'unsupported' };

export async function uploadPostImages(
	env: Env,
	channelId: string,
	files: File[],
	existingCount = 0,
): Promise<ImageUploadResult> {
	if (existingCount + files.length > LIMITS.postImages)
		return { ok: false, reason: 'too_many' };

	const validated: { bytes: ArrayBuffer; contentType: string }[] = [];
	for (const file of files) {
		if (file.size > LIMITS.imageBytes)
			return { ok: false, reason: 'too_large' };
		const bytes = await file.arrayBuffer();
		const type = sniffImageType(new Uint8Array(bytes));
		if (!type)
			return { ok: false, reason: 'unsupported' };
		validated.push({ bytes, contentType: type.contentType });
	}

	const imageIds: string[] = [];
	for (const { bytes, contentType } of validated) {
		const imageId = `img_${sortableId()}`;
		await env.IMAGES.put(imageR2Key(channelId, imageId), bytes, {
			httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
		});
		imageIds.push(imageId);
	}
	return { ok: true, imageIds };
}

/** Best-effort cleanup (post deleted / edit dropped images / create failed). */
export async function deleteImages(env: Env, channelId: string, imageIds: string[]): Promise<void> {
	if (imageIds.length > 0)
		await env.IMAGES.delete(imageIds.map(id => imageR2Key(channelId, id)));
}
