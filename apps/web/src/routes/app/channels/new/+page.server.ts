import type { Actions, PageServerLoad } from './$types';
import { getLocale } from '$lib/paraglide/runtime';
import { channelStub, rpc } from '$lib/server/channel';
import { deleteChannel, insertChannel, upsertMembership } from '$lib/server/db';
import { requireUser } from '$lib/server/guard';
import { requireEnv } from '$lib/server/platform';
import {
	isChannelLocale,
	isContinent,
	isValidSubdomain,
	LIMITS,
	randomId,
} from '@announcing/core';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	return { defaultLocale: getLocale() };
};

export const actions: Actions = {
	default: async ({ request, locals, platform }) => {
		const user = requireUser(locals);
		const env = requireEnv(platform);

		const form = await request.formData();
		const subdomain = String(form.get('subdomain') ?? '').trim().toLowerCase();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const region = String(form.get('region') ?? '');
		const locale = String(form.get('locale') ?? '');
		const values = { subdomain, name, description, region, locale };

		if (!isValidSubdomain(subdomain))
			return fail(400, { error: 'subdomain_invalid' as const, values });
		if (name.length === 0 || name.length > LIMITS.channelName
			|| description.length > LIMITS.channelDescription
			|| !isContinent(region) || !isChannelLocale(locale)) {
			return fail(400, { error: 'invalid' as const, values });
		}

		// Registry first — the D1 primary key is the subdomain uniqueness point.
		const channelId = randomId('ch');
		const now = Date.now();
		const inserted = await insertChannel(env.DB, {
			subdomain,
			channel_id: channelId,
			region,
			owner_user_id: user.id,
			created_at: now,
		});
		if (inserted === 'taken')
			return fail(409, { error: 'subdomain_taken' as const, values });

		// Then create the DO in its region; compensate the registry on failure.
		try {
			await rpc(channelStub(env, channelId, region).init({
				channelId,
				subdomain,
				region,
				name,
				description,
				locale,
				ownerUserId: user.id,
			}));
		}
		catch (err) {
			await deleteChannel(env.DB, channelId);
			throw err;
		}

		await upsertMembership(env.DB, { user_id: user.id, channel_id: channelId, role: 'owner', created_at: now });
		redirect(303, `/channels/${channelId}`);
	},
};
