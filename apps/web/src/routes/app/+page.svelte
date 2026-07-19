<script lang='ts'>
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	const { data }: { data: PageData } = $props();

	const roleLabel = (role: 'owner' | 'editor') => role === 'owner' ? m.role_owner() : m.role_editor();
</script>

<svelte:head><title>{m.channels_title()} · {m.app_title()}</title></svelte:head>

<div class='page-head'>
	<h1>{m.channels_title()}</h1>
	<div class='actions'>
		<a class='btn primary' href='/channels/new'>{m.channels_create()}</a>
	</div>
</div>

{#if data.channels.length === 0}
	<div class='card'>
		<p>{m.channels_empty()}</p>
	</div>
{:else}
	<ul class='list-plain'>
		{#each data.channels as channel (channel.channel_id)}
			<li class='card'>
				<a href={`/channels/${channel.channel_id}`}><strong>{channel.subdomain}</strong></a>
				<span class='muted'>· {roleLabel(channel.role)}</span>
			</li>
		{/each}
	</ul>
{/if}
