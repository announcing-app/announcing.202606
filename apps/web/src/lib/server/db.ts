import type { Continent, Role } from '@announcing/core';
import type { ChannelRow, MembershipRow, SessionRow, UserRow } from '@announcing/db';

/**
 * Queries against the global control layer (D1). Thin and explicit — every
 * function takes the D1Database so loads/actions stay testable.
 *
 * Personal data guard: users hold only google_sub + display_name (plan §2).
 */

// -- users --------------------------------------------------------------------

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
	return await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function getUserByGoogleSub(db: D1Database, googleSub: string): Promise<UserRow | null> {
	return await db.prepare('SELECT * FROM users WHERE google_sub = ?').bind(googleSub).first<UserRow>();
}

export async function createUser(db: D1Database, user: UserRow): Promise<void> {
	await db
		.prepare('INSERT INTO users (id, google_sub, display_name, created_at) VALUES (?, ?, ?, ?)')
		.bind(user.id, user.google_sub, user.display_name, user.created_at)
		.run();
}

export async function updateDisplayName(db: D1Database, userId: string, displayName: string): Promise<void> {
	await db.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(displayName, userId).run();
}

/** Display names for a member list; returns a userId → name map. */
export async function getDisplayNames(db: D1Database, userIds: string[]): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	if (userIds.length === 0)
		return map;
	const placeholders = userIds.map(() => '?').join(', ');
	const { results } = await db
		.prepare(`SELECT id, display_name FROM users WHERE id IN (${placeholders})`)
		.bind(...userIds)
		.all<Pick<UserRow, 'id' | 'display_name'>>();
	for (const row of results)
		map.set(row.id, row.display_name);
	return map;
}

// -- sessions -------------------------------------------------------------------

export async function insertSession(db: D1Database, session: SessionRow): Promise<void> {
	await db
		.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
		.bind(session.id, session.user_id, session.expires_at, session.created_at)
		.run();
}

export async function getSessionWithUser(
	db: D1Database,
	sessionId: string,
): Promise<{ session: SessionRow; user: UserRow } | null> {
	const row = await db
		.prepare(`
			SELECT s.id, s.user_id, s.expires_at, s.created_at,
			       u.id AS u_id, u.google_sub, u.display_name, u.created_at AS u_created_at
			FROM sessions s JOIN users u ON u.id = s.user_id
			WHERE s.id = ?
		`)
		.bind(sessionId)
		.first<SessionRow & { u_id: string; google_sub: string; display_name: string; u_created_at: number }>();
	if (!row)
		return null;
	return {
		session: { id: row.id, user_id: row.user_id, expires_at: row.expires_at, created_at: row.created_at },
		user: { id: row.u_id, google_sub: row.google_sub, display_name: row.display_name, created_at: row.u_created_at },
	};
}

export async function touchSession(db: D1Database, sessionId: string, expiresAt: number): Promise<void> {
	await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(expiresAt, sessionId).run();
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
	await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

/** Opportunistic cleanup, called on login (cheap: indexed on expires_at). */
export async function deleteExpiredSessions(db: D1Database, now: number): Promise<void> {
	await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
}

// -- channels registry -------------------------------------------------------------

/** True if the INSERT hit a UNIQUE constraint (subdomain already taken). */
export async function insertChannel(db: D1Database, row: ChannelRow): Promise<'ok' | 'taken'> {
	try {
		await db
			.prepare('INSERT INTO channels (subdomain, channel_id, region, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)')
			.bind(row.subdomain, row.channel_id, row.region, row.owner_user_id, row.created_at)
			.run();
		return 'ok';
	}
	catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE'))
			return 'taken';
		throw err;
	}
}

export async function getChannelBySubdomain(db: D1Database, subdomain: string): Promise<ChannelRow | null> {
	return await db.prepare('SELECT * FROM channels WHERE subdomain = ?').bind(subdomain).first<ChannelRow>();
}

export async function getChannelById(db: D1Database, channelId: string): Promise<ChannelRow | null> {
	return await db.prepare('SELECT * FROM channels WHERE channel_id = ?').bind(channelId).first<ChannelRow>();
}

/** Compensation for a failed ChannelDO init right after insertChannel. */
export async function deleteChannel(db: D1Database, channelId: string): Promise<void> {
	await db.prepare('DELETE FROM channels WHERE channel_id = ?').bind(channelId).run();
}

// -- memberships index ---------------------------------------------------------------
// The ChannelDO is the source of truth; these rows only power "my channels".

export async function upsertMembership(db: D1Database, row: MembershipRow): Promise<void> {
	await db
		.prepare(`
			INSERT INTO memberships (user_id, channel_id, role, created_at) VALUES (?, ?, ?, ?)
			ON CONFLICT (user_id, channel_id) DO UPDATE SET role = excluded.role
		`)
		.bind(row.user_id, row.channel_id, row.role, row.created_at)
		.run();
}

export async function deleteMembership(db: D1Database, userId: string, channelId: string): Promise<void> {
	await db.prepare('DELETE FROM memberships WHERE user_id = ? AND channel_id = ?').bind(userId, channelId).run();
}

export interface UserChannelRow {
	channel_id: string;
	subdomain: string;
	region: Continent;
	role: Role;
}

export async function listUserChannels(db: D1Database, userId: string): Promise<UserChannelRow[]> {
	const { results } = await db
		.prepare(`
			SELECT c.channel_id, c.subdomain, c.region, m.role
			FROM memberships m JOIN channels c ON c.channel_id = m.channel_id
			WHERE m.user_id = ?
			ORDER BY m.created_at DESC
		`)
		.bind(userId)
		.all<UserChannelRow>();
	return results;
}
