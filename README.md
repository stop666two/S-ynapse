# S-ynapse

> 思考的突触 — 极简、安全、高性能的 Cloudflare 静态博客系统

基于 Cloudflare 生态的静态博客生成器。Markdown 写作，JSON5 配置，一键部署到 Cloudflare Pages。

**项目仓库**：https://github.com/stop666two/S-ynapse

## 特性

**全配置驱动**
- 6 个 JSON5 配置文件（支持注释），覆盖上百项参数
- 每项功能均有独立 `enabled` 开关，关闭后页面零残留
- 社交链接支持每项独立开关（github/twitter/weibo 等可选）
- 仓库入口（导航栏"项目"按钮 + 页脚链接）可一键隐藏

**安全加固**
- 外部链接安全警告弹窗，白名单/黑名单双轨控制
- CSP 内容安全策略自动生成，SRI 子资源完整性
- HTTP 安全头（HSTS, X-Frame-Options, Permissions-Policy 等）
- 速率限制 + 路径访问控制（需 Workers）
- 配置校验：构建时自动检查 20+ 配置项

**阅读体验**
- 暗黑模式（跟随系统 / 手动切换，无闪烁）
- 全文搜索（Ctrl+K 快捷键，搜索标题 + 正文 + 标签）
- 文章目录 TOC（侧边栏自动提取 h2-h4 标题）
- 文章关联推荐（基于同标签/同分类，文章底部展示）
- 中英文自动加细空格（排版优化）
- 阅读模式（一键隐藏侧边栏，全宽聚焦）
- 阅读进度条 + 返回顶部按钮
- 代码块语言标签 + 一键复制
- 标题锚点链接

**性能极致**
- 全静态 HTML，全球 CDN 加速
- HTML/CSS/JS 自动压缩，内容哈希缓存
- 图片自动 WebP 转换 + 多尺寸响应式
- 关键 CSS 内联，异步加载非关键资源
- 图片懒加载

**开发者体验**
- 草稿预览：`npm run dev` 自动包含草稿文章
- 构建报告：每次构建生成 `build-report.html` 含详细统计
- 单元测试：`npm test` 覆盖核心纯函数（22 项测试）
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

### Windows 快捷脚本

| 脚本 | 功能 |
|------|------|
| `build.bat` | 双击一键构建（使用 `npm ci` 确保可复现） |
| `serve.bat` | 双击一键构建 + 启动本地服务器（自动清理旧进程） |

---

## 目录结构

```
S-ynapse/
├── articles/          # Markdown 文章
├── pages/             # 自定义页面（about/privacy/terms）
├── media/             # 图片资源（自动优化）
├── static/            # 静态文件（直接复制到输出）
├── templates/         # EJS 模板（10 个文件）
│   ├── layout.ejs     # 基础布局（CSS变量 + 暗黑模式 + 搜索 + 链接警告）
│   ├── index.ejs      # 首页（分页）
│   ├── post.ejs       # 文章页（TOC + 关联推荐 + 评论 + 阅读模式）
│   ├── archive.ejs    # 归档页
│   ├── tags.ejs       # 标签云
│   ├── tag.ejs        # 标签文章列表
│   ├── categories.ejs # 分类列表
│   ├── category.ejs   # 分类文章列表
│   ├── page.ejs       # 自定义页面
│   ├── search.ejs     # 搜索页
│   └── 404.ejs        # 404 页
├── scripts/
│   ├── build.js       # 构建脚本（16 步管线）
│   ├── build.test.js  # 单元测试（22 项）
│   ├── init-project.js# 项目初始化（git hooks + gitignore + gitattributes）
│   └── lib/
│       └── utils.js   # 工具函数（日期、slug、HTML 转义、CJK 空格等）
├── workers/           # Cloudflare Worker 安全层
├── .github/workflows/ # CI/CD 自动部署（含 AGENTS.md 检测）
├── .githooks/         # Git hooks（pre-commit 保护 AGENTS.md）
├── docs/              # 设计文档
├── site.json          # 站点配置
├── theme.json         # 主题配置
├── navigation.json    # 导航配置
├── sidebar.json       # 侧边栏配置
├── footer.json        # 页脚配置
├── security.json      # 安全策略
├── .env.example       # 环境变量模板
├── .gitattributes     # Git 属性配置
├── build.bat          # Windows 一键构建
├── serve.bat          # Windows 一键启动服务器
├── wrangler.toml      # Cloudflare Pages 部署配置
└── package.json       # 依赖管理
```

---

## 配置文件详解

所有配置文件使用 JSON5 格式（文件扩展名为 `.json`，但构建脚本用 `json5` 库解析，支持 `//` 注释、尾随逗号、无引号键名）。

### site.json — 站点核心信息

```json5
{
  title: "S-ynapse",              // 站点标题（浏览器标签栏）
  subtitle: "思考的突触",          // 副标题（首页顶部）
  description: "个人技术博客",      // 站点描述（SEO）
  author: "Your Name",             // 作者名称
  email: "admin@example.com",      // 联系邮箱
  url: "https://synapse.dev",      // 站点根 URL（必填）
  language: "zh-CN",               // 语言代码
  timezone: "Asia/Shanghai",       // 时区
  dateFormat: "YYYY-MM-DD HH:mm",  // 日期格式

  postsPerPage: 10,                // 每页文章数
  paginationPrev: "上一页",        // 分页文字
  paginationNext: "下一页",

  // RSS 订阅
  rss: {
    enabled: true,                 // 总开关
    path: "/feed.xml",             // 输出路径
    fullContent: true,             // 是否包含全文
    maxItems: 50                   // 最大条目数
  },

  // SEO
  seo: {
    metaKeywords: ["博客", "技术"],
    metaRobots: "index, follow",
    ogImage: "/media/og-image.svg",      // Open Graph 分享图
    ogType: "website",
    twitterCard: "summary_large_image",
    twitterSite: "@yourtwitter",
    canonicalURL: true,                  // 是否生成 canonical
    structuredData: { enabled: true, type: "BlogPosting" }
  },

  // 社交链接（支持 link 跳转和 popup 弹窗复制两种类型）
  social: {
    enabled: true,
    items: {
      github:   { enabled: true,  type: "link",  url: "https://github.com/stop666two" },
      rss:      { enabled: true,  type: "link",  url: "/feed.xml" },
      email:    { enabled: true,  type: "link",  url: "mailto:admin@example.com" },
      wechat:   { enabled: true,  type: "popup", value: "MyWeChatID", popupTitle: "微信", popupContent: "微信号：MyWeChatID" },
      phone:    { enabled: true,  type: "popup", value: "13800138000", popupTitle: "电话", popupContent: "电话：13800138000" }
    }
  },

  // 评论系统（giscus/disqus/utterances）
  comments: { enabled: false, provider: "giscus", giscus: {...} },

  // 站点地图
  sitemap: { enabled: true, path: "/sitemap.xml", changefreq: "weekly", priority: 0.8 },

  // PWA
  pwa: { enabled: false, manifest: {...}, serviceWorker: "/sw.js" },

  // 构建行为
  build: {
    cleanDist: true,               // 构建前清空 dist
    minifyHTML: true,              // 压缩 HTML
    minifyCSS: true,               // 压缩 CSS
    minifyJS: true,                // 压缩 JS
    removeConsole: true,           // 移除 console
    optimizeMedia: true,           // 优化图片
    enableCacheBusting: true,      // 缓存破坏
    searchFullContent: true,       // 全文搜索索引
    relatedArticles: true,         // 文章关联推荐
    cjkSpacing: true,              // 中英文自动加空格
    buildReport: true,             // 构建报告
    autoOgImage: true,             // 自动生成 OG 图片
    ...
  },

  // 外部链接安全警告
  externalLinkWarning: {
    enabled: true,
    whitelist: ["*.github.com", "cdn.jsdelivr.net", ...],
    blacklist: []
  }
}
```

### theme.json — 主题与样式

```json5
{
  colors: { primary: "#2d3748", secondary: "#4a90d9", ... },
  darkMode: {
    enabled: true,
    toggle: true,
    default: "system",               // light / dark / system
    colors: { ... }                  // 深色模式配色覆盖
  },
  fontFamily: "'Inter', sans-serif",
  fontFamilyMono: "'Fira Code', monospace",
  spacing: { containerWidth: "960px", gap: "2rem", ... },
  layout: { headerStyle: "fixed", sidebarPosition: "right", ... },
  codeHighlight: { theme: "github-dark", lineNumbers: true, copyButton: true },
  card: { showDate: true, showTags: true, showExcerpt: true, ... },
  externalAssets: {
    styles: ["https://fonts.googleapis.com/css2?family=Inter"],
    scripts: ["https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js"]
  }
}
```

### navigation.json — 导航菜单

```json5
{
  menu: [
    { label: "首页", url: "/", icon: "home" },
    { label: "归档", url: "/archive" },
    { label: "标签", url: "/tags" },
    { label: "关于", url: "/about" }
  ],
  navbar: { fixed: true, showLogo: true, logoText: "S-ynapse", ... },
  socialInNav: { enabled: true, order: ["github", "rss", "email"] },
  search: { enabled: true, placeholder: "搜索文章...", provider: "local" }
}
```

### sidebar.json — 侧边栏

```json5
{
  enabled: true,
  position: "right",
  width: "280px",
  sticky: true,
  widgets: [
    { type: "author",    enabled: true, title: "关于我", avatar: "/media/avatar.svg", bio: "全栈开发者" },
    { type: "toc",       enabled: true, title: "目录" },              // 文章目录（新增）
    { type: "recent",    enabled: true, title: "最新文章", count: 5 },
    { type: "tags",      enabled: true, title: "标签云", limit: 20 },
    { type: "categories",enabled: true, title: "分类" },
    { type: "archive",   enabled: true, title: "归档" },
    { type: "search",    enabled: true, title: "搜索" },
    { type: "custom",    enabled: false, title: "广告位" },
    { type: "newsletter",enabled: false, title: "订阅更新" }
  ]
}
```

### footer.json — 页脚

```json5
{
  copyright: "© 2026 Your Name",
  layout: "multi-column",
  columns: 3,
  columnItems: [...],
  bottomLinks: [
    { label: "隐私政策", url: "/privacy" },
    { label: "服务条款", url: "/terms" },
    { label: "RSS", url: "/feed.xml" }
  ],
  beian: { enabled: false, icp: "京ICP备...号" },
  social: { enabled: true, iconSize: "24px" },
  poweredBy: { enabled: true, text: "S-ynapse" }
}
```

### security.json — 安全策略

```json5
{
  csp: {
    enabled: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "object-src": ["'none'"],
      "frame-src": ["'none'"]
    }
  },
  headers: {
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    ...
  },
  rateLimiting: { enabled: true, maxRequests: 100, windowMs: 60000 },
  robots: { enabled: true, rules: [{userAgent:"*",allow:"/",disallow:"/admin"}] }
}
```

---

## 社交链接配置

社交链接支持 **link**（跳转）和 **popup**（弹窗复制）两种类型：

| 类型 | 行为 | 必填字段 |
|------|------|----------|
| `link` | 点击跳转到 URL | `url` |
| `popup` | 弹窗显示联系方式，支持一键复制 | `value`, `popupTitle`, `popupContent` |

内置图标支持：`github` / `x` / `weibo` / `telegram` / `facebook` / `rss` / `email` / `phone` / `qq` / `qqgroup` / `wechat`，未匹配到的 key 使用通用地球图标。

在 `navigation.json` 的 `socialInNav.order` 中控制显示顺序。社交图标按钮支持 **title 悬浮提示**（鼠标悬停显示名称）。

---

## 文章格式

```markdown
---
title: 文章标题
slug: my-post
tags: ["技术", "教程"]
categories: ["编程"]
description: "自定义描述"
featuredImage: "/media/image.jpg"    # 可选，无则自动生成 OG 图
date: 2026-07-13
draft: true                          # 设为 true 则在生产构建中跳过
---

# 文章标题

正文内容...
```

**URL 生成规则**：
1. 优先使用 Frontmatter 的 `slug` 字段
2. 其次使用 Frontmatter 的 `title` 字段
3. 最后使用正文第一个一级标题的文本
4. 一个文件只允许一个一级标题，多个则跳过该文件

**草稿机制**：`draft: true` 的文章在 `npm run build` 中被跳过，但在 `npm run dev` 中会包含，方便本地预览。

**封面图**：未设置 `featuredImage` 的文章会在构建时根据标题自动生成 OG 图片（SVG 格式，1200×630）。

---

## 构建管线

构建脚本执行 16 步：

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 加载配置 | 读取 6 个 JSON5 文件，合并默认值，20+ 项校验 |
| 2 | 设置输出目录 | 清空 `dist/` 并创建子目录 |
| 3 | 复制静态文件 | `static/` → `dist/` |
| 4 | 媒体优化 | sharp 生成 WebP + 多尺寸响应式图片 |
| 5 | 处理文章 | 解析 Frontmatter → 检测 h1 → Markdown 转 HTML → CJK 空格 → 提取 TOC |
| 6 | 处理自定义页面 | `pages/` 目录的 .md 文件 |
| 7 | 计算关联推荐 | 基于标签/分类权重计算相关文章 |
| 8 | 生成页面 | 首页分页、文章（含关联推荐）、归档、标签、分类、搜索、404 |
| 9 | 自动生成 OG 图片 | 无封面图的文章自动生成标题 SVG |
| 10 | RSS | 生成 feed.xml |
| 11 | Sitemap | 生成 sitemap.xml |
| 12 | 搜索索引 | 生成 search-index.json（含正文 5000 字） |
| 13 | 安全文件 | _headers, robots.txt |
| 14 | 压缩 | HTML/CSS/JS |
| 15 | 缓存破坏 | 内容哈希重命名 |
| 16 | PWA + 构建报告 | manifest.json, sw.js, build-report.html |

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

# 2. 部署 Worker
cd workers
npx wrangler deploy
```

Worker 提供：
- 速率限制（防止刷接口）
- 路径访问控制（如 `/admin/*` 仅允许特定 IP）
- CSP 报告收集（`/csp-report` 端点）
- HTTP 安全头注入
- HTTPS 强制跳转

### 方式三：GitHub Actions（CI/CD 自动部署）

项目已包含 `.github/workflows/deploy.yml`，推送 `main` 分支自动构建部署，并在部署前检查 AGENTS.md 是否被误提交。

**配置步骤**：
1. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加 `CF_API_TOKEN`
2. 推送代码到 `main` 分支即可自动构建并部署

### 方式四：手动部署到任意静态托管

`npm run build` 生成的 `dist/` 目录可直接部署到任何静态文件服务器。

---

## 交互功能

| 功能 | 操作方式 |
|------|----------|
| 暗黑模式切换 | 导航栏 🌙/☀️ 图标，跟随系统或手动，localStorage 持久化 |
| 搜索 | `Ctrl+K` 或点击 🔍 图标，搜索标题 + 正文 + 标签 |
| 代码复制 | 鼠标悬停代码块右上角「复制」按钮 |
| 返回顶部 | 右下角 ↑ 箭头按钮（滚动 300px 后显示） |
| 阅读进度 | 文章页顶部彩色渐变进度条 |
| 外部链接警告 | 点击外部链接自动弹窗提示，白名单域名跳过 |
| 文章目录 | 侧边栏自动显示 h2-h4 标题，点击跳转 |
| 关联推荐 | 文章底部显示同标签/同分类的相关文章卡片 |
| 阅读模式 | 文章底部点击📖按钮，隐藏侧边栏全宽阅读 |
| 社交悬浮提示 | 鼠标悬停社交图标准确显示名称 |
| 联系方式弹窗 | 点击 popup 类型社交图标，弹窗显示联系方式并支持一键复制 |

---

## NPM 命令速查

| 命令 | 功能 |
|------|------|
| `npm run build` | 构建站点（输出到 `dist/`） |
| `npm run dev` | 监听模式，包含草稿（文件修改自动重建） |
| `npm run serve` | 构建 + 启动本地服务器（默认 3000 端口） |
| `npm start` | 同 `npm run serve` |
| `npm test` | 运行单元测试（22 项） |
| `npm run init` | 重新初始化 git hooks / gitignore / gitattributes |
| `npx wrangler pages deploy dist --project-name=s-ynapse` | 部署到 Cloudflare Pages |

---

## 测试

```bash
# 运行所有测试
npm test
```

使用 Node.js 内置 test runner（`node:test`），覆盖核心工具函数：

| 测试套件 | 测试数 | 覆盖函数 |
|----------|--------|----------|
| formatDate | 4 | 日期格式化 |
| safeSlug | 4 | URL Slug 生成 |
| escapeAttr | 2 | HTML 属性转义 |
| escapeHtml | 2 | HTML 转义 |
| stripHtml | 3 | HTML 标签剥离 |
| insertCjkSpacing | 4 | 中英文自动加空格 |
| applyCjkSpacingToHtml | 1 | HTML 安全的 CJK 空格 |
| extractToc | 2 | 文章目录提取 |

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 模板引擎 | EJS 3.1 |
| Markdown | marked 12 |
| 图片处理 | sharp 0.33 |
| HTML 压缩 | html-minifier 4 |
| CSS 压缩 | clean-css 5 |
| JS 压缩 | terser 5 |
| RSS | feed 4 |
| 部署 | Cloudflare Pages / Workers |
| CI/CD | GitHub Actions |
| 测试 | Node.js built-in test runner |

---

## License

MIT
