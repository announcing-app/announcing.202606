import process from 'node:process';
import { defineConfig } from '@playwright/test';

export default defineConfig({
	// One-off infra hangs (cold wrangler dev on a 2-vCPU runner) shouldn't fail
	// the suite; the retry also records a trace for diagnosis.
	retries: process.env.CI ? 2 : 0,
	use: {
		trace: 'on-first-retry',
	},
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		// build + D1 migrate + multi-worker wrangler dev startup exceeds the 60s default in CI
		timeout: 180_000,
	},
	testMatch: '**/*.e2e.{ts,js}',
});
