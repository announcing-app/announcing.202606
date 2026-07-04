import { describe, expect, it } from 'vitest';
import { sniffImageType } from './images';

function bytes(...values: (number | string)[]): Uint8Array {
	const out: number[] = [];
	for (const v of values) {
		if (typeof v === 'string')
			out.push(...[...v].map(c => c.charCodeAt(0)));
		else out.push(v);
	}
	return new Uint8Array(out);
}

describe('sniffImageType', () => {
	it('detects jpeg / png / webp / gif', () => {
		expect(sniffImageType(bytes(0xFF, 0xD8, 0xFF, 0xE0))?.contentType).toBe('image/jpeg');
		expect(sniffImageType(bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))?.contentType).toBe('image/png');
		expect(sniffImageType(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))?.contentType).toBe('image/webp');
		expect(sniffImageType(bytes('GIF89a'))?.contentType).toBe('image/gif');
		expect(sniffImageType(bytes('GIF87a'))?.contentType).toBe('image/gif');
	});

	it('rejects unknown or truncated data', () => {
		expect(sniffImageType(bytes('<svg xmlns='))).toBeNull();
		expect(sniffImageType(bytes(0xFF, 0xD8))).toBeNull();
		expect(sniffImageType(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
		expect(sniffImageType(new Uint8Array(0))).toBeNull();
	});
});
