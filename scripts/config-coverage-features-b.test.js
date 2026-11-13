'use strict';
// 配置开关覆盖证据（features 剩余 slice）：证明每个开关的值真的改变产物。
// 证据面（按「最接近消费点」优先）：
//   1. site-css.ejs 产物：经真实 createPagesModule().buildSiteCss() 渲染 templates/site-css.ejs，
//      断言 CSS 文本随开关变化（非默认值 → 特定规则出现/消失）。
//   2. 页面产物：经真实 createPagesModule().generatePages() + createRenderModule().renderPage()
//      渲染 templates/*.ejs，断言 HTML 标记随开关变化。
//   3. 构建工厂：assets（Service Worker 预缓存）、security-files（speculation-rules.json）、
//      feeds（sitemap ping 开关与超时）、report（性能预算门禁）。
//   4. 运行时载荷：仅在 js/ 消费的开关——断言值进入浏览器收到的 external 配置（含翻转后
//      payload 文本与内容寻址名随之变化）。
// 运行：node --test scripts/config-coverage-features-b.test.js（由 npm test 统一收集）。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const json5 = require('json5');
const deepmerge = require('deepmerge');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

const { createConfigModule } = require('./build/config.js');
const { createPagesModule } = require('./build/pages.js');
const { createRenderModule } = require('./build/render.js');
const { createAssetsModule } = require('./build/assets.js');
const { createSecurityFilesModule } = require('./build/security-files.js');
const { createFeedsModule } = require('./build/feeds.js');
const { createReportModule } = require('./build/report.js');
const w = require('./lib/feature-wiring.js');
const { buildRuntimeConfig, configUrlName } = require('./lib/config-split.js');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { extractToc } = require('./lib/utils.js');
const { orderSeriesArticles } = require('./lib/series-page.js');
const { computeRelatedArticles } = require('./lib/related.js');

// ---------------------------------------------------------------------------
// 基础夹具：真实配置（createConfigModule().loadConfig() 读仓库 *.json5 + 内置默认值）。
// watchMode=true 使配置错误抛错而不是 process.exit，避免测试进程被打断。
// ---------------------------------------------------------------------------
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-cfgcov-'));
}

function readTemplate(name) {
  const file = path.join(TEMPLATES_DIR, name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
}

const securityStub = createSecurityFilesModule({
  distDir: '',
  cspNonce: 'STUB',
  applyHeaderHardening: function (security) { return (security && security.headers) || {}; },
  buildSitemapUrls: function () { return []; },
  bundleActive: true,
  recordBuildFailure: function () {}
});

const configMod = createConfigModule({
  rootDir: ROOT,
  watchMode: true,
  getJson5: function () { return json5; },
  getDeepmerge: function () { return deepmerge; },
  getVendorFonts: function () { return {}; },
  buildCspTrimContext: function (config) { return securityStub.buildCspTrimContext(config); }
});

let SEED = null;
function baseConfig() {
  if (!SEED) {
    SEED = configMod.loadConfig();
    // 夹具不变量（两侧渲染完全一致，唯一变量是被测开关）：
    // 单语言 / 关闭额外页面族 / 打开 reward 与订阅条所需的站点侧配置。
    SEED.site.languages = ['zh'];
    SEED.site.build = Object.assign({}, SEED.site.build, {
      generateArchive: false,
      generateTags: false,
      generateCategories: false,
      generateGallery: false,
      generateIndex: true
    });
    SEED.site.reward = Object.assign({}, SEED.site.reward, {
      enabled: true,
      wechat: { label: '微信', url: 'https://example.com/wx', image: '' }
    });
    SEED.features.continueReading.enabled = false;
    SEED.features.subscribe.newsletterUrl = 'https://example.com/news';
  }
  return clone(SEED);
}

function setDeep(target, dotted, value) {
  const parts = String(dotted).split('.');
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ---------------------------------------------------------------------------
// 页面模块 ctx（真实模板 + 真实渲染器：templates/*.ejs 由 ejs 实际执行）
// ---------------------------------------------------------------------------
function pagesCtx(distDir) {
  const ctx = {
    distDir: distDir,
    templatesDir: TEMPLATES_DIR,
    pagesDir: path.join(distDir, '__no_pages__'),
    articlesDir: path.join(distDir, '__no_articles__'),
    CleanCSS: null,
    getTemplate: readTemplate,
    getPublished: function (list) { return (list || []).filter(function (a) { return !a.draft; }); },
    recordBuildFailure: function () {},
    collectFriends: function () { return null; },
    collectSeries: function () { return []; },
    collectGalleryImages: function () { return []; },
    collectSiteStats: function () { return { posts: 0, words: 0, tags: 0, categories: 0 }; },
    collectTags: function () { return []; },
    collectCategories: function () { return []; },
    collectTopTags: function () { return []; },
    groupByYearMonth: function () { return []; },
    categoryHue: function () { return 0; },
    resolveDailyQuotes: function () { return []; },
    resolveFaviconHtml: function () { return ''; },
    getMediaManifest: function () { return null; },
    getAutoCovers: function () { return {}; },
    setInlineConfigKb: function () {},
    getIncrementalContext: function () { return { active: false, fingerprintHash: 'sha1' }; },
    loadBuildCache: function () { return { pages: {} }; },
    saveBuildCache: function () {}
  };
  Object.defineProperty(ctx, 'cspNonce', { enumerable: true, get: function () { return 'NONCE-T'; } });
  ctx.renderPage = createRenderModule(ctx).renderPage;
  return ctx;
}

function fixtureArticles() {
  function mk(slug) {
    return {
      slug: slug,
      lang: 'zh',
      langPrefix: '/zh/',
      title: 'T-' + slug,
      url: '/zh/' + slug + '/',
      date: '2024-01-01',
      modified: '2024-01-02',
      formattedDate: '2024-01-01',
      tags: ['alpha'],
      categories: ['cat'],
      draft: false,
      pinned: false,
      series: null,
      content: '<p>body</p>',
      excerpt: 'e',
      hasCode: false,
      hasMath: false,
      hasMermaid: false,
      featuredImage: '',
      filename: slug + '.md',
      readTime: 3,
      wordCount: 120
    };
  }
  return [mk('a'), mk('b')];
}

// 渲染整站 HTML（真实模板）。返回 { 相对路径 → HTML 文本 }。
async function renderSite(config) {
  const dir = tmpdir();
  try {
    // 相关推荐由编排器（scripts/build.js）在页面生成前写入 article.relatedArticles，
    // 这里调用同一个生产函数，保证 templates/post.ejs 的 related 判定可被测。
    const articles = fixtureArticles();
    computeRelatedArticles(articles, (config.features && config.features.related) || {});
    await createPagesModule(pagesCtx(dir)).generatePages(config, articles, null, []);
    const out = {};
    (function walk(abs, rel) {
      for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        const childAbs = path.join(abs, entry.name);
        const childRel = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) walk(childAbs, childRel);
        else if (/\.html?$/i.test(entry.name)) out[childRel] = fs.readFileSync(childAbs, 'utf-8');
      }
    })(dir, '');
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 渲染 site CSS（真实 templates/site-css.ejs → buildSiteCss 产物文件）。
function renderCss(config) {
  const dir = tmpdir();
  try {
    const pages = createPagesModule(pagesCtx(dir));
    const baseData = pages.buildPageData(config, [], [], [], []);
    pages.buildSiteCss(config, baseData);
    const cssDir = path.join(dir, String(config.site.build.cssOutDir || 'assets/css'));
    const file = fs.readdirSync(cssDir).filter(function (f) { return /\.css$/.test(f); }).sort()[0];
    assert.ok(file, 'site CSS 产物缺失');
    return fs.readFileSync(path.join(cssDir, file), 'utf-8');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function cssRule(css, selectorStart) {
  const at = css.indexOf(selectorStart);
  if (at === -1) return '';
  const end = css.indexOf('}', at);
  return css.slice(at, end === -1 ? css.length : end + 1);
}

function jsonLdText(html) {
  const out = [];
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html)) !== null) out.push(match[1]);
  return out.join('\n');
}

function footerBlock(html) {
  const at = html.indexOf('footer-subscribe');
  if (at === -1) return '';
  const end = html.indexOf('</footer>', at);
  return html.slice(at, end === -1 ? at + 4000 : end);
}

function assertText(haystack, needles, where) {
  const missing = (needles || []).filter(function (needle) { return haystack.indexOf(needle) === -1; });
  assert.deepStrictEqual(missing, [], where + '：缺少标记 ' + JSON.stringify(missing));
}

function assertNoText(haystack, needles, where) {
  const present = (needles || []).filter(function (needle) { return haystack.indexOf(needle) !== -1; });
  assert.deepStrictEqual(present, [], where + '：不应出现标记 ' + JSON.stringify(present));
}

// ---------------------------------------------------------------------------
// 1. site-css 产物（CSS 变量/规则随开关变化）
// ---------------------------------------------------------------------------
test('site-css：过渡/滚动/打印/代码高亮/PWA 样式随 features 开关变化', () => {
  // switch: features.pageTransition.durationMs, features.pageTransition.enabled, features.pageTransition.type, features.scrollBehavior.behavior, features.scrollBehavior.enabled, features.scrollIndicator.gradient, features.printStyle.enabled, features.prismTheme.enabled, features.pwa.installPrompt, features.pwa.updatePrompt, features.viewTransition.durationMs, features.viewTransition.enabled, features.viewTransition.type
  const baseCfg = baseConfig();
  // 基线固定为「全部开启 + 默认语义」，保证两个方向的断言都指向被测键。
  baseCfg.features.pageTransition = { enabled: true, type: 'slide', durationMs: 180, reducedMotion: 'light' };
  baseCfg.features.viewTransition = { enabled: true, type: 'fade', durationMs: 180, reducedMotion: 'light' };
  baseCfg.features.scrollBehavior = { enabled: true, behavior: 'smooth', respectReducedMotion: true };
  baseCfg.features.scrollIndicator = { enabled: true, height: '2px', gradient: true, respectReducedMotion: true };
  baseCfg.features.printStyle = { enabled: true, hideInteractive: true };
  baseCfg.features.prismTheme = { enabled: true };
  baseCfg.features.pwa = Object.assign({}, baseCfg.features.pwa, { enabled: true, installPrompt: true, updatePrompt: true });
  const baseCss = renderCss(baseCfg);
  assertText(baseCss, ['fadeIn 0.18s', 'slideUp 0.18s'], '基线 pageTransition');
  assertText(baseCss, ['@view-transition{navigation:auto}', 'animation-duration:0.18s'], '基线 viewTransition');
  assertText(baseCss, ['html{scroll-behavior:smooth}'], '基线 scrollBehavior');
  assertText(cssRule(baseCss, '.scroll-progress{'), ['linear-gradient(90deg,var(--color-s),var(--color-a))'], '基线 scrollIndicator.gradient');
  assertText(baseCss, ['@media print{body::after{display:none}'], '基线 printStyle');
  assertText(baseCss, [':root{--prism-'], '基线 prismTheme');
  assertText(baseCss, ['.pwa-install-wrap{', '.pwa-update-bar{'], '基线 pwa 提示样式');
  assertNoText(baseCss, ['vtOut'], '基线 viewTransition.type=fade');

  const cases = [
    {
      key: 'pageTransition.enabled=false',
      mutate: function (cfg) { cfg.features.pageTransition.enabled = false; },
      has: ['.page-enter{animation:none}'],
      lacks: ['fadeIn 0.18s']
    },
    {
      key: 'pageTransition.type=fade',
      mutate: function (cfg) { cfg.features.pageTransition.type = 'fade'; },
      has: ['fadeIn 0.18s'],
      lacks: [',slideUp 0.18s']
    },
    {
      key: 'pageTransition.durationMs=350',
      mutate: function (cfg) { cfg.features.pageTransition.durationMs = 350; },
      has: ['fadeIn 0.35s', 'slideUp 0.35s'],
      lacks: ['fadeIn 0.18s']
    },
    {
      key: 'viewTransition.enabled=false',
      mutate: function (cfg) { cfg.features.viewTransition.enabled = false; },
      has: [],
      lacks: ['@view-transition{navigation:auto}', 'animation-duration:0.18s']
    },
    {
      key: 'viewTransition.type=slide',
      mutate: function (cfg) { cfg.features.viewTransition.type = 'slide'; },
      has: ['@keyframes vtOut', 'animation-name:vtOut'],
      lacks: []
    },
    {
      key: 'viewTransition.durationMs=500',
      mutate: function (cfg) { cfg.features.viewTransition.durationMs = 500; },
      has: ['animation-duration:0.5s'],
      lacks: ['animation-duration:0.18s']
    },
    {
      key: 'scrollBehavior.behavior=auto',
      mutate: function (cfg) { cfg.features.scrollBehavior.behavior = 'auto'; },
      has: ['html{scroll-behavior:auto}'],
      lacks: ['html{scroll-behavior:smooth}']
    },
    {
      key: 'scrollBehavior.enabled=false',
      mutate: function (cfg) { cfg.features.scrollBehavior.enabled = false; },
      has: ['html{scroll-behavior:auto}'],
      lacks: ['html{scroll-behavior:smooth}']
    },
    {
      key: 'scrollIndicator.gradient=false',
      mutate: function (cfg) { cfg.features.scrollIndicator.gradient = false; },
      rule: '.scroll-progress{',
      has: ['background:var(--color-s)'],
      lacks: ['linear-gradient(90deg']
    },
    {
      key: 'printStyle.enabled=false',
      mutate: function (cfg) { cfg.features.printStyle.enabled = false; },
      has: [],
      lacks: ['@media print{body::after{display:none}']
    },
    {
      key: 'prismTheme.enabled=false',
      mutate: function (cfg) { cfg.features.prismTheme.enabled = false; },
      has: [],
      lacks: [':root{--prism-']
    },
    {
      key: 'pwa.installPrompt=false',
      mutate: function (cfg) { cfg.features.pwa.installPrompt = false; },
      has: ['.pwa-update-bar{'],
      lacks: ['.pwa-install-wrap{']
    },
    {
      key: 'pwa.updatePrompt=false',
      mutate: function (cfg) { cfg.features.pwa.updatePrompt = false; },
      has: ['.pwa-install-wrap{'],
      lacks: ['.pwa-update-bar{']
    }
  ];

  for (const item of cases) {
    const cfg = baseConfig();
    cfg.features.pageTransition = clone(baseCfg.features.pageTransition);
    cfg.features.viewTransition = clone(baseCfg.features.viewTransition);
    cfg.features.scrollBehavior = clone(baseCfg.features.scrollBehavior);
    cfg.features.scrollIndicator = clone(baseCfg.features.scrollIndicator);
    cfg.features.printStyle = clone(baseCfg.features.printStyle);
    cfg.features.prismTheme = clone(baseCfg.features.prismTheme);
    cfg.features.pwa = clone(baseCfg.features.pwa);
    item.mutate(cfg);
    const css = renderCss(cfg);
    assert.notStrictEqual(css, baseCss, item.key + '：CSS 产物必须变化');
    const scoped = item.rule ? cssRule(css, item.rule) : css;
    assert.ok(!item.rule || scoped, item.key + '：未找到规则 ' + item.rule);
    assertText(scoped, item.has, item.key);
    assertNoText(scoped, item.lacks, item.key);
  }
});

// ---------------------------------------------------------------------------
// 2. 页面产物（真实模板执行后 HTML 标记随开关变化）
// ---------------------------------------------------------------------------
test('页面产物：文章/首页/布局区块随 features 开关出现或消失', async () => {
  // switch: features.prevNext.enabled, features.readMode.enabled, features.readingHistory.enabled, features.readingPanel.enabled, features.readingTime.enabled, features.related.enabled, features.related.showCount, features.reward.enabled, features.scrollIndicator.enabled, features.share.enabled, features.speculation.enabled, features.speculation.toggle.show, features.softNavigation.enabled, features.softNavigation.toggle.show, features.subscribe.enabled, features.subscribe.jsonFeed, features.subscribe.rss, features.themePresets.enabled, features.tts.enabled, features.tts.rate, features.viewTransition.enabled, features.viewTransition.shared, features.viewTransition.toggle.show
  const baseCfg = baseConfig();
  // 基线显式打开被测区块（夹具不变量，两个方向断言都指向同一键）。
  baseCfg.features.prevNext = Object.assign({}, baseCfg.features.prevNext, { enabled: true, hideWhenMissing: false });
  baseCfg.features.readMode.enabled = true;
  baseCfg.features.readingPanel.enabled = true;
  baseCfg.features.readingTime.enabled = true;
  baseCfg.features.related = Object.assign({}, baseCfg.features.related, { enabled: true, showCount: false });
  baseCfg.features.reward.enabled = true;
  baseCfg.features.scrollIndicator = Object.assign({}, baseCfg.features.scrollIndicator, { enabled: true });
  baseCfg.features.share = Object.assign({}, baseCfg.features.share, { enabled: true });
  baseCfg.features.speculation = Object.assign({}, baseCfg.features.speculation, { enabled: true, toggle: { show: true } });
  baseCfg.features.softNavigation = Object.assign({}, baseCfg.features.softNavigation, { enabled: true, toggle: { show: true } });
  baseCfg.features.subscribe = Object.assign({}, baseCfg.features.subscribe, { enabled: true, rss: true, jsonFeed: true });
  baseCfg.features.themePresets.enabled = true;
  baseCfg.features.tts = Object.assign({}, baseCfg.features.tts, { enabled: true, rate: 0.5 });
  baseCfg.features.viewTransition = Object.assign({}, baseCfg.features.viewTransition, { enabled: true, shared: true, toggle: { show: true } });
  baseCfg.features.readingHistory.enabled = true;
  baseCfg.site.rss = Object.assign({}, baseCfg.site.rss, { enabled: true, jsonFeed: Object.assign({}, baseCfg.site.rss && baseCfg.site.rss.jsonFeed, { enabled: true }) });

  const baseHtml = await renderSite(baseCfg);
  const baseAll = Object.keys(baseHtml).map(function (k) { return baseHtml[k]; }).join('\n');
  const basePost = baseHtml['zh/a/index.html'];
  assert.ok(basePost, '文章页缺失：' + Object.keys(baseHtml).join(','));
  const baseIndex = baseHtml['zh/index.html'];
  assert.ok(baseIndex, '首页缺失');
  assertText(baseAll, ['post-navigation', 'reading-mode-btn', 'reader-panel',
    'post-reading-time', 'related-posts', 'reward-bar', 'share-row', 'footer-subscribe',
    'id="readingHistory"', 'class="scroll-progress" aria-hidden="true"', 'read-tts-btn',
    'data-vt="title-a"', 'id="nbVt"', 'id="nbSp"', 'id="nbSn"', 'data-preset-wrap'], '基线页面');
  assertText(footerBlock(baseAll), ['class="fs-btn" href="/zh/feed.xml"', 'class="fs-btn" href="/zh/feed.json"'], '基线订阅条');

  const cases = [
    { key: 'prevNext.enabled=false', mutate: function (c) { c.features.prevNext.enabled = false; }, lacks: ['post-navigation'] },
    { key: 'readMode.enabled=false', mutate: function (c) { c.features.readMode.enabled = false; }, lacks: ['reading-mode-btn'] },
    { key: 'readingPanel.enabled=false', mutate: function (c) { c.features.readingPanel.enabled = false; }, lacks: ['reader-panel'] },
    { key: 'readingTime.enabled=false', mutate: function (c) { c.features.readingTime.enabled = false; }, lacks: ['post-reading-time'] },
    { key: 'related.enabled=false', mutate: function (c) { c.features.related.enabled = false; }, lacks: ['related-posts'] },
    { key: 'related.showCount=true', mutate: function (c) { c.features.related.showCount = true; }, has: ['related-post-count'] },
    { key: 'reward.enabled=false', mutate: function (c) { c.features.reward.enabled = false; }, lacks: ['reward-bar'] },
    { key: 'share.enabled=false', mutate: function (c) { c.features.share.enabled = false; }, lacks: ['share-row'] },
    { key: 'subscribe.enabled=false', mutate: function (c) { c.features.subscribe.enabled = false; }, lacks: ['footer-subscribe'] },
    { key: 'subscribe.rss=false', mutate: function (c) { c.features.subscribe.rss = false; }, scope: 'footer', has: ['class="fs-btn" href="/zh/feed.json"'], lacks: ['class="fs-btn" href="/zh/feed.xml"'] },
    { key: 'subscribe.jsonFeed=false', mutate: function (c) { c.features.subscribe.jsonFeed = false; }, scope: 'footer', has: ['class="fs-btn" href="/zh/feed.xml"'], lacks: ['class="fs-btn" href="/zh/feed.json"'] },
    { key: 'tts.enabled=false', mutate: function (c) { c.features.tts.enabled = false; }, lacks: ['read-tts-btn'] },
    { key: 'tts.rate=1.5', mutate: function (c) { c.features.tts.rate = 1.5; }, has: ['data-rate="1.5"'], lacks: ['data-rate="0.5"'] },
    { key: 'viewTransition.enabled=false', mutate: function (c) { c.features.viewTransition.enabled = false; }, lacks: ['id="nbVt"'] },
    { key: 'viewTransition.shared=false', mutate: function (c) { c.features.viewTransition.shared = false; }, lacks: ['data-vt="'] },
    { key: 'viewTransition.toggle.show=false', mutate: function (c) { c.features.viewTransition.toggle.show = false; }, lacks: ['id="nbVt"'], has: ['id="nbSp"', 'id="nbSn"'] },
    { key: 'speculation.enabled=false', mutate: function (c) { c.features.speculation.enabled = false; }, lacks: ['id="nbSp"'] },
    { key: 'speculation.toggle.show=false', mutate: function (c) { c.features.speculation.toggle.show = false; }, lacks: ['id="nbSp"'], has: ['id="nbVt"', 'id="nbSn"'] },
    { key: 'softNavigation.enabled=false', mutate: function (c) { c.features.softNavigation.enabled = false; }, lacks: ['id="nbSn"'] },
    { key: 'softNavigation.toggle.show=false', mutate: function (c) { c.features.softNavigation.toggle.show = false; }, lacks: ['id="nbSn"'], has: ['id="nbVt"', 'id="nbSp"'] },
    { key: 'scrollIndicator.enabled=false', mutate: function (c) { c.features.scrollIndicator.enabled = false; }, lacks: ['class="scroll-progress" aria-hidden="true"'] },
    { key: 'readingHistory.enabled=false', mutate: function (c) { c.features.readingHistory.enabled = false; }, lacks: ['id="readingHistory"'] },
    { key: 'themePresets.enabled=false', mutate: function (c) { c.features.themePresets.enabled = false; }, lacks: ['data-preset-wrap'] }
  ];

  for (const item of cases) {
    const cfg = clone(baseCfg);
    item.mutate(cfg);
    const html = await renderSite(cfg);
    const all = Object.keys(html).map(function (k) { return html[k]; }).join('\n');
    assert.notStrictEqual(all, baseAll, item.key + '：页面产物必须变化');
    const scoped = item.scope === 'footer' ? footerBlock(all) : all;
    assertText(scoped, item.has, item.key);
    assertNoText(scoped, item.lacks, item.key);
  }
});

// ---------------------------------------------------------------------------
// 2b. 页面产物：文章 JSON-LD 的三个子开关（templates/layout.ejs 的 structuredData 块）
// ---------------------------------------------------------------------------
test('页面产物：文章 JSON-LD 的 image/keywords/wordCount 子开关', async () => {
  // switch: features.schemaRich.image, features.schemaRich.keywords, features.schemaRich.wordCount
  const cases = [
    { key: 'image', pick: 'image', marker: '"image":"https://' },
    { key: 'keywords', pick: 'keywords', marker: '"keywords"' },
    { key: 'wordCount', pick: 'wordCount', marker: '"wordCount"' }
  ];
  const baseline = await renderSite(baseConfig());
  const baselineJsonLd = jsonLdText(Object.keys(baseline).map(function (k) { return baseline[k]; }).join('\n'));
  assertText(baselineJsonLd, cases.map(function (c) { return c.marker; }), '基线 JSON-LD');

  for (const item of cases) {
    const cfg = baseConfig();
    cfg.features.schemaRich[item.pick] = false;
    const html = await renderSite(cfg);
    const jsonLd = jsonLdText(Object.keys(html).map(function (k) { return html[k]; }).join('\n'));
    assert.notStrictEqual(jsonLd, baselineJsonLd, 'schemaRich.' + item.key + '：JSON-LD 必须变化');
    assertNoText(jsonLd, [item.marker], 'schemaRich.' + item.key + '=false');
  }
});

// ---------------------------------------------------------------------------
// 3. 构建工厂：PWA 离线页（Service Worker 预缓存与回退 URL）
// ---------------------------------------------------------------------------
test('assets：features.pwa.offlinePage 决定 SW 的 OFFLINE_URL 与预缓存条目', () => {
  // switch: features.pwa.offlinePage
  function renderSw(offlinePage) {
    const dir = tmpdir();
    try {
      const config = baseConfig();
      config.features.pwa = Object.assign({}, config.features.pwa, { offlinePage: offlinePage, precache: true });
      const assets = createAssetsModule({ root: ROOT, distDir: dir, staticDir: path.join(ROOT, 'static'), cspNonce: 'NONCE' });
      assets.generateServiceWorker(config);
      const swFile = path.join(dir, String(config.site.pwa.serviceWorker || 'sw.js').replace(/^\//, ''));
      assert.ok(fs.existsSync(swFile), 'sw.js 未生成');
      return fs.readFileSync(swFile, 'utf-8');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  const on = renderSw(true);
  assert.match(on, /const OFFLINE_URL = "\/offline\.html"/, '关闭 → 开启时 OFFLINE_URL 指向离线页');
  assert.ok(on.indexOf('"/offline.html"') !== -1, '离线页应进入预缓存清单');
  const off = renderSw(false);
  assert.match(off, /const OFFLINE_URL = ""/, 'offlinePage=false 时 OFFLINE_URL 必须为空');
  assert.strictEqual(off.indexOf('/offline.html'), -1, 'offlinePage=false 时不得预缓存离线页');
});

// ---------------------------------------------------------------------------
// 4. 构建工厂：speculation 规则文件（delivery=header 时按 mode 分派）
// ---------------------------------------------------------------------------
test('security-files：features.speculation.mode 决定 speculation-rules.json 的规则种类', () => {
  // switch: features.speculation.mode
  function rules(mode) {
    const dir = tmpdir();
    try {
      const config = baseConfig();
      config.features.speculation = Object.assign({}, config.features.speculation, { enabled: true, delivery: 'header', mode: mode });
      const mod = createSecurityFilesModule({
        distDir: dir,
        cspNonce: 'NONCE',
        applyHeaderHardening: function (security) { return (security && security.headers) || {}; },
        buildSitemapUrls: function () { return []; },
        bundleActive: true,
        recordBuildFailure: function () {}
      });
      mod.generateSecurityHeaders(config);
      const file = path.join(dir, 'speculation-rules.json');
      assert.ok(fs.existsSync(file), 'speculation-rules.json 未生成');
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  const both = rules('both');
  assert.ok(both.prefetch && both.prerender, 'mode=both 必须同时输出 prefetch 与 prerender');
  const prefetch = rules('prefetch');
  assert.ok(prefetch.prefetch && !prefetch.prerender, 'mode=prefetch 只输出 prefetch');
  const prerender = rules('prerender');
  assert.ok(!prerender.prefetch && prerender.prerender, 'mode=prerender 只输出 prerender');
});

// ---------------------------------------------------------------------------
// 5. 构建工厂：搜索引擎 ping 开关与超时
// ---------------------------------------------------------------------------
test('feeds：features.searchEnginePing.enabled/timeoutMs 决定是否发请求与 AbortSignal 超时', async () => {
  // switch: features.searchEnginePing.enabled, features.searchEnginePing.timeoutMs
  const realFetch = global.fetch;
  const realTimeout = AbortSignal.timeout;
  const calls = [];
  const timeouts = [];
  AbortSignal.timeout = function (ms) {
    timeouts.push(ms);
    return realTimeout.call(AbortSignal, 50);
  };
  global.fetch = async function (url) {
    calls.push(String(url));
    return { ok: true, status: 200 };
  };
  const dir = tmpdir();
  try {
    const feeds = createFeedsModule({
      distDir: dir,
      serveMode: false,
      watchMode: false,
      recordBuildFailure: function () {},
      getFeed: function () { return null; },
      getPublished: function (list) { return list; },
      collectTags: function () { return []; },
      collectCategories: function () { return []; },
      collectSeries: function () { return []; }
    });

    const on = baseConfig();
    on.site.url = 'https://example.com';
    on.site.sitemap = Object.assign({}, on.site.sitemap, { enabled: true });
    on.features.searchEnginePing = { enabled: true, engines: ['bing'], timeoutMs: 4321 };
    await feeds.pingSearchEngines(on);
    assert.ok(calls.length > 0, 'enabled=true 时必须发出 ping 请求');
    assert.ok(calls.every(function (u) { return u.indexOf('bing.com/ping') !== -1; }));
    assert.ok(timeouts.length > 0 && timeouts.every(function (ms) { return ms === 4321; }),
      'AbortSignal 超时必须来自 features.searchEnginePing.timeoutMs（实测 ' + JSON.stringify(timeouts) + '）');

    calls.length = 0;
    timeouts.length = 0;
    on.features.searchEnginePing = { enabled: true, engines: ['bing'], timeoutMs: 987 };
    await feeds.pingSearchEngines(on);
    assert.ok(timeouts.length > 0 && timeouts.every(function (ms) { return ms === 987; }), '超时随配置变化');

    calls.length = 0;
    on.features.searchEnginePing = { enabled: false, engines: ['bing'], timeoutMs: 4321 };
    await feeds.pingSearchEngines(on);
    assert.deepStrictEqual(calls, [], 'enabled=false 时不得发出任何 ping 请求');
  } finally {
    global.fetch = realFetch;
    AbortSignal.timeout = realTimeout;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 6. 构建工厂：性能预算门禁
// ---------------------------------------------------------------------------
test('report：features.perfBudget.enabled/warnOnly 决定预算门禁是否运行与是否阻断', () => {
  // switch: features.perfBudget.enabled, features.perfBudget.warnOnly
  const dir = tmpdir();
  try {
    // 造一个必然超预算的产物页（gzip 后远大于 0.001KB）。
    fs.writeFileSync(path.join(dir, 'index.html'), '<html><body>' + 'x'.repeat(200000) + '</body></html>', 'utf-8');
    const report = createReportModule({
      distDir: dir,
      cspNonce: 'NONCE',
      getInlineConfigKb: function () { return 0; },
      compressionVerifyReportPath: path.join(dir, 'missing.json')
    });
    const cfg = baseConfig();
    cfg.features.perfBudget = { enabled: true, warnOnly: true, htmlKb: 0.001 };
    const warn = report.checkPerfBudget(cfg);
    assert.ok(warn && warn.ok === false, 'warnOnly=true 时必须返回超预算报告而不是抛错');

    const blocking = clone(cfg);
    blocking.features.perfBudget = { enabled: true, warnOnly: false, htmlKb: 0.001 };
    assert.throws(function () { report.checkPerfBudget(blocking); }, /性能预算超限/, 'warnOnly=false 时超预算必须阻断构建');

    const disabled = clone(cfg);
    disabled.features.perfBudget = { enabled: false, warnOnly: false, htmlKb: 0.001 };
    assert.strictEqual(report.checkPerfBudget(disabled), null, 'enabled=false 时门禁不运行（返回 null）');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 7. 目录层级（构建期 H2–H4 收集）
// ---------------------------------------------------------------------------
test('utils.extractToc：features.toc.minLevel/maxLevel 决定收录的标题层级', () => {
  // switch: features.toc.minLevel, features.toc.maxLevel
  const html = [
    '<h2 id="a">A<a class="heading-anchor" href="#a">#</a></h2>',
    '<h3 id="b">B<a class="heading-anchor" href="#b">#</a></h3>',
    '<h4 id="c">C<a class="heading-anchor" href="#c">#</a></h4>'
  ].join('');
  const levels = function (min, max) { return extractToc(html, min, max).map(function (x) { return x.level; }); };
  assert.deepStrictEqual(levels(2, 4), [2, 3, 4], '默认 2–4 全部收录');
  assert.deepStrictEqual(levels(3, 4), [3, 4], 'minLevel 抬高后不收录 h2');
  assert.deepStrictEqual(levels(2, 3), [2, 3], 'maxLevel 压低后不收录 h4');
});

// ---------------------------------------------------------------------------
// 8. 系列排序与字数总开关（构建期纯函数）
// ---------------------------------------------------------------------------
test('feature-wiring/series-page：features.series.order 与 features.wordCount.enabled', () => {
  // switch: features.series.order, features.wordCount.enabled
  const series = { name: 'S', articles: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }] };
  assert.deepStrictEqual(orderSeriesArticles(series, 'asc').map(function (a) { return a.slug; }), ['a', 'b', 'c']);
  assert.deepStrictEqual(orderSeriesArticles(series, 'desc').map(function (a) { return a.slug; }), ['c', 'b', 'a']);
  assert.strictEqual(w.seriesConfig({ series: { order: 'desc' } }).order, 'desc', 'seriesConfig.order 必须接线');
  assert.strictEqual(w.seriesConfig({ series: { order: 'asc' } }).order, 'asc');

  assert.strictEqual(w.wordCountConfig({ wordCount: { enabled: false } }).enabled, false);
  assert.strictEqual(w.wordCountConfig({ wordCount: { enabled: true } }).enabled, true);
  assert.strictEqual(w.wordCountConfig({}).enabled, true, '缺省启用以保持历史行为');
});

// ---------------------------------------------------------------------------
// 9. OG 封面：分类角标（scripts/generate-og.js 的 renderCover/chipLayer）
//    generate-og.js 末尾立即执行 main()，故在 vm 中加载到 main() 之前的部分，
//    直接调用真实渲染函数（源码零改动，仅去掉尾部 CLI 入口）。
// ---------------------------------------------------------------------------
function loadOgRenderer() {
  const file = path.join(ROOT, 'scripts', 'generate-og.js');
  const source = fs.readFileSync(file, 'utf-8');
  const cut = source.lastIndexOf('\nmain().catch');
  assert.ok(cut > 0, 'scripts/generate-og.js 结构变化：未找到尾部 main() 调用');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: console,
    Buffer: Buffer,
    URL: URL,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    process: process,
    require: function (id) {
      return require(id.charAt(0) === '.' ? path.join(ROOT, 'scripts', id) : id);
    },
    __dirname: path.join(ROOT, 'scripts'),
    __filename: file
  };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(0, cut), sandbox, { filename: file });
  assert.strictEqual(typeof sandbox.renderCover, 'function', 'generate-og.js 必须导出 renderCover 级别的渲染函数');
  return sandbox;
}

test('generate-og：features.ogImageStyle.showCategory 决定封面是否绘制分类角标', () => {
  // switch: features.ogImageStyle.showCategory
  const og = loadOgRenderer();
  const style = clone(baseConfig().features.ogImageStyle);
  function render(showCategory) {
    return og.renderCover({
      template: style.template || 'aurora',
      siteTitle: 'Site',
      siteUrl: 'https://example.com',
      lines: ['Title'],
      size: 60,
      lineHeight: 70,
      from: '#111111',
      to: '#222222',
      palette: { darkBg: '#000000', paperText: '#000000', darkText: '#ffffff' },
      category: '分类角标',
      style: Object.assign({}, style, { showCategory: showCategory })
    });
  }
  const on = render(true);
  const off = render(false);
  assert.notStrictEqual(on, off, 'showCategory 必须改变封面 SVG 字节');
  assert.ok(on.indexOf('分类角标') !== -1, 'showCategory=true 时必须输出分类文本');
  assert.strictEqual(off.indexOf('分类角标'), -1, 'showCategory=false 时不得输出分类文本');
});

// ---------------------------------------------------------------------------
// 10. 运行时载荷（仅在 js/ 消费的开关）：值必须进入浏览器收到的 external 配置
// ---------------------------------------------------------------------------
test('运行时载荷：仅 js 消费的开关随配置进入浏览器 external 配置', () => {
  // switch: features.popupNotice.removeDelayMs, features.pwa.offlineNotice, features.pwa.registerSW, features.pwa.updateCheckIntervalMs, features.pwa.updateToastMs, features.readDock.enabled, features.readingHistory.maxItems, features.readingProgress.enabled, features.searchHighlight.enabled, features.searchHighlight.maxMatches, features.share.popupWidth, features.sidebarDrag.enabled, features.softNavigation.timeoutMs, features.themeSchedule.enabled, features.toast.durationMs, features.toast.enabled, features.toast.position, features.toast.removeDelayMs, features.toc.collapsible, features.toc.enabled, features.tocScrollSpy.enabled
  const cases = [
    ['popupNotice.removeDelayMs', 777],
    ['pwa.offlineNotice', false],
    ['pwa.registerSW', false],
    ['pwa.updateCheckIntervalMs', 60000],
    ['pwa.updateToastMs', 5000],
    ['readDock.enabled', false],
    ['readingHistory.maxItems', 9],
    ['readingProgress.enabled', false],
    ['searchHighlight.enabled', false],
    ['searchHighlight.maxMatches', 7],
    ['share.popupWidth', 800],
    ['sidebarDrag.enabled', false],
    ['softNavigation.timeoutMs', 4321],
    ['themeSchedule.enabled', true],
    ['toast.durationMs', 1234],
    ['toast.enabled', false],
    ['toast.position', 'top-left'],
    ['toast.removeDelayMs', 4321],
    ['toc.collapsible', false],
    ['toc.enabled', false],
    ['tocScrollSpy.enabled', false]
  ];

  const defaultFeatures = clone(DEFAULT_FEATURES);
  const defaultPayload = JSON.stringify(buildRuntimeConfig({ features: defaultFeatures }).external);
  const defaultName = configUrlName(defaultPayload);

  for (const entry of cases) {
    const key = entry[0];
    const value = entry[1];
    const features = clone(DEFAULT_FEATURES);
    setDeep(features, key, value);
    const external = buildRuntimeConfig({ features: features }).external;
    const leaf = key.split('.').pop();
    const owner = key.split('.')[0];
    assert.deepStrictEqual(external.features[owner][leaf], value, key + ' 未进入运行时 external 配置');
    const payload = JSON.stringify(external);
    assert.notStrictEqual(payload, defaultPayload, key + '：载荷文本必须随值变化');
    assert.notStrictEqual(configUrlName(payload), defaultName, key + '：内容寻址配置名必须随值变化');
  }
});
