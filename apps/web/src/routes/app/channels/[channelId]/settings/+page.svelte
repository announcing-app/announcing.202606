<script lang='ts'>
	import type { ActionData, PageData } from './$types';
	import { formatDate } from '$lib/format';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { CHANNEL_LOCALES, LIMITS, ROLES } from '@announcing/core';

	const { data, form }: { data: PageData; form: ActionData } = $props();
	const meta = $derived(data.view.meta);
	const isOwner = $derived(data.view.role === 'owner');

	const roleLabel = (role: 'owner' | 'editor') => role === 'owner' ? m.role_owner() : m.role_editor();
</script>

<svelte:head><title>{m.settings_title()} · {meta.name} · {m.app_title()}</title></svelte:head>

<div class='page-head'>
	<h1>{m.settings_title()}</h1>
	<div class='actions'><a class='btn' href={`/channels/${meta.channelId}`}>{m.back()}</a></div>
</div>

{#if form && 'error' in form && form.error}
	<p class='alert'>{m.error_invalid_input()}</p>
{/if}

<div class='card'>
	<h2>{m.settings_channel_heading()}</h2>
	<p class='muted'>{meta.subdomain} · {m.field_region()}: {meta.region}</p>
	{#if form && 'updated' in form && form.updated}
		<p class='notice'>{m.saved()}</p>
	{/if}
	<form class='stack' method='post' action='?/update'>
		<label class='field'>
			{m.field_channel_name()}
			<input type='text' name='name' required maxlength={LIMITS.channelName} value={meta.name} disabled={!isOwner} />
		</label>
		<label class='field'>
			{m.field_description()}
			<textarea name='description' maxlength={LIMITS.channelDescription} rows='3' disabled={!isOwner} value={meta.description || undefined}></textarea>
		</label>
		<label class='field'>
			{m.field_locale()}
			<select name='locale' disabled={!isOwner}>
				{#each CHANNEL_LOCALES as locale (locale)}
					<option value={locale} selected={locale === meta.locale}>{locale === 'ja' ? m.locale_ja() : m.locale_en()}</option>
				{/each}
			</select>
		</label>
		{#if isOwner}
			<div><button class='btn primary' type='submit'>{m.save()}</button></div>
		{/if}
	</form>
</div>

<div class='card'>
	<h2>{m.members_title()}</h2>
	<table class='plain'>
		<thead>
			<tr><th>{m.member_name()}</th><th>{m.member_role()}</th><th></th></tr>
		</thead>
		<tbody>
			{#each data.members as member (member.userId)}
				<tr>
					<td>
						{member.displayName}
						{#if member.userId === data.userId}<span class='muted'>({m.member_you()})</span>{/if}
					</td>
					<td>
						{#if isOwner && member.userId !== data.userId}
							<form method='post' action='?/role' style='display: inline-flex; gap: 0.4rem; align-items: center;'>
								<input type='hidden' name='user_id' value={member.userId} />
								<select name='role'>
									{#each ROLES as role (role)}
										<option value={role} selected={role === member.role}>{roleLabel(role)}</option>
									{/each}
								</select>
								<button class='btn small' type='submit'>{m.member_role_change()}</button>
							</form>
						{:else}
							{roleLabel(member.role)}
						{/if}
					</td>
					<td>
						{#if member.userId === data.userId || isOwner}
							<form method='post' action='?/remove'>
								<input type='hidden' name='user_id' value={member.userId} />
								<button class='btn small danger' type='submit'>
									{member.userId === data.userId ? m.member_leave() : m.member_remove()}
								</button>
							</form>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if isOwner}
	<div class='card'>
		<h2>{m.invites_title()}</h2>
		{#if form && 'inviteUrl' in form && form.inviteUrl}
			<p class='notice'>
				{m.invite_link_created()}<br />
				<strong>{form.inviteUrl}</strong><br />
				<span class='muted'>{m.invite_link_hint()}</span>
			</p>
		{/if}
		<form class='stack' method='post' action='?/invite'>
			<label class='field'>
				{m.invite_role()}
				<select name='role'>
					{#each ROLES as role (role)}
						<option value={role} selected={role === 'editor'}>{roleLabel(role)}</option>
					{/each}
				</select>
			</label>
			<div><button class='btn primary' type='submit'>{m.invite_create()}</button></div>
		</form>

		{#if data.view.invites.length > 0}
			<h3>{m.invites_pending()}</h3>
			<table class='plain'>
				<thead>
					<tr><th>{m.invite_role()}</th><th>{m.invite_expires()}</th><th></th></tr>
				</thead>
				<tbody>
					{#each data.view.invites as invite (invite.inviteId)}
						<tr>
							<td>{roleLabel(invite.role)}</td>
							<td>{formatDate(invite.expiresAt, getLocale())}</td>
							<td>
								<form method='post' action='?/revoke'>
									<input type='hidden' name='invite_id' value={invite.inviteId} />
									<button class='btn small danger' type='submit'>{m.invite_revoke()}</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
{/if}
