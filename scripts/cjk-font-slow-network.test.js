'use strict';
// 慢网/省流下不加载 CJK 字体分片（site.build.cjkFonts.slowNetwork）的接线回归。
// 背景（2G 性能）：首页 17 个 Noto Sans SC 分片合计约 877 KiB，占首屏 1129 KiB 字节的 78%，
// 250 kbps 下理论下载约 36s。分片只能由 cjk-fonts.css 的 @font-face 触发，而该 CSS 以
// media="print" 输出、由 layout.ejs 内联脚本翻回 media="all"——所以「不翻」即「0 个字体请求」。
// 本套件锁两件事：
//   1) 纯函数层 shouldLoadCjkFont 的判定表（saveData / slow-2g / 2g / 3g / 4g / 无 API / 'load'）；
//   2) 真实产物层：createPagesModule 渲染 templates/layout.ejs，把页面里的翻转脚本放进 vm +
//      假 DOM 实跑，断言 2G/省流时 link.media 保持 print（无字体请求），4G/无 API 时翻 all
//      （桌面行为不变），并锁定 'load' 策略产物不含跳过分支、脚本 < 300 字节。
// 运行：node --test scripts/cjk-font-slow-network.test.js

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const {
  shouldLoadCjkFont,
  normalizeSlowNetworkStrategy,
  CJK_SLOW_NETWORK_DEFAULT
} = require('./lib/cjk-fonts');
const { DEFAULT_CONFIG } = require('./lib/site-defaults');
const { DEFAULT_FEATURES } = require('./lib/features-schema');
const { createRenderModule } = require('./build/render');
const { createPagesModule } = require('./build/pages');
const { createCollectorsModule } = require('./build/collectors');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const collectors = createCollectorsModule({
  getPublished: function (list) { return list.filter(function (a) { return !a.draft; }); }
});
const tmpDirs = [];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

after(function () {
  for (const dir of tmpDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 清理失败不影响结论 */ }
  }
});

function tmpdir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

function article(slug) {
  return {
    slug: slug,
    lang: 'zh',
    langPrefix: '/zh/',
    title: 'T-' + slug,
    url: '/zh/' + slug + '/',
    date: '2024-01-01',
    modified: null,
    formattedDate: '2024-01-01',
    tags: ['alpha'],
    categories: ['cat'],
    draft: false,
    pinned: false,
    series: null,
    content: '<p>正文 ' + slug + '</p>',
    excerpt: '摘要 ' + slug,
    wordCount: 10,
    readTime: 1,
    toc: [],
    hasCode: false,
    hasMath: false,
    hasMermaid: false,
    featuredImage: '',
    filename: slug + '.md'
  };
}

// 站点渲染 ctx：真实 templates/ + 真实收集器，仅替换与开关无关的构建期状态
// （与 scripts/config-coverage-nonfeatures.test.js 的 siteCtx 同构）。
function pagesCtx(distDir) {
  const render = createRenderModule({
    templatesDir: TEMPLATES_DIR,
    cspNonce: 'CJKSLOWNONCE',
    recordBuildFailure: function () {},
    hooks: null
  });
  return {
    distDir: distDir,
    templatesDir: TEMPLATES_DIR,
    pagesDir: path.join(distDir, '__no_pages__'),
    articlesDir: path.join(distDir, '__no_articles__'),
    cspNonce: 'CJKSLOWNONCE',
    getTemplate: render.getTemplate,
    renderPage: render.renderPage,
    getPublished: function (list) { return list.filter(function (a) { return !a.draft; }); },
    recordBuildFailure: function () {},
    collectFriends: collectors.collectFriends,
    collectSeries: collectors.collectSeries,
    collectGalleryImages: collectors.collectGalleryImages,
    collectSiteStats: collectors.collectSiteStats,
    collectTags: collectors.collectTags,
    collectCategories: collectors.collectCategories,
    collectTopTags: collectors.collectTopTags,
    groupByYearMonth: collectors.groupByYearMonth,
    categoryHue: function () { return 0; },
    resolveDailyQuotes: function () { return []; },
    resolveFaviconHtml: function () { return '<link rel="icon" href="/icons/favicon.svg">'; },
    CleanCSS: null,
    getMediaManifest: function () { return null; },
    getAutoCovers: function () { return {}; },
    setInlineConfigKb: function () {},
    getIncrementalContext: function () { return { active: false, fingerprintHash: 'sha1' }; },
    loadBuildCache: function () { return {}; },
    saveBuildCache: function () {}
  };
}

function makeConfig(slowNetwork) {
  const cfg = clone(DEFAULT_CONFIG);
  cfg.features = clone(DEFAULT_FEATURES);
  // 翻转脚本只在 features.lcpOptimize.asyncCjkFontCss 开启时输出（生产默认值即 true）。
  cfg.features.lcpOptimize = Object.assign({}, cfg.features.lcpOptimize, { asyncCjkFontCss: true });
  cfg.site = Object.assign(cfg.site, {
    title: 'CJK Slow Site',
    url: 'https://example.com',
    description: '中文描述',
    language: 'zh-CN',
    languages: ['zh']
  });
  cfg.site.build = clone(DEFAULT_CONFIG.site.build);
  cfg.site.build.cjkFonts = Object.assign({}, DEFAULT_CONFIG.site.build.cjkFonts);
  if (slowNetwork === undefined) delete cfg.site.build.cjkFonts.slowNetwork;
  else cfg.site.build.cjkFonts.slowNetwork = slowNetwork;
  cfg.navigation.menu = [{ label: 'Home', url: '/' }];
  cfg.navigation.search = { enabled: false };
  return cfg;
}

const homeCache = new Map();

// 真实渲染首页（走 pages.js 的 buildPageData → templates/layout.ejs）。
function renderHome(slowNetwork) {
  const key = String(slowNetwork);
  if (!homeCache.has(key)) {
    homeCache.set(key, (async function () {
      const dir = tmpdir('s-ynapse-cjk-slow-');
      const config = makeConfig(slowNetwork);
      const articles = [article('a')];
      const mod = createPagesModule(pagesCtx(dir));
      const baseData = mod.buildPageData(config, articles, collectors.collectTags(articles), collectors.collectCategories(articles));
      await mod.generatePages(config, articles, baseData, []);
      return fs.readFileSync(path.join(dir, 'zh', 'index.html'), 'utf-8');
    })());
  }
  return homeCache.get(key);
}

// 取出紧跟在 data-cjk-css="1"> 之后的内联翻转脚本（本特性唯一一处）。
// 注：render 会给所有 <script> 注入 nonce 属性，故标签内部按通用属性匹配。
// 允许 link 与内联脚本之间存在空白（模板为可读性换行）。
const FLIP_RX = /data-cjk-css="1"[^>]*>\s*<script\b[^>]*>([\s\S]*?)<\/script>/;

function flipScript(html) {
  const m = FLIP_RX.exec(html);
  assert.ok(m, '页面必须输出带 data-cjk-css="1" 的字体样式与翻转脚本');
  return m[1];
}

// 在最小假 DOM 中实跑翻转脚本：sheet 为 null 时走 onload 分支（真实首屏路径）。
function runFlip(script, options) {
  const opts = options || {};
  // 新脚本会按网况决定是否把 data-cjk-href 赋给 href（2G 下连字体 CSS 都不请求），
  // 故假 link 必须支持属性读写。
  const attrs = Object.assign({ 'data-cjk-href': '/assets/css/cjk-fonts.css?v=test' }, opts.attrs || {});
  const link = {
    media: 'print', sheet: opts.sheet === undefined ? { cssRules: [] } : opts.sheet, onload: null,
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    _attrs: attrs
  };
  const sandbox = {
    navigator: opts.navigator === undefined ? { connection: opts.connection } : opts.navigator,
    document: {
      querySelector: function (selector) { return selector === 'link[data-cjk-css]' ? link : null; }
    }
  };
  vm.runInNewContext(script, sandbox, { timeout: 1000 });
  if (typeof link.onload === 'function') link.onload.call(link);
  return link;
}

// ---------------------------------------------------------------------------
// 纯函数层：判定表
// ---------------------------------------------------------------------------

test('shouldLoadCjkFont：无 connection / saveData / slow-2g / 2g / 3g / 4g / 缺失 navigator', function () {
  assert.strictEqual(CJK_SLOW_NETWORK_DEFAULT, 'skip', '默认策略必须是 skip');
  // 无 NetworkInformation API（Safari/Firefox 等）：不确定 → 按现状加载
  assert.strictEqual(shouldLoadCjkFont({}, 'skip'), true);
  assert.strictEqual(shouldLoadCjkFont(null, 'skip'), true);
  assert.strictEqual(shouldLoadCjkFont(undefined, 'skip'), true);
  // 省流开关优先于 effectiveType
  assert.strictEqual(shouldLoadCjkFont({ connection: { saveData: true, effectiveType: '4g' } }, 'skip'), false);
  // 慢网
  assert.strictEqual(shouldLoadCjkFont({ connection: { effectiveType: 'slow-2g' } }, 'skip'), false);
  assert.strictEqual(shouldLoadCjkFont({ connection: { effectiveType: '2g' } }, 'skip'), false);
  // 不慢
  assert.strictEqual(shouldLoadCjkFont({ connection: { effectiveType: '3g' } }, 'skip'), true);
  assert.strictEqual(shouldLoadCjkFont({ connection: { effectiveType: '4g' } }, 'skip'), true);
  // 'load' 策略忽略网况，无条件加载
  assert.strictEqual(shouldLoadCjkFont({ connection: { saveData: true } }, 'load'), true);
  assert.strictEqual(shouldLoadCjkFont({ connection: { effectiveType: '2g' } }, 'load'), true);
});

test('normalizeSlowNetworkStrategy：只认 "load"，其余一律回退 "skip"', function () {
  assert.strictEqual(normalizeSlowNetworkStrategy('load'), 'load');
  assert.strictEqual(normalizeSlowNetworkStrategy('skip'), 'skip');
  assert.strictEqual(normalizeSlowNetworkStrategy(undefined), 'skip');
  assert.strictEqual(normalizeSlowNetworkStrategy(''), 'skip');
  assert.strictEqual(normalizeSlowNetworkStrategy('LOAD'), 'skip');
  assert.strictEqual(normalizeSlowNetworkStrategy('fast'), 'skip');
  assert.strictEqual(normalizeSlowNetworkStrategy(true), 'skip');
});

// ---------------------------------------------------------------------------
// 产物层：模板 + 内联脚本实跑（两态都必须驱动行为差异）
// ---------------------------------------------------------------------------

test('slowNetwork=skip：2G/省流下媒体保持 print（0 个字体分片请求），4G/无 API 翻回 all', async () => {
  // switch: site.build.cjkFonts.slowNetwork
  const skipHtml = await renderHome('skip');
  const script = flipScript(skipHtml);

  // 跳过分支必须在产物里（网况判定 + 命令行既有的 data-cjk-css 契约）
  assert.ok(script.includes('navigator.connection'), 'skip 产物内联脚本必须包含网况判定');
  assert.ok(script.includes('saveData'), 'skip 产物必须识别省流开关');
  assert.ok(/\^\(slow-\)\?2g\$|2g/.test(script), 'skip 产物必须识别 slow-2g/2g');
  // 内联脚本位于 head、阻塞解析，必须保持极小；加上「按网况决定是否赋 href」后放宽到 450 字节。
  assert.ok(Buffer.byteLength(script) < 450, '内联脚本必须 < 450 字节，实测 ' + Buffer.byteLength(script));

  // 字体分片只由 cjk-fonts.css 触发：HTML 里不得出现任何 woff2 直链
  assert.ok(!/noto-sans-sc[^"']*\.woff2/.test(skipHtml), 'HTML 不得直接引用字体分片文件');

  // 2G / slow-2g / 省流：不翻 → media 仍是 print（= 浏览器不会应用 @font-face，不会下载分片）
  assert.strictEqual(runFlip(script, { connection: { effectiveType: '2g' } }).media, 'print');
  assert.strictEqual(runFlip(script, { connection: { effectiveType: 'slow-2g' } }).media, 'print');
  assert.strictEqual(runFlip(script, { connection: { saveData: true, effectiveType: '4g' } }).media, 'print');

  // 2G 下连字体 CSS 本身都不应被请求：href 不得被赋上（无 href 的 <link rel=stylesheet> 不发请求）。
  assert.strictEqual(runFlip(script, { connection: { effectiveType: '2g' }, attrs: {} }).getAttribute('href'), null);
  assert.strictEqual(runFlip(script, { connection: { effectiveType: '2g' }, attrs: {} }).media, 'print');
  // 宽带下必须把 data-cjk-href 赋给 href 再应用样式，否则字体永远不会加载。
  assert.strictEqual(runFlip(script, { connection: { effectiveType: '4g' }, attrs: {} }).getAttribute('href'), '/assets/css/cjk-fonts.css?v=test');

  // 桌面/宽带：行为与开启前一致（翻回 all，字体照常加载）
  assert.strictEqual(runFlip(script, { connection: { effectiveType: '4g' } }).media, 'all');
  assert.strictEqual(runFlip(script, { connection: { effectiveType: '3g' } }).media, 'all');
  // 无 navigator.connection：保守按「不确定 = 加载」
  assert.strictEqual(runFlip(script, { navigator: {} }).media, 'all');
  // 首屏真实路径：样式尚未就绪（sheet=null）→ 在 load 后翻 all
  assert.strictEqual(runFlip(script, { connection: { effectiveType: '4g' }, sheet: null }).media, 'all');
});

test('slowNetwork=load：产物不含跳过分支，2G 下同样翻回 all（忽略网况）', async () => {
  // switch: site.build.cjkFonts.slowNetwork
  const loadHtml = await renderHome('load');
  const skipHtml = await renderHome('skip');
  const script = flipScript(loadHtml);

  assert.ok(!script.includes('navigator.connection'), 'load 产物必须已剔除网况判定');
  assert.ok(!script.includes('saveData'), 'load 产物不得包含省流分支');
  assert.ok(Buffer.byteLength(script) < 300, '内联脚本必须 < 300 字节，实测 ' + Buffer.byteLength(script));
  // 与 skip 变体确实不同（两态产物字节必须可区分）
  assert.notStrictEqual(script, flipScript(skipHtml));
  assert.ok(Buffer.byteLength(script) < Buffer.byteLength(flipScript(skipHtml)), 'load 变体应更小');

  assert.strictEqual(runFlip(script, { connection: { effectiveType: '2g' } }).media, 'all');
  assert.strictEqual(runFlip(script, { connection: { saveData: true } }).media, 'all');
  assert.strictEqual(runFlip(script, { navigator: {} }).media, 'all');
});

test('slowNetwork 缺省或非法值回退 skip：2G 下同样不加载字体分片', async () => {
  // switch: site.build.cjkFonts.slowNetwork
  const cases = [undefined, 'fast', 'LOAD'];
  for (const value of cases) {
    const html = await renderHome(value);
    const script = flipScript(html);
    assert.ok(script.includes('navigator.connection'), String(value) + ' 必须回退到 skip 分支');
    assert.strictEqual(
      runFlip(script, { connection: { effectiveType: '2g' } }).media,
      'print',
      String(value) + ' 在 2G 下不得翻回 media=all'
    );
    assert.strictEqual(
      runFlip(script, { connection: { effectiveType: '4g' } }).media,
      'all',
      String(value) + ' 在 4G 下仍须恢复字体'
    );
  }
});
