import type { ChannelRpc } from '@announcing/core';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { WorkflowEntrypoint } from 'cloudflare:workers';

export interface PublishParams {
	/** ChannelDO id as hex (ctx.id.toString()) — placement/jurisdiction included. */
	doId: string;
	postId: string;
	/**
	 * The schedule this instance belongs to. Rescheduling or deleting the post
	 * invalidates the token, so a stale instance resolves to `skipped` instead
	 * of publishing something it shouldn't.
	 */
	scheduleToken: string;
	/** When to publish (epoch ms). */
	publishAt: number;
}

/**
 * PublishWorkflow — durable schedule executor for one post: sleep until the
 * publish time, then flip the post to `published` inside its ChannelDO. The
 * DO decides idempotency via the schedule token; this workflow never retries
 * a *decision*, only transport failures (step.do default retries).
 *
 * Instances are spawned by the ChannelDO itself (same worker), so no
 * cross-worker workflow binding is involved. Phase 4 will append the Web Push
 * fan-out step here.
 */
export class PublishWorkflow extends WorkflowEntrypoint<Env, PublishParams> {
	async run(event: WorkflowEvent<PublishParams>, step: WorkflowStep): Promise<void> {
		const { doId, postId, scheduleToken, publishAt } = event.payload;

		await step.sleepUntil('until publish time', new Date(publishAt));

		await step.do('publish post', async () => {
			const ns = this.env.CHANNEL;
			const stub = ns.get(ns.idFromString(doId)) as unknown as ChannelRpc;
			const result = await stub.publishScheduled(postId, scheduleToken);
			// A failure code here is a bug (publishScheduled treats every expected
			// situation as 'published' | 'skipped') — throw so the step retries.
			if (!result.ok)
				throw new Error(`publishScheduled failed: ${result.code}`);
			return result.value;
		});
	}
}
