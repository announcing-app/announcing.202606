import { describe, expect, it } from 'vitest';
import { randomId, randomToken, sha256Hex, sortableId } from './ids';

describe('sortableId', () => {
	it('is 26 lowercase crockford chars', () => {
		expect(sortableId()).toMatch(/^[0-9a-hjkmnp-tv-z]{26}$/);
	});

	it('sorts by creation time', () => {
		const a = sortableId(1_000_000);
		const b = sortableId(2_000_000);
		expect(a < b).toBe(true);
	});

	it('does not collide in a quick sample', () => {
		const seen = new Set(Array.from({ length: 1000 }, () => sortableId(42)));
		expect(seen.size).toBe(1000);
	});
});

describe('randomId', () => {
	it('carries the prefix', () => {
		expect(randomId('usr')).toMatch(/^usr_[0-9a-hjkmnp-tv-z]{20}$/);
	});
});

describe('randomToken / sha256Hex', () => {
	it('hashes deterministically to 64 hex chars', async () => {
		const token = randomToken();
		expect(token).toHaveLength(32);
		const h1 = await sha256Hex(token);
		const h2 = await sha256Hex(token);
		expect(h1).toBe(h2);
		expect(h1).toMatch(/^[0-9a-f]{64}$/);
		expect(await sha256Hex(`${token}x`)).not.toBe(h1);
	});
});
