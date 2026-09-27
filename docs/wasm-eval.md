# WASM 压缩器替换评估（C6）

> 评估对象：CSS `clean-css`（现状）vs `lightningcss`；JS `terser`（现状）vs `oxc-minify`。
> **本报告只做基准测量与结论建议，未切换任何生产依赖或构建逻辑**；`package.json` / `package-lock.json` 零改动（评估工具安装在隔离目录 `.cache/wasm-eval/tools`，已随 `.cache/` 忽略）。

## 1. 环境与样本

| 项 | 值 |
|---|---|
| 评估时间（UTC） | 2026-09-27T01:08Z |
| Node / npm | v26.7.0 / 12.0.2 |
| 系统 | Windows 10 x64（10.0.19045） |
| CPU | Intel Core i5-6400 @ 2.70GHz |
| 现状工具版本 | clean-css 5.3.3；terser 5.49.0 |
| 候选工具版本 | lightningcss 1.33.0；oxc-minify 0.151.0 |

**样本**：默认态 `node scripts/build.js --out .cache/wasm-eval/dist`（压缩增强开：CSS 合并去重、混淆关；构建 12.57s，无头验证关闭）产出的：

- CSS：`assets/css/cjk-fonts.css`（66,556B）、`assets/css/site.48f5eb1125.css`（127,817B）
- JS：`assets/js/app.OD3KGARL.js`（87,867B）、`assets/js/deferred.UDPPJ7QI.js`（97,938B）、`assets/js/runtime.48413ed284.js`（3,748B）

**方法**

- 直接调用官方 Node API（隔离安装），每工具每文件预热 1 次后计时 3 次取中位；`raw` 为输出字节数，`gzip` 为 `zlib.gzipSync(level=9)`；耗时单位 ms。
- 对照口径：CSS 基线为构建产物现值（即 CleanCSS level 2 输出），候选输出为在现产物之上的再压缩；同时用 CleanCSS/Terser 在完全相同的输入上重跑，保证耗时可比。
- 配置对齐：CleanCSS `{level:2}`；lightningcss `{minify:true}`，站点 CSS 额外测 `{errorRecovery:true}` 与「修正源缺陷后严格解析」两种路径；Terser `{module:true, compress:{drop_console:false}, mangle:{toplevel:true}, output:{comments:false}}`；oxc `{module:true, compress:true, mangle:true}`。

## 2. CSS 结果

| 样本 | 现状 raw / gzip | CleanCSS 重跑 | lightningcss | lightningcss 相对现状 |
|---|---|---|---|---|
| cjk-fonts.css | 66,556 / 23,210 | 66,556 / 23,210，38.92ms | 66,296 / 23,347，1.56ms | raw −0.39%、gzip +0.59% |
| site.48f5eb1125.css（严格） | 127,817 / 25,880 | 127,817 / 25,880，80.11ms | **解析失败**：`Invalid empty selector` @1:69363 | — |
| site…css（errorRecovery） | 同上 | — | 126,606 / 25,648，10.81ms | raw −0.95%、gzip −0.90%（1 条警告） |
| site…css（源修正后严格） | 同上 | — | 126,644 / 25,653，10.64ms | raw −0.92%、gzip −0.88%（0 警告） |
| **合计（修正后严格）** | **194,373 / 49,090** | 194,373 / 49,090，119.03ms | **192,940 / 49,000，12.20ms** | **raw −0.74%、gzip −0.18%、耗时 −89.8%** |

**关键发现（真实解析失败，非工具缺陷）**：`templates/site-css.ejs:206` 的 `.cal-cell{…}` 规则后有一个悬垂逗号——`…transition:transform var(--td)},.cal-cell:hover{…}`。该选择器列表以空选择器开头，**浏览器同样会丢弃整条 `.cal-cell:hover` 规则（热力图悬停放大从未生效）**；CleanCSS 与 Terser 不校验选择器语义所以原样放过，lightningcss 严格解析则如实报错。评估期间未修改生产代码（仅报告）。

## 3. JS 结果

| 样本 | 现状 raw / gzip | Terser（重跑） | oxc-minify | oxc 相对现状 |
|---|---|---|---|---|
| app.OD3KGARL.js | 87,867 / 26,920 | 86,737 / 26,068，323.88ms | 86,412 / 26,177，9.21ms | raw −1.66%、gzip −2.76% |
| deferred.UDPPJ7QI.js | 97,938 / 31,377 | 95,309 / 29,926，362.88ms | 96,051 / 30,254，11.26ms | raw −1.93%、gzip −3.58% |
| runtime.48413ed284.js | 3,748 / 1,789 | 2,845 / 1,339，13.87ms | 2,847 / 1,340，0.35ms | raw −24.04%、gzip −25.10% |
| **合计** | **189,553 / 60,086** | 184,891 / 57,333，700.63ms | **185,310 / 57,771，20.82ms** | **raw −2.24%、gzip −3.85%；耗时 −97.0%（33.7 倍）** |

**要点**：① oxc-minify 速度约为 Terser 的 33.7 倍，但体积略逊（合计 gzip +438B，即比 Terser 输出大 0.76%）；② `runtime.*.js` 现状为**未压缩源码**（文件名哈希基于源码），两个工具都能把它缩小约 24–25%（合计 gzip −450B 属于全站 JS 预算的 0.75%）；③ oxc 在三个文件上均无错误，app/deferred 体积差在 ±0.7% 内。

## 4. 打包形态与合规

- 两者都**不是 WASM**：均为 Rust 原生 NAPI 预编译二进制（`lightningcss-win32-x64-msvc`、`@oxc-minify/binding-*`），通过 npm optionalDependencies 分发；WASI 仅作为个别平台的兜底。对 CI 的影响是需按平台拉取二进制（npm 自动完成，无 postinstall 脚本），锁文件体积与安装时间略增。
- 许可证：lightningcss `MPL-2.0`（文件级 copyleft，作为工具链使用不传染，但需保留声明）；oxc-minify `MIT`。引入前须按仓库依赖审计流程登记。
- 维护影响：两者均为活跃项目（2026 年发布节奏快），版本迭代可能带来选项/输出差异；替换后需在 CI 增加输出等价门禁（现有无头对比与构建冒烟可复用）。

## 5. 结论与建议

**是否值得替换：暂不切换生产，维持现有 CleanCSS/Terser 组合。**

理由：

1. **收益有限**：CSS gzip 仅再省 0.18%（主要因为构建产物已是 CleanCSS 输出，且 `site` 压缩后再压空间很小），JS gzip 再省 3.85%（但默认打包链路实际由 esbuild 完成压缩，替换 Terser 不改变 app/deferred 现状）。
2. **CSS 严格解析是双刃剑**：lightningcss 能暴露真实缺陷（本次的悬垂逗号），但也要求构建容忍策略（`errorRecovery` 会静默丢弃规则，与严格失败二选一），引入前应先修复源模板并加解析门禁。
3. **JS 速度优势在当前规模不构成瓶颈**：3 个 bundle 的 Terser 耗时约 0.7s，远低于构建 8s 预算；而 oxc 体积略大。
4. **切换成本真实**：新增原生可选依赖、许可证登记、跨平台 CI 验证、输出等价回归，均需一个独立批次完成。

**后续触发条件（满足其一再重新评估）**：① 站点 CSS 规模增长 ≥2 倍且 CleanCSS 耗时成为构建瓶颈；② 需要严格 CSS 校验作为质量门禁（配合修复 `site-css.ejs` 悬垂逗号）；③ 引入 JS 大规模压缩场景（如 Pagefind/vendor 纳入压缩范围）使 Terser 耗时超过 1.5s；④ lightningcss/oxc 出现显著体积优势（如 CSS nesting、`@property` 等新语法优化）。

**顺手发现（供 C8/后续批次）：**

1. `templates/site-css.ejs:206` 悬垂逗号导致 `.cal-cell:hover` 规则在浏览器中被整体丢弃（悬停放大失效），建议独立缺陷修复 + 回归断言（修正后 lightningcss/CleanCSS 均能严格解析）。——**已处置（压缩 C8）**：模板已修复，`build-smoke` 增加产物 CSS 无 `},.` 模式与 `.cal-cell:hover` 存在性断言。
2. `runtime.*.js` 未压缩，两个候选工具均可再省约 24% raw / 25% gzip；若维持「文件名哈希基于源码」，可考虑在拷贝时以 Terser 压缩后改名并同步哈希引用（需评估启动期稳定性）。——**已处置（压缩 C8）**：runtime 已纳入 Terser 压缩并按最终字节 md5-10 改名、同步全部 HTML 引用（实测 raw 3,748→2,845B、gzip 1,789→1,339B）。

## 6. 复现与清理

- 复现：`npm run build -- --out .cache/wasm-eval/dist` 后运行评估脚本（隔离脚本 `.cache/wasm-eval/tools/bench.mjs`，原始数据 `.cache/wasm-eval/results.json`）；两组补充测量（recovery / 源修正）见 `.cache/wasm-eval/lightningcss-fixed.json`。
- 所有评估产物与工具位于 `.cache/`（gitignored），不会进入构建产物或版本库；未执行任何 `--save` 安装。
- 未切换生产声明的范围：`package.json`、`package-lock.json`、`compression.json5`、`scripts/build/*` 均未因本评估改动。
