import type { PageServerLoad } from './$types';

// Phase 0 smoke test: confirms the Cloudflare bindings declared in wrangler.jsonc
// are wired into `platform.env` and correctly typed (via `wrangler types`).
export const load: PageServerLoad = ({ platform }) => {
	const env = platform?.env;
	return {
		bindings: {
			DB: Boolean(env?.DB),
			IMAGES: Boolean(env?.IMAGES),
			CHANNEL: Boolean(env?.CHANNEL),
			PUBLISH: Boolean(env?.PUBLISH),
		},
	};
};
