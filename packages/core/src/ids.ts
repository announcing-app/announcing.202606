/**
 * ID generation. No external dependency: Workers, Node ≥22 and browsers all
 * provide `crypto.getRandomValues`.
 *
 * Two shapes:
 * - `sortableId()`  — ULID-style (48-bit ms timestamp + 80 bits randomness),
 *   lowercase Crockford base32, 26 chars. Used where creation order matters
 *   (posts, images): `ORDER BY id` is chronological.
 * - `randomId(prefix)` — unordered opaque id (`usr_…`, `ch_…`, `inv_…`).
 */

/** Lowercase Crockford base32 (no i/l/o/u). 32 chars → an even divisor of 256. */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

function randomChars(length: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	let out = '';
	for (const b of bytes)
		out += ALPHABET[b % 32];
	return out;
}

function encodeTime(ms: number): string {
	let out = '';
	let rest = ms;
	for (let i = 0; i < 10; i++) {
		out = ALPHABET[rest % 32] + out;
		rest = Math.floor(rest / 32);
	}
	return out;
}

/** 26-char ULID-style id; lexicographic order == creation order. */
export function sortableId(now: number = Date.now()): string {
	return encodeTime(now) + randomChars(16);
}

/** Opaque random id with a debugging-friendly prefix, e.g. `usr_04qmv…`. */
export function randomId(prefix: string, length = 20): string {
	return `${prefix}_${randomChars(length)}`;
}

/** URL-safe random secret (base32, ~5 bits/char). 32 chars ≈ 160 bits. */
export function randomToken(length = 32): string {
	return randomChars(length);
}

/** Hex SHA-256. Stored instead of raw session/invite tokens. */
export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
