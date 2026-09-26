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
- **C3 CSS 合并去重**：抽取页面内多段 `<style>`（保留 nonce 与顺序）合并为单段；同文件内完全重复规则去重；跨文件不动；无头计算样式抽样对比。
- **C4 JS 混淆**：`javascript-obfuscator` 预设（medium 档）+ 固定 seed；仅 `app.*.js`/`deferred.*.js`/`runtime.*.js`；输出体积与执行耗时记录；默认关。
- **C5 门禁与回退**：`compression.verify.headless` 时构建后跑关键页对比（压缩产物 vs 未压缩临时副本）：DOM 归一化哈希、采样元素计算样式、0 控制台错误、关键交互冒烟；不一致 → 用未压缩产物覆写 + `[WARN]` + 报告条目；`scripts/verify-compression.js` + CI 步骤。
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
