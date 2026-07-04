<script lang='ts'>
	import type { PageData } from './$types';
	import { formatDate } from '$lib/format';
	import * as m from '$lib/paraglide/messages';

	const { data }: { data: PageData } = $props();
	const locale = $derived(data.meta.locale);

	const summary = $derived(data.post.body.length > 80 ? `${data.post.body.slice(0, 80)}…` : data.post.body);
</script>

<svelte:head>
	<title>{summary} · {data.meta.name}</title>
</svelte:head>

<header class='topbar'>
	<div class='topbar-inner'>
		<a class='brand' href='/'>{data.meta.name}</a>
	</div>
</header>

<main class='container'>
	<article class='card'>
		<!-- eslint-disable-next-line svelte/no-at-html-tags — bodyHtml is escaped+linkified server-side (core renderBodyHtml) -->
		<p class='post-body'>{@html data.post.bodyHtml}</p>
		{#if data.post.imageIds.length > 0}
			<div class='post-images'>
				{#each data.post.imageIds as imageId (imageId)}
					<img src={`/i/${imageId}`} alt='' loading='lazy' />
				{/each}
			</div>
		{/if}
		<p class='post-meta'>
			{formatDate(data.post.createdAt, locale)}
			{#if data.post.updatedAt}· {m.public_edited(undefined, { locale })}{/if}
		</p>
	</article>

	<p><a href='/'>{m.public_back_to_channel(undefined, { locale })}</a></p>
</main>
