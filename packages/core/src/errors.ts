/**
 * Application errors that cross the ChannelDO RPC boundary.
 *
 * workerd tunnels `Error` instances by message (custom subclass fields are not
 * preserved), so the machine-readable code is encoded into the message with an
 * `app:` prefix and parsed back on the web side with `appErrorCode()`.
 */

export const APP_ERROR_CODES = [
	'forbidden', // caller lacks the required role
	'not_found', // channel/post/invite does not exist (or invite already used)
	'conflict', // uniqueness violated / already initialized
	'invalid', // input failed validation
	'expired', // invite past its expiry
	'already_member', // invite accepted by an existing member
	'last_owner', // would leave the channel with no owner
	'uninitialized', // DO exists but init() never ran
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

const PREFIX = 'app:';

export class AppError extends Error {
	constructor(readonly code: AppErrorCode, detail?: string) {
		super(detail ? `${PREFIX}${code}: ${detail}` : `${PREFIX}${code}`);
		this.name = 'AppError';
	}
}

/** Extract the AppErrorCode from any thrown value (RPC-tunneled or local). */
export function appErrorCode(err: unknown): AppErrorCode | null {
	if (!(err instanceof Error) || !err.message.startsWith(PREFIX))
		return null;
	const rest = err.message.slice(PREFIX.length);
	const code = (rest.split(':', 1)[0] ?? '').trim() as AppErrorCode;
	return APP_ERROR_CODES.includes(code) ? code : null;
}
