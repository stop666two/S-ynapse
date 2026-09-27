'use strict';
// 双语对照单测：
//   1. 纯函数（js/domains/features/bilingual-core.js）：配置归一化 / 对照 URL 判定 /
//      断点判定 / 提取净化决策 / 语言标头；并与 scripts/lib/feature-wiring.js 的
//      bilingualConfig 同值对拍（浏览器端就地实现与构建期 canonical 语义一致）；
//   2. 配置契约：features-schema 与 features.json5 的 bilingual 同步；
//   3. 构建/运行时接线：模板、样式、pages.js、软导航钩子与 deferred 注册（防键与实现脱节）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const CORE_PATH = path.join(ROOT, 'js', 'domains', 'features', 'bilingual-core.js');
let core = null;
async function loadCore() {
  if (!core) core = await import(pathToFileURL(CORE_PATH).href);
  return core;
}

const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { bilingualConfig } = require('./lib/feature-wiring.js');

test('resolveBilingualConfig：默认三开 + 1280；显式关闭；非法/越界断点夹取', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(c.resolveBilingualConfig({}), { enabled: true, switch: true, sideBySide: true, breakpointPx: 1280 });
  assert.deepStrictEqual(c.resolveBilingualConfig(null), { enabled: true, switch: true, sideBySide: true, breakpointPx: 1280 });
  assert.deepStrictEqual(
    c.resolveBilingualConfig({ enabled: false, switch: false, sideBySide: false, breakpointPx: 960 }),
    { enabled: false, switch: false, sideBySide: false, breakpointPx: 960 }
  );
  assert.strictEqual(c.resolveBilingualConfig({ breakpointPx: 'abc' }).breakpointPx, 1280, '非法回退 1280');
  assert.strictEqual(c.resolveBilingualConfig({ breakpointPx: 100 }).breakpointPx, 480, '下限夹取');
  assert.strictEqual(c.resolveBilingualConfig({ breakpointPx: 9999 }).breakpointPx, 3840, '上限夹取');
  assert.strictEqual(c.resolveBilingualConfig({ breakpointPx: '1440.4' }).breakpointPx, 1440, '取整');
});

test('bilingualConfig 与 bilingual-core 语义对拍（构建期 canonical = 运行时实现）', async () => {
  const c = await loadCore();
  const cases = [{}, null, { enabled: false }, { breakpointPx: 100 }, { breakpointPx: 9999 }, { breakpointPx: 'abc' }, { switch: false }];
  for (const raw of cases) {
    assert.deepStrictEqual(
      bilingualConfig({ bilingual: raw || undefined }),
      c.resolveBilingualConfig(raw),
      '对拍失败: ' + JSON.stringify(raw)
    );
  }
});

test('isAlternateHref：仅接受带目标语言段的站内绝对路径，拒绝外域/协议相对/查询锚点/穿越', async () => {
  const c = await loadCore();
  assert.strictEqual(c.isAlternateHref('/en/hello-world/', 'en'), true);
  assert.strictEqual(c.isAlternateHref('/en', 'en'), true, '语言根路径合法');
  assert.strictEqual(c.isAlternateHref('/zh/hello-world/', 'en'), false, '语言段不匹配');
  assert.strictEqual(c.isAlternateHref('https://example.com/en/x/', 'en'), false, '外域拒绝');
  assert.strictEqual(c.isAlternateHref('//example.com/en/x/', 'en'), false, '协议相对拒绝');
  assert.strictEqual(c.isAlternateHref('en/x/', 'en'), false, '相对路径拒绝');
  assert.strictEqual(c.isAlternateHref('/en/x/?q=1', 'en'), false, '查询串拒绝');
  assert.strictEqual(c.isAlternateHref('/en/x/#top', 'en'), false, '锚点拒绝');
  assert.strictEqual(c.isAlternateHref('/en/../zh/x/', 'en'), false, '目录穿越拒绝');
  assert.strictEqual(c.isAlternateHref('/en//x/', 'en'), false, '双斜杠拒绝');
  assert.strictEqual(c.isAlternateHref('', 'en'), false);
  assert.strictEqual(c.isAlternateHref('/en/x/', ''), false, '语言缺失拒绝');
});

test('shouldShowSideBySide：断点边界（含等于）、关闭开关、无对照、非法宽度', async () => {
  const c = await loadCore();
  const cfg = { sideBySide: true, breakpointPx: 1280 };
  assert.strictEqual(c.shouldShowSideBySide(cfg, true, 1280), true, '等于断点显示');
  assert.strictEqual(c.shouldShowSideBySide(cfg, true, 1279), false, '低于断点不显示');
  assert.strictEqual(c.shouldShowSideBySide(cfg, true, 1920), true);
  assert.strictEqual(c.shouldShowSideBySide({ sideBySide: false, breakpointPx: 1280 }, true, 1920), false, '开关关闭');
  assert.strictEqual(c.shouldShowSideBySide(cfg, false, 1920), false, '无对照不显示');
  assert.strictEqual(c.shouldShowSideBySide({}, true, NaN), false, '非法宽度');
  assert.strictEqual(c.shouldShowSideBySide({ sideBySide: true, breakpointPx: 'x' }, true, 1280), true, '断点非法回退默认');
});

test('paneCleanupSelectors：包含脚本/表单与工具条/评论/系列导航，保留正文内容本身', async () => {
  const c = await loadCore();
  const sels = c.paneCleanupSelectors();
  for (const need of ['script', 'style', 'iframe', 'form', '.post-header', '.post-actions', '.share-row', '.comments-section', '.series-nav', '.post-navigation']) {
    assert.ok(sels.includes(need), '净化清单缺少 ' + need);
  }
  assert.ok(sels.includes('.post-content>h1:first-child'), '净化清单缺少正文重复 h1 移除');
  assert.ok(!sels.some((s) => s === '.post-content' || s === 'img' || s === 'a' || s === 'p'), '正文内容本身不得被移除');
});

test('paneStripAttribute：剥离 id / data-vt / on*，保留普通属性', async () => {
  const c = await loadCore();
  assert.strictEqual(c.paneStripAttribute('id'), true);
  assert.strictEqual(c.paneStripAttribute('ID'), true, '大小写不敏感');
  assert.strictEqual(c.paneStripAttribute('data-vt'), true);
  assert.strictEqual(c.paneStripAttribute('data-vt-title'), true, 'data-vt 前缀连带剥离');
  assert.strictEqual(c.paneStripAttribute('onclick'), true);
  assert.strictEqual(c.paneStripAttribute('class'), false);
  assert.strictEqual(c.paneStripAttribute('href'), false);
  assert.strictEqual(c.paneStripAttribute('data-bilingual-alt'), false);
});

test('paneLanguageLabel：对方语言自称（en → English / 其余 → 中文）', async () => {
  const c = await loadCore();
  assert.strictEqual(c.paneLanguageLabel('en'), 'English');
  assert.strictEqual(c.paneLanguageLabel('zh'), '中文');
  assert.strictEqual(c.paneLanguageLabel(''), '中文');
});

test('配置契约：schema 默认与 features.json5 同步（开关/断点）', () => {
  assert.deepStrictEqual(DEFAULT_FEATURES.bilingual, { enabled: true, switch: true, sideBySide: true, breakpointPx: 1280 });
  const featuresRaw = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
  assert.deepStrictEqual(featuresRaw.bilingual, DEFAULT_FEATURES.bilingual, 'features.json5 与 schema 同步');
});

test('构建接线：pages.js 注入 altLangUrl；模板/样式/运行时引用 bilingual 契约', () => {
  const pages = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'pages.js'), 'utf-8');
  assert.ok(pages.includes('altLangUrl'), 'pages.js 未注入 altLangUrl');
  assert.ok(pages.includes("require('../lib/feature-wiring')") && pages.includes('bilingualConfig'), 'pages.js 未接线 bilingualConfig');
  const post = fs.readFileSync(path.join(ROOT, 'templates', 'post.ejs'), 'utf-8');
  for (const marker of ['bilingualWrap', 'bilingualSwitch', 'bilingualSide', 'bilingualPane', 'data-bilingual-alt', 'altArticle']) {
    assert.ok(post.includes(marker), 'post.ejs 缺少 ' + marker);
  }
  const layout = fs.readFileSync(path.join(ROOT, 'templates', 'layout.ejs'), 'utf-8');
  assert.ok(layout.includes('langBtn') && layout.includes('hidden'), 'layout.ejs 语言按钮缺少无对照隐藏门控');
  const css = fs.readFileSync(path.join(ROOT, 'templates', 'site-css.ejs'), 'utf-8');
  assert.ok(css.includes('.bilingual-wrap') && css.includes('.bilingual-pane'), 'site-css.ejs 缺少并排样式');
  const runtime = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'bilingual.js'), 'utf-8');
  assert.ok(runtime.includes('bilingual-core'), '运行时未复用核心纯函数');
  assert.ok(runtime.includes('__SOFTNAV_HOOKS__'), '运行时未注册软导航重扫钩子');
  const deferred = fs.readFileSync(path.join(ROOT, 'js', 'core', 'deferred.js'), 'utf-8');
  assert.ok(deferred.includes('bilingual'), 'deferred 未注册 bilingual');
  const main = fs.readFileSync(path.join(ROOT, 'js', 'core', 'main.js'), 'utf-8');
  assert.ok(main.includes("dyn('bilingual'"), 'main.js 未把 bilingual 放进按需队列');
  const i18n = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'i18n.js'), 'utf-8');
  assert.ok(i18n.includes('__softNav') && i18n.includes('navigate'), 'i18n 语言切换未走软导航');
});
