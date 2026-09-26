# 批次三计划：OG 尺寸自适应 / 配置扩展 / 残余收口

> 用户决策（2026-09-26）：①「自动生成没有封面的图片」= **OG 分享图尺寸自适应**；②尺寸策略 = **完全同尺寸 + 安全上限（2560）**，显式配置始终优先；③自动检测统计范围 = **仅文章封面图（cover/featuredImage）**；④Powered by 仅需配置开关（已有 `footer.json5 → poweredBy.enabled`，不加运行时开关）；⑤配置项扩展范围 = **本次相关 + 顺带扫描**。

## 全局约束
- 显式配置 > 自动检测；自动：1 张封面 → 用该图尺寸；多张 → 取面积最大者；0 张 → 默认 1200×630。
- 安全上限：自动检测结果的长边超过 2560px 时等比缩小（保持宽高比，取整）。
- 配置默认值：`width/height` 为 `null`（自动）；真实环境留空；配置文件内保留注释示例（1200×630）。
- 所有新增配置键必须：features.json5 + features-schema.js + docs/config-reference.md + 测试同步。
- 注释要求：中文、说明作用/类型/可填值/不可填值/推荐值（用户明确要求）。

## 任务
1. **T1 OG 尺寸自适应**：新增 `scripts/lib/og-size.js`（纯函数）+ 单测；`generate-og.js` 预扫描封面尺寸（sharp metadata，本地文件；远程/失败跳过）、解析尺寸并计入日志与缓存指纹；封面文件变更纳入缓存键。
2. **T2 配置扩展（本次相关+扫描）**：`ogImage.autoSize{enabled,maxDimension}`、`ogImage.coverFit`、`ogImage.overlay{enabled,wrap}`；`listCover.fallback` 死键接线（`pattern`(默认，现状) | `none`）。
3. **T3 style-src-attr 移除**：模板 42 处静态 `style=` 全部类化/CSSOM 化（含 view-transition-name、preset 色块、display:none→hidden 等），CSP 去掉 `style-src-attr 'unsafe-inline'`；无头验证 0 CSP 违规。
4. **T4 i18n 演示数据**：主仓 site.json5 description/bio 的 *En、pages 英文版、guard 锁文案、404 静态中文、dateFormat 逐项核实补齐；dist 扫描 en 页无中文残留（内容除外）。
5. **T5 LCP 治理**：perf-audit 增加 LCP 元素/分相采集；定位生产 3.8s 主因（CSS 链/字体/渲染）并修复；本地与生产复测，如实记录是否达标。
6. **T6 收尾**：全门禁 + real-site 同步（新键合入、`width/height` 置 null 启用自适应）+ 部署 + 线上验证 + 交接与计划状态更新。

## 验收标准
- `npm test` 全绿（新增 og-size 单测）；`npm run test:build` 2/2；lint/tsc/verify:config/verify:security 全绿。
- `.tmp-scripts/run-og-size.js`：单图 800×400 → OG 800×400；双图 → 最大；3000×1500 → 2560×1280；显式 1000×500 → 原样；封面变更后缓存失效重生成。
- 生产验证：OG 尺寸符合规则；CSP 无 `style-src-attr 'unsafe-inline'`；0 CSP 违规；软导航/页面正常。
