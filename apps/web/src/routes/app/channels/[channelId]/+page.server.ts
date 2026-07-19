import type { PageServerLoad } from './$types';
import { rpc } from '$lib/server/channel';
import { loadChannelContext } from '$lib/server/dashboard';
import { requireUser } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';
import { publicChannelOrigin } from '$lib/urls';

export const load: PageServerLoad = async ({ locals, params, platform, url }) => {
	const user = requireUser(locals);
	const { row, stub } = await loadChannelContext(requireEnv(platform), params.channelId);
	const dashboard = await rpc(stub.getDashboard(user.id));
	return {
		dashboard,
		publicOrigin: publicChannelOrigin(url, row.subdomain),
	};
};
