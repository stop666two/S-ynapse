'use strict';
// 继续阅读单测：
//   1. 浏览器纯函数（js/domains/features/continue-reading.js 经 data URL 导入，与运行时同源）：
//      进度计算 / 记录归一化 / 排序过滤去重 / 上限 / 进度文案；
//   2. 数据契约：阅读历史记录含 lang/p 字段、continueReading 复用 readingHistory.storageKey；
//   3. schema 与 features.json5 默认值同步、ui-strings 双语齐备、index.ejs 隐藏 section。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const MODULE_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'continue-reading.js'), 'utf-8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(MODULE_SOURCE, 'utf-8').toString('base64'));
let loaded = null;
async function loadModule() {
  if (!loaded) loaded = await modulePromise;
  return loaded;
}

test('progressPct：边界与短页口径', async () => {
  const m = await loadModule();
  assert.strictEqual(m.progressPct(0, 1000, 400), 0);
  assert.strictEqual(m.progressPct(300, 1000, 400), 50);
  assert.strictEqual(m.progressPct(600, 1000, 400), 100);
  assert.strictEqual(m.progressPct(900, 1000, 400), 100, '超出上限夹取 100');
  assert.strictEqual(m.progressPct(-50, 1000, 400), 0, '负滚动夹取 0');
  assert.strictEqual(m.progressPct(100, 300, 400), 0, '短页无可滚动距离按 0');
  assert.strictEqual(m.progressPct(100, 400, 400), 0, '恰好无滚动距离按 0');
  assert.strictEqual(m.progressPct('x', 1000, 400), 0, '非法输入安全');
  assert.strictEqual(m.progressPct(200, 1000, 400), 33, '四舍五入');
});

test('normalizeItem：非法记录丢弃、字段归一化与进度夹取', async () => {
  const m = await loadModule();
  assert.strictEqual(m.normalizeItem(null), null);
  assert.strictEqual(m.normalizeItem('x'), null);
  assert.strictEqual(m.normalizeItem({}), null);
  assert.strictEqual(m.normalizeItem({ url: '/zh/a/', title: '  ' }), null, '空标题丢弃');
  assert.strictEqual(m.normalizeItem({ url: '', title: 'A' }), null, '空 URL 丢弃');
  const full = m.normalizeItem({ url: ' /zh/a/ ', title: ' 标题 ', t: 100, lang: 'zh', p: 42 });
  assert.deepStrictEqual(full, { url: '/zh/a/', title: '标题', t: 100, lang: 'zh', p: 42 });
  assert.strictEqual(m.normalizeItem({ url: '/a/', title: 'A', p: 150 }).p, 100, '进度上限 100');
  assert.strictEqual(m.normalizeItem({ url: '/a/', title: 'A', p: -3 }).p, 0, '进度下限 0');
  assert.strictEqual(m.normalizeItem({ url: '/a/', title: 'A', p: 'x' }).p, 0, '非法进度按 0');
  assert.strictEqual(m.normalizeItem({ url: '/a/', title: 'A', t: 'x' }).t, 0, '非法时间按 0');
});

test('selectRecent：时间倒序 / 过滤非法与当前页 / 同 URL 去重保留最新 / 上限', async () => {
  const m = await loadModule();
  const items = [
    { url: '/zh/a/', title: 'A旧', t: 100 },
    { url: '/zh/b/', title: 'B', t: 300 },
    { url: '/zh/a/', title: 'A新', t: 500 },
    { url: '/zh/c/', title: 'C', t: 200 },
    { url: '/zh/bad/', t: 999 },
    { url: '', title: '空URL', t: 999 },
    'garbage'
  ];
  const picked = m.selectRecent(items, { count: 10 });
  assert.deepStrictEqual(picked.map((x) => x.url), ['/zh/a/', '/zh/b/', '/zh/c/'], '去重保留最新且倒序');
  assert.strictEqual(picked[0].title, 'A新');
  assert.strictEqual(m.selectRecent(items, {}).length, 3, '默认上限 3');
  assert.strictEqual(m.selectRecent(items, { count: 2 }).length, 2);
  assert.strictEqual(m.selectRecent(items, { count: 0 }).length, 3, '非法上限回退 3');
  assert.deepStrictEqual(m.selectRecent(items, { count: 10, excludeUrl: '/zh/a/' }).map((x) => x.url), ['/zh/b/', '/zh/c/'], '排除当前页');
  assert.deepStrictEqual(m.selectRecent([], { count: 3 }), []);
  assert.deepStrictEqual(m.selectRecent(null, { count: 3 }), [], '非数组安全');
});

test('progressText：{percent} 占位符替换（双语模板）', async () => {
  const m = await loadModule();
  assert.strictEqual(m.progressText('已读 {percent}%', 42), '已读 42%');
  assert.strictEqual(m.progressText('{percent}% read', 7), '7% read');
  assert.strictEqual(m.progressText('{percent} / {percent}', 9), '9 / 9', '全部占位符替换');
  assert.strictEqual(m.progressText(null, 9), '');
  assert.strictEqual(m.progressText('无占位符', 9), '无占位符');
});

test('removeByUrl：按 URL 移除原始记录（不重写字段）、非数组/空 URL 安全', async () => {
  const m = await loadModule();
  const items = [
    { url: '/zh/a/', title: 'A', t: 3, lang: 'zh', p: 10, custom: 1 },
    { url: '/zh/b/', title: 'B', t: 2 },
    { url: '/zh/a/', title: 'A旧', t: 1 }
  ];
  const out = m.removeByUrl(items, '/zh/a/');
  assert.deepStrictEqual(out.map((x) => x.url), ['/zh/b/'], '同 URL 全部移除');
  assert.strictEqual(out[0].custom, undefined, '其余记录保持原样');
  const keep = m.removeByUrl(items, '/zh/b/');
  assert.strictEqual(keep[0].custom, 1, '保留原始记录字段（不得经归一化重写数据源）');
  assert.strictEqual(items.length, 3, '不得原地修改');
  assert.deepStrictEqual(m.removeByUrl(null, '/a/'), [], '非数组安全');
  assert.strictEqual(m.removeByUrl(items, '').length, 3, '空 URL 不改动');
  assert.deepStrictEqual(m.removeByUrl(items, '/zh/a/', 1).map((x) => x.url), ['/zh/b/'], '移除后按 maxStored 钳制');
});

test('capList：存储上限重算（保留最新、非法上限不改动、返回新数组）', async () => {
  const m = await loadModule();
  const items = [1, 2, 3, 4];
  assert.deepStrictEqual(m.capList(items, 2), [1, 2]);
  assert.deepStrictEqual(m.capList(items, 0), [1, 2, 3, 4], '非法上限不改动');
  assert.deepStrictEqual(m.capList(items), [1, 2, 3, 4], '缺省上限不改动');
  assert.deepStrictEqual(m.capList(null, 2), [], '非数组安全');
  assert.strictEqual(m.capList(items, 10).length, 4);
  assert.notStrictEqual(m.capList(items, 2), items, '返回新数组');
});

test('clearList：清空契约（任意输入均得空列表）', async () => {
  const m = await loadModule();
  assert.deepStrictEqual(m.clearList(), []);
  assert.deepStrictEqual(m.clearList([{ url: '/a/' }]), [], '参数不影响清空结果');
});

test('数据契约：阅读历史记录含 lang/p；continueReading 复用 readingHistory 存储键', () => {
  const historySrc = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'reading-history.js'), 'utf-8');
  assert.match(historySrc, /lang: lang\(\)/, '阅读历史记录必须写入语言字段');
  assert.match(historySrc, /p: prev && isFinite/, '阅读历史记录必须写入进度字段');
  assert.match(historySrc, /updateProgress/, '滚动/离页必须更新进度');
  const crSrc = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'continue-reading.js'), 'utf-8');
  assert.match(crSrc, /F\.storageKey \|\| RH\.storageKey/, 'continueReading 存储键回退 readingHistory.storageKey');
  assert.match(crSrc, /__SOFTNAV_HOOKS__\.push\(apply\)/, '软导航必须重绑渲染');
  assert.match(crSrc, /removeByUrl\(/, '移除必须经 removeByUrl 数据变换');
  assert.match(crSrc, /clearList\(/, '清空必须经 clearList 数据变换');
  assert.match(crSrc, /cr-remove/, '卡片必须渲染移除按钮');
  assert.match(crSrc, /cr-clear/, '区域头必须渲染清空按钮');
  assert.match(crSrc, /F\.maxStored|RH\.maxStored/, '存储上限必须取自 readingHistory.maxStored');
});

test('schema 与 features.json5：continueReading 键齐全且默认值一致', () => {
  const features = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
  const expected = {
    enabled: true, count: 3, showProgress: true, storageKey: 's-history',
    removeLabel: '移除', removeLabelEn: '', clearLabel: '清空', clearLabelEn: ''
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.strictEqual(features.continueReading[key], value, 'features.json5 continueReading.' + key);
    assert.strictEqual(DEFAULT_FEATURES.continueReading[key], value, 'schema continueReading.' + key);
  }
  assert.strictEqual(features.continueReading.storageKey, features.readingHistory.storageKey, '与阅读历史共用同一存储键');
});

test('ui-strings 双语与 index.ejs 隐藏 section', () => {
  const ui = json5.parse(fs.readFileSync(path.join(ROOT, 'ui-strings.json5'), 'utf-8'));
  for (const lang of ['zh', 'en']) {
    const dict = lang === 'zh' ? ui : ui.en;
    assert.ok(dict.continueReading.title, lang + ' continueReading.title 缺失');
    assert.match(dict.continueReading.progress, /\{percent\}/, lang + ' continueReading.progress 必须含 {percent} 占位符');
    assert.ok(dict.continueReading.remove, lang + ' continueReading.remove 缺失');
    assert.ok(dict.continueReading.clear, lang + ' continueReading.clear 缺失');
    assert.ok(dict.continueReading.clearConfirm, lang + ' continueReading.clearConfirm 缺失');
  }
  assert.notStrictEqual(ui.continueReading.progress, ui.en.continueReading.progress, '进度文案中英不得相同');
  assert.notStrictEqual(ui.continueReading.remove, ui.en.continueReading.remove, '移除文案中英不得相同');
  assert.notStrictEqual(ui.continueReading.clear, ui.en.continueReading.clear, '清空文案中英不得相同');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'templates', 'index.ejs'), 'utf-8');
  assert.match(indexSrc, /<section id="continueReading"[^\n]*hidden><\/section>/, 'index.ejs 必须预留隐藏 section');
});
