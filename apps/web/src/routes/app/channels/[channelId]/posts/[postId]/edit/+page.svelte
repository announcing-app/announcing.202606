<script lang='ts'>
	import type { ActionData, PageData } from './$types';
	import { toDatetimeLocalValue } from '$lib/format';
	import * as m from '$lib/paraglide/messages';
	import { LIMITS } from '@announcing/core';
	import { onMount } from 'svelte';

	const { data, form }: { data: PageData; form: ActionData } = $props();

	// The mode radio is form state seeded from the loaded post once — it must
	// not snap back if `data` is invalidated while the user is editing.
	// svelte-ignore state_referenced_locally
	let publishMode = $state<'now' | 'schedule' | 'draft'>(data.post.status === 'scheduled' ? 'schedule' : data.post.status === 'draft' ? 'draft' : 'now');
	let scheduledAtLocal = $state('');
	const scheduledAtMs = $derived(scheduledAtLocal === '' ? '' : String(new Date(scheduledAtLocal).getTime()));

	// Prefill the schedule input in the device's timezone — client-only, so the
	// server-rendered markup stays timezone-free.
	onMount(() => {
		if (data.post.scheduledAt)
			scheduledAtLocal = toDatetimeLocalValue(data.post.scheduledAt);
	});

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

	const submitLabel = $derived.by(() => {
		if (data.post.status === 'published' || publishMode === 'now')
			return data.post.status === 'published' ? m.save() : m.post_publish();
		return publishMode === 'schedule' ? m.post_schedule_submit() : m.post_save_draft();
	});
</script>

<svelte:head><title>{m.post_edit_title()} · {m.app_title()}</title></svelte:head>

<div class='page-head'>
	<h1>{m.post_edit_title()}</h1>
	<div class='actions'><a class='btn' href={`/channels/${data.channelId}`}>{m.back()}</a></div>
</div>

{#if errorMessage}
	<p class='alert'>{errorMessage}</p>
{/if}

<div class='card'>
	<form class='stack' method='post' action='?/save' enctype='multipart/form-data'>
		<label class='field'>
			{m.field_body()}
			<textarea name='body' required maxlength={LIMITS.postBody}>{form?.body ?? data.post.body}</textarea>
		</label>

		{#if data.post.imageIds.length > 0}
			<fieldset class='field' style='border: none; padding: 0; margin: 0;'>
				<legend style='font-weight: 600;'>{m.post_edit_keep_images()}</legend>
				<div class='post-images'>
					{#each data.post.imageIds as imageId (imageId)}
						<label style='display: grid; gap: 0.25rem; font-weight: 400;'>
							<img src={`${data.publicOrigin}/i/${imageId}`} alt='' loading='lazy' />
							<span><input type='checkbox' name='keep' value={imageId} checked /> {m.post_edit_keep()}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<label class='field'>
			{m.post_edit_add_images()}
			<input type='file' name='images' accept='image/jpeg,image/png,image/webp,image/gif' multiple />
			<span class='hint'>{m.field_images_hint({ max: LIMITS.postImages })}</span>
		</label>

		{#if data.post.status !== 'published'}
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
		{/if}

		<div><button class='btn primary' type='submit'>{submitLabel}</button></div>
	</form>

	<hr style='border: none; border-top: 1px solid var(--border); margin: 1rem 0;' />

	<form method='post' action='?/delete'>
		<button class='btn danger' type='submit'>{m.post_delete()}</button>
	</form>
</div>
