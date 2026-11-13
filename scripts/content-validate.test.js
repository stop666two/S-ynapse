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

  // 审查 R-31：产物变体是 media/<dir>/<name>-<width>.<ext>（构建不产出 variants/ 目录）。
  // 旧断言把 /media/variants/… 钉为 true，而那类路径永远不会存在。
  it('accepts generated variant paths in the real output layout', () => {
    assert.strictEqual(resolver('/media/test-photo-1-640.webp'), true);
    assert.strictEqual(resolver('/media/test-photo-1-1920.avif'), true);
    assert.strictEqual(resolver('/media/sub/nested-640.webp'), true);
    assert.strictEqual(resolver('/media/unknown-640.webp'), false);
    assert.strictEqual(resolver('/media/variants/test-photo-1-640.webp'), false);
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
    assert.strictEqual(r.errors[0].critical, true);
    assert.ok(r.errors[0].message.includes('articles/en/a.md'));
    assert.ok(r.errors[0].message.includes('articles/en/b.md'));
  });

  it('marks every slug identity problem as critical (never degradable)', () => {
    const cases = [
      base({ file: 'articles/en/bad.md', attrs: { title: 'T', slug: '../escape' } }),
      base({ file: 'articles/en/route.md', attrs: { title: 'T', slug: 'tags' } }),
      base({ file: 'articles/en/dev.md', attrs: { title: 'T', slug: 'CON' } }),
      base({ file: 'articles/en/huge.md', attrs: { title: 'T', slug: 'x'.repeat(121) } })
    ];
    for (const item of cases) {
      const r = preflightArticles([item], { mediaExists });
      assert.strictEqual(r.errors.length, 1, item.file + ' 必须产出 1 条错误');
      assert.strictEqual(r.errors[0].stage, 'slug', item.file + ' 错误类别必须是 slug');
      assert.strictEqual(r.errors[0].critical, true, item.file + ' 的 slug 错误必须标记 critical');
    }
  });

  it('allows the same slug in different languages', () => {
    const r = preflightArticles([
      base({ file: 'articles/en/a.md', attrs: { title: 'Same' } }),
      base({ file: 'articles/zh/a.md', lang: 'zh', attrs: { title: 'Same' } })
    ], { mediaExists });
    assert.deepStrictEqual(r.errors, []);
  });

  // 审查 R-27：保留路由段与去重键必须大小写不敏感。Windows/macOS 的文件系统不区分大小写，
  // slug: Tags 会写进生成的 dist/<lang>/tags/ 目录并覆盖标签页，Hello/hello 互相覆盖。
  it('rejects reserved route segments regardless of slug case', () => {
    const cases = [['Tags', '/en/tags/'], ['TAGS', '/en/tags/'], ['Search', '/en/search/'], ['ASSETS', '/en/assets/']];
    for (const [slug, route] of cases) {
      const r = preflightArticles([
        base({ file: 'articles/en/route.md', attrs: { title: 'T', slug } })
      ], { mediaExists });
      assert.strictEqual(r.errors.length, 1, slug + ' 必须产出 1 条错误');
      assert.strictEqual(r.errors[0].stage, 'slug', slug + ' 错误类别必须是 slug');
      assert.strictEqual(r.errors[0].critical, true, slug + ' 的 slug 错误必须标记 critical');
      assert.ok(r.errors[0].message.includes('"' + slug + '"'), slug + ' 错误必须回显原 slug');
      assert.ok(r.errors[0].message.includes(route), slug + ' 错误必须指明冲突的 ' + route + ' 目录');
    }
  });

  it('treats slugs differing only in case as duplicates and names both files', () => {
    const r = preflightArticles([
      base({ file: 'articles/en/a.md', attrs: { title: 'T', slug: 'Hello' } }),
      base({ file: 'articles/en/b.md', attrs: { title: 'T', slug: 'hello' } })
    ], { mediaExists });
    assert.strictEqual(r.errors.length, 1);
    assert.strictEqual(r.errors[0].stage, 'slug');
    assert.strictEqual(r.errors[0].critical, true);
    assert.ok(r.errors[0].message.includes('articles/en/a.md'), '必须指明先占用 slug 的文件');
    assert.ok(r.errors[0].message.includes('articles/en/b.md'), '必须指明冲突文件的自身路径');
    assert.ok(/case-insensitive/i.test(r.errors[0].message));
  });

  // 审查 R-07：站内 /media/ 之外的外链封面由渲染侧回退与 CSP img-src 处理，
  // 参与存在性校验会以非 critical 的 media 错误让普通构建（无 --allow-degraded）硬失败。
  it('does not run media existence checks on off-site featuredImage URLs', () => {
    const cases = [
      'https://cdn.example.com/a.png',
      'http://cdn.example.com/a.png',
      '//cdn.example.com/a.png'
    ];
    for (const featuredImage of cases) {
      const r = preflightArticles([base({ attrs: { title: 'A', featuredImage } })], { mediaExists });
      assert.deepStrictEqual(r.errors, [], featuredImage + ' 不得产出预校验错误');
    }
  });

  it('still reports a missing on-site featuredImage', () => {
    const r = preflightArticles([
      base({ attrs: { title: 'A', featuredImage: '/media/absent.webp' } })
    ], { mediaExists });
    assert.strictEqual(r.errors.length, 1);
    assert.strictEqual(r.errors[0].stage, 'media');
    assert.ok(r.errors[0].message.includes('/media/absent.webp'));
  });

  it('flags invalid dates', () => {
    const r = preflightArticles([base({ attrs: { title: 'A', date: 'not-a-date' } })], { mediaExists });
    assert.strictEqual(r.errors.length, 1);
    assert.strictEqual(r.errors[0].stage, 'date');
    assert.strictEqual(r.errors[0].critical, false);
  });

  it('flags empty tag and category entries', () => {
    const r = preflightArticles([
      base({ file: 'articles/en/t.md', attrs: { title: 'T', tags: ['ok', '  '] } }),
      base({ file: 'articles/en/c.md', attrs: { title: 'C', categories: [''] } })
    ], { mediaExists });
    assert.strictEqual(r.errors.length, 2);
    assert.ok(r.errors.every((e) => e.stage === 'taxonomy'));
    assert.ok(r.errors.every((e) => e.critical === false));
  });

  it('flags missing media in featuredImage and body, but not in code fences', () => {
    const r = preflightArticles([
      base({ file: 'articles/en/m1.md', attrs: { title: 'M1', featuredImage: '/media/nope.jpg' } }),
      base({ file: 'articles/en/m2.md', attrs: { title: 'M2' }, body: '![x](/media/nope2.png)' }),
      base({ file: 'articles/en/m3.md', attrs: { title: 'M3' }, body: '```\n![x](/media/nope3.png)\n```' })
    ], { mediaExists });
    assert.strictEqual(r.errors.length, 2);
    assert.ok(r.errors.every((e) => e.stage === 'media'));
    assert.ok(r.errors.every((e) => e.critical === false));
    assert.ok(r.errors[0].message.includes('/media/nope.jpg'));
    assert.ok(r.errors[1].message.includes('/media/nope2.png'));
  });
});
