#!/usr/bin/env node
// S-ynapse Static Blog Builder — main build pipeline
// Reads Markdown articles + JSON5 configs + EJS templates → fully static HTML site
// Pipeline order: config → validate → dist → static → media → articles → pages → RSS → sitemap → search → security headers → minify → cache bust → PWA

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createBuildErrorCollector, resolveExitCode, formatFailures, formatWarnings } = require('./lib/build-errors');
const { isScheduled } = require('./lib/publish-window');
const { resolveOgSize, collectCoverSizesFromManifest } = require('./lib/og-size');
const { buildBundles } = require('./lib/bundle');
const { computeRelatedArticles } = require('./lib/related');
const { getAllFiles } = require('./build/fs-utils');
const { createBuildContext } = require('./build/context');
const { computeIncrementalContext } = require('./lib/incremental');
const { debugConfig, configSummary } = require('./lib/feature-wiring');
const { loadInternals } = require('./lib/internals');

// 编排器活值（build() 函数体直接读写；经 getter/setter 注入构建上下文，保持活值语义）：
//   BUILD_ERRORS   构建错误收集器（build() 赋值；helpers 记录构建失败时读取）
//   MEDIA_MANIFEST 媒体 manifest（build() 赋值；pages 生成卡片 srcset 时读取）
//   AUTO_COVERS    自动封面映射（build() 赋值；pages 为无 featuredImage 文章回退封面时读取）
//   inlineConfigKb 内联配置体积（KB；pages 写入，report 性能预算读取）
//   INCREMENTAL_CTX 增量构建上下文（build() 赋值；pages 读取以决定页面复用）
//   BUNDLE_FILES   本轮 esbuild 产物文件名（build() 赋值；压缩阶段 C4 混淆目标白名单）
let BUILD_ERRORS = null;
let MEDIA_MANIFEST = null;
let AUTO_COVERS = null;
let inlineConfigKb = 0;
let INCREMENTAL_CTX = null;
let BUNDLE_FILES = [];

// 构建上下文（scripts/build/context.js）：可选依赖加载、路径/标志计算与全部模块接线在工厂内完成，
// 本文件只保留编排逻辑（validateJsonSyntax + build() + watch/serve 入口）。
// 站点根目录：SYNAPSE_ROOT（测试隔离用）优先，默认仓库根；PROJECT_DIR 始终指向本仓库，
// 供需要定位构建器自身脚本（如 generate-og.js）的路径使用，避免站点根被覆盖后找不到脚本。
const PROJECT_DIR = path.resolve(__dirname, '..');
const ROOT = process.env.SYNAPSE_ROOT ? path.resolve(process.env.SYNAPSE_ROOT) : PROJECT_DIR;
const ctx = createBuildContext({
  rootDir: ROOT,
  argv: process.argv,
  getBuildErrors: () => BUILD_ERRORS,
  getMediaManifest: () => MEDIA_MANIFEST,
  getAutoCovers: () => AUTO_COVERS,
  getInlineConfigKb: () => inlineConfigKb,
  setInlineConfigKb: (kb) => { inlineConfigKb = kb; },
  getIncrementalContext: () => INCREMENTAL_CTX,
  getBundleFiles: () => BUNDLE_FILES
});

const {
  cspNonce: CSP_NONCE_VALUE, json5, chokidar, hooks, generateWorkerSecurity,
  distDir: DIST_DIR, watchMode: WATCH_MODE, serveMode: SERVE_MODE,
  showDrafts: SHOW_DRAFTS, allowDegraded: ALLOW_DEGRADED, bundleActive: BUNDLE_ACTIVE,
  outputDirResolved: OUTPUT_DIR_RESOLVED, pkgVersion: PKG_VERSION,
  abortBuild, loadConfig, validateConfig, applyCspNonce,
  resolveCompressionState,
  getPublished, resolveDailyQuotes, recordBuildFailure,
  setupDist, copyStatic, copyProtectedAssets, optimizeMedia,
  generateAutoCovers,
  processPagesContent, preflightContent, processArticles,
  renderArticlesMermaid,
  collectTags, collectCategories,
  buildSiteCss, writeRuntimeConfig, buildPageData, processCustomPages, generatePages,
  buildCjkFonts,
  generateRSS, generateJSONFeed, generateSitemap, pingSearchEngines, prepareSearchIndex, generateSearchIndex, generatePagefindIndex,
  checkPerfBudget, checkPerformanceWarnings, generateBuildReport, writeBuildReportText, generateRedirects, buildCspTrimContext, generateSecurityHeaders,
  minifyAll, cacheBust, copyJsAssets, copyRuntimeBootstrap, copyVendorAssets, generatePWA, generateServiceWorker,
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
  const phaseTimings = {};
  const markPhase = function (key, startedAt) { phaseTimings[key] = Date.now() - startedAt; };
  // 同阶段多段耗时累加（如 PWA 初版 + SW 定稿分居压缩前后）。
  const addPhase = function (key, startedAt) { phaseTimings[key] = (phaseTimings[key] || 0) + (Date.now() - startedAt); };
  const buildErrors = createBuildErrorCollector();
  BUILD_ERRORS = buildErrors;
  if (!validateJsonSyntax()) {
    abortBuild('\n[FATAL] Build aborted due to configuration errors.\n');
  }
  try {
    // 压缩配置惰性加载在此显式触发：--compression-override 文件缺失/解析错误经
    // config.abortBuild 抛出（watch 下由 rebuild 捕获）或退出（普通构建），
    // 不再发生在 createBuildContext（模块加载）阶段导致 watch 直接崩溃。
    resolveCompressionState();
    const config = loadConfig();
    if (!validateConfig(config)) {
      abortBuild('\n[FATAL] Build aborted due to configuration errors.\n');
    }
    // 开发助手（features.debug）：默认全部关闭，不影响正常输出。
    const debugCfg = debugConfig(config.features);
    const debugMark = function (label) {
      if (debugCfg.verbose) console.log('  [DEBUG] ' + label + '（+' + (Date.now() - startTime) + 'ms）');
    };
    if (debugCfg.dumpConfig) {
      console.log('\n[DEBUG] 配置摘要（解析合并后；敏感值仅显示是否已设置）:');
      for (const line of configSummary(config)) console.log('  ' + line);
      console.log('');
    }
    debugMark('配置加载与校验完成');
    // 增量构建上下文（features.incrementalBuild）：watch（incrementalBuild.watch）或显式 --incremental 时
    // 启用页面级复用；复用依赖既有 dist 产物，故在内存中暂时关闭 cleanDist（不写回配置文件）。
    INCREMENTAL_CTX = computeIncrementalContext(config.features, { argv: process.argv, watchMode: WATCH_MODE });
    if (INCREMENTAL_CTX.active) {
      if (config.site.build.cleanDist) {
        config.site.build.cleanDist = false;
        console.log('  [incremental] 已启用页面级复用（跳过 dist 清理；强制全量请用 ' + INCREMENTAL_CTX.fullFlag + ' 或 --full）');
      } else {
        console.log('  [incremental] 已启用页面级复用（指纹算法 ' + INCREMENTAL_CTX.fingerprintHash + '）');
      }
    } else if (INCREMENTAL_CTX.forceFull) {
      console.log('  [incremental] 强制全量构建（' + (process.argv.includes(INCREMENTAL_CTX.fullFlag) ? INCREMENTAL_CTX.fullFlag : '--full') + '）');
    }
    // CSP nonce 注入（远早于 _headers / Worker 生成，同时覆盖 meta CSP 与页面 HTML）
    applyCspNonce(config);
    markPhase('config', startTime);
    if (hooks && hooks.preBuild) await hooks.preBuild(config);
    const preflightStartedAt = Date.now();
    const preflight = preflightContent();
    markPhase('preflight', preflightStartedAt);
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
    const mediaStartedAt = Date.now();
    const mediaManifest = await optimizeMedia(config);
    markPhase('media', mediaStartedAt);
    MEDIA_MANIFEST = mediaManifest;
    const articles = await processArticles(config, mediaManifest, buildErrors);
    // 无封面文章自动封面（features.listCover.autoGenerate）：须在页面生成前完成，
    // 供 pages 为卡片/文章页头图回退；失败仅告警（模块内不 recordBuildFailure），不阻断构建。
    AUTO_COVERS = await generateAutoCovers(config, articles);
    await renderArticlesMermaid(config, articles);
    if (articles.length === 0) console.log('  [WARN] No articles found');
    const scheduledCount = articles.filter(function(a) { return !a.draft && isScheduled(a, new Date()); }).length;
    if (scheduledCount > 0) console.warn('  [INFO] ' + scheduledCount + ' future-dated article(s) scheduled; excluded until their publish date.');
    const tags = collectTags(articles);
    const categories = collectCategories(articles);
    debugMark('文章解析与媒体优化完成');
    if (config.site.build.relatedArticles !== false) computeRelatedArticles(getPublished(articles), (config.features && config.features.related) || {});
    const pagesContent = processPagesContent();
    if (config.theme.articleFooter && config.theme.articleFooter.enabled && config.theme.articleFooter.source) {
      if (!pagesContent || !pagesContent[config.theme.articleFooter.source]) {
        console.warn(`  [WARN] articleFooter.source "${config.theme.articleFooter.source}" not found in pages/ directory`);
      }
    }
    const dailyQuotes = resolveDailyQuotes(config);
    const baseData = buildPageData(config, articles, tags, categories, dailyQuotes);
    // OG meta 尺寸：与 scripts/generate-og.js 共用 lib/og-size.js 解析（显式配置 > 封面统计 > 默认），
    // 注入模板使 og:image:width/height 与实际产图一致（此前模板硬编码 1200x630）。
    const ogCfg = (config.features && config.features.ogImage) || {};
    const ogAuto = ogCfg.autoSize || {};
    baseData.ogImageSize = resolveOgSize({
      explicitWidth: ogCfg.width,
      explicitHeight: ogCfg.height,
      covers: collectCoverSizesFromManifest(getPublished(articles), mediaManifest),
      maxDimension: ogAuto.maxDimension,
      autoSize: ogAuto.enabled !== false
    });
    if (pagesContent) {
      // pagesContent 仅被 templates/post.ejs 的文章页脚按 articleFooter.source 取用；
      // 投影为单键可避免「无关自定义页改动」使全部页面数据指纹失效（增量构建按页复用）。
      const footerSource = config.theme.articleFooter && config.theme.articleFooter.source;
      baseData.pagesContent = (footerSource && pagesContent[footerSource])
        ? { [footerSource]: pagesContent[footerSource] }
        : {};
    }
    baseData.siteCssHref = buildSiteCss(config, baseData);
    const runtimeConfig = writeRuntimeConfig(config, baseData.presets, dailyQuotes);
    baseData.runtimeConfigUrl = runtimeConfig.url;
    baseData.criticalConfig = runtimeConfig.critical;
    if (BUNDLE_ACTIVE) {
      const bundle = await buildBundles({ root: ROOT, outDir: DIST_DIR, minify: config.site.build.minifyJS !== false });
      BUNDLE_FILES = bundle.files;
      SITE_APP_JS_HREF = bundle.appJsHref;
      SITE_DEFERRED_URL = bundle.deferredUrl;
      SITE_RUNTIME_JS_HREF = copyRuntimeBootstrap() || SITE_RUNTIME_JS_HREF;
      console.log('  Bundled: ' + bundle.files.join(', '));
    }
    baseData.appJsHref = SITE_APP_JS_HREF;
    baseData.deferredUrl = SITE_DEFERRED_URL;
    baseData.runtimeJsHref = SITE_RUNTIME_JS_HREF;
    // 搜索索引须先于页面渲染准备：内容寻址 URL 注入 window.__SEARCH_INDEX_URL__（模板按语言取用）；
    // 实际文件在 [9/14] 阶段写盘，预计算保证了 URL 与最终内容哈希一致。
    try {
      baseData.searchIndexUrls = await prepareSearchIndex(config, articles);
    } catch (err) {
      console.warn('  [WARN] Search index preparation failed: ' + err.message);
      recordBuildFailure('search', 'Search index preparation failed: ' + err.message);
      baseData.searchIndexUrls = {};
    }
    const customPages = processCustomPages(config, baseData);
    const pagesStartedAt = Date.now();
    await generatePages(config, articles, baseData, customPages);
    markPhase('pages', pagesStartedAt);
    const generatedHtmlCount = getAllFiles(DIST_DIR).filter((f) => f.endsWith('.html')).length;
    if (generatedHtmlCount === 0) {
      throw new Error('页面生成结果为空：dist/ 下没有产出任何 HTML（模板渲染可能整体失败，请检查 templates/*.ejs 的语法与变量）');
    }
    debugMark('页面生成完成（' + generatedHtmlCount + ' 个 HTML）');
    // 根 404：以中文 404 为基底；若存在英文 404 页，则注入语言自适应跳转（en 访客 → /en/404.html）。
    // 该脚本不经过 renderPage 的 nonce 注入链，必须在此显式使用同一枚构建期 nonce，否则会被 CSP 拦截。
    const zh404 = path.join(DIST_DIR, 'zh', '404.html');
    if (fs.existsSync(zh404)) {
      const en404 = path.join(DIST_DIR, 'en', '404.html');
      let root404Html = fs.readFileSync(zh404, 'utf-8');
      if (fs.existsSync(en404)) {
        const redirect404 = '<script nonce="' + CSP_NONCE_VALUE + '">/*S-LANG-REDIRECT-404*/(function(){try{if(navigator.language&&/^en([-]|$)/i.test(navigator.language)&&!localStorage.getItem("s-ss-lang")){location.replace("/en/404.html");return}}catch(e){}})();</script>';
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
      const ogArgs = [path.join(PROJECT_DIR, 'scripts', 'generate-og.js')];
      if (SHOW_DRAFTS) ogArgs.push('--drafts');
      const ogStartedAt = Date.now();
      const ogRes = spawnSync(process.execPath, ogArgs, { stdio: 'inherit' });
      markPhase('og', ogStartedAt);
      if (ogRes.status !== 0) {
        console.warn('  [WARN] OG image generation reported errors (see above); continuing build.');
        recordBuildFailure('og', 'generate-og.js exited with status ' + ogRes.status);
      }
    }
    await pingSearchEngines(config);
    await generateSearchIndex(config, articles);
    generateSecurityHeaders(config);
    generateRedirects(config, customPages);
    if (generateWorkerSecurity && !OUTPUT_DIR_RESOLVED.custom) {
      generateWorkerSecurity(config.security, path.join(PROJECT_DIR, 'workers', 'security-config.js'), buildCspTrimContext(config), config.features);
    } else if (generateWorkerSecurity) {
      console.log('  [INFO] 自定义输出目录构建：跳过 workers/security-config.js 写入（避免污染部署配置的 CSP nonce）');
    }
    if (!BUNDLE_ACTIVE) copyJsAssets();
    copyVendorAssets(config);
    const pwaStartedAt = Date.now();
    await generatePWA(config);
    markPhase('pwa', pwaStartedAt);
    const compressionStartedAt = Date.now();
    const compressionStats = await minifyAll(config);
    markPhase('compression', compressionStartedAt);
    const cacheBustStartedAt = Date.now();
    await cacheBust(config);
    markPhase('cacheBust', cacheBustStartedAt);
    // SW 定稿在压缩与缓存指纹之后：壳预缓存清单必须引用最终文件名
    // （压缩阶段会按最终字节重命名 runtime 引导脚本）；sw.js 自身由压缩/cacheBust 显式跳过。
    const swFinalizeStartedAt = Date.now();
    await generateServiceWorker(config);
    addPhase('pwa', swFinalizeStartedAt);
    await generatePagefindIndex(config);
    debugMark('压缩与缓存指纹完成（构建产物就绪）');
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
    // internals.report.maxBuildMsWarn>0 时对超阈值构建仅告警（不改变退出码）。
    const maxBuildMsWarn = loadInternals().report.maxBuildMsWarn;
    if (maxBuildMsWarn > 0 && Date.now() - startTime > maxBuildMsWarn) {
      console.warn('[WARN] 构建耗时 ' + elapsed + 's 超过 internals.report.maxBuildMsWarn（' + maxBuildMsWarn + 'ms）');
    }
    console.log(`\n========================================`);
    console.log(`  Build complete in ${elapsed}s`);
    console.log(`  Output: ${path.relative(ROOT, DIST_DIR).split(path.sep).join('/') || '.'}/`);
    console.log(`========================================`);
    const reportStartedAt = Date.now();
    if (config.site.build.buildReport !== false) {
      console.log('[14/14] Generating build report...');
      generateBuildReport(config, articles, tags, categories, customPages, elapsed, policyResult);
    }
    const perfBudgetReport = checkPerfBudget(config);
    checkPerformanceWarnings(config, (Date.now() - startTime) / 1000);
    // dist/report.txt 构建摘要：阶段耗时、压缩前后对照、验证摘要、告警与预算结论；
    // 位于压缩/cacheBust 之后，天然豁免（exclude 已含 report.txt）。
    if (config.site.build.buildReport !== false) {
      markPhase('report', reportStartedAt);
      const totalMs = Date.now() - startTime;
      const measuredMs = ['config', 'preflight', 'pages', 'media', 'og', 'compression', 'cacheBust', 'pwa', 'report']
        .reduce(function (sum, key) { return sum + (phaseTimings[key] || 0); }, 0);
      const budget = perfBudgetReport
        ? Object.assign({ warnOnly: ((config.features && config.features.perfBudget) || {}).warnOnly !== false }, perfBudgetReport)
        : null;
      try {
        writeBuildReportText({
          generatedAt: new Date().toISOString(),
          totalMs: totalMs,
          phases: [
            { key: 'config', ms: phaseTimings.config },
            { key: 'preflight', ms: phaseTimings.preflight },
            { key: 'pages', ms: phaseTimings.pages },
            { key: 'media', ms: phaseTimings.media },
            { key: 'og', ms: phaseTimings.og },
            { key: 'compression', ms: phaseTimings.compression },
            { key: 'cacheBust', ms: phaseTimings.cacheBust },
            { key: 'pwa', ms: phaseTimings.pwa },
            { key: 'report', ms: phaseTimings.report },
            { key: 'other', ms: Math.max(0, totalMs - measuredMs) }
          ],
          compression: compressionStats,
          verifyRan: !!(compressionStats && compressionStats.verificationRan),
          warnings: buildErrors.warningEntries,
          failures: buildErrors.fatalEntries,
          budget: budget
        });
      } catch (err) {
        console.error('  [ERROR] 构建摘要 report.txt 写入失败: ' + err.message);
        buildErrors.add('report', 'report.txt: ' + err.message);
      }
    }
    // features.debug.listPages：构建末输出渲染页面清单（相对产物根路径，按字典序）。
    if (debugCfg.listPages) {
      const pageList = getAllFiles(DIST_DIR)
        .filter((f) => f.endsWith('.html'))
        .map((f) => path.relative(DIST_DIR, f).split(path.sep).join('/'))
        .sort();
      console.log('\n[DEBUG] 页面清单（' + pageList.length + '）:');
      for (const p of pageList) console.log('  - ' + p);
    }
    if (buildErrors.hasErrors) {
      console.error('\n[FAILURES] ' + buildErrors.fatalEntries.length + ' build failure(s) recorded:');
      console.error(formatFailures(buildErrors.fatalEntries));
    }
    if (buildErrors.hasWarnings) {
      console.warn('\n[WARNINGS] ' + buildErrors.warningEntries.length + ' non-blocking issue(s) recorded:');
      console.warn(formatWarnings(buildErrors.warningEntries));
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
  // 初始构建失败（如配置错误 / --compression-override 缺失）不得终止 watch：
  // build() 在 watch 下以 throw 上报失败，这里与 rebuild 循环同语义地捕获并保留监听。
  build().catch(function () {
    console.error('[WATCH] 初始构建失败，已保留监听；修改文件后会自动重试。');
  });
} else {
  build().then(function (config) {
    if (SERVE_MODE) startServer(config);
  });
}
