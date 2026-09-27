# 构建产物压缩功能 实施计划

**目标**：新增根目录 `compression.json5`，对 `dist/` 产物执行可配置压缩：HTML/CSS/JS/JSON 压缩、CSS 同页合并去重、JS 可选混淆（默认关）、全量单行化与去注释；vendor 与报告文件豁免；全过程有门禁与自动回退。

**技术栈**：现有构建管线（Node + minify-html + CleanCSS + Terser），新增 `javascript-obfuscator`（仅混淆开启时使用，devDependency）。

## 一、需求决策（用户已确认）

| 维度 | 决策 |
|---|---|
| 配置文件 | 根目录 `compression.json5`，独立顶层模块，遵循「主配置管开关、子配置管参数」 |
| 作用范围 | 压缩 `dist` 的 HTML/JS/CSS/JSON；**vendor 豁免**；`report.txt` 与 `build-report.html` 不压缩 |
| JS 加密 | 「压缩 + 可选混淆（默认关）」：混淆用成熟方案（javascript-obfuscator 预设），仅自研 bundle，vendor 除外 |
| HTML 强度 | **成熟工具优先**：沿用 `minify-html`（业界最成熟）；实验性开启更激进选项，以无头回归门禁裁决，失败回退 |
| CSS | 压缩 + **合并同页 `<style>` 并去重**（保持层叠顺序） |
| JSON 产物 | 去空白，保持合法 JSON（search-index/config/feed） |
| WASM | **先出评估报告**（lightningcss vs CleanCSS、oxc-minify vs Terser 的基准：体积/耗时），批准前不动生产 |
| 校验与回退 | 压缩前后**无头对比断言**（DOM 结构/采样计算样式/控制台错误/交互冒烟）；失败自动回退未压缩产物并告警 |
| 目标 | HTML gzip −10%；JS −20%；构建 ≤8s（未达须给出实测差距与原因） |
| 生效 | `compression.enabled` 默认开；**serve/watch 自动关**（本地调试不受影响）；构建报告 `report.txt` 输出压缩前后对照 |

## 二、配置草案（落定为 JSON5 + 完整中文注释 + 校验）

```json5
compression: {
  enabled: true,
  html: { enabled: true, removeComments: true, collapseWhitespace: true },
  css:  { enabled: true, mergeInlineStyles: true, dedupe: true },
  js:   { enabled: true, minify: true, obfuscate: { enabled: false, preset: 'medium', seed: 0 } },
  json: { enabled: true },
  exclude: ['report.txt', 'build-report.html', 'assets/vendor/**', 'media/**', 'og/**',
            'assets/fonts/**', '**/*.woff2', '**/*.avif', '**/*.webp', '**/*.png', '**/*.jpg', '**/*.svg'],
  verify: { headless: true, fallbackOnFailure: true }
}
```

## 三、管线位置（关键约束）

压缩阶段必须位于 **cacheBust（内容哈希）之前**，保证「哈希 = 最终字节」；顺序：
`generatePages → minifyAll（含压缩/合并去重/混淆/JSON） → cacheBust → _headers/_redirects → 报告`。
`report.txt` 在报告阶段生成，天然豁免。

## 四、任务拆解

- **C1 配置层** ✅ 已完成（2026-09-27）：`compression.json5` + `scripts/lib/compression-config.js`（默认值、深合并、枚举校验、exclude 归一化）+ 单测；`verify:config` 纳入第 10 个配置文件；`docs/config-reference.md` 新增章节。
- **C2 压缩流水线** ✅ 已完成（2026-09-27，收口记录见「六、C2 进度与偏差」）：扩展 `scripts/build/minify.js` 为压缩阶段执行器：HTML（minify-html 选项化）、CSS（CleanCSS × 合并去重）、JS（Terser × 可选混淆）、JSON（去空白）；豁免名单生效；全程 `recordBuildFailure` 接线 + 失败不阻断（fallback 原样）。
- **C3 CSS 合并去重** ✅ 已完成（2026-09-27，收口记录见「七、C3/C4 进度与偏差」）：`scripts/lib/css-merge.js` 纯函数（合并 + 保守去重）+ 增强阶段接线 + 36 例单测 + 冒烟断言。
- **C4 JS 混淆** ✅ 已完成（2026-09-27，收口记录见「七、C3/C4 进度与偏差」）：`javascript-obfuscator` 5.8.0 惰性加载 + preset/seed 装配 + 白名单与内容寻址重命名 + 13 例单测 + 无头 runner（17 PASS）。
- **C5 门禁与回退** ✅ 已完成（2026-09-27，收口记录见「八、C5 进度与偏差」）：`compression.verify.headless` 时构建后跑关键页对比（压缩产物 vs 未压缩临时副本）：DOM 归一化哈希、采样元素计算样式、0 控制台错误、关键交互冒烟；不一致 → 用未压缩产物覆写 + `[WARN]` + 报告条目；`scripts/verify-compression.js` + CI 步骤。
- **C6 WASM 评估**：`docs/wasm-eval.md`（基准表：CleanCSS vs lightningcss、Terser vs oxc-minify 的体积/耗时；结论与建议），不动生产依赖。
- **C7 报告与文档**：`dist/report.txt`（构建时间、压缩前后体积对照 gzip/raw、节省率、告警、未达标项）+ CHANGELOG + README/架构文档更新。
- **C8 验收**：目标核对（HTML gzip −10%、JS −20%、≤8s）；无头全页回归（复用 a11y/softnav/搜索 runner 模式）；部署确认。

## 五、验收标准

1. 配置键全部真实生效（改配置 → 产物字节变化，可断言）。
2. vendor、report 文件字节与压缩前一致。
3. 无头对比 0 差异（或差异全部落入已声明豁免）；控制台 0 错误。
4. 压缩失败场景（构造超长/畸形输入模拟）自动回退且构建仍成功、报告有记录。
5. 目标体量达成，或附未达原因与后续路径。

## 六、C2 进度与偏差

**完成范围（2026-09-27）**

- 增强步骤实装两项：**HTML 激进选项装配**（`html.aggressive=true`，选项全部来自 `@minify-html/node` 0.18.1 真实 API，已核对 `index.d.ts`）与 **JSON 去空白**（扫描 dist `*.json`：仅重写含换行/缩进的文件；跳过 `assets/config.<hash>.json`（内容寻址，写入时即 `JSON.stringify` 紧凑——已核对 `scripts/build/pages.js`）、`compression.exclude` 命中项、已紧凑文件；单文件失败告警 + 保留原文件 + `recordBuildFailure`，不阻断构建）。
- 语义分层：基线压缩（minify-html / CleanCSS / Terser）恒定执行且不受本文件影响；增强步骤仅 `compressionActive`（非 serve/watch 且 `enabled=true`）时执行，全部先经 `isExcluded(distRelPath, exclude)`；位于 cacheBust 之前。
- 接线：`scripts/build/context.js` 加载/覆盖/降级/注入 `compression` 与 `compressionActive`；配置错误 → 告警 + 记录构建失败 + 降级内置默认值（不中止）；`--compression-override <path>` 深合并（仍过校验、不写仓库配置文件）。
- 测试与证据：`scripts/compression-pipeline.test.js`（24 例：JSON 纯函数 / 豁免与内容寻址跳过 / 选项装配 / 增强计划 / 覆盖深合并）；`scripts/build-smoke.test.js` 新增压缩关闭态第二态构建（vendor 与 `node_modules` 源逐字节一致、HTML nonce 归一化后逐字节一致、feed.json 开关真实生效且语义等价）。

**未完成项与偏差**

- CSS 合并去重（C3）与 JS 混淆（C4）按计划仅预留配置与计划标志（`cssMergeInlineStyles` / `cssDedupe` / `jsObfuscate` 系列），本波不执行；`js.obfuscate.enabled=true` 时构建输出 `[WARN]`。
- C5 无头门禁/自动回退、C6 WASM 评估、C7 报告体积对照与 README 重算、C8 验收目标核对未开始。
- 偏差 1：`--compression-override` 的解析落在 `scripts/build/context.js`（与 `--features-override`/`--theme-override` 既有模式一致——二者同样不经 `scripts/build.js` 独立解析），故 `scripts/build.js` 无新增解析代码。
- 偏差 2：`html.collapseWhitespace=false` 暂不受支持（minify-html 恒折叠安全空白且无对应配置项），配置为 false 时输出 `[WARN]` 并保持折叠；`html.enabled=false` 时不叠加 HTML 增强选项（注释移除回到基线行为）。
- 偏差 3：配置加载错误采用「降级默认 + 记录构建失败 + 告警」而非中止（与 C1 校验层 `errors` 语义及计划「失败不阻断」一致）；仅 `--compression-override` 文件缺失/解析错误按 features/theme 覆盖同模式 `[FATAL]` 中止。
- 验收对照（本波实测）：默认态与关闭态隔离构建——vendor 树跨态一致；84 个 HTML 页 nonce 归一化后 0 差异；`assets/config.*.json`、`search-index.json` 跨态一致；raw 总量默认态 −3.7KB（−0.021%）、gzip −80B（全部来自 2 份 feed.json 去空白）。C8 的 HTML gzip −10% / JS −20% 目标未在本波考核（基线压缩此前已达成主体收益；激进选项需 C5 裁决后放量）。

## 七、C3/C4 进度与偏差

**完成范围（2026-09-27）**

- **C3**：新增纯函数库 `scripts/lib/css-merge.js`（`mergeStyleBlocks` / `dedupeStyleBlocks` / `dedupeCss`）并接入压缩增强阶段（HTML 内联样式合并 + 页面与外链 CSS 保守去重，逐文件异常跳过并告警）；`scripts/css-merge.test.js` 36 例；`scripts/build-smoke.test.js` 跨态断言适配（移除 style 块后逐字节一致 + 开启态块数不多于关闭态 + 首页合并为单块且保留原首尾规则片段）。
- **C4**：`scripts/lib/compression-steps.js` 新增 `buildObfuscateOptions` / `selectObfuscationTargets`；`scripts/build/minify.js` 实装惰性混淆 + 按最终字节重命名 + HTML 引用改写；`build.js`/`context.js` 以活值注入本轮 bundle 白名单；`scripts/js-obfuscate.test.js` 13 例；无头 runner `.tmp-scripts/run-c4.js` 17 PASS / 0 FAIL（端口 3330，自收尾 + 释放校验）。
- **文档**：`docs/config-reference.md` §12 C3/C4 实装语义与「混淆代价与注意」；CHANGELOG Added 两条；本计划勾选。

**设计与偏差（相对任务书原文）**

1. **合并比任务书更保守**：跨 `<link rel=stylesheet>`（如数学页的 KaTeX 外链）不合并，避免内联块相对外链的层叠顺序反转；SVG 与 `<noscript>` 内的 `<style>` 不外提；被合并块必须同 nonce+media。后果：84 页中 80 页合并（×96 块），4 页因外链截断保持多块；`id=customCSS` 等非 nonce/media 属性在合并时丢弃（全仓无该 id 的消费方，冒烟断言已同步）。
2. **去重比任务书更保守**：「同属性重复保留最后一条」在 `!important` 与普通声明混合时会改变层叠结果（important 优先于顺序），因此仅对「同 important 状态」执行；非相邻重复、注释分隔的相邻重复、`@keyframes` 内部与 at-rule 结构一律不动。外链 CSS 也参与去重，但与基线 CleanCSS 语义一致只改内容不改名（`assets/**` 不参与 cacheBust）。
3. **C4 增加内容寻址重命名**：任务书要求「文件名哈希=最终字节」，而 esbuild 的 `[hash]` 在混淆后失效，故混淆后以 md5-10 重命名并同步改写全部 HTML 引用（app `src` 与 `window.__DEFERRED_URL__`；本次 84 页）。单文件失败保留原名原文件并告警。
4. **runtime 排除**（任务书第 4 条规则）：核实 `runtime.<source-sha1>.js` 不内联、以内容哈希命名并由 HTML 引用（参与内容哈希引用），混之违反哈希原则且让最小引导文件承担执行风险；故排除并在代码注释与 config-reference 记录理由。
5. **目标白名单 = 本轮 bundle 清单**（不是目录扫描）：避免增量构建残留的旧 `app.*.js` 被二次混淆；`--no-bundle` 时清单为空、自动跳过。
6. **medium 档实测代价**：app+deferred raw 189.6→253.3KB（+33.6%）、gzip 60.2→96.3KB（+59.9%）；构建 4.75→7.46s（<8s 目标）；本地 `/zh/` load 中位 180→327ms、JS 传输 61.1→97.2KB（供 C8 评估，非生产基准）。
7. **C3-only 中间态独立提交**：C3 接线在临时移除 C4 代码后单独通过 `test:build`（3/3）再提交，随后恢复 C4 完整实现并再次全量门禁。

**验收对照（本波实测）**

- 4 次 `--out` 构建：默认态（CSS 合并开/混淆关）、CSS 关闭对照（`--compression-override`）、混淆开启（medium + seed=20260927）、混淆复跑（确定性）；产物核对 24/24（合并块数/跨态 style 外内容一致/哈希=字节/引用一致/runtime 原文）。
- 门禁：`npm test` 545/545（93 suites）、`npm run test:build` 3/3、`npm run lint` 0 错、`npm run typecheck` 0 错、`verify:config` / `verify:config-refs` PASS。
- runner：`.tmp-scripts/run-c4.js` 17 PASS / 0 FAIL（0 控制台错误、软导航无刷新、deferred 动态 import、同 seed 确定性、端口 3330 释放）。

**未闭环（留待后续）**

- C5 无头门禁与自动回退未实装：`verify.headless` / `verify.fallbackOnFailure` 仍只是增强计划字段与配置文档承诺；混淆/合并异常当前策略为「跳过 + 告警 + 记录构建失败」（不阻断、不自动回退）。
- C7 报告未实装：C3/C4 统计输出在构建日志（合并块/去重/节省/混淆体积），尚未进入 `dist/report.txt`（该文件本身仍待 C7 创建）。

## 八、C5 进度与偏差

**完成范围（2026-09-27）**

- **快照与回退**：`scripts/lib/compression-verify.js`——`collectSnapshotTargets`（仅 HTML/CSS/JS/JSON）、`createBaselineSnapshot`（`.cache/compression-baseline`，原子复制 + 清单）、`restoreBaselineSnapshot`（覆写 + 删除增强孤儿 + 重建缺文件）、`compareSnapshotBytes`（逐字节 sha256 复核）。
- **无头断言**：`scripts/compression-verify-server.js`（静态服务子进程：root 优先 + 基线叠加层 fallback、端口 0 系统分配、打印端口行、看门狗 env 自退）+ `scripts/lib/static-server.js`（MIME/gzip/clean URL 解析抽取，serve.js 同步复用）。断言：静态页（关 JS）DOM 归一化结构 + 前 80 可见元素计算样式；JS 开启页逐页 0 控制台错误；压缩态交互冒烟；混淆开启追加运行时断言。结果写 `.cache/compression-verify/last.json`（含阶段耗时/端口/对比摘要）。
- **回退接线**：`scripts/build/minify.js` 在增强前快照、增强后 cacheBust 前验证；失败且 fallback=true → 回退 + `[WARN]` + `recordBuildFailure('compression-verify', …, { fatal:false })`（`scripts/lib/build-errors.js` 新增非阻断条目语义，构建尾部输出 `[WARNINGS]`）；false → 保留产物并阻断。Chrome 缺失/启动失败 → skipped 告警，构建不失败。
- **独立命令与 CI**：`scripts/verify-compression.js` + `npm run verify:compression`（passed=0 / failed=1 / skipped=0）；`deploy.yml` 构建后按 Chrome 探测条件执行。
- **C2 遗留修复**：compression 配置惰性加载 + `build()` try 内显式触发；watch 初始构建补齐 catch（缺失 `--compression-override` 不再退出监听，`--features-override`/`--theme-override` 本就在 loadConfig 的 try 内）。
- **测试与证据**：`scripts/compression-verify.test.js` 51 例；`npm test` 566/566（102 suites）、`test:build` 3/3、lint/typecheck/verify:config/verify:config-refs 全绿；runner `.tmp-scripts/run-c5.js` 23 PASS / 0 FAIL。

**设计与偏差（相对任务书原文）**

1. **验证时机**：任务书为「增强完成后、cacheBust 之前」，实测保持（回退后 cacheBust 对回退产物重算，哈希语义闭合）。
2. **基线采用「文本产物快照 + 叠加层服务」而非整目录复制**：快照只含 HTML/CSS/JS/JSON，基线服务器对未快照资产回退到压缩产物目录读取（这些资产本就不被增强触碰），避免复制 media/vendor 大目录。
3. **静态对比页关闭 JavaScript**：首版实现（JS 开启）在实测中捕获到运行时注入噪声（reveal 动画 `in` 类与内联 transition-delay、代码块工具栏 `data-cbbound/tabindex`、`speculationrules` 动态脚本）导致的 6 项假阳性；改为 JS 关闭的静态页做 DOM/样式对比，JS 运行时正确性由控制台错误与交互冒烟覆盖——压缩作用于静态字节，此隔离属压缩无关差异的显式归一化（代码注释与 config-reference 记录）。
4. **大 try 与逐字节复核**：回退后追加 `compareSnapshotBytes`；不一致升级为阻断失败（防止「回退本身损坏产物」静默通过）。
5. **测试钩子**：回退路径以 `SYNAPSE_COMPRESSION_VERIFY_CORRUPT=1` 注入真实 DOM 破坏（非 mock）；`SYNAPSE_COMPRESSION_BASELINE_KEEP=1` 保留快照供 runner 独立逐字节比对（assets 全树 + feed.json 共 22 文件一致）。
6. **Chrome 稳定性**：项目内持久 profile + `--no-proxy-server` + `browser.close` 超时强杀兜底（Windows 实测首导航/关闭偶发 10–75s，处理后验证稳定在 7–14s/次）。同一 profile 同时刻只允许一个构建使用（仓库构建串行）。
7. **CLI 退出码**：`failed` 即使构建已回退仍返回 1——构建内联门禁「不阻断」与显式门禁命令「如实报错」职责分离。
8. **非阻断记录**：构建失败收集器新增 `fatal:false`（`hasErrors` 只看致命条目），满足任务书「recordBuildFailure + 不阻断」的双重要求；`fallbackOnFailure=false` 时同 stage 走致命记录。

**验收对照（本波实测）**

- `npm run verify:compression`：PASS，6 页断言、端口释放、验证 7–14s（阶段耗时：静态 ~3–4s、运行时 ~5s、交互 ~4s）。
- runner 回退演示：注入破坏 → `status=failed`、`fallback={applied:true, restored:110, removed:0, bytesIdentical:true}`、构建 exit 0、破坏标记消失；基线快照与回退产物 assets+feed.json 22 文件逐字节一致。
- 关闭态不产出验证结果文件；看门狗空闲 4s 自退且端口释放；watch 覆盖缺失进程存活 ≥9s。

**未闭环（留待后续）**

- C7 报告未实装：验证摘要目前进入 `.cache/compression-verify/last.json` 与构建日志（`[WARNINGS]` 尾部），尚未进入 `dist/report.txt`/`build-report.html`；C8 目标考核（HTML gzip −10%、JS −20%、构建 ≤8s）受验证耗时影响需在 C8 中一并评估（本机验证 7–14s、构建基线压缩 ~8s）。
