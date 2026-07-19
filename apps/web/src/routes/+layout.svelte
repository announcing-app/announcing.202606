<script lang='ts'>
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import '../app.css';

	const { children } = $props();

	// Hydration marker for the e2e suite: hydration re-applies `value=`
	// attributes, wiping anything typed into a form before it completes, so
	// tests wait for this before filling inputs.
	onMount(() => {
		document.documentElement.dataset.hydrated = '1';
	});
</script>

<svelte:head><link rel='icon' href={favicon} /></svelte:head>
{@render children()}
