'use strict';
// H2 数据流回归单测（DF1–DF15 中可纯逻辑覆盖项 + HC6 语言工具）：
//   DF1 根页默认语言投影 / 纯语言站 / generateIndex=false；articles 语言目录取 site.languages
//   DF2 增量 nonce 刷新（replaceNonce 纯函数 + generatePages 复用路径不重渲染）
//   DF3 cacheBust 重写 feed；DF4 主题单一事实源 + OG 指纹；DF6 guard 默认档结构同步
//   DF8 modified 投影与 sitemap lastmod 优先；DF10/DF14 _redirects；DF11 JSON Feed updated
//   DF13 语言表工具；HC6 runtime langOf/__langSeg/__langStrip 与前端检测残留扫描
// 运行：node --test scripts/h2-dataflow.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const inc = require('./lib/incremental.js');
const { resolveBuildTheme } = require('./lib/theme-resolve.js');
const { buildOgFingerprint } = require('./lib/og-cache-key.js');
const { siteLanguages, primaryLanguage, isEnglish } = require('./lib/site-lang.js');
const { createPagesModule } = require('./build/pages.js');
const { createArticlesModule } = require('./build/articles.js');
const { createFeedsModule } = require('./build/feeds.js');
const { createSecurityFilesModule } = require('./build/security-files.js');
const { createMinifyModule } = require('./build/minify.js');
const { getAllFiles } = require('./build/fs-utils.js');
const { DEFAULT_CONFIG } = require('./lib/site-defaults.js');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { createMarkdownModule } = require('./build/markdown.js');

function tmpdir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// 页面生成用最小配置：默认 zh/en 双语的站点文案 + 关闭会额外产出的页面族。
function pageConfig(overrides) {
  const cfg = clone(DEFAULT_CONFIG);
  cfg.features = clone(DEFAULT_FEATURES);
  cfg.features.series.enabled = false;
  cfg.features.favorites.enabled = false;
  cfg.features.exportArticle = { enabled: false };
  cfg.site = Object.assign(cfg.site, {
    title: 'T',
    url: 'https://example.com',
    description: '中文描述',
    descriptionEn: 'English description',
    language: 'zh-CN',
    languageEn: 'en-US',
    postsPerPage: 10
  }, (overrides && overrides.site) || {});
  cfg.site.build = Object.assign({}, cfg.site.build, {
    generateArchive: false,
    generateTags: false,
    generateCategories: false,
    generateGallery: false,
    generateIndex: true
  }, (overrides && overrides.build) || {});
  cfg.navigation = clone(DEFAULT_CONFIG.navigation);
  cfg.navigation.search = { enabled: false };
  return cfg;
}

function article(lang, slug, extra) {
  return Object.assign({
    slug: slug,
    lang: lang,
    langPrefix: '/' + lang + '/',
    title: 'T-' + slug,
    url: '/' + lang + '/' + slug + '/',
    date: '2024-01-01',
    modified: null,
    formattedDate: '2024-01-01',
    tags: [],
    categories: [],
    draft: false,
    pinned: false,
    series: null,
    content: '<p>x</p>',
    excerpt: 'x',
    hasCode: false,
    hasMath: false,
    hasMermaid: false,
    featuredImage: '',
    filename: slug + '.md'
  }, extra || {});
}

// 页面生成 ctx：渲染器替换为可断言的 META JSON；收集器全部给出确定性空值。
function pagesCtx(distDir, state) {
  const calls = state && state.calls ? state.calls : { render: 0 };
  const ctx = {
    calls: calls,
    distDir: distDir,
    templatesDir: state && state.templatesDir ? state.templatesDir : distDir,
    pagesDir: path.join(distDir, '__no_pages__'),
    articlesDir: path.join(distDir, '__no_articles__'),
    getTemplate: function () { return '<layout>'; },
    renderPage: function (templateName, data) {
      calls.render++;
      const info = {
        tpl: templateName,
        lang: data.lang,
        currentPage: data.currentPage,
        title: data.title,
        siteDesc: data.site && data.site.description,
        navHome: typeof data.ui === 'function' ? data.ui('nav.home', 'zhhome') : '',
        heroSub: data.heroData ? data.heroData.subtitle : null,
        prevLabel: data.pagination ? data.pagination.prevLabel : null
      };
      return '<html nonce="' + ((state && state.nonce) || 'NONCE1') + '"><head></head><body>META=' + JSON.stringify(info) + '</body></html>';
    },
    getPublished: function (list) { return list.filter(function (a) { return !a.draft; }); },
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
    CleanCSS: null,
    getMediaManifest: function () { return null; },
    getAutoCovers: function () { return {}; },
    setInlineConfigKb: function () {},
    getIncrementalContext: function () { return (state && state.incremental) || { active: false, fingerprintHash: 'sha1' }; },
    loadBuildCache: function () { return state.cache; },
    saveBuildCache: function () {}
  };
  // cspNonce 必须活值（构建期每进程一枚；测试模拟跨进程 nonce 变更）。
  Object.defineProperty(ctx, 'cspNonce', { enumerable: true, get: function () { return (state && state.nonce) || 'NONCE1'; } });
  return ctx;
}

function readMeta(file) {
  const html = fs.readFileSync(file, 'utf-8');
  const m = /META=(\{.*?\})<\/body>/.exec(html);
  return m ? JSON.parse(m[1]) : null;
}

test('DF1 根页取 site.languages[0] 并按该语言投影（纯英文站）', async () => {
  const dir = tmpdir('synapse-h2-df1-');
  try {
    const mod = createPagesModule(pagesCtx(dir));
    const cfg = pageConfig({ site: { languages: ['en'] } });
    await mod.generatePages(cfg, [article('en', 'a')], null, []);
    assert.ok(fs.existsSync(path.join(dir, 'index.html')), '根页必须生成');
    const meta = readMeta(path.join(dir, 'index.html'));
    assert.strictEqual(meta.lang, 'en');
    assert.strictEqual(meta.siteDesc, 'English description', '根页必须使用英文站点描述');
    assert.strictEqual(meta.tpl, 'index.ejs');
    assert.ok(fs.existsSync(path.join(dir, 'en', 'index.html')));
    assert.ok(!fs.existsSync(path.join(dir, 'zh')), '纯英文站不得产出 zh 目录');
    const rootHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    assert.ok(!rootHtml.includes('S-LANG-REDIRECT'), '单语言站不得输出浏览器语言跳转');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DF1 双语站根页 = 默认语言首页；generateIndex=false 不再生成根页', async () => {
  const dir = tmpdir('synapse-h2-df1b-');
  const dir2 = tmpdir('synapse-h2-df1c-');
  try {
    const mod = createPagesModule(pagesCtx(dir));
    const cfg = pageConfig({ site: { languages: ['zh', 'en'] } });
    await mod.generatePages(cfg, [article('zh', 'a')], null, []);
    const meta = readMeta(path.join(dir, 'index.html'));
    assert.strictEqual(meta.lang, 'zh');
    const rootHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    assert.ok(rootHtml.includes('S-LANG-REDIRECT') && rootHtml.includes('"/en/"'), '双语站根页保留浏览器语言跳转');

    const mod2 = createPagesModule(pagesCtx(dir2));
    const cfg2 = pageConfig({ site: { languages: ['zh', 'en'] }, build: { generateIndex: false } });
    await mod2.generatePages(cfg2, [article('zh', 'a')], null, []);
    assert.ok(!fs.existsSync(path.join(dir2, 'index.html')), 'generateIndex=false 不得生成根页');
    assert.ok(!fs.existsSync(path.join(dir2, 'zh', 'index.html')), 'generateIndex=false 不得生成语言首页');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(dir2, { recursive: true, force: true });
  }
});

test('DF2 replaceNonce 纯函数：属性与策略两种形态、幂等', () => {
  const html = '<script nonce="AAA"></script><!-- nonce="AAA" -->';
  assert.strictEqual(inc.replaceNonce(html, 'AAA', 'BBB'), '<script nonce="BBB"></script><!-- nonce="BBB" -->');
  assert.strictEqual(inc.replaceNonce(html, 'AAA', 'AAA'), html, '同值不变');
  assert.strictEqual(inc.replaceNonce(html, '', 'BBB'), html, '旧值缺失不变');
  assert.strictEqual(inc.replaceNonce('', 'AAA', 'BBB'), '');
});

test('DF2 增量复用命中但 nonce 变化：刷新产物 nonce，不重渲染', async () => {
  const dir = tmpdir('synapse-h2-df2-');
  try {
    const templates = tmpdir('synapse-h2-df2-tpl-');
    fs.writeFileSync(path.join(templates, 'layout.ejs'), '<html></html>');
    const state = { calls: { render: 0 }, nonce: 'NONCE-A', incremental: { active: true, fingerprintHash: 'sha1' }, cache: { pages: {} }, templatesDir: templates };
    const mod = createPagesModule(pagesCtx(dir, state));
    const cfg = pageConfig({ site: { languages: ['zh'] } });
    await mod.generatePages(cfg, [article('zh', 'a')], null, []);
    const firstRender = state.calls.render;
    assert.ok(firstRender >= 2, '首轮应渲染根页/语言页/文章页等: ' + firstRender);
    assert.ok(fs.readFileSync(path.join(dir, 'zh', 'index.html'), 'utf-8').includes('NONCE-A'));

    state.nonce = 'NONCE-B';
    await mod.generatePages(cfg, [article('zh', 'a')], null, []);
    assert.strictEqual(state.calls.render, firstRender, '指纹一致时必须跳过重渲染');
    const zhHtml = fs.readFileSync(path.join(dir, 'zh', 'index.html'), 'utf-8');
    assert.ok(zhHtml.includes('NONCE-B') && !zhHtml.includes('NONCE-A'), '复用产物必须刷新为本次 nonce');
    const entry = state.cache.pages['zh/index.html'];
    assert.strictEqual(entry.nonce, 'NONCE-B', '缓存条目必须记录本次 nonce');
    fs.rmSync(templates, { recursive: true, force: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DF1/DF8 processArticles：语言目录取 site.languages，modified 投影并校验', async () => {
  const dir = tmpdir('synapse-h2-df1d-');
  try {
    fs.mkdirSync(path.join(dir, 'articles', 'en'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'articles', 'zh'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'articles', 'en', 'a.md'), '---\ntitle: A\ndate: 2024-01-01\nmodified: 2024-06-01\n---\n\nbody\n');
    fs.writeFileSync(path.join(dir, 'articles', 'zh', 'b.md'), '---\ntitle: B\ndate: 2024-01-01\n---\n\nbody\n');
    const markdown = createMarkdownModule();
    const mod = createArticlesModule({
      rootDir: dir,
      articlesDir: path.join(dir, 'articles'),
      pagesDir: path.join(dir, 'pages'),
      mediaDir: path.join(dir, 'media'),
      setupMarkedRenderer: markdown.setupMarkedRenderer,
      getHooks: function () { return null; },
      recordBuildFailure: function () {}
    });
    const cfg = { features: clone(DEFAULT_FEATURES), site: { languages: ['en'], build: { cjkSpacing: false } }, tagAliases: {} };
    const list = await mod.processArticles(cfg, {}, null);
    assert.strictEqual(list.length, 1, '仅扫描 site.languages 声明的语言目录');
    assert.strictEqual(list[0].lang, 'en');
    assert.ok(list[0].modified, 'modified 必须投影到文章对象');
    assert.ok(new Date(list[0].modified).toISOString().startsWith('2024-06-01'), 'modified 值必须可解析：' + list[0].modified);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DF11 JSON Feed updated 取 getPublished（草稿未来日期不得进入元数据）', async () => {
  const dir = tmpdir('synapse-h2-df11-');
  try {
    let captured = null;
    class FakeFeed {
      constructor(opts) { captured = opts; }
      addItem() {}
      json1() { return '{}'; }
    }
    const mod = createFeedsModule({
      distDir: dir,
      getFeed: function () { return FakeFeed; },
      getPublished: function (list) { return list.filter(function (a) { return !a.draft; }); },
      collectSeries: function () { return []; },
      collectTags: function () { return []; },
      collectCategories: function () { return []; },
      recordBuildFailure: function () {}
    });
    const cfg = { site: { url: 'https://example.com', languages: ['zh'], title: 'T', rss: { enabled: true, path: '/feed.xml', jsonFeed: { enabled: true, path: '/feed.json' } } } };
    await mod.generateJSONFeed(cfg, [
      article('zh', 'draft-future', { draft: true, date: '2099-01-01' }),
      article('zh', 'published', { date: '2020-01-01' })
    ]);
    assert.ok(captured, 'JSON Feed 必须构建');
    assert.strictEqual(new Date(captured.updated).getUTCFullYear(), 2020, 'updated 必须来自已发布文章');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DF8 sitemap lastmod 优先 modified；DF10/DF14 _redirects 无根 302 且根别名从 rss 派生', async () => {
  const dir = tmpdir('synapse-h2-df1410-');
  try {
    const feeds = createFeedsModule({
      distDir: dir,
      getFeed: function () { return null; },
      getPublished: function (list) { return list; },
      collectSeries: function () { return []; },
      collectTags: function () { return []; },
      collectCategories: function () { return []; },
      recordBuildFailure: function () {}
    });
    // generateSitemap 经 ctx.collectTags/collectCategories 派生标签/分类页（同上注入空收集器）。
    const smCfg = { site: { url: 'https://example.com', languages: ['zh'], build: {}, sitemap: { enabled: true, path: '/sitemap.xml' } }, features: { sitemap: { split: false } } };
    await feeds.generateSitemap(smCfg, [article('zh', 'a', { modified: '2024-06-01' })], [], [], []);
    const xml = fs.readFileSync(path.join(dir, 'zh', 'sitemap.xml'), 'utf-8');
    assert.ok(xml.includes('<lastmod>2024-06-01T00:00:00.000Z</lastmod>'), 'sitemap 必须使用 modified：' + xml.slice(0, 400));

    const sec = createSecurityFilesModule({
      distDir: dir,
      cspNonce: 'n',
      applyHeaderHardening: function (s) { return (s && s.headers) || {}; },
      buildSitemapUrls: function () { return []; },
      bundleActive: true,
      recordBuildFailure: function () {}
    });
    const cfg = {
      features: { redirects: { enabled: true, generatePagesFile: true } },
      site: {
        languages: ['zh', 'en'],
        redirects: [],
        rss: { enabled: true, path: '/feed.xml', jsonFeed: { enabled: true, path: '/jf.json' } }
      }
    };
    sec.generateRedirects(cfg, []);
    const redirects = fs.readFileSync(path.join(dir, '_redirects'), 'utf-8');
    assert.ok(!/^\/ /m.test(redirects), '不得再生成 `/ → /zh/ 302`：' + redirects);
    assert.ok(redirects.includes('/feed.xml /zh/feed.xml 302'), 'RSS 根别名保留');
    assert.ok(redirects.includes('/jf.json /zh/jf.json 302'), 'JSON Feed 别名必须从 rss.jsonFeed.path 派生');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DF3 cacheBust 以同一 mapping 重写 feed.xml/feed.json', async () => {
  const dir = tmpdir('synapse-h2-df3-');
  try {
    fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'zh'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'media', 'pic.jpg'), 'binary-pic');
    fs.writeFileSync(path.join(dir, 'zh', 'feed.xml'), '<item><img src="/media/pic.jpg"></item>');
    fs.writeFileSync(path.join(dir, 'zh', 'feed.json'), '{"content_html":"<img src=\\"/media/pic.jpg\\">"}');
    const mod = createMinifyModule({
      distDir: dir,
      cacheBustManifestPath: path.join(dir, 'cache-bust-manifest.json'),
      bundleActive: true,
      getAllFiles: getAllFiles,
      recordBuildFailure: function () {},
      minifyHtmlNode: null,
      CleanCSS: null,
      terser: null
    });
    const cfg = {
      site: {
        languages: ['zh'],
        build: { enableCacheBusting: true, cacheBustingPattern: '.*\\.(css|js|png|jpg|svg)$' },
        rss: { enabled: true, path: '/feed.xml', jsonFeed: { enabled: true, path: '/feed.json' } }
      }
    };
    await mod.cacheBust(cfg);
    const mediaName = fs.readdirSync(path.join(dir, 'media'))[0];
    assert.match(mediaName, /^pic\.[0-9a-f]{10}\.jpg$/);
    assert.ok(fs.readFileSync(path.join(dir, 'zh', 'feed.xml'), 'utf-8').includes('/media/' + mediaName), 'feed.xml 必须重写');
    assert.ok(fs.readFileSync(path.join(dir, 'zh', 'feed.json'), 'utf-8').includes('/media/' + mediaName), 'feed.json 必须重写');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DF4 resolveBuildTheme 单一事实源：预设接管手工色 + presetOverrides 生效', () => {
  const theme = {
    preset: 'forest-green',
    colors: { secondary: '#000000' },
    darkMode: { enabled: true, colors: { background: '#000000' } },
    presetOverrides: { colors: { secondary: '#123456' } }
  };
  const res = resolveBuildTheme(theme);
  assert.match(res.appliedPreset, /forest-green/);
  assert.strictEqual(res.colors.secondary, '#123456', 'presetOverrides 优先级最高');
  assert.strictEqual(res.colors.primary, '#1e3a2f', '预设亮色接管手工 colors');
  const manual = resolveBuildTheme({ preset: null, colors: { secondary: '#abcdef' } });
  assert.strictEqual(manual.colors.secondary, '#abcdef', 'preset 为空时保留手工色');
  assert.strictEqual(manual.appliedPreset, null);
});

test('DF4 OG 指纹覆盖 appliedPreset/presetOverrides/coverFit/overlay/useCover', () => {
  const base = {
    format: 'png', ext: 'png', quality: 90, width: 1200, height: 630, fontScale: 1,
    style: { template: 'aurora' }, palette: { darkBg: '#000' }, paletteMode: 'theme',
    colors: { from: '#111', to: '#222' }, siteTitle: 'T', siteUrl: 'https://example.com',
    appliedPreset: '经典蓝(classic-blue)', presetOverrides: null, coverFit: 'cover', overlay: { enabled: true }, useCover: true
  };
  const fp = buildOgFingerprint(base);
  assert.strictEqual(buildOgFingerprint(clone(base)), fp, '同输入同指纹');
  for (const key of ['appliedPreset', 'presetOverrides', 'coverFit', 'overlay', 'useCover']) {
    const changed = clone(base);
    changed[key] = key === 'useCover' ? false : { changed: true };
    assert.notStrictEqual(buildOgFingerprint(changed), fp, key + ' 变化必须使 OG 缓存失效');
  }
});

test('DF6 客户端默认档与构建期 guard 注册表逐字段一致', async () => {
  const mod = await import(pathToFileURL(path.join(ROOT, 'js', 'domains', 'guard', 'defaults.js')).href);
  const { DEFAULT_GUARD } = require('./lib/guard-defaults.js');
  assert.deepStrictEqual(mod.DEFAULT_GUARD, DEFAULT_GUARD, '客户端降级默认档必须与 scripts/lib/guard-defaults.js 同构');
});

test('DF13/HC6 语言表工具：languages[0]、BCP 47 前缀、缺失回退', () => {
  assert.deepStrictEqual(siteLanguages({ languages: ['en'] }), ['en']);
  assert.deepStrictEqual(siteLanguages({}), ['zh', 'en'], '缺失回退默认双语表');
  assert.strictEqual(primaryLanguage({ languages: ['en-US'] }), 'en-US');
  assert.strictEqual(isEnglish('en-US'), true);
  assert.strictEqual(isEnglish('zh-CN'), false);
});

test('HC6 runtime langOf/__langSeg/__langStrip/__T：判定顺序与默认语言', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'core', 'runtime.js'), 'utf-8');
  const sandbox = {
    console: console,
    setTimeout: function () {},
    clearTimeout: function () {},
    navigator: { language: 'en-US' },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    location: { pathname: '/en/page/' },
    fetch: undefined
  };
  sandbox.window = sandbox;
  sandbox.document = {
    documentElement: {
      attrs: { lang: 'en-US' },
      getAttribute: function (name) { return this.attrs[name] || ''; },
      setAttribute: function () {},
      classList: { contains: function () { return false; } }
    }
  };
  sandbox.window.__LANGS__ = ['zh', 'en'];
  vm.runInNewContext(src, sandbox);
  assert.strictEqual(sandbox.window.langOf(), 'en', 'html lang BCP 47 前缀判定');
  sandbox.document.documentElement.attrs['data-lang'] = 'zh';
  assert.strictEqual(sandbox.window.langOf(), 'zh', 'data-lang 优先');
  delete sandbox.document.documentElement.attrs['data-lang'];
  sandbox.document.documentElement.attrs.lang = '';
  assert.strictEqual(sandbox.window.langOf(), 'en', 'URL 前缀判定');
  assert.strictEqual(sandbox.window.__langSeg('/zh/a'), 'zh');
  assert.strictEqual(sandbox.window.__langSeg('/about/'), '', '非语言段返回空');
  assert.strictEqual(sandbox.window.__langStrip('/en/a/b'), '/a/b');
  assert.strictEqual(sandbox.window.__langPrefix(), '/en/');
  sandbox.window.__I18N__ = { x: 'ZX', en: { x: 'EX' } };
  assert.strictEqual(sandbox.window.__T('x', 'D'), 'EX', '__T 按 langOf 取英文字典');
});

test('HC6 前端语言检测残留：已统一到 langOf，旧模式不得回流', () => {
  const dirs = [];
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'vendor' || entry.name === 'node_modules') continue;
        walk(path.join(d, entry.name));
      } else if (/\.js$/.test(entry.name)) dirs.push(path.join(d, entry.name));
    }
  })(path.join(ROOT, 'js'));
  const bad = [];
  for (const file of dirs) {
    if (file.endsWith(path.join('core', 'runtime.js'))) continue;
    const text = fs.readFileSync(file, 'utf-8');
    if (/document\.documentElement\.lang \|\| 'zh'\)\.startsWith\('en'\)/.test(text)) bad.push(file + ' (startsWith 检测)');
    if (/lang \|\| ''\)\.toLowerCase\(\)\.indexOf\('en'\)/.test(text)) bad.push(file + ' (indexOf 检测)');
    if (/\/\^\\\/\(zh\|en\)/.test(text) || /replace\(\/\^\\\/\(zh\|en\)\//.test(text)) bad.push(file + ' (zh|en 正则)');
  }
  assert.deepStrictEqual(bad, [], '旧语言检测模式残留：' + bad.join('; '));
  const i18n = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'i18n.js'), 'utf-8');
  assert.ok(i18n.includes('__langSeg') && i18n.includes('__langStrip') && i18n.includes('__LANGS__'), 'i18n 必须走统一语言工具');
});

test('DF7/DF9/DF12 模板门控与索引错误态（源级回归）', () => {
  const layout = fs.readFileSync(path.join(ROOT, 'templates', 'layout.ejs'), 'utf-8');
  const langWrapAt = layout.indexOf('class="lang-wrap"');
  const langCondStart = layout.lastIndexOf('<% if(', langWrapAt);
  assert.ok(langWrapAt > -1 && langCondStart > -1, '语言按钮必须存在');
  const langCond = layout.slice(langCondStart, langWrapAt);
  assert.ok(langCond.includes('siteLanguages') && !langCond.includes('themePresets'), '语言按钮必须脱离 themePresets 条件：' + langCond);
  assert.match(layout, /var _rssHead=!!\(site\.rss&&site\.rss\.enabled/, 'feed alternate 必须按 site.rss.enabled 门控');
  assert.ok(!layout.includes('/search-index.json'), 'layout 不得再回退 v1 死路径');
  assert.match(layout, /window\.__LANGS__=/, 'layout 必须注入 __LANGS__');
  for (const rel of ['js/domains/features/search.js', 'js/domains/features/search-page.js', 'js/domains/features/command-palette.js']) {
    assert.ok(!fs.readFileSync(path.join(ROOT, rel), 'utf-8').includes('/search-index.json'), rel + ' 不得回退 v1 死路径');
  }
});
