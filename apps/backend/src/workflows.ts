import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { WorkflowEntrypoint } from 'cloudflare:workers';

export interface PublishParams {
	postId: string;
}

/**
 * PublishWorkflow — durable, multi-step pipeline for scheduled publishing and
 * push fan-out. Phase 0: a single no-op step that validates the wiring.
 * Real steps (render immutable content, prime/purge cache, fan out Web Push)
 * are authored in Phase 2.
 */
export class PublishWorkflow extends WorkflowEntrypoint<Env, PublishParams> {
	async run(event: WorkflowEvent<PublishParams>, step: WorkflowStep): Promise<void> {
		await step.do('noop', async () => {
			void event.payload.postId;
		});
	}
}
