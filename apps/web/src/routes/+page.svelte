<script lang='ts'>
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	const { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.app_title()}</title>
	<meta name='description' content={m.app_tagline()} />
</svelte:head>

<main class='hero'>
	<h1>{m.app_title()}</h1>
	<p class='tagline'>{m.app_tagline()}</p>
	<ul class='hero-points'>
		<li>{m.landing_point_no_ads()}</li>
		<li>{m.landing_point_no_tracking()}</li>
		<li>{m.landing_point_no_account()}</li>
	</ul>
	<a class='btn primary' href={data.dashboardUrl}>{m.landing_open_dashboard()}</a>
	<p class='muted'>{m.landing_dashboard_hint()}</p>
</main>
