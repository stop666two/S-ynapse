# S-ynapse

> 思考的突触 — 极简、安全、高性能的 Cloudflare 静态博客系统

基于 Cloudflare 生态的静态博客生成器。Markdown 写作，JSON5 配置，一键部署到 Cloudflare Pages。

**项目仓库**：https://github.com/stop666two/S-ynapse

## 项目文档

点击对应的文档即可跳转阅读，每个文档的用途如下：

| 文档 | 用途 |
| --- | --- |
| [配置参考](docs/config-reference.md) | 全部 11 个配置文件（site/theme/navigation/sidebar/footer/security/features/ui-strings/content-policy/tag-aliases/friends）的逐字段权威说明：每个配置项的含义、可填值、推荐值与默认值，以及值域校验、环境变量、重定向/友链/标签别名示例 |
| [变更日志](CHANGELOG.md) | 按版本号记录本项目的全部变更：安全修复、新增功能、配置项变化，遵循 Keep a Changelog 格式，每个条目注明涉及的源文件 |
| [增量构建设计](docs/incremental-build-design.md) | 增量构建（`--watch`）的架构设计文档：哈希指纹缓存、按页面拆分构建、默认跳过未变化源的完整方案 |

## 特性

**全配置驱动**
- 11 个 JSON5 配置文件（支持注释），**1200+ 可配置项**，逐字段中文注释（含可填值/推荐值/禁用值）
- `features.json5` 功能总控域：**54 个模块、440 个配置项**，每项功能均可开/关/微调
- 社交链接支持每项独立开关（github/twitter/weibo 等可选）
- 配置校验：JSON5 语法错误即终止构建，输出文件/行列/上下文/原因/修复提示；20+ 项值域校验
- 详细参考文档：`docs/config-reference.md`（9 章，逐字段权威参考）

**内容创作**
- Markdown 扩展：上标/下标（`X^2^` / `H~2~O`）、KaTeX 数学公式（`$`/`$$`）、Mermaid 图表、Wiki 双链（`[[标题]]`）、定义列表、任务列表
- 文章系列（front-matter `series`）、置顶（`pinned`）、标签别名归一
- 内容导入：`npm run import` 支持 Hexo / Hugo / WordPress XML
- 本地图片管线：WebP/AVIF + 多尺寸 `srcset` + 懒加载 + SVG 消毒；`media/`/`videos/`/`assets/` 三目录白黑名单内容策略

**阅读体验**
- 暗黑模式（跟随系统 / 手动切换，无闪烁）+ **深色定时切换**（`themeSchedule`，固定时段）
- **主题预设切换器**（6 套调色盘：Classic Blue / Cyber Purple / Forest Green / Sakura Pink / Editorial Gray / Midnight Black，localStorage 持久化）
- 全文搜索（Ctrl+K 快捷键，搜索标题 + 正文 + 标签，**键盘方向键导航 + 搜索历史**）
- **Giscus 评论**（基于 GitHub Discussions）、**内容级双语**（zh/en：文章分目录 + 全文翻译 + URL 语言前缀 + 界面语言化）
- 文章目录 TOC（侧边栏自动提取 h2-h4，移动端抽屉；**进度线 + URL 锚点 + 已读淡显**）
- 图片灯箱（键盘 / 触屏滑动 / 图库页联动；**_缩放 / 平移 / 旋转 / 双指**）
- 阅读设置面板（字号/行高/宽度滑杆）、阅读模式（一键隐藏侧边栏）
- 阅读进度条（点击跳转 + 百分比提示）+ 返回顶部 + **阅读侧栏**（进度环 / 回目录 / 回顶）
- TTS 朗读（倍速可调）、快捷键（`/` 搜索、`D` 主题、`J`/`K` 翻篇、`?` 帮助）
- 关联推荐（同标签/同分类）、CJK 中英文自动加细空格
- **代码主题切换器**（GitHub / Dark / Solarized / Django，文章内 Mac 窗栏样条）
- **文章封面样式库**（渐变/条纹/圆点/气泡/网格，在线预览）

**站内体系**
- 归档热力图（按年 12 月色阶）+ 统计卡（文章/天数/字数/日均/标签/分类）
- 图库页 `/gallery/`（聚合所有文章图片，瀑布流 + 灯箱）
- 分享按钮（7 平台零依赖）、打赏弹窗、友情链接页、联系方式弹窗
- **每日一言**（侧栏，内置 7 条按日期轮换）、**收藏**（纯前端 localStorage，`/favorites/`）
- RSS + JSON Feed、**sitemap 按类型拆分**（URL 超阈值自动分文件）、搜索索引、PWA、构建报告
- **侧栏拖拽重排**（桌面拖拽 + 移动端长按，localStorage 持久化）、**404 页美化**（插图 + 搜索 + 热门文章）
- **Pagefind 全文搜索**（`search.provider='pagefind'` 时生效，离线索引）

**安全加固**
- Markdown 内嵌 HTML 白名单消毒（XSS 防护，含 SVG 消毒）
- 外部链接安全警告弹窗，白名单/黑名单双轨控制
- CSP 内容安全策略自动生成，SRI 子资源完整性
- HTTP 安全头（HSTS, X-Frame-Options, Permissions-Policy 等）
- 速率限制 + 路径访问控制 + 维护模式（需 Workers，配置单源同步）
- 内置 `npm run verify:security` 集成安全回归（真实构建注入恶意文章断言）

**性能极致**
- 全静态 HTML，全球 CDN 加速
- HTML/CSS/JS 自动压缩（`@minify-html/node`），内容哈希缓存
- 图片 WebP + AVIF + 多尺寸响应式；关键 CSS 内联；图片懒加载

**开发者体验**
- 草稿预览：`npm run dev` 自动包含草稿文章
- 构建报告：每次构建生成 `build-report.html` 含详细统计（含内容策略拦截清单）
- 单元测试：`npm test` 覆盖核心纯函数（67 项 / 17 组）
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
> **Node 版本要求**：本项目要求 Node.js ≥ 20.9.0（`sharp` 0.35 硬性要求），CI 使用 Node 24 LTS。
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
├── videos/            # 视频资源（content-policy 排除制过滤后复制）
├── assets/            # 素材文件（PDF/文档/压缩包/音频/字体，content-policy 白名单）
├── static/            # 静态文件（直接复制到输出）
├── templates/         # EJS 模板
│   ├── layout.ejs     # 基础布局（CSS变量 + 暗黑模式 + 搜索 + 链接警告 + 灯箱）
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
│   └── 404.ejs        # 404 页
├── scripts/
│   ├── build.js       # 构建脚本（14 步管线）
│   ├── build.test.js  # 单元测试（67 项 / 17 组）
│   ├── security-verify.js  # 安全集成验证（注入恶意文章→构建→语义断言）
│   ├── import.js      # 内容导入 CLI（hexo/hugo/wordpress）
│   ├── generate-security-config.js # 从 security.json 生成 Worker 配置
│   ├── generate-test-media.js      # 程序化生成测试图片
│   ├── init-project.js# 项目初始化（自动配置 git hooks/gitignore/gitattributes）
│   └── lib/
│       ├── utils.js           # 工具函数库（formatDate/safeSlug/stripHtml/CJK 空格等）
│       ├── content-policy.js  # 三目录内容策略判定（白名单/黑名单/SVG 消毒）
│       ├── features-schema.js # features 默认 schema 单一真源 + 校验
│       └── config-error.js    # JSON5 错误格式化（文件/行列/上下文/提示）
├── workers/           # Cloudflare Worker 安全层
├── .github/workflows/ # CI/CD 自动部署（含 AGENTS.md 检测 + npm audit 门禁）
├── .githooks/         # Git hooks（pre-commit 保护 AGENTS.md）
├── docs/              # 设计文档（config-reference / incremental-build-design）
├── site.json          # 站点配置（信息/SEO/RSS/JSON Feed/社交/构建开关）
├── theme.json         # 主题配置（颜色/字体/布局/文章页脚）
├── features.json5     # 功能总控（54+ 模块/440+ 项，可开关/微调，可选文件）
├── ui-strings.json5   # 界面文案词典（zh/en 双语词典，服务端 ui() + 运行时 __T()，可选）
├── navigation.json    # 导航配置
├── sidebar.json       # 侧边栏配置（含 series/friends/stats/quote 组件）
├── footer.json        # 页脚配置
├── security.json      # 安全策略（CSP/限流/路径/头/robots/转向）
├── content-policy.json # 内容策略（media/videos/assets 白黑名单，可选）
├── tag-aliases.json   # 标签别名映射（可选）
├── friends.json       # 友情链接数据（可选）
├── .env.example       # 环境变量模板（CF_WEB_ANALYTICS_TOKEN / MAINTENANCE）
├── .gitattributes     # Git 属性配置
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
| `site.json` | 站点信息、SEO、RSS/JSON Feed、社交、构建开关 | ✅ |
| `theme.json` | 颜色（亮/暗）、字体、布局微调、文章页脚说明栏 | ✅ |
| `features.json5` | 54 个功能模块的开关/参数（灯箱、进度条、快捷键、公式、分享、预设、定时、收藏、Giscus…） | 可选（缺失回退默认，功能保持） |
| `ui-strings.json5` | 界面文案词典（zh/en 双语，i18n 切换的文案来源） | 可选（缺失回退内置文案） |
| `navigation.json` | 菜单、导航栏、社交顺序、搜索 | ✅ |
| `sidebar.json` | 侧栏组件序列（author/recent/tags/categories/archive/series/friends/stats/quote…） | ✅ |
| `footer.json` | 页脚列、版权、备案、社交、Powered-by | ✅ |
| `security.json` | CSP、安全头、限流、路径限制、robots | ✅ |
| `content-policy.json` | media/videos/assets 三目录白黑名单（可选） | 可选 |
| `tag-aliases.json` | 标签别名归一（可选） | 可选 |
| `friends.json` | 友情链接（可选） | 可选 |

> 📖 **完整逐字段参考**：`docs/config-reference.md`（9 章：每个配置项的类型、默认值、取值、校验行为）。

### site.json — 站点核心信息（节选）

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
    forceContentWidth: true,       // 内容区 1600px 居中
    ...
  }
}
```

### features.json5 — 功能总控魔方

`features.json5` 是批 2-4 所有新增交互的统一开关域，54 个模块、440 个配置项，全部带注释。几例：

```json5
{
  lightbox: { enabled: true, canNav: true, kbNav: true, esc: true, bdClose: true, swipe: true, preload: true, cntShow: true },
  math:     { enabled: true, katexCss: "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css", strict: false },
  readingProgress: { enabled: true, articleOnly: true, canJump: true, showDot: true, tipDisplayMs: 450 },
  shortcuts: { search: "/", toggleTheme: "d", nextPost: "j", prevPost: "k", help: "?" },
  tts: { enabled: true, rate: 1.0, lang: "" },
  share: { enabled: true, order: ["weibo", "qq", "wechat", "x", "facebook", "mail", "copy"] },
  gallery: { enabled: true },
  heatmap: { colorIntensity: [0.25, 0.45, 0.65, 1.0], showLegend: true },
  ...
}
```

**要点**：
- 缺失 `features.json5` 文件 → 完全回退内建默认（与旧版本行为一致），不报错
- 未知模块名 → 构建警告（防拼写错误）；非法值（如枚举外取值）→ 构建终止并定位
- `share.order` 等数组字段为**整体替换**语义（deepmerge 不会拼接），删掉某平台即从页面消失
- 模块与页面绑定：`enabled: false` 时对应元素零残留（不渲染 + 不加载对应 CDN）

### security.json / content-policy.json

`security.json` 是**唯一安全配置源**：构建时生成 `_headers` + `workers/security-config.js`（Worker 运行时读取），CSP/限流/路径限制/安全头两边永远一致。`content-policy.json` 则规定 `media/`（图片白名单 + SVG 消毒）、`videos/`（排除制 = 除可执行与渲染型文档外放行）、`assets/`（素材白名单）三目录的构建期过滤——被拦截文件不复制进 `dist/`（线上 404），并在构建报告中逐条列出原因。

---

## 社交链接配置

社交链接支持 **link**（跳转）和 **popup**（弹窗复制）两种类型：

| 类型 | 行为 | 必填字段 |
|------|------|----------|
| `link` | 点击跳转到 URL | `url` |
| `popup` | 弹窗显示联系方式，支持一键复制 | `value`, `popupTitle`, `popupContent` |

内置图标支持：`github` / `x` / `weibo` / `telegram` / `facebook` / `rss` / `email` / `phone` / `qq` / `qqgroup` / `wechat`，未匹配到的 key 使用通用地球图标。

在 `navigation.json` 的 `socialInNav.order` 中控制显示顺序。社交图标按钮支持 **title 悬浮提示**。

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
| 1 | 加载配置 | 11 个 JSON5 配置 + 可选 content-policy.json/tag-aliases.json/friends.json，合并默认值，语法错误即终止（报告文件/行列/原因），20+ 项值域校验 + features 54 模块结构校验 |
| 2 | 设置输出目录 | 清空 `dist/` 并创建子目录 |
| 3 | 复制静态文件 | `static/` → `dist/` |
| 3ᵇ | 内容策略 | 按 content-policy.json 过滤 videos/、assets/ 与媒体（SVG 消毒、可执行拦截），被拦文件 404 且列入构建报告 |
| 4 | 媒体优化 | sharp 生成 WebP/AVIF + 多尺寸响应式图片（输出 manifest） |
| 5 | 处理文章 | Frontmatter 校验（slug 唯一/date 合法）→ 上标/公式守护 → Markdown → Wiki 双链 → CJK 空格 → 提取 TOC → 自动 OG 图 |
| 6 | 生成页面 | 首页分页、文章（系列/分享/打赏/关联/评论）、归档（统计+热力图）、标签、分类、图库、友链、搜索、404 |
| 7ᵇ | JSON Feed | feed.json（与 RSS 同源同裁剪） |
| 7 | RSS 生成 | feed.xml（全文/摘要，上限 maxItems） |
| 8 | Sitemap | sitemap.xml（含自定义页面 + 图库；超过阈值自动按类型拆分为 sitemap-{n}.xml + 索引） |
| 9 | 搜索索引 | search-index.json（局部模糊匹配，含正文/标签/分类） |
| 10 | 安全文件 | `_headers`（CSP + HSTS + 安全头）、`robots.txt`、`_redirects`（配置重定向）、Worker 配置生成 |
| 11 | 压缩 | 压缩 HTML（@minify-html）、CSS（CleanCSS）、JS（Terser） |
| 12 | 缓存破坏 | MD5 内容哈希重命名文件，更新 HTML 引用 |
| 13 | PWA | manifest.json + Service Worker（启用时） |
| 14 | 构建报告 | build-report.html（耗时/文章数/体积/功能状态/内容策略拦截清单） |

**自定义页面**：`pages/` 目录下的 .md 文件在步骤 5 与 6 之间处理（`processCustomPages`），同目录内容也通过 `processPagesContent` 加载供模板嵌入（如文章底部公告栏）。

---

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

# 2. 从项目根目录部署 Worker
npx wrangler deploy --config workers/wrangler.toml
```

> **Worker 安全配置自动同步**：`npm run build` 会从 `security.json`（唯一配置源）生成
> `workers/security-config.js`（自动生成文件，已加入 `.gitignore`，勿手改）。Worker
> 运行时读取该文件，实现边缘层与静态层 CSP/速率限制/路径限制/安全头完全一致，
> 修改安全设置只需编辑 `security.json` 一处。

Worker 提供：速率限制、路径访问控制（如 `/admin/*` 仅允许特定 IP）、CSP 报告收集（`/csp-report` 端点）、HTTP 安全头注入、HTTPS 强制跳转、**维护模式**（环境变量 `MAINTENANCE=1` → 503 维护页，`MAINTENANCE_MESSAGE` 自定义文案）。

### 方式三：GitHub Actions（CI/CD 自动部署）

项目已包含 `.github/workflows/deploy.yml`，推送 `main` 分支自动构建部署（Node 24 + `npm audit --audit-level=high` 门禁 + `npm test`），并在部署前检查 AGENTS.md 是否被误提交。

**配置步骤**：
1. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加 `CF_API_TOKEN`（如需部署）
2. 推送代码到 `main` 分支即可自动构建并部署

### 方式四：手动部署到任意静态托管

`npm run build` 生成的 `dist/` 目录可直接部署到任何静态文件服务器。

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

---

## NPM 命令速查

| 命令 | 功能 |
|------|------|
| `npm run build` | 构建站点（输出到 `dist/`） |
| `npm run dev` | 监听模式，包含草稿（文件修改自动重建） |
| `npm run serve` | 构建 + 启动本地服务器（默认 3000 端口，`--port`/`--maintenance` 可用） |
| `npm start` | 同 `npm run serve` |
| `npm test` | 运行单元测试（67 项 / 17 组） |
| `npm run verify:security` | 集成安全回归（注入恶意文章 → 真实构建 → 语义断言） |
| `npm run import -- --from hexo --source ./hexo-blog` | 内容导入（hexo/hugo/wordpress，`--dry-run` 预览） |
| `npm run init` | 重新初始化 git hooks / gitignore / gitattributes |
| `npx wrangler pages deploy dist --project-name=s-ynapse` | 部署到 Cloudflare Pages |
| `npx wrangler deploy --config workers/wrangler.toml` | 部署 Worker 安全层 |

---

## 测试

```bash
npm test            # 67 项 / 17 组，全部通过
npm run verify:security   # 集成安全回归
```

| 测试套件 | 测试数 | 覆盖函数 |
|----------|--------|----------|
| formatDate | 5 | 日期格式化（含时间检测） |
| safeSlug | 4 | URL Slug 生成（含中文/混合/空值） |
| escapeAttr | 2 | HTML 属性转义（含非字符串输入） |
| escapeHtml | 2 | HTML 转义（含 null 输入） |
| stripHtml | 3 | HTML 标签剥离（含实体解码、非字符串） |
| insertCjkSpacing | 4 | 中英文自动加空格（含纯中文/纯英文边界） |
| applyCjkSpacingToHtml | 1 | HTML 安全的 CJK 空格 |
| extractToc | 2 | 文章目录提取（含无标题页） |
| sanitizeHtml | 8 | 白名单消毒（危险标签/事件属性/危险协议） |
| sanitizeHtml 媒体元素 | 4 | video/audio 保留与站内 src 限制 |
| content-policy classifyFile | 5 | 三目录白名单/黑名单判定 |
| sanitizeSvg | 3 | SVG 危险内容检测 |
| escapeJsonForScript | 2 | 搜索索引嵌入 script 的安全序列化 |
| features-schema validateFeatures | 7 | features 默认/校验/枚举/数组字段 |
| formatConfigError | 2 | JSON5 错误格式化 |
| generate-security-config | 6 | security.json → Worker 配置提取/渲染 |

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
| 分析 | Cloudflare Web Analytics |
| 部署 | Cloudflare Pages / Workers |
| CI/CD | GitHub Actions |
| 测试 | Node.js built-in test runner |

---

## License

MIT
