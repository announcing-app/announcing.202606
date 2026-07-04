import type { AppErrorCode, InvitePreview } from '@announcing/core';
import type { Actions, PageServerLoad } from './$types';
import { rpc } from '$lib/server/channel';
import { loadChannelContext } from '$lib/server/dashboard';
import { upsertMembership } from '$lib/server/db';
import { requireUser } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';
import { appErrorCode, sha256Hex } from '@announcing/core';
import { error, redirect } from '@sveltejs/kit';

/** Invite links look like /invites/{channelId}.{secret}. */
function parseToken(param: string): { channelId: string; secret: string } {
	const dot = param.indexOf('.');
	if (dot <= 0 || dot === param.length - 1)
		error(404);
	return { channelId: param.slice(0, dot), secret: param.slice(dot + 1) };
}

export const load: PageServerLoad = async ({ params, platform, locals, url }) => {
	const env = requireEnv(platform);
	const { channelId, secret } = parseToken(params.token);
	const { stub } = await loadChannelContext(env, channelId);

	let preview: InvitePreview | null = null;
	let inviteError: AppErrorCode | null = null;
	const result = await stub.previewInvite(await sha256Hex(secret));
	if (result.ok)
		preview = result.value;
	else inviteError = result.code;

	return {
		preview,
		inviteError,
		loggedIn: locals.user !== null,
		loginUrl: `/login?next=${encodeURIComponent(url.pathname)}`,
	};
};

export const actions: Actions = {
	default: async ({ params, platform, locals }) => {
		const user = requireUser(locals);
		const env = requireEnv(platform);
		const { channelId, secret } = parseToken(params.token);
		const { row, stub } = await loadChannelContext(env, channelId);

		try {
			const { role } = await rpc(stub.acceptInvite(await sha256Hex(secret), user.id), ['already_member']);
			await upsertMembership(env.DB, { user_id: user.id, channel_id: row.channel_id, role, created_at: Date.now() });
		}
		catch (err) {
			// Already a member — just go to the channel.
			if (appErrorCode(err) !== 'already_member')
				throw err;
		}
		redirect(303, `/channels/${row.channel_id}`);
	},
};
