<script lang='ts'>
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { LIMITS } from '@announcing/core';

	const { data, form }: { data: PageData; form: ActionData } = $props();

	let publishMode = $state<'now' | 'schedule' | 'draft'>('now');
	let scheduledAtLocal = $state('');
	// The datetime-local value is naive; the client converts it to epoch ms so
	// the writer's own timezone applies (the server falls back to UTC parsing).
	const scheduledAtMs = $derived(scheduledAtLocal === '' ? '' : String(new Date(scheduledAtLocal).getTime()));

	const errorMessage = $derived.by(() => {
		switch (form?.error) {
			case 'body': return m.error_body_required();
			case 'schedule': return m.error_schedule_invalid();
			case 'too_many': return m.error_images_too_many({ max: LIMITS.postImages });
			case 'too_large': return m.error_image_too_large();
			case 'unsupported': return m.error_image_unsupported();
			default: return null;
		}
	});

	const submitLabel = $derived(
		publishMode === 'now'
			? m.post_publish()
			: publishMode === 'schedule' ? m.post_schedule_submit() : m.post_save_draft(),
	);
</script>

<svelte:head><title>{m.post_new_title()} · {m.app_title()}</title></svelte:head>

<div class='page-head'>
	<h1>{m.post_new_title()}</h1>
	<div class='actions'><a class='btn' href={`/channels/${data.channelId}`}>{m.back()}</a></div>
</div>

{#if errorMessage}
	<p class='alert'>{errorMessage}</p>
{/if}

<div class='card'>
	<form class='stack' method='post' enctype='multipart/form-data'>
		<label class='field'>
			{m.field_body()}
			<!--
				undefined when pristine: skipped at hydration so text typed before
				it survives; the error re-render SSRs the submitted body back.
			-->
			<textarea name='body' required maxlength={LIMITS.postBody} value={form?.body || undefined}></textarea>
			<span class='hint'>{m.field_body_hint()}</span>
		</label>
		<label class='field'>
			{m.field_images()}
			<input type='file' name='images' accept='image/jpeg,image/png,image/webp,image/gif' multiple />
			<span class='hint'>{m.field_images_hint({ max: LIMITS.postImages })}</span>
		</label>

		<fieldset class='field publish-modes'>
			<legend>{m.field_publish()}</legend>
			<label><input type='radio' name='publish_mode' value='now' bind:group={publishMode} /> {m.publish_mode_now()}</label>
			<label><input type='radio' name='publish_mode' value='schedule' bind:group={publishMode} /> {m.publish_mode_schedule()}</label>
			{#if publishMode === 'schedule'}
				<div class='schedule-at'>
					<input type='datetime-local' name='scheduled_at' step='1' bind:value={scheduledAtLocal} required />
					<input type='hidden' name='scheduled_at_ms' value={scheduledAtMs} />
					<span class='hint'>{m.field_schedule_hint()}</span>
				</div>
			{/if}
			<label><input type='radio' name='publish_mode' value='draft' bind:group={publishMode} /> {m.publish_mode_draft()}</label>
		</fieldset>

		<div><button class='btn primary' type='submit'>{submitLabel}</button></div>
	</form>
</div>
