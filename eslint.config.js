import antfu from '@antfu/eslint-config';

// Single, type-aware flat config for the whole monorepo.
// @antfu/eslint-config provides both linting and formatting (no Prettier), per docs/PLAN.md.
// Stylistic options are tuned to the SvelteKit convention the scaffold uses: tabs + semicolons.
export default antfu(
	{
		type: 'app',
		typescript: true,
		svelte: true,
		pnpm: false,
		stylistic: {
			indent: 'tab',
			quotes: 'single',
			semi: true,
		},
		ignores: [
			'**/.svelte-kit/**',
			'**/build/**',
			'**/dist/**',
			'**/.wrangler/**',
			'**/worker-configuration.d.ts',
			'apps/web/src/lib/paraglide/**',
			'pnpm-lock.yaml',
			'**/*.md',
		],
	},
	{
		rules: {
			// Key order in tsconfig/wrangler is intentional (and sorting would scramble JSONC comments).
			'jsonc/sort-keys': 'off',
		},
	},
	{
		files: ['**/*.svelte'],
		rules: {
			// The app maps hosts to route groups in `reroute` (app.X → /app/*,
			// {channel}.X → /c/{channel}/*). Browser-facing hrefs are public paths,
			// not internal route ids, so kit's resolve() would produce wrong URLs.
			'svelte/no-navigation-without-resolve': 'off',
		},
	},
);
