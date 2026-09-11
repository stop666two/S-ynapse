# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3]

### Added

- **内容级双语(i18n)**:`articles/zh/` 与 `articles/en/` 双目录;19 篇文章全文翻译为英文(`scripts/build.js` 按语言扫描,文章对象带 `lang`/`langPrefix`);URL 全站语言前缀化 `/zh/slug/`、`/en/slug/`;根路径 `/` 输出中文首页 + 内置语言检测脚本(`navigator.language` 命中 en 时跳 `/en/`,localStorage `s-ss-lang` 记忆)— `templates/layout.ejs` + `scripts/build.js`
- **全站页面语言化**:首页分页、文章、归档、标签、分类、搜索、收藏、图库、友链、404 每语言一套,`generatePages` 按 `site.languages`(默认 `['zh','en']`)循环生成;`navigation.json`/`footer.json`/`sidebar.json` 新增 `labelEn`/`titleEn` 字段,`site.json` 新增 `titleEn`/`subtitleEn`/`hero.titleEn`/`hero.subtitleEn` — `scripts/build.js` `localizeNav`/`localizeFooter`/`localizeSidebar` 函数
- **SEO 分语言**:`<html lang>`(en 时 `en-US`)、`og:locale`、`og:url`(当前语言 URL)、`og:image`(`/og/{lang}/{slug}.png` 分语言目录)、`hreflang` 交替链接(自动补全 i18n.languages + 当前语言)— `templates/layout.ejs`
- **RSS/JSON Feed/sitemap/search-index 分语言**:`/zh/feed.xml` + `/en/feed.xml`、`/zh/feed.json` + `/en/feed.json`、`/zh/sitemap.xml` + `/en/sitemap.xml`、`/zh/search-index.json` + `/en/search-index.json`(条目带 `lang` 字段)— `scripts/build.js`
- **根路径重定向规则**:`dist/_redirects` 始终生成,含 `/ /zh/ 302`(首语言非 en 时)与根别名重定向(`/search-index.json`、`/feed.xml`、`/manifest.json`、`/404.html`、`/site.webmanifest` → `/zh/{alias}` 302);根 `404.html` 从 zh 版复制 — `scripts/build.js`
- **en 首页构建期英化**:`ui()` 服务端函数按 `lang` 绑定 `ui-strings.json5` 英文词典,导航/页脚/侧栏/主题预设/卡片元信息(字数/阅读时长)/搜索占位/复制提示/外部链接弹层全英化;运行时 `__T()` 继续处理动态文本 — `templates/layout.ejs` + `templates/index.ejs` + `templates/post.ejs` + `templates/category.ejs` + `templates/tag.ejs`
- **功能参数化(69 参数全量接线)**:`features.json5` 新增 69 个可配置参数并全部接线生效(motion/hero/heatmap/stats/mobile/comments/contactPopup/prevNext/imageLazy/themeToggle/themeSchedule/series/related/share/reward/gallery 等模块);`scripts/lib/features-schema.js` 同步默认值与枚举校验(labelPosition 等) — `scripts/build.js` + `templates/*.ejs`
- **scrollBehavior 模块**:统一接管全站平滑滚动——`features.scrollBehavior`(enabled/behavior/anchorOffset/respectReducedMotion);锚点偏移参数化(原硬编码 `calc(var(--hh) + 18px)`);修复桌面端硬编码 `scroll-behavior:smooth` 覆盖 reduced-motion 保护的问题;JS 滚动调用统一经 `__SB()` 读取配置 — `templates/layout.ejs` + `features.json5`
- **toast 模块**:统一轻提示系统——`features.toast`(enabled/position/durationMs/maxVisible) + `window.__toast(msg,{type,duration})` API(内置 info/success/warning/error 四类,容器 role=status);分享复制与联系复制迁移到统一 toast;移除三处旧内联提示元素/CSS(fav-toast/share-copied/contact-popup-copied) — `templates/layout.ejs` + `templates/post.ejs` + `features.json5`
- **breadcrumb 模块**:可见面包屑导航——`features.breadcrumb`(enabled/separator/showHome/showCurrent);所有页面渲染(首页/404 除外),文章页 首页 › 分类 › 标题,列表页与自定义页自动层级 — `templates/layout.ejs` + `features.json5`
- **pageTransition 模块**:页面切换过渡——`features.pageTransition`(enabled/type/durationMs/outDurationMs/respectReducedMotion/excludeSelector);内链点击淡出 → 导航 → 新页入场(slide/fade 两型);外链/新窗口/hash/下载链接与 `[data-no-transition]` 元素不拦截 — `templates/layout.ejs` + `features.json5`
- **pwa 模块**:PWA 运行时——`features.pwa`(enabled/registerSW/updatePrompt/offlineNotice);注册 service worker、SW 更新 toast 提示、离线/恢复 toast 提示(复用统一 toast);新增 `ui-strings` pwa 双语文案 — `templates/layout.ejs` + `ui-strings.json5` + `features.json5`

### Changed

- **主题预设 `theme-presets.js`**:6 套预设新增 `labelEn` 字段(Classic Blue/Midnight Black/Forest Green/Sakura Pink/Editorial Gray/Cyber Purple)
- **`site.json`**:新增 `languages: ['zh','en']`、`titleEn`、`subtitleEn`、`hero.titleEn`、`hero.subtitleEn`、`externalLinkWarning.titleEn/messageEn/confirmTextEn/cancelTextEn`
- **OG 图管线**:`scripts/generate-og.js` 按语言目录输出 `dist/og/{lang}/{slug}.png`,`usedSlugs` 按语言独立去重(zh/en 同 slug 不再冲突);移除 build.js 内联 SVG OG 管线
- **侧栏/页脚/导航配置**:全部 widget/链接/菜单项支持 `titleEn`/`labelEn`
- **旧参数清理(不兼容变更)**:`themeToggle.persistKey` 取代硬编码 localStorage 键 `theme`(默认 `ss-theme`);`themeSchedule.checkIntervalMs`(毫秒)取代 `tickMinutes`(分钟);`stats.showSidebar` 取代 `stats.sidebarWidgetDefault`;`prevNext.scrollToTopOnClick` 取代 `prevNext.scrollToTop`;`mobile.tocBreakpoint` 取代 `mobileToc.breakpoint`;`contactPopup.copySuccessText` 取代 `contactPopup.copiedText`;`series.prevLabel`/`nextLabel` 取代 `showPrevLabel`/`showNextLabel`;`motion.pageEnterDurationMs` 由 `pageTransition.durationMs` 取代 — `features.json5` + `scripts/lib/features-schema.js`
- **theme.json**:移除 `animation.scrollBehavior`(由 `features.scrollBehavior` 接管)与死配置 `animation.pageTransition`(由 `features.pageTransition` 接管),不兼容变更 — `theme.json`

### Fixed

- **TOC 滚动高亮(scrollspy)失效**:`templates/layout.ejs` 中 tocScrollSpy IIFE 结尾 `})})});` 缺少 IIFE 调用括号 `()`,导致函数只定义从未调用、进度线与当前章节高亮永不生效;修复为 `})})})();`
- **RSS 重复生成**:移除 build.js 中第二个无语言循环的旧版 `generateRSS`,避免覆盖语言版 feed
- **根路径 404**:`/search-index.json`、`/manifest.json` 等根别名路径由 500 修复为 302 重定向至语言版本
- **contactPopup en 页复制提示显示中文**:`copySuccessText` 默认值遮蔽 `__T` 双语回退;现默认留空,回退内置词典 `toolbar.copyDoneToast`(en: Copied to clipboard) — `templates/layout.ejs`
- **评论占位一次性检查**:giscus/Disqus 慢载入(超过 loadDelayMs)时占位永久显示「暂无评论」;改用 MutationObserver 持续监听,组件出现即清空占位,超时才显示 `emptyText` — `templates/post.ejs`
- **hero.backgroundImage CSS 转义错误**:HTML 转义(`&`→`&amp;`)注入 CSS `url()` 导致含查询参数的 URL 加载失败;改为 JSON 字符串化 + `<` 过滤 — `templates/layout.ejs`
- **hero 标题回退缺失**:语言首页未配置 `hero.title` 时回退 `site.title`(根页已有此逻辑,语言页缺失) — `scripts/build.js`
- **无封面卡片仅显示标题首字**:改为显示完整标题并适配多行样式 — `templates/index.ejs` + `templates/layout.ejs`
- **motion 卡片悬停缩放被 reveal 覆盖**:`.motion-reveal.in{transform:none}` 同权重且更晚,导致卡片入场后 hover scale 失效;提升选择器权重 — `templates/layout.ejs`
- **主题预设切换后 CTA 按钮颜色不跟随**:`applyPreset()` 未同步 `--bpb`(构建期按钮主色变量,默认取 secondary);现随预设 secondary 同步更新 — `templates/layout.ejs`
- **JSON-LD 面包屑缺分类层且 URL 错误**:结构化数据读取不存在的 `article.category` 字段导致缺分类层级,且链接格式为 `/category/{名称}/`(实际路由为 `/categories/{slug}/`);改用 `article.categories[0]` + 分类 slug 查找并补语言前缀 — `templates/layout.ejs`
- **PWA SW 安装失败(manifest 被重定向)**:`_redirects` 将根 `/manifest.json` 302 到不存在的 `/zh/manifest.json`,导致 `cache.addAll` 失败、service worker 安装失败;PWA 开启时不再生成该重定向 — `scripts/build.js`
- **收藏功能半成品补全**:`favBtn` 无任何 JS 逻辑(点击无反应、favToast 从未调用);现实现收藏/取消(按钮状态 + aria-pressed + 统一 toast)、localStorage 持久化、收藏页列表渲染与移除、空状态;en 页按钮文案经 `ui()` 词典 — `templates/layout.ejs` + `templates/post.ejs`
- **客户端 `__T` 语言回退**:i18n 运行时模块关闭时 `data-lang` 未设置,导致 en 页客户端文案回退中文;现回退服务端渲染的 `<html lang>` — `templates/layout.ejs`

### Security

- 保持全部既有安全修复。

## [1.0.2]

### Added

- **sitemap 按类型拆分**:`features.json5` 下 `sitemap` 段新增 `split`/`maxUrlsPerFile`(默认 500)/`postPriority`/`pagePriority`/`tagPriority`/`postFrequency`/`pageFrequency`/`tagFrequency`;URL 总数超过阈值自动拆为 `sitemap-{n}.xml` + 索引 `sitemap.xml`(`sitemapindex`)— `scripts/build.js` + `scripts/lib/features-schema.js`
- **界面双语切换(i18n)**:`ui-strings.json5` 词典 + `features.i18n`(zh/en 切换按钮、默认语言、localStorage 持久化)— `templates/layout.ejs`
- **Giscus 评论**:`features.giscus`(repo/repoId/category/categoryId/mapping/theme/loading),写入时动态加载 giscus.app 客户端 — `templates/post.ejs`
- **Pagefind 全文搜索**:`features.pagefind`(indexPath/integrate),`search.provider='pagefind'` 时启用离线搜索 UI — `templates/layout.ejs`
- **每日一言**:`features.dailyQuote`(内置 7 条按日期轮换,侧栏 widget + 文章页)— `templates/layout.ejs`
- **收藏**:`features.favorites`(纯前端 localStorage `s-favorites`,`/favorites/` 页)— `templates/post.ejs` + `templates/favorites.ejs`
- **代码主题切换器**:`features.prismTheme`(GitHub/Dark/Solarized/Django,文章内窗栏样条)`— templates/post.ejs`
- **文章封面样式库**:`features.cover`(渐变/条纹/圆点/气泡/网格,在线预览)— `templates/post.ejs`
- **侧栏拖拽重排**:`features.sidebarDrag`(桌面拖拽 + 移动端长按,localStorage `s-sidebarOrder`)— `templates/layout.ejs`
- **搜索增强**:搜索历史(最近 5 条)+ 键盘上下键导航 + 结果分组(文章/标签/分类)— `templates/layout.ejs`
- **主题预设切换器**:`features.themePresets`(6 套调色盘,localStorage `ss-preset`)— `templates/layout.ejs`
- **深色定时切换**:`features.themeSchedule`(`darkFrom` `22:00`/`lightFrom` `06:00`,固定时段自动切主题)— `templates/layout.ejs`
- **404 页美化**:插图 SVG + 搜索按钮 + 热门文章 — `templates/404.ejs`
- **灯箱缩放/平移/旋转**:`features.lightbox` 扩展(zoom/pan/rotate/pinch,双指),`templates/layout.ejs`
- **TOC 增强**:进度线 + URL 锚点 + 已读淡显 — `templates/layout.ejs`
- **阅读侧栏**:`features.readDock`(进度环 + 回目录 + 回顶)— `templates/layout.ejs`

### Changed

- **修复配置合并 bug(关键)**:`scripts/build.js` 中 `config.features` 原来经 `deepmerge({}, DEFAULT_FEATURES, features, {arrayMerge})` 合并 — deepmerge 只接受 3 参数,`features` 被当作 options,导致 **用户 `features.json5` 配置从未生效**(一直使用默认值);已修复为 `deepmerge.all([{}, DEFAULT_FEATURES, features], {arrayMerge: (t,s)=>s if Array})` — 配置链与 `docs/config-reference.md` 现在真实生效
- **README 全面更新**:配置数(11 文件/1200+ 项)、features(54 模块/440 项)、测试(67 项/17 组)、新功能列表、sitemap 拆分说明

### Security

- 保持全部既有安全修复。

### Fixed

- 修复 `features.json5` 配置不生效(deepmerge 参数错位)— 见 Changed

### Done

- `docs/config-reference.md` 补齐 sitemap/新模块章节(3.39+)

## [1.0.1]

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
