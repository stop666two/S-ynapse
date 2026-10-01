'use strict';
// 搜索索引构建库单测（scripts/lib/search-index.js）：配置归一化、索引构建、体积裁剪、内容寻址与媒体路径预计算。
// 运行：node --test scripts/search-index.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');

const CORE_PATH = path.join(__dirname, '..', 'js', 'domains', 'features', 'search-core.js');
let core = null;
async function loadCore() {
  if (!core) core = await import(pathToFileURL(CORE_PATH).href);
  return core;
}
const lib = require('./lib/search-index.js');

const SAMPLE_DOCS = [
  {
    title: '搜索升级实战',
    url: '/zh/a/',
    excerpt: '倒排索引与 vue3 检索',
    content: 'bigram 分词把中文切成二元组',
    featuredImage: '',
    tags: ['搜索', 'JavaScript'],
    categories: ['技术'],
    lang: 'zh'
  },
  {
    title: 'Site Building Notes',
    url: '/zh/b/',
    excerpt: 'series hub pages',
    content: 'building a static site',
    featuredImage: '/media/pic.jpg',
    tags: ['series'],
    categories: ['build'],
    lang: 'zh'
  }
];

test('searchIndexOptions：默认 bigram=true / maxGzipKb=60，非法值回退', () => {
  assert.deepStrictEqual(lib.searchIndexOptions({}), { bigram: true, maxGzipKb: 60 });
  assert.deepStrictEqual(lib.searchIndexOptions({ search: { index: { bigram: false, maxGzipKb: 10 } } }), { bigram: false, maxGzipKb: 10 });
  assert.deepStrictEqual(lib.searchIndexOptions({ search: { index: { maxGzipKb: 0 } } }), { bigram: true, maxGzipKb: 60 });
  assert.deepStrictEqual(lib.searchIndexOptions({ search: { index: { maxGzipKb: 'abc' } } }), { bigram: true, maxGzipKb: 60 });
  assert.deepStrictEqual(lib.searchIndexOptions({ search: { index: null } }), { bigram: true, maxGzipKb: 60 });
});

test('buildLanguageIndex：字段索引、docs 元数据与 round-trip 检索', async () => {
  const c = await loadCore();
  const index = lib.buildLanguageIndex(c, SAMPLE_DOCS, { lang: 'zh', fields: ['title', 'excerpt', 'content'], bigram: true });
  assert.strictEqual(index.version, 2);
  assert.strictEqual(index.lang, 'zh');
  assert.strictEqual(index.docs.length, 2);
  assert.ok(!('content' in index.docs[0]), 'docs metadata must not carry full content');
  assert.ok(index.fields.title['搜索'] && index.fields.title['搜索'].length === 1);
  // 序列化往返后仍可检索（构建产物契约）
  const roundTrip = JSON.parse(JSON.stringify(index));
  const hits = c.searchIndex(roundTrip, '搜索升级');
  assert.deepStrictEqual(hits.map((d) => d.url), ['/zh/a/']);
  const tagHits = c.searchIndex(roundTrip, 'javascript');
  assert.deepStrictEqual(tagHits.map((d) => d.url), ['/zh/a/']);
});

test('buildLanguageIndex：weightContent 关闭时 content 不进入索引', async () => {
  const c = await loadCore();
  const index = lib.buildLanguageIndex(c, SAMPLE_DOCS, { lang: 'zh', fields: ['title', 'excerpt'], bigram: true });
  assert.ok(!index.fields.content);
  const hits = c.searchIndex(index, '二元组');
  assert.deepStrictEqual(hits, []);
});

test('buildLanguageIndex：空站（0 文章）仍产出合法空索引（版本/字段齐备、可序列化往返）', async () => {
  const c = await loadCore();
  for (const lang of ['zh', 'en']) {
    const index = lib.buildLanguageIndex(c, [], { lang, fields: ['title', 'excerpt', 'content'], bigram: true });
    assert.strictEqual(index.version, 2, lang + ' 空索引必须携带版本');
    assert.strictEqual(index.lang, lang);
    assert.deepStrictEqual(index.docs, [], lang + ' 空索引 docs 必须为空数组');
    assert.deepStrictEqual(Object.keys(index.fields), ['title', 'excerpt', 'content'], lang + ' 空索引字段表必须齐备');
    assert.ok(c.isValidIndex(index), lang + ' 空索引必须通过结构校验（前端不得误报索引不可用）');
    assert.deepStrictEqual(c.searchIndex(index, '任意关键词'), [], lang + ' 空索引查询必须返回空结果而非错误');
    // 构建产物契约：serializeIndexText 的 JSON 文本可 parse，且 gzip 体积在默认预算内。
    const text = lib.serializeIndexText(index);
    const parsed = JSON.parse(text);
    assert.strictEqual(parsed.version, 2);
    assert.deepStrictEqual(parsed.docs, []);
    assert.ok(lib.measureGzip(text) <= lib.DEFAULT_MAX_GZIP_KB * 1024, lang + ' 空索引必须满足默认 gzip 预算');
    assert.strictEqual(lib.pruneIndexToBudget(parsed, lib.DEFAULT_MAX_GZIP_KB * 1024).pruned, 0, lang + ' 空索引不需裁剪');
    // 内容寻址哈希按语言区分，构建与前端缓存标签不碰撞。
    assert.notStrictEqual(lib.hashIndexText('zh', text), lib.hashIndexText('en', text));
  }
});

test('measureGzip：与 zlib.gzipSync 结果一致', () => {
  const text = JSON.stringify({ a: '中文内容'.repeat(50) });
  assert.strictEqual(lib.measureGzip(text), zlib.gzipSync(Buffer.from(text, 'utf-8')).length);
});

test('hashIndexText：同内容稳定、语言参与区分', () => {
  const a1 = lib.hashIndexText('zh', '{"docs":[]}');
  const a2 = lib.hashIndexText('zh', '{"docs":[]}');
  const b = lib.hashIndexText('en', '{"docs":[]}');
  assert.strictEqual(a1, a2);
  assert.notStrictEqual(a1, b);
  assert.match(a1, /^[0-9a-f]{10}$/);
});

test('pruneIndexToBudget：小数据不裁剪、达标', async () => {
  const c = await loadCore();
  const index = lib.buildLanguageIndex(c, SAMPLE_DOCS, { lang: 'zh', fields: ['title', 'excerpt', 'content'], bigram: true });
  const result = lib.pruneIndexToBudget(index, 60 * 1024);
  assert.strictEqual(result.pruned, 0);
  assert.strictEqual(result.reached, true);
  assert.ok(result.gzipBytes <= 60 * 1024);
  assert.strictEqual(result.text, JSON.stringify(index));
});

test('pruneIndexToBudget：超限时裁剪低频词并达标', async () => {
  const c = await loadCore();
  const docs = [];
  const uniqueWords = [];
  for (let i = 0; i < 200; i++) uniqueWords.push('zz' + i.toString(36) + 'qqq');
  for (let i = 0; i < 60; i++) {
    docs.push({
      title: 't' + i,
      url: '/p/' + i + '/',
      excerpt: uniqueWords.slice(i, i + 20).join(' '),
      content: '',
      tags: [],
      categories: [],
      lang: 'zh'
    });
  }
  const index = lib.buildLanguageIndex(c, docs, { lang: 'zh', fields: ['title', 'excerpt'], bigram: true });
  const fullBytes = lib.measureGzip(JSON.stringify(index));
  assert.ok(fullBytes > 1024, 'fixture must exceed the tiny budget, got ' + fullBytes);
  const result = lib.pruneIndexToBudget(index, 1024);
  assert.ok(result.pruned > 0, 'expected pruning, got ' + result.pruned);
  assert.ok(result.gzipBytes <= 1024, 'expected budget reached, got ' + result.gzipBytes);
  assert.strictEqual(result.reached, true);
  assert.ok(result.gzipBytes < fullBytes);
});

test('pruneIndexToBudget：预算无法达标时 reached=false 且不抛错', async () => {
  const c = await loadCore();
  const docs = [{ title: '搜索升级', url: '/a/', excerpt: '', tags: [], categories: [], lang: 'zh' }];
  const index = lib.buildLanguageIndex(c, docs, { lang: 'zh', fields: ['title'], bigram: true });
  const result = lib.pruneIndexToBudget(index, 1);
  assert.strictEqual(result.reached, false);
  assert.ok(result.gzipBytes >= 1);
});

test('resolveFinalAssetUrl：媒体路径预计算内容哈希、幂等与豁免', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-search-asset-'));
  try {
    const mediaDir = path.join(dir, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    const file = path.join(mediaDir, 'pic.jpg');
    fs.writeFileSync(file, 'fake-jpeg-bytes');
    const md5 = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
    const opts = { cacheBusting: true, pattern: /.*\.(css|js|png|jpg|svg)$/i };

    assert.strictEqual(lib.resolveFinalAssetUrl(dir, '/media/pic.jpg', opts), '/media/pic.' + md5 + '.jpg');
    // 幂等：已带内容哈希的路径原样返回
    const hashedName = 'pic.' + md5 + '.jpg';
    fs.writeFileSync(path.join(mediaDir, hashedName), 'fake-jpeg-bytes');
    assert.strictEqual(lib.resolveFinalAssetUrl(dir, '/media/' + hashedName, opts), '/media/' + hashedName);
    // 豁免：assets/og/外部/查询串/未匹配扩展名/关闭 cacheBust 时原样
    fs.writeFileSync(path.join(mediaDir, 'shot.webp'), 'webp');
    assert.strictEqual(lib.resolveFinalAssetUrl(dir, '/assets/img.png', opts), '/assets/img.png');
    assert.strictEqual(lib.resolveFinalAssetUrl(dir, '/og/x.png', opts), '/og/x.png');
    assert.strictEqual(lib.resolveFinalAssetUrl(dir, 'https://cdn.example.com/a.jpg', opts), 'https://cdn.example.com/a.jpg');
    assert.strictEqual(lib.resolveFinalAssetUrl(dir, '/media/pic.jpg?v=2', opts), '/media/pic.jpg?v=2');
    assert.strictEqual(lib.resolveFinalAssetUrl(dir, '/media/shot.webp', opts), '/media/shot.webp');
    assert.strictEqual(lib.resolveFinalAssetUrl(dir, '/media/missing.jpg', opts), '/media/missing.jpg');
    assert.strictEqual(
      lib.resolveFinalAssetUrl(dir, '/media/pic.jpg', { cacheBusting: false, pattern: opts.pattern }),
      '/media/pic.jpg'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
