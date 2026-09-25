# 反馈批次二：收尾工程（2026-09-26）

> 用户指令：完成剩余清单 二.1–二.5 与三（mermaid 构建期渲染、CJK 字体子集化）全部项。
> 决策（用户答复 2026-09-26）：①中文字体 = Noto Sans SC，构建期按实际用字子集化；②Node 20.19 允许 `npx node@20.19.0` 一次性实测；③真机 = 我做模拟 + 用户按清单点检；④全部完成后一次部署。

## 任务清单与验收

| # | 任务 | 验收标准 |
|---|---|---|
| 1 | scripts/build.js 拆分收尾（report/render/config/markdown/articles/pages/collectors/serve） | 每包 lint/tsc/build 通过 + dist 哈希等价 173 文件 + test:build；编排器尽量 ≤300 行并记录实际值 |
| 2 | js/domains 物理分层 core/features/guard（每模块独立文件） | deferred.js/main.js/测试路径同步；run-softnav 13/13 + test:build + 本地探针无错误 |
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
