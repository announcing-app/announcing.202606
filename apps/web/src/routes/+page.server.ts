import type { PageServerLoad } from './$types';
import { env as publicEnv } from '$env/dynamic/public';

export const load: PageServerLoad = ({ url, locals }) => {
	// On the real apex (or localhost) the dashboard lives at app.{host};
	// on unknown hosts (e.g. *.workers.dev) fall back to the configured base.
	const dashboardHost = locals.host.kind === 'landing'
		? `app.${url.host}`
		: `app.${publicEnv.PUBLIC_BASE_HOST ?? url.host}`;
	return { dashboardUrl: `${url.protocol}//${dashboardHost}/` };
};
