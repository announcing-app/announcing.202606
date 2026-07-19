import { describe, expect, it } from 'vitest';
import { renderBodyHtml } from './richtext';

describe('renderBodyHtml', () => {
	it('escapes HTML in plain text', () => {
		expect(renderBodyHtml('<script>alert("x")</script> & <b>'))
			.toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;b&gt;');
	});

	it('links a bare URL', () => {
		expect(renderBodyHtml('see https://example.com/a?b=c ok')).toBe(
			'see <a href="https://example.com/a?b=c" target="_blank" rel="nofollow noopener noreferrer ugc">https://example.com/a?b=c</a> ok',
		);
	});

	it('does not link non-http schemes', () => {
		const out = renderBodyHtml('javascript:alert(1) ftp://x mailto:a@b');
		expect(out).not.toContain('<a ');
	});

	it('escapes HTML metacharacters and stops URLs at quotes', () => {
		const out = renderBodyHtml('https://example.com/"><img src=x onerror=alert(1)>');
		expect(out).toContain('href="https://example.com/"');
		expect(out).not.toContain('<img');
	});

	it('trims trailing ASCII punctuation', () => {
		expect(renderBodyHtml('go to https://example.com.')).toContain('href="https://example.com"');
		expect(renderBodyHtml('(see https://example.com)')).toContain('href="https://example.com"');
	});

	it('keeps balanced parentheses inside the URL', () => {
		expect(renderBodyHtml('https://en.wikipedia.org/wiki/A_(b)'))
			.toContain('href="https://en.wikipedia.org/wiki/A_(b)"');
	});

	it('stops at Japanese punctuation but keeps CJK path characters', () => {
		const out = renderBodyHtml('詳細はhttps://ja.wikipedia.org/wiki/東京。次の文');
		expect(out).toContain('href="https://ja.wikipedia.org/wiki/東京"');
		expect(out).toContain('。次の文');
		expect(renderBodyHtml('「https://example.com」を見て'))
			.toContain('href="https://example.com"');
	});

	it('handles multiple URLs and preserves newlines', () => {
		const out = renderBodyHtml('a https://one.example\nb https://two.example\n');
		expect(out).toContain('href="https://one.example"');
		expect(out).toContain('href="https://two.example"');
		expect(out).toContain('\n');
	});
});
