import type { Actions, PageServerLoad } from './$types';
import { rpc } from '$lib/server/channel';
import { loadChannelContext } from '$lib/server/dashboard';
import { deleteMembership, getDisplayNames, upsertMembership } from '$lib/server/db';
import { requireUser } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';
import {
	isChannelLocale,
	isRole,
	LIMITS,
	randomId,
	randomToken,
	sha256Hex,
} from '@announcing/core';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params, platform }) => {
	const user = requireUser(locals);
	const { stub } = await loadChannelContext(requireEnv(platform), params.channelId);
	const view = await rpc(stub.getSettingsView(user.id));
	const names = await getDisplayNames(requireEnv(platform).DB, view.members.map(m => m.userId));
	return {
		view,
		userId: user.id,
		members: view.members.map(m => ({ ...m, displayName: names.get(m.userId) ?? m.userId })),
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params, platform }) => {
		const user = requireUser(locals);
		const { stub } = await loadChannelContext(requireEnv(platform), params.channelId);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const locale = String(form.get('locale') ?? '');
		if (name.length === 0 || name.length > LIMITS.channelName
			|| description.length > LIMITS.channelDescription || !isChannelLocale(locale)) {
			return fail(400, { error: 'invalid' as const });
		}
		await rpc(stub.updateSettings(user.id, { name, description, locale }));
		return { updated: true };
	},

	invite: async ({ request, locals, params, platform, url }) => {
		const user = requireUser(locals);
		const env = requireEnv(platform);
		const { row, stub } = await loadChannelContext(env, params.channelId);
		const form = await request.formData();
		const role = String(form.get('role') ?? '');
		if (!isRole(role))
			return fail(400, { error: 'invalid' as const });

		// The raw token lives only in this URL (the DO stores its hash); it is
		// shown exactly once, right after creation.
		const token = randomToken();
		await rpc(stub.createInvite(user.id, {
			inviteId: randomId('inv'),
			tokenHash: await sha256Hex(token),
			role,
		}));
		return { inviteUrl: `${url.origin}/invites/${row.channel_id}.${token}` };
	},

	revoke: async ({ request, locals, params, platform }) => {
		const user = requireUser(locals);
		const { stub } = await loadChannelContext(requireEnv(platform), params.channelId);
		const form = await request.formData();
		await rpc(stub.revokeInvite(user.id, String(form.get('invite_id') ?? '')));
		return { revoked: true };
	},

	remove: async ({ request, locals, params, platform }) => {
		const user = requireUser(locals);
		const env = requireEnv(platform);
		const { row, stub } = await loadChannelContext(env, params.channelId);
		const form = await request.formData();
		const target = String(form.get('user_id') ?? '');
		await rpc(stub.removeMember(user.id, target));
		// Sync the dashboard index (DO already holds the truth).
		await deleteMembership(env.DB, target, row.channel_id);
		if (target === user.id)
			redirect(303, '/');
		return { removed: true };
	},

	role: async ({ request, locals, params, platform }) => {
		const user = requireUser(locals);
		const env = requireEnv(platform);
		const { row, stub } = await loadChannelContext(env, params.channelId);
		const form = await request.formData();
		const target = String(form.get('user_id') ?? '');
		const role = String(form.get('role') ?? '');
		if (!isRole(role))
			return fail(400, { error: 'invalid' as const });
		await rpc(stub.setMemberRole(user.id, target, role));
		await upsertMembership(env.DB, { user_id: target, channel_id: row.channel_id, role, created_at: Date.now() });
		return { roleChanged: true };
	},
};
