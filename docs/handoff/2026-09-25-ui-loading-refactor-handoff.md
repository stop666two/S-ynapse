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
