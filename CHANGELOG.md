# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- 修复 Markdown 内嵌原始 HTML 的存储型 XSS：新增 `sanitizeHtml` 白名单净化，`script/iframe/object/embed/svg/math/form` 等活动内容整块移除，`on*` 事件属性与 `style` 属性一律剥离，`javascript:`/`data:` URI 过滤，仅保留安全标签（含 `<dl>` 定义列表等既有内容所需标签）— `scripts/lib/utils.js`
- 修复搜索索引写入内联脚本的注入：`searchData` 序列化时转义 `<`（`escapeJsonForScript`），杜绝 `</script>` 标签逃逸 — `scripts/build.js`
- 修复 structuredData (ld+json) 标题/描述拼接注入：改为 JSON 结构化序列化并转义 `<` — `templates/layout.ejs`
- 修复社交联系方式弹窗 `onclick` 属性中的 JS 字符串注入：改为 `data-*` 属性 + 事件委托 — `templates/layout.ejs`
- 修复搜索结果为 `innerHTML` 注入：改为 DOM API 构建（`textContent`） — `templates/layout.ejs`
- 修复本地预览服务器路径遍历：`--serve` 下通过 `path.resolve` + 前缀校验隔离 `dist/` 目录 — `scripts/build.js`
- 清理 CSP 遗留示例域：移除 `connect-src` 中的 `https://api.example.com`；`style-src`/`font-src` 放行 `cdn.jsdelivr.net`（KaTeX 按需加载所需） — `security.json`
- `security-verify.js` 升级为语义化检查：tokenizer 感知引号属性与 RCDATA（`<title>`/`og:title` 内 `</script>` 字符实体是惰性文本而非逃逸），剥离 JS 字符串字面量后判定可执行代码，消除误报 — `scripts/security-verify.js`
- 消除 Worker 双配置漂移：`workers/security-worker.js` 改为读取构建时从 `security.json` 生成的 `workers/security-config.js`（单源配置，自动生成不入库），Worker 与 `_headers` 的 CSP/限流/路径限制/安全头从此一致；新增 `scripts/generate-security-config.js` 与 6 项单元测试（总计 51 项）

### Added

- **配置系统扩展（mega expansion）**：
  - 新增 `features.json5` 功能总控域：38 个功能模块、355 个可配置项（灯箱/进度条/快捷键/TTS/阅读面板/KaTeX/Mermaid/双链/系列/分享/打赏/画廊/热力图/统计等），每项均有注释、默认值等于此前行为，可任意开、关、微调 — `scripts/lib/features-schema.js`（单一真源 + 校验）
  - 配置文件/文章数据全量合法校验：JSON5 语法错误 → 构建终止并输出文件路径 + 行/列 + 3 行上下文 + `^` 定位 + 中文原因与修复提示（`scripts/lib/config-error.js`）；未知模块名 warning 防拼写错误；文章 slug 重复/日期非法 → 构建报错跳过；tags 非数组自动按逗号拆分
  - 新增 `docs/config-reference.md`：9 章逐字段权威参考文档
- **批 1（阅读体验）**：图片灯箱（键盘/触屏滑动/画廊联动）、文章置顶（pinned，全列表徽标 + 置前排序）、CJK 字数统计、阅读设置面板（字号/行高/宽度滑杆 + 重置 + localStorage）、快捷键面板（`/` 搜索、`D` 主题、`J`/`K` 上篇下篇、`?` 帮助）、TTS 朗读（`speechSynthesis` + 倍速）、移动端目录抽屉、内容区 1600px 居中布局 — `templates/*` + `scripts/build.js`
- **批 2（内容体系）**：KaTeX 数学公式（`$`/`$$` 按需注入，strict 关闭抑制中文噪音）、Mermaid 图表（按需 + `securityLevel: strict` + 暗色主题联动）、文章系列（front-matter `series`，侧栏 widget + 卡片徽标 + 上一篇/下一篇面板）、Wiki 双链（`[[标题]]` 自动转站内链接，未知目标回退纯文本）、标签别名（`tag-aliases.json` 多对一归一，如 `js`→`JavaScript`）、分享按钮（7 平台零依赖内联图标，微信/复制为剪贴板）、友情链接页（`/links/` + 导航自动菜单 + 侧栏 widget）、打赏（`reward` 配置：二维码图片/外链 + 弹窗展示）
- **批 3（站点运维）**：SEO 标题模板（`titleTemplate` 首页/文章/默认）、JSON Feed（`/feed.json`，与 RSS 同源同裁剪）、Cloudflare Web Analytics（token 走环境变量 `CF_WEB_ANALYTICS_TOKEN` 或配置）、AVIF 变体（`build.avif` 开关节省 40% 体积）、内容导入 CLI（`npm run import -- --from hexo|hugo|wordpress`）、维护模式（Worker 环境变量 `MAINTENANCE=1` → 503 页 / 本地 `--serve --maintenance`）、重定向（`redirects` 数组 → `_redirects` + 本地 301/302 通配匹配）
- **批 4（归档与统计）**：图片图库页（`/gallery/` 瀑布流聚合所有文章图片，点击复用灯箱）、归档热力图（按年 12 月色阶格子 + 悬停提示 + 图例）、归档统计卡（文章数/发文天数/总字数/日均/标签/分类）、侧栏站点统计 widget（默认关闭）、阅读进度条增强（贴底小圆点 + 点击跳转 + 悬停百分比提示）
- **Markdown 扩展**：`supSub` 上标/下标（`X^2^`/`H~2~O`）+ `mathGuard` 保护公式（`$...$`/`$$...$$` 优先于上标处理，修复 `$E=mc^2$` 被解析成上标的问题） — `scripts/build.js`
- 新增 10 篇覆盖性测试文章 + 5 张程序化生成本地图片（`scripts/generate-test-media.js` 可再生成）；新增 `pinned-check.md`/`math-katex.md`/`mermaid-chart.md`/`wiki-links.md`/`series-part-1..3.md`/`alias-tags.md` 等
- 新增 `scripts/import.js`，`npm run import` 支持 Hexo/Hugo/WordPress XML 导入
- 新增 `scripts/generate-security-config.js`（Worker 配置自动生成）
- 新增 `docs/config-reference.md`；README 全面更新

### Changed

- HTML 压缩器从 `html-minifier` 4.0.0（已停止维护，存在 REDoS）替换为 `@minify-html/node` 0.18.1
- `sharp` 0.33.5 → 0.35.4（修复 libvips CVE-2026-33327/33328/35590/35591）
- `wrangler` 4.112.0 → 4.129.0（devDependency）
- 新增 `engines.node: >=20.9.0` 声明（sharp 0.35 硬性要求）；配置文件系统默认解析 `features.json5`（可选，缺失回退内建默认）
- 内容区宽度改为 1600px 居中（原 flex:1 全宽）
- `sanitizeHtml` 放行站内 `<video>`/`<audio>`：媒体 `src` 仅允许站点本地路径（无协议/相对），绝对 URL 与协议相对 URL 被剥离
- 本地预览服务器（`--serve`）：404 回退页现在返回真实 `404` 状态码（此前恒为 200）；扩展 MIME 表覆盖视频/音频/字体/文档类型；支持 `--maintenance`
- CI 构建节点 Node 20 → 24 LTS；新增主分支 `npm audit --audit-level=high` 门禁与 `npm test`

### Fixed

- `media-manifest.json` 键/值补全 `/media/` 前缀，修复本地图片 `<picture>`/WebP/`srcset` 响应式管线（此前用外链 SVG 未触发该分支，本地图片测试挖出）
- `sanitizeHtml` 白名单补 `picture`/`source` 标签与 `srcset`/`sizes`/`loading` 属性（响应式图片曾被当作未知标签转义）
- 前置锚点标题被固定顶栏遮挡：`html { scroll-padding-top: calc(var(--hh) + 18px) }` 全局方案（断点自适应）
- 上标/下标与 KaTeX 冲突（`mathGuard`）；KaTeX 中文报错（`strict: false`）
- 分页/进度条件渲染若干模板拼接问题

### Accessibility

- Lighthouse 全面审计并修复可达性问题（首页+文章页 × 桌面/移动 × 亮/暗均 100 分）：
  - 搜索/暗色切换/返回顶部/移动菜单按钮补充 `aria-label`；分页 `aria-label` 与可见文本失配（label-content-name-mismatch）移除，保留 `aria-current`
  - 全局对比度提升：亮色 `textLight` `#a0aec0` → `#64748b`、`secondary` `#4a90d9` → `#2563eb`、`accent` `#e53e3e` → `#c53030`；暗色新增 `secondary` `#7caeff` 与 `accent` `#fca5a5` 覆盖（`--color-s`/`--color-a` 暗色下同步切换） — `theme.json`/`templates/layout.ejs`
  - 分页禁用项与标签云计数去掉 `opacity` 弱化、改用可读色；`footer-powered` 链接加下划线（link-in-text-block）；文章 footer（免责声明）暗色配色覆盖 — `templates/layout.ejs`
  - 任务列表 checkbox 增加 `aria-label="任务"`（marked `renderer.checkbox` 覆写），`sanitizeHtml` 放行 `aria-*` 属性白名单；标题层级测试文章补齐 h3/h2 过渡 — `scripts/build.js`/`scripts/lib/utils.js`

### Docs

- 新增 `docs/config-reference.md`（9 章：site/theme/features/navigation/sidebar/footer/security/content-policy/tag-aliases+friends，含校验行为、环境变量表、重定向/友链/标签别名示例）
- README 全面更新：目录结构、配置详解、构建管线、交互功能、NPM 速查、测试表、技术栈

[1.0.1]: https://github.com/stop666two/S-ynapse/releases/tag/v1.0.1
