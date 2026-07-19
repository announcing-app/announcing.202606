/**
 * Post bodies are plain text with auto-linked URLs (no Markdown, by design).
 * `renderBodyHtml` is the single place untrusted text becomes HTML: everything
 * is entity-escaped, and only http(s) URLs matched here become anchors.
 * Newlines are preserved by rendering inside `white-space: pre-wrap`.
 */

// URLs stop at whitespace, HTML-sensitive chars and CJK punctuation/fullwidth
// forms (U+3001–U+303F, U+FF01–U+FF65; U+3000 is whitespace, covered by \s) so
// Japanese prose around a URL is not swallowed — while CJK ideographs
// themselves stay allowed (e.g. Wikipedia paths pasted unencoded).
// eslint-disable-next-line regexp/no-obscure-range -- whole Unicode blocks (CJK punctuation, fullwidth forms) are intentional
const URL_RE = /https?:\/\/[^\s<>"'`、-〿！-･]+/g;

const TRAILING = new Set(['.', ',', '!', '?', ';', ':', '\'', '"', ']', '}', '>']);

function trimUrl(url: string): string {
	let end = url.length;
	while (end > 0) {
		const ch = url[end - 1]!;
		if (TRAILING.has(ch)) {
			end--;
			continue;
		}
		if (ch === ')') {
			// Keep ')' that closes a '(' inside the URL: en.wikipedia.org/wiki/A_(b)
			const kept = url.slice(0, end);
			const opens = kept.split('(').length - 1;
			const closes = kept.split(')').length - 1;
			if (closes > opens) {
				end--;
				continue;
			}
		}
		break;
	}
	return url.slice(0, end);
}

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll('\'', '&#39;');
}

/** Escape a plain-text post body and turn bare http(s) URLs into anchors. */
export function renderBodyHtml(body: string): string {
	let html = '';
	let cursor = 0;
	for (const match of body.matchAll(URL_RE)) {
		const url = trimUrl(match[0]);
		if (match.index < cursor || url.length === 0)
			continue;
		html += escapeHtml(body.slice(cursor, match.index));
		const escaped = escapeHtml(url);
		html += `<a href="${escaped}" target="_blank" rel="nofollow noopener noreferrer ugc">${escaped}</a>`;
		cursor = match.index + url.length;
	}
	html += escapeHtml(body.slice(cursor));
	return html;
}
