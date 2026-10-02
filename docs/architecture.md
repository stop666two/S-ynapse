# S-ynapse 架构说明

> 本文档描述当前实现。目标平台：Cloudflare Workers（静态资产 + 安全脚本同版本部署）。
> 相关文档：`docs/config-reference.md`（配置逐字段）、`docs/incremental-build-design.md`（增量构建设计）、`docs/runbook/rollback.md`（回滚）。

## 1. 总体架构

```
articles/ media/ static/ + 14 个 JSON5 配置
        │
        ▼  npm run build（Node，scripts/build.js 编排）
   dist/（静态站点 + _headers + 404 + PWA + 搜索索引 + 哈希资源 + 构建报告 build-report.html）
        │
        ▼  wrangler deploy --config workers/wrangler.toml --env production
   Worker `blog`（workers/security-worker.js）
        ├─ 脚本层：路径规则 / 限流 / 安全响应头 / CSP / HTTPS / 维护模式 / CSP 上报
        └─ [assets] 绑定 ../dist：静态资产由平台直出（run_worker_first = true，先经脚本）
```

- 无服务端渲染、无数据库、无前端框架；所有内容在构建期生成静态文件。
- Worker 与静态资产同属一次部署，`wrangler rollback` 可整体回退。

## 2. 目录与职责

| 路径 | 职责 |
|---|---|
| `scripts/build.js` | 构建编排器（约 540 行）：进程守卫接入、配置装载/校验、14 阶段编排、报告、watch/serve 入口；重活经 `createBuildContext` 注入的工厂模块执行 |
| `scripts/build/*.js` | 构建模块（20 个，工厂注入、无全局状态）：`articles` / `assets` / `auto-cover` / `cache` / `cjk-fonts` / `collectors` / `config` / `context` / `feeds` / `fs-utils` / `helpers` / `markdown` / `media` / `mermaid` / `minify` / `pages` / `render` / `report` / `security-files` / `serve` |
| `scripts/lib/*.js` | 纯函数库（76 个文件，多数有同名单测）：`utils` / `perf-budget` / `csp` / `content-policy` / `asset-cache` / `build-errors` / `build-report-html` / `critical-css` / `content-validate` / `publish-window` / `config-split` / `bundle` / `dist-hash` / `incremental` / `compression-config` / `compression-steps` / `compression-verify` / `css-merge` / `static-server` / `internals` / `internals-defaults` / `process-guard` / `chrome-path` / `output-dir` 等 |
| `scripts/generate-og.js` | OG 图生成（独立进程，`.cache/og` 增量缓存） |
| `templates/*.ejs` | 页面模板（layout/index/post/archive/search/tag/category/404/PWA 等 16 个） |
| `js/core/` | 启动器：`runtime.js`（配置加载引导）、`boot.js`（阶段队列）、`main.js`（入口）、`deferred.js`（懒加载模块注册表）、`soft-nav.js`（软导航） |
| `js/domains/{core,features,guard}/` | 65 个前端领域模块（core 20 / features 32 / guard 13；独立文件，按启动时机注册到 `main.js` 三队列或 `deferred.js`） |
| `workers/security-worker.js` + `workers/lib/` | 边缘安全层（`ip-utils` / `rate-limit`） |
| `workers/wrangler.toml` | 生产部署配置（Worker 名、assets 绑定、环境变量） |
| `*.json5`（根目录 14 个站点配置 + `internals.json5` 工程内部参数） | 站点/主题/功能/文案/压缩等配置与工具链参数（端口/路径/CI 版本等），全部经 `verify:config` 家族与 `verify:internals` 校验；行为开关另由 `verify:config-single-source` 对照 `docs/config-switch-matrix.md`（819 项）与回退字面量绑定表守卫 |

## 3. 构建管线

`npm run build` 主流程（`scripts/build.js#build()`）按 14 个计时阶段顺序执行；阶段键与中文标签的单一来源为 `scripts/lib/build-report-html.js#PHASE_LABELS`（构建报告耗时表直接消费）：

| # | 阶段 | 关键模块与行为 |
|---|------|----------------|
| 1 | config 配置加载与校验 | `build/config`：JSON5 解析（语法错误报文件/行列）→ `validateConfig` / `validateFeatures`（对齐 `site-defaults.js` / `features-schema.js`）→ CSP nonce 生成；压缩配置经 `resolveCompressionState` 惰性加载（watch 下失败不回滚崩溃） |
| 2 | preflight 内容预校验 | `lib/content-validate`：frontmatter、缺失媒体、重复/非法/保留 slug、未来日期；slug 身份类 critical 错误不可降级（`--allow-degraded` 仅豁免资源/数据类），且先于 `dist/` 清理 |
| 3 | distStatic 产物初始化与静态资产 | `setupDist` 清理输出；`copyStatic` / `copyProtectedAssets`（content-policy 过滤、SVG 消毒、可执行拦截） |
| 4 | media 媒体优化 | `build/media` + sharp 多尺寸 webp/avif + LQIP；`.cache/media` 增量；损坏/被拦媒体清单 `.cache/broken-media.json` 供页面与 OG 回退 |
| 5 | articles 文章处理与封面/图表 | `build/articles`（marked → CJK 间距 → sanitize-html → `hasCode` 门控 Prism → TOC）→ 自动封面 `build/auto-cover`（`.cache/covers`）→ mermaid SSR `build/mermaid`（`.cache/mermaid`，失败保留 `data-mm-pending` 交客户端）→ `lib/bundle`（app/deferred/shared + runtime 引导）→ `build/config`（外置配置）→ `lib/search-index` 预计算 |
| 6 | pages 页面生成 | `build/pages`：文章/归档/标签/分类/图库/友链/搜索/自定义页/404；增量构建按页复用（`lib/incremental`） |
| 7 | feeds 字体/订阅源/站点地图 | `build/cjk-fonts`（扫描实际用字，`.cache/fonts`，失败降级系统字体）→ `build/feeds`（RSS/JSON Feed/sitemap，超阈值拆分） |
| 8 | og OG 图生成 | `scripts/generate-og.js` 独立进程（仅生产构建；`.cache/og` 增量，统计写 `last-run.json`） |
| 9 | search 搜索索引与提交 | sitemap ping（可选）+ 每语言内容寻址 `assets/search-index.<hash>.json` |
| 10 | security 安全文件与重定向 | `build/security-files`：`_headers`（CSP/安全头按开关裁剪）、`robots.txt`、`_redirects`、`workers/security-config.js`（自定义输出目录构建跳过） |
| 11 | assetsPwa JS 资产与 PWA | `copyJsAssets`（`--no-bundle` 时）/ `copyVendorAssets` / `generatePWA`；SW 初版在压缩前、定稿（`generateServiceWorker`，按最终文件名生成预缓存清单）在 cacheBust 后并入本阶段计时 |
| 12 | compression 压缩增强（含无头验证） | `build/minify` + `lib/compression-*`：基线压缩 → 增强（HTML 激进默认关、CSS 同页合并去重、JSON 去空白、runtime 压缩、可选混淆）→ 无头对比门禁（失败回退基线并逐字节复核）；详见 `compression.json5` |
| 13 | cacheBust 缓存指纹 | `lib/dist-hash` 映射与 HTML/feed 引用重写；压缩与回退均在此之前完成（文件名哈希 = 最终字节）；Pagefind 索引（可选）在其后生成 |
| 14 | report 报告生成 | `build/report` + `lib/build-report-html`：唯一 `dist/build-report.html`（构建元信息、14 阶段耗时、产物体积与 Top 列表、逐项性能预算、压缩统计与无头验证、缓存命中、告警/失败清单、页面清单；暗色适配、无外部依赖与内联脚本），任一失败默认非零退出码 |

### 3.1 配置单一事实源与行为开关矩阵

- **默认值唯一来源**：`scripts/lib/features-schema.js`（features）、`tuning-defaults.js`、`site-defaults.js`（site/navigation/sidebar/footer/theme/security/friends/tagAliases/contentPolicy 全段）、`internals-defaults.js`；构建与工具链代码不得复制默认值字面量，一律引用注册表或读取合并后的配置对象（`feature-wiring.js` 等接线层亦然，`feature-wiring.test.js` 以「缺省 = 默认 = 历史行为」锁定语义）。
- **浏览器运行时 fail-open 兜底**：外置配置（`/assets/config.<hash>.json`）可能加载失败，`js/**` 保留兜底字面量；这些字面量由 `scripts/config-fallback-bindings.json` 逐条绑定注册表默认值（snippet + literal），`verify:config-single-source` 校验 snippet 仍存在且值严格相等（schema 默认变更或代码重写即 FAIL）。
- **行为开关矩阵**：`docs/config-switch-matrix.md` 由 `npm run gen:config-matrix` 生成，枚举全部布尔/枚举/数值开关，给出类型、默认、消费 file:line、测试证据与覆盖状态；测试内以 `// switch: <键路径>` 标记声明双态覆盖，无法无头验证的运行时/DOM 键在 `scripts/config-switch-exemptions.json` 逐键登记类别与理由（`runtime-dom`/`ssr-template`/`build-integration`/`visual-param`/`security-policy`）。
- **门禁规则**：新 schema 布尔/枚举键未挂测试 marker 或豁免理由 → `verify:config-single-source` FAIL；矩阵文档与生成结果不一致（消费位置/测试证据变化后未重生成）同样 FAIL；未知 marker、未知豁免键、冗余豁免均 FAIL。守卫已接入 `ci-checks.js` 与 `deploy.yml`（紧随 `verify:config-refs`）。

**模块拆分图**（`scripts/build.js` 只保留编排与入口）：

```
scripts/build.js（14 阶段编排 + watch/serve + require('lib/process-guard')）
        │ createBuildContext（build/context.js：路径/标志解析 + 工厂接线 + 活值 getter/setter）
        ├── build/config, build/cache, build/context ........ 配置、缓存根与闭包状态
        ├── build/articles, markdown, pages, render, collectors 内容与页面
        ├── build/media, auto-cover, cjk-fonts, mermaid .... 媒体、封面与渲染
        ├── build/feeds, report, security-files, minify .... 订阅源、报告、安全文件与压缩
        └── build/assets, serve, fs-utils, helpers ......... 交付资产、本地服务与工具
                ▲ 纯逻辑下沉
        scripts/lib/*（76 文件；测试直连，无 fs/网络副作用或经依赖注入）
```

**构建缓存**（`.cache/`，均不入库）：`.cache/media`（媒体输出持久副本）、`.cache/covers`（自动封面）、`.cache/og`（OG 图与 `last-run.json`）、`.cache/mermaid`（SSR SVG，键 = 版本+主题+源码哈希）、`.cache/fonts`（CJK 清单与 woff2 分片，URL 哈希命名）、`.cache/compression-baseline`（验证期基线快照按运行隔离为 `run-*` 子目录，默认验证后删除）、`.cache/compression-verify/last.json`（无头验证结果）、`.cache/chrome-verify-profile`（无头 profile 基目录，每次运行随机子目录且运行结束即清理）；`.build-cache.json` 为媒体指纹总表。自定义输出目录：`--out` / `SYNAPSE_OUT_DIR`（集成测试使用）。

## 4. 前端启动架构

```
layout.ejs 内联：__CONFIG_URL__ + __CRIT__（≤2KB 关键配置）+ __DEFERRED_URL__ + __SITE_TITLE__
        │
runtime.js（哈希单发）：fetch /assets/config.<hash>.json（1 次重试、3s 超时、失败 fail-open 用 __CRIT__）
        │  __CONFIG_READY__ / __CONFIG_OK__
boot.js：critical 队列（同步 init，必成功）→ idle 队列 → heavy 队列（requestIdleCallback 切片）
        │
main.js：交互后再触发懒加载；deferred.js 注册表 load(name) 动态 import deferred chunk
```

- 配置分层：关键子集内联（`features.guards`、`pwa` 开关等），大对象（features/tuning/guard/i18n/预设）走共享 JSON（内容哈希命名，immutable 缓存）。
- 模块仍是独立文件；`deferred.js` 是唯一“模块清单”来源，负责名称到动态 import 的映射。
- **关键 CSS 与首帧**（`site.build.criticalCss` 开启时）：`scripts/lib/critical-css.js` 从压缩后主样式按选择器白名单抽取首屏规则（变量引用闭包裁剪），`build/pages.js` 以内联 nonce `<style>` 置于 `<head>` 最前；主样式与本地字体声明以 `media="print"` + `preload as=style` 低优先加载，nonce 内联脚本在样式就绪后翻回 `media="all"`（`<noscript>` 链接兜底）；解析异常自动回退全量阻塞样式，构建不失败。
- **软导航**（`features.softNavigation`）：`js/core/soft-nav.js` 文档级拦截站内同语言链接 → 悬停/聚焦延迟预取（`prefetchOnHover`/`prefetchDelayMs`）→ fetch 超时兜底（`timeoutMs`）→ 交换主内容区并同步 `<title>`/meta/语言态 → 可选 View Transition 过渡（任一环节失败回退普通整页跳转）；内存缓存带 TTL 与条数上限（`cacheTtlMs`/`cacheMaxEntries`）；交换后广播 `__SOFTNAV_HOOKS__`，各 feature 模块据此重绑（灯箱/双语/继续阅读等）。

## 5. 配置体系

- 14 个 JSON5：`site` / `theme` / `features` / `tuning` / `guard` / `ui-strings` / `navigation` / `sidebar` / `footer` / `security` / `content-policy` / `tag-aliases` / `friends` / `compression`。
- 三层约束：`site-defaults.js`（默认值注册表）、`features-schema.js`（features 结构登记）、`scripts/check-config-consistency.js`（`verify:config`，允许用户值覆盖默认值）。
- 新增字段须同步四处：配置文件 + 注册表/结构 + 逐键注释（`verify:config-comments`）+ `docs/config-reference.md`（`scripts/check-config-docs.js` 覆盖校验）。

## 6. 安全模型

| 层 | 机制 |
|---|---|
| 构建期 | sanitize-html 白名单（禁 `on*`/`style`/脚本类标签）、CJK 文本处理、媒体 URL 本地化、frontmatter / slug / 头值（RFC 7230 token、禁 CRLF）校验 |
| 响应头 | CSP（`script-src` 与 `style-src` 共用每构建一次性 nonce，均无 `unsafe-inline`；模板/产物无内联 `style="..."` 属性，不声明 `style-src-attr`，属性语境回退到同样拒绝内联的 `style-src`；`frame-ancestors 'none'` + XFO 双保险）、HSTS、Referrer-Policy 等 |
| Worker | `CF-Connecting-IP` 单源信任、路径限制（解码 + 点段折叠）、限流（fail-closed；跨 isolate 局限见 SECURITY.md）、HTTPS 强制、维护模式、CSP 上报（限流 + 16KB 上限） |
| 日志 | JSON Lines + `X-Request-Id`；IP 仅 HMAC 哈希（`LOG_IP_SECRET`；未配置时为固定盐，可枚举） |
| 前端软防护 | accessGate 等 guard 模块仅防误入，可被绕过，不得作为访问控制（见 SECURITY.md） |

## 7. 缓存策略

- `_headers` 分级：`/assets/css/*` 1 年 immutable；`/assets/js/*` 与 `/assets/vendor/*` 1 小时 + SWR；带指纹的 `app|deferred|runtime.*.js` 1 年 immutable；`/media/*`、`/og/*` 7 天 + SWR（均可用 `site.build.cacheControl` 关闭）。
- 构建侧缓存：媒体 / OG / 自动封面 / mermaid / CJK 字体五类内容指纹命中即跳过重算（构建报告「缓存命中」区块逐项列出 reused 与新生成数量）；配置 JSON 以内容哈希命名参与 cache-bust。
- 压缩验证缓存：`.cache/compression-baseline/run-*`（验证期基线快照按运行隔离，默认验证后删除；超过 1 小时的陈旧残留自动清理）、`.cache/compression-verify/last.json`（结果 JSON）、`.cache/chrome-verify-profile/run-*`（每次运行随机浏览器 profile，运行结束包含失败情形无条件清理；并发构建互不干扰）。

## 8. 测试与门禁

| 命令 | 内容 |
|---|---|
| `npm test` | node:test 单测（构建纯函数、Worker 配置、CSP、机器人、原子写、配置分层、打包、dist 哈希、压缩配置/流水线/验证、CSS 合并、增量构建等） |
| `npm run test:coverage` | `scripts/lib` 行覆盖率门禁（≥80%，CI 阻断） |
| `npm run test:build` | 集成 smoke：干净构建断言产物 + 坏文章阻断且不污染 dist（临时输出目录；含唯一构建报告/CSP nonce 两态断言） |
| `npm run test:fuzz` | 属性/随机测试：`scripts/**/*.fuzz.test.js`（fast-check；`FC_NUM_RUNS` 默认 100、`STRESS=1` 开海量用例；种子见 `scripts/lib/test-random.js`，失败留档 `build-artifacts/fuzz-failures/`；默认单测不含 fuzz） |
| `npm run test:smoke` | 浏览器冒烟：真实构建 + 系统 Chrome 代表页（200/标题/DOM/零控制台错误），摘要 `build-artifacts/web-smoke/summary.txt`；无 Chrome 跳过 |
| `npm run test:cov-web` | 无头 Web 覆盖率：`--no-bundle` + `--no-minify-js` + 压缩关闭构建（产物保留源码行结构），CDP 精确覆盖聚合 `js/**` 行/函数覆盖（阈值 `scripts/lib/web-coverage-thresholds.js`，首测定档 55%/55%），输出 `build-artifacts/web-coverage/{summary.txt,coverage.json}`（含逐函数未覆盖明细）；无 Chrome 跳过 |
| `npm run test:all` | 本地与 CI 同强度：`npm test` + `test:build` + `test:fuzz` + `test:malicious` + `test:smoke` + `test:cov-web` + `verify:internals` 串行；夜间深度档见 `nightly.yml`（`FC_NUM_RUNS=2000` + `STRESS=1` + 随机种子） |
| `npm run lint` / `npm run typecheck` | ESLint / tsc（checkJs） |
| `npm run verify:config` / `verify:config-refs` / `verify:config-single-source` / `verify:config-dupes` / `verify:config-comments` / `verify:config-docs` | 配置一致性 / 零引用键 / 开关矩阵与回退字面量单一来源 / 重复键 / 逐键注释覆盖率 / 文档覆盖监守（`scripts/check-config-single-source.js`、`scripts/check-config-docs.js`） |
| `npm run verify:internals` | `.nvmrc` / `workers/wrangler.toml` assets 目录 / CI 版本与 `internals.json5` 单源守卫（关键写死形态抽样） |
| `npm run verify:process-guards` | 进程守护巡检（高风险入口 `process-guard` 接入的静态检查；CI 聚合执行） |
| `npm run verify:security` | 安全集成回归（注入恶意文章 → 构建 → 语义断言） |
| `npm run verify:compression` | 压缩无头对比门禁（6 页 DOM/采样样式/控制台/交互断言；无 Chrome 跳过） |
| `npm run sbom` | CycloneDX 1.5 SBOM 生成（CI 上传 artifact） |
| `npm run audit` / `npm run audit:a11y` | 依赖漏洞（官方 registry）/ 真实页面 a11y（puppeteer + axe，含 wcag22aa） |
| `node scripts/dist-hash-guard.js` | 重构/迁移的产物等价护栏（归一化 nonce/换行） |
| `node scripts/perf-audit.js` | 可复现性能基线（Slow 4G + 4× CPU） |

CI（`.github/workflows/deploy.yml`）：`check-agents`（AGENTS.md 变更检测）→ `compat-node20`（Node 20.19.0：test + verify:config + verify:config-refs + verify:config-single-source + verify:config-dupes + verify:internals + test:build + build）与 `build`（Node 版本由 `.nvmrc` 经 `node-version-file` 单源控制；`node scripts/ci-env.js` 导出 internals → 单步 `node scripts/ci-checks.js` 跑完整套并统一失败：lint / typecheck / test / test:coverage / test:build / test:fuzz / test:malicious / verify:config 家族（config/refs/single-source/dupes/comments/docs 与 verify:internals）/ verify:process-guards / verify:security / test:smoke / test:cov-web / verify:compression / build / sbom；`audit` 与 `audit:a11y` 为建议项（入报告不阻断）；报告写 `build-artifacts/ci-checks.{json,txt}` → 始终上传 `ci-checks` 与 `test-artifacts` → Pages 部署（`npm run deploy:pages`，部署前 verify:internals））。夜间随机深度档（`.github/workflows/nightly.yml`，UTC 18:00 + `workflow_dispatch`）用同一聚合器（`FC_NUM_RUNS=2000`、`STRESS=1`），上传 `nightly-test-artifacts`。生产 Worker 为手动 `wrangler deploy`（见 README）。预检作业（`preflight`，`scripts/ci-skip.js`）在 HEAD 未变化的重复运行上按连击阈值（连错 2/连净 5，告警中性）自动跳过，`workflow_dispatch`/`CI_FORCE`/`[ci force]` 强跑；聚合检查带每项超时并清理进程树，结论以提交状态 `ci/aggregate` 供下一次判定读取。`.github/workflows/release.yml` 独立处理 tag 发布（见 §9.1）。

## 9. 部署与回滚

- 生产：`npm ci && npm run build && npx wrangler deploy --config workers/wrangler.toml --env production`（Worker `blog`）。
- 回滚：`wrangler deployments list` → `wrangler rollback <id>`（脚本 + 资产整体回退）；详见 `docs/runbook/rollback.md`。
- real-site：本地生产副本，含真实数据，永不入库；主仓库为代码事实源，同步方式见 README「派生副本与回滚」。

### 9.1 Release 发布工作流

- **完成标记**：`npm run release:mark`（`scripts/release-mark.js`）在干净工作区上顺序执行 `RELEASE_GATES`（12 项门禁，单一来源 `scripts/lib/release-version.js`）→ 同步 package.json/lock 版本 → CHANGELOG `[Unreleased]` 内容归入 `[X.Y.Z] - 日期` → 生成 `RELEASE.json`（status=verified、checks 全 true、commit=被核验提交即 tag 的父提交）→ 单提交 `chore(release)` + 附注 tag `vX.Y.Z`；默认不 push，推送需 `--push --confirm-push` 二次确认。
- **双重校验**：根 `RELEASE.json` 是机器可读完成标记（初始 `unverified`，默认拒绝发布）；`scripts/lib/release-validate.js` 校验 status/version/tag/commit/checks/verifiedAt，只有「tag 存在」且「tag 指向提交内的标记自洽」同时成立才允许创建 Release。
- **发布流水线（`.github/workflows/release.yml`，仅 `push tags v*` 触发，5 个作业串行）**：`validate`（RELEASE.json 双重校验）→ `gates`（`RELEASE_GATES` 12 项命令 + `verify:internals` 单源守卫）→ `archive`（按白名单生成 `S-ynapse-<版本>.zip` 并上传 artifact）→ `buildability`（解压归档 → `npm ci --ignore-scripts` → `npm test` → `npm run build`，断言 `dist/index.html`、`dist/build-report.html`、每语言搜索页与内容寻址索引齐备）→ `publish`（`npm ci --omit=dev` 装运行时依赖 → `release:notes` 生成描述 → `gh release create --verify-tag --latest --notes-file` 附 zip，随后执行 `release:prune` 只保留最新 Release）。任一作业失败即不发布。
- **Release 描述补更工作流**：`.github/workflows/release-notes.yml`（`workflow_dispatch` 输入 tag）checkout 默认分支的生成器 → `gh release download` 取该 Release 的 zip 计算 SHA-256 → `gh release edit --notes-file` 仅更新正文，不触碰 tag、标题、附件与 latest 标记；描述构成与本地生成命令见 `docs/runbook/release.md` §5.1。
- **归档白名单**：`scripts/lib/release-manifest.js` 为唯一来源（包含/排除清单与理由）；`scripts/release-archive.js` 用 `git archive` + pathspec 生成 zip，再解析中央目录逐条复核（`assertArchiveContents`），越界或缺少必需文件即失败。`articles/`、`media/` 只保留 `.gitkeep` 骨架；测试所需最小文档集 `docs/config-reference.md` 与 `docs/config-switch-matrix.md` 经 `RELEASE_EXTRA_FILES` 显式随包（两者同在必需文件断言内；其余 `docs/**` 与 `.github/**` 一律排除）。
- **tag 永不删除**：`scripts/release-prune.js` 固定 `gh release delete <tag> --yes`（不带 `--cleanup-tag`），只清理旧 Release 页面，`--keep` 之外的 `v*` tag 原样保留。
- **本地备用通道**：`npm run release:publish -- vX.Y.Z`（远端 tag 存在 + 同一套校验 + `gh`）；完整流程与排障见 `docs/runbook/release.md`。
- `deploy.yml` 触发条件限定 `branches: [main]`，tag 推送不会误触发站点部署。

## 10. 已知边界与后续项

- `scripts/build.js` 为编排器（约 540 行，含 watch/serve 入口与进程守卫接入），构建能力全部位于 `scripts/build/` 工厂模块；等价护栏 `scripts/dist-hash-guard.js` + `.refactor-baseline.json`。
- `js/domains` 已按 core（20 模块）/features（32 模块）/guard（13 模块）物理分层（`deferred.js` 统一注册表）。
- `style-src` 已随 `<style>` nonce 注入消除 `'unsafe-inline'`；模板与构建产物亦已清除全部内联 `style="..."` 属性（类 / 构建期 nonce `<style>` 规则 / CSSOM 三种手法），`style-src-attr` 不再声明，属性语境回退到 `style-src` 同样拒绝内联（见 SECURITY.md）。Worker 无构建产物时的 FALLBACK 因无 nonce 可注入而保留 `style-src 'unsafe-inline'`，`script-src` 已同步收紧。
- 增量构建（`features.incrementalBuild`）已实现：`scripts/lib/incremental.js` 指纹与跳过决策 + `scripts/build/*` 逐页复用产物；方案见 `docs/incremental-build-design.md`。
- accessGate 为软防护；`?key=`/`?guard=` 参数在判定/解锁读取完成后经 `history.replaceState` 从地址栏清理（保留其它查询串与 hash），但不改变其可被绕过的事实。
- 开发服务器支持进程看门狗（`SYNAPSE_SERVE_PARENT_PID` / `SYNAPSE_SERVE_IDLE_MS`，`scripts/build/serve.js`），工具脚本退出即回收；兜底清理 `node .tmp-scripts/kill-orphans.js`。
