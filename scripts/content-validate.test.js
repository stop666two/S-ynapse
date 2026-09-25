const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  extractMediaRefs,
  createMediaResolver,
  resolveArticleIdentity,
  preflightArticles
} = require('./lib/content-validate');

describe('extractMediaRefs', () => {
  it('finds /media references in markdown and inline html', () => {
    const body = '![x](/media/a.jpg)\n<img src="/media/sub/b.png" alt="y">';
    assert.deepStrictEqual(extractMediaRefs(body), ['/media/a.jpg', '/media/sub/b.png']);
  });

  it('ignores references inside fenced code blocks and inline code', () => {
    const body = [
      '```html',
      '<img src="/media/inside-fence.jpg">',
      '```',
      'see `/media/inside-inline.jpg`',
      'real: ![x](/media/real.jpg)'
    ].join('\n');
    assert.deepStrictEqual(extractMediaRefs(body), ['/media/real.jpg']);
  });

  it('deduplicates repeated references', () => {
    const body = '![a](/media/a.jpg) ![b](/media/a.jpg)';
    assert.deepStrictEqual(extractMediaRefs(body), ['/media/a.jpg']);
  });

  it('ignores non-media paths and absolute urls', () => {
    const body = '![a](https://cdn.example.com/media/a.jpg) ![b](/assets/file.zip) [c](/media)';
    assert.deepStrictEqual(extractMediaRefs(body), []);
  });
});

describe('createMediaResolver', () => {
  const resolver = createMediaResolver(['test-photo-1.jpg', 'sub/nested.webp']);

  it('accepts existing source files (exact, case-sensitive)', () => {
    assert.strictEqual(resolver('/media/test-photo-1.jpg'), true);
    assert.strictEqual(resolver('/media/sub/nested.webp'), true);
    assert.strictEqual(resolver('/media/Test-Photo-1.jpg'), false);
  });

  it('accepts generated variant paths when the source stem exists', () => {
    assert.strictEqual(resolver('/media/variants/test-photo-1-640.webp'), true);
    assert.strictEqual(resolver('/media/variants/test-photo-1-1920.avif'), true);
    assert.strictEqual(resolver('/media/variants/unknown-640.webp'), false);
  });

  it('rejects missing files and malformed refs', () => {
    assert.strictEqual(resolver('/media/missing.jpg'), false);
    assert.strictEqual(resolver('/media/'), false);
    assert.strictEqual(resolver(''), false);
  });
});

describe('resolveArticleIdentity', () => {
  it('prefers frontmatter title and derives slug from it', () => {
    assert.deepStrictEqual(
      resolveArticleIdentity({ title: 'Hello World' }, 'body', 'file.md'),
      { title: 'Hello World', slug: 'hello-world', explicitSlugInvalid: false }
    );
  });

  it('validates an explicit frontmatter slug', () => {
    const ok = resolveArticleIdentity({ title: 'T', slug: 'my-slug_1' }, '', 'file.md');
    assert.strictEqual(ok.slug, 'my-slug_1');
    assert.strictEqual(ok.explicitSlugInvalid, false);
    const bad = resolveArticleIdentity({ title: 'T', slug: '../escape' }, '', 'file.md');
    assert.strictEqual(bad.explicitSlugInvalid, true);
  });

  it('falls back to the first h1 and then to the filename', () => {
    assert.deepStrictEqual(
      resolveArticleIdentity({}, '# From H1\n\ntext', 'file.md'),
      { title: 'From H1', slug: 'from-h1', explicitSlugInvalid: false }
    );
    assert.deepStrictEqual(
      resolveArticleIdentity({}, 'no heading', 'fallback-name.md'),
      { title: 'fallback-name', slug: 'fallback-name', explicitSlugInvalid: false }
    );
  });
});

describe('preflightArticles', () => {
  const mediaExists = createMediaResolver(['photo.jpg']);
  const base = (over) => Object.assign({ file: 'articles/en/a.md', lang: 'en', attrs: { title: 'A' }, body: '' }, over || {});

  it('returns no errors for clean items', () => {
    const r = preflightArticles([base()], { mediaExists });
    assert.deepStrictEqual(r.errors, []);
  });

  it('flags duplicate slugs within a language and names both files', () => {
    const r = preflightArticles([
      base({ file: 'articles/en/a.md', attrs: { title: 'Same' } }),
      base({ file: 'articles/en/b.md', attrs: { title: 'Same' } })
    ], { mediaExists });
    assert.strictEqual(r.errors.length, 1);
    assert.strictEqual(r.errors[0].stage, 'slug');
    assert.ok(r.errors[0].message.includes('articles/en/a.md'));
    assert.ok(r.errors[0].message.includes('articles/en/b.md'));
  });

  it('allows the same slug in different languages', () => {
    const r = preflightArticles([
      base({ file: 'articles/en/a.md', attrs: { title: 'Same' } }),
      base({ file: 'articles/zh/a.md', lang: 'zh', attrs: { title: 'Same' } })
    ], { mediaExists });
    assert.deepStrictEqual(r.errors, []);
  });

  it('flags invalid dates', () => {
    const r = preflightArticles([base({ attrs: { title: 'A', date: 'not-a-date' } })], { mediaExists });
    assert.strictEqual(r.errors.length, 1);
    assert.strictEqual(r.errors[0].stage, 'date');
  });

  it('flags empty tag and category entries', () => {
    const r = preflightArticles([
      base({ file: 'articles/en/t.md', attrs: { title: 'T', tags: ['ok', '  '] } }),
      base({ file: 'articles/en/c.md', attrs: { title: 'C', categories: [''] } })
    ], { mediaExists });
    assert.strictEqual(r.errors.length, 2);
    assert.ok(r.errors.every((e) => e.stage === 'taxonomy'));
  });

  it('flags missing media in featuredImage and body, but not in code fences', () => {
    const r = preflightArticles([
      base({ file: 'articles/en/m1.md', attrs: { title: 'M1', featuredImage: '/media/nope.jpg' } }),
      base({ file: 'articles/en/m2.md', attrs: { title: 'M2' }, body: '![x](/media/nope2.png)' }),
      base({ file: 'articles/en/m3.md', attrs: { title: 'M3' }, body: '```\n![x](/media/nope3.png)\n```' })
    ], { mediaExists });
    assert.strictEqual(r.errors.length, 2);
    assert.ok(r.errors.every((e) => e.stage === 'media'));
    assert.ok(r.errors[0].message.includes('/media/nope.jpg'));
    assert.ok(r.errors[1].message.includes('/media/nope2.png'));
  });
});
