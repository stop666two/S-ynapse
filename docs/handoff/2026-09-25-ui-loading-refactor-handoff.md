# 交接文档：加载优化 + 代码重构 + 界面优化（2026-09-25）

> 会话类型：需求实现（grill-me 决策 → 分阶段实施 → 真实站同步 → 生产部署）。
> 上一份交接：`docs/handoff/2026-09-25-remediation-handoff.md`（审计修复批次）。

## 1. 本批次完成了什么

| 阶段 | 内容 | 提交 |
|---|---|---|
| 计划 | grill-me 15 项决策 + 硬指标 + 风险表 | `539c5a6`（`docs/plans/2026-09-25-ui-loading-refactor.md`） |
| T0 | 性能基线脚本 + 生产基线 + dist 哈希护栏 | `8904e2a`、`c6382f3`、`10b0968` |
| T1.1 | 运行时配置分层（关键内联 ≤2KB + `/assets/config.<hash>.json`，fail-open） | `46ab4da` |
| T1.2 | esbuild 两段 chunk（app/deferred）+ runtime 哈希单发 + `--no-bundle` 回退 | `71ab90c` |
| T1.3 | KaTeX woff2-only、mermaid 延迟到交互空闲、Prism 按页门控 | `9843470`、`b51ca42` |
| T1.4/1.5 | 字体 preload 复核、`_headers` 缓存分级 | `1cdc4f6`、`101e47a`（合并规则缺陷修复） |
| T1.6/1.7 | 本地 3 次硬指标、预算 5 项门禁 | `b51ca42` |
| Phase 2 | build.js 3416→2286 行，拆出 6 个模块（minify/media/fs-utils/feeds/security-files/assets），每包 dist 哈希等价 | `12fdac1`、`ed3c362`、`c785e4c`、`acddfca`、`c219ef2` |
| 2.4/2.5 | 死键清理、架构文档 | `7854684`、`475645c`（`docs/architecture.md`） |
| Phase 3 | 界面方向 A 编辑部头版（serif 字体预设、扁平令牌、样式收束、遗留接线） | `72d4595`、`d2b4648`、`5dc2d77`（`docs/plans/2026-09-25-ui-direction.md`） |
| 收尾 | smoke 演示页断言降级、CHANGELOG、本交接 | `b29c103`、`101e47a` |

## 2. 生产部署记录（blog Worker）

| 项 | 值 |
|---|---|
| 部署方式 | `npm run build && npx wrangler deploy --config workers/wrangler.toml --env production`（**在 real-site 目录执行**） |
| 上线版本 1 | `dd51485e-73bc-44da-8d23-99fc4d7df903`（加载优化 + Phase 2 + Phase 3） |
| 上线版本 2 | `e563e260-430f-478e-abf6-7c8466de0bf0`（`_headers` JS 缓存合并规则修复） |
| 回滚点（部署前） | `ec484e88-caa9-4d4d-a243-f90cc9397c0b` |
| 回滚命令 | `npx wrangler rollback <version-id> --config workers/wrangler.toml`（脚本+资产整体回退） |
| 域名 | https://blog.stop666.dpdns.org |

## 3. 线上验证证据（2026-09-25，部署后）

- 页面：`/zh/`、`/en/`、`/zh/s-textpaste/` 均 200；0 控制台错误；0 CSP 违规。
- 字体：三页 `h1/.site-logo` 计算样式均为 `Georgia, "Noto Serif SC", "Songti SC", STSong, SimSun, serif`。
- 响应头：`script-src` 含 nonce 且无 `unsafe-inline`；`/assets/css/*` 与 `/assets/js/*` 均为单条 `max-age=31536000, immutable`；HTML `max-age=0, must-revalidate`；`/admin/` → 403。
- 生产性能（Slow 4G + 4× CPU，3 次）：请求 **41→12**、HTML 传输 **26.6KB→9.9KB**、总传输 **207.7KB→147.8KB**、CLS 0.0003；**LCP 中位 3796ms（2768–5492 波动）未达 ≤1.2s 目标** —— 测量受本机到 CF 的网络路径波动影响大，且与上一基线（2476ms）不同时段不可直接比较；已如实记录于 `docs/perf-baseline.md`，列入后续跟进。
- 门禁（真实站）：lint / tsc / `npm test` / `npm run test:build` / `verify:config` / `verify:security` / `npm run build` 全绿；`audit:a11y` 14 页 0 violations。

## 4. 已知遗留与后续建议

1. **LCP 目标未达成**：建议在网络稳定的时段复测；若确需 <1.2s，优先评估首屏 CSS 关键路径内联/拆分、CF 缓存与字体策略，勿盲目继续加码。
2. `style-src 'unsafe-inline'` 仍保留（SECURITY.md 已声明）；Worker FALLBACK（无构建产物时）CSP 仍含 `unsafe-inline`。
3. `scripts/build.js` 2286 行，仍有拆分空间（render/page-data/config/report/build），可按既定工厂模式继续；`.refactor-baseline.json` 在当前 dist 下已过期，继续重构前需重新快照。
4. `js/domains` 未按 core/features/guard 物理分层（`deferred.js` 已承担注册表职能）。
5. real-site 含生产数据（`features.json5` 保留 3 处 OG 覆盖 + 2 处公告文案），**严禁入库**；本次同步后 real-site 工作树未提交（与其既有约定一致）。
6. 推送/打 tag 仍未执行（用户明确暂不推送）。
7. 增量构建、mermaid 构建期渲染、CJK 字体子集化：本轮明确不做，见计划文档第 7 节。

## 5. 关键产物与工具

- 计划与决策：`docs/plans/2026-09-25-ui-loading-refactor.md`、`docs/plans/2026-09-25-ui-direction.md`
- 架构说明：`docs/architecture.md`；回滚手册：`docs/runbook/rollback.md`
- 性能基线：`docs/perf-baseline.md`（生产）、`docs/perf-baseline-local.md`（本地）
- 可复用工具（未入库）：`.tmp-scripts/{run-probe,run-perf-local,run-a11y,shots,live-check,list-resources,measure-dist,build-inventory}.js`
- 备份：`D:\administrator\Documents\project\S-ynapse-realsite-backup-2026-09-25-ui`（同步前 real-site 代码快照）；主仓库 bundle 见部署批次记录。

## 6. 用户反馈批次（2026-09-25 晚，已部署）

- 修复：公告条关闭记忆按语言独立（`b2ad93e`）——此前单键存储导致「关英文后中文复现 / 中文公告不显示」。
- 新增：弹窗公告 `features.popupNotice`（`4be0e04`）；软导航 `features.softNavigation`（`3f3a021`，含页内开关与自动回退）。
- 卡顿归因：4× CPU 探针证实主源为文档级导航冻结（336–410ms），非滚动/目录模块；软导航从链路消除。
- 验收：本地 `.tmp-scripts/run-softnav.js` 13/13 PASS；生产 `.tmp-scripts/verify-live-softnav.js`（blog.stop666.dpdns.org）全部 PASS——无整页刷新、正文/TOC/进度条正确更新、0 控制台错误。
- 生产版本：`cd4a01dd-330c-4279-a583-c306e7daed2c`；上一版本 `e563e260-430f-478e-abf6-7c8466de0bf0` 可作回滚点（`npx wrangler rollback`）。
- real-site 同步已执行（代码 + features.json5 合入 popupNotice/softNavigation；真实数据保持本地、严禁入库）；真实站门禁全绿（lint / tsc / 244 测试 / verify:config / build / verify:security）。
- 软导航已知残余（低风险）：motion 入场动画、图片 LQIP 淡入、侧栏拖拽排序、复制按钮 morph 在软导航后不重绑；CF Web Analytics 不计数软导航（config-reference 已注明）。
- 推送 / tag 仍未执行；`.refactor-baseline.json` 已删除并加入 `.gitignore`（`92c9fcb`）。

## 7. 反馈批次二（2026-09-26）

- **构建拆分（二.1）**：`scripts/build.js` 3416→265 行，`scripts/build/` 15 个工厂模块 + `context.js`；机械等价护栏逐包验证（dist 哈希 173 文件）。
- **分层（二.2）**：`js/domains/{core,features,guard}`；`deferred.js` 为统一注册表。
- **软导航视觉重绑（二.3）**：motion/LQIP/侧栏拖拽/复制按钮 morph 入 `__SOFTNAV_HOOKS__`；run-softnav 23/23。
- **i18n（二.4）**：配置层 60+ `*En` 键（features/friends/navigation/sidebar/site/tuning/ui-strings）；英文页 0 中文残留（静态 38/38 + 运行时断言）。
- **安全收尾（二.5）**：`style-src` nonce 化（残余仅 `style-src-attr 'unsafe-inline'`）；Worker FALLBACK 收紧；`frame-ancestors 'none'`；accessGate `?key=?guard=` 用后清理；维护页 Accept-Language 双语。
- **Mermaid 构建期渲染（三）**：`features.mermaid.mode`（默认 build）双主题内联 SVG + `.cache/mermaid` + 失败回退客户端；图表页 vendor 0 请求。
- **CJK 字体子集化（三）**：Noto Sans SC 按实际用字 52/202 chunk → dist 24 个 woff2（生产 200 + `immutable`），源字体本地缓存不入库；离线构建自动跳过并告警。
- **工程化**：覆盖率门禁 98.23%（CI 阻断）；CycloneDX SBOM（CI artifact）；测试入口 `scripts/run-tests.js`（自举，Node 20 无 glob 可用）；a11y 全页 84 页 0 违规（wcag22aa，明暗双跑）；移动端模拟 182/182 + `docs/mobile-checklist.md`。
- **事故修复**：开发服务器看门狗（`SYNAPSE_SERVE_PARENT_PID`/`SYNAPSE_SERVE_IDLE_MS`）+ `kill-orphans.js`；15 个工具脚本自动继承。
- **Node 20.19 实测**：本地 `npx node@20.19.0` 被环境 npm 包装器劫持（总是本地 v26.7.0），无法本地实测；已加 CI `compat-node20` 任务（推送后由 CI 验证）。
- **部署**：real-site 三方合并同步（`git merge-file --ours` 保留真实值：ogImageStyle×3 / announcement / bio 等）；门禁 313/313 + smoke 2/2 + verify:config（10 处真实覆盖）/verify:security/build 全过；**生产版本 `5167ec62-fb9f-4ed7-84d3-c784b88627e5`**，回滚点 `cd4a01dd-330c-4279-a583-c306e7daed2c`（`npx wrangler rollback`）。
- **线上验证**：softnav ALL PASS（无刷新、TOC/进度条、0 错误）；CSP `script-src`/`style-src` 均 nonce 且无 unsafe-inline、`style-src-attr` 保留、`frame-ancestors 'none'`；`cjk-fonts.css` 与 woff2 皆 `immutable` 200；`/admin/` 403。
- **已知残余**：LCP 未达 1.2s 目标（历史遗留，生产 3 次中位约 3.8s，波动大）；`style-src-attr` unsafe-inline；popupNotice 生产默认关闭（待用户启用）；推送/tag 未执行。

## 8. 反馈批次三（2026-09-26 ~ 27，含用户验收报告修复，已部署）

- **OG 尺寸自适应**（`f96634c`）：`features.ogImage.autoSize/maxDimension(2560)/coverFit/overlay`；单封面取该图尺寸、多封面取面积最大、显式配置优先；覆盖图变更纳入缓存键；`features.listCover.fallback('pattern'|'none')` 接线。
- **模板内联样式清零 + CSP 收紧**（`d98cdea`/`eac83b0`/`c4e6da2`）：11 模板 42 处 `style=` 改类/构建期 nonce 样式/CSSOM（新增 `vt-names.js` 处理 `data-vt`）；Mermaid SSR 内联样式搬入类规则；删除 `style-src-attr 'unsafe-inline'`；`run-csp-clean.js` 31/31。
- **i18n 残余**（`1a95624`/`7e0b231`）：site `*En`/bio、英文页日期格式、404/guard 锁屏文案；`run-t4-i18n.js` 17/17；guard 锁屏真实弹窗由 `run-guard-lock.js` 18/18 补齐。
- **LCP 治理**（`f155d24`~`c5efd81`）：perf-audit 增 LCP 元素/四段分相/首屏请求；serve gzip；`features.lcpOptimize`（reveal 豁免/异步 CJK CSS/跳过拉丁字体预载）；本地 LCP 2056→1852ms、TBT 1018→92ms。
- **下折叠 content-visibility**（`6e887e9`）：开关默认 false（A/B 收益大但 CLS 恶化，实测否决）。
- **CLS 治理（用户「卡一下」根因）**（`ab854a5`）：图片构建期 width/height（正文/头图/卡片/画廊）+ `features.anchorStabilize`；冷锚点 CLS 0.5367→0.0011、滚动增量 0.0240→0.0002、落点误差 1431px→9.9px（<0.1% 页面高）。
- **搜索入口失效修复**（`9c1b5f3`，验收报告第 1 类问题的本机同族缺陷）：搜索入口改文档级事件委托 + 加载前排队；`run-search-entry.js` 9/9。
- **搜索页计数与根 404 语言自适应**（`d59881c`/`61875dd`）：`{count}` 占位符消除；根 404 en 访客跳 `/en/404.html`（尊重语言锁）。
- **CSP nonce 线上事故（本轮最严重，已修复）**：`test:build` 的 `--out` 构建把 `workers/security-config.js` 写回仓库（另一枚 nonce），导致部署后 dist HTML（旧 nonce）与 Worker CSP（新 nonce）错位，线上所有内联脚本/样式被整批拦截；另根 404 重定向脚本漏 nonce。修复（`deaaf5c`）：`--out` 构建跳过 Worker 配置写入；根 404 脚本显式携带构建 nonce；smoke 新增「全站 HTML nonce 与 `_headers` 同源 + 根 404 脚本带 nonce」回归断言。
- **softnav 连续链路验收**（`run-softnav-chain.js`）：home→文A→标签→home→文B→归档→后退 全程无整页刷新、0 控制台错误（验收报告「第二次打不开」问题在当前代码不可复现，判定为旧生产版本缺陷）。
- **最终部署**：生产版本 **`cbc4945d-2501-45f3-8123-649e4054f04a`**；回滚点 `a2ab26b2-a6f0-4b6d-a961-0175314de43e`（更早 `5167ec62`）；线上复测：`probe-live-csp.js` **0 CSP 违规**（唯一无 nonce 为 `type=speculationrules`，由 `'inline-speculation-rules'` 合法放行）、`verify-live-softnav.js` **ALL PASS**、`/admin` 403、CJK 字体 immutable、CSP 无 `unsafe-inline`/无 `style-src-attr`。
- **残余（低）**：公告条「自动关闭」系按语言关闭记忆生效（正常行为，改文案或清 `s-announce-dismissed` 即重现）；生产 LCP 未达标（待稳定网络复测）；Node 20.19 由 CI `compat-node20` 验证（待推送）；推送/tag 未执行。

## 9. 构建产物压缩功能 C1–C9（2026-09-27，已部署）

- **计划与配置**：`docs/plans/2026-09-27-compression.md`；根 `compression.json5`（第 14 个配置，`verify:config` 结构监守；serve/watch 自动关闭增强步骤）。
- **流水线**：增强步骤位于 cacheBust 前——HTML 激进选项（默认关）、CSS 同页 `<style>` 合并 + 安全去重、JSON 去空白（`config.<hash>.json` 等跳过）、JS 混淆（javascript-obfuscator 5.8.0，默认关、仅自研 bundle、固定 seed）。vendor/media/og/字体与 `report.txt`、`build-report.html` 全程豁免。
- **验证与回退**（C5）：增强后 cacheBust 前两态无头对比（6 页 DOM 归一化/前 80 可见元素计算样式/0 控制台错误/软导航+搜索+主题冒烟）；失败用基线快照逐字节回退并告警（`SYNAPSE_COMPRESSION_VERIFY_CORRUPT=1` 实测回退 effective）；无 Chrome 环境跳过并告警；`npm run verify:compression` + CI 条件步骤。
- **报告**（C7）：新增 `dist/report.txt`（构建/阶段耗时、压缩前后体积、跳过明细、无头验证、预算与目标对照）；README 计数与命令同步。
- **C8 优化与验收**：`site-css.ejs` 悬垂逗号修复（`.cal-cell:hover` 曾全站失效）；runtime 纳入 Terser（−25%）；esbuild `splitting` 共享 chunk（JS gzip −10.2%，首屏 app −35.3%）。**目标口径经用户确认按 A（接受现状）**：HTML gzip −5.31%（成熟工具上限附近）、JS −10.2%、纯构建 4.9s（含无头验证 18.1s）。
- **WASM 评估**（`docs/wasm-eval.md`）：lightningcss/oxc 实测收益有限（CSS gzip −0.18%、JS 反而 +0.76%），结论暂不切换并给出重评触发条件。
- **C9 回归修复（CI 一度红）**：`css-merge` 标签配平用正则计数，被安全夹具 `<title>` RCDATA 中的 `</script><script>` 字面误判 → 失败账本使构建 exit 1 → `verify:security`/CI 红；修复：配平改上下文感知扫描（忽略注释/RCDATA/rawtext/属性值），合并/去重解析异常降级为「跳过 + 报告明细」不再记失败；新增回归测试与「全门禁必须含 verify:security」教训记录。
- **CI**：修复后 run `36287723966` success（含 `compat-node20` 首次实测通过 + Pages）。
- **部署**：real-site 全量同步（含 `javascript-obfuscator` devDep）；门禁 9/9（含 verify:security）全绿；生产版本 **`36cf88fe-eabb-45d7-9746-a6a8277e116b`**，回滚点 `2fa78c1d-db76-4108-b32b-42ad5f42a61a`。
- **线上验证**：CSP 0 违规、软导航 ALL PASS、`/admin` 403、404 语言链路正确（`/nope/` 根 404 带语言跳转；`/en/nope/` 直接英文 404）；`report.txt` 随资产发布（如需私有化需调整部署清单）。
- **生产性能复测**（Slow 4G + 4× CPU，3 次中位）：**LCP 2808ms**（3372/2372/2808，较上轮 3796ms −26%）、CLS 0.0003、请求 30、总传输 971.7KB；LCP 元素为首张卡片封面（自动封面），分相 TTFB 816 / 加载 670 / 渲染延迟 1089。**≤1.2s 目标仍未达**，候选优化：卡片封面缩略变体、首图 `fetchpriority=high`/preload、封面尺寸策略。
- **残余**：HTML/JS 目标已按用户 A 选项接受；混淆默认关（开启时 gzip +59.9%）；增量构建文章级粒度；验证耗时约 13s（含验证构建 18.1s）；同 Chrome profile 构建需串行；`report.txt` 公开可访问；真机点检待用户执行。

## 10. 完成标记 + 自动发布机制与首批 Release（2026-09-27，已部署）

- **完成标记**：根 `RELEASE.json`（`schemaVersion/version/status/humanVerifiedBy/verifiedAt/commit/checks`）+ SemVer 附注 tag；`npm run release:mark -- <major|minor|patch|X.Y.Z> --human-verified "<姓名>" --confirm <版本> [--push --confirm-push]` 依次执行干净工作区校验 → 11 项前置门禁（lint/typecheck/test/test:build/四条 config verify/verify:security/verify:compression/真实构建，`RELEASE_GATES` 单一来源）→ 人工核验参数校验 → 版本与 CHANGELOG 归段 → 写 verified 标记（commit=tag 父提交）→ `chore(release)` 单提交 → 附注 tag；`--dry-run` 仅演练。
- **双通道发布 + 双重校验**：`.github/workflows/release.yml`（`on push tags v*`；validate 读取 tag 内 `RELEASE.json`，未完成/不匹配即拒绝）→ 11 项门禁 → **buildability**（解压归档 → `npm ci --ignore-scripts` → `npm test` → `npm run build` → 断言 `dist/index.html`/`report.txt`/`zh/search-index.json`）→ `gh release create --latest`（**永不标记 Pre-release**）→ **只保留最新**：旧 Release（`--cleanup-tag`）与其余 `v*` 远端 tag 自动清理；本地备用通道 `release:publish` 同语义。
- **基础包语义（用户定稿）**：归档 = 可完整体验 README 全部功能的最简骨架——`articles/**`、`media/**` 仅 `.gitkeep` 空目录（无示例文章/媒体），`pages/**`、`static/**` 保留，测试随包；空站可直接 `npm run build`；配置为默认初始态（社交链接等已占位）。
- **发布历史**：`v1.1.0`（首个 Release，被后续策略清理）→ `v1.1.0-a1`（因 release 测试读真实 CHANGELOG `[Unreleased]` 导致 CI 红，重打后又被 Pre-release 标记问题影响）→ **`v1.1.0-a2` 为当前唯一 Release（Latest、非预发布）**，资产 `S-ynapse-1.1.0-a2.zip`。
- **事故与修复**：①`release-mark.test` 仓库状态依赖 → 临时夹具仓库化（11/11，两态均绿）；②`release-version.test` 真实仓库态硬编码小节数 → 按 Unreleased 实际小节数断言；③prune 扩展清理残留 `v*` tag（先 Release 后 tag，`--dry-run` 可预览）；④发布统一 `--latest`，彻底消除预发布态。
- **配置治理收口**：guard 绕过通道全配置化（`core.bypass.enabled/urlParam/localStorage/localhost/cleanUrl/queryParam/storageFlag/accessGateKey`，25 例单测 + 35 断言 runner）；隐藏开关审查（A 类 21 键接入、B 类 6 组去重、C 类 25 项留档 `docs/config-hidden-switches-audit.md`）；审计遗留三项（mermaid.clientOptions、水印断点单一源、触觉/存储键）；新增 `verify:config-comments`（注释守卫）与 `verify:config-docs`（文档键覆盖守卫）并接入 CI。
- **生产部署**：Worker `blog` 版本 **`7e52ad6f-659d-4a0f-8127-8d0003bab862`**（回滚点 `36cf88fe`）；线上 `probe-live-csp` 0 违规、`verify-live-softnav` ALL PASS、`/admin` 403、缺失路由 404 正常。
- **残余**：归档不含 docs（README 中 docs 链接包内不可用，属定稿口径）；生产 LCP 目标未达标；`config-count`/`release-archive` 在派生副本按 `SYNAPSE_DERIVED_COPY=1` 显式跳过并声明。

## 11. 功能扩充批次（9 项，2026-09-28，本地提交未推送）

规格与决策：`docs/plans/2026-09-28-feature-expansion.md`（用户确认 9 项全做、互动点赞/表情**关闭不做**、预算维持、顺序执行、小细节自决、**不推送**）。

| 功能 | 关键提交 | 验收要点 |
|---|---|---|
| §1 继续阅读 | 73a793c/ff91c2d/b7ff817 | 首页 3 条带进度（复用 s-history 单数据源）、软导航点击、空态隐藏；runner 17/17 |
| §3 系列聚合页 | cc67120/489b363/12c8a4e/e483346 | `/zh|en/series/<slug>/` 自动生成、上下篇、sitemap 纳入、搜索不纳入；runner 20/20 |
| §2 搜索升级 | abb3212/00f7feb/b759e0a/09e7565/0db460c | bigram 倒排索引外置（gzip 12.2/5.7KB ≤60）、词项 AND+权重+标签命中、摘要高亮、错误重试；runner 21 断言 |
| §4 PWA | 85d49da/00ce031/07cf72c/f199616 | SW 壳预缓存 + 页面 network-first + 资产 cache-first、更新提示条；runner 28/28 |
| §6 灯箱增强 | e48cb74/1182b70/af64c3c/955dc8a | 缩放（滚轮/双击/捏合）+平移边界+幻灯片+原图下载（无 EXIF）；runner 41/41 |
| §7 文章导出 | 485986b/c50977f/f09318d/279e856 | 打印/另存 PDF 样式 + `/md/<lang>/<slug>.md` 复制（与磁盘逐字节一致）；runner 18/18 |
| §5 双语对照 | cc4653f/e926bfd/2e4141c/a31d5c5 | 中/EN 切换（软导航直连）+ 宽屏 ≥1280px 并排（净化提取）；runner 34 断言 |
| §9 主题编辑器 | bbe03a5/a57dbb9/3427ab4/15fcba2 | 面板 tab、12 token 实时预览、保存早置、JSON5 导出；runner 26/26 |
| §10 省流模式 | 05e0d01/183d585/24b7720/1997b59 | saveData 自动+手动持久、动画/粒子/低清图/系统字体降级、即时还原；runner 25/25 |

- **总门禁**：`npm test` 868/868（124 suites）、`test:build` 3/3、`lint`/`typecheck` 0、四条 config verify 全 PASS；features 102 模块 / 1017 项，全仓 2844 项；deferred 注册表随功能增长，全部新代码走按需加载。
- **残余（留待决策）**：①性能预算存量超限（JS gzip 69.7/60KB、单页 HTML gzip 36.6/28KB，warnOnly 非阻断，已按「超出后再调并记录」处理）；②`real-site/` 派生副本落后多个批次未同步；③各功能 runner 在 `.tmp-scripts/`（gitignored）仅存本地；④省流手动开关仅在文章页阅读设置面板（首页无入口）；⑤主题编辑器不可编辑含透明度的 `--color-shadow`。
- **推送状态**：`origin/main` 停在 `14f4102` 后未再推送；本地领先 **50 个提交**，全部可通过 `release:mark` 流程发布。

## 12. 硬化与可配置化执行（H1–H5）与 real-site 全量同步

**计划与决策**：`docs/plans/2026-09-29-hardening.md`（用户已确认 7 项决策：internals 单源、配置扩张 29 项、语言表统一、根路由去 302、timezone 保留字段、15 项数据流修复、CI 一次跑完不提前中断）。执行链 H1→H5；主仓未 push，real-site 未提交、未部署。

**H1 internals 基建 + 硬编码迁移（HC1–HC20）**：新增 `internals.json5`（端口/缓存 TTL/Chrome/CI 版本/部署项目/审计上限/报告色；校验未知键与类型范围，返回冻结）与 `scripts/lib/internals.js`；`scripts/check-internals.js` 守卫（`.nvmrc`、workers assets 目录、CI 版本、写死形态抽样）；Chrome 探测抽 `scripts/lib/chrome-path.js`、输出目录抽 `scripts/lib/output-dir.js`；CI 聚合 `scripts/ci-checks.js` + `ci-env.js` + `ci-skip.js`（无变化跳过、失败不提前中断、报告 `build-artifacts/ci-report.*` 并总是上传）；进程守卫 `scripts/lib/process-guard.js` + `scripts/spawn.js`（自动化永不挂死兜底，`verify:process-guards`）。提交：3d024ca/dd81a42/0dc1d50/e7dafb2/345718b/ce94371/cb4b0c0/91eaf16/a57b31c。

**H2 数据流修复（DF1–DF15）+ 语言统一（HC6）**：`__LANGS__` + `langOf()` 取代约 20 处硬编码语言判定，根页按 `site.languages[0]` 投影并刷新增量 nonce；修复 nonce 复用、feed cacheBust 重写、OG 与构建共享 `resolveBuildTheme`、guard 降级启用内置默认档、`modified` 投影、feed 按 `site.rss.enabled` 门控、根 404 去 302、JSON Feed `updated` 统一、搜索索引缺失显式错误态、offline 语言判定、`/feed.json` 别名、软导航 `hreflang`/feed alternate 有序同步。回归 `scripts/h2-dataflow.test.js` 15 例。提交：ec2176b/d551a76/5c8a6a7/907c21b/1507966/fc82c95。

**H3 配置扩张 29 项（EX-P1–P3）**：7 个配置文件新增键全部真实接线（默认=现状）：`i18n/themePresets/readingProgress.storageKey`、`friends.sidebarCount`、`continueReading.removeDelayMs/clearConfirmMs`、`search.resultTagCount`、`searchHighlight.markColor(+Dark)`、`errorPage.suggestCount/suggestTitle/artAriaLabel`、`series` widget count 与 `imageLazy.eagerFirst` 接线修复、`readingHistory.progressThrottleMs`、`bilingual.fetchTimeoutMs/resizeDebounceMs/paneTitle`、`pwa.reloadFallbackMs`、`search.overlayBackdrop`、`announcement.transitionMs`、`codeBlock.windowDotColors/scrollHintTolerancePx`、`guard.contextMenu.searchTextMaxChars/moveTolerancePx`、`security.rateLimiting.maxTrackedEntries`、`security.hardening.cspReportMaxBytes`、CJK 字体并发/TTL、`site.build.reportTopN`、sidebar `recentPoolSize`。提交：b10a115/a05852a/1c63ee1/2667e2f + 单测断言同步 71953d3 + CHANGELOG 1115e10。

**H4 注释与文档（CM/DOC）**：`tuning.json5` 37 分类/274 项、`features.json5` 旧模块 8 段、`site.json5` authorProfile 子字段补齐「作用/类型/可填值/不可填值及原因/推荐/默认」六要素注释；清除配置注释中的历史字样；README/config-reference/architecture 计数与行数校正（features 103 模块/1046 项，全仓 2889 项，`npm test` 945/134）。提交：f9757df/872fdde/4a4e104/7768d78/d53eacd/9aa94fa/c79a0fa。

**H5 文档残留清理 + 门禁前提修复**：`docs/config-reference.md`/`README.md` 清除剩余「历史行为/历史默认」与日期字样（扫描 `历史行为|历史默认|批次|功能扩充批次|v1.0.3|2026-09|2026-10` 零命中；CHANGELOG/handoff/plans 保留历史叙述），提交 5a132e2。派生副本门禁前提两处修复：`scripts/build-smoke.test.js` 示例系列/hello-world 导出/双语断言改为「示例内容存在时断言」（canonical 断言不弱化，派生副本可自备内容）4999e48；`scripts/check-internals.js` 在 `SYNAPSE_DERIVED_COPY=1` 时跳过 deploy.yml 检查（.github 不随同步），README 与 config-reference 同步说明 14ee8d5/f76933b。

**real-site 全量同步（本机派生副本）**：同步点主仓 `9e3cb96` → `f76933b`；备份 `real-site/.backups/2026-09-29-hardening/`（comparison-report.txt + diff-files/ 107 份同步前副本 + real-site-src.zip 1.36MB）。变更 160 项（44 新增 + 116 修改）：`scripts/**`（207 文件）、`js/**`（71）、`templates/**`（16）、`workers/**`（保留 real `wrangler.toml` 与构建产物 `security-config.js`）、docs config-reference/architecture/runbook、README/CHANGELOG、package*.json/.nvmrc/internals.json5/eslint/tsconfig/.gitattributes/.gitignore/build.bat/serve.bat/根 wrangler.toml。配置三方合并（base=9e3cb96，real 值优先，0 冲突）：features 23 新键 + 5 real 覆盖（ogImageStyle×3=false、announcement 文案）；site 3 新键 + 21 real 覆盖（`pwa.enabled=true`、标题/域名/作者/邮箱、webAnalytics=false 等）；sidebar/widgets、friends.enabled=false、navigation.logoText 保留 real 值；tuning/guard/security/ui-strings 合并后与主仓逐字节一致；无删除键。数据零改动断言：articles/media/static/pages 与 theme.json5/footer.json5/workers/wrangler.toml 共 22 项摘要比对一致。

**real-site 门禁（`SYNAPSE_DERIVED_COPY=1`，13/13 exit 0）**：`npm test`（945/944 + 1 skip）、`test:build` 3/3、`lint`、`typecheck`、`verify:config`、`verify:config-refs`、`verify:config-comments`、`verify:config-docs`、`verify:config-dupes`、`verify:internals`（派生跳过 deploy.yml）、`verify:security`、`verify:process-guards`、`npm run build`（全量 51 页；压缩无头验证 6 页 PASS；预算 5 项全 OK/0 OVER；`workers/security-config.js` 重建，nonce 与 `dist/_headers` 同源 `nonce-A4ANIjl/WeBDauDxEOdt3w==`，含 `maxTrackedEntries=5000`/`cspReportMaxBytes=16384`）。产物抽查 6 项全过：① 根 404 语言重定向 + `_redirects` 无 `/404.html` 302 且含 `/feed.json`；② feed 图片路径可解析（real 内容无配图 N/A；同源代码 canonical 新构建 27 个路径全解析）；③ 软导航 bundle 含 `hreflang`/`data-alt-lang`；④ `eagerFirst=1` 与 `errorPage` 配置及首页/404 渲染痕迹；⑤ CSP `script-src`/`style-src` 带 nonce 无 `unsafe-inline`、`style-src-attr` 未声明放行；⑥ `report.txt` 预算 5 项。端口/进程零残留（3000/3224/3332 与压缩验证端口未监听、无孤儿 Chrome）。

**残余与部署前事项**：① real-site `node_modules` 未装 `fast-check`（仅 `test:fuzz`/`test:all` 需要，本次 13 项门禁无依赖；如需全套先 `npm ci`）；② `.github/**` 未同步（real 自有 CI 与部署名 `blog`），guards 按派生副本跳过 CI 文件检查，部署前需人工核对 Worker 名与 Pages 项目名；③ 主仓未 push、real-site 未提交未部署；部署路径 `npm ci && npm run build` → `npx wrangler deploy --config workers/wrangler.toml --env production`，发布前 `git bundle` 备份，发布后按 `docs/runbook/rollback.md` 抽查 CSP/feed/404。
