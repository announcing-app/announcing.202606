<script lang='ts'>
	import type { PageData } from './$types';
	import { formatDate } from '$lib/format';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const { data }: { data: PageData } = $props();
	const meta = $derived(data.dashboard.meta);
</script>

<svelte:head><title>{meta.name} · {m.app_title()}</title></svelte:head>

<div class='page-head'>
	<h1>{meta.name}</h1>
	<div class='actions'>
		<a class='btn' href={`/channels/${meta.channelId}/settings`}>{m.channel_settings()}</a>
		<a class='btn primary' href={`/channels/${meta.channelId}/posts/new`}>{m.post_new()}</a>
	</div>
</div>

<p class='muted'>
	{m.channel_public_url()}:
	<a href={data.publicOrigin} target='_blank' rel='noreferrer'>{data.publicOrigin}</a>
</p>

{#if data.dashboard.posts.length === 0}
	<div class='card'><p>{m.channel_no_posts()}</p></div>
{:else}
	<ul class='list-plain'>
		{#each data.dashboard.posts as post (post.id)}
			<li class='card'>
				<p class='post-body'>{post.body}</p>
				{#if post.imageIds.length > 0}
					<p class='muted'>🖼 {post.imageIds.length}</p>
				{/if}
				<p class='post-meta'>
					{formatDate(post.createdAt, getLocale())}
					{#if post.updatedAt}({m.post_edited()}){/if}
					·
					<a href={`/channels/${meta.channelId}/posts/${post.id}/edit`}>{m.post_edit()}</a>
					·
					<a href={`${data.publicOrigin}/p/${post.id}`} target='_blank' rel='noreferrer'>{m.post_view_public()}</a>
				</p>
			</li>
		{/each}
	</ul>
{/if}
