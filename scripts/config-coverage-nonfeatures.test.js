'use strict';
// 非 features 段配置开关的覆盖证据（config-switch-inventory 的 `// switch:` marker 口径）：
// 每个用例都用「非默认值 → 翻转取值」驱动真实消费方，断言只依赖该开关自身——
//   · 模板/页面族：createPagesModule + templates/ 真实渲染，读产物 HTML/CSS；
//   · 构建侧解析器：createConfigModule / createHelpersModule / createCollectorsModule；
//   · 生成物：_headers、robots.txt、media-manifest.json、压缩后的文件；
//   · internals.*：以子进程 + require 钩子运行真实 CLI（驱动层被替换，分支逻辑保持原样）。
// 运行：node --test scripts/config-coverage-nonfeatures.test.js

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

const { DEFAULT_CONFIG } = require('./lib/site-defaults');
const { DEFAULT_FEATURES } = require('./lib/features-schema');
const { createRenderModule } = require('./build/render');
const { createPagesModule } = require('./build/pages');
const { createCollectorsModule } = require('./build/collectors');
const { createConfigModule } = require('./build/config');
const { createMediaModule } = require('./build/media');
const { createMinifyModule } = require('./build/minify');
const { createSecurityFilesModule } = require('./build/security-files');
const { createCjkFontsModule } = require('./build/cjk-fonts');
const { createArticlesModule } = require('./build/articles');
const { createHelpersModule } = require('./build/helpers');
const { getAllFiles } = require('./build/fs-utils');

const collectors = createCollectorsModule({
  getPublished: function (list) { return list.filter(function (a) { return !a.draft; }); }
});
const tmpDirs = [];

function tmpdir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

after(function () {
  for (const dir of tmpDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 清理失败不影响结论 */ }
  }
});

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
}

function baseConfig() {
  const cfg = clone(DEFAULT_CONFIG);
  cfg.features = clone(DEFAULT_FEATURES);
  cfg.site = Object.assign(cfg.site, {
    title: 'Cover Site',
    url: 'https://example.com',
    description: '中文描述',
    descriptionEn: 'English description',
    language: 'zh-CN',
    languageEn: 'en-US',
    languages: ['zh', 'en']
  });
  cfg.navigation = clone(DEFAULT_CONFIG.navigation);
  cfg.navigation.menu = [{ label: 'Home', url: '/' }];
  cfg.navigation.search = { enabled: false };
  cfg.theme = clone(DEFAULT_CONFIG.theme);
  cfg.footer = clone(DEFAULT_CONFIG.footer);
  return cfg;
}

function article(slug, extra) {
  return Object.assign({
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
  }, extra || {});
}

// 站点渲染 ctx：真实模板（templates/）+ 真实收集器，仅替换与开关无关的构建期状态。
function siteCtx(distDir) {
  const render = createRenderModule({
    templatesDir: TEMPLATES_DIR,
    cspNonce: 'COVERNONCE',
    recordBuildFailure: function () {},
    hooks: null
  });
  return {
    distDir: distDir,
    templatesDir: TEMPLATES_DIR,
    pagesDir: path.join(distDir, '__no_pages__'),
    articlesDir: path.join(distDir, '__no_articles__'),
    cspNonce: 'COVERNONCE',
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

// 站点级开关的「全开 / 全关」两态配置：每个键在两态之间翻转。
function siteConfig(on) {
  const cfg = baseConfig();
  const build = Object.assign({}, DEFAULT_CONFIG.site.build);
  cfg.site.postsPerPage = on ? 2 : 10;
  cfg.site.hero = {
    enabled: on, title: 'Hero Title', subtitle: 'Hero Subtitle',
    showSearch: false, showTags: false, showCta: false, tagCount: 8
  };
  cfg.site.externalLinkWarning = { enabled: on, title: 'Link Warn' };
  cfg.site.seo = Object.assign({}, cfg.site.seo, { structuredData: { enabled: on, type: 'BlogPosting' } });
  cfg.site.reward = { enabled: on, note: '', custom: [], wechat: { label: '微信', image: '/media/qr.png', url: '' }, alipay: { label: '支付宝', image: '', url: '' } };
  cfg.site.social = { enabled: on, items: { github: { enabled: true, type: 'link', url: 'https://github.com/example' } } };
  build.generateArchive = on;
  build.generateTags = on;
  build.generateCategories = on;
  build.generateGallery = on;
  build.criticalCss = { enabled: on, asyncNonCritical: true };
  build.minifyCSS = false;
  cfg.site.build = build;
  cfg.features.reward = Object.assign({}, cfg.features.reward || {}, { enabled: true });
  cfg.navigation.navbar = { fixed: on, shadow: on, breakpoint: '768px' };
  // navbarOptions.shadowShow 显式值时优先于 navbar.shadow（site-css.ejs 的既有回退链），
  // 这里移除它以验证 navbar.shadow 本身的分支。
  delete cfg.navigation.navbarOptions.shadowShow;
  cfg.navigation.socialInNav = { enabled: on, order: ['github'] };
  cfg.theme.layout = { headerStyle: 'static', headerHeight: '60px' };
  cfg.theme.darkMode = { enabled: true, toggle: on, default: 'light', colors: {} };
  cfg.footer.beian = { enabled: on, icp: 'ICP-COVER', gongan: '' };
  cfg.footer.bottomLinks = { enabled: on, items: [{ label: 'BottomLink', url: '/bottom/' }] };
  cfg.footer.columnItems = { enabled: on, items: [{ title: 'ColumnTitle', links: [{ label: 'ColLink', url: '/col/' }] }] };
  cfg.footer.poweredBy = { enabled: on, text: 'PoweredCover' };
  cfg.friends = { enabled: false, friends: [] };
  return cfg;
}

const siteVariants = new Map();

async function siteVariant(kind) {
  if (!siteVariants.has(kind)) {
    siteVariants.set(kind, (async function () {
      const dir = tmpdir('synapse-cover-site-' + kind + '-');
      const config = siteConfig(kind === 'on');
      const articles = [article('a'), article('b'), article('c')];
      const mod = createPagesModule(siteCtx(dir));
      const baseData = mod.buildPageData(config, articles, collectors.collectTags(articles), collectors.collectCategories(articles));
      const cssHref = mod.buildSiteCss(config, baseData);
      await mod.generatePages(config, articles, baseData, []);
      return {
        dir: dir,
        config: config,
        baseData: baseData,
        index: readIfExists(path.join(dir, 'zh', 'index.html')),
        post: readIfExists(path.join(dir, 'zh', 'a', 'index.html')),
        css: readIfExists(path.join(dir, cssHref))
      };
    })());
  }
  return siteVariants.get(kind);
}

// ---------------------------------------------------------------------------
// 模板/页面族开关（真实渲染 templates/）
// ---------------------------------------------------------------------------

test('footer.beian/bottomLinks/columnItems/poweredBy 决定页脚对应块是否输出', async () => {
  // switch: footer.beian.enabled, footer.bottomLinks.enabled, footer.columnItems.enabled, footer.poweredBy.enabled
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  const pairs = [
    ['footer.beian.enabled', 'class="footer-beian"'],
    ['footer.bottomLinks.enabled', 'class="footer-bottom-links"'],
    ['footer.columnItems.enabled', 'class="footer-grid"'],
    ['footer.poweredBy.enabled', 'class="footer-powered"']
  ];
  for (const [key, marker] of pairs) {
    assert.ok(on.index.includes(marker), key + ' = true 时页脚必须输出 ' + marker);
    assert.ok(!off.index.includes(marker), key + ' = false 时页脚不得输出 ' + marker);
  }
  assert.ok(on.index.includes('ICP-COVER'), 'beian 段内容必须进入页脚');
  assert.ok(on.index.includes('PoweredCover'), 'poweredBy.text 必须进入页脚');
});

test('navigation.socialInNav.enabled 决定导航栏社交链接块', async () => {
  // switch: navigation.socialInNav.enabled
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  assert.ok(on.index.includes('class="nav-social"'), 'enabled=true 时导航必须输出社交块');
  assert.ok(on.index.includes('https://github.com/example'), '社交条目 URL 必须随块输出');
  assert.ok(!off.index.includes('class="nav-social"'), 'enabled=false 时导航不得输出社交块');
});

test('site.externalLinkWarning.enabled 决定外链警告浮层', async () => {
  // switch: site.externalLinkWarning.enabled
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  assert.ok(on.index.includes('id="linkWarningOverlay"'), 'enabled=true 时必须输出外链警告浮层');
  assert.ok(!off.index.includes('id="linkWarningOverlay"'), 'enabled=false 时不得输出外链警告浮层');
});

test('site.hero.enabled 决定首页 hero 区块', async () => {
  // switch: site.hero.enabled
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  assert.ok(on.index.includes('<section class="hero">'), 'enabled=true 时首页必须输出 hero');
  assert.ok(on.index.includes('Hero Subtitle'), 'hero 文案必须来自 site.hero');
  assert.ok(!off.index.includes('<section class="hero">'), 'enabled=false 时首页不得输出 hero');
  assert.ok(!off.index.includes('Hero Subtitle'), 'enabled=false 时 hero 文案不得出现');
});

test('site.seo.structuredData.enabled 决定 JSON-LD 结构化数据', async () => {
  // switch: site.seo.structuredData.enabled
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  assert.ok(on.index.includes('application/ld+json'), 'enabled=true 时必须输出 JSON-LD');
  assert.ok(on.index.includes('"@type"'), 'JSON-LD 必须带 schema.org 类型');
  assert.ok(!off.index.includes('application/ld+json'), 'enabled=false 时不得输出 JSON-LD');
});

test('site.reward.enabled 决定文章赞赏块', async () => {
  // switch: site.reward.enabled
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  assert.ok(on.post.includes('class="reward-bar"'), 'enabled=true 时文章页必须输出赞赏块');
  assert.ok(on.post.includes('/media/qr.png'), '赞赏图片必须来自 site.reward');
  assert.ok(!off.post.includes('class="reward-bar"'), 'enabled=false 时文章页不得输出赞赏块');
});

test('theme.darkMode.toggle 决定明暗切换按钮', async () => {
  // switch: theme.darkMode.toggle
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  assert.ok(on.index.includes('class="dark-toggle'), 'toggle=true 时必须输出明暗切换按钮');
  assert.ok(!off.index.includes('class="dark-toggle'), 'toggle=false 时不得输出明暗切换按钮');
});

test('site.postsPerPage 决定首页分页页数', async () => {
  // switch: site.postsPerPage
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  // on: postsPerPage=2 + 3 篇文章 → 2 页；off: postsPerPage=10 → 1 页（无 page/2）。
  assert.ok(fs.existsSync(path.join(on.dir, 'zh', 'page', '2', 'index.html')), 'postsPerPage=2 时 3 篇文章必须分 2 页');
  assert.ok(!fs.existsSync(path.join(off.dir, 'zh', 'page', '2', 'index.html')), 'postsPerPage=10 时不得产生第 2 页');
  assert.ok(on.index.includes('page/2/'), '分页导航必须指向第 2 页');
  assert.ok(!off.index.includes('page/2/'), '单页时不得出现第 2 页链接');
});

test('site.build.generateArchive/generateTags/generateCategories/generateGallery 决定页面族产出', async () => {
  // switch: site.build.generateArchive, site.build.generateTags, site.build.generateCategories, site.build.generateGallery
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  const pages = [
    ['site.build.generateArchive', ['zh', 'archive', 'index.html']],
    ['site.build.generateTags', ['zh', 'tags', 'index.html']],
    ['site.build.generateCategories', ['zh', 'categories', 'index.html']],
    ['site.build.generateGallery', ['zh', 'gallery', 'index.html']]
  ];
  for (const [key, rel] of pages) {
    assert.ok(fs.existsSync(path.join(on.dir, rel.join(path.sep))), key + ' = true 时必须产出 ' + rel.join('/'));
    assert.ok(!fs.existsSync(path.join(off.dir, rel.join(path.sep))), key + ' = false 时不得产出 ' + rel.join('/'));
  }
});

test('site.build.criticalCss.enabled 决定关键样式内联与非关键异步加载', async () => {
  // switch: site.build.criticalCss.enabled
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  assert.ok(on.baseData.criticalCss && on.baseData.criticalCss.length > 0, 'enabled=true 时必须抽取到关键 CSS');
  assert.strictEqual(on.baseData.asyncNonCriticalCss, true, 'asyncNonCritical 必须生效');
  assert.ok(on.index.includes(on.baseData.criticalCss.slice(0, 30)), '关键 CSS 必须内联进首屏 HTML');
  assert.ok(on.index.includes('rel="preload" as="style"'), '关键 CSS 开启时主样式必须改为 preload 异步加载');

  assert.strictEqual(off.baseData.criticalCss, '', 'enabled=false 时不得产出关键 CSS');
  assert.strictEqual(off.baseData.asyncNonCriticalCss, false, 'enabled=false 时不得异步化主样式');
  assert.ok(!off.index.includes('rel="preload" as="style"'), 'enabled=false 时主样式必须保持阻塞加载');
});

test('navigation.navbar.fixed/shadow 决定站点头部定位与阴影的 CSS 产物', async () => {
  // switch: navigation.navbar.fixed, navigation.navbar.shadow
  const on = await siteVariant('on');
  const off = await siteVariant('off');
  const headerOn = /\.site-header\{[^}]*\}/.exec(on.css);
  const headerOff = /\.site-header\{[^}]*\}/.exec(off.css);
  assert.ok(headerOn, '站点 CSS 必须包含 .site-header 规则');
  assert.ok(headerOff, '站点 CSS 必须包含 .site-header 规则');
  assert.strictEqual(/position:fixed/.test(headerOn[0]), true, 'navbar.fixed=true 时 position 必须为 fixed');
  assert.strictEqual(/position:relative/.test(headerOff[0]), true, 'navbar.fixed=false 时 position 必须为 relative');
  assert.strictEqual(/box-shadow:var\(--sf\)/.test(headerOn[0]), true, 'navbar.shadow=true 时必须输出头部阴影');
  assert.strictEqual(/box-shadow/.test(headerOff[0]), false, 'navbar.shadow=false 时头部规则不得带阴影');
});

// ---------------------------------------------------------------------------
// 构建侧纯解析器 / 生成物
// ---------------------------------------------------------------------------

test('theme.fontSystem.scale 决定解析出的 fontScale（非法值回落 1）', () => {
  // switch: theme.fontSystem.scale
  const mod = createConfigModule({ getVendorFonts: function () { return {}; } });
  const scaled = clone(DEFAULT_CONFIG.theme);
  scaled.fontSystem = Object.assign({}, scaled.fontSystem, { scale: 1.25 });
  mod.resolveFontSystem(scaled);
  assert.strictEqual(scaled.fontScale, 1.25, 'scale=1.25 必须原样进入 fontScale');

  const illegal = clone(DEFAULT_CONFIG.theme);
  illegal.fontSystem = Object.assign({}, illegal.fontSystem, { scale: 3 });
  mod.resolveFontSystem(illegal);
  assert.strictEqual(illegal.fontScale, 1, '越界 scale 必须回落到 1，而不是照抄配置');
});

test('site.favicon.enabled 决定 favicon 链接标签是否输出', () => {
  // switch: site.favicon.enabled
  const staticDir = tmpdir('synapse-cover-static-');
  fs.mkdirSync(path.join(staticDir, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(staticDir, 'icons', 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const site = { favicon: { enabled: true, svg: '/icons/favicon.svg', png32: '', appleTouch: '' } };

  const enabledCtx = createHelpersModule({
    rootDir: ROOT, staticDir: staticDir, watchMode: true, showDrafts: false,
    getBuildErrors: function () { return null; }, getJson: function () { return null; }
  });
  const html = enabledCtx.resolveFaviconHtml(site, '#000000');
  assert.ok(html.includes('/icons/favicon.svg'), 'enabled 时必须输出真实 favicon 链接');

  const disabledCtx = createHelpersModule({
    rootDir: ROOT, staticDir: staticDir, watchMode: true, showDrafts: false,
    getBuildErrors: function () { return null; }, getJson: function () { return null; }
  });
  assert.strictEqual(disabledCtx.resolveFaviconHtml({ favicon: { enabled: false, svg: '/icons/favicon.svg' } }, '#000000'),
    '', 'enabled=false 时不得输出任何 favicon 链接');
});

test('site.webAnalytics.enabled 决定 CSP 中 Cloudflare 统计域名是否保留', () => {
  // switch: site.webAnalytics.enabled
  const makeConfig = function (enabled) {
    const cfg = baseConfig();
    cfg.site.webAnalytics = { enabled: enabled, token: 'cover-token' };
    cfg.security = clone(DEFAULT_CONFIG.security);
    cfg.security.csp = {
      enabled: true,
      reportOnly: false,
      directives: {
        'script-src': ["'self'", 'https://static.cloudflareinsights.com'],
        'connect-src': ["'self'", 'https://cloudflareinsights.com']
      }
    };
    return cfg;
  };
  const makeCtx = function (dir) {
    return createSecurityFilesModule({
      distDir: dir,
      cspNonce: 'NONCE',
      applyHeaderHardening: function (s) { return (s && s.headers) || {}; },
      buildSitemapUrls: function () { return []; },
      bundleActive: true,
      recordBuildFailure: function () {}
    });
  };

  const onDir = tmpdir('synapse-cover-wa-on-');
  makeCtx(onDir).generateSecurityHeaders(makeConfig(true));
  const onHeaders = readIfExists(path.join(onDir, '_headers'));
  assert.ok(onHeaders.includes('static.cloudflareinsights.com'), 'enabled+token 时 script-src 必须保留统计域名');
  assert.ok(onHeaders.includes('cloudflareinsights.com'), 'enabled+token 时 connect-src 必须保留统计域名');

  const offDir = tmpdir('synapse-cover-wa-off-');
  makeCtx(offDir).generateSecurityHeaders(makeConfig(false));
  const offHeaders = readIfExists(path.join(offDir, '_headers'));
  assert.ok(offHeaders.includes('Content-Security-Policy'), 'CSP 头本身仍必须输出');
  assert.ok(!offHeaders.includes('cloudflareinsights.com'), 'enabled=false 时统计域名必须被裁剪掉');
});

test('security.robots.enabled 决定 robots.txt 是否产出', () => {
  // switch: security.robots.enabled
  const makeCtx = function (dir) {
    return createSecurityFilesModule({
      distDir: dir,
      cspNonce: 'NONCE',
      applyHeaderHardening: function () { return {}; },
      buildSitemapUrls: function (o) { return (o.languages || []).map(function (l) { return o.baseUrl + '/' + l + o.sitemapPath; }); },
      bundleActive: true,
      recordBuildFailure: function () {}
    });
  };
  const makeConfig = function (enabled) {
    const cfg = baseConfig();
    cfg.security = clone(DEFAULT_CONFIG.security);
    cfg.security.csp = { enabled: false, directives: {} };
    cfg.security.robots = { enabled: enabled, sitemap: '/sitemap.xml', rules: [{ userAgent: '*', disallow: '/private/' }] };
    return cfg;
  };

  const onDir = tmpdir('synapse-cover-robots-on-');
  makeCtx(onDir).generateSecurityHeaders(makeConfig(true));
  const robots = readIfExists(path.join(onDir, 'robots.txt'));
  assert.ok(robots.includes('Disallow: /private/'), 'enabled 时必须写入配置的 Disallow 规则');
  assert.ok(robots.includes('Sitemap: https://example.com/zh/sitemap.xml'), 'enabled 时必须写入派生 Sitemap 行');

  const offDir = tmpdir('synapse-cover-robots-off-');
  makeCtx(offDir).generateSecurityHeaders(makeConfig(false));
  assert.strictEqual(fs.existsSync(path.join(offDir, 'robots.txt')), false, 'enabled=false 时不得产出 robots.txt');
});

test('friends.enabled 决定友情链接收集结果', () => {
  // switch: friends.enabled
  const data = { enabled: true, friends: [{ name: 'A', url: 'https://a.example.com' }] };
  const on = collectors.collectFriends({ friends: data });
  assert.ok(on && Array.isArray(on.friends) && on.friends.length === 1, 'enabled 时必须返回友链配置');
  const off = collectors.collectFriends({ friends: Object.assign({}, data, { enabled: false }) });
  assert.strictEqual(off, null, 'enabled=false 时必须返回 null（不生成友链页/菜单项）');
});

test('tagAliases.enabled 决定文章标签是否按别名归一', async () => {
  // switch: tagAliases.enabled
  const build = async function (enabled) {
    const dir = tmpdir('synapse-cover-alias-' + (enabled ? 'on' : 'off') + '-');
    fs.mkdirSync(path.join(dir, 'en'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'en', 'post.md'),
      '---\ntitle: Alias Post\ndate: 2024-01-01\ntags: ["JS"]\n---\n\n正文\n', 'utf-8');
    const mod = createArticlesModule({
      rootDir: dir,
      articlesDir: dir,
      pagesDir: path.join(dir, '__no_pages__'),
      mediaDir: path.join(dir, '__no_media__'),
      setupMarkedRenderer: function () {},
      getHooks: function () { return {}; },
      recordBuildFailure: function () {}
    });
    const cfg = baseConfig();
    cfg.site.languages = ['en'];
    cfg.site.language = 'en-US';
    cfg.tagAliases = { enabled: enabled, aliases: { JS: 'JavaScript' } };
    const articles = await mod.processArticles(cfg, null, null);
    assert.strictEqual(articles.length, 1, '夹具必须解析出一篇文章');
    return articles[0].tags;
  };
  assert.deepStrictEqual(await build(true), ['JavaScript'], 'enabled 时标签必须按别名归一');
  assert.deepStrictEqual(await build(false), ['JS'], 'enabled=false 时必须保留原标签');
});

test('site.build.minifyCSS/minifyJS/minifyHTML 决定压缩步骤是否执行', async () => {
  // switch: site.build.minifyCSS, site.build.minifyJS, site.build.minifyHTML
  const ctx = function (dir, htmlMinifier) {
    return createMinifyModule({
      distDir: dir,
      cacheBustManifestPath: path.join(dir, 'cache-bust-manifest.json'),
      bundleActive: true,
      getAllFiles: getAllFiles,
      recordBuildFailure: function () {},
      minifyHtmlNode: htmlMinifier,
      CleanCSS: require('clean-css'),
      terser: require('terser')
    });
  };
  const htmlMinifier = require('@minify-html/node');
  const onCalls = [];
  const countingMinifier = {
    minify: function (buf, opts) { onCalls.push(opts); return htmlMinifier.minify(buf, opts); }
  };

  const cssDir = tmpdir('synapse-cover-min-css-');
  const cssFile = path.join(cssDir, 'a.css');
  fs.writeFileSync(cssFile, '\n.a {\n  color : red;\n}\n', 'utf-8');
  const cssRaw = fs.readFileSync(cssFile, 'utf-8');
  await ctx(cssDir, null).minifyCSSInDir(cssDir, { site: { build: { minifyCSS: false } } });
  assert.strictEqual(fs.readFileSync(cssFile, 'utf-8'), cssRaw, 'minifyCSS=false 时 CSS 必须保持原样');
  await ctx(cssDir, null).minifyCSSInDir(cssDir, { site: { build: { minifyCSS: true } } });
  const cssMin = fs.readFileSync(cssFile, 'utf-8');
  assert.ok(cssMin.length < cssRaw.length && !/\n/.test(cssMin), 'minifyCSS=true 时 CSS 必须被压缩');

  const jsDir = tmpdir('synapse-cover-min-js-');
  const jsFile = path.join(jsDir, 'b.js');
  fs.writeFileSync(jsFile, 'const longName = 1;\n\nexport function add() { return longName + 2; }\n', 'utf-8');
  const jsRaw = fs.readFileSync(jsFile, 'utf-8');
  await ctx(jsDir, null).minifyJSInDir(jsDir, { site: { build: { minifyJS: false } } });
  assert.strictEqual(fs.readFileSync(jsFile, 'utf-8'), jsRaw, 'minifyJS=false 时 JS 必须保持原样');
  await ctx(jsDir, null).minifyJSInDir(jsDir, { site: { build: { minifyJS: true } } });
  assert.ok(fs.readFileSync(jsFile, 'utf-8').length < jsRaw.length, 'minifyJS=true 时 JS 必须被压缩');

  const htmlDir = tmpdir('synapse-cover-min-html-');
  const htmlFile = path.join(htmlDir, 'c.html');
  const htmlRaw = '<!DOCTYPE html><html><body><!-- keep comment -->  keep me  </body></html>';
  fs.writeFileSync(htmlFile, htmlRaw, 'utf-8');
  await ctx(htmlDir, countingMinifier).minifyHTMLInDir(htmlDir, { site: { build: { minifyHTML: false } } });
  assert.strictEqual(onCalls.length, 0, 'minifyHTML=false 时不得调用 HTML 压缩器');
  assert.strictEqual(fs.readFileSync(htmlFile, 'utf-8'), htmlRaw, 'minifyHTML=false 时 HTML 必须保持原样');
  await ctx(htmlDir, countingMinifier).minifyHTMLInDir(htmlDir, { site: { build: { minifyHTML: true } } });
  assert.strictEqual(onCalls.length, 1, 'minifyHTML=true 时必须调用 HTML 压缩器');
  const htmlMin = fs.readFileSync(htmlFile, 'utf-8');
  assert.ok(htmlMin.length < htmlRaw.length, 'minifyHTML=true 时 HTML 必须变短');
  assert.ok(!htmlMin.includes('<!-- keep comment -->'), 'minifyHTML=true 时必须移除 HTML 注释');
  assert.ok(htmlMin.includes('<!doctype html>'), 'minifyHTML=true 时必须保留文档结构（真实压缩器产出）');
});

test('site.build.optimizeMedia/avif.enabled/avif.quality 决定媒体变体产物', async () => {
  // switch: site.build.optimizeMedia, site.build.avif.enabled, site.build.avif.quality
  const sharp = require('sharp');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320">'
    + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0%" stop-color="#ff2200"/><stop offset="50%" stop-color="#22ff66"/>'
    + '<stop offset="100%" stop-color="#0033ff"/></linearGradient></defs>'
    + '<rect width="800" height="320" fill="url(#g)"/>'
    + '<circle cx="200" cy="160" r="90" fill="#ffffff" opacity=".7"/></svg>';

  const run = async function (tag, build) {
    const dir = tmpdir('synapse-cover-media-' + tag + '-');
    const mediaDir = path.join(dir, 'media');
    const distDir = path.join(dir, 'dist');
    const cacheDir = path.join(dir, 'cache');
    fs.mkdirSync(mediaDir, { recursive: true });
    await sharp(Buffer.from(svg)).png().toFile(path.join(mediaDir, 'pic.png'));
    const store = {};
    const mod = createMediaModule({
      distDir: distDir,
      mediaDir: mediaDir,
      mediaCacheDir: cacheDir,
      staticDir: path.join(dir, 'static'),
      assetsDir: path.join(dir, 'assets'),
      videosDir: path.join(dir, 'videos'),
      sharp: sharp,
      loadBuildCache: function () { return store; },
      saveBuildCache: function (cache) { Object.assign(store, cache); },
      recordBuildFailure: function () {}
    });
    const cfg = baseConfig();
    cfg.features.imageLazy = Object.assign({}, cfg.features.imageLazy || {}, { lqip: false });
    cfg.site.build = Object.assign({}, DEFAULT_CONFIG.site.build, {
      optimizeMedia: true,
      cleanDist: false,
      mediaResponsiveSizes: [400],
      mediaQuality: 70,
      mediaFormats: ['webp']
    }, build);
    const manifest = await mod.optimizeMedia(cfg);
    return { dir: dir, distDir: distDir, manifest: manifest, config: cfg };
  };

  // optimizeMedia=false：不产出任何媒体产物。
  const disabled = await run('disabled', { optimizeMedia: false });
  assert.strictEqual(disabled.manifest, null, 'optimizeMedia=false 时必须直接返回 null');
  assert.strictEqual(fs.existsSync(path.join(disabled.distDir, 'media-manifest.json')), false,
    'optimizeMedia=false 时不得写出 media-manifest.json');

  // avif.enabled=false：只有 webp 变体。
  const noAvif = await run('noavif', { optimizeMedia: true, avif: { enabled: false } });
  assert.ok(noAvif.manifest, 'optimizeMedia=true 时必须返回 manifest');
  const noAvifEntry = noAvif.manifest['media/pic.png'];
  assert.ok(noAvifEntry && noAvifEntry.variants['400-webp'], 'avif.enabled=false 仍必须产出 webp 变体');
  assert.strictEqual(noAvifEntry.variants['400-avif'], undefined, 'avif.enabled=false 时不得产出 avif 变体');
  assert.strictEqual(fs.existsSync(path.join(noAvif.distDir, 'media', 'pic-400.avif')), false,
    'avif.enabled=false 时不得写出 avif 文件');

  // avif.enabled=true：产出 avif 变体，且 quality 进入编码参数（不同质量 → 不同字节）。
  const q20 = await run('avif20', { optimizeMedia: true, avif: { enabled: true, quality: 20, effort: 4 } });
  const q90 = await run('avif90', { optimizeMedia: true, avif: { enabled: true, quality: 90, effort: 4 } });
  assert.ok(q20.manifest['media/pic.png'].variants['400-avif'], 'avif.enabled=true 必须产出 avif 变体');
  assert.ok(q20.manifest['media/pic.png'].variants['400-avif'] === q90.manifest['media/pic.png'].variants['400-avif'],
    '变体 URL 命名与 quality 无关');
  const bytes20 = fs.statSync(path.join(q20.distDir, 'media', 'pic-400.avif')).size;
  const bytes90 = fs.statSync(path.join(q90.distDir, 'media', 'pic-400.avif')).size;
  assert.notStrictEqual(bytes20, bytes90, 'avif.quality 必须进入编码参数（q20 与 q90 字节数必须不同）');
});

test('site.build.cjkFonts.fetchTimeoutMs 决定字体清单拉取的超时预算', async () => {
  // switch: site.build.cjkFonts.fetchTimeoutMs
  const makeFetch = function () {
    const seen = [];
    const impl = function (url, opts) {
      seen.push(opts && opts.timeoutMs);
      return new Promise(function (resolve, reject) {
        const signal = opts && opts.signal;
        if (signal && typeof signal.addEventListener === 'function') {
          signal.addEventListener('abort', function () { reject(new Error('aborted by signal')); });
        }
        setTimeout(function () { reject(new Error('network down')); }, 150);
      });
    };
    impl.seen = seen;
    return impl;
  };

  const run = async function (timeoutMs) {
    const dir = tmpdir('synapse-cover-cjk-' + timeoutMs + '-');
    const distDir = path.join(dir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>中文排版测试</body></html>', 'utf-8');
    const fetchImpl = makeFetch();
    const mod = createCjkFontsModule({
      distDir: distDir,
      cacheDir: path.join(dir, 'cache'),
      logger: { log: function () {}, warn: function () {} },
      fetchImpl: fetchImpl
    });
    const cfg = baseConfig();
    cfg.site.build.cjkFonts = Object.assign({}, cfg.site.build.cjkFonts, { enabled: true, fetchTimeoutMs: timeoutMs });
    const result = await mod.buildCjkFonts(cfg);
    return { result: result, fetch: fetchImpl };
  };

  const shortBudget = await run(40);
  assert.strictEqual(shortBudget.result.ok, false, '网络不可用时字体子集化必须降级失败');
  assert.match(String(shortBudget.result.reason), /timeout after 40ms/, 'fetchTimeoutMs=40 必须产生 40ms 超时：' + shortBudget.result.reason);

  const longBudget = await run(5000);
  assert.strictEqual(longBudget.result.ok, false, '网络不可用时字体子集化必须降级失败');
  assert.match(String(longBudget.result.reason), /network down/, 'fetchTimeoutMs=5000 时错误必须来自网络而不是超时');
  assert.doesNotMatch(String(longBudget.result.reason), /timeout after/, '长预算下不得提前超时');
});

// ---------------------------------------------------------------------------
// internals.*：以子进程运行真实 CLI，require 钩子只替换驱动层
// ---------------------------------------------------------------------------

function writePreload(body) {
  const dir = tmpdir('synapse-cover-preload-');
  const file = path.join(dir, 'hook.js');
  fs.writeFileSync(file, body, 'utf-8');
  return file;
}

test('internals.deploy.verifyOnDeploy 决定部署前是否运行 internals 守卫', () => {
  // switch: internals.deploy.verifyOnDeploy
  const target = path.join(ROOT, 'scripts', 'deploy-pages.js');
  const hook = writePreload([
    "'use strict';",
    "const Module = require('module');",
    "const path = require('path');",
    'const orig = Module._load;',
    'const TARGET = path.resolve(process.env.COVER_DEPLOY_TARGET);',
    "const verify = process.env.COVER_VERIFY === '1';",
    'Module._load = function (request, parent) {',
    '  if (parent && parent.filename === TARGET) {',
    "    if (request === './lib/internals') {",
    '      return { loadInternals: function () { return { deploy: { pagesProject: "cover-project", workerAssetsDir: "dist", verifyOnDeploy: verify } }; } };',
    '    }',
    "    if (request === 'child_process') {",
    '      return { spawnSync: function (cmd, args) { console.log("SPAWN " + JSON.stringify(args || [])); return { status: 0 }; } };',
    '    }',
    "    if (request === 'fs') return { existsSync: function () { return true; } };",
    '  }',
    '  return orig.apply(this, arguments);',
    '};'
  ].join('\n'));

  const run = function (verify) {
    return execFileSync(process.execPath, ['-r', hook, target], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { COVER_DEPLOY_TARGET: target, COVER_VERIFY: verify ? '1' : '0' }),
      encoding: 'utf-8'
    });
  };

  const guarded = run(true);
  assert.match(guarded, /check-internals\.js/, 'verifyOnDeploy=true 时必须先运行 check-internals 守卫');
  assert.match(guarded, /--project-name=cover-project/, '守卫之后仍必须按 internals 项目名部署');

  const unguarded = run(false);
  assert.doesNotMatch(unguarded, /check-internals\.js/, 'verifyOnDeploy=false 时不得运行守卫');
  assert.match(unguarded, /"pages","deploy","dist","--project-name=cover-project"/, 'verifyOnDeploy=false 时仍必须执行部署命令');
});

test('internals.audit.a11y.pages 决定审计页数上限（0 = 全量）', () => {
  // switch: internals.audit.a11y.pages
  const target = path.join(ROOT, 'scripts', 'a11y-audit.js');
  const hook = writePreload([
    "'use strict';",
    "const Module = require('module');",
    "const path = require('path');",
    'const orig = Module._load;',
    'const TARGET = path.resolve(process.env.COVER_A11Y_TARGET);',
    'const limit = Number(process.env.COVER_A11Y_PAGES);',
    'const fakePage = {',
    '  setCacheEnabled: async function () {},',
    '  setViewport: async function () {},',
    '  emulateMediaFeatures: async function () {},',
    '  goto: async function () { return { status: function () { return 200; } }; },',
    '  addStyleTag: async function () {},',
    '  addScriptTag: async function () {},',
    '  evaluate: async function () { return { violations: [] }; },',
    '  close: async function () {}',
    '};',
    'const fakeBrowser = { newPage: async function () { return fakePage; }, close: async function () {} };',
    'Module._load = function (request, parent) {',
    '  if (parent && parent.filename === TARGET) {',
    "    if (request === 'puppeteer-core') return { launch: async function () { return fakeBrowser; } };",
    "    if (request === './lib/chrome-path') return { resolveChromePath: function () { return '/fake/chrome'; } };",
    "    if (request === './lib/internals') {",
    '      return { loadInternals: function () { return {',
    '        audit: { a11y: { pages: limit, nodesPerRuleMax: 3, htmlSummaryMax: 120 }, distHash: { previewLimit: 20 } },',
    "        ports: { a11y: 4399 }, cache: { fontsTtlDays: 7 }, report: { topN: 10 } }; } };",
    '    }',
    '  }',
    '  return orig.apply(this, arguments);',
    '};'
  ].join('\n'));

  const distDir = tmpdir('synapse-cover-a11y-');
  for (let i = 1; i <= 5; i++) fs.writeFileSync(path.join(distDir, 'p' + i + '.html'), '<html><body>' + i + '</body></html>', 'utf-8');

  const run = function (limit) {
    return execFileSync(process.execPath,
      ['-r', hook, target, 'http://127.0.0.1:9/', '--out', distDir],
      { cwd: ROOT, env: Object.assign({}, process.env, { COVER_A11Y_TARGET: target, COVER_A11Y_PAGES: String(limit) }), encoding: 'utf-8' });
  };

  const limited = run(2);
  assert.match(limited, /A11Y SUMMARY pages=2\(/, 'internals.audit.a11y.pages=2 时只审计 2 页：' + limited);
  const unlimited = run(0);
  assert.match(unlimited, /A11Y SUMMARY pages=5\(/, 'internals.audit.a11y.pages=0 时必须审计全部 5 页：' + unlimited);
});
