#!/usr/bin/env node
// S-ynapse Static Blog Builder — main build pipeline
// Reads Markdown articles + JSON5 configs + EJS templates → fully static HTML site
// Pipeline order: config → validate → dist → static → media → articles → pages → RSS → sitemap → search → security headers → minify → cache bust → PWA

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 构建期 CSP nonce（每次构建进程生成一次）：同一值写入最终 HTML 的 <script nonce="...">
// 与 CSP 的 script-src 'nonce-...'（_headers / Worker / meta 三处同源），两者必须同步，
// 否则内联脚本会被浏览器按 CSP 拦截。
const CSP_NONCE = crypto.randomBytes(16).toString('base64');

// Optional dependency loading — each fails gracefully to null/fallback
// This allows the build to run with missing packages (features degrade instead of crashing)
let json5, deepmerge, Feed, sharp, minifyHtmlNode, CleanCSS, terser, chokidar;
const { spawnSync } = require('child_process');
try { json5 = require('json5'); } catch (e) {
  console.warn('[WARN] json5 package not found, config files with comments will fail to parse. Run: npm install json5');
  json5 = { parse: JSON.parse };
}
// deepmerge fallback: recursive object merge (supports indefinite nesting)
try { deepmerge = require('deepmerge'); } catch (e) {
  deepmerge = function deepMerge(...objs) {
    const result = {};
    for (const obj of objs) {
      if (!obj || typeof obj !== 'object') continue;
      for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) {
          result[key] = obj[key].slice();
        } else if (obj[key] && typeof obj[key] === 'object') {
          result[key] = deepMerge(result[key] || {}, obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
    return result;
  };
}
try { const feedMod = require('feed'); Feed = feedMod.Feed || feedMod; } catch (e) { Feed = null; }
try { sharp = require('sharp'); } catch (e) { sharp = null; }
try { minifyHtmlNode = require('@minify-html/node'); } catch (e) { minifyHtmlNode = null; }
try { CleanCSS = require('clean-css'); } catch (e) { CleanCSS = null; }
try { terser = require('terser'); } catch (e) { terser = null; }
try { chokidar = require('chokidar'); } catch (e) { chokidar = null; }
let generateWorkerSecurity;
let applyHeaderHardening = function (security) { return (security && security.headers) || {}; };
try {
  const secConfig = require('./generate-security-config');
  generateWorkerSecurity = secConfig.generateSecurityConfig;
  applyHeaderHardening = secConfig.applyHeaderHardening;
} catch (e) { generateWorkerSecurity = null; }

// Optional local hooks script (scripts/hooks.js) — allows external plugins to hook into build lifecycle
// Hook functions: preBuild(config), transformMarkdown(content, attrs), transformHTML(html, data), postBuild(config, stats)
let hooks;
try { hooks = require('./hooks'); } catch (e) { hooks = null; }
const { writeFileAtomicSync } = require('./lib/atomic-write');
const { buildSitemapUrls } = require('./lib/robots');
const { computeRelatedArticles } = require('./lib/related');
const { createBuildErrorCollector, resolveExitCode, formatFailures } = require('./lib/build-errors');
const { isScheduled } = require('./lib/publish-window');
const { bundleEnabled, esbuildAvailable, buildBundles } = require('./lib/bundle');
const { createMinifyModule } = require('./build/minify');
const { createMediaModule } = require('./build/media');
const { createFeedsModule } = require('./build/feeds');
const { createReportModule } = require('./build/report');
const { createRenderModule } = require('./build/render');
const { getAllFiles } = require('./build/fs-utils');
const { createAssetsModule } = require('./build/assets');
const { createSecurityFilesModule } = require('./build/security-files');
const { createConfigModule } = require('./build/config');
const { createMarkdownModule } = require('./build/markdown');
const { createArticlesModule } = require('./build/articles');
const { createCollectorsModule } = require('./build/collectors');
const { createHelpersModule } = require('./build/helpers');
const { createPagesModule } = require('./build/pages');

// Project directory structure — all paths relative to project root
const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');          // Markdown article source files

const STATIC_DIR = path.join(ROOT, 'static');               // Unprocessed static assets (copied verbatim)
const MEDIA_DIR = path.join(ROOT, 'media');                 // Source images (processed by sharp)
const VIDEOS_DIR = path.join(ROOT, 'videos');               // Source videos (copied with policy filter)
const ASSETS_DIR = path.join(ROOT, 'assets');               // Source downloadable files (copied with policy filter)
const TEMPLATES_DIR = path.join(ROOT, 'templates');         // EJS template files
const PAGES_DIR = path.join(ROOT, 'pages');                 // Standalone page Markdown files (about, privacy, etc.)

// Build output directory: `--out <dir>` > SYNAPSE_OUT_DIR > default dist/.
// Relative values resolve against ROOT. 集成测试/预览构建可用 --out 写入临时目录；
// 媒体与 OG 缓存（.build-cache.json / .cache/*）始终留在 ROOT，不随输出目录迁移。
function resolveOutputDir(argv) {
  const idx = argv.indexOf('--out');
  let value = (idx !== -1 && argv[idx + 1] && argv[idx + 1].charAt(0) !== '-') ? argv[idx + 1] : '';
  if (!value && process.env.SYNAPSE_OUT_DIR) value = process.env.SYNAPSE_OUT_DIR;
  if (!value) return { dir: path.join(ROOT, 'dist'), custom: false };
  return { dir: path.isAbsolute(value) ? path.resolve(value) : path.resolve(ROOT, value), custom: true };
}
const OUTPUT_DIR_RESOLVED = resolveOutputDir(process.argv);
const DIST_DIR = OUTPUT_DIR_RESOLVED.dir;                   // Build output directory

// CLI flags parsed from process.argv
const WATCH_MODE = process.argv.includes('--watch');        // Rebuild on file changes
const SERVE_MODE = process.argv.includes('--serve');        // Start dev HTTP server after build
const SHOW_DRAFTS = process.argv.includes('--drafts') || WATCH_MODE;  // Include draft articles
const ALLOW_DEGRADED = process.argv.includes('--allow-degraded');    // Local preview: continue past content failures (exit code stays 0)
const BUNDLE_ACTIVE = bundleEnabled(process.argv, esbuildAvailable());   // esbuild 两段 chunk；--no-bundle 回退原生 ESM

const CACHE_BUST_MANIFEST_PATH = path.join(DIST_DIR, 'cache-bust-manifest.json');
const BUILD_CACHE_PATH = path.join(ROOT, '.build-cache.json');
const MEDIA_CACHE_DIR = path.join(ROOT, '.cache', 'media');

// Build cache: source mtime+size+config fingerprint per media image / OG cover.
// Best-effort only — a corrupt or missing cache never fails the build.
function loadBuildCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(BUILD_CACHE_PATH, 'utf-8'));
    return {
      version: 1,
      media: raw && raw.media && typeof raw.media === 'object' ? raw.media : {},
      og: raw && raw.og && typeof raw.og === 'object' ? raw.og : {}
    };
  } catch (e) {
    return { version: 1, media: {}, og: {} };
  }
}

function saveBuildCache(cache) {
  try {
    writeFileAtomicSync(BUILD_CACHE_PATH, JSON.stringify(cache));
  } catch (e) {
    console.warn('  [WARN] Failed to write .build-cache.json: ' + e.message);
  }
}

const PKG_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version || '0.0.0';
  } catch (err) {
    return '0.0.0';
  }
})();

// 辅助函数模块（scripts/build/helpers.js）：注入项目根、favicon 静态目录、草稿开关、监视模式、
// JSON5 实现与构建错误收集器读取器（活值 getter）；函数体原样搬移（以 dist 哈希等价门禁验证）。
const { getPublished, resolveDailyQuotes, resolveFaviconHtml, recordBuildFailure } = createHelpersModule({
  rootDir: ROOT,
  staticDir: STATIC_DIR,
  watchMode: WATCH_MODE,
  showDrafts: SHOW_DRAFTS,
  getJson5: () => json5,
  getBuildErrors: () => BUILD_ERRORS
});

// 配置族模块（scripts/build/config.js）：注入项目根目录、监视模式、JSON5/深合并实现（活值 getter）
// 与后置模块提供的 CSP 裁剪上下文、字体清单；机械拆分 —— 函数体原样搬移（以 dist 哈希等价门禁验证）。
const { categoryHue, abortBuild, loadConfig, validateConfig } = createConfigModule({
  rootDir: ROOT,
  watchMode: WATCH_MODE,
  getJson5: () => json5,
  getDeepmerge: () => deepmerge,
  getVendorFonts: () => VENDOR_FONTS,
  buildCspTrimContext: (cfg) => buildCspTrimContext(cfg)
});

// Generate an SVG Open Graph image for social sharing (1200×630).
// Uses theme colors for background gradient, auto-splits long titles onto two lines.
// Output is written to dist/og/{lang}/{slug}.png during article processing (scripts/generate-og.js).

// 媒体与静态资产模块（scripts/build/media.js）：路径、缓存加载器与错误收集器通过 ctx 注入。
// 机械拆分 2/N —— 函数体原样搬移；getAllFiles 移至 scripts/build/fs-utils.js 供跨模块复用。
const { setupDist, copyStatic, copyProtectedAssets, optimizeMedia } = createMediaModule({
  distDir: DIST_DIR,
  staticDir: STATIC_DIR,
  mediaDir: MEDIA_DIR,
  videosDir: VIDEOS_DIR,
  assetsDir: ASSETS_DIR,
  mediaCacheDir: MEDIA_CACHE_DIR,
  sharp,
  loadBuildCache,
  saveBuildCache,
  recordBuildFailure
});

// Markdown 渲染模块（scripts/build/markdown.js）：marked 单例与 lib/utils 直连 require，无注入项。
// 机械拆分 —— 函数体原样搬移（以 dist 哈希等价门禁验证）。
const { setupMarkedRenderer } = createMarkdownModule();

// 文章内容管线模块（scripts/build/articles.js）：注入文章/页面/媒体目录、标记渲染器、hooks
// 与构建失败记录器；函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
const { processPagesContent, preflightContent, processArticles } = createArticlesModule({
  rootDir: ROOT,
  articlesDir: ARTICLES_DIR,
  pagesDir: PAGES_DIR,
  mediaDir: MEDIA_DIR,
  setupMarkedRenderer,
  getHooks: () => hooks,
  recordBuildFailure
});

// 数据收集器模块（scripts/build/collectors.js）：注入发布过滤器 getPublished（含草稿与定时发布语义）。
// 机械拆分 —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
const { collectTopTags, collectTags, collectSeries, collectFriends, collectGalleryImages, collectSiteStats, collectCategories, groupByYearMonth } = createCollectorsModule({
  getPublished
});

// Compute related articles using a tag/category scoring algorithm.
// Implementation lives in lib/related.js so the scoring (weights, topN,
// minScore) is unit-testable; this wrapper feeds it the published articles
// and the features.related config block.

// EJS 模板渲染模块（scripts/build/render.js）：注入模板目录、构建期 nonce、hooks 与构建错误收集器。
// 机械拆分 —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
const { getTemplate, renderPage } = createRenderModule({
  templatesDir: TEMPLATES_DIR,
  cspNonce: CSP_NONCE,
  hooks,
  recordBuildFailure
});

let SITE_APP_JS_HREF = '/assets/js/core/main.js';
let SITE_DEFERRED_URL = '';
let SITE_RUNTIME_JS_HREF = '/assets/js/core/runtime.js';
let MEDIA_MANIFEST = null;

let BUILD_ERRORS = null;

// 页面生成模块（scripts/build/pages.js）：注入产物/页面/模板目录、CSP nonce、模板渲染器、
// 发布过滤器、收集器、页面状态读取器（媒体 manifest getter、内联配置体积 setter）与共享依赖。
// 机械拆分 —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
const { buildSiteCss, writeRuntimeConfig, buildPageData, processCustomPages, generatePages } = createPagesModule({
  distDir: DIST_DIR,
  pagesDir: PAGES_DIR,
  templatesDir: TEMPLATES_DIR,
  cspNonce: CSP_NONCE,
  getTemplate,
  renderPage,
  getPublished,
  recordBuildFailure,
  collectFriends,
  collectSeries,
  collectGalleryImages,
  collectSiteStats,
  collectTags,
  collectCategories,
  collectTopTags,
  groupByYearMonth,
  categoryHue,
  resolveDailyQuotes,
  resolveFaviconHtml,
  CleanCSS,
  getMediaManifest: () => MEDIA_MANIFEST,
  setInlineConfigKb: (kb) => { inlineConfigKb = kb; }
});

// 订阅源/站点地图/搜索索引模块（scripts/build/feeds.js）：依赖通过 ctx 注入，函数体原样搬移。
const { generateRSS, generateJSONFeed, generateSitemap, pingSearchEngines, generateSearchIndex, generatePagefindIndex } = createFeedsModule({
  distDir: DIST_DIR,
  serveMode: SERVE_MODE,
  watchMode: WATCH_MODE,
  getFeed: () => Feed,
  getPublished,
  collectTags,
  collectCategories,
  recordBuildFailure
});

let inlineConfigKb = 0;

// 构建报告与性能预算模块（scripts/build/report.js）：注入产物目录、发布过滤器、内联配置体积读取器与构建错误收集器。
// 机械拆分 —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
const { checkPerfBudget, generateBuildReport } = createReportModule({
  distDir: DIST_DIR,
  getPublished,
  getInlineConfigKb: () => inlineConfigKb,
  recordBuildFailure
});

// Generate Cloudflare-compatible _headers file and robots.txt.
// 安全文件模块（scripts/build/security-files.js）：注入路径、nonce 与共享依赖。
// 机械拆分 4/N —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
const { generateRedirects, buildCspTrimContext, applyCspNonce, generateSecurityHeaders } = createSecurityFilesModule({
  distDir: DIST_DIR,
  cspNonce: CSP_NONCE,
  bundleActive: BUNDLE_ACTIVE,
  applyHeaderHardening: (sec) => applyHeaderHardening(sec),
  buildSitemapUrls
});


// 压缩与缓存指纹模块（scripts/build/minify.js）：注入路径、开关与共享依赖。
// 机械拆分 1/N —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
const { minifyAll, cacheBust } = createMinifyModule({
  distDir: DIST_DIR,
  cacheBustManifestPath: CACHE_BUST_MANIFEST_PATH,
  bundleActive: BUNDLE_ACTIVE,
  getAllFiles,
  recordBuildFailure,
  minifyHtmlNode,
  CleanCSS,
  terser
});

// 静态资产与 PWA 模块（scripts/build/assets.js）：注入根路径与产物目录。
// 机械拆分 5/N —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
const { copyJsAssets, copyRuntimeBootstrap, copyVendorAssets, generatePWA, VENDOR_FONTS } = createAssetsModule({
  root: ROOT,
  distDir: DIST_DIR,
  staticDir: STATIC_DIR,
  cspNonce: CSP_NONCE
});

// Pre-flight syntax check for all 6 JSON5 config files.
// Runs before loadConfig() to catch syntax errors early.
// Returns true if all files parse successfully, false otherwise.
// This is a fast check — loadConfig() does the actual parsing with fatal error handling.
function validateJsonSyntax() {
  const files = ['site.json5', 'theme.json5', 'navigation.json5', 'sidebar.json5', 'footer.json5', 'security.json5'];
  let hasError = false;
  for (const file of files) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      console.error(`  [ERROR] Config file not found: ${file}`);
      hasError = true;
      continue;
    }
    try {
      let raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      json5.parse(raw);
    } catch (err) {
      console.error(`  [ERROR] Syntax error in ${file}: ${err.message}`);
      hasError = true;
    }
  }
  return !hasError;
}

// Main build orchestrator — runs all 14 pipeline steps sequentially.
// Each step is independently skippable via its corresponding config flag.
// Lifecycle hooks (preBuild, postBuild) fire before step 1 and after step 14.
// On any fatal error, exits with code 1 after printing the error stack.
async function build() {
  console.log('========================================');
  console.log('  S-ynapse Static Blog Builder v' + PKG_VERSION);
  console.log('========================================\n');
  const startTime = Date.now();
  const buildErrors = createBuildErrorCollector();
  BUILD_ERRORS = buildErrors;
  if (!validateJsonSyntax()) {
    abortBuild('\n[FATAL] Build aborted due to configuration errors.\n');
  }
  try {
    const config = loadConfig();
    if (!validateConfig(config)) {
      abortBuild('\n[FATAL] Build aborted due to configuration errors.\n');
    }
    // CSP nonce 注入（远早于 _headers / Worker 生成，同时覆盖 meta CSP 与页面 HTML）
    applyCspNonce(config);
    if (hooks && hooks.preBuild) await hooks.preBuild(config);
    const preflight = preflightContent();
    if (preflight.errors.length > 0) {
      for (const entry of preflight.errors) buildErrors.add(entry.stage, entry.message);
      console.error('\n[PREFLIGHT] Content validation found ' + preflight.errors.length + ' problem(s):');
      console.error(formatFailures(preflight.errors));
      if (!ALLOW_DEGRADED) {
        abortBuild('\n[FATAL] Build aborted by content preflight errors. Fix the files above, or run with --allow-degraded for a local preview.\n');
      }
      console.warn('[WARN] --allow-degraded is set; continuing with degraded output.');
    }
    setupDist(config);
    copyStatic(config);
    const policyResult = copyProtectedAssets(config);
    const mediaManifest = await optimizeMedia(config);
    MEDIA_MANIFEST = mediaManifest;
    const articles = await processArticles(config, mediaManifest, buildErrors);
    if (articles.length === 0) console.log('  [WARN] No articles found');
    const scheduledCount = articles.filter(function(a) { return !a.draft && isScheduled(a, new Date()); }).length;
    if (scheduledCount > 0) console.warn('  [INFO] ' + scheduledCount + ' future-dated article(s) scheduled; excluded until their publish date.');
    const tags = collectTags(articles);
    const categories = collectCategories(articles);
    if (config.site.build.relatedArticles !== false) computeRelatedArticles(getPublished(articles), (config.features && config.features.related) || {});
    const pagesContent = processPagesContent();
    if (config.theme.articleFooter && config.theme.articleFooter.enabled && config.theme.articleFooter.source) {
      if (!pagesContent || !pagesContent[config.theme.articleFooter.source]) {
        console.warn(`  [WARN] articleFooter.source "${config.theme.articleFooter.source}" not found in pages/ directory`);
      }
    }
    const dailyQuotes = resolveDailyQuotes(config);
    const baseData = buildPageData(config, articles, tags, categories, dailyQuotes);
    if (pagesContent) baseData.pagesContent = pagesContent;
    baseData.siteCssHref = buildSiteCss(config, baseData);
    const runtimeConfig = writeRuntimeConfig(config, baseData.presets, dailyQuotes);
    baseData.runtimeConfigUrl = runtimeConfig.url;
    baseData.criticalConfig = runtimeConfig.critical;
    if (BUNDLE_ACTIVE) {
      const bundle = await buildBundles({ root: ROOT, outDir: DIST_DIR, minify: config.site.build.minifyJS !== false });
      SITE_APP_JS_HREF = bundle.appJsHref;
      SITE_DEFERRED_URL = bundle.deferredUrl;
      SITE_RUNTIME_JS_HREF = copyRuntimeBootstrap() || SITE_RUNTIME_JS_HREF;
      console.log('  Bundled: ' + bundle.files.join(', '));
    }
    baseData.appJsHref = SITE_APP_JS_HREF;
    baseData.deferredUrl = SITE_DEFERRED_URL;
    baseData.runtimeJsHref = SITE_RUNTIME_JS_HREF;
    const customPages = processCustomPages(config, baseData);
    await generatePages(config, articles, baseData, customPages);
    const generatedHtmlCount = getAllFiles(DIST_DIR).filter((f) => f.endsWith('.html')).length;
    if (generatedHtmlCount === 0) {
      throw new Error('页面生成结果为空：dist/ 下没有产出任何 HTML（模板渲染可能整体失败，请检查 templates/*.ejs 的语法与变量）');
    }
    const zh404 = path.join(DIST_DIR, 'zh', '404.html');
    if (fs.existsSync(zh404)) {
      fs.copyFileSync(zh404, path.join(DIST_DIR, '404.html'));
    }
    await generateRSS(config, articles);
    await generateJSONFeed(config, articles);
    await generateSitemap(config, articles, tags, categories, customPages);
    if (!SERVE_MODE && !WATCH_MODE && config.features && config.features.ogImage && config.features.ogImage.enabled !== false && articles.length > 0) {
      // 自定义输出目录（--out / SYNAPSE_OUT_DIR）时把解析后的绝对路径传给子进程，
      // 保证 generate-og.js 的产图目录与本次构建的 DIST_DIR 完全一致。
      if (OUTPUT_DIR_RESOLVED.custom) process.env.SYNAPSE_OUT_DIR = DIST_DIR;
      const ogArgs = [path.join(ROOT, 'scripts', 'generate-og.js')];
      if (SHOW_DRAFTS) ogArgs.push('--drafts');
      const ogRes = spawnSync(process.execPath, ogArgs, { stdio: 'inherit' });
      if (ogRes.status !== 0) {
        console.warn('  [WARN] OG image generation reported errors (see above); continuing build.');
        recordBuildFailure('og', 'generate-og.js exited with status ' + ogRes.status);
      }
    }
    await pingSearchEngines(config);
    generateSearchIndex(config, articles);
    generateSecurityHeaders(config);
    generateRedirects(config, customPages);
    if (generateWorkerSecurity) {
      generateWorkerSecurity(config.security, path.join(ROOT, 'workers', 'security-config.js'), buildCspTrimContext(config));
    }
    if (!BUNDLE_ACTIVE) copyJsAssets();
    copyVendorAssets(config);
    await generatePWA(config);
    await minifyAll(config);
    await cacheBust(config);
    await generatePagefindIndex(config);
    if (hooks && hooks.postBuild) {
      await hooks.postBuild(config, {
        articles: articles.length,
        pages: (customPages || []).length,
        tags: tags.length,
        categories: categories.length,
        outputDir: DIST_DIR
      });
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n========================================`);
    console.log(`  Build complete in ${elapsed}s`);
    console.log(`  Output: ${path.relative(ROOT, DIST_DIR).split(path.sep).join('/') || '.'}/`);
    console.log(`========================================`);
    if (config.site.build.buildReport !== false) {
      console.log('[14/14] Generating build report...');
      generateBuildReport(config, articles, tags, categories, customPages, elapsed, policyResult);
    }
    checkPerfBudget(config);
    if (buildErrors.hasErrors) {
      console.error('\n[FAILURES] ' + buildErrors.entries.length + ' build failure(s) recorded:');
      console.error(formatFailures(buildErrors.entries));
    }
    process.exitCode = resolveExitCode(buildErrors, { allowDegraded: ALLOW_DEGRADED });
    return config;
  } catch (err) {
    console.error(`\n[FATAL] Build failed: ${err.message}`);
    if (!err.isBuildAbort) console.error(err.stack);
    if (WATCH_MODE) throw err;
    process.exit(1);
  }
}

if (WATCH_MODE) {
  console.log('========================================');
  console.log('  S-ynapse Watch Mode');
  console.log('========================================\n');
  if (!chokidar) {
    console.error('[FATAL] chokidar not available for watch mode');
    process.exit(1);
  }
  let building = false;
  let rebuildQueued = false;
  async function rebuild() {
    if (building) { rebuildQueued = true; return; }
    building = true;
    rebuildQueued = false;
    try {
      await build();
    } catch (err) {
      console.error('[WATCH] 构建失败，已保留监听；修改文件后会自动重试。');
    }
    building = false;
    if (rebuildQueued) rebuild();
  }
  const watchPaths = [
    path.join(ROOT, 'articles', '**', '*.md'),
    path.join(ROOT, 'templates', '**', '*.ejs'),
    path.join(ROOT, 'static', '**', '*'),
    path.join(ROOT, 'media', '**', '*'),
    path.join(ROOT, 'videos', '**', '*'),
    path.join(ROOT, 'assets', '**', '*'),
    path.join(ROOT, 'pages', '**', '*.md'),
    path.join(ROOT, '*.json'),
    path.join(ROOT, '*.json5')
  ];
  const watcher = chokidar.watch(watchPaths, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 300 } });
  watcher.on('all', function () {
    console.log('\n[WATCH] Change detected, rebuilding...\n');
    rebuild();
  });
  process.on('SIGINT', () => { watcher.close(); process.exit(0); });
  process.on('SIGTERM', () => { watcher.close(); process.exit(0); });
  build();
} else {
  build().then(function (config) {
    if (SERVE_MODE) startServer(config);
  });
}

// Simple development HTTP server for previewing the built site.
// Serves files from dist/ with basic MIME type detection.
// Supports clean URLs (auto-appends index.html for directories, .html for missing files).
// Falls back to 404.html when no match is found.
function startServer(config) {
  var http = require('http');
  var PORT = parseInt(process.argv[process.argv.indexOf('--port') + 1]) || 3000;
  var MAINTENANCE = process.argv.indexOf('--maintenance') !== -1 || process.env.MAINTENANCE === '1';
  var MAINT_MSG = process.env.MAINTENANCE_MESSAGE || '本站正在维护中，请稍后再来。';
  var maintPage = '<!DOCTYPE html><html lang="' + config.site.language + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>维护中 - ' + MAINT_MSG + '</title><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:' + config.theme.colors.background + ';color:' + config.theme.colors.text + '}p{color:' + config.theme.colors.textSecondary + '}</style></head><body><main><h1>维护中</h1><p>' + MAINT_MSG + '</p></main></body></html>';
  var REDIRECT_LIST = [];
  try {
    var rc = fs.readFileSync(path.join(DIST_DIR, '_redirects'), 'utf-8');
    rc.split('\n').forEach(function(line) {
      if (!line.trim()) return;
      var parts = line.trim().split(/\s+/);
      if (parts.length >= 3) REDIRECT_LIST.push({ from: parts[0], to: parts[1], status: parts[2] === '302' ? 302 : 301 });
    });
  } catch (e) { /* 忽略：serve 模式下 _redirects 不存在时按空规则处理 */ }
  var mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.txt':'text/plain','.mp4':'video/mp4','.webm':'video/webm','.avi':'video/x-msvideo','.mov':'video/quicktime','.mkv':'video/x-matroska','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.flac':'audio/flac','.pdf':'application/pdf','.csv':'text/csv','.zip':'application/zip','.7z':'application/x-7z-compressed','.rar':'application/x-rar-compressed','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.eot':'application/vnd.ms-fontobject' };
  http.createServer(function(req, res) {
    if (MAINTENANCE) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' });
      res.end(maintPage);
      return;
    }
    var rawPath = req.url.split('?')[0];
    var urlPath;
    try {
      urlPath = decodeURIComponent(rawPath);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }
    var redirects = REDIRECT_LIST;
    if (redirects.length) {
      for (var i = 0; i < redirects.length; i++) {
        var rd = redirects[i];
        var wildcardTail = rd.from.charAt(rd.from.length - 1) === '*';
        if (rd.from === urlPath || (wildcardTail && urlPath.startsWith(rd.from.slice(0, -1)))) {
          var to = rd.to;
          if (wildcardTail && to.indexOf('*') !== -1) {
            to = to.split('*').join(urlPath.slice(rd.from.length - 1));
          }
          res.writeHead(rd.status, { Location: to, 'Cache-Control': 'no-store' });
          res.end();
          return;
        }
      }
    }
    var urlNoSlash = urlPath.replace(/\/$/, '');
    var filePath = urlNoSlash ? path.resolve(DIST_DIR, '.' + urlNoSlash) : path.join(DIST_DIR, 'index.html');
    if (!filePath.startsWith(path.resolve(DIST_DIR) + path.sep) && !filePath.startsWith(path.resolve(DIST_DIR) + '/')) {
      filePath = path.join(DIST_DIR, '404.html');
    }
    try { if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html'); } catch(e) { /* 忽略：路径不存在/非目录时按原路径处理 */ }
    var isNotFound = false;
    if (!fs.existsSync(filePath)) {
      var alt = filePath + '.html';
      if (fs.existsSync(alt)) filePath = alt;
      else { filePath = path.join(DIST_DIR, '404.html'); isNotFound = true; }
    }
    fs.stat(filePath, function(serr, st) {
      if (serr || !st.isFile()) { res.writeHead(500); res.end('Server Error'); return; }
      var ext = path.extname(filePath).toLowerCase();
      var etag = '"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + '"';
      var lastMod = st.mtime.toUTCString();
      if (req.headers['if-none-match'] === etag || req.headers['if-modified-since'] === lastMod) {
        res.writeHead(304, { 'ETag': etag, 'Last-Modified': lastMod, 'Cache-Control': 'no-cache' });
        res.end();
        return;
      }
      fs.readFile(filePath, function(err, data) {
        if (err) { res.writeHead(500); res.end('Server Error'); return; }
        res.writeHead(isNotFound ? 404 : 200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'ETag': etag, 'Last-Modified': lastMod, 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    });
  }).listen(PORT, function() {
    console.log('  Server: http://localhost:' + PORT + '/');
    console.log('  (Press Ctrl+C to stop)');
  });
}
