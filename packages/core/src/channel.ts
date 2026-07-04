import type { AppErrorCode } from './errors';

/**
 * Channel domain: regions, roles, validation limits and the RPC contract
 * between the web worker and the ChannelDO (apps/backend).
 */

/**
 * Continents we place channel data in — exactly Cloudflare's Durable Object
 * location hints (afr / wnam etc., not ISO codes). A channel's region is
 * chosen at creation and is immutable thereafter.
 */
export const CONTINENTS = ['afr', 'apac', 'eeur', 'enam', 'me', 'oc', 'sam', 'weur', 'wnam'] as const;
export type Continent = (typeof CONTINENTS)[number];

export function isContinent(value: string): value is Continent {
	return (CONTINENTS as readonly string[]).includes(value);
}

/**
 * Where to create a channel's Durable Object. European channels are pinned
 * with `jurisdiction: 'eu'` (guaranteed EU residency); other continents use a
 * best-effort location hint. The jurisdiction is part of the DO id, so stub
 * resolution must apply the same mapping every time (see placementFor callers).
 */
export interface ChannelPlacement {
	jurisdiction?: 'eu';
	locationHint?: Continent;
}

export function placementFor(region: Continent): ChannelPlacement {
	return region === 'weur' || region === 'eeur' ? { jurisdiction: 'eu' } : { locationHint: region };
}

/** Locales a channel can render its public pages in (also the UI locales). */
export const CHANNEL_LOCALES = ['en', 'ja'] as const;
export type ChannelLocale = (typeof CHANNEL_LOCALES)[number];

export function isChannelLocale(value: string): value is ChannelLocale {
	return (CHANNEL_LOCALES as readonly string[]).includes(value);
}

/** Channel member roles. Source of truth is the ChannelDO; D1 keeps an index. */
export const ROLES = ['owner', 'editor'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
	return (ROLES as readonly string[]).includes(value);
}

/**
 * Post lifecycle. `draft` and `scheduled` are dashboard-only; the public
 * surface (pages and feeds) shows `published` posts exclusively. `published`
 * is terminal — posts can still be edited or deleted, but never unpublished
 * (public URLs stay meaningful).
 */
export const POST_STATUSES = ['draft', 'scheduled', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/**
 * What should happen to a post's visibility when it is saved.
 * - `draft`    keep/park it as a draft
 * - `now`      publish immediately (no-op if already published)
 * - `schedule` publish automatically at `at` (epoch ms, must be in the future)
 */
export type PublishAction
	= | { mode: 'draft' }
		| { mode: 'now' }
		| { mode: 'schedule'; at: number };

/** Subdomains that may never be claimed as a channel name. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
	'www',
	'app',
	'api',
	'static',
	'assets',
	'admin',
	'mail',
	'cdn',
	'status',
	'help',
	'docs',
	'blog',
]);

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * A channel subdomain must be 3–63 chars, lowercase alphanumerics and hyphens,
 * no leading/trailing or doubled hyphens, and not a reserved word.
 */
export function isValidSubdomain(value: string): boolean {
	if (value.length < 3 || value.length > 63)
		return false;
	if (!SUBDOMAIN_RE.test(value))
		return false;
	if (value.includes('--'))
		return false;
	return !RESERVED_SUBDOMAINS.has(value);
}

/** Input size limits, enforced in the web actions and re-checked in the DO. */
export const LIMITS = {
	channelName: 100,
	channelDescription: 500,
	displayName: 50,
	postBody: 10_000,
	postImages: 8,
	imageBytes: 5 * 1024 * 1024,
	/** How far ahead a post may be scheduled (Workflows sleep caps at 365 days). */
	scheduleMaxAheadMs: 364 * 24 * 60 * 60 * 1000,
} as const;

/** How long an invite link stays usable. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Views exchanged over the ChannelDO RPC boundary (structured-cloneable).
// ---------------------------------------------------------------------------

export interface ChannelMeta {
	channelId: string;
	subdomain: string;
	region: Continent;
	name: string;
	description: string;
	/** Locale public pages are rendered in (cache-stable, no Accept-Language). */
	locale: ChannelLocale;
	createdAt: number;
}

export interface PostView {
	id: string;
	body: string;
	imageIds: string[];
	status: PostStatus;
	/** Set while status is `scheduled`: when the post will go public (epoch ms). */
	scheduledAt: number | null;
	/** Set once status is `published`; scheduled posts get their intended time. */
	publishedAt: number | null;
	createdBy: string;
	createdAt: number;
	/** Only bumped by edits made *after* publication (drives the “edited” marker). */
	updatedAt: number | null;
}

/**
 * Public pages and feeds only ever see published posts, dated by publication —
 * never authors, drafts or schedule internals.
 */
export interface PublicPostView {
	id: string;
	body: string;
	imageIds: string[];
	publishedAt: number;
	updatedAt: number | null;
}

export interface MemberView {
	userId: string;
	role: Role;
	joinedAt: number;
}

export interface InviteView {
	inviteId: string;
	role: Role;
	createdBy: string;
	createdAt: number;
	expiresAt: number;
}

export interface InvitePreview {
	channelName: string;
	role: Role;
}

export interface PublicChannelView {
	meta: ChannelMeta;
	posts: PublicPostView[];
}

export interface DashboardView {
	meta: ChannelMeta;
	role: Role;
	posts: PostView[];
}

export interface SettingsView {
	meta: ChannelMeta;
	role: Role;
	members: MemberView[];
	invites: InviteView[];
}

export interface ChannelInit {
	channelId: string;
	subdomain: string;
	region: Continent;
	name: string;
	description: string;
	locale: string;
	ownerUserId: string;
}

export interface ChannelSettingsPatch {
	name: string;
	description: string;
	locale: string;
}

export interface PostInput {
	body: string;
	imageIds: string[];
	publish: PublishAction;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * Expected failures cross the RPC boundary as values, not exceptions: thrown
 * errors don't survive miniflare's dev-registry proxy, and errors-as-values
 * also avoids depending on message-string tunneling in production. Only bugs
 * throw.
 */
export type ChannelResult<T>
	= | { ok: true; value: T }
		| { ok: false; code: AppErrorCode };

/**
 * RPC surface of the ChannelDO. The DO is the source of truth for membership,
 * so every method that reads private state or mutates takes the caller's
 * userId and re-validates the role inside the DO — never trust the web layer.
 */
export interface ChannelApi {
	/** Create the channel. Fails with `conflict` if already initialized. */
	init: (init: ChannelInit) => MaybePromise<ChannelResult<void>>;

	// -- public (anonymous) reads ------------------------------------------
	getPublicView: () => MaybePromise<ChannelResult<PublicChannelView | null>>;
	getPublicPost: (postId: string) => MaybePromise<ChannelResult<{ meta: ChannelMeta; post: PublicPostView } | null>>;

	// -- dashboard ----------------------------------------------------------
	getRole: (userId: string) => MaybePromise<ChannelResult<Role | null>>;
	getDashboard: (caller: string) => MaybePromise<ChannelResult<DashboardView>>;
	getSettingsView: (caller: string) => MaybePromise<ChannelResult<SettingsView>>;
	updateSettings: (caller: string, patch: ChannelSettingsPatch) => MaybePromise<ChannelResult<ChannelMeta>>;

	// -- posts ---------------------------------------------------------------
	createPost: (caller: string, input: PostInput & { id: string }) => MaybePromise<ChannelResult<PostView>>;
	getPostForEdit: (caller: string, postId: string) => MaybePromise<ChannelResult<PostView | null>>;
	updatePost: (caller: string, postId: string, input: PostInput) => MaybePromise<ChannelResult<PostView>>;
	/** Returns the deleted post so the caller can clean up R2 images. */
	deletePost: (caller: string, postId: string) => MaybePromise<ChannelResult<PostView>>;
	/**
	 * Called by the PublishWorkflow when a schedule fires. Publishes the post
	 * only if it is still scheduled under the same token — a reschedule or
	 * delete makes the stale workflow resolve to `skipped` instead of erroring.
	 */
	publishScheduled: (postId: string, scheduleToken: string) => MaybePromise<ChannelResult<'published' | 'skipped'>>;

	// -- members / invites ----------------------------------------------------
	createInvite: (caller: string, input: { inviteId: string; tokenHash: string; role: Role }) => MaybePromise<ChannelResult<InviteView>>;
	revokeInvite: (caller: string, inviteId: string) => MaybePromise<ChannelResult<void>>;
	previewInvite: (tokenHash: string) => MaybePromise<ChannelResult<InvitePreview>>;
	acceptInvite: (tokenHash: string, userId: string) => MaybePromise<ChannelResult<{ role: Role }>>;
	removeMember: (caller: string, target: string) => MaybePromise<ChannelResult<void>>;
	setMemberRole: (caller: string, target: string, role: Role) => MaybePromise<ChannelResult<void>>;
}

/** What a ChannelDO stub looks like from the web worker (RPC wraps returns). */
export type ChannelRpc = {
	[K in keyof ChannelApi]: ChannelApi[K] extends (...args: infer A) => infer R
		? (...args: A) => Promise<Awaited<R>>
		: never;
};
