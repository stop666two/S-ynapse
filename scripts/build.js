#!/usr/bin/env node
// S-ynapse Static Blog Builder — main build pipeline
// Reads Markdown articles + JSON5 configs + EJS templates → fully static HTML site
// Pipeline order: config → validate → dist → static → media → articles → pages → RSS → sitemap → search → security headers → minify → cache bust → PWA

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createBuildErrorCollector, resolveExitCode, formatFailures } = require('./lib/build-errors');
const { isScheduled } = require('./lib/publish-window');
const { buildBundles } = require('./lib/bundle');
const { computeRelatedArticles } = require('./lib/related');
const { getAllFiles } = require('./build/fs-utils');
const { createBuildContext } = require('./build/context');

// 编排器活值（build() 函数体直接读写；经 getter/setter 注入构建上下文，保持活值语义）：
//   BUILD_ERRORS   构建错误收集器（build() 赋值；helpers 记录构建失败时读取）
//   MEDIA_MANIFEST 媒体 manifest（build() 赋值；pages 生成卡片 srcset 时读取）
//   inlineConfigKb 内联配置体积（KB；pages 写入，report 性能预算读取）
let BUILD_ERRORS = null;
let MEDIA_MANIFEST = null;
let inlineConfigKb = 0;

// 构建上下文（scripts/build/context.js）：可选依赖加载、路径/标志计算与全部模块接线在工厂内完成，
// 本文件只保留编排逻辑（validateJsonSyntax + build() + watch/serve 入口）。
const ctx = createBuildContext({
  rootDir: path.resolve(__dirname, '..'),
  argv: process.argv,
  getBuildErrors: () => BUILD_ERRORS,
  getMediaManifest: () => MEDIA_MANIFEST,
  getInlineConfigKb: () => inlineConfigKb,
  setInlineConfigKb: (kb) => { inlineConfigKb = kb; }
});

const {
  json5, chokidar, hooks, generateWorkerSecurity,
  rootDir: ROOT, distDir: DIST_DIR, watchMode: WATCH_MODE, serveMode: SERVE_MODE,
  showDrafts: SHOW_DRAFTS, allowDegraded: ALLOW_DEGRADED, bundleActive: BUNDLE_ACTIVE,
  outputDirResolved: OUTPUT_DIR_RESOLVED, pkgVersion: PKG_VERSION,
  abortBuild, loadConfig, validateConfig, applyCspNonce,
  getPublished, resolveDailyQuotes, recordBuildFailure,
  setupDist, copyStatic, copyProtectedAssets, optimizeMedia,
  processPagesContent, preflightContent, processArticles,
  renderArticlesMermaid,
  collectTags, collectCategories,
  buildSiteCss, writeRuntimeConfig, buildPageData, processCustomPages, generatePages,
  buildCjkFonts,
  generateRSS, generateJSONFeed, generateSitemap, pingSearchEngines, generateSearchIndex, generatePagefindIndex,
  checkPerfBudget, generateBuildReport, generateRedirects, buildCspTrimContext, generateSecurityHeaders,
  minifyAll, cacheBust, copyJsAssets, copyRuntimeBootstrap, copyVendorAssets, generatePWA,
  startServer
} = ctx;

let SITE_APP_JS_HREF = '/assets/js/core/main.js';
let SITE_DEFERRED_URL = '';
let SITE_RUNTIME_JS_HREF = '/assets/js/core/runtime.js';

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
    await renderArticlesMermaid(config, articles);
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
    // 根 404：以中文 404 为基底；若存在英文 404 页，则注入语言自适应跳转（en 访客 → /en/404.html）。
    // 内联脚本不带 nonce，构建尾段的 applyCspNonce 会统一补齐（与页面内联脚本同机制）。
    const zh404 = path.join(DIST_DIR, 'zh', '404.html');
    if (fs.existsSync(zh404)) {
      const en404 = path.join(DIST_DIR, 'en', '404.html');
      let root404Html = fs.readFileSync(zh404, 'utf-8');
      if (fs.existsSync(en404)) {
        const redirect404 = '<script>/*S-LANG-REDIRECT-404*/(function(){try{if(navigator.language&&/^en([-]|$)/i.test(navigator.language)&&!localStorage.getItem("s-ss-lang")){location.replace("/en/404.html");return}}catch(e){}})();</script>';
        const withScript = root404Html.replace('</head>', redirect404 + '</head>');
        root404Html = withScript !== root404Html ? withScript : root404Html + redirect404;
      }
      fs.writeFileSync(path.join(DIST_DIR, '404.html'), root404Html);
    }
    // CJK 子集化（须在 minify/cacheBust 前）：扫描页面与配置 JSON 实际用字 → 写字体分片与 @font-face；
    // 失败仅告警降级（剥离样式引用），不阻断构建。
    await buildCjkFonts(config);
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
