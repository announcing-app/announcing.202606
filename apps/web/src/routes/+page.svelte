<script lang='ts'>
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	const { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{m.app_title()}</title></svelte:head>

<main>
	<h1>{m.app_title()}</h1>
	<p>{m.app_tagline()}</p>

	<section>
		<h2>{m.bindings_heading()}</h2>
		<ul>
			{#each Object.entries(data.bindings) as [name, ok] (name)}
				<li>{ok ? '✅' : '⛔'} {name}</li>
			{/each}
		</ul>
	</section>
</main>
