import { describe, expect, it } from 'vitest';
import { AppError, appErrorCode } from './errors';

describe('appError', () => {
	it('round-trips its code through a plain Error message (RPC tunnel)', () => {
		const err = new AppError('forbidden');
		// workerd re-creates errors as plain Error with the same message.
		const tunneled = new Error(err.message);
		expect(appErrorCode(tunneled)).toBe('forbidden');
	});

	it('round-trips with detail text', () => {
		const err = new AppError('conflict', 'subdomain taken');
		expect(appErrorCode(new Error(err.message))).toBe('conflict');
	});

	it('returns null for foreign errors', () => {
		expect(appErrorCode(new Error('boom'))).toBeNull();
		expect(appErrorCode('app:forbidden')).toBeNull();
		expect(appErrorCode(new Error('app:nonsense'))).toBeNull();
	});
});
