<script lang='ts'>
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { LIMITS } from '@announcing/core';

	const { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>{m.onboarding_title()} · {m.app_title()}</title></svelte:head>

<div class='page-head'><h1>{m.onboarding_title()}</h1></div>

<div class='card'>
	<p class='muted'>{m.onboarding_hint()}</p>
	{#if form?.error}
		<p class='alert'>{m.onboarding_invalid()}</p>
	{/if}
	<form class='stack' method='post'>
		<label class='field'>
			{m.onboarding_display_name()}
			<input type='text' name='display_name' required maxlength={LIMITS.displayName} value={data.displayName || undefined} />
		</label>
		<div><button class='btn primary' type='submit'>{m.save()}</button></div>
	</form>
</div>
