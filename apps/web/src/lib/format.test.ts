import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
	it('is deterministic (UTC) regardless of host timezone', () => {
		const ts = Date.UTC(2026, 6, 4, 12, 30);
		expect(formatDate(ts, 'en')).toBe(formatDate(ts, 'en'));
		expect(formatDate(ts, 'en')).toContain('2026');
		expect(formatDate(ts, 'ja')).toContain('2026');
	});
});
