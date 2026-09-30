'use strict';
// 搜索索引与查询属性测试：
// 覆盖 search-core 的 buildIndex 确定性、searchIndex 任意查询容错与排序、
// 字段权重单调与权重 0 排除、标签/分类开关的集合正确性、空查询与无命中语义、
// 索引序列化往返一致，以及 search-index 的配置归一化与体积裁剪预算不变量。
// 运行：npm run test:fuzz；复现：TEST_SEED=<种子> FC_NUM_RUNS=<次数> npm run test:fuzz。

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fc = require('fast-check');
const { checkProperty, stressEnabled } = require('./test-random');
const { searchIndexOptions, pruneIndexToBudget } = require('./search-index');

const CORE_PATH = path.join(__dirname, '..', '..', 'js', 'domains', 'features', 'search-core.js');
let core = null;
async function loadCore() {
  if (!core) core = await import(pathToFileURL(CORE_PATH).href);
  return core;
}

const STRESS = stressEnabled();
const MAX_TEXT_UNITS = STRESS ? 120 : 16;
const MAX_DOCS = STRESS ? 40 : 8;

const cjkChar = fc.integer({ min: 0x4e00, max: 0x9fa5 }).map((cp) => String.fromCharCode(cp));
const asciiWord = fc.stringMatching(/^[a-z0-9]{1,8}$/);
const separator = fc.constantFrom(' ', '-', '_', '.', '!', '?', '#', '中');
const textUnit = fc.oneof(cjkChar, asciiWord, separator, fc.constantFrom('😀', '🎉', '🚀'));
const anyText = fc.array(textUnit, { minLength: 0, maxLength: MAX_TEXT_UNITS }).map((units) => units.join(''));

const docArb = fc.record({
  title: anyText,
  excerpt: anyText,
  content: anyText,
  tags: fc.array(fc.stringMatching(/^[a-z0-9]{1,10}$/), { maxLength: 3 }),
  categories: fc.array(fc.stringMatching(/^[a-z0-9]{1,10}$/), { maxLength: 2 }),
  lang: fc.constantFrom('zh', 'en')
});

const weightArb = fc.oneof(
  fc.constant(0),
  fc.integer({ min: 1, max: 10 }),
  fc.constantFrom(0.5, 2.5, 7.25)
);
const optionsArb = fc.record({
  weights: fc.oneof(
    fc.constant({}),
    fc.record({ title: weightArb, excerpt: weightArb, content: weightArb })
  ),
  matchTags: fc.boolean(),
  matchCategories: fc.boolean(),
  limit: fc.oneof(fc.integer({ min: 0, max: 6 }), fc.constant(undefined))
});

const queryArb = fc.oneof(
  anyText,
  fc.constantFrom('.*+?^${}()|[]\\', '   ', '\t\n', '😀', '\u0000', 'a'.repeat(512), '中'.repeat(256)),
  fc.array(textUnit, { minLength: 1, maxLength: STRESS ? 600 : 60 }).map((units) => units.join(''))
);

function withUniqueUrls(docs) {
  return docs.map((doc, index) => Object.assign({}, doc, { url: '/p/' + index + '/' }));
}

// 判断一个纯 ASCII 小写词项在索引结构内是否可能命中：倒排表键精确等于该词项
// （ASCII 词项按整词索引，不做子串），或标签/分类小写后包含该词项。
function tokenPresent(index, token) {
  for (const name of Object.keys(index.fields)) {
    if (Object.prototype.hasOwnProperty.call(index.fields[name], token)) return true;
  }
  for (const doc of index.docs) {
    for (const meta of doc.tags.concat(doc.categories)) {
      if (meta.toLowerCase().includes(token)) return true;
    }
  }
  return false;
}

describe('buildIndex 属性', () => {
  it('确定性：同一文档集两次构建逐字节一致（含字段表与 docs 元数据）', async () => {
    const c = await loadCore();
    checkProperty('buildIndex-确定性', fc, fc.property(fc.array(docArb, { maxLength: MAX_DOCS }), (docs) => {
      const first = c.buildIndex(withUniqueUrls(docs), { fields: ['title', 'excerpt', 'content'] });
      const second = c.buildIndex(withUniqueUrls(docs), { fields: ['title', 'excerpt', 'content'] });
      assert.strictEqual(JSON.stringify(first), JSON.stringify(second));
      return true;
    }));
  });

  it('字段白名单：fields 决定哪些倒排表存在，docs 元数据不携带正文', async () => {
    const c = await loadCore();
    const fieldsArb = fc.uniqueArray(fc.constantFrom('title', 'excerpt', 'content'), { minLength: 1, maxLength: 3 });
    checkProperty('buildIndex-字段白名单', fc, fc.property(fc.array(docArb, { maxLength: MAX_DOCS }), fieldsArb, (docs, fields) => {
      const index = c.buildIndex(withUniqueUrls(docs), { fields });
      assert.deepStrictEqual(Object.keys(index.fields).sort(), fields.slice().sort());
      for (const doc of index.docs) assert.ok(!Object.prototype.hasOwnProperty.call(doc, 'content'));
      return true;
    }));
  });

  it('自命中：标题分词出的任一词项都能检索回该文档', async () => {
    const c = await loadCore();
    const caseArb = fc.tuple(fc.array(docArb, { minLength: 1, maxLength: MAX_DOCS }), fc.nat(), fc.nat());
    checkProperty('searchIndex-自命中', fc, fc.property(caseArb, ([docs, docPick, termPick]) => {
      const list = withUniqueUrls(docs);
      const targetIdx = docPick % list.length;
      const terms = c.tokenizeText(list[targetIdx].title, { bigram: true });
      if (!terms.length) return true;
      const token = terms[termPick % terms.length];
      const index = c.buildIndex(list, { fields: ['title', 'excerpt', 'content'] });
      const hits = c.searchIndex(index, token, { matchTags: false, matchCategories: false });
      assert.ok(hits.some((d) => d.url === '/p/' + targetIdx + '/'),
        '标题词项必须命中自身：' + JSON.stringify({ token, title: list[targetIdx].title, urls: hits.map((d) => d.url) }));
      return true;
    }));
  });
});

describe('searchIndex 属性', () => {
  it('任意查询与选项组合不崩溃，结果去重、属于索引且受 limit 截断', async () => {
    const c = await loadCore();
    const caseArb = fc.tuple(fc.array(docArb, { maxLength: MAX_DOCS }), queryArb, optionsArb);
    checkProperty('searchIndex-容错与结构', fc, fc.property(caseArb, ([docs, query, options]) => {
      const index = c.buildIndex(withUniqueUrls(docs), { fields: ['title', 'excerpt', 'content'] });
      const result = c.searchIndex(index, query, options);
      assert.ok(Array.isArray(result));
      assert.ok(result.length <= index.docs.length);
      const seen = new Set();
      for (const doc of result) {
        assert.ok(index.docs.includes(doc), '结果必须是索引内 docs 的引用');
        assert.ok(!seen.has(doc.url), '结果不得重复：' + doc.url);
        seen.add(doc.url);
      }
      const limit = options.limit > 0 ? Math.floor(options.limit) : Infinity;
      if (Number.isFinite(limit)) assert.ok(result.length <= limit, 'limit 必须截断');
      return true;
    }));
  });

  it('字段权重单调：同一词项命中标题 > 摘要 > 正文，得分降序与文档序无关', async () => {
    const c = await loadCore();
    const termArb = fc.stringMatching(/^[a-z]{3,8}$/);
    checkProperty('searchIndex-权重单调', fc, fc.property(termArb, (term) => {
      const docs = [
        { title: '', excerpt: '', content: term, tags: [], categories: [], url: '/c/' },
        { title: '', excerpt: term, content: '', tags: [], categories: [], url: '/e/' },
        { title: term, excerpt: '', content: '', tags: [], categories: [], url: '/t/' }
      ];
      const index = c.buildIndex(docs, { fields: ['title', 'excerpt', 'content'] });
      const hits = c.searchIndex(index, term, { matchTags: false, matchCategories: false });
      assert.deepStrictEqual(hits.map((d) => d.url), ['/t/', '/e/', '/c/']);
      return true;
    }));
  });

  it('权重 0 的字段不参与匹配：仅被零权字段命中的文档从结果中消失', async () => {
    const c = await loadCore();
    const termArb = fc.stringMatching(/^[a-z]{3,8}$/);
    checkProperty('searchIndex-权重零排除', fc, fc.property(termArb, (term) => {
      const titleOnly = [{ title: term, excerpt: '', content: '', tags: [], categories: [], url: '/t/' }];
      const contentOnly = [{ title: '', excerpt: '', content: term, tags: [], categories: [], url: '/c/' }];
      const indexTitle = c.buildIndex(titleOnly, { fields: ['title', 'excerpt', 'content'] });
      assert.deepStrictEqual(
        c.searchIndex(indexTitle, term, { weights: { title: 0, excerpt: 2, content: 1 }, matchTags: false, matchCategories: false }),
        []
      );
      const indexContent = c.buildIndex(contentOnly, { fields: ['title', 'excerpt', 'content'] });
      assert.deepStrictEqual(
        c.searchIndex(indexContent, term, { weights: { title: 5, excerpt: 2, content: 0 }, matchTags: false, matchCategories: false }),
        []
      );
      return true;
    }));
  });

  it('matchTags/matchCategories 开关精确控制集合：标签与分类命中可独立启停', async () => {
    const c = await loadCore();
    const tokenArb = fc.stringMatching(/^[a-z0-9]{6,12}$/).map((s) => 'zq' + s);
    checkProperty('searchIndex-标签分类开关', fc, fc.property(tokenArb, tokenArb, (tag, cat) => {
      fc.pre(tag !== cat && !cat.includes(tag) && !tag.includes(cat));
      const docs = [
        { title: '', excerpt: '', content: '', tags: [tag.toUpperCase()], categories: [], url: '/tag/' },
        { title: '', excerpt: '', content: '', tags: [], categories: [cat], url: '/cat/' },
        { title: '', excerpt: '', content: '', tags: [], categories: [], url: '/none/' }
      ];
      const index = c.buildIndex(docs, { fields: ['title', 'excerpt', 'content'] });
      const tagHits = c.searchIndex(index, tag, {});
      assert.deepStrictEqual(tagHits.map((d) => d.url), ['/tag/'], '标签子串命中且大小写不敏感');
      assert.deepStrictEqual(c.searchIndex(index, tag, { matchTags: false }).map((d) => d.url), []);
      assert.deepStrictEqual(
        c.searchIndex(index, tag, { matchTags: false, matchCategories: false }),
        []
      );
      const catHits = c.searchIndex(index, cat, {});
      assert.deepStrictEqual(catHits.map((d) => d.url), ['/cat/']);
      assert.deepStrictEqual(c.searchIndex(index, cat, { matchCategories: false }).map((d) => d.url), []);
      return true;
    }));
  });

  it('空查询与无命中语义稳定：纯分隔符查询空结果，结构上不存在的词项空结果', async () => {
    const c = await loadCore();
    const caseArb = fc.tuple(fc.array(docArb, { maxLength: MAX_DOCS }), fc.stringMatching(/^[a-z]{6,12}$/));
    checkProperty('searchIndex-空与无命中', fc, fc.property(caseArb, ([docs, absent]) => {
      const list = withUniqueUrls(docs);
      const index = c.buildIndex(list, { fields: ['title', 'excerpt', 'content'] });
      for (const emptyQuery of ['', '   ', '!!!', '😀', '\u0000', '###']) {
        const once = c.searchIndex(index, emptyQuery, {});
        assert.deepStrictEqual(once, []);
        assert.deepStrictEqual(c.searchIndex(index, emptyQuery, {}), once, '空查询语义必须稳定');
      }
      let token = 'zz' + absent + 'qq';
      for (let i = 0; i < 64 && tokenPresent(index, token); i++) token += 'q';
      assert.strictEqual(tokenPresent(index, token), false, '测试词项必须构造为结构上不存在');
      assert.deepStrictEqual(c.searchIndex(index, token, {}), [], '词表与元数据都不含的词项必须无命中');
      return true;
    }));
  });

  it('序列化往返：JSON 解析出的索引与内存索引查询结果一致', async () => {
    const c = await loadCore();
    const caseArb = fc.tuple(fc.array(docArb, { maxLength: MAX_DOCS }), queryArb, optionsArb);
    checkProperty('searchIndex-序列化往返', fc, fc.property(caseArb, ([docs, query, options]) => {
      const index = c.buildIndex(withUniqueUrls(docs), { fields: ['title', 'excerpt', 'content'] });
      const restored = JSON.parse(JSON.stringify(index));
      const fromMemory = c.searchIndex(index, query, options);
      const fromDisk = c.searchIndex(restored, query, options);
      assert.strictEqual(JSON.stringify(fromMemory), JSON.stringify(fromDisk));
      return true;
    }));
  });
});

describe('search-index 构建封装属性', () => {
  it('searchIndexOptions 归一化：bigram 布尔、maxGzipKb 始终为有限正数', () => {
    const rawArb = fc.oneof(
      fc.constant(undefined),
      fc.constant(''),
      fc.constant(null),
      fc.integer(),
      fc.string(),
      fc.boolean()
    );
    const featuresArb = fc.record({ search: fc.record({ index: fc.record({ bigram: fc.anything(), maxGzipKb: rawArb }) }) });
    checkProperty('searchIndexOptions-归一化', fc, fc.property(featuresArb, (features) => {
      const opts = searchIndexOptions(features);
      assert.strictEqual(typeof opts.bigram, 'boolean');
      assert.ok(Number.isFinite(opts.maxGzipKb) && opts.maxGzipKb > 0, 'maxGzipKb 必须有限正数');
      return true;
    }));
  });

  it('pruneIndexToBudget 预算：达标则 gzip 不超预算，未达标 reached=false 且结构仍完整', async () => {
    const c = await loadCore();
    const caseArb = fc.tuple(
      fc.array(
        fc.record({ word: fc.stringMatching(/^[a-z]{2,8}$/), n: fc.nat({ max: 999999 }) }),
        { minLength: 3, maxLength: STRESS ? 60 : 15 }
      ),
      fc.integer({ min: 64, max: 4096 })
    );
    checkProperty('pruneIndexToBudget-预算不变量', fc, fc.property(caseArb, ([seeds, budget]) => {
      const docs = seeds.map((seed, index) => ({
        title: '',
        excerpt: seed.word + seed.n + ' ' + seed.word + 'w' + (seed.n % 7),
        content: '',
        tags: [],
        categories: [],
        url: '/p/' + index + '/'
      }));
      const index = c.buildIndex(docs, { fields: ['title', 'excerpt'] });
      const beforeDocs = JSON.stringify(index.docs);
      const result = pruneIndexToBudget(index, budget);
      assert.strictEqual(result.reached, result.gzipBytes <= budget, 'reached 必须与实测体积一致');
      if (result.reached) assert.ok(result.gzipBytes <= budget);
      const parsed = JSON.parse(result.text);
      assert.ok(c.isValidIndex(parsed), '裁剪后必须仍是合法索引');
      assert.strictEqual(parsed.docs.length, docs.length);
      assert.strictEqual(JSON.stringify(parsed.docs), beforeDocs, 'docs 元数据不得参与裁剪');
      return true;
    }));
  });
});
