import { describe, expect, it } from 'vitest';
import { publicChannelOrigin } from './urls';

describe('publicChannelOrigin', () => {
	it('derives the channel origin from the dashboard origin', () => {
		expect(publicChannelOrigin(new URL('https://app.announcing.app/channels/x'), 'cityhall'))
			.toBe('https://cityhall.announcing.app');
	});

	it('keeps the dev port', () => {
		expect(publicChannelOrigin(new URL('http://app.localhost:5173/'), 'cityhall'))
			.toBe('http://cityhall.localhost:5173');
	});
});
