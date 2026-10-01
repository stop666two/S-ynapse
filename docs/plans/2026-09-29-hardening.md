# 硬化与可配置化计划（数据流 / 硬编码 / 配置扩张 / 文档）

## 决策（用户已确认）

1. 新建 `internals.json5` 承载工程内部参数；CI 经 `.nvmrc`/脚本读取；单一来源并有校验守卫。
2. 配置扩张 P1–P3 全做（29 项），默认=现状，全部真实接线。
3. 语言表：构建注入 `__LANGS__` + 统一 `langOf()`；默认 zh/en 行为不变，为未来多语言铺路。
4. 根路由：删除 `_redirects` 的 `/ → /zh/ 302`，保留根页浏览器语言跳转。
5. `site.timezone` 标记为保留字段，从活跃描述中移除。
6. 数据流 15 项缺陷全部修复。
7. CI：一次跑完整套检查（不提前中断），汇总失败与警告到报告/工件，末尾统一失败；门禁保留。

## 波次

- H1：`internals.json5` 基建 + 硬编码迁移（HC）+ CI 汇总改造 + 守卫。
- H2：数据流修复（DF）+ `__LANGS__`/`langOf()`。
- H3：配置扩张 EX（P1–P3）。
- H4：JSON5 注释升级（CM）+ 文档修复（DOC）。
- H5：全门禁 + real-site 同步 + 交接。

## DF 数据流修复清单（H2）

- DF1 根页语言硬编码 `rootLang='zh'` 且 `rootData` 未按语言投影（`scripts/build/pages.js:812-852`、`:189-253`；`scripts/build/articles.js:97` LANGS 写死）→ 取 `site.languages[0]`/默认语言并按该语言重建数据，`generateIndex=false` 时不再生成根页。
- DF2 增量构建复用旧 nonce（`scripts/build/mermaid.js:71`、`scripts/lib/incremental.js:27-29`、`scripts/build/pages.js:554-559`、`scripts/build/security-files.js:110`）→ 缓存条目记录 nonce，不匹配强制重渲染（或跳过时替换 nonce）。
- DF3 cacheBust 不改写 feed（`scripts/build/minify.js:736,760`、`scripts/build/feeds.js:77`、`scripts/build.js:264-265,299`）→ cacheBust 末尾以同一 mapping 重写 `feed.xml`/`feed.json`（或 feeds 生成改用最终资源 URL）。
- DF4 OG 第二事实源（`scripts/generate-og.js:364-375,401-407,533-544` vs `scripts/build/config.js:209-217`）→ 抽出共享 `resolveBuildTheme`；OG 缓存键补 `appliedPreset/presetOverrides/coverFit/overlay/useCover`。
- DF5 real-site 落后主仓安全修复 → 归 H5 同步流程（主仓不改 real-site）。
- DF6 guard 降级丢防护（`js/core/runtime.js:8`、`js/core/main.js:100-104`、`scripts/lib/config-split.js:51-61`、`js/domains/guard/core.js:7,66`）→ guard 关键项纳入 critical 或降级时按 `__FEATURES__.guards` 启用默认档。
- DF7 语言切换按钮被 themePresets 条件包裹（`templates/layout.ejs:131`）→ `lang-wrap` 移出条件独立渲染。
- DF8 `modified` 字段被丢弃（`scripts/build/articles.js:289-302`、`templates/layout.ejs:32,44`、`scripts/build/feeds.js:193`）→ 投影 modified；meta/JSON-LD/sitemap 优先使用。
- DF9 feed 链接未按 `site.rss.enabled` 门控（`templates/layout.ejs:39-40`）→ 补门控。
- DF10 `/` 两套跳转机制冲突（`scripts/build/security-files.js:49-53`、`scripts/build/pages.js:853-857`、`scripts/build/serve.js:63-78`）→ 按决策 4 删 302。
- DF11 JSON Feed `updated` 用未过滤文章（`scripts/build/feeds.js:121` vs `:64`）→ 统一 `getPublished`。
- DF12 搜索索引缺失时回退死路径（`templates/layout.ejs:85`、`scripts/build/feeds.js:393-397`、`js/domains/features/search.js:11`）→ 显式「索引不可用」错误态，不再指向不存在的 v1 路径。
- DF13 offline.html 语言判定 `=== 'en'`（`scripts/build/assets.js:182`）→ 按 `languages[0]`/前缀判定（兼容 BCP 47）。
- DF14 `_redirects` 缺 `/feed.json` 根别名（`scripts/build/security-files.js:60`）→ 从 `site.rss.jsonFeed.path` 派生。
- DF15 软导航不同步 `hreflang`/feed alternate（`js/core/soft-nav.js:113-121`）→ syncHead 增补按序替换。

## HC 硬编码迁移清单（H1）

- HC1/HC2 `scripts/a11y-audit.js:28`、`scripts/perf-audit.js:22` Chrome 路径写死 → 复用 `scripts/lib/mermaid-render.js:326 resolveChromePath`（或抽共享模块）。
- HC3 `workers/wrangler.toml:6` assets `../dist` 固定 → 部署前校验/脚本与 `--out` 对齐（internals.deploy 检查项）。
- HC4 `scripts/security-verify.js:12-28` 写死 `articles/zh` 与 `dist` → `.tmp-test` + `SYNAPSE_OUT_DIR`。
- HC5 `scripts/build/security-files.js:60` rootAliases 固定 → 配置派生。
- HC6 语言表散落 ~20 文件（`js/domains/features/search.js:11`、`search-page.js:33`、`command-palette.js:33,71`、`js/core/soft-nav.js:37`、`i18n.js:1` 等）→ `__LANGS__` + `langOf()`（H2 执行）。
- HC7 `dist` 字面量多处（`a11y-audit.js:23`、`security-verify.js:16`、`generate-og.js:22-23`、`.github/workflows/deploy.yml:137`、`release.yml:129-131`、`report.js:106`、`minify.js:68`、`context.js:403`）→ 统一 `resolveOutputDir` 导出复用。
- HC8 `js/core/runtime.js:5,7` 超时 fallback 3000 → `features.boot.configTimeoutMs` 注入 `__CONFIG_TIMEOUT__`。
- HC9 `js/core/soft-nav.js:7,92,190` 缓存常量内联（16/300000×2）→ 来自 features 注入。
- HC10 `security-files.js:178-186` 缓存前缀写死 → 从 `site.build` 目录配置读取。
- HC11 `generate-security-config.js` 兜底常量与 Worker FALLBACK 三处重复 → 单点常量 + 同步注释。
- HC12 端口 3000（`package.json:42`/`serve.js:23`）与 3224（a11y）→ `internals.ports`。
- HC13 `scripts/export.js:27` 前缀 → `features.export.fileNamePrefix`。
- HC14 CI Node 版本 6 处 + deploy 20.19.0 → `.nvmrc` + `node-version-file`。
- HC15 wrangler pages 项目名 2 处（`deploy.yml:137`/`package.json:43`）→ npm script/env（internals.deploy.pagesProject）。
- HC16 `minify.js:709` sw.js/图标名 → `site.pwa` 派生。
- HC17 一言/CF 脚本 URL 双默认（`features-schema.js:117`、`feature-wiring.js:1261,1275`）→ 默认单源 schema。
- HC18 `scripts/lib/pwa-sw.js:25,109` 基名 → `site.pwa.cacheName`。
- HC19 上限常量（`release-prune.js:22`、`dist-hash-guard.js:13`、`a11y-audit.js:30-31`）→ internals.audit/release 或 CLI。
- HC20 favicon/报告颜色写死（`helpers.js:110`、`report.js:131`）→ 主题派生或集中常量。

## EX 配置扩张清单（H3）

- P1：`i18n.storageKey`、`themePresets.storageKey`、`readingProgress.storageKey`、`friends.sidebarCount=8`、`continueReading.removeDelayMs=360/clearConfirmMs=3000`、`search.resultTagCount=6`、`searchHighlight.markColor(+markColorDark)`、`features.errorPage(新).suggestCount=5`、`series` widget count 接线修复（`layout.ejs:168`）、`imageLazy.eagerFirst` 接线修复（`index.ejs:39` 仅第一张）。
- P2：`readingHistory.progressThrottleMs=800`、`bilingual.fetchTimeoutMs=10000/resizeDebounceMs=120/paneTitle(En)`、`pwa.reloadFallbackMs=3000`、`search.overlayBackdrop`、`announcement.transitionMs=450`、`codeBlock.windowDotColors`、`guard.contextMenu.searchTextMaxChars=12`、`site.build.reportTopN=10`、sidebar `recentPoolSize=10`。
- P3：`security.rateLimiting.maxTrackedEntries=5000`、`security.hardening.cspReportMaxBytes=16384`、`guard.contextMenu.moveTolerancePx=8`、`codeBlock.scrollHintTolerancePx=8`、`errorPage.artAriaLabel(En)`、CJK 字体并发/TTL、主题色收编（避免双源）、省流模式降级阈值。

## CM 注释升级清单（H4）

- `tuning.json5` 全 273 键补「作用/类型/可填值及含义/不可填值及原因/推荐/废弃」；`features.json5` 旧模块 8 段补全（范本：`:2553-2596`、`:1723-1738`、`:2380-2398`）；`site.json5` authorProfile 子字段（`:84,88,92,96,101,105,110`）。
- 删除历史/批次字样：`features.json5:1906,2384,2391` 及 `:1749,228,230,300,1143,1419,1710` 的「历史行为」叙述；`navigation.json5:69`、`site.json5:217` 的 `v1.0.3+` 字样。
- `ui-strings.json5` 文件头补「不逐键标注」理由（维持既定策略）。

## DOC 文档修复清单（H4）

- `README.md:228` 98→102；`:231` 176→179；`:388` 100→102。
- `docs/config-reference.md:14` 100→102；`:919,1272` 176→179；`:45` timezone→保留；`:62` jsonFeed 内置默认 false 标注；`:84-85` titleTemplate 分隔符以注册表为准；`:136` minifyHTML/CSS/JS 默认 false；`:143,152,153,154,159` 幽灵键删除或改指；§3 计数同步。
- `docs/architecture.md:27,131` build.js 行数 413；`:33 vs :132` 模块数统一（以 deferred.js 为准重算）；`:102` 补 `test:malicious`；`:113` 补 `test:malicious`/`verify:config-docs`；`:134` incrementalBuild 已实现（去掉“预留”）。

## 通用纪律

- 注释只解释代码，禁止批次/日期/轮次标记；每键默认=现状且真实接线（`verify:config-refs` 零未接线）；测试与四套 config 守卫全绿；不改 `articles/`、不 push、不部署（除非用户明确要求）；提交细颗粒中文 Conventional Commits。
