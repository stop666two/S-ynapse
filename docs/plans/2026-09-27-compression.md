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

- **C1 配置层**：`compression.json5` + `scripts/lib/compression-config.js`（默认值、深合并、枚举校验、exclude 归一化）+ 单测；`verify:config` 纳入第 10 个配置文件；`docs/config-reference.md` 新增章节。
- **C2 压缩流水线**：扩展 `scripts/build/minify.js` 为压缩阶段执行器：HTML（minify-html 选项化）、CSS（CleanCSS × 合并去重）、JS（Terser × 可选混淆）、JSON（去空白）；豁免名单生效；全程 `recordBuildFailure` 接线 + 失败不阻断（fallback 原样）。
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
