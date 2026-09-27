'use strict';
// 系列聚合页单测：
//   1. 纯函数（scripts/lib/series-page.js）：slug 生成 / 列表排序 / URL 组装 /
//      自动元数据 / 空系列不生成 / 跨语言对应匹配 / 开关判定；
//   2. 配置契约：features-schema 与 features.json5 的 pageEnabled 同步、seriesConfig 归一化；
//   3. 构建接线：模板存在、pages/feeds 引用（防键与页面生成脱节）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { seriesConfig } = require('./lib/feature-wiring.js');
const { safeSlug } = require('./lib/utils.js');
const {
  seriesPagesEnabled, orderSeriesArticles, seriesPageUrl, seriesPageMeta,
  findAlternateSeries, collectSeriesPages
} = require('./lib/series-page.js');

function mkSeries(name, slugs) {
  return { name, slug: safeSlug(name), count: slugs.length, articles: slugs.map((slug) => ({ slug, title: slug, url: '/zh/' + slug + '/' })) };
}

test('seriesPageUrl：/{lang}/series/{slug}/ 组装（含中文 slug 原样保留）', () => {
  assert.strictEqual(seriesPageUrl('zh', '建站手记'), '/zh/series/建站手记/');
  assert.strictEqual(seriesPageUrl('en', 'site-building-notes'), '/en/series/site-building-notes/');
  assert.strictEqual(seriesPageUrl('', 'x'), '/zh/series/x/', '语言缺失回退 zh');
});

test('orderSeriesArticles：asc 保持时间序、desc 倒序，均不修改原数组', () => {
  const series = mkSeries('S', ['a', 'b', 'c']);
  const asc = orderSeriesArticles(series, 'asc');
  assert.deepStrictEqual(asc.map((x) => x.slug), ['a', 'b', 'c']);
  const desc = orderSeriesArticles(series, 'desc');
  assert.deepStrictEqual(desc.map((x) => x.slug), ['c', 'b', 'a']);
  assert.deepStrictEqual(series.articles.map((x) => x.slug), ['a', 'b', 'c'], '输入数组不得被原地修改');
  assert.notStrictEqual(asc, series.articles, '返回新数组');
  assert.deepStrictEqual(orderSeriesArticles({}, 'asc'), [], '无 articles 安全');
  assert.deepStrictEqual(orderSeriesArticles(null, 'desc'), []);
});

test('seriesPageMeta：自动描述（zh/en）、空系列与无名系列返回 null（不生成页面）', () => {
  const zh = seriesPageMeta(mkSeries('建站手记', ['s1', 's2', 's3']), 'zh');
  assert.strictEqual(zh.title, '建站手记');
  assert.strictEqual(zh.description, '「建站手记」系列共 3 篇，按顺序阅读。');
  const en = seriesPageMeta(mkSeries('Site Building Notes', ['s1']), 'en');
  assert.strictEqual(en.title, 'Site Building Notes');
  assert.strictEqual(en.description, '"Site Building Notes" series — 1 post in reading order.');
  assert.strictEqual(seriesPageMeta(mkSeries('空系列', []), 'zh'), null, '空系列（0 篇）不生成');
  assert.strictEqual(seriesPageMeta({ name: '   ', articles: [{ slug: 'a' }] }, 'zh'), null, '空白名称不生成');
  assert.strictEqual(seriesPageMeta({ articles: [{ slug: 'a' }] }, 'en'), null, '缺名称不生成');
  assert.strictEqual(seriesPageMeta(null, 'zh'), null);
});

test('findAlternateSeries：文章 slug 集合完全一致才匹配（翻译版识别），否则 null', () => {
  const zh = mkSeries('建站手记', ['series-1', 'series-2', 'series-3']);
  const enMatch = mkSeries('Site Building Notes', ['series-1', 'series-2', 'series-3']);
  const enPartial = mkSeries('Partial', ['series-1', 'series-2']);
  const enDifferent = mkSeries('Other', ['a-1', 'a-2', 'a-3']);
  assert.strictEqual(findAlternateSeries(zh, [enPartial, enMatch]), enMatch, '跳过量级不符者取完全一致');
  assert.strictEqual(findAlternateSeries(zh, [enDifferent]), null);
  assert.strictEqual(findAlternateSeries(zh, []), null);
  assert.strictEqual(findAlternateSeries(mkSeries('X', []), [enMatch]), null, '空集合不匹配');
});

test('collectSeriesPages：排序/URL/altUrl 与空系列跳过', () => {
  const zhList = [
    mkSeries('建站手记', ['series-1', 'series-2', 'series-3']),
    mkSeries('空系列', [])
  ];
  const enList = [mkSeries('Site Building Notes', ['series-1', 'series-2', 'series-3'])];
  const pages = collectSeriesPages(zhList, 'zh', 'desc', enList, 'en');
  assert.strictEqual(pages.length, 1, '空系列不生成页面');
  assert.strictEqual(pages[0].slug, '建站手记');
  assert.strictEqual(pages[0].url, '/zh/series/建站手记/');
  assert.strictEqual(pages[0].altUrl, '/en/series/site-building-notes/');
  assert.strictEqual(pages[0].name, '建站手记');
  assert.deepStrictEqual(pages[0].articles.map((a) => a.slug), ['series-3', 'series-2', 'series-1'], 'desc 显示顺序');
  const noAlt = collectSeriesPages(zhList, 'zh', 'asc', [], 'en');
  assert.strictEqual(noAlt[0].altUrl, '', '无对应语言系列时 altUrl 为空');
  assert.deepStrictEqual(noAlt[0].articles.map((a) => a.slug), ['series-1', 'series-2', 'series-3']);
  const slugFallback = collectSeriesPages([{ name: '系列 A', articles: [{ slug: 'x' }] }], 'zh', 'asc');
  assert.strictEqual(slugFallback[0].slug, '系列-a', '缺 slug 时按 safeSlug(名称) 生成');
});

test('seriesPagesEnabled：enabled 与 pageEnabled 同时为真才生成（缺省 true）', () => {
  assert.strictEqual(seriesPagesEnabled({}), true);
  assert.strictEqual(seriesPagesEnabled({ series: { pageEnabled: false } }), false);
  assert.strictEqual(seriesPagesEnabled({ series: { enabled: false } }), false);
  assert.strictEqual(seriesPagesEnabled({ series: { enabled: true, pageEnabled: true } }), true);
});

test('配置契约：schema 与 features.json5 的 pageEnabled 同步；seriesConfig 默认与覆盖', () => {
  assert.strictEqual(DEFAULT_FEATURES.series.pageEnabled, true, 'schema 默认 true');
  const featuresRaw = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
  assert.strictEqual(featuresRaw.series.pageEnabled, true, 'features.json5 与 schema 同步');
  assert.strictEqual(seriesConfig({}).pageEnabled, true, '归一化缺省 true');
  assert.strictEqual(seriesConfig({ series: { pageEnabled: false } }).pageEnabled, false, '显式 false 生效');
  assert.strictEqual(seriesConfig({ series: { enabled: false } }).pageEnabled, true, 'enabled 与 pageEnabled 解耦');
});

test('构建接线：模板存在且引用关键数据；pages/feeds 消费 pageEnabled 与模板', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'series-page.ejs'), 'utf-8');
  for (const marker of ['series-item', 'series-item-index', 'series-item-progress', 'series-item-nav', 'seriesName', 'seriesArticles']) {
    assert.ok(tpl.includes(marker), 'series-page.ejs 缺少 ' + marker);
  }
  const pages = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'pages.js'), 'utf-8');
  assert.ok(pages.includes("require('../lib/series-page')"), 'pages.js 未接入 series-page 纯函数');
  assert.ok(pages.includes("'series-page.ejs'"), 'pages.js 未渲染 series-page.ejs');
  assert.ok(pages.includes('seriesCfg.pageEnabled'), 'pages.js 未消费 pageEnabled');
  const feeds = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'feeds.js'), 'utf-8');
  assert.ok(feeds.includes('series.pageEnabled'), 'sitemap 未消费 pageEnabled');
  assert.ok(feeds.includes("pf + 'series/'"), 'sitemap 未纳入系列页 URL');
});
