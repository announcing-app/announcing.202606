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
		<div><button class='btn primary' type='submit'>{m.save()}</button></div>
	</form>

	<hr style='border: none; border-top: 1px solid var(--border); margin: 1rem 0;' />

	<form method='post' action='?/delete'>
		<button class='btn danger' type='submit'>{m.post_delete()}</button>
	</form>
</div>
