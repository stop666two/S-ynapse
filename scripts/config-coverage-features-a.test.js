'use strict';
// 配置开关覆盖证据（features.* A 切片：anchorStabilize … ogImageStyle.palette）。
//
// 三个层次的证据，均要求断言依赖开关取值：
//   1) 构建产物：用真实 config 管线（scripts/build/config.js → loadConfig）渲染
//      templates/site-css.ejs / layout.ejs / post.ejs / index.ejs / page.ejs，
//      断言开关翻转前后产物结构随之变化（默认态出现 / 关闭态消失，或数值不同）。
//   2) 消费者纯函数：js/domains/features/lightbox-core.js（缩放归一化）、
//      js/domains/core/math-render.js（KaTeX strict）、scripts/lib/og-format.js（JPEG 质量）。
//   3) 运行时载荷：仅被浏览器消费的开关，经 scripts/lib/config-split.js 确认取值进入
//      external/critical 载荷（含翻转前后差异），并与 features-schema 默认值对照。
//
// 运行：node --test scripts/config-coverage-features-a.test.js（由 npm test 统一收集）。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const json5 = require('json5');
const deepmerge = require('deepmerge');

const ROOT = path.resolve(__dirname, '..');
const { createConfigModule } = require('./build/config');
const { buildRuntimeConfig } = require('./lib/config-split');
const { DEFAULT_FEATURES } = require('./lib/features-schema');
const { resolveOgFormat } = require('./lib/og-format');
const { buildOgFingerprint } = require('./lib/og-cache-key');
const utils = require('./lib/utils');

// ---------------------------------------------------------------------------
// 真实配置管线（只读）：DEFAULT_* → 仓库 json5 → 选项校验 → 视觉/字体派生。
// 顶层缓存一次，避免每个 test 重复解析配置。
// ---------------------------------------------------------------------------
let cachedConfig = null;
function repoConfig() {
  if (cachedConfig) return cachedConfig;
  const mod = createConfigModule({
    rootDir: ROOT,
    watchMode: false,
    featuresOverridePath: '',
    themeOverridePath: '',
    getJson5: () => json5,
    getDeepmerge: () => deepmerge,
    getVendorFonts: () => [],
    buildCspTrimContext: () => ({})
  });
  cachedConfig = mod.loadConfig();
  return cachedConfig;
}

const MERGE_OPTS = { arrayMerge: (target, source) => source };

// 在真实配置上覆写 features（与 --features-override 同语义：深合并 + 数组替换）。
function configWith(featuresPatch) {
  const cfg = JSON.parse(JSON.stringify(repoConfig()));
  if (featuresPatch) {
    cfg.features = deepmerge.all([{}, cfg.features, featuresPatch], MERGE_OPTS);
  }
  return cfg;
}

function getPath(obj, keyPath) {
  return String(keyPath).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function externalFeatures(features) {
  return buildRuntimeConfig({ features }).external.features;
}

function criticalGuards(features) {
  return buildRuntimeConfig({ features }).critical.features.guards;
}

// ---------------------------------------------------------------------------
// 模板渲染夹具：等价于 buildPageData 产出的 baseData（只保留渲染所需字段），
// 让模板用真实配置渲染，而不是手写期望字符串。
// ---------------------------------------------------------------------------
function uiStrings(pathKey, fallback, lang) {
  let dict = repoConfig().uiStrings || {};
  if (lang === 'en' && dict.en) dict = dict.en;
  return getPath(dict, pathKey) == null ? fallback : getPath(dict, pathKey);
}

function baseData(cfg, extra) {
  const data = Object.assign({}, utils, cfg, {
    nav: cfg.navigation,
    siteLanguages: ['zh', 'en'],
    lang: 'zh',
    langs: ['zh', 'en'],
    langPrefix: '/zh/',
    currentUrl: '/zh/',
    currentPage: 'index',
    body: '',
    title: 'T',
    description: '',
    canonical: 'https://example.com/',
    ogImage: 'https://example.com/og.png',
    seo: {},
    page: {},
    toc: [],
    posts: [],
    tags: [],
    categories: [],
    archive: {},
    pagination: null,
    siteCssHref: '/assets/site.css',
    runtimeConfigUrl: '/assets/config.test.json',
    nonce: 'test-nonce',
    stats: {},
    series: null,
    related: [],
    gallery: [],
    friends: [],
    announcement: null,
    dailyQuote: null,
    hero: {},
    views: {},
    article: null,
    prevArticle: null,
    nextArticle: null,
    relatedArticles: [],
    pagesContent: {},
    seriesList: [],
    siteStats: {},
    recentPosts: [],
    allArticles: [],
    allTags: [],
    allCategories: [],
    listCoverEnabled: true,
    listCoverFallback: 'gradient',
    coverCfg: { enabled: true, patterns: ['gradient'], defaultPattern: 'gradient', preferImage: true },
    wordCfg: {},
    heatmapCfg: { levels: 5 },
    heatmapPalette: [],
    heatmapLegendLevels: [],
    statsCfg: {},
    mobileCfg: {},
    contactPopupCfg: {},
    lightboxCfg: {},
    backToTopCfg: {},
    exportCfg: {},
    pinnedCfg: { showBadge: true, badgeStyle: 'pill' },
    bilingualCfg: {},
    themeDarkMode: {},
    analyticsCfg: {},
    analyticsTag: '',
    showHelpHint: true,
    imageFitCss: '',
    friendsSidebarCount: 0,
    errorPageCfg: {},
    galleryItems: [],
    searchProvider: 'local',
    searchIndexUrls: { zh: '/assets/search.zh.json' },
    siteTitle: 'S',
    siteUrl: 'https://example.com',
    ui: uiStrings,
    t: (key, fallback) => fallback || key,
    formatDate: (d) => String(d),
    generateSlug: (s) => s,
    categoryHue: () => 200
  });
  return Object.assign(data, extra || {});
}

function renderTemplate(template, cfg, extra) {
  const data = baseData(cfg, extra);
  data.features = cfg.features;
  data.theme = cfg.theme;
  data.tuning = cfg.tuning;
  data.sidebar = cfg.sidebar;
  data.site = cfg.site;
  return ejs.render(
    fs.readFileSync(path.join(ROOT, 'templates', template), 'utf-8'),
    data,
    { filename: template, root: path.join(ROOT, 'templates') }
  );
}

const ARTICLE = {
  slug: 'a',
  title: 'A',
  url: '/zh/a/',
  content: '<p>x</p>',
  toc: [{ level: 2, text: 'H', id: 'h' }],
  wordCount: 10,
  readTime: 1,
  featuredImage: '',
  relatedArticles: [],
  hasMermaid: true
};

// ---------------------------------------------------------------------------
// 1) site-css.ejs：CSS 产物中的开关门控
// ---------------------------------------------------------------------------
test('site-css：anchorStabilize/atmosphere/darkImageFilter/imageFit 总开关门控 CSS 规则', () => {
  // switch: features.anchorStabilize.enabled, features.atmosphere.enabled, features.darkImageFilter.enabled, features.imageFit.enabled
  const on = renderTemplate('site-css.ejs', configWith(null));
  // 默认态四条规则都必须存在（证明断言不是恒假）
  assert.ok(on.includes('html.anchor-stabilizing{overflow-anchor:none}'), '默认态缺少 anchor-stabilizing 规则');
  assert.ok(on.includes('body::after{content:\'\''), '默认态缺少氛围层 body::after');
  assert.ok(on.includes('[data-theme=&#34;dark&#34;] img{filter:brightness(0.85) saturate(0.9)}'), '默认态缺少暗色图片滤镜');
  assert.ok(on.includes('--if-cfit: cover'), '默认态缺少 imageFit 的封面 object-fit 变量');

  const off = renderTemplate('site-css.ejs', configWith({
    anchorStabilize: { enabled: false },
    atmosphere: { enabled: false },
    darkImageFilter: { enabled: false },
    imageFit: { enabled: false }
  }));
  assert.ok(!off.includes('anchor-stabilizing'), 'anchorStabilize.enabled=false 仍输出 overflow-anchor 规则');
  assert.ok(!off.includes('body::after{content:\'\''), 'atmosphere.enabled=false 仍输出氛围层');
  assert.ok(!off.includes('saturate(0.9)'), 'darkImageFilter.enabled=false 仍输出暗色滤镜');
  assert.ok(!off.includes('--if-cfit'), 'imageFit.enabled=false 仍输出 imageFit 变量块');
});

test('site-css：imageFit.cover.fit 决定封面 object-fit 变量值', () => {
  // switch: features.imageFit.cover.fit
  const cover = renderTemplate('site-css.ejs', configWith(null));
  assert.ok(cover.includes('--if-cfit: cover'), '默认 fit=cover 未写入 --if-cfit');
  const contain = renderTemplate('site-css.ejs', configWith({ imageFit: { cover: { fit: 'contain' } } }));
  assert.ok(contain.includes('--if-cfit: contain'), 'fit=contain 未生效');
  assert.ok(!contain.includes('--if-cfit: cover'), 'fit=contain 时仍输出 cover');
  const fill = renderTemplate('site-css.ejs', configWith({ imageFit: { cover: { fit: 'fill' } } }));
  assert.ok(fill.includes('--if-cfit: fill'), 'fit=fill 未生效');
});

// ---------------------------------------------------------------------------
// 2) layout.ejs：页头/正文骨架开关
// ---------------------------------------------------------------------------
test('layout：announcement.enabled 与 showProgress 控制公告条与进度条', () => {
  // switch: features.announcement.enabled, features.announcement.showProgress
  const items = [
    { text: '第一条', textEn: 'first' },
    { text: '第二条', textEn: 'second' }
  ];
  const layoutArticle = Object.assign({}, ARTICLE, { hasMermaid: false });
  const on = renderTemplate('layout.ejs', configWith({ announcement: { items, showProgress: true } }), {
    body: '<p>x</p>', article: layoutArticle
  });
  assert.ok(on.includes('id="announceBar"'), '默认态未渲染公告条');
  assert.ok(on.includes('class="announce-progress"'), 'showProgress=true 未输出进度元素');
  const progressOff = renderTemplate('layout.ejs', configWith({
    announcement: { items, showProgress: false }
  }), { body: '<p>x</p>', article: layoutArticle });
  assert.ok(!progressOff.includes('class="announce-progress"'), 'showProgress=false 仍输出进度元素');
  assert.ok(progressOff.includes('id="announceBar"'), 'showProgress=false 不应影响公告条本身');
  const disabled = renderTemplate('layout.ejs', configWith({
    announcement: { items, enabled: false }
  }), { body: '<p>x</p>', article: layoutArticle });
  assert.ok(!disabled.includes('id="announceBar"'), 'announcement.enabled=false 仍渲染公告条');
});

test('layout：hreflang/breadcrumb/i18n/customCSS/mobileBottomNav/mobileToc 门控与 mermaid 空闲超时注入', () => {
  // switch: features.hreflang.enabled, features.breadcrumb.enabled, features.i18n.enabled, features.customCSS.enabled, features.mobileBottomNav.enabled, features.mobileToc.enabled, features.mermaid.idleTimeoutMs, features.imageFit.lightbox.fit
  const on = renderTemplate('layout.ejs', configWith({
    customCSS: { css: ['.x{color:red}'] },
    mermaid: { idleTimeoutMs: 1234 },
    imageFit: { lightbox: { fit: 'actual' } }
  }), { body: '<p>x</p>', currentPage: 'post', article: ARTICLE });
  assert.ok(on.includes('hreflang="x-default"'), '默认态缺少 hreflang x-default');
  assert.ok(on.includes('<nav class="breadcrumb"'), '默认态缺少面包屑');
  assert.ok(on.includes('lang-wrap'), '默认态缺少语言切换容器');
  assert.ok(on.includes('<style id="customCSS">'), '默认态缺少自定义 CSS');
  assert.ok(on.includes('id="mBottomNav"'), '默认态缺少移动端底部导航');
  assert.ok(on.includes('id="mTocBtn"'), '默认态缺少移动端目录按钮');
  assert.ok(on.includes('1234'), 'mermaid.idleTimeoutMs 未注入页面脚本');
  assert.ok(on.includes('data-lb-fit="actual"'), 'imageFit.lightbox.fit=actual 未输出 data-lb-fit');

  const off = renderTemplate('layout.ejs', configWith({
    hreflang: { enabled: false },
    breadcrumb: { enabled: false },
    i18n: { enabled: false },
    customCSS: { enabled: false, css: ['.x{color:red}'] },
    mobileBottomNav: { enabled: false },
    mobileToc: { enabled: false },
    mermaid: { idleTimeoutMs: 99 },
    imageFit: { lightbox: { fit: 'contain' } }
  }), { body: '<p>x</p>', currentPage: 'post', article: ARTICLE });
  assert.ok(!off.includes('hreflang="x-default"'), 'hreflang.enabled=false 仍输出 hreflang');
  assert.ok(!off.includes('<nav class="breadcrumb"'), 'breadcrumb.enabled=false 仍输出面包屑');
  assert.ok(!off.includes('lang-wrap'), 'i18n.enabled=false 仍输出语言切换');
  assert.ok(!off.includes('<style id="customCSS">'), 'customCSS.enabled=false 仍注入自定义 CSS');
  assert.ok(!off.includes('id="mBottomNav"'), 'mobileBottomNav.enabled=false 仍输出底部导航');
  assert.ok(!off.includes('id="mTocBtn"'), 'mobileToc.enabled=false 仍输出目录按钮');
  assert.ok(off.includes('99') && !off.includes('1234'), 'mermaid.idleTimeoutMs 翻转未反映到页面脚本');
  assert.ok(!off.includes('data-lb-fit="actual"'), 'imageFit.lightbox.fit=contain 仍输出 data-lb-fit');
});

// ---------------------------------------------------------------------------
// 3) post/index/page 模板：文章页与列表页开关
// ---------------------------------------------------------------------------
test('post：favorites/magazine/giscus 门控文章页区块', () => {
  // switch: features.favorites.enabled, features.magazine.enabled, features.giscus.enabled
  const extra = { article: ARTICLE, prevArticle: null, nextArticle: null };
  const on = renderTemplate('post.ejs', configWith({ giscus: { enabled: true } }), extra);
  assert.ok(on.includes('fav-btn'), '默认态缺少收藏按钮');
  assert.ok(on.includes('mg-dropcap'), '默认态缺少杂志排版类');
  assert.ok(on.includes('giscusContainer'), 'giscus.enabled=true 未输出评论区容器');
  const defaultOff = renderTemplate('post.ejs', configWith(null), extra);
  assert.ok(!defaultOff.includes('giscusContainer'), '站点默认 giscus.enabled=false 时不应输出评论区');

  const off = renderTemplate('post.ejs', configWith({
    favorites: { enabled: false },
    magazine: { enabled: false },
    giscus: { enabled: false }
  }), extra);
  assert.ok(!off.includes('fav-btn'), 'favorites.enabled=false 仍输出收藏按钮');
  assert.ok(!off.includes('mg-dropcap'), 'magazine.enabled=false 仍输出杂志排版类');
  assert.ok(!off.includes('giscusContainer'), 'giscus.enabled=false 仍输出评论区');
});

test('index：cardFx 与 continueReading 门控首页卡片特效与续读区', () => {
  // switch: features.cardFx.enabled, features.continueReading.enabled
  const article = { slug: 'a', title: 'A', url: '/zh/a/', excerpt: 'e', tags: [], featuredImage: '' };
  const extra = { articles: [article], pagination: null, heroData: null };
  // cardFx.hoverShine 在示例站为 false；两态都显式开启它以隔离 enabled 的效应。
  const on = renderTemplate('index.ejs', configWith({
    cardFx: { enabled: true, hoverShine: true }
  }), extra);
  assert.ok(on.includes('card-shine'), 'cardFx.enabled=true + hoverShine=true 缺少卡片悬浮特效类');
  assert.ok(on.includes('continueReading'), '默认态缺少续读区');

  const off = renderTemplate('index.ejs', configWith({
    cardFx: { enabled: false, hoverShine: true },
    continueReading: { enabled: false }
  }), extra);
  assert.ok(!off.includes('card-shine'), 'cardFx.enabled=false 仍输出卡片特效类');
  assert.ok(!off.includes('continueReading'), 'continueReading.enabled=false 仍输出续读区');
});

test('page：authorCard.enabled 门控关于页作者卡', () => {
  // switch: features.authorCard.enabled
  const extra = {
    pageSlug: 'about',
    pageTitle: '关于',
    pageContent: '<p>hi</p>',
    // 作者卡渲染还要求 site.authorProfile 有 name/bio；显式提供，避免依赖示例站个人资料。
    site: Object.assign({}, repoConfig().site, {
      author: 'Tester',
      authorProfile: { name: 'Tester', bio: 'bio' }
    })
  };
  const on = renderTemplate('page.ejs', configWith({ authorCard: { enabled: true } }), extra);
  assert.ok(on.includes('author-card'), 'authorCard.enabled=true 缺少作者卡');
  const off = renderTemplate('page.ejs', configWith({ authorCard: { enabled: false } }), extra);
  assert.ok(!off.includes('author-card'), 'authorCard.enabled=false 仍输出作者卡');
});

// ---------------------------------------------------------------------------
// 4) 消费者纯函数
// ---------------------------------------------------------------------------
test('lightbox-core.resolveZoomConfig：zoomEnabled / zoomMax 归一化', async () => {
  // switch: features.lightbox.zoomEnabled, features.lightbox.zoomMax
  const core = await import(require('node:url').pathToFileURL(
    path.join(ROOT, 'js', 'domains', 'features', 'lightbox-core.js')
  ).href);
  assert.deepStrictEqual(core.resolveZoomConfig({}), { enabled: true, maxScale: 4 }, '默认应为开启且 4 倍');
  assert.deepStrictEqual(core.resolveZoomConfig({ zoomEnabled: false }), { enabled: false, maxScale: 4 });
  assert.deepStrictEqual(core.resolveZoomConfig({ zoomMax: 2 }), { enabled: true, maxScale: 2 });
  assert.strictEqual(core.resolveZoomConfig({ zoomMax: 0 }).maxScale, 1, 'maxScale 下限为 1');
  assert.deepStrictEqual(core.resolveZoomConfig({ zoomEnabled: false, zoomMax: 6 }), { enabled: false, maxScale: 6 });
});

test('math-render.render：features.math.strict 与 mathml 传入 KaTeX 选项', async () => {
  // switch: features.math.strict
  const assertStrict = async (strictValue, expected) => {
    const calls = [];
    const root = {
      querySelector: () => null,
      querySelectorAll: () => [],
      textContent: ''
    };
    globalThis.window = {
      __FEATURES__: { math: { enabled: true, strict: strictValue } },
      __TUNING__: {},
      katex: {
        render: (tex, el, opts) => { calls.push(opts); }
      },
      renderMathInElement: () => {}
    };
    globalThis.document = { querySelector: () => root };
    const url = 'data:text/javascript;base64,' + Buffer.from(
      fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'math-render.js'), 'utf-8'), 'utf-8'
    ).toString('base64');
    const mod = await import(url);
    const el = {
      getAttribute: (name) => (name === 'data-tex' ? 'x^2' : null),
      setAttribute: () => {},
      classList: { contains: () => false }
    };
    const fakeRoot = {
      querySelectorAll: () => [el],
      textContent: '',
      querySelector: () => null
    };
    assert.strictEqual(mod.render(fakeRoot), true, 'render 应返回 true');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].strict, expected, 'strict 取值未传入 KaTeX');
  };
  await assertStrict('warn', 'warn');
  await assertStrict('ignore', 'ignore');
  await assertStrict(false, false);
  await assertStrict(undefined, false);
  delete globalThis.window;
  delete globalThis.document;
});

test('resolveOgFormat：ogImage.jpegQuality 只对 jpeg 生效并钳制 1–100', () => {
  // switch: features.ogImage.jpegQuality
  const def = resolveOgFormat({ format: 'jpeg' });
  assert.strictEqual(def.format, 'jpeg');
  assert.strictEqual(def.ext, 'jpg');
  assert.strictEqual(def.quality, 82, '默认质量应为 82');
  assert.strictEqual(resolveOgFormat({ format: 'jpeg', jpegQuality: 55 }).quality, 55);
  assert.strictEqual(resolveOgFormat({ format: 'jpg', jpegQuality: 0 }).quality, 82, '越界回退 82');
  assert.strictEqual(resolveOgFormat({ format: 'jpeg', jpegQuality: 101 }).quality, 82, '越界回退 82');
  assert.strictEqual(resolveOgFormat({ format: 'png', jpegQuality: 55 }).quality, null, 'png 模式不应带质量');
});

// ---------------------------------------------------------------------------
// 5) OG 生成参数：fontScale / useCover / maxLines / palette
//    generate-og.js 是 CLI（无模块导出），因此证据分两层：
//    (a) 真实配置管线（loadConfig）把四个键送到 generate-og 读取的 config.features 位置；
//    (b) OG 产物指纹随该参数变化（指纹进入 OG 缓存键，参数变化必须重生成图片，
//        见 scripts/lib/og-cache-key.js 与 generate-og.js 的 buildOgFingerprint 调用）。
// ---------------------------------------------------------------------------
test('OG 生成参数：fontScale / useCover / ogImageStyle.maxLines / palette 到达配置层且参与产物指纹', () => {
  // switch: features.ogImage.fontScale, features.ogImage.useCover, features.ogImageStyle.maxLines, features.ogImageStyle.palette
  assert.strictEqual(DEFAULT_FEATURES.ogImage.fontScale, 0.75);
  assert.strictEqual(DEFAULT_FEATURES.ogImage.useCover, true);
  assert.strictEqual(DEFAULT_FEATURES.ogImageStyle.maxLines, 4);
  assert.strictEqual(DEFAULT_FEATURES.ogImageStyle.palette, 'theme');

  // (a) 配置管线：覆写后 generate-og 读取的 features 段取新值，默认态保持默认。
  const defCfg = configWith(null).features;
  assert.strictEqual(defCfg.ogImage.fontScale, 0.75);
  assert.strictEqual(defCfg.ogImage.useCover, true);
  assert.strictEqual(defCfg.ogImageStyle.palette, 'theme');
  const overCfg = configWith({
    ogImage: { fontScale: 1.2, useCover: false },
    ogImageStyle: { maxLines: 2, palette: 'hash' }
  }).features;
  assert.strictEqual(overCfg.ogImage.fontScale, 1.2, 'ogImage.fontScale 覆写未到达配置层');
  assert.strictEqual(overCfg.ogImage.useCover, false, 'ogImage.useCover 覆写未到达配置层');
  assert.strictEqual(overCfg.ogImageStyle.maxLines, 2, 'ogImageStyle.maxLines 覆写未到达配置层');
  assert.strictEqual(overCfg.ogImageStyle.palette, 'hash', 'ogImageStyle.palette 覆写未到达配置层');

  // (b) 产物指纹敏感性：每一参数变化都必须产生不同指纹（否则会复用旧图）。
  const base = {
    format: 'png',
    ext: 'png',
    quality: null,
    width: 1200,
    height: 630,
    fontScale: DEFAULT_FEATURES.ogImage.fontScale,
    style: { maxLines: DEFAULT_FEATURES.ogImageStyle.maxLines },
    palette: { darkBg: '#000000' },
    paletteMode: DEFAULT_FEATURES.ogImageStyle.palette,
    colors: { from: '#111111', to: '#222222' },
    siteTitle: 'S',
    siteUrl: 'https://example.com',
    appliedPreset: null,
    presetOverrides: null,
    coverFit: 'cover',
    overlay: null,
    useCover: DEFAULT_FEATURES.ogImage.useCover
  };
  const fp = (patch) => buildOgFingerprint(Object.assign({}, base, patch));
  const def = fp({});
  assert.strictEqual(def, fp({}), '相同参数指纹必须稳定');
  assert.notStrictEqual(def, fp({ fontScale: 1.2 }), 'fontScale 未进入 OG 指纹');
  assert.notStrictEqual(def, fp({ useCover: false }), 'useCover 未进入 OG 指纹');
  assert.notStrictEqual(def, fp({ paletteMode: 'hash' }), 'ogImageStyle.palette 未进入 OG 指纹');
  assert.notStrictEqual(def, fp({ style: { maxLines: 2 } }), 'ogImageStyle.maxLines 未进入 OG 指纹');
});

// ---------------------------------------------------------------------------
// 6) guards 子开关：进入 critical 内联降级子集（浏览器降级路径唯一可信来源）
// ---------------------------------------------------------------------------
test('config-split critical：guards 的 accessGate/contextMenu/devtoolsDetect/watermark 透传到降级子集', () => {
  // switch: features.guards.accessGate, features.guards.contextMenu, features.guards.devtoolsDetect, features.guards.watermark
  const on = criticalGuards(configWith(null).features);
  assert.strictEqual(on.accessGate, true);
  assert.strictEqual(on.contextMenu, true);
  assert.strictEqual(on.devtoolsDetect, true);
  assert.strictEqual(on.watermark, true);

  const off = criticalGuards(configWith({
    guards: { accessGate: false, contextMenu: false, devtoolsDetect: false, watermark: false }
  }).features);
  assert.strictEqual(off.accessGate, false, 'guards.accessGate 未进入 critical 载荷');
  assert.strictEqual(off.contextMenu, false, 'guards.contextMenu 未进入 critical 载荷');
  assert.strictEqual(off.devtoolsDetect, false, 'guards.devtoolsDetect 未进入 critical 载荷');
  assert.strictEqual(off.watermark, false, 'guards.watermark 未进入 critical 载荷');
  assert.strictEqual(on.enabled, off.enabled, 'guards.enabled 不应被以上四个子开关影响');
});

// ---------------------------------------------------------------------------
// 7) 其余开关：消费者是「浏览器 init 期模块」或「CLI 脚本」，在不启动浏览器 /
//    不跑构建的前提下无法直接驱动其行为，故以接线证据覆盖：
//    真实配置管线（DEFAULT → features.json5 → 校验）把值送达运行时载荷
//    external.features（浏览器唯一读取源），且覆写可翻转、翻回可恢复。
// ---------------------------------------------------------------------------
const RUNTIME_ONLY_SWITCHES = [
  ['features.announcement.removeDelayMs', 777],
  ['features.autoSummary.maxLength', 90],
  ['features.backToTop.enabled', false],
  ['features.background.particles.count', 40],
  ['features.background.particles.opacity', 0.35],
  ['features.boot.idleTimeoutMs', 400],
  ['features.boot.log', true],
  ['features.codeCopy.buttonTimeout', 2500],
  ['features.commandPalette.enabled', false],
  ['features.contactPopup.maxItems', 2],
  ['features.dailyQuote.api.timeoutMs', 2500],
  ['features.externalLink.enabled', false],
  ['features.externalLink.mode', 'prohibit'],
  ['features.hotSearches.enabled', false],
  ['features.hotSearches.top', 3],
  ['features.imageFallback.enabled', false],
  ['features.imageLazy.enabled', false],
  ['features.imageLazy.fadeIn', false],
  ['features.lightbox.closeButton', false],
  ['features.lightbox.closeOnBackdrop', false],
  ['features.lightbox.escToClose', false],
  ['features.lightbox.zoomStep', 0.5],
  ['features.math.strict', true],
  ['features.mermaid.mode', 'client'],
  ['features.mermaid.size.fit', 'scale'],
  ['features.morphIcons.icons.copy', false],
  ['features.morphIcons.icons.menu', false],
  ['features.morphIcons.icons.theme', false],
  ['features.morphIcons.icons.tts', false],
  ['features.morphIcons.preload', 'idle'],
  ['features.motion.enabled', false],
  ['features.hero.enabled', false]
];

test('运行时载荷：仅 init/CLI 期消费的开关经 config-split 进入 external.features 且可翻转', () => {
  // switch: features.announcement.removeDelayMs, features.autoSummary.maxLength, features.backToTop.enabled, features.background.particles.count, features.background.particles.opacity, features.boot.idleTimeoutMs, features.boot.log, features.codeCopy.buttonTimeout, features.commandPalette.enabled, features.contactPopup.maxItems, features.dailyQuote.api.timeoutMs, features.externalLink.enabled, features.externalLink.mode, features.hotSearches.enabled, features.hotSearches.top, features.imageFallback.enabled, features.imageLazy.enabled, features.imageLazy.fadeIn, features.lightbox.closeButton, features.lightbox.closeOnBackdrop, features.lightbox.escToClose, features.lightbox.zoomStep, features.math.strict, features.mermaid.mode, features.mermaid.size.fit, features.morphIcons.icons.copy, features.morphIcons.icons.menu, features.morphIcons.icons.theme, features.morphIcons.icons.tts, features.morphIcons.preload, features.motion.enabled, features.hero.enabled
  const defaults = externalFeatures(configWith(null).features);
  for (const [keyPath, flipped] of RUNTIME_ONLY_SWITCHES) {
    const sub = keyPath.split('.').slice(1); // 去掉 'features' 前缀
    const leafParent = sub[sub.length - 1];
    const parentPath = sub.slice(0, -1);
    const cfgKey = sub[0];
    const baseline = getPath(defaults, sub.join('.'));

    // 1) 默认载荷必须携带该键（缺键时 undefined 会让下面的翻转断言失效）
    assert.notStrictEqual(baseline, undefined, keyPath + ' 未出现在 external.features 载荷中');

    // 2) 覆写后载荷取新值（深合并路径：configWith → buildRuntimeConfig）
    const patch = { [cfgKey]: {} };
    let cursor = patch[cfgKey];
    for (let i = 1; i < parentPath.length; i += 1) {
      cursor[parentPath[i]] = {};
      cursor = cursor[parentPath[i]];
    }
    cursor[leafParent] = flipped;
    const flippedPayload = getPath(externalFeatures(configWith(patch).features), sub.join('.'));
    assert.deepStrictEqual(flippedPayload, flipped, keyPath + ' 覆写后载荷未取新值');

    // 3) 翻转值必须与默认值不同，且再度覆写回默认值可恢复
    assert.notDeepStrictEqual(flipped, baseline, keyPath + ' 的测试取值与默认值相同，证据不成立');
    const restoredPayload = getPath(externalFeatures(configWith(null).features), sub.join('.'));
    assert.deepStrictEqual(restoredPayload, baseline, keyPath + ' 默认态载荷不稳定');
  }
});

// ---------------------------------------------------------------------------
// 8) schema 默认值登记（说明上述开关是「已注册的配置项」，而非任意对象透传）
// ---------------------------------------------------------------------------
test('features-schema：本切片涉及的默认值已登记（缺键会退回 schema 默认）', () => {
  // switch: features.backToTop.enabled, features.boot.idleTimeoutMs, features.codeCopy.buttonTimeout, features.contactPopup.maxItems, features.hotSearches.top, features.lightbox.zoomStep, features.mermaid.size.fit
  assert.strictEqual(DEFAULT_FEATURES.backToTop.enabled, true);
  assert.strictEqual(DEFAULT_FEATURES.boot.idleTimeoutMs, 800);
  assert.strictEqual(DEFAULT_FEATURES.codeCopy.buttonTimeout, 1500);
  assert.strictEqual(DEFAULT_FEATURES.contactPopup.maxItems, 4);
  assert.strictEqual(DEFAULT_FEATURES.hotSearches.top, 5);
  assert.strictEqual(DEFAULT_FEATURES.lightbox.zoomStep, 0.25);
  assert.deepStrictEqual(DEFAULT_FEATURES.mermaid.size.fit, 'scroll');
});
