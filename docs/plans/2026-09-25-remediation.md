# S-ynapse 审计修复实施计划（2026-09-25）

> **执行方式**：TDD（先写失败测试 → 最小实现 → 全绿 → 提交）。每项独立 commit，Conventional Commits + `(ai)` scope。不推送、不打 tag。

**目标**：修复 2026-09-25 首轮只读审计发现的 41 项问题，按 P0 → P1 → P2 顺序全量执行。

**架构**：延续现有模式——纯函数放 `scripts/lib/*.js` 并配 `scripts/*.test.js`（node:test），脚本负责接线；前端模块放 `js/domains/*`；安全双端（`_headers` + Worker）均由 `security.json5` 生成。

**技术栈**：Node.js（node:test）、EJS、sharp、json5、Cloudflare Workers/Pages。

## 全局约束（决策记录）

| # | 决策 | 结果 |
|---|------|------|
| 1 | 构建失败策略 | 默认硬失败（exit 1）+ `--allow-degraded` 逃生 |
| 2 | 失败时 dist 策略 | 先只读预校验（不过则不动 dist）；运行期失败硬失败并保留现场 |
| 3 | 新增校验 | 空标签→硬失败；缺失媒体→硬失败；未来日期→过滤+告警 |
| 4 | CSP | nonce 化 + 内联事件全部改写为监听器，移除 script-src 的 'unsafe-inline'；style-src 暂保留 |
| 5 | 构建缓存 | 键 = 源 mtime+size+配置哈希；清单 `.build-cache.json`（gitignore）；watch 模式跳过 OG |
| 6 | real-site | 保留 + 文档定源同步义务 |
| 7 | database.db | 保留不动 |
| 8 | 集成测试 | `--out`/`SYNAPSE_OUT_DIR` 支持临时输出；`npm run test:build` 进 CI，不进 `npm test` |
| 9 | 范围节奏 | P0→P1→P2 全量，逐项提交；上下文不足时 handoff 收尾 |
| 10 | 缓存头 | `/assets/*` 1y immutable；`/media/*`、`/og/*` 7d + stale-while-revalidate；HTML 不动 |
| 11 | a11y 门禁 | 页面列表从产物派生、断言 200、补 wcag22aa、CHROME_PATH 文档化 |

---

## P0 任务

### Task 1：构建错误收集器（`scripts/lib/build-errors.js`）

**Files**：Create `scripts/lib/build-errors.js`；Test `scripts/build-errors.test.js`
**接口**：
- `createBuildErrorCollector()` → `{ add(stage, message), entries, hasErrors }`
- `resolveExitCode(collector, { allowDegraded })` → `1 | 0`
- `formatFailures(entries)` → 多行字符串

- [ ] RED：测试空收集器、记录、exitCode 两态、格式化 → `node --test scripts/build-errors.test.js` 失败
- [ ] GREEN：最小实现
- [ ] 全量 `npm test` 通过 → `fix(ai): 新增构建错误收集器（审计 T1）`

### Task 2：只读预校验阶段 + 硬失败接线

**Files**：Create `scripts/lib/content-validate.js`；Test `scripts/content-validate.test.js`；Modify `scripts/build.js`
**校验集**：重复 slug → fatal；非法日期 → fatal；空 tag/category slug → fatal；引用缺失媒体 → fatal
**接线**：校验在 `setupDist()`（清 dist）之前执行；失败输出全部条目并以 exit 1 结束；`--allow-degraded` 降级为告警继续
- [ ] RED：纯函数 `validateContent(articles, { mediaExists })` 返回 `{ errors, warnings }`
- [ ] GREEN：实现并接线到 `build.js` 主流程前段
- [ ] 端到端：构造 `tags: [""]` 临时文章 → 构建 exit 1 且 dist 未被清空 → 删除临时文件
- [ ] 提交：`fix(ai): 构建前只读预校验与硬失败（审计 T1/F 系列）`

### Task 3：运行期失败接线（feed/sitemap/renderPage/媒体/OG/单篇）

**Files**：Modify `scripts/build.js`
- [ ] catch 分支统一写收集器；构建尾部 `process.exitCode = resolveExitCode(...)`
- [ ] 集成验证：临时破坏一个模板 → exit 1；恢复
- [ ] 提交：`fix(ai): 运行期构建失败不再静默放行（审计 F-1/F-2/F-3）`

### Task 4：未来日期文章过滤

**Files**：Modify `scripts/build.js`；Test `scripts/lib/publish-filter.test.js`（或并入 content-validate 测试）
- [ ] RED：`isPublished(article, now)` 纯函数：draft / 未来日期 / 正常三态
- [ ] GREEN：getPublished 统一接入；日志列出被调度文章
- [ ] 提交：`feat(ai): 未来日期文章按定时发布过滤（审计 F-11）`

### Task 5：Worker 空数组语义统一（SEC-6）

**Files**：Modify `workers/security-worker.js`、`scripts/generate-security-config.js`、`security.json5` 注释；Test `scripts/security-worker.test.js`
- [ ] RED：`pathRestrictions: []` 不应回退 `/admin/*`；`skipPaths: []` 不应回退默认
- [ ] GREEN：以 `undefined` 判定缺失，区分显式空数组
- [ ] 同步文档注释 → 提交：`fix(ai): Worker 空数组配置语义与文档一致（审计 SEC-6）`

### Task 6：安全头 CRLF/字符校验（SEC-7）

**Files**：Modify `scripts/generate-security-config.js`；Test `scripts/build.test.js` 或新测试
- [ ] RED：非法头名/含 `\r\n` 值应抛错并指明配置键
- [ ] GREEN：`validateHeaderEntries()` 构建期校验
- [ ] 提交：`fix(ai): 安全头名称与值构建期校验（审计 SEC-7）`

## P1 任务

### Task 7：点段路径折叠（SEC-2）

**Files**：Modify `workers/lib/ip-utils.mjs`；Test `scripts/security-worker.test.js`
- [ ] RED：`/media/%2e%2e/admin/x`、双重编码、`/a/./b` 用例
- [ ] GREEN：分段折叠 `.`/`..`，含未解析点段直接视为受限
- [ ] 提交：`fix(ai): 路径归一化折叠点段（审计 SEC-2）`

### Task 8：搜索入口守卫与弱网错误态（T5）

**Files**：Modify `templates/index.ejs`、`templates/layout.ejs`、`js/domains/search.js`
- [ ] `onclick="openSearch && openSearch()"`；fetch 超时 5s + 一次重试；错误态文案 + 重试按钮（i18n 键）
- [ ] 断网手测（构建 + 本地 serve）→ 提交：`fix(ai): 搜索入口守卫与索引加载错误态（审计 L-1/L-2）`

### Task 9：媒体/OG 增量缓存（T2）

**Files**：Create `scripts/lib/asset-cache.js`；Test `scripts/asset-cache.test.js`；Modify `scripts/build.js`、`scripts/generate-og.js`
- [ ] RED：缓存键/命中判定/失效纯函数
- [ ] GREEN：媒体与 OG 接线；`.build-cache.json` 加入 .gitignore；watch 跳过 OG
- [ ] 验证：二次构建媒体/OG 全部 skip → 提交：`perf(ai): 媒体与 OG 增量缓存（审计 T2/P-1/P-2）`

### Task 10：CSP nonce 化与内联事件改写（SEC-1）

**Files**：Modify `templates/*.ejs`（on* 属性）、`js/domains/*`（监听器）、`security.json5`、`scripts/lib/csp.js`、`scripts/generate-security-config.js`、`workers/security-worker.js`、`scripts/security-verify.js`
- [ ] 10a 内联事件改写为 data-attribute + 监听器（提交）
- [ ] 10b 构建期 nonce：HTML 可执行内联脚本注入 `nonce`，CSP 生成 `'nonce-...'`（_headers + Worker 同步）（提交）
- [ ] 10c 移除 script-src `'unsafe-inline'`，security-verify 更新断言（提交）

### Task 11：构建集成测试（F-6）

**Files**：Modify `scripts/build.js`（`--out`/`SYNAPSE_OUT_DIR`）、`package.json`（`test:build`）、`.github/workflows/deploy.yml`、新增 `scripts/build-smoke.test.js`
- [ ] 构建到临时目录 → 断言关键产物存在、exit 0；注入坏文章 → exit 1
- [ ] 提交：`test(ai): 构建管线集成测试（审计 F-6）`

### Task 12：缓存头（P-5）

**Files**：Modify `scripts/build.js`（`generateSecurityHeaders`）
- [ ] `_headers` 输出 `/assets/*` 1y immutable、`/media/*`+`/og/*` 7d s-w-r → 构建后人工核对 dist/_headers
- [ ] 提交：`perf(ai): 静态资产缓存头（审计 P-5）`

### Task 13：a11y 门禁修复（F-7）

**Files**：Modify `scripts/a11y-audit.js`、`.env.example`、`README.md`
- [ ] 页面列表从 dist 派生、断言 200、补 wcag22aa、CHROME_PATH 文档化
- [ ] 提交：`fix(ai): a11y 门禁覆盖与断言修正（审计 F-7）`

### Task 14：限流 fail-closed 与日志哈希 HMAC（SEC-3/SEC-8）

**Files**：Modify `workers/security-worker.js`、`workers/wrangler.toml`（vars 注释）、`.env.example`
- [ ] clientIP 缺失时仍按共享桶限流；`LOG_IP_SECRET` 存在时用 HMAC-SHA256，否则保持旧盐并文档告警
- [ ] 提交：`fix(ai): 限流 fail-closed 与日志哈希可配置密钥（审计 SEC-3/SEC-8）`

### Task 15：文档一致性（F-14/O-5/O-10）

**Files**：Modify `README.md`、`CHANGELOG.md`、新增 `SECURITY.md`
- [ ] 测试计数改为 144/30 口径；修正精确报告位置表述；新增安全策略文档（含 accessGate 软防护声明）
- [ ] 提交：`docs(ai): 文档计数与安全声明同步（审计 F-14/O-5/O-10）`

## P2 任务

### Task 16：前端流畅性批次（L-3/L-4/L-5/L-6/L-7/L-8/L-9/L-10/L-11/L-12）

**Files**：Modify `js/domains/reading.js`、`background.js`、`announcement.js`、`image-lazy.js`、`page-transition.js`、`tts.js`、`theme-schedule.js`、`code-block.js`、`boot.js`、`sidebar-drag.js`、`templates/site-css.ejs`、`features.json5`
- [ ] 滚动统一 rAF；粒子 `document.hidden` 暂停 + 移动端默认关；reduced-motion 补齐；TTS 心跳；Blob revoke ≥1s；配置接线修正
- [ ] 提交（可拆 2-3 次）：`fix(ai): 前端流畅性与配置接线批次（审计 L 系列）`

### Task 17：i18n 键补齐（F-10）

**Files**：Modify `ui-strings.json5`、`templates/archive.ejs`、`post.ejs`、`search.ejs`
- [ ] 补 `archive.textArticle`/`archive.heatmapSuffix` 及 zh/en 双语；静态可翻译文本改走服务端 `ui()`
- [ ] 提交：`fix(ai): i18n 缺键与英文残留（审计 F-10）`

### Task 18：仓库卫生（C-2/O-8/O-9）

**Files**：Modify `package.json`（chokidar → devDependencies）、`.gitignore`（exports/）、工作树 CRLF 文件
- [ ] `npm install` 同步锁文件；提交：`chore(ai): 依赖归类与仓库卫生（审计 C-2/O-8/O-9）`

### Task 19：发布回滚预案（O-11）

**Files**：Create `docs/runbook/rollback.md`
- [ ] 回滚命令、产物保留策略、数据回滚说明、演练步骤
- [ ] 提交：`docs(ai): 发布回滚预案（审计 O-11）`

### Task 20：收尾——real-site 定源说明（O-2）

**Files**：Modify `README.md`、`docs/handoff/`（新交接文档）
- [ ] 明确主仓库唯一事实源与同步命令（`git diff --no-index` 校验）
- [ ] 提交：`docs(ai): 多工作区定源说明（审计 O-2）`

---

## 回归验证计划

每任务：`npm run lint` + `npm run typecheck` + `npm test` + `npm run verify:config` + `npm run verify:security` 全绿；涉及构建的追加 `npm run build` 与产物断言；涉及安全的追加 Worker 集成测试。最终：全门禁 + `npm run test:build` + 浏览器端双态验证（待用户授权端口）。

## 回滚

每任务独立 commit，回滚粒度=单 commit（`git revert <sha>`）；不推送、不打 tag；重大变更前的 bundle 备份由用户确认后执行。

## 未纳入本轮（明确记录）

- SEC-3 完整迁移 Durable Object（本轮仅 fail-closed + 文档）
- P-3 watch 全量重建的增量渲染（成本高，单独立项）
- P-4 config JSON 外置化（涉及首屏时序，单独立项）
- D-6 生产环境动态验证（需部署后由用户执行）
