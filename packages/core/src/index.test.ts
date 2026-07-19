import { describe, expect, it } from 'vitest';
import { isValidSubdomain, RESERVED_SUBDOMAINS } from './index';

describe('isValidSubdomain', () => {
	it('accepts well-formed names', () => {
		expect(isValidSubdomain('cityhall')).toBe(true);
		expect(isValidSubdomain('my-channel')).toBe(true);
		expect(isValidSubdomain('abc')).toBe(true);
	});

	it('rejects names that are too short or too long', () => {
		expect(isValidSubdomain('ab')).toBe(false);
		expect(isValidSubdomain('a'.repeat(64))).toBe(false);
	});

	it('rejects invalid characters and shapes', () => {
		expect(isValidSubdomain('Foo')).toBe(false);
		expect(isValidSubdomain('-foo')).toBe(false);
		expect(isValidSubdomain('foo-')).toBe(false);
		expect(isValidSubdomain('foo--bar')).toBe(false);
		expect(isValidSubdomain('foo.bar')).toBe(false);
	});

	it('rejects reserved subdomains', () => {
		for (const name of RESERVED_SUBDOMAINS)
			expect(isValidSubdomain(name)).toBe(false);
	});
});
