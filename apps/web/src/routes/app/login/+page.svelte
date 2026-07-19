<script lang='ts'>
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	const { data, form }: { data: PageData; form: ActionData } = $props();

	const googleHref = $derived(`/auth/google${data.next ? `?next=${encodeURIComponent(data.next)}` : ''}`);
	const devAction = $derived(`?/dev${data.next ? `&next=${encodeURIComponent(data.next)}` : ''}`);
</script>

<svelte:head><title>{m.login_title()} · {m.app_title()}</title></svelte:head>

<div class='page-head'><h1>{m.login_title()}</h1></div>

{#if data.oauthError}
	<p class='alert'>{m.login_error_oauth()}</p>
{/if}

{#if data.googleEnabled}
	<div class='card'>
		<a class='btn primary' href={googleHref} data-sveltekit-preload-data='off'>{m.login_google()}</a>
	</div>
{:else if !data.devEnabled}
	<p class='card muted'>{m.login_unconfigured()}</p>
{/if}

{#if data.devEnabled}
	<div class='card'>
		<h2>{m.login_dev_title()}</h2>
		<p class='muted'>{m.login_dev_hint()}</p>
		{#if form?.error === 'dev_name_invalid'}
			<p class='alert'>{m.login_dev_name_invalid()}</p>
		{/if}
		<form class='stack' method='post' action={devAction}>
			<label class='field'>
				{m.login_dev_name_label()}
				<input type='text' name='name' required pattern='[a-z0-9][a-z0-9\-]*' maxlength='30' />
			</label>
			<div><button class='btn' type='submit'>{m.login_dev_submit()}</button></div>
		</form>
	</div>
{/if}
