import { expect, test } from '@playwright/test';

/**
 * Phase 1 happy paths against the built app (`pnpm preview`: multi-worker
 * wrangler dev on :4173 with web + backend, dev auth enabled via --var).
 *
 * Local .wrangler/state persists between runs, so every run works in its own
 * namespace via a unique suffix. Playwright's default Accept-Language is
 * en-US, so UI copy is asserted in English.
 */

const RUN = Date.now().toString(36);
const APP = 'http://app.localhost:4173';
const SUB = `e2e-${RUN}`;
const PUB = `http://${SUB}.localhost:4173`;

async function devLogin(page: import('@playwright/test').Page, name: string): Promise<void> {
	await page.goto(`${APP}/login`);
	await page.getByLabel(/Username/).fill(name);
	await page.getByRole('button', { name: 'Log in as dev user' }).click();
	await page.waitForURL(`${APP}/**`);
}

test('publish flow: login → create channel → post → public page', async ({ page }) => {
	await devLogin(page, `owner-${RUN}`);
	await expect(page.getByRole('heading', { name: 'Channels' })).toBeVisible();

	// Create a channel.
	await page.getByRole('link', { name: 'Create channel' }).click();
	await page.locator('input[name="subdomain"]').fill(SUB);
	await page.locator('input[name="name"]').fill('E2E Channel');
	await page.locator('textarea[name="description"]').fill('Created by the e2e suite');
	await page.locator('select[name="region"]').selectOption('apac');
	await page.locator('select[name="locale"]').selectOption('en');
	await page.getByRole('button', { name: 'Create channel' }).click();
	await page.waitForURL(`${APP}/channels/*`);
	await expect(page.getByRole('heading', { name: 'E2E Channel' })).toBeVisible();

	// Publish a post with an auto-linked URL.
	await page.getByRole('link', { name: 'New announcement' }).click();
	await page.locator('textarea[name="body"]').fill('Hello from e2e!\nDetails: https://example.com/news');
	await page.getByRole('button', { name: 'Publish' }).click();
	await page.waitForURL(`${APP}/channels/*`);
	await expect(page.getByText('Hello from e2e!')).toBeVisible();

	// Public channel page (anonymous host).
	await page.goto(PUB);
	await expect(page.getByText('E2E Channel')).toBeVisible();
	await expect(page.getByText('Hello from e2e!')).toBeVisible();
	const link = page.getByRole('link', { name: 'https://example.com/news' });
	await expect(link).toHaveAttribute('href', 'https://example.com/news');

	// Post permalink. (Scope to .post-body: SvelteKit's live-region announcer
	// repeats the page text after client-side navigation.)
	await page.locator('.post-meta a').first().click();
	await page.waitForURL(`${PUB}/p/*`);
	await expect(page.locator('.post-body')).toContainText('Hello from e2e!');

	// The public page must not set cookies (tracking-free by design).
	const cookies = await page.context().cookies(PUB);
	expect(cookies).toHaveLength(0);
});

test('membership flow: invite → second user joins as editor and posts', async ({ browser, page }) => {
	// Owner creates a channel and an invite link.
	await devLogin(page, `owner2-${RUN}`);
	await page.goto(`${APP}/channels/new`);
	await page.locator('input[name="subdomain"]').fill(`${SUB}-team`);
	await page.locator('input[name="name"]').fill('E2E Team');
	await page.locator('select[name="region"]').selectOption('weur'); // exercises the EU-jurisdiction DO path
	await page.locator('select[name="locale"]').selectOption('en');
	await page.getByRole('button', { name: 'Create channel' }).click();
	await page.waitForURL(`${APP}/channels/*`);
	const channelUrl = page.url();

	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByRole('button', { name: 'Create invite link' }).click();
	const inviteUrl = (await page.locator('.notice strong').textContent())?.trim();
	expect(inviteUrl).toContain('/invites/');

	// A second user accepts the invite and can post.
	const editorContext = await browser.newContext();
	const editorPage = await editorContext.newPage();
	await devLogin(editorPage, `editor-${RUN}`);
	await editorPage.goto(inviteUrl!);
	await editorPage.getByRole('button', { name: 'Join' }).click();
	await editorPage.waitForURL(`${APP}/channels/*`);
	expect(editorPage.url()).toBe(channelUrl);

	await editorPage.getByRole('link', { name: 'New announcement' }).click();
	await editorPage.locator('textarea[name="body"]').fill('Posted by the invited editor');
	await editorPage.getByRole('button', { name: 'Publish' }).click();
	await editorPage.waitForURL(`${APP}/channels/*`);
	await expect(editorPage.getByText('Posted by the invited editor')).toBeVisible();
	await editorContext.close();

	// The invite is single-use: a third user gets the invalid message.
	const strangerContext = await browser.newContext();
	const strangerPage = await strangerContext.newPage();
	await devLogin(strangerPage, `stranger-${RUN}`);
	await strangerPage.goto(inviteUrl!);
	await expect(strangerPage.getByText('This invite link is invalid', { exact: false })).toBeVisible();
	await strangerContext.close();
});
