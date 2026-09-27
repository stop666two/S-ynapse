'use strict';
// 构建上下文工厂（scripts/build/context.js）。
// 把 scripts/build.js 的可选依赖加载、路径/标志计算与全部模块接线收敛到 createBuildContext(deps)：
//   - 编排器只传最小外部依赖（rootDir、argv）与三个活值访问器（构建错误收集器、媒体 manifest、内联配置体积）；
//   - 原 build.js 中 let 活值的读写经由 deps 的 getter/setter 透传，保持活值语义；
//   - 模块创建顺序按依赖拓扑排列，前向引用（CSP 裁剪上下文、字体清单）经由闭包延迟解析。
// 行为与拆分前一致（以 scripts/dist-hash-guard.js diff 产物等价门禁验证）。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildSitemapUrls } = require('../lib/robots');
const { bundleEnabled, esbuildAvailable } = require('../lib/bundle');
const { createMinifyModule } = require('./minify');
const {
  DEFAULT_COMPRESSION,
  compressionActive,
  loadCompressionConfig,
  mergeCompressionOverride
} = require('../lib/compression-config');
const { createMediaModule } = require('./media');
const { createAutoCoverModule } = require('./auto-cover');
const { createFeedsModule } = require('./feeds');
const { createReportModule } = require('./report');
const { createRenderModule } = require('./render');
const { getAllFiles } = require('./fs-utils');
const { createAssetsModule } = require('./assets');
const { createCjkFontsModule } = require('./cjk-fonts');
const { createSecurityFilesModule } = require('./security-files');
const { createConfigModule } = require('./config');
const { createMarkdownModule } = require('./markdown');
const { createArticlesModule } = require('./articles');
const { createMermaidModule } = require('./mermaid');
const { createCollectorsModule } = require('./collectors');
const { createHelpersModule } = require('./helpers');
const { createPagesModule } = require('./pages');
const { createServeModule } = require('./serve');
const { createCacheModule } = require('./cache');

// Optional dependency loading — each fails gracefully to null/fallback
// This allows the build to run with missing packages (features degrade instead of crashing)
let json5, deepmerge, Feed, sharp, minifyHtmlNode, CleanCSS, terser, chokidar;
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
  const secConfig = require('../generate-security-config');
  generateWorkerSecurity = secConfig.generateSecurityConfig;
  applyHeaderHardening = secConfig.applyHeaderHardening;
} catch (e) { generateWorkerSecurity = null; }

// Optional local hooks script (scripts/hooks.js) — allows external plugins to hook into build lifecycle
// Hook functions: preBuild(config), transformMarkdown(content, attrs), transformHTML(html, data), postBuild(config, stats)
let hooks;
try { hooks = require('../hooks'); } catch (e) { hooks = null; }

// 构建期 CSP nonce（每次构建进程生成一次）：同一值写入最终 HTML 的 <script nonce="...">
// 与 CSP 的 script-src 'nonce-...'（_headers / Worker / meta 三处同源），两者必须同步，
// 否则内联脚本会被浏览器按 CSP 拦截。
const CSP_NONCE = crypto.randomBytes(16).toString('base64');

// Build output directory: `--out <dir>` > SYNAPSE_OUT_DIR > default dist/.
// Relative values resolve against rootDir. 集成测试/预览构建可用 --out 写入临时目录；
// 媒体与 OG 缓存（.build-cache.json / .cache/*）始终留在根目录，不随输出目录迁移。
function resolveOutputDir(argv, rootDir) {
  const idx = argv.indexOf('--out');
  let value = (idx !== -1 && argv[idx + 1] && argv[idx + 1].charAt(0) !== '-') ? argv[idx + 1] : '';
  if (!value && process.env.SYNAPSE_OUT_DIR) value = process.env.SYNAPSE_OUT_DIR;
  if (!value) return { dir: path.join(rootDir, 'dist'), custom: false };
  return { dir: path.isAbsolute(value) ? path.resolve(value) : path.resolve(rootDir, value), custom: true };
}

function createBuildContext(deps) {
  const rootDir = deps.rootDir;
  const argv = deps.argv || process.argv;

  // Project directory structure — all paths relative to project root
  const ARTICLES_DIR = path.join(rootDir, 'articles');          // Markdown article source files
  const STATIC_DIR = path.join(rootDir, 'static');               // Unprocessed static assets (copied verbatim)
  const MEDIA_DIR = path.join(rootDir, 'media');                 // Source images (processed by sharp)
  const VIDEOS_DIR = path.join(rootDir, 'videos');               // Source videos (copied with policy filter)
  const ASSETS_DIR = path.join(rootDir, 'assets');               // Source downloadable files (copied with policy filter)
  const TEMPLATES_DIR = path.join(rootDir, 'templates');         // EJS template files
  const PAGES_DIR = path.join(rootDir, 'pages');                 // Standalone page Markdown files (about, privacy, etc.)

  const OUTPUT_DIR_RESOLVED = resolveOutputDir(argv, rootDir);
  const DIST_DIR = OUTPUT_DIR_RESOLVED.dir;                   // Build output directory

  // features 覆盖文件（`--features-override <file>`）：仅用于隔离验证/预览构建的
  // features 深合并覆盖（例如 runner 生成第二态构建而不改动仓库 features.json5）。
  // 相对路径按 rootDir 解析；文件内仍受 validateFeatures 校验（未知键报错）。
  const FEATURES_OVERRIDE_PATH = (() => {
    const idx = argv.indexOf('--features-override');
    const value = (idx !== -1 && argv[idx + 1] && argv[idx + 1].charAt(0) !== '-') ? argv[idx + 1] : '';
    if (!value) return '';
    return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
  })();

  // theme 覆盖文件（`--theme-override <file>`）：仅用于隔离验证/预览构建的
  // theme 深合并覆盖（例如 runner 生成第二态主题构建而不改动仓库 theme.json5）。
  // 相对路径按 rootDir 解析；合并结果仍经 validateConfig 校验（preset/枚举等）。
  const THEME_OVERRIDE_PATH = (() => {
    const idx = argv.indexOf('--theme-override');
    const value = (idx !== -1 && argv[idx + 1] && argv[idx + 1].charAt(0) !== '-') ? argv[idx + 1] : '';
    if (!value) return '';
    return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
  })();

  // compression 覆盖文件（`--compression-override <file>`）：仅用于隔离验证/预览构建的
  // compression 深合并覆盖（例如第二态构建关闭压缩），不写回仓库 compression.json5；
  // 合并结果仍经 validateCompression 校验（类型/枚举/exclude 结构）。
  const COMPRESSION_OVERRIDE_PATH = (() => {
    const idx = argv.indexOf('--compression-override');
    const value = (idx !== -1 && argv[idx + 1] && argv[idx + 1].charAt(0) !== '-') ? argv[idx + 1] : '';
    if (!value) return '';
    return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
  })();

  // CLI flags parsed from argv
  const WATCH_MODE = argv.includes('--watch');        // Rebuild on file changes
  const SERVE_MODE = argv.includes('--serve');        // Start dev HTTP server after build
  const SHOW_DRAFTS = argv.includes('--drafts') || WATCH_MODE;  // Include draft articles
  const ALLOW_DEGRADED = argv.includes('--allow-degraded');    // Local preview: continue past content failures (exit code stays 0)
  const BUNDLE_ACTIVE = bundleEnabled(argv, esbuildAvailable());   // esbuild 两段 chunk；--no-bundle 回退原生 ESM

  const CACHE_BUST_MANIFEST_PATH = path.join(DIST_DIR, 'cache-bust-manifest.json');
  const BUILD_CACHE_PATH = path.join(rootDir, '.build-cache.json');
  const MEDIA_CACHE_DIR = path.join(rootDir, '.cache', 'media');

  const PKG_VERSION = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')).version || '0.0.0';
    } catch (err) {
      return '0.0.0';
    }
  })();

  // 构建缓存模块（scripts/build/cache.js）：注入缓存文件路径；函数体原样搬移（以 dist 哈希等价门禁验证）。
  const cache = createCacheModule({
    buildCachePath: BUILD_CACHE_PATH
  });

  // 辅助函数模块（scripts/build/helpers.js）：注入项目根、favicon 静态目录、草稿开关、监视模式、
  // JSON5 实现与构建错误收集器读取器（活值 getter）。
  const helpers = createHelpersModule({
    rootDir,
    staticDir: STATIC_DIR,
    watchMode: WATCH_MODE,
    showDrafts: SHOW_DRAFTS,
    getJson5: () => json5,
    getBuildErrors: deps.getBuildErrors
  });

  // 安全文件模块（scripts/build/security-files.js）：注入路径、nonce 与共享依赖。
  // 先于 config 创建，供其延迟解析 buildCspTrimContext（前向引用经由闭包）。
  const securityFiles = createSecurityFilesModule({
    distDir: DIST_DIR,
    cspNonce: CSP_NONCE,
    bundleActive: BUNDLE_ACTIVE,
    applyHeaderHardening: (sec) => applyHeaderHardening(sec),
    buildSitemapUrls,
    recordBuildFailure: helpers.recordBuildFailure
  });

  // 静态资产与 PWA 模块（scripts/build/assets.js）：注入根路径与产物目录。
  // 先于 config 创建，供其 getVendorFonts 读取 VENDOR_FONTS。
  const assets = createAssetsModule({
    root: rootDir,
    distDir: DIST_DIR,
    staticDir: STATIC_DIR,
    cspNonce: CSP_NONCE
  });

  // 配置族模块（scripts/build/config.js）：注入项目根目录、监视模式、JSON5/深合并实现（活值 getter）
  // 与后置模块提供的 CSP 裁剪上下文、字体清单；机械拆分 —— 函数体原样搬移（以 dist 哈希等价门禁验证）。
  const config = createConfigModule({
    rootDir,
    watchMode: WATCH_MODE,
    featuresOverridePath: FEATURES_OVERRIDE_PATH,
    themeOverridePath: THEME_OVERRIDE_PATH,
    getJson5: () => json5,
    getDeepmerge: () => deepmerge,
    getVendorFonts: () => assets.VENDOR_FONTS,
    buildCspTrimContext: (cfg) => securityFiles.buildCspTrimContext(cfg)
  });

  // 压缩配置（第 14 个配置文件 compression.json5）：独立顶层模块，不进入主配置族。
  // 加载/覆盖校验失败 → 记录构建失败 + 告警 + 降级为内置默认值（不中止构建流程）；
  // serve / watch 下 active=false（增强步骤整体跳过，基线压缩行为不变）。
  // 惰性加载：--compression-override 文件缺失/解析错误经 config.abortBuild 抛出或退出，
  // 必须发生在 build() 的 try 内（watch 模式才能被 rebuild 循环捕获；此前在上下文创建阶段
  // 加载会让 watch 在模块加载时直接崩溃）。
  let compressionState = null;
  function resolveCompressionState() {
    if (compressionState) return compressionState;
    const loaded = loadCompressionConfig(rootDir);
    const errors = loaded.errors.slice();
    const warnings = loaded.warnings.slice();
    let effective = loaded.config;
    if (COMPRESSION_OVERRIDE_PATH) {
      if (!fs.existsSync(COMPRESSION_OVERRIDE_PATH)) {
        config.abortBuild('\n[FATAL] --compression-override file not found: ' + COMPRESSION_OVERRIDE_PATH + '\n');
      }
      let overrideRaw = fs.readFileSync(COMPRESSION_OVERRIDE_PATH, 'utf-8');
      if (overrideRaw.charCodeAt(0) === 0xFEFF) overrideRaw = overrideRaw.slice(1);
      let overrideObj;
      try {
        overrideObj = json5.parse(overrideRaw.replace(/\r\n/g, '\n'));
      } catch (err) {
        config.abortBuild('\n[FATAL] --compression-override parse error in ' + COMPRESSION_OVERRIDE_PATH + ': ' + err.message + '\n');
      }
      const merged = mergeCompressionOverride(effective, overrideObj);
      effective = merged.config;
      errors.push(...merged.errors);
      warnings.push(...merged.warnings);
    }
    if (errors.length > 0) {
      effective = JSON.parse(JSON.stringify(DEFAULT_COMPRESSION));
      warnings.push('compression 配置存在 ' + errors.length + ' 项错误，已降级为内置默认值（构建继续，详见构建失败记录）');
    }
    compressionState = {
      config: effective,
      errors,
      warnings,
      active: compressionActive(effective, { serve: SERVE_MODE, watch: WATCH_MODE }),
      override: COMPRESSION_OVERRIDE_PATH
        ? path.relative(rootDir, COMPRESSION_OVERRIDE_PATH).split(path.sep).join('/')
        : ''
    };
    return compressionState;
  }

  // 媒体与静态资产模块（scripts/build/media.js）：路径、缓存加载器与错误收集器通过 ctx 注入。
  // 机械拆分 2/N —— 函数体原样搬移；getAllFiles 移至 scripts/build/fs-utils.js 供跨模块复用。
  const media = createMediaModule({
    distDir: DIST_DIR,
    staticDir: STATIC_DIR,
    mediaDir: MEDIA_DIR,
    videosDir: VIDEOS_DIR,
    assetsDir: ASSETS_DIR,
    mediaCacheDir: MEDIA_CACHE_DIR,
    sharp,
    loadBuildCache: cache.loadBuildCache,
    saveBuildCache: cache.saveBuildCache,
    recordBuildFailure: helpers.recordBuildFailure
  });

  // CJK 字体子集化模块（scripts/build/cjk-fonts.js）：页面生成后扫描 dist 页面与配置 JSON 实际用字，
  // 下载/复用 Noto Sans SC woff2 分片（缓存于 .cache/fonts，不入库），写本地子集与 cjk-fonts.css；
  // 断网/超时/解析失败自动降级（仅告警，构建继续）。
  const cjkFonts = createCjkFontsModule({
    distDir: DIST_DIR,
    cacheDir: path.join(rootDir, '.cache', 'fonts'),
    logger: console
  });

  // Markdown 渲染模块（scripts/build/markdown.js）：marked 单例与 lib/utils 直连 require，无注入项。
  // 机械拆分 —— 函数体原样搬移（以 dist 哈希等价门禁验证）。
  const markdown = createMarkdownModule();

  // 文章内容管线模块（scripts/build/articles.js）：注入文章/页面/媒体目录、标记渲染器、hooks
  // 与构建失败记录器；函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
  const articles = createArticlesModule({
    rootDir,
    articlesDir: ARTICLES_DIR,
    pagesDir: PAGES_DIR,
    mediaDir: MEDIA_DIR,
    setupMarkedRenderer: markdown.setupMarkedRenderer,
    getHooks: () => hooks,
    recordBuildFailure: helpers.recordBuildFailure
  });

  // Mermaid 构建期渲染模块（scripts/build/mermaid.js）：注入项目根与构建期 CSP nonce；
  // 文章解析后把 mermaid 代码块渲染为双主题内联 SVG（缓存 .cache/mermaid，失败回退客户端）。
  const mermaidSsr = createMermaidModule({
    rootDir,
    cspNonce: CSP_NONCE
  });

  // 数据收集器模块（scripts/build/collectors.js）：注入发布过滤器 getPublished（含草稿与定时发布语义）。
  // 机械拆分 —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
  const collectors = createCollectorsModule({
    getPublished: helpers.getPublished
  });

  // EJS 模板渲染模块（scripts/build/render.js）：注入模板目录、构建期 nonce、hooks 与构建错误收集器。
  // 机械拆分 —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
  const render = createRenderModule({
    templatesDir: TEMPLATES_DIR,
    cspNonce: CSP_NONCE,
    hooks,
    recordBuildFailure: helpers.recordBuildFailure
  });

  // 自动封面模块（scripts/build/auto-cover.js）：为无 featuredImage 的已发布文章生成
  // dist/og/cover-<slug>.<hash8>.<ext>（主题色 SVG → sharp），缓存 .cache/covers（不入库）。
  // 产物映射经 deps.getAutoCovers 活值注入 pages（卡片/文章页封面回退）；失败仅告警不阻断。
  const autoCover = createAutoCoverModule({
    rootDir,
    distDir: DIST_DIR,
    cacheDir: path.join(rootDir, '.cache', 'covers'),
    sharp,
    getPublished: helpers.getPublished,
    logger: console
  });

  // 页面生成模块（scripts/build/pages.js）：注入产物/页面/模板目录、CSP nonce、模板渲染器、
  // 发布过滤器、收集器、页面状态读取器（媒体 manifest getter、内联配置体积 setter）与共享依赖。
  // 机械拆分 —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
  const pages = createPagesModule({
    distDir: DIST_DIR,
    pagesDir: PAGES_DIR,
    templatesDir: TEMPLATES_DIR,
    cspNonce: CSP_NONCE,
    getTemplate: render.getTemplate,
    renderPage: render.renderPage,
    getPublished: helpers.getPublished,
    recordBuildFailure: helpers.recordBuildFailure,
    collectFriends: collectors.collectFriends,
    collectSeries: collectors.collectSeries,
    collectGalleryImages: collectors.collectGalleryImages,
    collectSiteStats: collectors.collectSiteStats,
    collectTags: collectors.collectTags,
    collectCategories: collectors.collectCategories,
    collectTopTags: collectors.collectTopTags,
    groupByYearMonth: collectors.groupByYearMonth,
    categoryHue: config.categoryHue,
    resolveDailyQuotes: helpers.resolveDailyQuotes,
    resolveFaviconHtml: helpers.resolveFaviconHtml,
    CleanCSS,
    getMediaManifest: deps.getMediaManifest,
    getAutoCovers: deps.getAutoCovers,
    setInlineConfigKb: deps.setInlineConfigKb,
    getIncrementalContext: deps.getIncrementalContext,
    loadBuildCache: cache.loadBuildCache,
    saveBuildCache: cache.saveBuildCache
  });

  // 订阅源/站点地图/搜索索引模块（scripts/build/feeds.js）：依赖通过 ctx 注入，函数体原样搬移。
  const feeds = createFeedsModule({
    distDir: DIST_DIR,
    serveMode: SERVE_MODE,
    watchMode: WATCH_MODE,
    getFeed: () => Feed,
    getPublished: helpers.getPublished,
    collectTags: collectors.collectTags,
    collectCategories: collectors.collectCategories,
    recordBuildFailure: helpers.recordBuildFailure
  });

  // 构建报告与性能预算模块（scripts/build/report.js）：注入产物目录、发布过滤器、内联配置体积读取器与构建错误收集器。
  // 机械拆分 —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
  // getCompression 注入供后续报告阶段输出压缩对照（当前模块暂未消费，接口先行）。
  const report = createReportModule({
    distDir: DIST_DIR,
    cspNonce: CSP_NONCE,
    getCompression: () => resolveCompressionState(),
    getPublished: helpers.getPublished,
    getInlineConfigKb: deps.getInlineConfigKb,
    recordBuildFailure: helpers.recordBuildFailure
  });

  // 压缩与缓存指纹模块（scripts/build/minify.js）：注入路径、开关与共享依赖。
  // 机械拆分 1/N —— 函数体原样搬移，行为与拆分前一致（以 dist 哈希等价门禁验证）。
  // getCompression 为惰性读取器（构建 try 内首次消费）；getBundleFiles 为 build.js 活值
  // （本轮 esbuild 产物文件名），供 JS 混淆目标白名单读取；基线快照目录与验证结果路径
  // 始终位于项目 .cache/（不随 --out 迁移，也不进入部署产物）。
  const minify = createMinifyModule({
    distDir: DIST_DIR,
    cacheBustManifestPath: CACHE_BUST_MANIFEST_PATH,
    bundleActive: BUNDLE_ACTIVE,
    getCompression: () => resolveCompressionState(),
    compressionBaselineDir: path.join(rootDir, '.cache', 'compression-baseline'),
    compressionVerifyReportPath: path.join(rootDir, '.cache', 'compression-verify', 'last.json'),
    compressionVerifyProfileDir: path.join(rootDir, '.cache', 'chrome-verify-profile'),
    getAllFiles,
    recordBuildFailure: helpers.recordBuildFailure,
    getBundleFiles: deps.getBundleFiles,
    minifyHtmlNode,
    CleanCSS,
    terser
  });

  // 开发预览服务器模块（scripts/build/serve.js）：注入产物目录；函数体原样搬移（以 dist 哈希等价门禁验证）。
  const serve = createServeModule({
    distDir: DIST_DIR
  });

  const api = Object.assign(
    {
      rootDir,
      distDir: DIST_DIR,
      watchMode: WATCH_MODE,
      serveMode: SERVE_MODE,
      showDrafts: SHOW_DRAFTS,
      allowDegraded: ALLOW_DEGRADED,
      bundleActive: BUNDLE_ACTIVE,
      outputDirResolved: OUTPUT_DIR_RESOLVED,
      cspNonce: CSP_NONCE,
      pkgVersion: PKG_VERSION,
      json5,
      chokidar,
      hooks,
      generateWorkerSecurity
    },
    config,
    helpers,
    media,
    autoCover,
    cjkFonts,
    articles,
    mermaidSsr,
    collectors,
    render,
    pages,
    feeds,
    report,
    securityFiles,
    minify,
    assets,
    serve,
    cache
  );
  // compression / compressionActive 以惰性 getter 暴露：任何读取只触发一次加载并缓存；
  // 覆盖文件错误必须在 build() 的 try 内被 resolveCompressionState() 触发（watch 可恢复）。
  Object.defineProperties(api, {
    compression: { enumerable: true, get: () => resolveCompressionState() },
    compressionActive: { enumerable: true, get: () => resolveCompressionState().active }
  });
  api.resolveCompressionState = resolveCompressionState;
  return api;
}

module.exports = { createBuildContext };
