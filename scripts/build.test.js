const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatDate, safeSlug, escapeAttr, escapeHtml, stripHtml, insertCjkSpacing, applyCjkSpacingToHtml, extractToc, sanitizeHtml, escapeJsonForScript } = require('./lib/utils');

describe('formatDate', () => {
  it('formats date with default format', () => {
    assert.strictEqual(formatDate('2026-07-19', 'YYYY-MM-DD'), '2026-07-19');
  });
  it('formats date with custom format', () => {
    assert.strictEqual(formatDate('2026-07-19', 'YYYY/MM/DD HH:mm'), '2026/07/19');
  });
  it('formats datetime with time', () => {
    assert.strictEqual(formatDate('2026-07-19 14:30', 'YYYY-MM-DD HH:mm'), '2026-07-19 14:30');
  });
  it('returns empty string for null/undefined', () => {
    assert.strictEqual(formatDate(null, 'YYYY-MM-DD'), '');
    assert.strictEqual(formatDate(undefined, 'YYYY-MM-DD'), '');
  });
  it('returns original string for invalid date', () => {
    assert.strictEqual(formatDate('not-a-date', 'YYYY-MM-DD'), 'not-a-date');
  });
});

describe('safeSlug', () => {
  it('converts simple text to slug', () => {
    assert.strictEqual(safeSlug('Hello World'), 'hello-world');
  });
  it('handles Chinese characters', () => {
    assert.ok(safeSlug('你好世界').length > 0);
  });
  it('handles mixed content', () => {
    assert.strictEqual(safeSlug('My Blog Post 2024'), 'my-blog-post-2024');
  });
  it('returns empty string for empty input', () => {
    assert.strictEqual(safeSlug(''), '');
  });
});

describe('escapeAttr', () => {
  it('escapes special characters', () => {
    assert.strictEqual(escapeAttr('<test>"quoted"'), '&lt;test&gt;&quot;quoted&quot;');
  });
  it('returns empty string for non-string input', () => {
    assert.strictEqual(escapeAttr(null), '');
    assert.strictEqual(escapeAttr(undefined), '');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special chars', () => {
    assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert("xss")&lt;/script&gt;');
  });
  it('returns empty string for non-string input', () => {
    assert.strictEqual(escapeHtml(null), '');
  });
});

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    assert.strictEqual(stripHtml('<p>Hello <b>World</b></p>'), 'Hello World');
  });
  it('decodes common entities but not angle brackets', () => {
    const result = stripHtml('<code>&lt;script&gt;alert(1)&lt;/script&gt;</code>');
    assert.ok(result.includes('&lt;'), 'should keep &lt; intact');
    assert.ok(!result.includes('<script>'), 'should not contain raw script tags');
  });
  it('returns empty string for non-string input', () => {
    assert.strictEqual(stripHtml(null), '');
  });
});

describe('insertCjkSpacing', () => {
  it('inserts thin space between Chinese and English', () => {
    const result = insertCjkSpacing('你好World');
    assert.ok(result.includes('\u2009'), 'should contain thin space');
  });
  it('inserts thin space between Chinese and numbers', () => {
    const result = insertCjkSpacing('版本3');
    assert.ok(result.includes('\u2009'), 'should contain thin space');
  });
  it('does not modify pure Chinese', () => {
    assert.strictEqual(insertCjkSpacing('你好世界'), '你好世界');
  });
  it('does not modify pure English', () => {
    assert.strictEqual(insertCjkSpacing('Hello World'), 'Hello World');
  });
});

describe('applyCjkSpacingToHtml', () => {
  it('skips HTML tags while processing text', () => {
    const result = applyCjkSpacingToHtml('<p>你好World</p>');
    assert.ok(result.includes('\u2009'), 'should have thin space between Chinese and English');
    assert.ok(result.includes('<p>'), 'should preserve opening tag');
    assert.ok(result.includes('</p>'), 'should preserve closing tag');
  });
});

describe('extractToc', () => {
  it('extracts h2-h4 headings with anchors', () => {
    const html = '<h2 id="section-1"><a href="#section-1" class="heading-anchor">#</a>Section 1</h2><h3 id="sub-1"><a href="#sub-1" class="heading-anchor">#</a>Sub 1</h3>';
    const toc = extractToc(html);
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[0].level, 2);
    assert.strictEqual(toc[0].id, 'section-1');
    assert.strictEqual(toc[0].text, 'Section 1');
    assert.strictEqual(toc[1].level, 3);
  });
  it('returns empty array for no headings', () => {
    assert.deepStrictEqual(extractToc('<p>No headings</p>'), []);
  });
});

describe('sanitizeHtml', () => {
  it('removes script blocks entirely', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    assert.ok(!out.includes('<script'), 'script tag must be gone');
    assert.ok(!out.includes('alert(1)'), 'script body must be gone');
    assert.ok(out.includes('<p>ok</p>'));
  });
  it('removes iframe/object/embed active content', () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe><object data="x"></object><embed src="y">');
    assert.ok(!out.includes('iframe'));
    assert.ok(!out.includes('object'));
    assert.ok(!out.includes('<embed'));
  });
  it('strips event handler attributes', () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)" onload="f()">');
    assert.ok(!out.includes('onerror'));
    assert.ok(!out.includes('onload'));
    assert.ok(out.includes('src="x"'));
  });
  it('strips style attributes', () => {
    const out = sanitizeHtml('<div style="position:fixed;top:0">x</div>');
    assert.ok(!out.includes('style='));
  });
  it('drops javascript: and data: URIs on href/src', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)" onclick="f()">x</a><img src="data:text/html,x">');
    assert.ok(!out.includes('javascript:'));
    assert.ok(!out.includes('data:'));
    assert.ok(out.includes('<a>x</a>'));
  });
  it('keeps whitelisted tags (dl/table/div/span)', () => {
    const out = sanitizeHtml('<dl><dt>术语</dt><dd>说明</dd></dl><table><tr><td>a</td></tr></table><div class="box">d</div>');
    assert.ok(out.includes('<dl>'));
    assert.ok(out.includes('<dt>术语</dt>'));
    assert.ok(out.includes('<dd>说明</dd>'));
    assert.ok(out.includes('<table>'));
    assert.ok(out.includes('<td>a</td>'));
    assert.ok(out.includes('<div class="box">'));
  });
  it('escapes unknown tags to text', () => {
    const out = sanitizeHtml('<x-widget>t</x-widget>');
    assert.ok(!out.includes('<x-widget>'), 'must not keep raw unknown tag');
    assert.ok(out.includes('&lt;x-widget>t&lt;/x-widget>') || out.includes('&lt;x-widget&gt;'));
  });
  it('return empty string for non-string input', () => {
    assert.strictEqual(sanitizeHtml(null), '');
  });
});

describe('escapeJsonForScript', () => {
  it('escapes < to \\u003c so script tags cannot break out', () => {
    const out = escapeJsonForScript({ title: '</script><script>alert(1)</script>' });
    assert.ok(!out.includes('</script>'), 'must not contain raw closing script tag');
    assert.ok(out.includes('\\u003c/script>'));
  });
  it('keeps normal JSON intact', () => {
    assert.strictEqual(escapeJsonForScript({ a: 1, b: '中文' }), '{"a":1,"b":"中文"}');
  });
});
