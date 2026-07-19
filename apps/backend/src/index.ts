import { APP_NAME } from '@announcing/core';

// The backend worker hosts the regional data layer: Durable Objects + Workflows.
// Cloudflare binds to these *named* exports; apps/web reaches them via cross-worker
// bindings (see the `script_name` entries in apps/web/wrangler.jsonc).
export { ChannelDO } from './channel-do';
export { PublishWorkflow } from './workflows';

export default {
	// This worker is invoked through its bindings (CHANNEL / PUBLISH), never directly.
	fetch(): Response {
		return new Response(`${APP_NAME} backend: access via bindings only`, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
