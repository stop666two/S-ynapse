'use strict';
// 检索核心单测（js/domains/features/search-core.js）：分词、倒排查询、评分排序、高亮与摘要、索引加载。
// 运行：node --test scripts/search-core.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const CORE_PATH = path.join(__dirname, '..', 'js', 'domains', 'features', 'search-core.js');
let core = null;
async function loadCore() {
  if (!core) core = await import(pathToFileURL(CORE_PATH).href);
  return core;
}

const FIXTURE_DOCS = [
  {
    title: '搜索升级实战',
    url: '/zh/a/',
    excerpt: '倒排索引与 vue3 检索',
    content: 'bigram 分词把中文切成二元组',
    tags: ['搜索', 'JavaScript'],
    categories: ['技术'],
    lang: 'zh'
  },
  {
    title: 'Site Building Notes',
    url: '/zh/b/',
    excerpt: 'series hub pages',
    content: 'building a static site',
    tags: ['series'],
    categories: ['build'],
    lang: 'zh'
  },
  {
    title: '其他文章',
    url: '/zh/c/',
    excerpt: '无关内容',
    content: '这里没有关键词',
    tags: ['其他'],
    categories: [],
    lang: 'zh'
  }
];

test('tokenizeText：CJK bigram 与独立单字', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.tokenizeText('搜索升级'), ['搜索', '索升', '升级']);
  assert.deepStrictEqual(c.tokenizeText('搜'), ['搜']);
});

test('tokenizeText：中英混合与数字', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.tokenizeText('Vue3 教程'), ['vue3', '教程']);
  assert.deepStrictEqual(c.tokenizeText('hello世界'), ['hello', '世界']);
});

test('tokenizeText：标点与空白分隔 CJK 段', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.tokenizeText('你好，世界！'), ['你好', '世界']);
  assert.deepStrictEqual(c.tokenizeText('foo-bar_baz'), ['foo', 'bar', 'baz']);
});

test('tokenizeText：emoji 与纯符号不产生词项', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.tokenizeText('🔥🔥 !!! ---'), []);
  assert.deepStrictEqual(c.tokenizeText('a🔥b'), ['a', 'b']);
  assert.deepStrictEqual(c.tokenizeText(''), []);
  assert.deepStrictEqual(c.tokenizeText(null), []);
});

test('tokenizeText：大小写归一；tokenizeQuery 去重且保持首次出现顺序', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.tokenizeText('Hello HELLO'), ['hello', 'hello']);
  assert.deepStrictEqual(c.tokenizeQuery('Hello HELLO'), ['hello']);
  assert.deepStrictEqual(c.tokenizeQuery('搜索搜索'), ['搜索', '索搜']);
});

test('tokenizeText：bigram=false 时 CJK 段整段成词（英文语义不变）', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.tokenizeText('搜索升级', { bigram: false }), ['搜索升级']);
  assert.deepStrictEqual(c.tokenizeText('Vue 教程', { bigram: false }), ['vue', '教程']);
});

test('tokenizeText：超长输入不爆栈且性能可控', async () => {
  const c = await loadCore();
  const text = '搜索升级'.repeat(5000);
  const started = Date.now();
  const terms = c.tokenizeText(text);
  const elapsed = Date.now() - started;
  assert.ok(terms.length >= 10000, 'expected >=10000 terms, got ' + terms.length);
  assert.ok(elapsed < 1000, 'tokenize too slow: ' + elapsed + 'ms');
});

test('buildIndex/searchIndex：中文 bigram 命中与字段权重评分', async () => {
  const c = await loadCore();
  const idx = c.buildIndex(FIXTURE_DOCS, { bigram: true, fields: ['title', 'excerpt', 'content'] });
  assert.ok(c.isValidIndex(idx));
  const hits = c.searchIndex(idx, '搜索升级', { weights: { title: 5, excerpt: 2, content: 1 } });
  assert.deepStrictEqual(hits.map((d) => d.url), ['/zh/a/']);
  assert.ok(!('content' in hits[0]), 'docs metadata must not expose full content');
});

test('searchIndex：标签子串命中与 matchTags/matchCategories 门控', async () => {
  const c = await loadCore();
  const idx = c.buildIndex(FIXTURE_DOCS, { bigram: true, fields: ['title'] });
  const byTag = c.searchIndex(idx, 'javas', { matchTags: true, matchCategories: true });
  assert.deepStrictEqual(byTag.map((d) => d.url), ['/zh/a/']);
  assert.deepStrictEqual(c.searchIndex(idx, 'javas', { matchTags: false, matchCategories: false }), []);
  const byCat = c.searchIndex(idx, '技术', { matchTags: false, matchCategories: true });
  assert.deepStrictEqual(byCat.map((d) => d.url), ['/zh/a/']);
  assert.deepStrictEqual(c.searchIndex(idx, '技术', { matchTags: true, matchCategories: false }), []);
});

test('searchIndex：多词项 AND（中文 bigram 与英文词混合）', async () => {
  const c = await loadCore();
  const idx = c.buildIndex(FIXTURE_DOCS, { bigram: true, fields: ['title', 'excerpt', 'content'] });
  assert.deepStrictEqual(c.searchIndex(idx, '搜索 升级').map((d) => d.url), ['/zh/a/']);
  assert.deepStrictEqual(c.searchIndex(idx, '搜索 vue3').map((d) => d.url), ['/zh/a/']);
  assert.deepStrictEqual(c.searchIndex(idx, '搜索 不存在词'), []);
});

test('searchIndex：得分降序、同分按索引原序稳定', async () => {
  const c = await loadCore();
  const docs = [
    { title: 'alpha', url: '/1' },
    { title: 'alpha alpha', url: '/2' },
    { title: 'alpha', url: '/3' }
  ];
  const idx = c.buildIndex(docs, { fields: ['title'] });
  assert.deepStrictEqual(c.searchIndex(idx, 'alpha').map((d) => d.url), ['/1', '/2', '/3']);
});

test('searchIndex：权重 0 字段不参与匹配与计分；limit 截断', async () => {
  const c = await loadCore();
  const docs = [{ title: 'x', excerpt: 'alpha', url: '/e' }, { title: 'alpha', url: '/t' }];
  const idx = c.buildIndex(docs, { fields: ['title', 'excerpt'] });
  assert.deepStrictEqual(c.searchIndex(idx, 'alpha', { weights: { title: 5, excerpt: 0 } }).map((d) => d.url), ['/t']);
  assert.deepStrictEqual(c.searchIndex(idx, 'alpha', { weights: { title: 5, excerpt: 2 }, limit: 1 }).map((d) => d.url), ['/t']);
});

test('searchIndex：CJK 单字查询经 bigram 首尾扫描命中', async () => {
  const c = await loadCore();
  const idx = c.buildIndex([{ title: '搜索升级', url: '/s' }], { bigram: true, fields: ['title'] });
  for (const ch of ['搜', '索', '升', '级']) {
    assert.deepStrictEqual(c.searchIndex(idx, ch).map((d) => d.url), ['/s'], 'single char ' + ch);
  }
});

test('searchIndex：无词项查询（纯符号/emoji）返回空且不抛错', async () => {
  const c = await loadCore();
  const idx = c.buildIndex(FIXTURE_DOCS, { fields: ['title'] });
  assert.deepStrictEqual(c.searchIndex(idx, '🔥🔥'), []);
  assert.deepStrictEqual(c.searchIndex(idx, ''), []);
  assert.deepStrictEqual(c.searchIndex(idx, null), []);
});

test('searchIndex：超长查询不抛错且结果稳定', async () => {
  const c = await loadCore();
  const idx = c.buildIndex(FIXTURE_DOCS, { fields: ['title'] });
  const long = '搜'.repeat(2000);
  const r = c.searchIndex(idx, long);
  assert.ok(Array.isArray(r));
});

test('highlightHtml：转义、mark 与 markClass、重叠合并、maxMatches', async () => {
  const c = await loadCore();
  assert.strictEqual(c.highlightHtml('<搜索>升级', '搜索升级'), '&lt;<mark>搜索</mark>&gt;<mark>升级</mark>');
  assert.strictEqual(c.highlightHtml('搜索升级', '搜索升级'), '<mark>搜索升级</mark>');
  assert.strictEqual(c.highlightHtml('abc', 'b', { markClass: 'hl' }), 'a<mark class="hl">b</mark>c');
  assert.strictEqual(c.highlightHtml('abc', 'b', { enabled: false }), 'abc');
  assert.strictEqual(
    c.highlightHtml('<b>x</b>', 'b'),
    '&lt;<mark>b</mark>&gt;x&lt;/<mark>b</mark>&gt;'
  );
  assert.strictEqual(c.highlightHtml('a a a a', 'a', { maxMatches: 2 }), '<mark>a</mark> <mark>a</mark> a a');
  assert.strictEqual(c.highlightHtml('"quoted"', 'quote'), '&quot;<mark>quote</mark>d&quot;');
});

test('extractSnippet：命中窗口提取与无命中首段截断', async () => {
  const c = await loadCore();
  const text = '前'.repeat(100) + '目标词' + '后'.repeat(100);
  const snip = c.extractSnippet(text, '目标', 50);
  assert.ok(snip.includes('目标'), 'snippet must include the hit');
  assert.ok(snip.startsWith('…') && snip.endsWith('…'), 'windowed snippet must be ellipsized: ' + snip);
  assert.strictEqual(c.extractSnippet('abcdefghij', 'zz', 4), 'abcd…');
  assert.strictEqual(c.extractSnippet('short', 'zz', 50), 'short');
});

test('isValidIndex：结构校验', async () => {
  const c = await loadCore();
  assert.strictEqual(c.isValidIndex({ docs: [], fields: {} }), true);
  assert.strictEqual(c.isValidIndex([]), false);
  assert.strictEqual(c.isValidIndex(null), false);
  assert.strictEqual(c.isValidIndex({ docs: {} }), false);
});

test('loadIndex：成功加载、失败重试与非法结构报错', async () => {
  const c = await loadCore();
  const attempts = {};
  const server = http.createServer((req, res) => {
    attempts[req.url] = (attempts[req.url] || 0) + 1;
    if (req.url === '/ok') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ docs: [], fields: {} }));
      return;
    }
    if (req.url === '/retry') {
      if (attempts['/retry'] < 2) {
        res.statusCode = 500;
        res.end('boom');
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ docs: [], fields: {} }));
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end('[]');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;
  try {
    const ok = await c.loadIndex(base + '/ok', { retries: 0 });
    assert.ok(c.isValidIndex(ok));
    const retried = await c.loadIndex(base + '/retry', { retries: 1 });
    assert.ok(c.isValidIndex(retried));
    assert.strictEqual(attempts['/retry'], 2, 'one retry expected');
    await assert.rejects(() => c.loadIndex(base + '/bad', { retries: 0 }), /invalid search index/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ensureIndex：命中缓存且 force 重新加载', async () => {
  const c = await loadCore();
  const hits = { n: 0 };
  const server = http.createServer((req, res) => {
    hits.n++;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ docs: [], fields: {}, v: hits.n }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = 'http://127.0.0.1:' + port + '/idx';
  try {
    const first = await c.ensureIndex(url, { retries: 0 });
    const cached = await c.ensureIndex(url, { retries: 0 });
    assert.strictEqual(hits.n, 1, 'second ensure must hit cache');
    assert.strictEqual(first, cached);
    const forced = await c.ensureIndex(url, { retries: 0, force: true });
    assert.strictEqual(hits.n, 2, 'force must refetch');
    assert.ok(c.isValidIndex(forced));
    assert.strictEqual(c.searchIndexState().failed, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ensureIndex：404 失败标记 searchIndexState.failed', async () => {
  const c = await loadCore();
  const server = http.createServer((req, res) => {
    res.statusCode = 404;
    res.end('missing');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const r = await c.ensureIndex('http://127.0.0.1:' + port + '/gone', { retries: 0, force: true });
    assert.strictEqual(r, null);
    assert.strictEqual(c.searchIndexState().failed, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
