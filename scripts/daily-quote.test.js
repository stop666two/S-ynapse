'use strict';
// 每日一言单测：
//   1. data/quotes.json5 数据校验（条数/标签枚举与分布/字段非空/text 唯一/中西比例/译文标注）；
//   2. 浏览器纯函数（js/domains/features/daily-quote.js 经 data URL 导入，与运行时同源）：
//      日期稳定、换一句不重复、语言回退链；
//   3. 构建期数据层（scripts/lib/daily-quotes.js）：归一化与 count 池大小语义；
//   4. resolveDailyQuotes 优先级：builtin→dataFile、count、缺失回退代码内置最小集并告警、自定义路径。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'quotes.json5');
const RAW_LIST = json5.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
const { QUOTE_TAGS, normalizeQuoteEntry, normalizeQuoteList, applyCount, validateQuotes } = require('./lib/daily-quotes.js');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { createHelpersModule } = require('./build/helpers.js');

const QUOTE_MODULE_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'daily-quote.js'), 'utf-8');
const quoteModulePromise = import('data:text/javascript;base64,' + Buffer.from(QUOTE_MODULE_SOURCE, 'utf-8').toString('base64'));
let loaded = null;
async function loadQuoteModule() {
  if (!loaded) loaded = await quoteModulePromise;
  return loaded;
}

describe('data/quotes.json5 数据校验', () => {
  it('共 100 条，中文 60 / 西方 40，text 全局唯一', () => {
    assert.strictEqual(RAW_LIST.length, 100, '引语条数');
    const seen = new Set();
    let zh = 0;
    let en = 0;
    for (const entry of RAW_LIST) {
      assert.ok(!seen.has(entry.text), 'text 重复：' + entry.text);
      seen.add(entry.text);
      if (/[\u3400-\u9fff]/.test(entry.text)) zh++; else en++;
    }
    assert.strictEqual(zh, 60, '中文条目数');
    assert.strictEqual(en, 40, '西方条目数');
    assert.deepStrictEqual(validateQuotes(RAW_LIST).issues, [], '数据文件应零问题');
  });

  it('字段非空：text/textEn/source/sourceEn；author 与 authorEn 成对', () => {
    for (const entry of RAW_LIST) {
      assert.ok(entry.text && entry.text.trim(), 'text 缺失');
      assert.ok(entry.textEn && entry.textEn.trim(), 'textEn 缺失：' + entry.text);
      assert.ok(entry.source && entry.source.trim(), 'source 缺失：' + entry.text);
      assert.ok(entry.sourceEn && entry.sourceEn.trim(), 'sourceEn 缺失：' + entry.text);
      assert.strictEqual(!!entry.author, !!entry.authorEn, 'author/authorEn 必须成对：' + entry.text);
    }
  });

  it('标签在 9 个枚举内且分布均衡（每类 8~28 次）', () => {
    const { stats } = validateQuotes(RAW_LIST);
    assert.deepStrictEqual(Object.keys(stats.tagCounts).sort(), QUOTE_TAGS.slice().sort(), '标签枚举');
    for (const tag of QUOTE_TAGS) {
      assert.ok(stats.tagCounts[tag] >= 8, tag + ' 标签过少：' + stats.tagCounts[tag]);
      assert.ok(stats.tagCounts[tag] <= 28, tag + ' 标签过多：' + stats.tagCounts[tag]);
    }
  });

  it('中文条目英译为项目自译/原创标注；西方条目 textEn 为英文原文（与 text 相同）', () => {
    for (const entry of RAW_LIST) {
      if (/[\u3400-\u9fff]/.test(entry.text)) {
        assert.notStrictEqual(entry.textEn, entry.text, '中文条目应有英译：' + entry.text);
        assert.match(entry.sourceEn, /S-ynapse/, '中文条目 sourceEn 应标注项目译/原创：' + entry.text);
      } else {
        assert.strictEqual(entry.textEn, entry.text, '西方条目 textEn 应为原文：' + entry.text);
      }
    }
  });
});

describe('运行时纯函数（与浏览器模块同源）', () => {
  it('pickDailyIndex：同日期稳定、范围合法、total<=0 安全', async () => {
    const m = await loadQuoteModule();
    const d1 = new Date(2026, 8, 27);
    const d2 = new Date(2026, 8, 28);
    assert.strictEqual(m.pickDailyIndex(100, d1), m.pickDailyIndex(100, d1), '同日期必须稳定');
    assert.notStrictEqual(m.pickDailyIndex(100, d1), m.pickDailyIndex(100, d2), '相邻日期应换条');
    for (const total of [1, 7, 100]) {
      const idx = m.pickDailyIndex(total, d1);
      assert.ok(idx >= 0 && idx < total, '范围合法');
    }
    assert.strictEqual(m.pickDailyIndex(0, d1), 0);
    assert.strictEqual(m.pickDailyIndex(-3, d1), 0);
  });

  it('pickNextIndex：与当前不同、注入 rand 确定性、边界安全', async () => {
    const m = await loadQuoteModule();
    for (const total of [2, 7, 100]) {
      for (const current of [0, 1, total - 1]) {
        const next = m.pickNextIndex(current, total, function () { return 0.42; });
        assert.notStrictEqual(next, current, '换一句不得与当前相同');
        assert.ok(next >= 0 && next < total, '范围合法');
        assert.strictEqual(next, m.pickNextIndex(current, total, function () { return 0.42; }), '同 rand 结果确定');
      }
    }
    assert.strictEqual(m.pickNextIndex(0, 1, function () { return 0.5; }), 0, '单条池安全');
    assert.strictEqual(m.pickNextIndex(0, 0, function () { return 0.5; }), 0, '空池安全');
    assert.notStrictEqual(m.pickNextIndex(3, 5, function () { return 0.9999999; }), 3, 'rand 上界仍不重复');
    assert.notStrictEqual(m.pickNextIndex(3, 5, function () { return 0; }), 3, 'rand 下界不重复');
  });

  it('quoteForLang：en 优先 *En；空回退中文；中文空回退英文', async () => {
    const m = await loadQuoteModule();
    const full = { text: '中', textEn: 'EN', author: '甲', authorEn: 'A', source: '《源》', sourceEn: 'Src' };
    assert.deepStrictEqual(m.quoteForLang(full, 'en'), { text: 'EN', author: 'A', source: 'Src' });
    assert.deepStrictEqual(m.quoteForLang(full, 'zh'), { text: '中', author: '甲', source: '《源》' });
    const zhOnly = { text: '中', author: '甲', source: '《源》' };
    assert.deepStrictEqual(m.quoteForLang(zhOnly, 'en'), { text: '中', author: '甲', source: '《源》' });
    const enOnly = { textEn: 'EN', authorEn: 'A', sourceEn: 'Src' };
    assert.deepStrictEqual(m.quoteForLang(enOnly, 'zh'), { text: 'EN', author: 'A', source: 'Src' });
    assert.deepStrictEqual(m.quoteForLang({}, 'en'), { text: '', author: '', source: '' });
  });
});

describe('dailyQuote API 纯函数（与浏览器模块同源）', () => {
  const API_DEFAULT = { endpoint: 'https://v1.hitokoto.cn/', categories: ['d', 'i', 'k'], maxLength: 0 };

  it('buildApiUrl：默认端点 + 分类参数（重复 c=，实测 API 仅接受此形式）', async () => {
    const m = await loadQuoteModule();
    assert.strictEqual(m.buildApiUrl(API_DEFAULT), 'https://v1.hitokoto.cn/?c=d&c=i&c=k');
    const fromDefaults = DEFAULT_FEATURES.dailyQuote.api;
    assert.strictEqual(m.buildApiUrl(fromDefaults), 'https://v1.hitokoto.cn/?c=d&c=i&c=k', 'schema 默认值应生成实测同款 URL');
  });

  it('buildApiUrl：非 https 端点拒绝、空端点回退默认', async () => {
    const m = await loadQuoteModule();
    assert.strictEqual(m.buildApiUrl({ endpoint: 'http://v1.hitokoto.cn/', categories: ['d'] }), '', 'http 明文应拒绝');
    assert.strictEqual(m.buildApiUrl({ endpoint: '', categories: ['d'] }), 'https://v1.hitokoto.cn/?c=d', '空串回退默认端点');
    assert.strictEqual(m.buildApiUrl(undefined), 'https://v1.hitokoto.cn/', '未配置时仅默认端点');
  });

  it('buildApiUrl：分类过滤非法元素与特殊字符（防注入）', async () => {
    const m = await loadQuoteModule();
    assert.strictEqual(m.buildApiUrl({ categories: ['d', 'i j', 'k?x=1', 7, ''] }), 'https://v1.hitokoto.cn/?c=d', '仅保留合法短标识符');
    assert.strictEqual(m.buildApiUrl({ endpoint: 'https://v1.hitokoto.cn/', categories: [] }), 'https://v1.hitokoto.cn/', '空数组省略 c 参数');
    assert.strictEqual(m.buildApiUrl({ endpoint: 'https://v1.hitokoto.cn/', categories: 'd' }), 'https://v1.hitokoto.cn/', '非数组视为未配置');
  });

  it('buildApiUrl：maxLength 边界与已有查询串拼接', async () => {
    const m = await loadQuoteModule();
    assert.strictEqual(m.buildApiUrl({ categories: ['i'], maxLength: 24 }), 'https://v1.hitokoto.cn/?c=i&max_length=24');
    for (const bad of [0, -5, 'x', null, undefined]) {
      const url = m.buildApiUrl({ endpoint: 'https://v1.hitokoto.cn/', categories: [], maxLength: bad });
      assert.ok(!url.includes('max_length'), 'maxLength=' + String(bad) + ' 不应出现参数');
    }
    assert.strictEqual(m.buildApiUrl({ categories: ['i'], maxLength: 24.9 }), 'https://v1.hitokoto.cn/?c=i&max_length=24', '小数向下取整');
    assert.strictEqual(m.buildApiUrl({ endpoint: 'https://v1.hitokoto.cn/?x=1', categories: ['d'] }), 'https://v1.hitokoto.cn/?x=1&c=d', '已有 ? 时用 & 追加');
  });

  it('normalizeApiQuote：合法响应归一化（作者与作品来源）', async () => {
    const m = await loadQuoteModule();
    assert.deepStrictEqual(
      m.normalizeApiQuote({ hitokoto: ' 山重水复疑无路 ', from: '游山西村', from_who: '陆游', type: 'i' }),
      { text: '山重水复疑无路', author: '陆游', source: '游山西村' }
    );
    assert.deepStrictEqual(
      m.normalizeApiQuote({ hitokoto: '句子', from: '作品', from_who: '' }),
      { text: '句子', author: '作品', source: '' },
      'from_who 空回退 from 且不重复署源'
    );
    assert.deepStrictEqual(
      m.normalizeApiQuote({ hitokoto: '句子', from: '', from_who: '' }),
      { text: '句子', author: '', source: '' }
    );
  });

  it('normalizeApiQuote：非法字段/结构返回 null（触发本地回退）', async () => {
    const m = await loadQuoteModule();
    assert.strictEqual(m.normalizeApiQuote({}), null, '缺 hitokoto');
    assert.strictEqual(m.normalizeApiQuote({ hitokoto: '   ' }), null, '空白文本');
    assert.strictEqual(m.normalizeApiQuote({ hitokoto: 123 }), null, '非字符串文本');
    assert.strictEqual(m.normalizeApiQuote(null), null);
    assert.strictEqual(m.normalizeApiQuote('{"hitokoto":"x"}'), null, '字符串载荷非对象');
    assert.strictEqual(m.normalizeApiQuote([]), null, '数组载荷');
    const partial = m.normalizeApiQuote({ hitokoto: 'x', from_who: 7, from: null });
    assert.deepStrictEqual(partial, { text: 'x', author: '', source: '' }, '非字符串署名视为空');
  });

  it('canUseApi：开关/语言/离线/进行中决策矩阵', async () => {
    const m = await loadQuoteModule();
    const base = { enabled: true, lang: 'zh', online: true, pending: false, now: 10000, lastAt: 0, minIntervalMs: 1000 };
    assert.strictEqual(m.canUseApi(base), true, '中文+在线+未节流 → API');
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { enabled: false })), false, '关闭 → 本地');
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { lang: 'en' })), false, '英文页 → 本地');
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { online: false })), false, '离线 → 本地');
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { pending: true })), false, '请求进行中 → 本地');
    assert.strictEqual(m.canUseApi(undefined), false, '缺参保守回退本地');
  });

  it('canUseApi：minIntervalMs 节流边界', async () => {
    const m = await loadQuoteModule();
    const base = { enabled: true, lang: 'zh', online: true, pending: false, minIntervalMs: 1000 };
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { now: 1500, lastAt: 1000 })), false, '间隔内 → 本地');
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { now: 2000, lastAt: 1000 })), true, '达到间隔 → API');
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { now: 999, lastAt: 0 })), true, '首次请求不节流');
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { now: 1500, lastAt: 1000, minIntervalMs: 0 })), true, '间隔 0 不节流');
    assert.strictEqual(m.canUseApi(Object.assign({}, base, { now: 1500, lastAt: 1000, minIntervalMs: -5 })), true, '负间隔按 0');
  });
});

describe('构建期数据层（scripts/lib/daily-quotes.js）', () => {
  it('normalizeQuoteEntry：字符串/旧对象/新对象/非法值', () => {
    assert.deepStrictEqual(normalizeQuoteEntry('  hi  '), { text: 'hi', textEn: '', author: '', authorEn: '', source: '', sourceEn: '', tags: [] });
    assert.deepStrictEqual(normalizeQuoteEntry({ text: 'x', author: 'a' }).author, 'a');
    const full = normalizeQuoteEntry({ text: 'x', textEn: 'y', author: 'a', authorEn: 'A', source: 's', sourceEn: 'S', tags: ['哲思', '', 3] });
    assert.deepStrictEqual(full.tags, ['哲思'], 'tags 过滤空值与非字符串');
    assert.strictEqual(normalizeQuoteEntry({}), null);
    assert.strictEqual(normalizeQuoteEntry('   '), null);
    assert.strictEqual(normalizeQuoteEntry(null), null);
  });

  it('applyCount：0/缺省/非法 = 全部；>0 取前 N（稳定顺序）', () => {
    const list = normalizeQuoteList(['a', 'b', 'c', 'd']);
    assert.strictEqual(applyCount(list, 0).length, 4);
    assert.strictEqual(applyCount(list, undefined).length, 4);
    assert.strictEqual(applyCount(list, -2).length, 4);
    assert.strictEqual(applyCount(list, 'x').length, 4);
    assert.deepStrictEqual(applyCount(list, 2).map(q => q.text), ['a', 'b']);
    assert.deepStrictEqual(applyCount(list, 2.9).map(q => q.text), ['a', 'b']);
    assert.deepStrictEqual(applyCount(list, 99).map(q => q.text), ['a', 'b', 'c', 'd']);
  });
});

describe('resolveDailyQuotes 构建优先级与回退', () => {
  function makeHelpers() {
    return createHelpersModule({
      rootDir: ROOT,
      staticDir: path.join(ROOT, 'static'),
      watchMode: false,
      showDrafts: false,
      getJson5: () => json5,
      getBuildErrors: () => null
    });
  }

  function withWarnCapture(fn) {
    const original = console.warn;
    const warnings = [];
    console.warn = function (msg) { warnings.push(String(msg)); };
    try {
      const result = fn();
      return { result, warnings };
    } finally {
      console.warn = original;
    }
  }

  it('builtin 默认读取 data/quotes.json5（count 0 = 全部 100 条）', () => {
    const { resolveDailyQuotes } = makeHelpers();
    const quotes = resolveDailyQuotes({ features: { dailyQuote: { source: 'builtin', count: 0 } } });
    assert.strictEqual(quotes.length, 100);
    assert.strictEqual(quotes[0].text, RAW_LIST[0].text, '稳定顺序');
  });

  it('count>0 取前 N（向后兼容）', () => {
    const { resolveDailyQuotes } = makeHelpers();
    const quotes = resolveDailyQuotes({ features: { dailyQuote: { source: 'builtin', count: 3 } } });
    assert.strictEqual(quotes.length, 3);
    assert.deepStrictEqual(quotes.map(q => q.text), RAW_LIST.slice(0, 3).map(q => q.text));
  });

  it('dataFile 缺失：告警并回退代码内置最小集（5 条，含中英字段）', () => {
    const { resolveDailyQuotes } = makeHelpers();
    const { result, warnings } = withWarnCapture(() => resolveDailyQuotes({ features: { dailyQuote: { source: 'builtin', dataFile: 'data/__missing__.json5', count: 0 } } }));
    assert.strictEqual(result.length, 5);
    assert.ok(result[0].textEn, '内置回退条目也含英文');
    assert.ok(warnings.some(w => w.includes('不存在')), '必须告警：' + warnings.join('|'));
  });

  it('自定义 source 路径：读取并应用 count；加载失败回退内置并告警', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-quotes-'));
    const file = path.join(dir, 'custom.json5');
    fs.writeFileSync(file, "[{ text: '甲', author: '作者' }, '乙']\n", 'utf-8');
    try {
      const { resolveDailyQuotes } = makeHelpers();
      const ok = resolveDailyQuotes({ features: { dailyQuote: { source: file, count: 1 } } });
      assert.strictEqual(ok.length, 1);
      assert.strictEqual(ok[0].text, '甲');
      const { result, warnings } = withWarnCapture(() => resolveDailyQuotes({ features: { dailyQuote: { source: path.join(dir, 'nope.json'), count: 0 } } }));
      assert.strictEqual(result.length, 100, '外部加载失败应回退 dataFile 数据');
      assert.ok(warnings.some(w => w.includes('加载失败')), '必须告警');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('features.dailyQuote schema 默认值', () => {
  it('新增键默认值与 features.json5 同步', () => {
    const dq = DEFAULT_FEATURES.dailyQuote;
    assert.strictEqual(dq.dataFile, 'data/quotes.json5');
    assert.strictEqual(dq.count, 0);
    assert.strictEqual(dq.refreshLabel, '换一句');
    assert.strictEqual(dq.refreshLabelEn, 'Another');
    assert.strictEqual(dq.copyLabel, '复制');
    assert.strictEqual(dq.copyLabelEn, 'Copy');
    assert.strictEqual(dq.copiedLabel, '已复制');
    assert.strictEqual(dq.copiedLabelEn, 'Copied');
    const features = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
    assert.deepStrictEqual(features.dailyQuote.dataFile, dq.dataFile);
    assert.strictEqual(features.dailyQuote.count, dq.count);
  });

  it('api 子块默认值与 features.json5 同步', () => {
    const dq = DEFAULT_FEATURES.dailyQuote;
    assert.deepStrictEqual(dq.api, {
      enabled: true,
      endpoint: 'https://v1.hitokoto.cn/',
      categories: ['d', 'i', 'k'],
      maxLength: 0,
      timeoutMs: 5000,
      minIntervalMs: 1000,
      attributionText: '来源：一言'
    });
    const features = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
    assert.deepStrictEqual(features.dailyQuote.api, dq.api, 'features.json5 的 api 子块必须与 schema 默认值一致');
  });
});
