import type { ChannelMeta, PublicPostView } from './channel';
import { renderBodyHtml } from './richtext';

/**
 * RSS 2.0 / Atom feed rendering for a channel's published posts. Pure string
 * builders so they are unit-testable and cacheable exactly like the public
 * HTML pages (same TTL, same edge cache, no reader tracking).
 */

export interface FeedInput {
	meta: ChannelMeta;
	/** Public origin of the channel without a trailing slash. */
	origin: string;
	posts: PublicPostView[];
}

export function escapeXml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll('\'', '&apos;');
}

const TITLE_MAX = 80;

/** Posts have no title field; feeds use the first line of the body, truncated. */
export function postTitle(body: string): string {
	const line = body.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? '';
	return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1)}…` : line;
}

/** Feed readers ignore pre-wrap styling, so newlines become explicit <br>. */
function postHtml(origin: string, post: PublicPostView): string {
	let html = renderBodyHtml(post.body).replaceAll('\n', '<br>');
	for (const imageId of post.imageIds)
		html += `<p><img src="${origin}/i/${imageId}" alt=""></p>`;
	return html;
}

function postUrl(origin: string, post: PublicPostView): string {
	return `${origin}/p/${post.id}`;
}

/** The instant a feed's content last changed (publications and later edits). */
function lastChangedAt({ meta, posts }: FeedInput): number {
	return posts.reduce((max, p) => Math.max(max, p.publishedAt, p.updatedAt ?? 0), meta.createdAt);
}

export function buildRssXml(input: FeedInput): string {
	const { meta, origin, posts } = input;
	const items = posts.map(post => `		<item>
			<title>${escapeXml(postTitle(post.body))}</title>
			<link>${escapeXml(postUrl(origin, post))}</link>
			<guid isPermaLink="true">${escapeXml(postUrl(origin, post))}</guid>
			<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
			<description>${escapeXml(postHtml(origin, post))}</description>
		</item>`);
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>${escapeXml(meta.name)}</title>
		<link>${escapeXml(origin)}/</link>
		<description>${escapeXml(meta.description)}</description>
		<language>${escapeXml(meta.locale)}</language>
		<lastBuildDate>${new Date(lastChangedAt(input)).toUTCString()}</lastBuildDate>
		<atom:link href="${escapeXml(origin)}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
	</channel>
</rss>
`;
}

export function buildAtomXml(input: FeedInput): string {
	const { meta, origin, posts } = input;
	const entries = posts.map(post => `	<entry>
		<id>${escapeXml(postUrl(origin, post))}</id>
		<title>${escapeXml(postTitle(post.body))}</title>
		<link href="${escapeXml(postUrl(origin, post))}"/>
		<published>${new Date(post.publishedAt).toISOString()}</published>
		<updated>${new Date(Math.max(post.publishedAt, post.updatedAt ?? 0)).toISOString()}</updated>
		<content type="html">${escapeXml(postHtml(origin, post))}</content>
	</entry>`);
	return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(meta.locale)}">
	<id>${escapeXml(origin)}/</id>
	<title>${escapeXml(meta.name)}</title>
	<subtitle>${escapeXml(meta.description)}</subtitle>
	<link href="${escapeXml(origin)}/"/>
	<link href="${escapeXml(origin)}/atom.xml" rel="self" type="application/atom+xml"/>
	<updated>${new Date(lastChangedAt(input)).toISOString()}</updated>
	<author><name>${escapeXml(meta.name)}</name></author>
${entries.join('\n')}
</feed>
`;
}
