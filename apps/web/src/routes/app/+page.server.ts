import type { PageServerLoad } from './$types';
import { listUserChannels } from '$lib/server/db';
import { requireUser } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const user = requireUser(locals);
	const channels = await listUserChannels(requireEnv(platform).DB, user.id);
	return { channels };
};
