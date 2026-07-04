/**
 * The public origin for a channel, derived from the dashboard URL the user is
 * on (`app.X` → `{subdomain}.X`), so it is correct in dev (`app.localhost:5173`)
 * and prod (`app.announcing.app`) without extra configuration.
 */
export function publicChannelOrigin(dashboardUrl: URL, subdomain: string): string {
	return `${dashboardUrl.protocol}//${dashboardUrl.host.replace(/^app\./, `${subdomain}.`)}`;
}
