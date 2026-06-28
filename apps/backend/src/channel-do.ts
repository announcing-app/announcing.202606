import { DurableObject } from 'cloudflare:workers';

/**
 * ChannelDO — one Durable Object per channel, location-hinted to the channel's
 * continent. It is the strongly-consistent source of truth for a channel's
 * posts, members and settings.
 *
 * Phase 0: SQLite bootstrap + a health check to prove the wiring works.
 * The real schema (posts / members / settings) is authored in Phase 1.
 */
export class ChannelDO extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(
				'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;',
			);
		});
	}

	/** Health check used in Phase 0 to confirm the DO is reachable over RPC. */
	ping(): string {
		return 'pong';
	}
}
