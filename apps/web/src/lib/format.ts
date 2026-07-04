/**
 * Timestamps are rendered in UTC everywhere so SSR output is stable (public
 * pages are edge-cached; readers may be in any timezone) and hydration never
 * mismatches.
 */
export function formatDate(ts: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'UTC',
	}).format(new Date(ts));
}
