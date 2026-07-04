<script lang='ts'>
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { LIMITS } from '@announcing/core';

	const { data, form }: { data: PageData; form: ActionData } = $props();

	const errorMessage = $derived.by(() => {
		switch (form?.error) {
			case 'body': return m.error_body_required();
			case 'too_many': return m.error_images_too_many({ max: LIMITS.postImages });
			case 'too_large': return m.error_image_too_large();
			case 'unsupported': return m.error_image_unsupported();
			default: return null;
		}
	});
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
			<textarea name='body' required maxlength={LIMITS.postBody}>{form?.body ?? ''}</textarea>
			<span class='hint'>{m.field_body_hint()}</span>
		</label>
		<label class='field'>
			{m.field_images()}
			<input type='file' name='images' accept='image/jpeg,image/png,image/webp,image/gif' multiple />
			<span class='hint'>{m.field_images_hint({ max: LIMITS.postImages })}</span>
		</label>
		<div><button class='btn primary' type='submit'>{m.post_publish()}</button></div>
	</form>
</div>
