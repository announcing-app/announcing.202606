<script lang='ts'>
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { CHANNEL_LOCALES, CONTINENTS, LIMITS } from '@announcing/core';

	const { data, form }: { data: PageData; form: ActionData } = $props();

	const regionLabels: Record<(typeof CONTINENTS)[number], () => string> = {
		afr: m.region_afr,
		apac: m.region_apac,
		eeur: m.region_eeur,
		enam: m.region_enam,
		me: m.region_me,
		oc: m.region_oc,
		sam: m.region_sam,
		weur: m.region_weur,
		wnam: m.region_wnam,
	};

	const errorMessage = $derived.by(() => {
		switch (form?.error) {
			case 'subdomain_invalid': return m.error_subdomain_invalid();
			case 'subdomain_taken': return m.error_subdomain_taken();
			case 'invalid': return m.error_invalid_input();
			default: return null;
		}
	});
</script>

<svelte:head><title>{m.channel_new_title()} · {m.app_title()}</title></svelte:head>

<div class='page-head'><h1>{m.channel_new_title()}</h1></div>

{#if errorMessage}
	<p class='alert'>{errorMessage}</p>
{/if}

<div class='card'>
	<form class='stack' method='post'>
		<label class='field'>
			{m.field_subdomain()}
			<!--
				`|| undefined` on the repopulation values: undefined is skipped at
				hydration, so input typed before hydration survives; a string only
				appears (and SSRs as the value attribute) on the error re-render.
			-->
			<input
				type='text'
				name='subdomain'
				required
				minlength='3'
				maxlength='63'
				pattern='[a-z0-9][a-z0-9\-]*[a-z0-9]'
				value={form?.values?.subdomain || undefined}
			/>
			<span class='hint'>{m.field_subdomain_hint()}</span>
		</label>
		<label class='field'>
			{m.field_channel_name()}
			<input type='text' name='name' required maxlength={LIMITS.channelName} value={form?.values?.name || undefined} />
		</label>
		<label class='field'>
			{m.field_description()}
			<textarea name='description' maxlength={LIMITS.channelDescription} rows='3' value={form?.values?.description || undefined}></textarea>
		</label>
		<label class='field'>
			{m.field_region()}
			<select name='region' required>
				{#each CONTINENTS as continent (continent)}
					<option value={continent} selected={continent === (form?.values?.region ?? 'apac')}>{regionLabels[continent]()}</option>
				{/each}
			</select>
			<span class='hint'>{m.field_region_hint()}</span>
		</label>
		<label class='field'>
			{m.field_locale()}
			<select name='locale' required>
				{#each CHANNEL_LOCALES as locale (locale)}
					<option value={locale} selected={locale === (form?.values?.locale ?? data.defaultLocale)}>{locale === 'ja' ? m.locale_ja() : m.locale_en()}</option>
				{/each}
			</select>
			<span class='hint'>{m.field_locale_hint()}</span>
		</label>
		<div><button class='btn primary' type='submit'>{m.channels_create()}</button></div>
	</form>
</div>
