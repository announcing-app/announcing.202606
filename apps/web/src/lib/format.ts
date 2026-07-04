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

/**
 * Epoch ms → `datetime-local` input value in the *device's* timezone.
 * Client-only (call after mount): the server must not bake its own timezone
 * into markup.
 */
export function toDatetimeLocalValue(ts: number): string {
	const d = new Date(ts);
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
