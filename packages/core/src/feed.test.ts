import type { FeedInput } from './feed';
import { describe, expect, it } from 'vitest';
import { buildAtomXml, buildRssXml, escapeXml, postTitle } from './feed';

const input: FeedInput = {
	meta: {
		channelId: 'ch_1',
		subdomain: 'city',
		region: 'apac',
		name: 'City <News>',
		description: 'Announcements & alerts',
		locale: 'ja',
		createdAt: Date.UTC(2026, 0, 1),
	},
	origin: 'https://city.announcing.app',
	posts: [
		{
			id: '01hzzzzzzzzzzzzzzzzzzzzzzz',
			body: 'Road closed <tomorrow>\nDetails: https://example.com/road',
			imageIds: ['01hyyyyyyyyyyyyyyyyyyyyyyy'],
			publishedAt: Date.UTC(2026, 5, 2, 12, 0, 0),
			updatedAt: Date.UTC(2026, 5, 3, 9, 30, 0),
		},
		{
			id: '01hxxxxxxxxxxxxxxxxxxxxxxx',
			body: 'Festival on Sunday',
			imageIds: [],
			publishedAt: Date.UTC(2026, 5, 1, 8, 0, 0),
			updatedAt: null,
		},
	],
};

describe('escapeXml', () => {
	it('escapes the five XML metacharacters', () => {
		expect(escapeXml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
	});
});

describe('postTitle', () => {
	it('uses the first non-empty line', () => {
		expect(postTitle('\n\n  Hello world  \nsecond line')).toBe('Hello world');
	});

	it('truncates long lines with an ellipsis', () => {
		const title = postTitle('あ'.repeat(200));
		expect(title.length).toBe(80);
		expect(title.endsWith('…')).toBe(true);
	});

	it('is empty for an empty body', () => {
		expect(postTitle('')).toBe('');
	});
});

describe('buildRssXml', () => {
	const xml = buildRssXml(input);

	it('produces an RSS 2.0 document with channel metadata escaped', () => {
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(xml).toContain('<rss version="2.0"');
		expect(xml).toContain('<title>City &lt;News&gt;</title>');
		expect(xml).toContain('<description>Announcements &amp; alerts</description>');
		expect(xml).toContain('<language>ja</language>');
		expect(xml).toContain('<atom:link href="https://city.announcing.app/rss.xml" rel="self"');
	});

	it('renders one item per post with permalink guid and RFC-822 pubDate', () => {
		expect(xml.match(/<item>/g)).toHaveLength(2);
		expect(xml).toContain('<guid isPermaLink="true">https://city.announcing.app/p/01hzzzzzzzzzzzzzzzzzzzzzzz</guid>');
		expect(xml).toContain('<pubDate>Tue, 02 Jun 2026 12:00:00 GMT</pubDate>');
	});

	it('embeds the escaped HTML body with <br> newlines, links and images', () => {
		// The body's own `<tomorrow>` was HTML-escaped first, then XML-escaped.
		expect(xml).toContain('Road closed &amp;lt;tomorrow&amp;gt;&lt;br&gt;');
		expect(xml).toContain(escapeXml('<a href="https://example.com/road"'));
		expect(xml).toContain(escapeXml('<img src="https://city.announcing.app/i/01hyyyyyyyyyyyyyyyyyyyyyyy"'));
		// Raw post HTML must never appear unescaped inside the XML.
		expect(xml).not.toContain('<br>');
		expect(xml).not.toContain('<img ');
	});

	it('derives lastBuildDate from the newest publication or edit', () => {
		expect(xml).toContain(`<lastBuildDate>${new Date(Date.UTC(2026, 5, 3, 9, 30, 0)).toUTCString()}</lastBuildDate>`);
	});
});

describe('buildAtomXml', () => {
	const xml = buildAtomXml(input);

	it('produces an Atom document with feed metadata', () => {
		expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">');
		expect(xml).toContain('<title>City &lt;News&gt;</title>');
		expect(xml).toContain('<link href="https://city.announcing.app/atom.xml" rel="self"');
		expect(xml).toContain('<updated>2026-06-03T09:30:00.000Z</updated>');
	});

	it('renders entries with published/updated timestamps and html content', () => {
		expect(xml.match(/<entry>/g)).toHaveLength(2);
		expect(xml).toContain('<id>https://city.announcing.app/p/01hxxxxxxxxxxxxxxxxxxxxxxx</id>');
		expect(xml).toContain('<published>2026-06-02T12:00:00.000Z</published>');
		expect(xml).toContain('<content type="html">');
		// An entry without edits reuses publishedAt as updated.
		expect(xml).toContain('<updated>2026-06-01T08:00:00.000Z</updated>');
	});
});
