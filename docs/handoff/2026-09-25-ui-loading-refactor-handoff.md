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
