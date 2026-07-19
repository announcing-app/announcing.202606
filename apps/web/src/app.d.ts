import type { Continent, HostInfo } from '@announcing/core';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Locals {
			/** Which of the three host kinds this request came in on. */
			host: HostInfo;
			/** Registry row, resolved for channel hosts (404 before this is unset). */
			channel?: { channelId: string; subdomain: string; region: Continent };
			/** Session user; only resolved on dashboard hosts. */
			user: { id: string; displayName: string } | null;
			sessionId?: string;
			/** Public pages set this so <html lang> matches the channel locale. */
			contentLocale?: string;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}

	// Merged into the `wrangler types`-generated Env: values that are not in
	// wrangler.jsonc vars because they are secrets or dev-only (.dev.vars /
	// `wrangler secret put`).
	interface Env {
		GOOGLE_CLIENT_ID?: string;
		GOOGLE_CLIENT_SECRET?: string;
		/** '1' enables the passwordless dev login (see lib/server/auth.ts). */
		DEV_AUTH?: string;
	}
}

export {};
