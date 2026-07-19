import type { ChannelRpc } from '@announcing/core';
import type { ChannelRow } from '@announcing/db';
import { error } from '@sveltejs/kit';
import { channelStub } from './channel';
import { getChannelById } from './db';

/** Resolve a dashboard `[channelId]` param to its registry row + DO stub. */
export async function loadChannelContext(
	env: Env,
	channelId: string,
): Promise<{ row: ChannelRow; stub: ChannelRpc }> {
	const row = await getChannelById(env.DB, channelId);
	if (!row)
		error(404);
	return { row, stub: channelStub(env, row.channel_id, row.region) };
}
