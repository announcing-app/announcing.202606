import type {
	ChannelApi,
	ChannelInit,
	ChannelMeta,
	ChannelResult,
	ChannelSettingsPatch,
	DashboardView,
	InvitePreview,
	InviteView,
	MemberView,
	PostInput,
	PostView,
	PublicChannelView,
	PublicPostView,
	Role,
	SettingsView,
} from '@announcing/core';
import {
	AppError,
	appErrorCode,
	IMAGE_ID_RE,
	INVITE_TTL_MS,
	isChannelLocale,
	isContinent,
	LIMITS,
} from '@announcing/core';
import { DurableObject } from 'cloudflare:workers';

/** How many posts the public top page / dashboard list at most (Phase 1). */
const PUBLIC_POSTS_LIMIT = 50;
const DASHBOARD_POSTS_LIMIT = 100;

interface SettingsRow {
	channel_id: string;
	subdomain: string;
	region: string;
	name: string;
	description: string;
	locale: string;
	created_at: number;
	[key: string]: unknown;
}

interface MemberRow {
	user_id: string;
	role: Role;
	joined_at: number;
	[key: string]: unknown;
}

interface PostRow {
	id: string;
	body: string;
	image_ids: string;
	created_by: string;
	created_at: number;
	updated_at: number | null;
	[key: string]: unknown;
}

interface InviteRow {
	invite_id: string;
	token_hash: string;
	role: Role;
	created_by: string;
	created_at: number;
	expires_at: number;
	used_by: string | null;
	[key: string]: unknown;
}

/**
 * ChannelDO — one Durable Object per channel, location-hinted / EU-jurisdiction
 * pinned to the channel's continent (see `placementFor` in @announcing/core).
 * It is the strongly-consistent source of truth for a channel's posts, members,
 * settings and invites.
 *
 * Authorization happens HERE: every method that reads private state or mutates
 * takes the caller's userId and checks the members table. The web worker never
 * decides roles on its own; the D1 `memberships` table is only a dashboard
 * index.
 *
 * Expected failures leave the DO as `ChannelResult` values (`guard()` turns
 * internal AppError throws into `{ ok: false, code }`): thrown errors do not
 * survive miniflare's dev-registry RPC proxy, and values beat message-string
 * tunneling in production too. Anything non-AppError still throws — those are
 * bugs, not outcomes.
 */
export class ChannelDO extends DurableObject<Env> implements ChannelApi {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS settings (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					channel_id TEXT NOT NULL,
					subdomain TEXT NOT NULL,
					region TEXT NOT NULL,
					name TEXT NOT NULL,
					description TEXT NOT NULL,
					locale TEXT NOT NULL,
					created_at INTEGER NOT NULL
				) STRICT;
				CREATE TABLE IF NOT EXISTS members (
					user_id TEXT PRIMARY KEY,
					role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
					joined_at INTEGER NOT NULL
				) STRICT;
				CREATE TABLE IF NOT EXISTS posts (
					id TEXT PRIMARY KEY,
					body TEXT NOT NULL,
					image_ids TEXT NOT NULL,
					created_by TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					updated_at INTEGER
				) STRICT;
				CREATE TABLE IF NOT EXISTS invites (
					invite_id TEXT PRIMARY KEY,
					token_hash TEXT NOT NULL UNIQUE,
					role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
					created_by TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					expires_at INTEGER NOT NULL,
					used_by TEXT,
					used_at INTEGER
				) STRICT;
			`);
		});
	}

	/** Health check kept from Phase 0 (cheap RPC liveness probe). */
	ping(): string {
		return 'pong';
	}

	// -- private helpers ------------------------------------------------------

	private guard<T>(fn: () => T): ChannelResult<T> {
		try {
			return { ok: true, value: fn() };
		}
		catch (err) {
			const code = appErrorCode(err);
			if (code)
				return { ok: false, code };
			throw err;
		}
	}

	private get sql(): SqlStorage {
		return this.ctx.storage.sql;
	}

	private settingsOrNull(): SettingsRow | null {
		const rows = this.sql.exec('SELECT * FROM settings WHERE id = 1').toArray();
		return (rows[0] as unknown as SettingsRow) ?? null;
	}

	private requireSettings(): SettingsRow {
		const row = this.settingsOrNull();
		if (!row)
			throw new AppError('uninitialized');
		return row;
	}

	private toMeta(row: SettingsRow): ChannelMeta {
		if (!isContinent(row.region) || !isChannelLocale(row.locale))
			throw new AppError('invalid', 'stored settings');
		return {
			channelId: row.channel_id,
			subdomain: row.subdomain,
			region: row.region,
			name: row.name,
			description: row.description,
			locale: row.locale,
			createdAt: row.created_at,
		};
	}

	private roleRowOf(userId: string): Role | null {
		const rows = this.sql.exec('SELECT role FROM members WHERE user_id = ?', userId).toArray();
		return (rows[0]?.role as Role) ?? null;
	}

	private requireRole(userId: string, roles: readonly Role[]): Role {
		this.requireSettings();
		const role = this.roleRowOf(userId);
		if (!role || !roles.includes(role))
			throw new AppError('forbidden');
		return role;
	}

	private toPostView(row: PostRow): PostView {
		return {
			id: row.id,
			body: row.body,
			imageIds: JSON.parse(row.image_ids) as string[],
			createdBy: row.created_by,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	private toPublicPost(row: PostRow): PublicPostView {
		const { createdBy: _, ...rest } = this.toPostView(row);
		return rest;
	}

	private listPostRows(limit: number): PostRow[] {
		return this.sql
			.exec('SELECT * FROM posts ORDER BY id DESC LIMIT ?', limit)
			.toArray() as unknown as PostRow[];
	}

	private postRowOrNull(postId: string): PostRow | null {
		const rows = this.sql.exec('SELECT * FROM posts WHERE id = ?', postId).toArray();
		return (rows[0] as unknown as PostRow) ?? null;
	}

	private ownerCount(): number {
		return Number(this.sql.exec('SELECT COUNT(*) AS n FROM members WHERE role = \'owner\'').one().n);
	}

	private static validatePostInput(input: PostInput): void {
		const body = input.body;
		if (typeof body !== 'string' || body.trim().length === 0 || body.length > LIMITS.postBody)
			throw new AppError('invalid', 'body');
		if (!Array.isArray(input.imageIds) || input.imageIds.length > LIMITS.postImages)
			throw new AppError('invalid', 'images');
		for (const id of input.imageIds) {
			if (!IMAGE_ID_RE.test(id))
				throw new AppError('invalid', 'image id');
		}
		if (new Set(input.imageIds).size !== input.imageIds.length)
			throw new AppError('invalid', 'duplicate image');
	}

	private static validateSettingsPatch(patch: ChannelSettingsPatch): void {
		if (typeof patch.name !== 'string' || patch.name.trim().length === 0 || patch.name.length > LIMITS.channelName)
			throw new AppError('invalid', 'name');
		if (typeof patch.description !== 'string' || patch.description.length > LIMITS.channelDescription)
			throw new AppError('invalid', 'description');
		if (!isChannelLocale(patch.locale))
			throw new AppError('invalid', 'locale');
	}

	// -- lifecycle ------------------------------------------------------------

	async init(init: ChannelInit): Promise<ChannelResult<void>> {
		return this.guard(() => {
			if (this.settingsOrNull())
				throw new AppError('conflict', 'already initialized');
			ChannelDO.validateSettingsPatch(init);
			if (!isContinent(init.region))
				throw new AppError('invalid', 'region');
			const now = Date.now();
			this.sql.exec(
				'INSERT INTO settings (id, channel_id, subdomain, region, name, description, locale, created_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?)',
				init.channelId,
				init.subdomain,
				init.region,
				init.name.trim(),
				init.description,
				init.locale,
				now,
			);
			this.sql.exec(
				'INSERT INTO members (user_id, role, joined_at) VALUES (?, \'owner\', ?)',
				init.ownerUserId,
				now,
			);
		});
	}

	// -- public (anonymous) reads ----------------------------------------------

	async getPublicView(): Promise<ChannelResult<PublicChannelView | null>> {
		return this.guard(() => {
			const settings = this.settingsOrNull();
			if (!settings)
				return null;
			return {
				meta: this.toMeta(settings),
				posts: this.listPostRows(PUBLIC_POSTS_LIMIT).map(row => this.toPublicPost(row)),
			};
		});
	}

	async getPublicPost(postId: string): Promise<ChannelResult<{ meta: ChannelMeta; post: PublicPostView } | null>> {
		return this.guard(() => {
			const settings = this.settingsOrNull();
			if (!settings)
				return null;
			const row = this.postRowOrNull(postId);
			if (!row)
				return null;
			return { meta: this.toMeta(settings), post: this.toPublicPost(row) };
		});
	}

	// -- dashboard --------------------------------------------------------------

	async getRole(userId: string): Promise<ChannelResult<Role | null>> {
		return this.guard(() => {
			if (!this.settingsOrNull())
				return null;
			return this.roleRowOf(userId);
		});
	}

	async getDashboard(caller: string): Promise<ChannelResult<DashboardView>> {
		return this.guard(() => {
			const role = this.requireRole(caller, ['owner', 'editor']);
			return {
				meta: this.toMeta(this.requireSettings()),
				role,
				posts: this.listPostRows(DASHBOARD_POSTS_LIMIT).map(row => this.toPostView(row)),
			};
		});
	}

	async getSettingsView(caller: string): Promise<ChannelResult<SettingsView>> {
		return this.guard(() => {
			const role = this.requireRole(caller, ['owner', 'editor']);
			const members = this.sql
				.exec('SELECT * FROM members ORDER BY joined_at')
				.toArray() as unknown as MemberRow[];
			const invites = this.sql
				.exec('SELECT * FROM invites WHERE used_by IS NULL AND expires_at > ? ORDER BY created_at DESC', Date.now())
				.toArray() as unknown as InviteRow[];
			return {
				meta: this.toMeta(this.requireSettings()),
				role,
				members: members.map((m): MemberView => ({ userId: m.user_id, role: m.role, joinedAt: m.joined_at })),
				invites: invites.map((i): InviteView => ({
					inviteId: i.invite_id,
					role: i.role,
					createdBy: i.created_by,
					createdAt: i.created_at,
					expiresAt: i.expires_at,
				})),
			};
		});
	}

	async updateSettings(caller: string, patch: ChannelSettingsPatch): Promise<ChannelResult<ChannelMeta>> {
		return this.guard(() => {
			this.requireRole(caller, ['owner']);
			ChannelDO.validateSettingsPatch(patch);
			this.sql.exec(
				'UPDATE settings SET name = ?, description = ?, locale = ? WHERE id = 1',
				patch.name.trim(),
				patch.description,
				patch.locale,
			);
			return this.toMeta(this.requireSettings());
		});
	}

	// -- posts --------------------------------------------------------------------

	async createPost(caller: string, input: PostInput & { id: string }): Promise<ChannelResult<PostView>> {
		return this.guard(() => {
			this.requireRole(caller, ['owner', 'editor']);
			ChannelDO.validatePostInput(input);
			if (!/^[0-9a-hjkmnp-tv-z]{26}$/.test(input.id))
				throw new AppError('invalid', 'post id');
			if (this.postRowOrNull(input.id))
				throw new AppError('conflict', 'post id');
			this.sql.exec(
				'INSERT INTO posts (id, body, image_ids, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL)',
				input.id,
				input.body,
				JSON.stringify(input.imageIds),
				caller,
				Date.now(),
			);
			return this.toPostView(this.postRowOrNull(input.id)!);
		});
	}

	async getPostForEdit(caller: string, postId: string): Promise<ChannelResult<PostView | null>> {
		return this.guard(() => {
			this.requireRole(caller, ['owner', 'editor']);
			const row = this.postRowOrNull(postId);
			return row ? this.toPostView(row) : null;
		});
	}

	async updatePost(caller: string, postId: string, input: PostInput): Promise<ChannelResult<PostView>> {
		return this.guard(() => {
			this.requireRole(caller, ['owner', 'editor']);
			ChannelDO.validatePostInput(input);
			if (!this.postRowOrNull(postId))
				throw new AppError('not_found');
			this.sql.exec(
				'UPDATE posts SET body = ?, image_ids = ?, updated_at = ? WHERE id = ?',
				input.body,
				JSON.stringify(input.imageIds),
				Date.now(),
				postId,
			);
			return this.toPostView(this.postRowOrNull(postId)!);
		});
	}

	async deletePost(caller: string, postId: string): Promise<ChannelResult<PostView>> {
		return this.guard(() => {
			this.requireRole(caller, ['owner', 'editor']);
			const row = this.postRowOrNull(postId);
			if (!row)
				throw new AppError('not_found');
			this.sql.exec('DELETE FROM posts WHERE id = ?', postId);
			return this.toPostView(row);
		});
	}

	// -- members / invites -----------------------------------------------------------

	async createInvite(caller: string, input: { inviteId: string; tokenHash: string; role: Role }): Promise<ChannelResult<InviteView>> {
		return this.guard(() => {
			this.requireRole(caller, ['owner']);
			if (input.role !== 'owner' && input.role !== 'editor')
				throw new AppError('invalid', 'role');
			const now = Date.now();
			this.sql.exec(
				'INSERT INTO invites (invite_id, token_hash, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
				input.inviteId,
				input.tokenHash,
				input.role,
				caller,
				now,
				now + INVITE_TTL_MS,
			);
			return {
				inviteId: input.inviteId,
				role: input.role,
				createdBy: caller,
				createdAt: now,
				expiresAt: now + INVITE_TTL_MS,
			};
		});
	}

	async revokeInvite(caller: string, inviteId: string): Promise<ChannelResult<void>> {
		return this.guard(() => {
			this.requireRole(caller, ['owner']);
			this.sql.exec('DELETE FROM invites WHERE invite_id = ?', inviteId);
		});
	}

	private inviteByTokenHash(tokenHash: string): InviteRow {
		const rows = this.sql.exec('SELECT * FROM invites WHERE token_hash = ?', tokenHash).toArray();
		const invite = rows[0] as unknown as InviteRow | undefined;
		// A used invite is indistinguishable from a nonexistent one on purpose.
		if (!invite || invite.used_by !== null)
			throw new AppError('not_found');
		if (invite.expires_at <= Date.now())
			throw new AppError('expired');
		return invite;
	}

	async previewInvite(tokenHash: string): Promise<ChannelResult<InvitePreview>> {
		return this.guard(() => {
			const settings = this.requireSettings();
			const invite = this.inviteByTokenHash(tokenHash);
			return { channelName: settings.name, role: invite.role };
		});
	}

	async acceptInvite(tokenHash: string, userId: string): Promise<ChannelResult<{ role: Role }>> {
		return this.guard(() => {
			this.requireSettings();
			const invite = this.inviteByTokenHash(tokenHash);
			if (this.roleRowOf(userId))
				throw new AppError('already_member');
			const now = Date.now();
			this.sql.exec(
				'INSERT INTO members (user_id, role, joined_at) VALUES (?, ?, ?)',
				userId,
				invite.role,
				now,
			);
			this.sql.exec(
				'UPDATE invites SET used_by = ?, used_at = ? WHERE invite_id = ?',
				userId,
				now,
				invite.invite_id,
			);
			return { role: invite.role };
		});
	}

	async removeMember(caller: string, target: string): Promise<ChannelResult<void>> {
		return this.guard(() => {
			this.requireSettings();
			const callerRole = this.roleRowOf(caller);
			if (!callerRole)
				throw new AppError('forbidden');
			// Owners can remove anyone; any member can remove themselves (leave).
			if (callerRole !== 'owner' && caller !== target)
				throw new AppError('forbidden');
			const targetRole = this.roleRowOf(target);
			if (!targetRole)
				throw new AppError('not_found');
			if (targetRole === 'owner' && this.ownerCount() <= 1)
				throw new AppError('last_owner');
			this.sql.exec('DELETE FROM members WHERE user_id = ?', target);
		});
	}

	async setMemberRole(caller: string, target: string, role: Role): Promise<ChannelResult<void>> {
		return this.guard(() => {
			this.requireRole(caller, ['owner']);
			if (role !== 'owner' && role !== 'editor')
				throw new AppError('invalid', 'role');
			const targetRole = this.roleRowOf(target);
			if (!targetRole)
				throw new AppError('not_found');
			if (targetRole === 'owner' && role !== 'owner' && this.ownerCount() <= 1)
				throw new AppError('last_owner');
			this.sql.exec('UPDATE members SET role = ? WHERE user_id = ?', role, target);
		});
	}
}
