# 反馈批次二：收尾工程（2026-09-26）

> 用户指令：完成剩余清单 二.1–二.5 与三（mermaid 构建期渲染、CJK 字体子集化）全部项。
> 决策（用户答复 2026-09-26）：①中文字体 = Noto Sans SC，构建期按实际用字子集化；②Node 20.19 允许 `npx node@20.19.0` 一次性实测；③真机 = 我做模拟 + 用户按清单点检；④全部完成后一次部署。

## 任务清单与验收

| # | 任务 | 验收标准 |
|---|---|---|
| 1 | scripts/build.js 拆分收尾（report/render/config/markdown/articles/pages/collectors/serve） | 每包 lint/tsc/build 通过 + dist 哈希等价 173 文件 + test:build；编排器尽量 ≤300 行并记录实际值 |
| 2 | js/domains 物理分层 core/features/guard（每模块独立文件） | deferred.js/main.js/测试路径同步；run-softnav 13/13 + test:build + 本地探针无错误。已完成（registry 沿用 deferred.js） |
| 3 | 软导航残余视觉重绑（motion 入场、图片 LQIP、侧栏拖拽、复制按钮 morph） | run-softnav 扩展场景通过 |
| 4 | i18n 配置层补 *En（reward/newsletter/friends） | verify:config + 渲染无中文残留（英文页） |
| 5 | 安全收尾：style-src-elem nonce + style-src-attr、FALLBACK CSP、frame-ancestors、accessGate ?key 清理、维护页语言 | verify:security + 线上响应头验证 |
| 6 | mermaid 构建期渲染（失败回退客户端） | 图表页无 mermaid 请求且 SVG 已内联；冒烟断言 |
| 7 | CJK：Noto Sans SC 构建期子集化（woff2） | localhost 中文字体生效；dist 增量 ≤1.5MB；CI 无网络依赖（缓存缺失时跳过并告警） |
| 8 | 覆盖率：scripts/lib/** ≥80% + npm run coverage + CI 门禁 | coverage 报告与阈值断言通过 |
| 9 | SBOM：npm run sbom（CycloneDX）+ CI 产物 | 生成物可解析、含全部依赖 |
| 10 | a11y 全页（非抽样） | 全部构建页 0 violations / 0 httpFailures |
| 11 | Node 20.19 实测 | test/test:build/lint 通过或给出结论 |
| 12 | 移动端模拟测试（触屏/视口/软导航/弹窗） | 模拟套件通过 + 真机点检清单交付 |
| 13 | 文档同步（config-reference/CHANGELOG/architecture/handoff） | 与实现一致 |
| 14 | real-site 同步 + 门禁 + 部署 + 线上验证 | ALL PASS + 回滚点记录 |

## 约束
- 每任务独立提交；机械拆分每包 dist 哈希等价；行为变更必须有测试。
- 部署在全部完成后执行一次；推送仍待用户指令。

## 执行结果（2026-09-26）

| # | 状态 | 证据 |
|---|---|---|
| 1 | ✅ | `scripts/build.js` 265 行 + `scripts/build/` 15 模块 + context 工厂；6 次提交均 dist 哈希等价（173 文件） |
| 2 | ✅ | `js/domains/{core,features,guard}`；run-softnav 23/23；registry 沿用 `js/core/deferred.js`（已记录） |
| 3 | ✅ | `c095085`；新增 4 类 hook；run-softnav 13→23 场景 |
| 4 | ✅ | `4200d9c`；60+ *En 键；dist 静态断言 38/38、运行时 0 失败；残余（演示数据/guard 文案）已记录 |
| 5 | ✅ | `43ac6c2`；style nonce、FALLBACK 收紧、frame-ancestors、`?key` 清理 10/10、维护页双语 6/6 |
| 6 | ✅ | `270c55d`；冷构渲染 12 图（10.9s）、热构缓存、失败回退客户端；runner 6/6 |
| 7 | ✅ | `bad3633`；52/202 chunk、24 个 woff2 上线（生产 200 + immutable）；离线跳过降级 |
| 8 | ✅ | `3e25b90`；scripts/lib 行覆盖 98.23%（27 文件全 ≥80%）；`test:coverage` 入 CI |
| 9 | ✅ | `3e25b90`；CycloneDX 1.5（381 组件）+ CI artifact |
| 10 | ✅ | `4e63dee`；84 页（明暗双跑 168 次）critical/serious/moderate/minor 全 0 |
| 11 | ⚠️ | 本地 `npx node@20.19.0` 被环境 npm 包装器劫持（始终本地 v26.7.0）；已交付 `scripts/run-tests.js` 自举入口（Node 20 无 glob 也可用）+ CI `compat-node20` 任务（推送后在 CI 实测） |
| 12 | ✅ | `4e63dee`；模拟 182/182；`docs/mobile-checklist.md`（iOS/Android 各 15 项） |
| 13 | ✅ | CHANGELOG/README/config-reference/architecture/本计划同步 |
| 14 | ✅ | real-site 三方合并同步（features/site/friends/navigation/sidebar，`--ours` 保真实值）；门禁 313/313 + smoke 2/2 + verify 双双 PASS + build 预算全绿；部署版本 `5167ec62`（回滚点 `cd4a01dd`）；线上 softnav ALL PASS、CJK CSS/woff2 immutable、/admin 403 |

附加修复（本次会话事故）：`cfe3cb2`+`53023cc` 开发服务器看门狗（父进程/空闲自退，15 个工具脚本自动继承）+ `kill-orphans.js` 兜底；`329c97e` 测试入口自举 + CI compat-node20。

