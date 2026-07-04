/**
 * Server-side image validation. The client-declared content type is ignored;
 * the stored type comes from sniffing magic bytes. Anything unrecognized is
 * rejected (plan §6: validate size and format server-side).
 */

export interface ImageType {
	contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
	ext: 'jpg' | 'png' | 'webp' | 'gif';
}

/**
 * Image ids are `img_` + a 26-char sortable id. Everything that builds an R2
 * key from a client-supplied id must validate against this first.
 */
export const IMAGE_ID_RE = /^img_[0-9a-hjkmnp-tv-z]{26}$/;

export function imageR2Key(channelId: string, imageId: string): string {
	return `${channelId}/${imageId}`;
}

function startsWith(bytes: Uint8Array, magic: number[], offset = 0): boolean {
	if (bytes.length < offset + magic.length)
		return false;
	return magic.every((b, i) => bytes[offset + i] === b);
}

export function sniffImageType(bytes: Uint8Array): ImageType | null {
	if (startsWith(bytes, [0xFF, 0xD8, 0xFF]))
		return { contentType: 'image/jpeg', ext: 'jpg' };
	if (startsWith(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
		return { contentType: 'image/png', ext: 'png' };
	// RIFF....WEBP
	if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
		return { contentType: 'image/webp', ext: 'webp' };
	// GIF87a / GIF89a
	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61)
		return { contentType: 'image/gif', ext: 'gif' };
	return null;
}
