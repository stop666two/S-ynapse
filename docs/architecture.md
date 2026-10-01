# S-ynapse 架构说明

> 本文档描述当前实现。目标平台：Cloudflare Workers（静态资产 + 安全脚本同版本部署）。
> 相关文档：`docs/config-reference.md`（配置逐字段）、`docs/incremental-build-design.md`（增量构建设计）、`docs/runbook/rollback.md`（回滚）。

## 1. 总体架构

```
articles/ media/ static/ + 14 个 JSON5 配置
        │
        ▼  npm run build（Node，scripts/build.js 编排）
   dist/（静态站点 + _headers + 404 + PWA + 搜索索引 + 哈希资源 + 构建摘要 report.txt）
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
| `scripts/build.js` | 构建编排器（419 行）：配置装载/校验、阶段编排、报告、serve 入口 |
| `scripts/build/*.js` | 已拆出的构建模块（工厂注入、无全局状态）：`articles` / `assets` / `auto-cover` / `cache` / `cjk-fonts` / `collectors` / `config` / `context` / `feeds` / `fs-utils` / `helpers` / `markdown` / `media` / `mermaid` / `minify` / `pages` / `render` / `report` / `security-files` / `serve` |
| `scripts/lib/*.js` | 纯函数库：`utils` / `perf-budget` / `csp` / `content-policy` / `asset-cache` / `build-errors` / `build-report-text` / `content-validate` / `publish-window` / `config-split` / `bundle` / `dist-hash` / `incremental` / `compression-config` / `compression-steps` / `compression-verify` / `css-merge` / `static-server` / `internals` / `internals-defaults` / `chrome-path` / `output-dir` 等（多数有同名单测） |
| `scripts/generate-og.js` | OG 图生成（独立进程，`.cache/og` 增量缓存） |
| `templates/*.ejs` | 页面模板（layout/index/post/archive/search/tag/category/404/PWA 等 15 个） |
| `js/core/` | 启动器：`runtime.js`（配置加载引导）、`boot.js`（阶段队列）、`main.js`（入口）、`deferred.js`（懒加载模块注册表）、`soft-nav.js`（软导航） |
| `js/domains/{core,features,guard}/` | 65 个前端领域模块（core 20 / features 32 / guard 13；独立文件，按启动时机注册到 `main.js` 三队列或 `deferred.js`） |
| `workers/security-worker.js` + `workers/lib/` | 边缘安全层（`ip-utils` / `rate-limit`） |
| `workers/wrangler.toml` | 生产部署配置（Worker 名、assets 绑定、环境变量） |
| `*.json5`（根目录 14 个站点配置 + `internals.json5` 工程内部参数） | 站点/主题/功能/文案/压缩等配置与工具链参数（端口/路径/CI 版本等），全部经 `verify:config` 家族与 `verify:internals` 校验 |

## 3. 构建管线

`npm run build` 主流程（`scripts/build.js#build()`）：

1. **配置装载与校验**：JSON5 读取 → `validateConfig` / `validateFeatures`（对齐 `site-defaults.js` / `features-schema.js`）→ 错误格式化输出。
2. **内容预校验**（`preflightContent`，写 dist 之前）：frontmatter 合法性、缺失媒体、重复 slug、未来日期。失败即阻断（`--allow-degraded` 可降级为告警）。
3. **产物准备**：`setupDist` 清理输出；`copyStatic` / `copyProtectedAssets` / `optimizeMedia`（sharp 多尺寸 webp/avif + LQIP，`.cache/media` 增量）。
4. **内容处理**：marked 渲染 → CJK 间距 → sanitize-html（白名单 + 媒体 URL 本地化）→ 代码高亮判定（`hasCode` 门控 Prism）；mermaid 代码块全站汇总后经 puppeteer-core 一次性构建期渲染为双主题内联 `<svg>`（`.cache/mermaid` 内容哈希缓存，消毒后注入 CSP nonce；失败或无 Chrome 的条目保留 `data-mm-pending` 并由客户端 vendor 回退）。
5. **打包**：esbuild 打包（`app.<hash>.js` / `deferred.<hash>.js` 入口，`splitting` 抽出的 `shared.<hash>.js` 公共 chunk 由模块图自动加载）+ `runtime.<hash>.js`（Terser 压缩后哈希单发，压缩关闭时保留源哈希名）；`--no-bundle` 可回退原生模块。
6. **页面与索引生成**：`generatePages`（文章/归档/标签/分类/自定义页/分页）→ RSS/JSON Feed → sitemap → 搜索索引（`.json` + pagefind 兼容清单）→ PWA（manifest + 离线页 + SW 初版）→ CJK 字体子集化（扫描 dist 页面与配置 JSON 的实际用字，仅下载命中的 Noto Sans SC woff2 分片并自托管，`.cache/fonts` 清单+分片缓存，失败仅告警并剥离引用）。
7. **交付层处理**：基线压缩（minify-html / CleanCSS / Terser）→ 压缩增强（`compression.json5`：HTML 激进选项默认关、CSS 同页 `<style>` 合并去重、JSON 去空白、`runtime` Terser 压缩、可选 JS 混淆）→ 无头对比门禁（压缩产物 vs 基线快照；失败回退基线并告警，回退后逐字节复核）→ cache-bust 映射 → SW 定稿（按最终文件名生成壳预缓存清单与版本化缓存名）→ `_headers`（安全头 + 分级缓存，含 `/sw.js` no-cache）→ CSP nonce 注入（内联脚本与响应头同 nonce）。增强与回退均位于 cacheBust 之前，文件名哈希=最终字节。
8. **报告与门禁**：性能预算 5 项、构建报告 `build-report.html` 与构建摘要 `report.txt`（阶段耗时、压缩前后体积对照、CSS 合并/去重跳过明细、无头验证摘要、告警、预算结论）、失败汇总（任一失败默认退出码非 0）。
9. **OG 图**（生产构建）：`generate-og.js` 独立进程，`.cache/og` 命中复用。
10. **Pagefind 索引**（可选，`navigation.search.provider='pagefind'` 且 `features.pagefind.enabled`）：压缩与 cacheBust 之后生成到 `features.pagefind.indexPath`（默认 `/pagefind`，不参与 cache-bust）；serve/watch 同样生成。

构建缓存：`.build-cache.json`（媒体指纹）、`.cache/media`（媒体输出持久副本）、`.cache/og`（OG 图）、`.cache/mermaid`（mermaid SSR SVG，键 = 版本+主题+源码哈希）、`.cache/fonts`（CJK 字体清单与 woff2 分片，URL 哈希命名）。自定义输出目录：`--out` / `SYNAPSE_OUT_DIR`（集成测试使用）。

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
- 构建侧缓存：媒体/OG 指纹命中跳过重算；配置 JSON 以内容哈希命名参与 cache-bust。
- 压缩验证缓存：`.cache/compression-baseline/`（验证期基线快照，默认验证后删除）、`.cache/compression-verify/last.json`（结果 JSON）、`.cache/chrome-verify-profile/`（持久浏览器 profile，可安全删除；同一时刻只允许一个构建使用）。

## 8. 测试与门禁

| 命令 | 内容 |
|---|---|
| `npm test` | node:test 单测（构建纯函数、Worker 配置、CSP、机器人、原子写、配置分层、打包、dist 哈希、压缩配置/流水线/验证、CSS 合并、增量构建等） |
| `npm run test:coverage` | `scripts/lib` 行覆盖率门禁（≥80%，CI 阻断） |
| `npm run test:build` | 集成 smoke：干净构建断言产物 + 坏文章阻断且不污染 dist（临时输出目录；含 report.txt/CSP nonce 两态断言） |
| `npm run test:fuzz` | 属性/随机测试：`scripts/**/*.fuzz.test.js`（fast-check；`FC_NUM_RUNS` 默认 100、`STRESS=1` 开海量用例；种子见 `scripts/lib/test-random.js`，失败留档 `build-artifacts/fuzz-failures/`；默认单测不含 fuzz） |
| `npm run test:smoke` | 浏览器冒烟：真实构建 + 系统 Chrome 代表页（200/标题/DOM/零控制台错误），摘要 `build-artifacts/web-smoke/summary.txt`；无 Chrome 跳过 |
| `npm run test:cov-web` | 无头 Web 覆盖率：`--no-bundle` + 压缩关闭构建，CDP 精确覆盖聚合 `js/**` 行/函数覆盖（阈值 `scripts/lib/web-coverage-thresholds.js`，首测定档 55%/55%），输出 `build-artifacts/web-coverage/{summary.txt,coverage.json}`；无 Chrome 跳过 |
| `npm run test:all` | 本地与 CI 同强度：`npm test` + `test:build` + `test:fuzz` + `test:malicious` + `test:smoke` + `test:cov-web` + `verify:internals` 串行；夜间深度档见 `nightly.yml`（`FC_NUM_RUNS=2000` + `STRESS=1` + 随机种子） |
| `npm run lint` / `npm run typecheck` | ESLint / tsc（checkJs） |
| `npm run verify:config` / `verify:config-refs` / `verify:config-dupes` / `verify:config-comments` / `verify:config-docs` | 配置一致性 / 零引用键 / 重复键 / 逐键注释覆盖率 / 文档覆盖监守（`scripts/check-config-docs.js`） |
| `npm run verify:internals` | `.nvmrc` / `workers/wrangler.toml` assets 目录 / CI 版本与 `internals.json5` 单源守卫（关键写死形态抽样） |
| `npm run verify:process-guards` | 进程守护巡检（高风险入口 `process-guard` 接入的静态检查；CI 聚合执行） |
| `npm run verify:security` | 安全集成回归（注入恶意文章 → 构建 → 语义断言） |
| `npm run verify:compression` | 压缩无头对比门禁（6 页 DOM/采样样式/控制台/交互断言；无 Chrome 跳过） |
| `npm run sbom` | CycloneDX 1.5 SBOM 生成（CI 上传 artifact） |
| `npm run audit` / `npm run audit:a11y` | 依赖漏洞（官方 registry）/ 真实页面 a11y（puppeteer + axe，含 wcag22aa） |
| `node scripts/dist-hash-guard.js` | 重构/迁移的产物等价护栏（归一化 nonce/换行） |
| `node scripts/perf-audit.js` | 可复现性能基线（Slow 4G + 4× CPU） |

CI（`.github/workflows/deploy.yml`）：`check-agents`（AGENTS.md 变更检测）→ `compat-node20`（Node 20.19.0：test + verify:config + verify:config-refs + verify:config-dupes + verify:internals + test:build + build）与 `build`（Node 版本由 `.nvmrc` 经 `node-version-file` 单源控制；`node scripts/ci-env.js` 导出 internals → 单步 `node scripts/ci-checks.js` 跑完整套并统一失败：lint / typecheck / test / test:coverage / test:build / test:fuzz / test:malicious / verify:config 家族（config/refs/dupes/comments/docs 与 verify:internals）/ verify:process-guards / verify:security / test:smoke / test:cov-web / verify:compression / build / sbom；`audit` 与 `audit:a11y` 为建议项（入报告不阻断）；报告写 `build-artifacts/ci-report.{json,txt}` → 始终上传 `ci-report` 与 `test-artifacts` → Pages 部署（`npm run deploy:pages`，部署前 verify:internals））。夜间随机深度档（`.github/workflows/nightly.yml`，UTC 18:00 + `workflow_dispatch`）用同一聚合器（`FC_NUM_RUNS=2000`、`STRESS=1`），上传 `nightly-test-artifacts`。生产 Worker 为手动 `wrangler deploy`（见 README）。预检作业（`preflight`，`scripts/ci-skip.js`）在 HEAD 未变化的重复运行上按连击阈值（连错 2/连净 5，告警中性）自动跳过，`workflow_dispatch`/`CI_FORCE`/`[ci force]` 强跑；聚合检查带每项超时并清理进程树，结论以提交状态 `ci/aggregate` 供下一次判定读取。`.github/workflows/release.yml` 独立处理 tag 发布（见 §9.1）。

## 9. 部署与回滚

- 生产：`npm ci && npm run build && npx wrangler deploy --config workers/wrangler.toml --env production`（Worker `blog`）。
- 回滚：`wrangler deployments list` → `wrangler rollback <id>`（脚本 + 资产整体回退）；详见 `docs/runbook/rollback.md`。
- real-site：本地生产副本，含真实数据，永不入库；主仓库为代码事实源，同步方式见 README「派生副本与回滚」。

### 9.1 Release 发布工作流

- **完成标记**：`npm run release:mark`（`scripts/release-mark.js`）在干净工作区上顺序执行 `RELEASE_GATES`（12 项门禁，单一来源 `scripts/lib/release-version.js`）→ 同步 package.json/lock 版本 → CHANGELOG `[Unreleased]` 内容归入 `[X.Y.Z] - 日期` → 生成 `RELEASE.json`（status=verified、checks 全 true、commit=被核验提交即 tag 的父提交）→ 单提交 `chore(release)` + 附注 tag `vX.Y.Z`；默认不 push，推送需 `--push --confirm-push` 二次确认。
- **双重校验**：根 `RELEASE.json` 是机器可读完成标记（初始 `unverified`，默认拒绝发布）；`scripts/lib/release-validate.js` 校验 status/version/tag/commit/checks/verifiedAt，只有「tag 存在」且「tag 指向提交内的标记自洽」同时成立才允许创建 Release。
- **归档白名单**：`scripts/lib/release-manifest.js` 为唯一来源（包含/排除清单与理由）；`scripts/release-archive.js` 用 `git archive` + pathspec 生成 `S-ynapse-<版本>.zip`，再解析 zip 中央目录逐条复核（`assertArchiveContents`），越界或缺少必需文件即失败。
- **自动发布**：`.github/workflows/release.yml` 仅由 `push tags v*` 触发（validate → gates → publish：`gh release create --verify-tag` 附 zip）；`deploy.yml` 触发条件限定 `branches: [main]`，tag 推送不会误触发站点部署。
- **本地备用通道**：`npm run release:publish -- vX.Y.Z`（远端 tag 存在 + 同一套校验 + `gh`）；完整流程与排障见 `docs/runbook/release.md`。

## 10. 已知边界与后续项

- `scripts/build.js` 已完成机械拆分（约 423 行编排器 + `scripts/build/` 工厂模块；等价护栏 `scripts/dist-hash-guard.js` + `.refactor-baseline.json`）。
- `js/domains` 已按 core（20 模块）/features（32 模块）/guard（13 模块）物理分层（`deferred.js` 统一注册表）。
- `style-src` 已随 `<style>` nonce 注入消除 `'unsafe-inline'`；模板与构建产物亦已清除全部内联 `style="..."` 属性（类 / 构建期 nonce `<style>` 规则 / CSSOM 三种手法），`style-src-attr` 不再声明，属性语境回退到 `style-src` 同样拒绝内联（见 SECURITY.md）。Worker 无构建产物时的 FALLBACK 因无 nonce 可注入而保留 `style-src 'unsafe-inline'`，`script-src` 已同步收紧。
- 增量构建（`features.incrementalBuild`）已实现：`scripts/lib/incremental.js` 指纹与跳过决策 + `scripts/build/*` 逐页复用产物；方案见 `docs/incremental-build-design.md`。
- accessGate 为软防护；`?key=`/`?guard=` 参数在判定/解锁读取完成后经 `history.replaceState` 从地址栏清理（保留其它查询串与 hash），但不改变其可被绕过的事实。
- 开发服务器支持进程看门狗（`SYNAPSE_SERVE_PARENT_PID` / `SYNAPSE_SERVE_IDLE_MS`，`scripts/build/serve.js`），工具脚本退出即回收；兜底清理 `node .tmp-scripts/kill-orphans.js`。
