<script lang='ts'>
	import type { LayoutData } from './$types';
	import * as m from '$lib/paraglide/messages';

	const { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<header class='topbar'>
	<div class='topbar-inner'>
		<a class='brand' href='/'>{m.app_title()}</a>
		<span class='topbar-spacer'></span>
		{#if data.user}
			<span class='who'>{data.user.displayName}</span>
			<form method='post' action='/logout'>
				<button class='btn small' type='submit'>{m.nav_logout()}</button>
			</form>
		{/if}
	</div>
</header>

<div class='container'>
	{@render children()}
</div>
