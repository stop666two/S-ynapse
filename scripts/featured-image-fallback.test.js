const { describe, it } = require('node:test');
const assert = require('node:assert');
const { markBrokenFeaturedImages } = require('./build/articles');
const { createBrokenMediaMatcher } = require('./lib/content-validate');

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

  it('is tolerant of missing collections', () => {
    const articles = [{ featuredImage: '/media/zero.png' }];
    assert.strictEqual(markBrokenFeaturedImages(articles, null), 0);
    assert.strictEqual(markBrokenFeaturedImages(null, broken), 0);
  });
});
