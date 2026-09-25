# S-ynapse

> 思考的突触 — 极简、安全、高性能的 Cloudflare 静态博客系统

基于 Cloudflare 生态的静态博客生成器。Markdown 写作，JSON5 配置，一键部署到 Cloudflare Pages。

**项目仓库**：https://github.com/stop666two/S-ynapse

## 项目文档

点击对应的文档即可跳转阅读，每个文档的用途如下：

| 文档 | 用途 |
| --- | --- |
| [配置参考](docs/config-reference.md) | 全部 13 个配置文件（site/theme/tuning/navigation/sidebar/footer/security/features/ui-strings/content-policy/tag-aliases/friends/guard）的逐字段权威说明：每个配置项的含义、可填值、推荐值与默认值，以及值域校验、环境变量、重定向/友链/标签别名示例 |
| [变更日志](CHANGELOG.md) | 按版本号记录本项目的全部变更：安全修复、新增功能、配置项变化，遵循 Keep a Changelog 格式，每个条目注明涉及的源文件 |
| [增量构建设计](docs/incremental-build-design.md) | 增量构建（`--watch`）的架构设计文档：哈希指纹缓存、按页面拆分构建、默认跳过未变化源的完整方案 |

## 特性

**全配置驱动**
- 13 个 JSON5 配置文件（支持注释），**2000+ 可配置项**（实测 2525 项，按叶子键递归统计：对象逐层展开、数组元素逐项计入），逐字段中文注释（含可填值/推荐值/禁用值/注意事项）
- `features.json5` 功能总控域：**95 个模块、803 个配置项**（同一口径递归统计），每项功能均可开/关/微调；`tuning.json5` UI 微调层（32 分类 / 204 项）
- 社交链接支持每项独立开关（github/twitter/weibo 等可选）
- 配置校验：JSON5 语法错误即终止构建，输出文件/行列/上下文/原因/修复提示；20+ 项值域校验
- 详细参考文档：`docs/config-reference.md`（11 章，逐字段权威参考）

**内容创作**
- Markdown 扩展：上标/下标（`X^2^` / `H~2~O`）、KaTeX 数学公式（`$`/`$$`）、Mermaid 图表、Wiki 双链（`[[标题]]`）、定义列表、任务列表
- 文章系列（front-matter `series`）、置顶（`pinned`）、标签别名归一
- 内容导入：`npm run import` 支持 Hexo / Hugo / WordPress XML
- 本地图片管线：WebP/AVIF + 多尺寸 `srcset` + 懒加载 + SVG 消毒；`media/`/`videos/`/`assets/` 三目录白黑名单内容策略

**阅读体验**
- 暗黑模式（跟随系统 / 手动切换，无闪烁）+ **深色定时切换**（`themeSchedule`，固定时段）
- **主题预设切换器**（9 套调色盘：Classic Blue / Cyber Purple / Forest Green / Sakura Pink / Editorial Gray / Midnight Black / Amber Coffee / Ocean Teal / Plum Wine，localStorage 持久化）
- 全文搜索（Ctrl+K 快捷键，搜索标题 + 正文 + 标签，**键盘方向键导航 + 搜索历史**）
- **Giscus 评论**（基于 GitHub Discussions）、**内容级双语**（zh/en：文章分目录 + 全文翻译 + URL 语言前缀 + 界面语言化）
- 文章目录 TOC（侧边栏自动提取 h2-h4，移动端抽屉；**进度线 + URL 锚点 + 已读淡显**）
- 图片灯箱（键盘 / 触屏滑动 / 图库页联动；**_缩放 / 平移 / 旋转 / 双指**）
- 阅读设置面板（字号/行高/宽度滑杆）、阅读模式（一键隐藏侧边栏）
- 阅读进度条（点击跳转 + 百分比提示）+ 返回顶部 + **阅读侧栏**（进度环 / 回目录 / 回顶）
- TTS 朗读（倍速可调）、快捷键（`/` 搜索、`D` 主题、`J`/`K` 翻篇、`?` 帮助）
- 关联推荐（同标签/同分类）、CJK 中英文自动加细空格
- **代码高亮体系**（本地 Prism + `theme.codeHighlight.palette` 浅色/暗色两套 token 配色，随明暗自动切换；文章内 Mac 窗栏样条）
- **文章封面样式库**（渐变/条纹/圆点/气泡/网格，在线预览）

**站内体系**
- 归档热力图（按年 12 月色阶）+ 统计卡（文章/天数/字数/日均/标签/分类）
- 图库页 `/gallery/`（聚合所有文章图片，瀑布流 + 灯箱）
- 分享按钮（7 平台零依赖）、打赏弹窗、友情链接页、联系方式弹窗
- **每日一言**（侧栏，内置 7 条按日期轮换）、**收藏**（纯前端 localStorage，`/favorites/`）
- RSS + JSON Feed、**sitemap 按类型拆分**（URL 超阈值自动分文件）、搜索索引、PWA、构建报告
- **侧栏拖拽重排**（桌面拖拽 + 移动端长按，localStorage 持久化）、**404 页美化**（插图 + 搜索 + 热门文章）
- **Pagefind 全文搜索**（`navigation.search.provider='pagefind'` 且 `features.pagefind.enabled` 时生效，离线索引；**构建在压缩与哈希之后自动生成索引到 `features.pagefind.indexPath`（默认 `/pagefind`，不参与 cache-bust）；未安装 `pagefind` 依赖时告警跳过（按需安装：`npm install -D --save-exact pagefind`）；serve/watch 模式同样生成，保证预览与生产一致**）

**安全加固**
- Markdown 内嵌 HTML 白名单消毒（XSS 防护，含 SVG 消毒）
- 外部链接安全警告弹窗，白名单/黑名单双轨控制
- CSP 内容安全策略自动生成（`security.json5` 单源同步 `_headers` 与 Worker 安全层）
- HTTP 安全头（HSTS, X-Frame-Options, Permissions-Policy 等）
- 速率限制 + 路径访问控制 + 维护模式（需 Workers，配置单源同步）
- 内置 `npm run verify:security` 集成安全回归（真实构建注入恶意文章断言）

**性能极致**
- 全静态 HTML，全球 CDN 加速
- HTML/CSS/JS 自动压缩（`@minify-html/node`），内容哈希缓存
- 图片 WebP + AVIF + 多尺寸响应式；图片懒加载；本地 vendor 资产（Prism/Mermaid/KaTeX/字体）免 CDN

**开发者体验**
- 草稿预览：`npm run dev` 自动包含草稿文章
- 构建报告：每次构建生成 `build-report.html` 含详细统计（含内容策略拦截清单）
- 单元测试：`npm test` 覆盖核心纯函数与 Worker 安全层（267 项 / 54 组）；`npm run lint` 提供 ESLint 静态检查
- 增量构建设计文档：`docs/incremental-build-design.md`

---

## 快速开始

```bash
# 1. 安装依赖（自动配置 git hooks）
npm install

# 2. 构建站点
npm run build

# 3. 启动本地预览（构建后自动启动服务器）
npm run serve

# 访问 http://localhost:3000 即可预览
```

> [!NOTE]
> **Node 版本要求**：本项目要求 Node.js `^20.19.0 || ^22.13.0 || >=24`（`eslint` 10 与 `typescript` 的引擎下限，同时满足 `sharp` 0.35），CI 使用 Node 24 LTS。
>
> **npm 12（及以上）本机部署注意**：npm 12 默认禁止依赖的 `postinstall` 脚本（如 `esbuild`、`workerd` 的二进制下载），会导致本机 `npx wrangler deploy` 失败或部分依赖不完整。受影响的本机操作：
> - 解决方案一（推荐）：经 `npm install --ignore-scripts` 后，再用 `npm rebuild --foreground-scripts esbuild workerd` 手动触发二进制下载；
> - 解决方案二：使用 Node 20/22 附带的 npm 10（CI 环境为 npm 10，无此问题）；
> - 构建站点（`npm run build`）本身不受影响，仅在本地执行 wrangler 部署命令时需要注意。

### Windows 快捷脚本

| 脚本 | 功能 |
|------|------|
| `build.bat` | 双击一键构建（使用 `npm ci` 确保可复现） |
| `serve.bat` | 双击一键构建 + 启动本地服务器（自动清理旧进程） |

---

## 目录结构

```
S-ynapse/
├── articles/          # Markdown 文章（按语言分目录：zh/ 中文、en/ 英文，front-matter: title/slug/tags/categories/date/draft/pinned/series/featuredImage）
├── pages/             # 自定义页面 & 可复用内容块（博客底部公告、关于、隐私、条款等）
├── media/             # 图片资源（自动优化：WebP/AVIF/尺寸变体 + SVG 消毒）
├── videos/            # 视频资源（可选，按需创建；content-policy 排除制过滤后复制）
├── assets/            # 素材文件（可选，按需创建；PDF/文档/压缩包/音频/字体，content-policy 白名单）
├── static/            # 静态文件（直接复制到输出）
├── js/                # 前端 ESM 源码（core/ 入口与运行时 + domains/{core,features,guard}/ 领域模块；构建复制到 dist/assets/js/）
├── templates/         # EJS 模板
│   ├── layout.ejs     # 基础布局（CSS变量 + 暗黑模式 + 搜索 + 链接警告 + 灯箱）
│   ├── site-css.ejs   # 全站样式表（构建期注入 layout，压缩后随页面内联）
│   ├── index.ejs      # 首页（分页）
│   ├── post.ejs       # 文章页（TOC + 系列 + 分享 + 打赏 + 关联推荐 + 评论）
│   ├── archive.ejs    # 归档页（统计卡 + 热力图）
│   ├── tags.ejs       # 标签云
│   ├── tag.ejs        # 标签文章列表
│   ├── categories.ejs # 分类列表
│   ├── category.ejs   # 分类文章列表
│   ├── gallery.ejs    # 图库页（瀑布流聚合）
│   ├── links.ejs      # 友情链接页
│   ├── page.ejs       # 自定义页面
│   ├── search.ejs     # 搜索页
│   ├── favorites.ejs  # 收藏页（纯前端 localStorage）
│   └── 404.ejs        # 404 页
├── scripts/
│   ├── build.js       # 构建脚本（14 步管线）
│   ├── build.test.js  # 单元测试（主套件）
│   ├── robots.test.js # robots/sitemap 工具单测
│   ├── csp.test.js    # CSP 裁剪规则单测
│   ├── security-worker.test.js  # Worker 安全层单测 + 集成
│   ├── security-verify.js  # 安全集成验证（注入恶意文章→构建→语义断言）
│   ├── check-config-consistency.js # 配置一致性监守（默认值 vs 配置文件）
│   ├── a11y-audit.js  # WCAG 无障碍审计（axe-core + Chrome）
│   ├── import.js      # 内容导入 CLI（hexo/hugo/wordpress）
│   ├── export.js      # 备份导出 CLI（配置 + 文章 + 媒体打包）
│   ├── audit-media.js # 媒体审计（--json / --duplicates）
│   ├── generate-og.js # 自动 OG 图生成（serve 模式跳过）
│   ├── generate-security-config.js # 从 security.json5 生成 Worker 配置
│   ├── generate-test-media.js      # 程序化生成测试图片
│   ├── init-project.js# 项目初始化（自动配置 git hooks/gitignore/gitattributes）
│   └── lib/
│       ├── utils.js           # 工具函数库（formatDate/safeSlug/stripHtml/CJK 空格等）
│       ├── content-policy.js  # 三目录内容策略判定（白名单/黑名单/SVG 消毒）
│       ├── features-schema.js # features 默认 schema 单一真源 + 校验
│       ├── theme-presets.js   # 9 套主题预设定义与校验
│       ├── config-error.js    # JSON5 错误格式化（文件/行列/上下文/提示）
│       ├── robots.js          # robots 逐语言 Sitemap/lastmod/编码纯函数
│       ├── csp.js             # CSP 指令按功能开关裁剪纯函数
│       ├── related.js         # 关联文章评分（同标签/同分类权重）
│       ├── feed-options.js    # JSON Feed 选项归一（jsonFeed.* 优先）
│       ├── perf-budget.js     # 页面体积/请求数预算检查
│       ├── site-defaults.js   # 站点/主题等默认值注册表（配置监守用）
│       ├── tuning-defaults.js # tuning 默认值注册表（配置监守用）
│       └── guard-defaults.js  # guard 默认值注册表（配置监守用）
├── workers/           # Cloudflare Worker 安全层
├── .github/workflows/ # CI/CD 自动部署（含 AGENTS.md 检测 + npm audit 门禁）
├── .githooks/         # Git hooks（pre-commit 保护 AGENTS.md）
├── docs/              # 设计文档（config-reference / incremental-build-design）
├── site.json5          # 站点配置（信息/SEO/RSS/JSON Feed/社交/构建开关）
├── theme.json5         # 主题配置（颜色/字体/布局/文章页脚）
├── features.json5     # 功能总控（95 模块/800 项，可开关/微调，可选文件）
├── ui-strings.json5   # 界面文案词典（zh/en 双语词典，服务端 ui() + 运行时 __T()，可选）
├── tuning.json5       # UI 微调参数层（32 分类/204 项，注入 CSS 变量；行为参数运行时读取，可选）
├── guard.json5        # 防护与交互控制域（11 个模块/171 项：右键/复制/选择/快捷键/水印/检测/控制台/隐私帘/篡改监视/访问门槛，逐项注释，可选）
├── navigation.json5    # 导航配置
├── sidebar.json5       # 侧边栏配置（含 series/friends/stats/quote 组件）
├── footer.json5        # 页脚配置
├── security.json5      # 安全策略（CSP/限流/路径/头/robots/转向）
├── content-policy.json5 # 内容策略（media/videos/assets 白黑名单，可选）
├── tag-aliases.json5   # 标签别名映射（可选）
├── friends.json5       # 友情链接数据（可选）
├── .env.example       # 环境变量模板（CF_API_TOKEN / NODE_ENV / SITE_URL / CF_WEB_ANALYTICS_TOKEN）
├── .gitattributes     # Git 属性配置
├── eslint.config.js   # ESLint 10 扁平配置（js/scripts/workers 三层）
├── tsconfig.json      # TypeScript checkJs 配置（scripts/lib 渐进类型检查）
├── build.bat          # Windows 一键构建
├── serve.bat          # Windows 一键启动服务器
├── wrangler.toml      # Cloudflare Pages 部署配置
└── package.json       # 依赖管理
```

---

## 配置文件详解

所有配置文件使用 JSON5 格式，支持 `//` 注释、尾随逗号、无引号键名。语法错误会在构建时终止并**精确报告位置与原因**。

| 文件 | 职责 | 必填 |
|------|------|------|
| `site.json5` | 站点信息、SEO、RSS/JSON Feed、社交、构建开关 | ✅ |
| `theme.json5` | 颜色（亮/暗）、字体、布局微调、文章页脚说明栏 | ✅ |
| `features.json5` | 95 个功能模块的开关/参数（灯箱、进度条、快捷键、公式、分享、预设、定时、收藏、评论…） | 可选（缺失回退默认，功能保持） |
| `ui-strings.json5` | 界面文案词典（zh/en 双语，i18n 切换的文案来源） | 可选（缺失回退内置文案） |
| `tuning.json5` | UI 微调参数层（32 分类 / 204 项：排版/间距/圆角/动效/组件细节，注入 CSS 变量） | 可选 |
| `guard.json5` | 防护与交互控制域（11 个模块 / 171 项（口径：对象逐层展开、数组元素逐项计入）：自定义右键菜单、复制控制/署名、选择控制、快捷键拦截、水印、检测与控制台反制、窗口隐私帘、篡改监视、访问门槛、绕过通道等） | 可选（缺失时防护功能关闭） |
| `navigation.json5` | 菜单、导航栏、社交顺序、搜索 | ✅ |
| `sidebar.json5` | 侧栏组件序列（author/recent/tags/categories/archive/series/friends/stats/quote…） | ✅ |
| `footer.json5` | 页脚列、版权、备案、社交、Powered-by | ✅ |
| `security.json5` | CSP、安全头、限流、路径限制、robots | ✅ |
| `content-policy.json5` | media/videos/assets 三目录白黑名单（可选） | 可选 |
| `tag-aliases.json5` | 标签别名归一（可选） | 可选 |
| `friends.json5` | 友情链接（可选） | 可选 |

> 📖 **完整逐字段参考**：`docs/config-reference.md`（11 章：每个配置项的类型、默认值、取值、校验行为）。

### site.json5 — 站点核心信息（节选）

```json5
{
  title: "S-ynapse",              // 站点标题（浏览器标签栏）
  subtitle: "思考的突触",          // 副标题（首页顶部）
  description: "个人技术博客",      // 站点描述（SEO）
  author: "Your Name",             // 作者名称
  url: "https://synapse.dev",      // 站点根 URL（必填）
  postsPerPage: 10,                // 每页文章数

  rss: {
    enabled: true,
    path: "/feed.xml",
    fullContent: true,
    maxItems: 50,
    jsonFeed: { enabled: true }    // JSON Feed → /feed.json
  },

  seo: {
    ogImage: "/media/og-image.svg",
    canonicalURL: true,
    structuredData: { enabled: true, type: "BlogPosting" },
    titleTemplate: {               // SEO 标题模板（可含 {site}/{title}/{subtitle}）
      index: "{site} · {subtitle}",
      post: "{title} | {site}",
      default: "{title} | {site}"
    }
  },

  reward: {                        // 打赏（post.ejs 弹窗）
    enabled: false,
    wechat: { label: "微信", image: "/media/reward-wechat.png", url: "" },
    alipay: { label: "支付宝", image: "/media/reward-alipay.png", url: "" },
    custom: [],  // 其他方式数组 { label, image, url }
    note: "感谢支持！"
  },

  redirects: [],                   // 重定向 [{ from, to, permanent }]，支持 * 通配

  webAnalytics: { enabled: true, token: "" },  // CF Web Analytics（token 或环境变量）

  build: {                         // 30+ 构建开关
    cleanDist: true,
    minifyHTML: true, minifyCSS: true, minifyJS: true,
    optimizeMedia: true,
    avif: { enabled: false, quality: 50, effort: 6 },
    enableCacheBusting: true,
    relatedArticles: true,
    generateGallery: true,
    cjkSpacing: true,
    buildReport: true,
    forceContentWidth: true,       // 无侧栏页面强制与有侧栏同宽
    ...
  }
}
```

### features.json5 — 功能总控魔方

`features.json5` 是全部交互与内容功能的统一开关域：95 个模块、802 个配置项，逐项中文注释。几例：

```json5
{
  lightbox: { enabled: true, zoomEnabled: true, panEnabled: true, rotateEnabled: true, pinchEnabled: true, zoomStep: 0.25, minSize: 60, closeButton: true, keyboardNavigate: true },
  math:     { enabled: true, version: "0.16.22", inlineDelimiters: ["$"], blockDelimiters: ["$$"], throwOnError: false },
  readingProgress: { enabled: true, articleOnly: true, clickToJump: true, showDot: true, tipDisplayMs: 500 },
  shortcuts: { search: "/", toggleTheme: "d", nextPost: "j", prevPost: "k", help: "?" },
  tts: { enabled: true, rate: 0.5, pitch: 1, volume: 1, voiceBy: "lang" },
  share: { enabled: true, order: ["weibo", "qq", "wechat", "x", "facebook", "mail", "copy"] },
  heatmap: { enabled: true, levels: 5, scaling: "auto", showLegend: true },
  ...
}
```

**要点**：
- 缺失 `features.json5` 文件 → 完全回退内建默认（与旧版本行为一致），不报错
- 未知模块名 → 构建警告（防拼写错误）；非法值（如枚举外取值）→ 构建终止并定位
- `share.order` 等数组字段为**整体替换**语义（deepmerge 不会拼接），删掉某平台即从页面消失
- 模块与页面绑定：`enabled: false` 时对应元素零残留（不渲染 + 不加载对应资源；Prism/Mermaid/KaTeX/字体均为本地 vendor）

### security.json5 / content-policy.json5

`security.json5` 是**唯一安全配置源**：构建时生成 `_headers` + `workers/security-config.js`（Worker 运行时读取），CSP/限流/路径限制/安全头两边永远一致。`content-policy.json5` 则规定 `media/`（图片白名单 + SVG 消毒）、`videos/`（排除制 = 除可执行与渲染型文档外放行）、`assets/`（素材白名单）三目录的构建期过滤——被拦截文件不复制进 `dist/`（线上 404），并在构建报告中逐条列出原因。

---

## 社交链接配置

社交链接支持 **link**（跳转）和 **popup**（弹窗复制）两种类型：

| 类型 | 行为 | 必填字段 |
|------|------|----------|
| `link` | 点击跳转到 URL | `url` |
| `popup` | 弹窗显示联系方式，支持一键复制 | `value`, `popupTitle`, `popupContent` |

内置图标支持：`github` / `x` / `weibo` / `telegram` / `facebook` / `rss` / `email` / `phone` / `qq` / `qqgroup` / `wechat`，未匹配到的 key 使用通用地球图标。

在 `navigation.json5` 的 `socialInNav.order` 中控制显示顺序。社交图标按钮支持 **title 悬浮提示**。

---

## 文章格式

```markdown
---
title: 文章标题
slug: my-post                 # 可选，缺省取 title
tags: ["技术", "教程"]
categories: ["编程"]
description: "自定义描述"
featuredImage: "/media/image.jpg"   # 可选，无则自动生成 OG 图
date: 2026-07-13
draft: true                    # 设为 true 则在生产构建中跳过
pinned: true                   # 置顶（列表置前 + 徽标）
series: "示例系列"               # 系列名（侧栏系列组件 + 文章底部导航）
---

# 文章标题

**扩展语法**：
- 上标/下标：`X^2^`、`H~2~O`
- 行内公式：$E = mc^2$（KaTeX）
- 块级公式：$$ \int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi} $$
- 图表（mermaid 代码块）：
	```mermaid
	flowchart TD
	  A[开始] --> B[结束]
```
- Wiki 双链：`[[其他文章标题]]`、`[[slug|自定义文本]]`、`[[外链 https://...]]`，未知目标回退纯文本
```

**URL 生成规则**：slug > 文件名 title > 正文第一个一级标题；一个文件只允许一个一级标题。

**草稿机制**：`draft: true` 的文章在 `npm run build` 中被跳过，但在 `npm run dev` 中会包含。

**封面图**：未设置 `featuredImage` 的文章会在构建时根据标题自动生成 OG 图片（SVG，1200×630）。

---

## 构建管线

构建脚本执行 14 步（步骤编号对应构建日志输出）：

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 加载配置 | 13 个 JSON5 配置（含 tuning.json5 与 guard.json5）+ 可选 content-policy.json5/tag-aliases.json5/friends.json5，合并默认值，语法错误即终止（报告文件/行列/原因），20+ 项值域校验 + features 95 模块结构校验 |
| 2 | 设置输出目录 | 清空 `dist/` 并创建子目录 |
| 3 | 复制静态文件 | `static/` → `dist/`；按 content-policy.json5 过滤 videos/、assets/ 与媒体（SVG 消毒、可执行拦截），被拦文件 404 且列入构建报告 |
| 4 | 媒体优化 | sharp 生成 WebP/AVIF + 多尺寸响应式图片（输出 manifest） |
| 5 | 处理文章 | Frontmatter 校验（slug 唯一/date 合法）→ 上标/公式守护 → Markdown → Wiki 双链 → CJK 空格 → 提取 TOC |
| 6 | 生成页面 | 首页分页、文章（系列/分享/打赏/关联/评论）、归档（统计+热力图）、标签、分类、图库、友链、搜索、404 |
| 7 | RSS 与 JSON Feed | feed.xml（全文/摘要，上限 maxItems）+ feed.json（`site.rss.jsonFeed.*` 选项优先，回退 `site.rss.*`） |
| 8 | Sitemap | sitemap.xml（含自定义页面 + 图库；超过阈值自动按类型拆分为 sitemap-{n}.xml + 索引）；其后执行自动 OG 图生成与 sitemap ping（可选） |
| 9 | 搜索索引 | search-index.json（局部模糊匹配；`features.search.includeContent` 控制是否含正文） |
| 10 | 安全文件 | `_headers`（CSP + HSTS + 安全头，按功能开关自动裁剪）、`robots.txt`（逐语言 Sitemap 行）、`_redirects`（配置重定向）、Worker 配置生成 |
| 11 | 压缩 | 压缩 HTML（@minify-html）、CSS（CleanCSS）、JS（Terser）；此前先完成前端资产拷贝（js/ ESM → `dist/assets/js/`，vendor 与 KaTeX 字体 → `dist/assets/vendor/`） |
| 12 | 缓存破坏 | MD5 内容哈希重命名文件，更新 HTML 引用 |
| 13 | PWA | manifest.json + Service Worker（启用时；执行顺序在压缩之前） |
| 14 | 构建报告 | build-report.html（耗时/文章数/体积/功能状态/内容策略拦截清单） |

> **执行顺序说明**：日志编号按功能命名输出；实际调用顺序中 13（PWA）先于 11（压缩）执行；Pagefind 索引（可选）在缓存破坏之后生成且不占独立编号。

**自定义页面**：`pages/` 目录下的 .md 文件在步骤 5 与 6 之间处理（`processCustomPages`），同目录内容也通过 `processPagesContent` 加载供模板嵌入（如文章底部公告栏）。**多语言**：`pages/{lang}/{file}.md` 覆盖默认文件（如 `pages/en/about.md` 提供英文标题与正文，slug 可显式声明；缺省时按标题生成，建议显式写英文 slug 避免中英路径混用）。
```

## 部署

### 方式一：Cloudflare Pages（推荐）

```bash
# 1. 构建站点
npm run build

# 2. 部署到 Pages（wrangler 4）
npx wrangler pages deploy dist --project-name=s-ynapse
```

### 方式二：Cloudflare Workers（带动态安全层）

```bash
# 1. 构建静态资源
npm run build

# 2. 从项目根目录部署 Worker（生产环境；配置文件含安全层与静态资源绑定）
npx wrangler deploy --config workers/wrangler.toml --env production
```

> **Worker 安全配置自动同步**：`npm run build` 会从 `security.json5`（唯一配置源）生成
> `workers/security-config.js`（自动生成文件，已加入 `.gitignore`，勿手改）。Worker
> 运行时读取该文件，实现边缘层与静态层 CSP/速率限制/路径限制/安全头完全一致，
> 修改安全设置只需编辑 `security.json5` 一处。

> **这是本项目的生产部署路径**：静态资产与安全层随同一次 `wrangler deploy` 发布（一个版本，可整体回滚）。
> CI 推送只执行 `wrangler pages deploy`（Pages），**不会更新生产 Worker**。
> 首次部署请配置日志隐私密钥：`npx wrangler secret put LOG_IP_SECRET --config workers/wrangler.toml --env production`；
> 部署后抽查与回滚步骤见 `docs/runbook/rollback.md`。

Worker 提供：速率限制、路径访问控制（如 `/admin/*` 仅允许特定 IP）、CSP 报告收集（`/csp-report` 端点）、HTTP 安全头注入、HTTPS 强制跳转、**维护模式**（环境变量 `MAINTENANCE=1` → 503 维护页，默认文案按 `Accept-Language` 选中/英，`MAINTENANCE_MESSAGE` 自定义覆盖）、**结构化日志**（JSON Lines：`ts`/`level`/`module`/`requestId`/`event`；`LOG_LEVEL`（默认 `info`）控制级别；每个响应携带 `X-Request-Id`（复用 CF-Ray 或生成 UUID）；IP 以短哈希关联，不落明文）。

### 方式三：GitHub Actions（CI/CD 自动部署）

项目已包含 `.github/workflows/deploy.yml`，推送 `main` 分支自动构建部署（Node 24 + `npm audit --audit-level=high` + `npm test` + `npm run lint` + `npm run typecheck` + `verify:config` + `verify:security` + `npm run test:build` 门禁），并在部署前检查 AGENTS.md 是否被误提交。

**配置步骤**：
1. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加 `CF_API_TOKEN`（如需部署）
2. 推送代码到 `main` 分支即可自动构建并部署

### 方式四：手动部署到任意静态托管

`npm run build` 生成的 `dist/` 目录可直接部署到任何静态文件服务器。

### 派生副本与回滚

- **多工作区定源**：本仓库是唯一事实源。若本机存在 `real-site/` 等派生副本（被 `.git/info/exclude` 排除、含独立 `.git`），任何修复只以本仓库为准；同步后必须用 `git diff --no-index --stat scripts/ real-site/scripts/` 与 `git diff --no-index --stat js/ real-site/js/` 核对差异归零，禁止只改副本或只改主仓库。
- **发布回滚**：见 `docs/runbook/rollback.md`（**Worker 优先**：`wrangler rollback` 同时回退脚本与静态资产；Pages 为备用路径；含 `LOG_IP_SECRET` 与部署后抽查命令）。

---

## 交互功能

| 功能 | 操作方式 |
|------|----------|
| 暗黑模式切换 | 导航栏图标，跟随系统或手动，localStorage 持久化 |
| 搜索 | `Ctrl+K` 或点击图标，搜索标题 + 正文 + 标签 |
| 快捷键 | `/` 搜索、`D` 主题、`J`/`K` 上篇下篇、`?` 帮助面板、`Esc` 关闭弹层 |
| 图片灯箱 | 点击正文/图库图片；←→ 键切换、ESC 关闭、移动端左右滑动 |
| 代码复制 | 悬停代码块右上角「复制」按钮（语言标签替换为"复制"） |
| 阅读进度条 | 文章页顶部；点击跳转位置、悬停显示百分比 |
| 阅读设置 | 文章底部齿轮 → 字号/行高/宽度滑杆 + 重置（localStorage） |
| TTS 朗读 | 文章底部喇叭按钮，倍速跟随设置 |
| 阅读模式 | 文章底部按钮，隐藏侧边栏全宽阅读 |
| 返回顶部 | 右下角 ↑ 箭头（滚动 300px 后显示，阈值可配） |
| 外部链接警告 | 点击外部链接弹窗提示，白名单域名跳过 / 黑名单拦截（可改 warn/prohibit 模式） |
| 文章目录 | 侧边栏 h2-h4 自动提取；移动端左下角目录抽屉 |
| 系列导航 | 文章底部系列面板（上一集/下一集/进度）；卡片 + 侧栏系列徽标 |
| 分享 | 文章底部 7 平台按钮（微信/复制=写剪贴板并提示） |
| 打赏 | 文章底部按钮弹窗（二维码 / 外链，`site.reward` 配置） |
| 汇总图库 | `/gallery/` 瀑布流，点击图片进灯箱 |
| 收藏 | 卡片/文章星标按钮，localStorage 持久化，`/favorites/` 页管理 |
| 每日一言 | 侧栏 quote 组件（内置语句按日期轮换） |

---

## NPM 命令速查

| 命令 | 功能 |
|------|------|
| `npm run build` | 构建站点（输出到 `dist/`） |
| `npm run dev` | 监听模式，包含草稿（文件修改自动重建） |
| `npm run serve` | 构建 + 启动本地服务器（默认 3000 端口，`--port`/`--maintenance` 可用） |
| `npm start` | 同 `npm run serve` |
| `npm test` | 运行单元测试（267 项 / 54 组） |
| `npm run test:build` | 构建管线集成冒烟（`--out` 构建到临时目录，校验关键产物与 CSP nonce；CI 运行，不进 `npm test`） |
| `npm run lint` | ESLint 静态检查（js/scripts/workers；CI 门禁） |
| `npm run audit` | 依赖漏洞扫描（固定官方 registry：本机 npm 镜像会阻断 audit 接口） |
| `npm run typecheck` | TypeScript checkJs 类型检查（scripts/lib；CI 门禁） |
| `npm run verify:security` | 集成安全回归（注入恶意文章 → 真实构建 → 语义断言） |
| `npm run perf:audit -- --url <URL>` | 可复现性能基线（Slow 4G + CPU 4x 节流 + 禁用缓存；`--runs`/`--out`/`--json`/`--chrome` 可选，Chrome 路径默认系统安装位置、`CHROME_PATH` 可覆盖） |
| `npm run import -- --from hexo --source ./hexo-blog` | 内容导入（hexo/hugo/wordpress，`--dry-run` 预览） |
| `npm run init` | 重新初始化 git hooks / gitignore / gitattributes |
| `npx wrangler pages deploy dist --project-name=s-ynapse` | 部署到 Cloudflare Pages |
| `npx wrangler deploy --config workers/wrangler.toml --env production` | 部署 Worker 安全层（含静态资源绑定） |

---

## 测试

```bash
npm test            # 180 项 / 38 组，全部通过
npm run lint        # ESLint 静态检查（js / scripts / workers）
npm run typecheck   # TypeScript checkJs（scripts/lib，渐进引入）
npm run audit:a11y  # WCAG 2.x 无障碍审计（需先在另一终端 `npm run serve -- --port 3224`；页面列表自动从 dist 派生；也可用 `node scripts/a11y-audit.js <baseUrl>` 或 A11Y_BASE 环境变量指定地址；Chrome 路径用 CHROME_PATH 覆盖；0 critical/serious/HTTP 失败门禁）
npm run verify:security   # 集成安全回归
```

| 测试套件 | 测试数 | 覆盖函数 |
|----------|--------|----------|
| formatDate | 5 | 日期格式化（含时间检测） |
| safeSlug | 5 | URL Slug 生成（含中文/混合/空值/确定性哈希兜底） |
| validateSlug | 4 | front-matter slug 强校验（分隔符/遍历/保留字符） |
| escapeAttr | 2 | HTML 属性转义（含非字符串输入） |
| escapeHtml | 2 | HTML 转义（含 null 输入） |
| stripHtml | 3 | HTML 标签剥离（含实体解码、非字符串） |
| insertCjkSpacing | 4 | 中英文自动加空格（含纯中文/纯英文边界） |
| applyCjkSpacingToHtml | 1 | HTML 安全的 CJK 空格 |
| countWordsDetail | 1 | CJK/拉丁分词计数（阅读时长用） |
| extractToc | 2 | 文章目录提取（含无标题页） |
| sanitizeHtml | 13 | 白名单消毒（含 decoding 保留/危险标签/事件属性/危险协议/绕过回归） |
| sanitizeHtml 媒体元素 | 4 | video/audio 保留与站内 src 限制 |
| sanitizeSvg | 5 | SVG 危险内容检测（含实体解码绕过） |
| escapeJsonForScript | 2 | 搜索索引嵌入 script 的安全序列化 |
| features-schema validateFeatures | 7 | features 默认/校验/枚举/数组字段 |
| theme-presets | 6 | 主题预设校验（名称/形状/覆盖结构） |
| formatConfigError | 2 | JSON5 错误格式化 |
| generate-security-config | 13 | security.json5 → Worker 配置提取/渲染 + 头名校验 |
| content-policy classifyFile | 5 | 三目录白名单/黑名单判定 |
| perf-budget | 2 | 页面体积/请求数预算判定 |
| computeRelatedArticles | 3 | 关联文章评分与截取 |
| resolveJsonFeedOptions | 1 | JSON Feed 选项归一与回退 |
| buildSitemapUrls | 6 | robots 逐语言 Sitemap 列表 |
| encodeLoc | 3 | sitemap URL RFC 3986 编码 |
| toSitemapLastmod | 3 | lastmod ISO 8601 归一/非法省略 |
| CSP trimCspDirectives（无 describe，顶层用例） | 8 | CSP 指令按功能开关裁剪 |
| workers/lib ip-utils | 5 | IPv4/IPv6 CIDR 解析与匹配 + 点段折叠 |
| workers/lib rate-limit | 2 | 限流封禁与清理 |
| security-worker integration | 13 | Worker 集成（安全头/维护模式/静态资源/错误兜底/匿名限流） |
| security-worker config resolution | 3 | 空数组 vs 缺失字段配置语义 |
| build-errors | 6 | 构建失败收集/退出码/格式化 |
| content-validate | 16 | 预校验（slug/日期/空标签/缺失媒体） |
| publish-window | 5 | 定时发布过滤 |
| asset-cache | 8 | 构建缓存键/配置指纹/命中判定 |
| mermaid-render | 22 | SSR 缓存键/块提取替换/sanitize 回退/Chrome 探测/无 Chrome 降级 |
| config-consistency（无 describe，顶层用例） | 7 | features 值与结构/死键判定 |

> `npm test` 共 **267 项 / 54 组**（Node 内置 test runner；CSP 裁剪为顶层用例；`build-smoke` 集成用例仅在 `npm run test:build` 运行）。

### 构建行为说明（2026-09 审计修复）

- **失败即阻断**：内容预校验（重复 slug、非法日期、空标签/分类、缺失 `/media` 引用）在清理 `dist/` 之前报错并终止；运行期失败（模板/feed/sitemap/媒体/OG/压缩等）会汇总打印并以非零退出码结束。本地预览可用 `npm run build -- --allow-degraded` 降级继续（退出码保持 0）。
- **定时发布**：`date` 晚于构建时间的文章视为已排期，自动排除页面、feed、sitemap 与搜索索引，并在构建日志中提示。
- **缓存策略**：`_headers` 分级缓存：`/assets/css/*`、打包产物 `app|deferred|runtime.*.js`、`/assets/config.*.json` immutable 1 年；其余 `/assets/js|vendor/*` 1 小时 + `stale-while-revalidate`；`/media|og/*` 7 天 + SWR。可用 `site.build.cacheControl: false` 关闭。
- **搜索弱网**：索引请求 5 秒超时 + 一次重试，失败展示错误态与「重试」按钮；入口按钮在模块加载前点击不再报错。
- **Worker 运行时**：`CF-Connecting-IP` 缺失时按共享桶限流（fail-closed）；配置 `LOG_IP_SECRET` 后 IP 日志哈希改用 HMAC-SHA256；`pathRestrictions: []` / `skipPaths: []` 为显式语义，仅缺失字段才回退内置兜底。
- **配置校验语义**：`npm run verify:config` 校验 features/site 等的结构与死键（键存在性、类型）；值级自定义（站点文案、OG 开关等）列为「覆盖」信息项，不影响通过。
- **运行时配置外置**：全量配置（features/tuning/guard/presets/quotes/i18n 等）写入内容寻址的 `/assets/config.<hash>.json`（immutable 缓存）；页面仅内联 ≤2KB 降级子集。启动时异步加载，失败自动重试 1 次、3 秒超时后降级为内置最小子集（fail-open），弱网/离线仍可阅读（`window.__CONFIG_OK__` 标记状态）。
- **JS 两段打包**：esbuild 产出内容哈希的 `app.<hash>.js`（首屏启动链）与 `deferred.<hash>.js`（交互/重模块聚合，按需载入）；`runtime.js` 引导脚本内容哈希单发，避免与 bundle 错配；`--no-bundle` 可回退原生 ESM 拷贝模式。
- **vendor 瘦身**：KaTeX 字体仅保留 woff2（654.9→254KB）；mermaid（3.5MB）改为页面 load 后 idle 拉取（仅图表页加载，零成本页不请求）；Prism 改为按页门控（仅含高亮代码块的页面引入，首页/列表零成本，实测首页 −82KB、请求 17→16）。
- **字体与预加载**：本地变量字体 3 个（Inter/Sora/Manrope，woff2 latin 子集）随字体栈自动生成 preload（含 fonts.css），`font-display` 可配；无冗余 preconnect。
- **预算门禁**：`[budget]` 检查 5 项：单页 HTML gzip ≤28KB、页面 HTML raw 中位 ≤50KB、内联关键配置 ≤2KB、应用 JS gzip 合计 ≤55KB、单页静态请求 ≤12；阈值见 `features.perfBudget`，`warnOnly: false` 时超限终止构建。

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 模板引擎 | EJS 3.1 |
| Markdown | marked 12（+ supSub/mathGuard 扩展） |
| 数学公式 | KaTeX（按需注入） |
| 图表 | Mermaid 11（按需注入） |
| 图片处理 | sharp 0.35 |
| HTML 压缩 | @minify-html/node |
| CSS 压缩 | clean-css 5 |
| JS 压缩 | terser 5 |
| RSS/JSON Feed | feed 4 |
| 代码高亮 | Prism 1.30（本地 vendor，多语言按需拼接） |
| 字体 | Inter / Sora / Manrope（@fontsource latin woff2，本地 vendor） |
| 前端模块 | 原生 ESM（js/core + js/domains/{core,features,guard}，无打包器） |
| 分析 | Cloudflare Web Analytics |
| 部署 | Cloudflare Pages / Workers |
| CI/CD | GitHub Actions |
| 测试 | Node.js built-in test runner |
| 静态检查 | ESLint 10（js / scripts / workers 三层） |
| 类型检查 | TypeScript 5.9 checkJs（scripts/lib，渐进引入） |

---

## License

MIT — 详见 [LICENSE](LICENSE)。

Copyright (c) 2026 stop666two
