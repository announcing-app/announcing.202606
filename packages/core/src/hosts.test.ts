import { describe, expect, it } from 'vitest';
import { classifyHost } from './hosts';

const BASE = 'announcing.app';

describe('classifyHost', () => {
	it('maps production hosts', () => {
		expect(classifyHost('announcing.app', BASE)).toEqual({ kind: 'landing' });
		expect(classifyHost('www.announcing.app', BASE)).toEqual({ kind: 'landing' });
		expect(classifyHost('app.announcing.app', BASE)).toEqual({ kind: 'dashboard' });
		expect(classifyHost('cityhall.announcing.app', BASE)).toEqual({ kind: 'channel', subdomain: 'cityhall' });
	});

	it('maps the localhost family regardless of base host', () => {
		expect(classifyHost('localhost', BASE)).toEqual({ kind: 'landing' });
		expect(classifyHost('localhost')).toEqual({ kind: 'landing' });
		expect(classifyHost('app.localhost')).toEqual({ kind: 'dashboard' });
		expect(classifyHost('cityhall.localhost', BASE)).toEqual({ kind: 'channel', subdomain: 'cityhall' });
	});

	it('rejects nested and malformed subdomains', () => {
		expect(classifyHost('a.b.announcing.app', BASE)).toEqual({ kind: 'unknown' });
		expect(classifyHost('ab.announcing.app', BASE)).toEqual({ kind: 'unknown' }); // too short
		expect(classifyHost('a.b.localhost')).toEqual({ kind: 'unknown' });
	});

	it('treats reserved subdomains as unknown, not channels', () => {
		expect(classifyHost('api.announcing.app', BASE)).toEqual({ kind: 'unknown' });
		expect(classifyHost('admin.localhost')).toEqual({ kind: 'unknown' });
	});

	it('is case-insensitive', () => {
		expect(classifyHost('APP.Announcing.App', BASE)).toEqual({ kind: 'dashboard' });
	});

	it('classifies unrelated hosts as unknown', () => {
		expect(classifyHost('announcing-web.example.workers.dev', BASE)).toEqual({ kind: 'unknown' });
		expect(classifyHost('evil.com', BASE)).toEqual({ kind: 'unknown' });
		// suffix match must be on a label boundary
		expect(classifyHost('evilannouncing.app', BASE)).toEqual({ kind: 'unknown' });
	});
});
