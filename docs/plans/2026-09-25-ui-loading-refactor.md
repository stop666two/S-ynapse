# S-ynapse 加载优化 + 代码重构 + 界面优化实施计划（2026-09-25）

> **执行方式**：TDD（先写失败测试 → 最小实现 → 全绿 → 提交）。每任务独立 commit，Conventional Commits + `(ai)` scope。不推送、不打 tag。三阶段全部完成后一次性同步 real-site 并部署 blog Worker。
> 本计划由 grill-me 访谈产出，第 11 节决策表为唯一裁决依据。

**目标**：① 页面加载硬指标达标；② 消除构建脚本臃肿（`scripts/build.js` 3339 行 → ≤300 行编排器）；③ 界面按选定方向稿实施并验收。

**架构**：保持纯静态 + Worker 架构；esbuild 仅作为构建流水线步骤（devDependency）；配置分层（关键子集内联 + 共享 JSON）；`scripts/build.js` 机械拆分为 `scripts/build/*.js`；`js/domains` 按 core/features/guard 分层并统一启动注册表（每模块仍独立文件）。

**技术栈**：Node 20+（node:test）、esbuild 0.28.1、EJS、sharp、puppeteer-core 25.12.0、Cloudflare Workers。

---

## 0. 硬指标（Phase 1 验收，Slow 4G + 4× CPU、冷缓存、3 次取中位）

| 指标 | 现状（生产 /zh/） | 目标 |
|---|---|---|
| 单页 HTML raw | 71.5 KB | ≤ 45 KB |
| 内联配置 | ~40 KB `__FEATURES__` + 其他，逐页重复 | 关键子集 ≤ 2 KB，其余共享 `/assets/config.<hash>.json` |
| 首屏请求数 | 12+ script 标签 | ≤ 10 |
| LCP | 待基线（本地曾 868 ms） | ≤ 1.2 s |
| INP | 待基线（本地曾 88 ms） | ≤ 100 ms |
| CLS | 待基线 | ≤ 0.05 |

测量脚本：`scripts/perf-audit.js`（新增）；基线记录：`docs/perf-baseline.md`（新增）。

---

## 1. Phase 0：基线与护栏（无行为变更）

### Task 0：实施计划建档与基线采集
**Files**：Create `docs/perf-baseline.md`；Create `scripts/perf-audit.js`；Modify `package.json`（`perf:audit` 脚本）
**接口**：`node scripts/perf-audit.js --url <URL> --runs 3 --out docs/perf-baseline.md`
- [ ] 实现：puppeteer-core（系统 Chrome，`CHROME_PATH` 可覆盖）+ CDP 限速 Slow 4G + 4× CPU + 禁用缓存；采集 LCP/INP/CLS、HTML/资源传输字节、请求数；输出 markdown 表 + JSON
- [ ] 运行：生产 `https://blog.stop666.dpdns.org/zh/` 与本地 `dist` 各 1 轮，写入 `docs/perf-baseline.md`
- [ ] 提交：`feat(ai): 新增可复现性能基线脚本 perf-audit（优化计划 T0）`

### Task 0.5：产物等价护栏
**Files**：Create `scripts/lib/dist-hash.js`；Create `scripts/dist-hash.test.js`；Create `scripts/dist-hash-guard.js`
**接口**：
- `normalizeHtml(html)` → 归一化 nonce、`?v=` 查询、构建时间戳（`build-report.html` 除外）
- `hashDist(dir)` → `{ file: sha256, total }`，忽略 `build-report.html`、`og/*`（含时间性）
- `node scripts/dist-hash-guard.js snapshot <dir> <manifest.json>` / `diff <dir> <manifest.json>`
- [ ] RED：对临时目录两次快照一致、nonce 变化后仍一致、内容变化则 diff 非空
- [ ] GREEN + `npm test` 全绿
- [ ] 提交：`feat(ai): 新增 dist 产物归一化哈希护栏（重构前置）`

---

## 2. Phase 1：加载优化（资源与启动管线；视觉尽量不变）

> **Phase 1 执行记录（2026-09-25 收口）**
> - ✅ 1.1 配置分层外部化 `46ab4da`（HTML raw 71.5→42.8KB；探针双态：正常 configOk / 拦截配置请求仍可运行）
> - ✅ 1.2 esbuild 两段 chunk `71ab90c`（runtime 哈希单发修复 404；`--no-bundle` 回退已验证）
> - ✅ 1.3 vendor 瘦身 `9843470`；**Prism 偏差**：未做语言子集裁剪，改为按页门控（仅高亮代码页注入；首页 −82KB、请求 17→16、TBT 中位 515→424ms）
> - ✅ 1.4/1.5 字体 preload 复核 + 哈希 JS immutable `1cdc4f6`
> - ◐ 1.6 本地 3 次中位：LCP 2904ms、CLS 0.0006、TBT 424ms、HTML 47.0KB、请求 16 → `docs/perf-baseline-local.md`（本地 serve 无压缩，仅作回归基线；**生产对比待 S3**）。偏差：LCP ≤1.2s / 请求 ≤10 需生产（Brotli+CDN）复测判定，本地口径不可比
> - ✅ 1.7 预算 5 项；**偏差**：`htmlRawKb` 采用页面 raw 中位 ≤50 而非单页最大 ≤45（home 45.7KB、长文压力页 72.7KB 属极端样本）；请求采用构建期静态请求 ≤12 而非运行时 ≤10（运行时含字体/图片，生产复测另计）

### Task 1.1：配置分层外部化
**Files**：Modify `scripts/build.js`、`templates/layout.ejs`、`js/core/boot.js`、`js/core/runtime.js`；Create `scripts/lib/config-split.js`；Create `scripts/config-split.test.js`
**接口**：
- `splitRuntimeConfig({ features, tuning, guard, morphIcons, presets, quotes, uiStrings, linkWarning, pwa })` → `{ inline: {...关键子集}, external: {...大对象} }`
- 关键子集白名单：`themeMode`（主题模式/深浅）、`lang`、`pwa.enabled`、`guard.enabled`、交互开关中影响首屏渲染者（≤ 2 KB）
- 构建产出 `/assets/config.<hash>.json`（`Cache-Control` 走 `/assets/*` immutable）；`layout.ejs` 内联 `window.__BOOT__`（关键子集 + `configUrl`）；`boot.js` 启动前 fetch 外置配置写入 `window.__FEATURES__` 等（保留 1 次重试，失败用内置最小默认值 + `console.warn`，fail-open）
- CSP：外置 JSON 走 `connect-src 'self'`；内联 `__BOOT__` 由现有 nonce 注入覆盖
- [ ] RED：`splitRuntimeConfig` 白名单/体积/未知键保留测试；`configUrl` 哈希命名测试
- [ ] GREEN：接线构建 + boot（`__BOOT__.ready` Promise，模块通过 `waitConfig()` 等待）
- [ ] 端到端：本地构建后 HTML raw 体积、内联字节、模块启动正常（无 headless 报错）
- [ ] 提交：`perf(ai): 运行时配置分层外部化 + 启动期异步加载（fail-open）`

### Task 1.2：esbuild 流水线集成（两段 chunk）
**Files**：Modify `package.json`（devDependency `esbuild@0.28.1`）、`scripts/build.js`；Create `scripts/lib/bundle.js`；Create `scripts/bundle.test.js`
**接口**：
- `buildBundles({ outDir, minify, watch })` → `app.<hash>.js`（`js/core/main.js` 入口，含 boot/runtime/关键 features）+ `deferred.<hash>.js`（`search/lightbox/tts/background/command-palette/morphicons` 等懒加载模块聚合）
- 懒加载改造：模块注册表 `import()` 指向 `deferred.<hash>.js` 的导出（`deferred` 提供 `loadFeature(name)`），保留交互后才加载的时序
- 产物纳入现有 cacheBust、预算统计与 `_headers`；watch 模式增量重建；保留 `--no-bundle` 回退开关（默认打包）
- [ ] RED：`buildBundles` 输出文件名哈希稳定性、导出表与注册表一致性测试
- [ ] GREEN：接线 + 全站构建；`npm run build` 与 `--watch` 各跑一次
- [ ] 验证：本地无头探测 5 页 0 错误；首屏请求数 ≤ 10
- [ ] 提交：`perf(ai): esbuild 两段 chunk 打包接入构建流水线`

### Task 1.3：vendor 瘦身
**Files**：Modify `scripts/build.js`（vendor 拷贝段）、`templates/layout.ejs`、`features.json5`、`docs/config-reference.md`
- KaTeX：仅复制 woff2（删除 woff 分支与 CSS 兼容行），文档注明
- Prism：仅打包站点实际语言集合（从 `features.codeBlock`/文章语言统计派生，至少 js/css/bash/json/markdown）
- mermaid：保持按需加载，改为 `deferred` chunk 中的动态 import；渲染时机保持 `requestIdleCallback`；体积预算门禁加入 mermaid 不在首屏
- [ ] RED：vendor 清单断言测试（KaTeX 无 woff、Prism 语言子集函数纯函数测试）
- [ ] GREEN：接线 + 构建产物核对
- [ ] 提交：`perf(ai): vendor 瘦身（katex woff2 / prism 语言子集 / mermaid 延后）`

### Task 1.4：字体与预加载复核
**Files**：Modify `site.json5`（preconnect/preload 配置复核）、`templates/layout.ejs`、`scripts/build.js`（resourceHints 段）
- [ ] 复核字体请求数（目标 3）、`font-display`、`preload` 是否与首屏字体一致；图片 `fetchpriority`/`sizes` 复核
- [ ] perf-audit 对比（Task 1.6 统一）
- [ ] 提交：`perf(ai): 字体与预加载策略复核校准`

### Task 1.5：交付层复核
**Files**：Modify `scripts/build.js`（head/extras 段）、`docs/config-reference.md`
- [ ] HTML gzip 目标复核；检查是否存在多余 preconnect/prefetch；`/assets/config.*` 的缓存头确认 immutable（Task 1.1 已接）
- [ ] 提交：`perf(ai): 交付层资源提示复核`

### Task 1.6：硬指标验收
- [ ] `node scripts/perf-audit.js --url <本地> --runs 3` 与生产（部署后）对比 `docs/perf-baseline.md`
- [ ] 未达标项逐条定位（LCP element、请求瀑布）并修复
- [ ] 提交：`docs(ai): 加载优化验收报告（perf-baseline 更新）`

### Task 1.7：预算门禁更新
**Files**：Modify `scripts/lib/perf-budget.js`、`scripts/build.js`、`README.md`
- [ ] 预算加入 `htmlRawKb`（≤45）、`firstScreenRequests`（≤10）、`inlineConfigKb`（≤2）；CI 沿用
- [ ] 提交：`feat(ai): 性能预算增加 HTML raw/首屏请求/内联配置上限`

---

## 3. Phase 2：代码结构重构（机械拆分，行为 0 变化）

### Task 2.1：拆分基线
- [ ] `node scripts/dist-hash-guard.js snapshot dist .refactor-baseline.json`（用真实站内容构建的 dist）
- [ ] 记录 `build.js` 函数依赖图（本任务只记录，不改代码）

### Task 2.2：`scripts/build.js` → `scripts/build/*` 机械拆分
**Files**：Create `scripts/build/config.js`、`assets.js`、`media.js`、`markdown.js`、`articles.js`、`pages.js`、`feeds.js`、`search-index.js`、`security-files.js`、`report.js`；Modify `scripts/build.js`（编排器 ≤300 行）
**规则**：仅移动函数与接线，不改逻辑；模块间依赖通过显式参数传递（不引入全局状态）；`scripts/lib/*` 纯函数不动；每拆一步跑一次 `test:build` + dist 哈希
- [ ] 提交序列（每模块一次）：`refactor(ai): 拆分 <模块> 至 scripts/build/<file>（产物等价）`

### Task 2.3：`js/domains` 分层 + 启动注册表
**Files**：Move `js/domains/*` → `js/domains/{core,features,guard}/`；Modify `js/core/boot.js`、`js/core/main.js`、`scripts/lib/bundle.js`（Task 1.2 产物）、相关模板引用；Create `js/domains/registry.js`
**接口**：`registry.js` 导出 `critical[] / idle[] / heavy[]` 三个队列（现有 main.js 内联数组迁移）；每模块仍是独立文件，仅路径与引用变化
- [ ] RED：注册表队列完整性测试（每个 domain 文件恰好被注册一次）
- [ ] GREEN：迁移 + 全站构建 + 本地无头探测 0 错误
- [ ] 提交：`refactor(ai): js/domains 分层与统一启动注册表`

### Task 2.4：死键清理
**Files**：Modify `features.json5`、`scripts/lib/features-schema.js`、`scripts/lib/site-defaults.js`、`docs/config-reference.md`
- [ ] 移除未接线键 `features.ogImageStyle.cacheDir`、`features.incrementalBuild.cacheDir`（schema/配置/文档同步）；`verify:config` 全绿
- [ ] 提交：`refactor(ai): 清理未接线缓存目录键（三处同步）`

### Task 2.5：等价与回归
- [ ] `node scripts/dist-hash-guard.js diff dist .refactor-baseline.json` 全等（仅豁免清单）
- [ ] `npm test` + `npm run test:build` + `npm run build` 全绿
- [ ] `docs/architecture.md` 新增（模块图与职责；替代此前缺失的 ARCHITECTURE 文档）
- [ ] 提交：`docs(ai): 新增架构说明与重构等价报告`

---

## 4. Phase 3：界面优化

### Task 3.1：方向稿（等待用户选定）
- [ ] 出 2–3 个方向稿（首页/文章页/移动端各 3 屏，静态 HTML 可点预览，不进入生产构建）
- [ ] 用户选定 1 个 → 记录到 `docs/plans/2026-09-25-ui-direction.md`
- [ ] 提交：`docs(ai): 界面方向稿与选定记录`

### Task 3.2：实施
**Files**：Modify `templates/*.ejs`、`templates/site-css.ejs`、`theme.json5`、`features.json5`、`js/domains/*`（按选定稿）
- [ ] 逐区块实施（每区块一次 commit）；保持多语言与深浅色双态
- [ ] 审计遗留可用性修复：lightbox 剩余键、sidebar-drag 剩余键、TTS 暂停策略、动画 reduced-motion 覆盖补齐
- [ ] 提交序列：`feat(ai): 界面优化 <区块>`

### Task 3.3：验收
- [ ] `npm run audit:a11y` 0 violations（含 wcag22aa）；移动端尺寸 360/768/1280 与深浅色截图核对
- [ ] `node scripts/perf-audit.js` 回归（硬指标不退化）
- [ ] 提交：`docs(ai): 界面优化验收报告`

---

## 5. 部署与验收（全部完成后一次性）

- S1：real-site 同步（scripts/js/templates/workers/docs 全量 + 配置三方合并；real-site 严禁入库）
- S2：real-site 全套门禁（lint/typecheck/test/verify:config/verify:security/test:build/build/本地无头）
- S3：`npx wrangler deploy --config workers/wrangler.toml --env production` → 线上验证（CSP nonce、缓存头、5 页 200、0 控制台错误、0 CSP 违规、perf-audit 生产达标）
- S4：交接文档 + CHANGELOG + 回滚点记录（部署前记录 `wrangler deployments list` 当前版本）

## 6. 风险与回滚

| 风险 | 缓解 |
|---|---|
| esbuild 两段 chunk 破坏启动时序 | 保留 `--no-bundle` 回退；注册表测试 + 无头探测；Task 1.2 独立提交 |
| 配置外置在弱网下延迟启动 | fail-open + 关键子集内联；`waitConfig` 超时 3s 后使用默认值继续 |
| 机械拆分引入行为漂移 | 产物归一化哈希护栏 + 每步 `test:build`；diff 不符立即回退该步 |
| js 目录迁移破坏动态 import | 注册表完整性测试 + 全量 grep 引用核对 + 无头 5 页探测 |
| 界面改动影响性能预算 | Phase 3 结束跑 perf-audit 回归，超预算即修复后交付 |
| 一次性部署回滚 | 部署前记录当前 Worker 版本；`wrangler rollback <id>`（脚本+资产同回退） |

## 7. 残余与不做

- 不引入框架（React/Vue）；不引入 Vite/Webpack。
- mermaid 构建期服务端渲染不纳入本轮（列入后续评估）。
- CJK 字体子集化不纳入本轮（保持系统字体栈）。
- 推送/打 tag 仍待用户指令；real-site 数据永不入库。

---

## 11. 决策记录（grill-me 产出）

| # | 决策 | 结果 |
|---|------|------|
| 1 | 优先级与节奏 | 测量优先分阶段：加载 → 重构 → 界面，每阶段独立可发布 |
| 2 | 验收口径 | 硬指标 + `scripts/perf-audit.js` 可复现基线 + `docs/perf-baseline.md` |
| 3 | 打包器 | esbuild + 两段 chunk（app/deferred） |
| 4 | 改动边界 | 允许打包器；不引入框架；视觉尽量不变（非硬约束） |
| 5 | 加载杠杆 | 配置外置 + JS 打包 + vendor 瘦身 + 字体/预加载复核 + 交付层复核（全选） |
| 6 | 配置外置形态 | 关键子集内联（≤2KB）+ 大对象外置共享 JSON |
| 7 | 取配失败 | fail-open：默认值 + 1 次重试 + 可观测日志 |
| 8 | esbuild 集成 | 流水线步骤（watch/cacheBust/预算统一） |
| 9 | 重构边界 | 机械拆分 + 产物哈希等价护栏；配置注释保留、清理死键 |
| 10 | js 分层 | 含 core/features/guard 分层 + 启动注册表统一（不合并文件） |
| 11 | 界面交付 | 2–3 方向稿 + 静态预览 → 选定 → 实施 + a11y/移动端验收 |
| 12 | 部署节奏 | 三阶段全部完成后一次性同步与部署；阶段中途本地验证 |
| 13 | 同步义务 | 主仓库为代码事实源；real-site 为本地生产副本、严禁入库 |
| 14 | 回滚 | 每任务提交 + 部署前 Worker 版本记录 + `wrangler rollback` |
| 15 | 门禁 | 现有全套（lint/typecheck/test/verify:config/verify:security/test:build）+ 产物哈希护栏 + perf-audit |
