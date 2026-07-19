import type { PublishAction } from '@announcing/core';
import { LIMITS } from '@announcing/core';

/**
 * Read the publish controls from a post form. The schedule time arrives as
 * `scheduled_at_ms` (epoch ms, derived client-side from the datetime-local
 * input so the writer's timezone applies); without JS we fall back to reading
 * the raw datetime-local value as UTC. Returns null when the mode is unknown
 * or the schedule time is missing/past/too far ahead — the DO re-validates
 * with the same rules either way.
 */
export function parsePublishAction(form: FormData): PublishAction | null {
	const mode = String(form.get('publish_mode') ?? 'now');
	if (mode === 'draft' || mode === 'now')
		return { mode };
	if (mode !== 'schedule')
		return null;
	const ms = Number(form.get('scheduled_at_ms'));
	const at = Number.isSafeInteger(ms) && ms > 0
		? ms
		: Date.parse(`${String(form.get('scheduled_at') ?? '')}:00Z`);
	if (!Number.isSafeInteger(at))
		return null;
	const now = Date.now();
	if (at <= now || at > now + LIMITS.scheduleMaxAheadMs)
		return null;
	return { mode: 'schedule', at };
}
