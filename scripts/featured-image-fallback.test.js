const { describe, it } = require('node:test');
const assert = require('node:assert');
const { markBrokenFeaturedImages } = require('./build/articles');
const { createBrokenMediaMatcher, collectBrokenMediaRefs } = require('./lib/content-validate');

describe('createBrokenMediaMatcher', () => {
  it('matches exact refs, query/hash variants and generated variant names', () => {
    const match = createBrokenMediaMatcher(['/media/broken.png']);
    assert.strictEqual(match('/media/broken.png'), true);
    assert.strictEqual(match('/media/broken.png?v=123'), true);
    assert.strictEqual(match('/media/broken-640.webp'), true);
    assert.strictEqual(match('/media/broken-1920.avif'), true);
    assert.strictEqual(match('/media/healthy.png'), false);
    assert.strictEqual(match('/media/broken.png2'), false);
    assert.strictEqual(match(''), false);
  });

  it('normalizes windows separators and deduplicates mixed input shapes', () => {
    const match = createBrokenMediaMatcher(new Set(['media\\broken.png']));
    assert.strictEqual(match('/media/broken.png'), true);
  });
});

describe('collectBrokenMediaRefs', () => {
  it('把内容策略拦截的 media/ 路径并入损坏引用，忽略 assets/videos', () => {
    const refs = collectBrokenMediaRefs([], [
      { path: 'media/blocked.html', reason: 'active-document' },
      { path: 'media/unsafe.svg', reason: 'svg-unsafe' },
      { path: 'assets/notes.txt', reason: 'not-in-asset-whitelist' },
      { path: 'videos/clip.mp4', reason: '' }
    ]);
    assert.ok(refs.has('/media/blocked.html'));
    assert.ok(refs.has('/media/unsafe.svg'));
    assert.strictEqual(refs.size, 2);
    const match = createBrokenMediaMatcher(refs);
    assert.strictEqual(match('/media/blocked.html'), true);
    assert.strictEqual(match('/media/unsafe.svg?v=1'), true);
    assert.strictEqual(match('/media/ok.png'), false);
  });

  it('与 sharp 失败清单并集去重，跨平台分隔符归一化', () => {
    const refs = collectBrokenMediaRefs(new Set(['/media/zero.png']), [
      { path: 'media\\zero.png', reason: '' },
      { path: '/media/other.webp', reason: '' }
    ]);
    assert.deepEqual([...refs].sort(), ['/media/other.webp', '/media/zero.png']);
  });

  it('容忍缺失或畸形输入', () => {
    assert.strictEqual(collectBrokenMediaRefs(null, null).size, 0);
    assert.strictEqual(collectBrokenMediaRefs(undefined, [{ reason: 'only-reason' }]).size, 0);
    assert.strictEqual(collectBrokenMediaRefs([], [null, 42, 'media/plain.png']).size, 1);
  });
});

describe('markBrokenFeaturedImages', () => {
  const broken = new Set(['/media/zero.png', '/media/truncated.jpg']);

  it('clears the featured image, keeps the original ref for reporting and counts hits', () => {
    const articles = [{ featuredImage: '/media/zero.png' }];
    const count = markBrokenFeaturedImages(articles, broken);
    assert.strictEqual(count, 1);
    assert.strictEqual(articles[0].featuredImage, '');
    assert.strictEqual(articles[0].featuredImageBroken, '/media/zero.png');
  });

  it('leaves healthy covers and cover-less articles untouched', () => {
    const articles = [
      { featuredImage: '/media/healthy.png' },
      { featuredImage: '' },
      {}
    ];
    const count = markBrokenFeaturedImages(articles, broken);
    assert.strictEqual(count, 0);
    assert.strictEqual(articles[0].featuredImage, '/media/healthy.png');
    assert.strictEqual(articles[0].featuredImageBroken, undefined);
  });

  it('handles external urls and variant refs without false positives', () => {
    const articles = [
      { featuredImage: 'https://cdn.example.com/media/zero.png' },
      { featuredImage: '/media/truncated-640.webp' }
    ];
    const count = markBrokenFeaturedImages(articles, broken);
    assert.strictEqual(articles[0].featuredImage, 'https://cdn.example.com/media/zero.png');
    assert.strictEqual(count, 1);
    assert.strictEqual(articles[1].featuredImageBroken, '/media/truncated-640.webp');
  });

  it('被策略拦截的头图与 sharp 失败同语义：清空并保留原引用', () => {
    const articles = [{ featuredImage: '/media/blocked.html' }];
    const refs = collectBrokenMediaRefs([], [{ path: 'media/blocked.html', reason: 'active-document' }]);
    const count = markBrokenFeaturedImages(articles, refs);
    assert.strictEqual(count, 1);
    assert.strictEqual(articles[0].featuredImage, '');
    assert.strictEqual(articles[0].featuredImageBroken, '/media/blocked.html');
  });

  it('is tolerant of missing collections', () => {
    const articles = [{ featuredImage: '/media/zero.png' }];
    assert.strictEqual(markBrokenFeaturedImages(articles, null), 0);
    assert.strictEqual(markBrokenFeaturedImages(null, broken), 0);
  });
});
