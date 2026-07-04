import { error } from '@sveltejs/kit';

/**
 * `platform` is always present on Cloudflare (dev via getPlatformProxy, prod
 * on workerd); its absence means a misconfigured runtime, not a user error.
 */
export function requireEnv(platform: App.Platform | undefined): Env {
	if (!platform?.env)
		error(500, 'platform bindings unavailable');
	return platform.env;
}
