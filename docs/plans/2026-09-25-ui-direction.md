# 界面方向选定：A · 编辑部头版（2026-09-25）

> 本文档记录 Phase 3.1 的候选方向、用户选定结果与实施约定。用户于 2026-09-25 选定 **方向 A · 编辑部头版（Editorial Front Page）**。

## 1. 候选与选定

| 方向 | 预览文件（.tmp-scripts/ui-previews/，未入库） | 结论 |
|---|---|---|
| A · 编辑部头版 | `direction-a.html` | **选定** |
| B · 磁贴杂志 | `direction-b.html` | 未选 |
| C · 工作台 | `direction-c.html` | 未选 |

选定理由（用户确认）：衬线大标题 + 头条区 + 细分割线，文字优先、克制，长文阅读体验最佳，改造风险最低。

## 2. 设计令牌（相对原配置的差异）

| 令牌 | 原值 | 新值 | 说明 |
|---|---|---|---|
| `theme.fontSystem.displayStack` | `sora` | `serif` | 系统衬线栈（Georgia → Noto Serif SC → Songti SC → STSong → SimSun），离线、无 CDN |
| `theme.fontSystem.headingStack` | `manrope` | `serif` | 与展示层统一 |
| `theme.rounding` | `md`（0.618rem） | `sharp`（2px） | 报纸式锐角 |
| `theme.shadowLevel` | `soft` | `flat` | 无阴影，层次由 1px 实线承担 |
| `theme.background.mode` | `particles` | `plain` | 纯色纸面；如需动态质感可改回 particles |
| `features.atmosphere.glow` | `true` | `false` | 移除 Hero 径向光晕 |
| `features.cardFx.coverOverlay` | `true` | `false` | 移除封面渐变遮罩 |
| `features.cardFx.categoryChip` | `true` | `false` | 分类改由正文 meta 行承载 |
| `features.cardFx.readTimeBadge` | `true` | `false` | 阅读时长改由正文 meta 行承载 |
| `features.cardFx.hoverShine` | `true` | `false` | 移除悬停光泽 |
| 颜色 | `preset: classic-blue` 不变 | 不变 | 蓝（`--color-s`）用于链接/悬停；红（`--color-a` accent）用于栏目眉、引用线与 h2 短竖线 |

## 3. 实施范围

- `scripts/build.js`：`FONT_STACKS` 新增 `serif` 预设（复用 `SERIF_STACK`），`FONT_LINKS.serif = null`（系统字体，无网络请求）；`headingStack: 'serif'` 分支复用同一常量。
- `templates/site-css.ejs`：文件末尾新增「方向 A」收束样式段（同优先级后置覆盖）：报头实线下边框、左对齐 Hero（含红色栏目眉）、扁平卡片（透明底 + 1px 分隔线）、头条放大衬线标题、文章页左对齐标题与上下实线 meta 区、无背景红边引用、图片去阴影、归档卡片描边。
- 不改动：模板结构（避免 i18n/a11y 回归）、构建管线、配置结构、无障碍语义。

## 4. 验证与验收（Task 3.3）

- `npm run test:build`（含新增断言：构建产物 CSS 的 `--ff-d` 必须解析为衬线栈）
- `npm run audit:a11y`（含 wcag22aa）必须 0 violations
- `node scripts/perf-audit.js` 本地回归：不劣于 Phase 1 基线（LCP 噪声带内、CLS ≤ 0.05、预算不超限）
- 移动端 360 / 768 / 1280 与深浅色截图人工核对（部署前）

## 5. 遗留可用性修复（并入 3.2）

- lightbox：`preloadAdjacent` / `rememberPosition` / `closeButton` 配置接线
- sidebar-drag：`touchLongPress` / `persistOrder` 配置接线
- TTS：系统自动暂停后的恢复策略（避免状态卡死与与系统播放器打架）
