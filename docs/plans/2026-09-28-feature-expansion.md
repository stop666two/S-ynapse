# 功能扩充计划（9 项，2026-09-28）

> 用户决策：全部实现；「本地互动（点赞/表情）」**关闭不做**；性能预算维持（jsKb 60 / 请求 12，超出后再调并记录）；顺序执行 1→3→2→4→6→7→5→9→10；小细节执行者自决并记录；**全程不推送**。
> 通用要求：每功能独立配置键（注释完备）+ schema + docs/config-reference + CHANGELOG + 单测 + 自收尾 runner（看门狗+端口释放）+ 本地细颗粒提交；四条 config 守卫与 `npm test`/`test:build`/`lint`/`typecheck` 全绿；新代码进按需加载（deferred）路径。

## 1. 继续阅读（首页 3 条带进度）
- 配置 `features.continueReading`：`enabled:true`、`count:3`、`showProgress:true`、`storageKey`（复用阅读历史键）。
- 运行时：读取本地阅读历史（标题/URL/语言/进度%/时间），取最近 3 条；`templates/index.ejs` 预留 `<section id="continueReading" hidden>`，无记录保持隐藏；卡片点击走软导航。
- i18n：ui-strings `continueReading.title/progress`（zh/en）；进度条 aria。
- 测试：纯函数（排序/过滤/进度计算/上限 3）+ runner（注入历史→显示 3 张→点击导航→空态隐藏）。

## 3. 系列聚合页 /series/<slug>/
- 构建期生成 zh/en 系列页（新模板 `series-page.ejs`）：系列名标题、按 order 的文章列表（含进度标签与序位）、上下篇；自动元数据（无描述不渲染）。
- 配置 `features.series` 增 `pageEnabled:true`；sitemap 纳入；搜索索引不纳入。
- 测试：单测（slug/排序/URL）+ build-smoke（系列页存在）+ runner（访问、列表完整、链接可用）。

## 2. 搜索升级（bigram + 外置 + gzip ≤60KB）
- 构建期倒排索引：CJK bigram + 英文小写分词，字段权重沿用 `weightTitle/Excerpt/Content`、标签/分类命中沿用；输出 `/assets/search-index.<hash>.json` 按需加载；构建断言 gzip ≤60KB，超出裁剪低频词并告警记录（不阻断）。
- 客户端替换 matcher（保留 minChars/maxResults/highlight/错误重试）；空结果态沿用。
- 测试：tokenizer/索引构建/体积断言（单测）；runner（中文词/英文词/标签命中、结果摘要高亮）。

## 4. PWA 离线阅读（默认开 + 更新提示）
- `features.pwa` 默认改 true；构建期生成 SW：壳（HTML 离线回退、核心 CSS/JS/字体）预缓存；文章页 **network-first + 缓存回退**；静态资产 cache-first（immutable）。
- 新版本检测：SW `updatefound` → 顶部提示「新版本可用 [刷新]」（ui-strings 双语）；离线页保留。
- 测试：单测（缓存清单/策略函数）+ runner（SW 注册、离线导航命中缓存、模拟更新提示出现与刷新）。

## 6. 灯箱增强（缩放 + 幻灯片 + 下载；不含 EXIF）
- 缩放：滚轮（含 Ctrl 语义统一）、双击切换 1x/2x、移动端双指捏合；缩放态禁用翻页手势、Esc 先退缩放；平移边界限制。
- 幻灯片：按钮启停、间隔配置 `slideshowIntervalMs`（默认 4000）、可见性暂停、reduced-motion 降级为不自动播放。
- 下载：原图下载按钮（`download` 属性 + 原图路径）。
- 配置：`features.lightbox` 增 `zoom{enabled,maxScale:4}`、`slideshow{enabled,intervalMs}`、`downloadButton:true`；测试：缩放数学单测 + runner（滚轮/双击/捏合、幻灯片推进与暂停、下载属性）。

## 7. 文章导出（打印 PDF + 复制 Markdown）
- 打印：文章 `@media print` 样式（隐藏导航/侧栏/工具，保留正文与来源）+「打印/另存 PDF」按钮 → `window.print()`。
- Markdown：构建期输出 `/md/<lang>/<slug>.md`（原始正文）；按钮 fetch → 剪贴板 → toast。
- 配置 `features.exportArticle`：`print:true`、`markdown:true`；测试：build-smoke（md 文件存在、内容非空）+ runner（复制载荷=md 文本、打印按钮存在）。

## 5. 双语对照（切换 + 宽屏并排）
- 文章页「中/EN」切换按钮（同 slug 另一语言；缺失隐藏）；URL 就地对换（软导航）。
- 宽屏 ≥1280px 提供「并排对照」开关：fetch 对方 HTML → 提取 `.post-content` 渲染右栏；单栏滚动同步可选（不做）；中途切换/软导航安全清理。
- 配置 `features.bilingual`：`switch:true`、`sideBySide:true`、`breakpointPx:1280`；测试：构建注入 alt URL 单测 + runner（切换、并排两栏、无对照时隐藏）。

## 9. 主题调色板编辑器（面板 tab）
- 阅读设置面板新增「主题」tab：关键 token 色板（--color-p/--color-s/--color-a/背景/正文/边框等 8–12 项）实时预览（CSSOM 变量）；预设载入、重置、「保存到本地」（localStorage 覆盖，可清除）。
- 导出：复制/下载 `theme.json5` 片段（JSON5 文本）。
- 配置 `features.themeLab`：`enabled:true`、`tokens:[...]`（白名单）；测试：序列化单测 + runner（改色→计算样式变化、保存/重置、复制载荷）。

## 10. 省流模式（自动 + 手动）
- 触发：`navigator.connection.saveData` 自动 + 手动开关（localStorage 持久）；`html.save-data` 类。
- 降级：禁动画/粒子/视差、图片选最小分辨率变体、更激进懒加载、字体仅系统栈。
- 配置 `features.saveDataMode`：`enabled:true`、`auto:true`、`manual:true`、`degrade{animations,particles,lowResImages,lazyAggressive,systemFontsOnly}`；测试：决策纯函数单测 + runner（自动/手动两态、样式与资源降级断言、持久化）。

## 收尾
- 全部完成后：总门禁（含四条 config 守卫与既有全部 verify）→ 本地验收（runner 汇总）→ 更新 README/CHANGELOG/交接文档 → **本地提交，不推送**。
- 残余记录：预算如超限按「先按需拆分，仍超则记录调整依据」处理。
