<script lang='ts'>
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	const { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{m.invite_title()} · {m.app_title()}</title></svelte:head>

<div class='page-head'><h1>{m.invite_title()}</h1></div>

{#if data.preview}
	<div class='card'>
		<p>{m.invite_description({
			channel: data.preview.channelName,
			role: data.preview.role === 'owner' ? m.role_owner() : m.role_editor(),
		})}</p>
		{#if data.loggedIn}
			<form method='post'>
				<button class='btn primary' type='submit'>{m.invite_accept()}</button>
			</form>
		{:else}
			<p><a class='btn primary' href={data.loginUrl}>{m.invite_login_first()}</a></p>
		{/if}
	</div>
{:else}
	<div class='card'>
		<p class='alert'>
			{data.inviteError === 'expired' ? m.invite_expired() : m.invite_invalid()}
		</p>
	</div>
{/if}
