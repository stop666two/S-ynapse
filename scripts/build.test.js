const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatDate, safeSlug, escapeAttr, escapeHtml, stripHtml, insertCjkSpacing, applyCjkSpacingToHtml, extractToc } = require('./lib/utils');

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
