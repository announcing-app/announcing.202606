import { expect, test } from '@playwright/test';

/**
 * Progressive-enhancement guarantees for the plain (non-enhanced) forms:
 *
 * 1. Input typed before hydration completes must survive it. Pristine form
 *    fields pass `undefined` for `value` (skipped at hydration) and selects
 *    use `<option selected>` (never overrides a user selection), so
 *    hydration cannot wipe early input — the race that made channel
 *    creation flaky on slow CI runners, where `value={''}` reset the
 *    subdomain and `required` then blocked the submit.
 * 2. The forms must work with JavaScript disabled entirely, including
 *    repopulating submitted values on a validation error, which proves the
 *    repopulation values also server-render.
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
	await page.waitForURL(`${APP}/`);
}

test('input typed before hydration survives it', async ({ page }) => {
	const run = uniq();
	const sub = `e2e-pe-${run}`;
	await devLogin(page, `pe-${run}`);

	// Hold back all script responses so the page is guaranteed un-hydrated
	// while we type, then let hydration land on a filled-in form.
	await page.route('**/*.js', async (route) => {
		await new Promise(resolve => setTimeout(resolve, 2_000));
		await route.continue();
	});

	// 'commit' instead of the default 'load': module scripts delay both
	// DOMContentLoaded and load, and waiting for them would defeat the test.
	await page.goto(`${APP}/channels/new`, { waitUntil: 'commit' });
	await page.locator('input[name="subdomain"]').fill(sub);
	await page.locator('input[name="name"]').fill('PE Channel');
	await page.locator('textarea[name="description"]').fill('typed before hydration');
	await page.locator('select[name="region"]').selectOption('weur');
	await page.locator('select[name="locale"]').selectOption('en');

	// Wait out the held-back scripts plus a settle margin so hydration has
	// definitely run before we look at the fields again.
	await page.waitForLoadState('load');
	await page.waitForTimeout(500);

	await expect(page.locator('input[name="subdomain"]')).toHaveValue(sub);
	await expect(page.locator('input[name="name"]')).toHaveValue('PE Channel');
	await expect(page.locator('textarea[name="description"]')).toHaveValue('typed before hydration');
	await expect(page.locator('select[name="region"]')).toHaveValue('weur');
	await expect(page.locator('select[name="locale"]')).toHaveValue('en');

	// And the submission still goes through with what was typed.
	await page.getByRole('button', { name: 'Create channel' }).click();
	await page.waitForURL(/\/channels\/(?!new$)[^/]+$/);
	await expect(page.getByRole('heading', { name: 'PE Channel' })).toBeVisible();
});

test('channel form works without JavaScript and repopulates on error', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	const run = uniq();
	const sub = `e2e-nojs-${run}`;
	await devLogin(page, `nojs-${run}`);

	// Create a channel, entirely without client JS.
	await page.goto(`${APP}/channels/new`);
	await page.locator('input[name="subdomain"]').fill(sub);
	await page.locator('input[name="name"]').fill('NoJS Channel');
	await page.locator('select[name="region"]').selectOption('weur');
	await page.locator('select[name="locale"]').selectOption('en');
	await page.getByRole('button', { name: 'Create channel' }).click();
	await page.waitForURL(/\/channels\/(?!new$)[^/]+$/);
	await expect(page.getByRole('heading', { name: 'NoJS Channel' })).toBeVisible();

	// Same subdomain again → validation error, with every field repopulated
	// from the server render (proves the defaults SSR correctly).
	await page.goto(`${APP}/channels/new`);
	await page.locator('input[name="subdomain"]').fill(sub);
	await page.locator('input[name="name"]').fill('Duplicate');
	await page.locator('textarea[name="description"]').fill('still here after the error');
	await page.locator('select[name="region"]').selectOption('weur');
	await page.locator('select[name="locale"]').selectOption('en');
	await page.getByRole('button', { name: 'Create channel' }).click();
	await expect(page.locator('.alert')).toHaveText('This subdomain is already taken.');
	await expect(page.locator('input[name="subdomain"]')).toHaveValue(sub);
	await expect(page.locator('input[name="name"]')).toHaveValue('Duplicate');
	await expect(page.locator('textarea[name="description"]')).toHaveValue('still here after the error');
	await expect(page.locator('select[name="region"]')).toHaveValue('weur');
	await expect(page.locator('select[name="locale"]')).toHaveValue('en');

	await context.close();
});
