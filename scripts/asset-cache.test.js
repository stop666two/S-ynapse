const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildCacheKey, configFingerprint, isFresh, getFresh, updateEntry, pruneTo } = require('./lib/asset-cache');

describe('asset-cache buildCacheKey', () => {
  it('is deterministic for the same stats and config', () => {
    const stats = { mtimeMs: 1700000000123.9, size: 4096 };
    assert.strictEqual(buildCacheKey(stats, 'abc'), buildCacheKey(stats, 'abc'));
    assert.strictEqual(buildCacheKey(stats, 'abc'), '1700000000123:4096:abc');
  });

  it('changes when mtime, size or config changes', () => {
    const stats = { mtimeMs: 1700000000000, size: 1 };
    assert.notStrictEqual(buildCacheKey(stats, 'a'), buildCacheKey({ mtimeMs: 1700000000001, size: 1 }, 'a'));
    assert.notStrictEqual(buildCacheKey(stats, 'a'), buildCacheKey({ mtimeMs: 1700000000000, size: 2 }, 'a'));
    assert.notStrictEqual(buildCacheKey(stats, 'a'), buildCacheKey(stats, 'b'));
  });

  it('tolerates missing or invalid stats', () => {
    assert.strictEqual(buildCacheKey(null, 'x'), '0:0:x');
    assert.strictEqual(buildCacheKey({ mtimeMs: NaN, size: 'nope' }, ''), '0:0:');
  });
});

describe('asset-cache configFingerprint', () => {
  it('is stable for equal inputs and changes with content', () => {
    const a = configFingerprint([{ sizes: [640, 1024], formats: ['webp'] }, 'v1']);
    const b = configFingerprint([{ sizes: [640, 1024], formats: ['webp'] }, 'v1']);
    const c = configFingerprint([{ sizes: [640, 1024], formats: ['avif'] }, 'v1']);
    assert.strictEqual(a, b);
    assert.notStrictEqual(a, c);
    assert.strictEqual(a.length, 10);
  });
});

describe('asset-cache freshness helpers', () => {
  it('isFresh compares the stored key', () => {
    const cache = { 'media/a.jpg': 'k1' };
    assert.strictEqual(isFresh(cache, 'media/a.jpg', 'k1'), true);
    assert.strictEqual(isFresh(cache, 'media/a.jpg', 'k2'), false);
    assert.strictEqual(isFresh(cache, 'media/missing.jpg', 'k1'), false);
    assert.strictEqual(isFresh(null, 'media/a.jpg', 'k1'), false);
  });

  it('updateEntry stores and returns the same cache object', () => {
    const cache = {};
    assert.strictEqual(updateEntry(cache, 'media/a.jpg', 'k1'), cache);
    assert.strictEqual(cache['media/a.jpg'], 'k1');
  });

  it('getFresh returns the stored record only when the key matches', () => {
    const cache = { a: { key: 'k1', entry: { x: 1 } } };
    assert.deepStrictEqual(getFresh(cache, 'a', 'k1'), { key: 'k1', entry: { x: 1 } });
    assert.strictEqual(getFresh(cache, 'a', 'k2'), null);
    assert.strictEqual(getFresh(cache, 'b', 'k1'), null);
    assert.strictEqual(getFresh(null, 'a', 'k1'), null);
  });

  it('pruneTo drops entries that no longer exist', () => {
    const cache = { a: '1', b: '2', c: '3' };
    pruneTo(cache, ['a', 'c']);
    assert.deepStrictEqual(Object.keys(cache).sort(), ['a', 'c']);
  });
});
