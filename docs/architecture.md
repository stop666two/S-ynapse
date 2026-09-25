# S-ynapse 架构说明

> 本文档描述当前实现（2026-09-25）。目标平台：Cloudflare Workers（静态资产 + 安全脚本同版本部署）。
> 相关文档：`docs/config-reference.md`（配置逐字段）、`docs/incremental-build-design.md`（增量构建设计）、`docs/runbook/rollback.md`（回滚）。

## 1. 总体架构

```
articles/ media/ static/ + 13 个 JSON5 配置
        │
        ▼  npm run build（Node，scripts/build.js 编排）
   dist/（静态站点 + _headers + 404 + PWA + 搜索索引 + 哈希资源）
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
| `scripts/build.js` | 构建编排器（2286 行，仍在继续拆分）：配置装载/校验、页面生成、报告、serve |
| `scripts/build/*.js` | 已拆出的构建模块（工厂注入、无全局状态）：`minify` / `media` / `fs-utils` / `feeds` / `security-files` / `assets` |
| `scripts/lib/*.js` | 纯函数库：`utils` / `perf-budget` / `csp` / `content-policy` / `asset-cache` / `build-errors` / `content-validate` / `publish-window` / `config-split` / `bundle` / `dist-hash` 等（多数有同名单测） |
| `scripts/generate-og.js` | OG 图生成（独立进程，`.cache/og` 增量缓存） |
| `templates/*.ejs` | 页面模板（layout/index/post/archive/search/tag/category/404/PWA 等 15 个） |
| `js/core/` | 启动器：`runtime.js`（配置加载引导）、`boot.js`（阶段队列）、`main.js`（入口）、`deferred.js`（懒加载模块注册表） |
| `js/domains/{core,features,guard}/` | 46 个功能模块（core 14 关键 / features 21 延迟 / guard 11 防护；独立文件，按启动时机注册到 `main.js` 三队列或 `deferred.js`） |
| `workers/security-worker.js` + `workers/lib/` | 边缘安全层（`ip-utils` / `rate-limit`） |
| `workers/wrangler.toml` | 生产部署配置（Worker 名、assets 绑定、环境变量） |
| `*.json5`（根目录 13 个） | 站点/主题/功能/文案等配置，全部经 `verify:config` 校验 |

## 3. 构建管线

`npm run build` 主流程（`scripts/build.js#build()`）：

1. **配置装载与校验**：JSON5 读取 → `validateConfig` / `validateFeatures`（对齐 `site-defaults.js` / `features-schema.js`）→ 错误格式化输出。
2. **内容预校验**（`preflightContent`，写 dist 之前）：frontmatter 合法性、缺失媒体、重复 slug、未来日期。失败即阻断（`--allow-degraded` 可降级为告警）。
3. **产物准备**：`setupDist` 清理输出；`copyStatic` / `copyProtectedAssets` / `optimizeMedia`（sharp 多尺寸 webp/avif + LQIP，`.cache/media` 增量）。
4. **内容处理**：marked 渲染 → CJK 间距 → sanitize-html（白名单 + 媒体 URL 本地化）→ 代码高亮判定（`hasCode` 门控 Prism）；mermaid 代码块全站汇总后经 puppeteer-core 一次性构建期渲染为双主题内联 `<svg>`（`.cache/mermaid` 内容哈希缓存，消毒后注入 CSP nonce；失败或无 Chrome 的条目保留 `data-mm-pending` 并由客户端 vendor 回退）。
5. **打包**：esbuild 两段 chunk（`app.<hash>.js` / `deferred.<hash>.js`）+ `runtime.<hash>.js` 哈希单发；`--no-bundle` 可回退原生模块。
6. **页面与索引生成**：`generatePages`（文章/归档/标签/分类/自定义页/分页）→ RSS/JSON Feed → sitemap → 搜索索引（`.json` + pagefind 兼容清单）→ PWA → CJK 字体子集化（扫描 dist 页面与配置 JSON 的实际用字，仅下载命中的 Noto Sans SC woff2 分片并自托管，`.cache/fonts` 清单+分片缓存，失败仅告警并剥离引用）。
7. **交付层处理**：HTML/内联 CSS/JS 压缩 → cache-bust 映射 → `_headers`（安全头 + 分级缓存）→ CSP nonce 注入（内联脚本与响应头同 nonce）。
8. **报告与门禁**：性能预算 5 项、构建报告 `build-report.html`、失败汇总（任一失败默认退出码非 0）。
9. **OG 图**（生产构建）：`generate-og.js` 独立进程，`.cache/og` 命中复用。

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

- 13 个 JSON5：`site` / `theme` / `features` / `tuning` / `guard` / `ui-strings` / `navigation` / `sidebar` / `footer` / `security` / `content-policy` / `tag-aliases` / `friends`。
- 三层约束：`site-defaults.js`（默认值注册表）、`features-schema.js`（features 结构登记）、`scripts/check-config-consistency.js`（`verify:config`，允许用户值覆盖默认值）。
- 逐字段说明见 `docs/config-reference.md`；新增字段须三处同步（配置 + 注册表/结构 + 文档）。

## 6. 安全模型

| 层 | 机制 |
|---|---|
| 构建期 | sanitize-html 白名单（禁 `on*`/`style`/脚本类标签）、CJK 文本处理、媒体 URL 本地化、frontmatter / slug / 头值（RFC 7230 token、禁 CRLF）校验 |
| 响应头 | CSP（`script-src` 与 `style-src` 共用每构建一次性 nonce，均无 `unsafe-inline`；内联 `style="..."` 属性由 `style-src-attr 'unsafe-inline'` 放行；`frame-ancestors 'none'` + XFO 双保险）、HSTS、Referrer-Policy 等 |
| Worker | `CF-Connecting-IP` 单源信任、路径限制（解码 + 点段折叠）、限流（fail-closed；跨 isolate 局限见 SECURITY.md）、HTTPS 强制、维护模式、CSP 上报（限流 + 16KB 上限） |
| 日志 | JSON Lines + `X-Request-Id`；IP 仅 HMAC 哈希（`LOG_IP_SECRET`；未配置时为固定盐，可枚举） |
| 前端软防护 | accessGate 等 guard 模块仅防误入，可被绕过，不得作为访问控制（见 SECURITY.md） |

## 7. 缓存策略

- `_headers` 分级：`/assets/css/*` 1 年 immutable；`/assets/js/*` 与 `/assets/vendor/*` 1 小时 + SWR；带指纹的 `app|deferred|runtime.*.js` 1 年 immutable；`/media/*`、`/og/*` 7 天 + SWR（均可用 `site.build.cacheControl` 关闭）。
- 构建侧缓存：媒体/OG 指纹命中跳过重算；配置 JSON 以内容哈希命名参与 cache-bust。

## 8. 测试与门禁

| 命令 | 内容 |
|---|---|
| `npm test` | node:test 单测（构建纯函数、Worker 配置、CSP、机器人、原子写、配置分层、打包、dist 哈希等） |
| `npm run test:build` | 集成 smoke：干净构建断言产物 + 坏文章阻断且不污染 dist（临时输出目录） |
| `npm run lint` / `npm run typecheck` | ESLint / tsc（checkJs） |
| `npm run verify:config` / `npm run verify:security` | 配置一致性 / 安全产物与 Worker 行为验证 |
| `npm run audit` / `npm run audit:a11y` | 依赖漏洞（官方 registry）/ 真实页面 a11y（puppeteer + axe，含 wcag22aa） |
| `node scripts/dist-hash-guard.js` | 重构/迁移的产物等价护栏（归一化 nonce/换行） |
| `node scripts/perf-audit.js` | 可复现性能基线（Slow 4G + 4× CPU） |

CI 顺序：check-agents → `npm ci` → audit → lint → typecheck → test → verify:config → verify:security → build → test:build → Pages 部署（Worker 为手动 `wrangler deploy`，见 README）。

## 9. 部署与回滚

- 生产：`npm ci && npm run build && npx wrangler deploy --config workers/wrangler.toml --env production`（Worker `blog`）。
- 回滚：`wrangler deployments list` → `wrangler rollback <id>`（脚本 + 资产整体回退）；详见 `docs/runbook/rollback.md`。
- real-site：本地生产副本，含真实数据，永不入库；主仓库为代码事实源，同步方式见 README「派生副本与回滚」。

## 10. 已知边界与后续项

- `scripts/build.js` 已完成机械拆分（265 行编排器 + `scripts/build/` 工厂模块；等价护栏 `scripts/dist-hash-guard.js` + `.refactor-baseline.json`）。
- `js/domains` 已按 core（14 关键）/features（21 延迟）/guard（11 防护）物理分层（`deferred.js` 统一注册表）。
- `style-src` 已随 `<style>` nonce 注入消除 `'unsafe-inline'`；残余面为 `style-src-attr 'unsafe-inline'`（属性语境无法用 nonce，见 SECURITY.md）。Worker 无构建产物时的 FALLBACK 因无 nonce 可注入而保留 `style-src 'unsafe-inline'`，`script-src` 已同步收紧。
- 增量构建（`features.incrementalBuild`）为预留键位，未实现；方案见 `docs/incremental-build-design.md`。
- accessGate 为软防护；`?key=`/`?guard=` 参数在判定/解锁读取完成后经 `history.replaceState` 从地址栏清理（保留其它查询串与 hash），但不改变其可被绕过的事实。
