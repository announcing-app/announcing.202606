import type { UserRow } from '@announcing/db';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { randomToken, sha256Hex } from '@announcing/core';
import {
	deleteExpiredSessions,
	deleteSession,
	getSessionWithUser,
	insertSession,
	touchSession,
} from './db';

/**
 * Cookie sessions backed by the D1 `sessions` table (plan §3.5): the cookie
 * carries a random bearer token; D1 stores only its sha256, so a leaked DB
 * readout cannot mint sessions. Sliding expiry: 30 days, renewed when the
 * remaining lifetime drops below half.
 */

export const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
	id: string;
	displayName: string;
}

export async function createSession(db: D1Database, userId: string): Promise<{ token: string; expiresAt: number }> {
	const token = randomToken();
	const now = Date.now();
	const expiresAt = now + SESSION_TTL_MS;
	await deleteExpiredSessions(db, now);
	await insertSession(db, { id: await sha256Hex(token), user_id: userId, expires_at: expiresAt, created_at: now });
	return { token, expiresAt };
}

export interface ValidatedSession {
	sessionId: string;
	user: UserRow;
	/** Set when the sliding expiry was extended; re-issue the cookie then. */
	renewedExpiresAt: number | null;
}

export async function validateSessionToken(db: D1Database, token: string): Promise<ValidatedSession | null> {
	const sessionId = await sha256Hex(token);
	const found = await getSessionWithUser(db, sessionId);
	if (!found)
		return null;
	const now = Date.now();
	if (found.session.expires_at <= now) {
		await deleteSession(db, sessionId);
		return null;
	}
	let renewedExpiresAt: number | null = null;
	if (found.session.expires_at - now < SESSION_TTL_MS / 2) {
		renewedExpiresAt = now + SESSION_TTL_MS;
		await touchSession(db, sessionId, renewedExpiresAt);
	}
	return { sessionId, user: found.user, renewedExpiresAt };
}

export async function invalidateSession(db: D1Database, sessionId: string): Promise<void> {
	await deleteSession(db, sessionId);
}

/**
 * Host-only cookie on the dashboard host (never Domain=.announcing.app —
 * public channel hosts must stay cookie-free). `secure` is relaxed in `vite
 * dev` only; Chromium treats *.localhost as trustworthy either way.
 */
export function setSessionCookie(cookies: Cookies, token: string, expiresAt: number): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: new Date(expiresAt),
	});
}

export function deleteSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/', secure: !dev });
}
