<script lang='ts'>
	import type { PageData } from './$types';
	import { formatDate } from '$lib/format';
	import * as m from '$lib/paraglide/messages';

	const { data }: { data: PageData } = $props();
	const locale = $derived(data.meta.locale);
</script>

<svelte:head>
	<title>{data.meta.name}</title>
	{#if data.meta.description}
		<meta name='description' content={data.meta.description} />
	{/if}
	<link rel='alternate' type='application/rss+xml' title={`${data.meta.name} (RSS)`} href='/rss.xml' />
	<link rel='alternate' type='application/atom+xml' title={`${data.meta.name} (Atom)`} href='/atom.xml' />
</svelte:head>

<header class='topbar'>
	<div class='topbar-inner'>
		<span class='brand'>{data.meta.name}</span>
	</div>
</header>

<main class='container'>
	{#if data.meta.description}
		<p class='muted'>{data.meta.description}</p>
	{/if}

	{#if data.posts.length === 0}
		<div class='card'><p>{m.public_no_posts(undefined, { locale })}</p></div>
	{:else}
		<ul class='list-plain'>
			{#each data.posts as post (post.id)}
				<li class='card'>
					<!-- eslint-disable-next-line svelte/no-at-html-tags — bodyHtml is escaped+linkified server-side (core renderBodyHtml) -->
					<p class='post-body'>{@html post.bodyHtml}</p>
					{#if post.imageIds.length > 0}
						<div class='post-images'>
							{#each post.imageIds as imageId (imageId)}
								<a href={`/p/${post.id}`}><img src={`/i/${imageId}`} alt='' loading='lazy' /></a>
							{/each}
						</div>
					{/if}
					<p class='post-meta'>
						<a href={`/p/${post.id}`}>{formatDate(post.publishedAt, locale)}</a>
						{#if post.updatedAt}· {m.public_edited(undefined, { locale })}{/if}
					</p>
				</li>
			{/each}
		</ul>
	{/if}

	<footer class='muted' style='margin-top: 3rem; text-align: center;'>
		<p><a href='/rss.xml'>RSS</a> · <a href='/atom.xml'>Atom</a></p>
		{m.public_powered_by(undefined, { locale })}
	</footer>
</main>
