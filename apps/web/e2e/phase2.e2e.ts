import { expect, test } from '@playwright/test';

/**
 * Phase 2 happy paths: post states (draft / scheduled / published), the
 * Workflows-driven scheduled publish, and the RSS/Atom feeds. Runs against
 * the same built preview as phase1 (web + backend in one wrangler dev, so
 * local Workflows execute for real).
 */

const APP = 'http://app.localhost:4173';

/** Unique per call so tests stay isolated across workers and --repeat-each. */
function uniq(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function devLogin(page: import('@playwright/test').Page, name: string): Promise<void> {
	await page.goto(`${APP}/login`);
	await page.getByLabel(/Username/).fill(name);
	await page.getByRole('button', { name: 'Log in as dev user' }).click();
	// `${APP}/**` would match /login itself; wait for the post-login redirect.
	await page.waitForURL(`${APP}/`);
}

/**
 * Select a publish mode on the post form. The mode controls are
 * client-enhanced (bind:group drives the submit label and the schedule
 * field), so a check() that lands before hydration is reverted when the
 * client state takes over — retry until the mode's observable effect
 * confirms the live form has it.
 */
async function setPublishMode(page: import('@playwright/test').Page, mode: 'now' | 'schedule' | 'draft'): Promise<void> {
	const effect = mode === 'schedule'
		? page.locator('input[name="scheduled_at"]')
		: page.getByRole('button', { name: mode === 'draft' ? 'Save draft' : 'Publish' });
	await expect(async () => {
		await page.locator(`input[name="publish_mode"][value="${mode}"]`).check();
		await expect(effect).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 15_000 });
}

async function createChannel(page: import('@playwright/test').Page, sub: string, name: string): Promise<void> {
	await page.goto(`${APP}/channels/new`);
	await page.locator('input[name="subdomain"]').fill(sub);
	await page.locator('input[name="name"]').fill(name);
	await page.locator('select[name="region"]').selectOption('apac');
	await page.locator('select[name="locale"]').selectOption('en');
	await page.getByRole('button', { name: 'Create channel' }).click();
	// `/channels/*` would match /channels/new itself; require a real channel id
	// so a failed creation surfaces here, not as a timeout further down.
	await page.waitForURL(/\/channels\/(?!new$)[^/]+$/);
}

/** Epoch ms → datetime-local value (with seconds) in this process's timezone. */
function datetimeLocalValue(ts: number): string {
	const d = new Date(ts);
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

test('draft lifecycle and feeds: draft stays private → published via edit → RSS/Atom', async ({ page }) => {
	const run = uniq();
	const sub = `e2e2-${run}`;
	const pub = `http://${sub}.localhost:4173`;
	await devLogin(page, `writer-${run}`);
	await createChannel(page, sub, 'Phase2 Drafts');

	// Save a draft; the dashboard shows it with a badge but no public link.
	await page.getByRole('link', { name: 'New announcement' }).click();
	await page.locator('textarea[name="body"]').fill('Draft only, not public yet');
	await setPublishMode(page, 'draft');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await page.waitForURL(`${APP}/channels/*`);
	await expect(page.locator('.badge')).toHaveText('Draft');
	await expect(page.getByRole('link', { name: 'View public page' })).toHaveCount(0);

	// Not on the public page, and its permalink does not exist.
	const before = await page.request.get(`${pub}/?cb=${Date.now()}`);
	expect(await before.text()).not.toContain('Draft only, not public yet');

	// Publish it from the edit form.
	await page.getByRole('link', { name: 'Edit' }).click();
	await setPublishMode(page, 'now');
	await page.getByRole('button', { name: 'Publish' }).click();
	await page.waitForURL(`${APP}/channels/*`);
	await expect(page.locator('.badge')).toHaveCount(0);

	// Public page now shows it and advertises the feeds.
	const html = await (await page.request.get(`${pub}/?cb=${Date.now()}`)).text();
	expect(html).toContain('Draft only, not public yet');
	expect(html).toContain('rel="alternate" type="application/rss+xml"');
	expect(html).toContain('rel="alternate" type="application/atom+xml"');

	// A second draft stays out of the feeds.
	await page.goto(page.url());
	await page.getByRole('link', { name: 'New announcement' }).click();
	await page.locator('textarea[name="body"]').fill('Never published draft');
	await setPublishMode(page, 'draft');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await page.waitForURL(`${APP}/channels/*`);

	const rss = await page.request.get(`${pub}/rss.xml?cb=${Date.now()}`);
	expect(rss.status()).toBe(200);
	expect(rss.headers()['content-type']).toContain('application/rss+xml');
	const rssBody = await rss.text();
	expect(rssBody).toContain('<rss version="2.0"');
	expect(rssBody).toContain('Draft only, not public yet');
	expect(rssBody).not.toContain('Never published draft');

	const atom = await page.request.get(`${pub}/atom.xml?cb=${Date.now()}`);
	expect(atom.status()).toBe(200);
	expect(atom.headers()['content-type']).toContain('application/atom+xml');
	const atomBody = await atom.text();
	expect(atomBody).toContain('<feed xmlns="http://www.w3.org/2005/Atom"');
	expect(atomBody).toContain('Draft only, not public yet');
	expect(atomBody).not.toContain('Never published draft');
});

test('scheduled post is hidden until the workflow publishes it', async ({ page }) => {
	// Publish wait (≤60s poll) + cold-start slack must fit inside the test.
	test.setTimeout(120_000);
	const run = uniq();
	const sub = `e2e2s-${run}`;
	const pub = `http://${sub}.localhost:4173`;
	await devLogin(page, `sched-${run}`);
	await createChannel(page, sub, 'Phase2 Scheduling');

	// Schedule ~12s ahead (datetime-local accepts seconds via step=1).
	await page.getByRole('link', { name: 'New announcement' }).click();
	await page.locator('textarea[name="body"]').fill('Scheduled by e2e');
	await setPublishMode(page, 'schedule');
	await page.locator('input[name="scheduled_at"]').fill(datetimeLocalValue(Date.now() + 12_000));
	await page.getByRole('button', { name: 'Schedule' }).click();
	await page.waitForURL(`${APP}/channels/*`);
	await expect(page.locator('.badge.scheduled')).toContainText('Scheduled');

	// Still private right now…
	const before = await page.request.get(`${pub}/?cb=${Date.now()}`);
	expect(await before.text()).not.toContain('Scheduled by e2e');

	// …until the PublishWorkflow fires (sleepUntil → publishScheduled).
	await expect(async () => {
		const res = await page.request.get(`${pub}/?cb=${Date.now()}`);
		expect(await res.text()).toContain('Scheduled by e2e');
	}).toPass({ timeout: 60_000, intervals: [2_000] });

	// The dashboard now shows it as published (no badge, public link present).
	await page.reload();
	await expect(page.locator('.badge')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'View public page' })).toBeVisible();
});
