# S-ynapse

> 思考的突触 — 极简、安全、高性能的 Cloudflare 静态博客系统

基于 Cloudflare 生态的静态博客生成器。Markdown 写作，JSON5 配置，一键部署到 Cloudflare Workers。

**项目仓库**：https://github.com/stop666two/S-ynapse

## 特性

**全配置驱动**
- 6 个 JSON5 配置文件（支持注释），覆盖上百项参数
- 每项功能均有独立 `enabled` 开关，关闭后页面零残留
- 社交链接支持每项独立开关（github/twitter/weibo 等可选）
- 仓库入口（导航栏"项目"按钮 + 页脚链接）可一键隐藏

**安全加固**
- 外部链接安全警告弹窗，自定义提示文字
- CSP 内容安全策略自动生成
- HTTP 安全头（HSTS, X-Frame-Options 等）
- 速率限制 + 路径访问控制（需 Workers）

**性能极致**
- 全静态 HTML，全球 CDN 加速
- HTML/CSS/JS 自动压缩，内容哈希缓存
- 图片自动 WebP 转换 + 多尺寸响应式
- 关键 CSS 内联，异步加载非关键资源

**阅读体验**
- 暗黑模式（跟随系统 / 手动切换，无闪烁）
- 客户端搜索（Ctrl+K 快捷键）
- 阅读进度条 + 返回顶部按钮
- 代码块语言标签 + 一键复制
- 标题锚点链接

---

## 快速开始

```bash
# 1. 安装依赖
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
| `build.bat` | 双击一键构建 |
| `serve.bat` | 双击一键构建 + 启动本地服务器（自动清理旧进程） |

---

## 目录结构

```
S-ynapse/
├── articles/          # Markdown 文章
├── pages/             # 自定义页面（about/privacy/terms）
├── media/             # 图片资源（自动优化）
├── static/            # 静态文件（直接复制到输出）
├── templates/         # EJS 模板（10个文件）
│   ├── layout.ejs     # 基础布局（CSS变量 + 暗黑模式 + 搜索 + 链接警告）
│   ├── index.ejs      # 首页（分页）
│   ├── post.ejs       # 文章页（含评论）
│   ├── archive.ejs    # 归档页
│   ├── tags.ejs       # 标签云
│   ├── tag.ejs        # 标签文章列表
│   ├── categories.ejs # 分类列表
│   ├── category.ejs   # 分类文章列表
│   ├── page.ejs       # 自定义页面
│   ├── search.ejs     # 搜索页
│   └── 404.ejs        # 404 页
├── scripts/
│   ├── build.js       # 构建脚本（14 步管线）
│   └── hooks.js       # 构建钩子
├── workers/           # Cloudflare Worker 安全层
├── .github/workflows/ # CI/CD 自动部署
├── site.json          # 站点配置
├── theme.json         # 主题配置
├── navigation.json    # 导航配置
├── sidebar.json       # 侧边栏配置
├── footer.json        # 页脚配置
├── security.json      # 安全策略
├── build.bat          # Windows 一键构建
├── serve.bat          # Windows 一键启动服务器
├── wrangler.toml      # Cloudflare 部署配置
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
    structuredData: {
      enabled: true,                     // 是否生成 JSON-LD
      type: "BlogPosting"
    }
  },

  // 社交链接（支持 link 跳转和 popup 弹窗复制两种类型）
  social: {
    enabled: true,
    items: {
      github:   { enabled: true,  type: "link",  url: "https://github.com/stop666two" },
      x:        { enabled: false, type: "link",  url: "" },
      weibo:    { enabled: false, type: "link",  url: "" },
      telegram: { enabled: false, type: "link",  url: "" },
      facebook: { enabled: false, type: "link",  url: "" },
      rss:      { enabled: true,  type: "link",  url: "/feed.xml" },
      email:    { enabled: true,  type: "link",  url: "mailto:admin@example.com" },
      qq:       { enabled: true,  type: "popup", value: "123456789",  popupTitle: "QQ",    popupContent: "QQ 号：123456789" },
      qqgroup:  { enabled: true,  type: "popup", value: "987654321",  popupTitle: "QQ 群", popupContent: "QQ 群号：987654321" },
      wechat:   { enabled: true,  type: "popup", value: "MyWeChatID", popupTitle: "微信",  popupContent: "微信号：MyWeChatID" },
      phone:    { enabled: true,  type: "popup", value: "13800138000", popupTitle: "电话",  popupContent: "电话：13800138000" }
    }
  },

  // 评论系统（giscus/disqus/utterances）
  comments: {
    enabled: false,
    provider: "giscus",
    giscus: {
      repo: "yourname/your-repo",
      repoId: "R_kgDO...",
      category: "Announcements",
      categoryId: "DIC_kwDO..."
    }
  },

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
    generateIndex: true,           // 生成首页
    generateArchive: true,         // 生成归档
    generateTags: true,            // 生成标签页
    generateCategories: true,      // 生成分类页
    optimizeMedia: true,           // 优化图片
    mediaQuality: 85,              // 图片质量
    mediaResponsiveSizes: [640, 1024, 1920], // 响应式尺寸
    mediaFormats: ["webp", "original"],
    lazyLoadImages: true,
    enableCacheBusting: true,      // 缓存破坏
    externalLinksTarget: "_blank",
    externalLinksRel: "noopener noreferrer"
  },

  // 自定义 HTML 注入
  customHead: "",                  // 注入到 </head> 前
  customBodyStart: "",             // 注入到 <body> 后
  customBodyEnd: "",               // 注入到 </body> 前

  // 仓库链接控制
  showRepoLink: true,              // false 则隐藏所有仓库入口
  repoUrl: "https://github.com/stop666two/S-ynapse",

  // 外部链接安全警告
  externalLinkWarning: {
    enabled: true,                 // 是否启用
    title: "安全提醒",              // 弹窗标题
    message: "您即将离开本站...",    // 提示文字
    confirmText: "继续访问",        // 确认按钮
    cancelText: "取消返回"          // 取消按钮
  }
}
```

### theme.json — 主题与样式

```json5
{
  // 配色
  colors: {
    primary: "#2d3748",            // 主色
    secondary: "#4a90d9",          // 辅色
    accent: "#e53e3e",             // 强调色
    background: "#f7fafc",         // 背景色
    surface: "#ffffff",            // 卡片背景
    text: "#1a202c",               // 主文字色
    textSecondary: "#4a5568",      // 副文字色
    textLight: "#a0aec0",          // 浅色文字
    border: "#e2e8f0",             // 边框色
    shadow: "rgba(0,0,0,0.1)",     // 阴影色
    hover: "#edf2f7",              // 悬停背景色
    codeBackground: "#2d3748",     // 代码块背景
    codeText: "#f7fafc"            // 代码块文字色
  },

  // 暗黑模式
  darkMode: {
    enabled: true,
    toggle: true,                  // 显示切换按钮
    default: "system",             // light / dark / system
    colors: {                      // 暗黑模式配色覆盖
      background: "#0f172a",
      surface: "#1e293b",
      text: "#f1f5f9",
      textSecondary: "#94a3b8",
      textLight: "#64748b",
      border: "#334155",
      shadow: "rgba(0,0,0,0.3)",
      hover: "#334155",
      codeBackground: "#0f172a",
      codeText: "#e2e8f0"
    }
  },

  fontFamily: "'Inter', sans-serif",
  fontFamilyMono: "'Fira Code', monospace",
  fontSizeBase: "16px",
  lineHeight: 1.8,

  spacing: {
    containerWidth: "960px",       // 内容区最大宽度
    gap: "2rem",
    padding: "2rem",
    radius: "0.5rem",              // 圆角
    radiusLarge: "1rem"
  },

  shadow: {
    card: "0 4px 6px rgba(0,0,0,0.1)",
    dropdown: "0 10px 15px -3px rgba(0,0,0,0.1)",
    fixed: "0 2px 4px rgba(0,0,0,0.08)"
  },

  layout: {
    headerStyle: "fixed",          // fixed / static
    headerHeight: "60px",
    sidebarPosition: "right",      // left / right
    postLayout: "standard",
    archiveLayout: "list"
  },

  animation: {
    enable: true,
    transitionDuration: "0.3s",
    scrollBehavior: "smooth"
  },

  codeHighlight: {
    theme: "github-dark",
    lineNumbers: true,
    copyButton: true,
    wrapLongLines: false
  },

  card: {
    showDate: true,
    showTags: true,
    showCategories: true,
    showExcerpt: true,
    excerptLength: 150,
    showReadTime: true,
    readTimeSpeed: 265
  }
}
```

### navigation.json — 导航菜单

```json5
{
  // 主菜单（可增删改）
  menu: [
    { label: "首页",   url: "/" },
    { label: "归档",   url: "/archive" },
    { label: "标签",   url: "/tags" },
    { label: "关于",   url: "/about" }
  ],

  // 导航栏行为
  navbar: {
    fixed: true,
    showLogo: true,
    logoText: "S-ynapse",
    sticky: true,
    shadow: true,
    mobileCollapse: true,
    breakpoint: "768px"
  },

  // 社交图标在导航栏中显示
  socialInNav: {
    enabled: true,
    order: ["github", "twitter", "rss"]
  },

  // 搜索
  search: {
    enabled: true,
    placeholder: "搜索文章...",
    provider: "local"              // local / algolia
  }
}
```

### sidebar.json — 侧边栏

```json5
{
  enabled: true,                   // 侧边栏总开关
  position: "right",
  width: "280px",
  sticky: true,

  // 部件列表（每项有独立 enabled 开关，可增删）
  widgets: [
    { type: "author",    enabled: true, title: "关于我", avatar: "/media/avatar.jpg", bio: "全栈开发者" },
    { type: "recent",    enabled: true, title: "最新文章", count: 5 },
    { type: "tags",      enabled: true, title: "标签云", limit: 20, showCount: true },
    { type: "categories",enabled: true, title: "分类", showCount: true },
    { type: "archive",   enabled: true, title: "归档", showCount: true },
    { type: "search",    enabled: true, title: "搜索" },
    { type: "custom",    enabled: false, title: "广告位", html: "<div>自定义内容</div>" },
    { type: "newsletter",enabled: false, title: "订阅" }
  ]
}
```

### footer.json — 页脚

```json5
{
  copyright: "© 2026 Your Name",
  layout: "multi-column",          // simple / multi-column / centered
  columns: 3,
  columnItems: [
    { title: "导航", links: [{label:"首页",url:"/"},{label:"关于",url:"/about"}] },
    { title: "友情链接", links: [{label:"合作伙伴",url:"https://a.com"}] },
    { title: "联系", html: "<p>邮箱: admin@example.com</p>" }
  ],
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
      "object-src": ["'none'"]
    }
  },
  headers: {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
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

在 `navigation.json` 的 `socialInNav.order` 中控制显示顺序。

---

## 文章格式

```markdown
---
title: 文章标题
slug: my-post
tags: ["技术", "教程"]
categories: ["编程"]
description: "自定义描述"
featuredImage: "/media/image.jpg"
date: 2026-07-13
draft: false
---

# 文章标题

正文内容...
```

**URL 生成规则**：
1. 优先使用 Frontmatter 的 `slug` 字段
2. 其次使用 Frontmatter 的 `title` 字段
3. 最后使用正文第一个一级标题的文本
4. 一个文件只允许一个一级标题，多个则跳过该文件

---

## 构建管线

构建脚本执行 14 步：

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 加载配置 | 读取 6 个 JSON5 文件，合并默认值，验证 |
| 2 | 设置输出目录 | 清空 `dist/` 并创建子目录 |
| 3 | 复制静态文件 | `static/` → `dist/` |
| 4 | 媒体优化 | sharp 生成 WebP + 多尺寸响应式图片 |
| 5 | 处理文章 | 解析 Frontmatter → 检测 h1 → Markdown 转 HTML |
| 6 | 处理自定义页面 | `pages/` 目录的 .md 文件 |
| 7 | 生成页面 | 首页分页、文章、归档、标签、分类、搜索、404 |
| 8 | RSS | 生成 feed.xml |
| 9 | Sitemap | 生成 sitemap.xml |
| 10 | 搜索索引 | 生成 search-index.json |
| 11 | 安全文件 | _headers, robots.txt |
| 12 | 压缩 | HTML/CSS/JS |
| 13 | 缓存破坏 | 内容哈希重命名 |
| 14 | PWA | manifest.json, sw.js |

---

## 部署

### 方式一：Cloudflare Pages（纯静态托管）

```bash
# 1. 安装 Wrangler CLI（如未安装）
npm install -g wrangler

# 2. 登录 Cloudflare
npx wrangler login

# 3. 构建站点
npm run build

# 4. 部署到 Pages
npx wrangler pages publish dist --project-name=s-ynapse

# 部署后，Cloudflare Pages 会返回一个 *.pages.dev 域名
# 可在 Cloudflare Dashboard 中绑定自定义域名
```

**自动部署（连接 Git 仓库）**：
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers 和 Pages** → **Pages** → **创建项目** → **连接到 Git**
3. 选择你的仓库，设置构建命令为 `npm run build`，输出目录为 `dist`
4. 每次推送代码自动构建部署

### 方式二：Cloudflare Workers（推荐，带动态安全层）

```bash
# 1. 构建静态资源
npm run build

# 2. 部署 Worker
cd workers
npx wrangler publish
```

Worker 提供：
- 速率限制（防止刷接口）
- 路径访问控制（如 `/admin/*` 仅允许特定 IP）
- CSP 报告收集（`/csp-report` 端点）
- HTTP 安全头注入
- HTTPS 强制跳转

### 方式三：GitHub Actions（CI/CD 自动部署）

项目已包含 `.github/workflows/deploy.yml`，推送 `main` 分支自动部署。

**配置步骤**：
1. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：
   - `CF_API_TOKEN` — Cloudflare API Token（需 Pages 部署权限）
2. 推送代码到 `main` 分支即可自动构建并部署

**获取 CF_API_TOKEN**：
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **我的资料** → **API 令牌** → **创建令牌**
3. 选择 **Cloudflare Pages** 模板，权限设为 **编辑**
4. 复制生成的 Token 添加到 GitHub Secrets

### 方式四：手动部署到任意静态托管

`npm run build` 生成的 `dist/` 目录可直接部署到任何静态文件服务器：

- Vercel / Netlify / GitHub Pages
- 阿里云 OSS / 腾讯云 COS
- 任意 Nginx / Apache 服务器

---

## 交互功能

| 功能 | 操作方式 |
|------|----------|
| 暗黑模式切换 | 导航栏 🌙/☀️ 图标 |
| 搜索 | `Ctrl+K` 或点击 🔍 图标 |
| 代码复制 | 鼠标悬停代码块右上角「复制」按钮 |
| 返回顶部 | 右下角 ↑ 箭头按钮（滚动后显示） |
| 阅读进度 | 文章页顶部彩色渐变进度条 |
| 外部链接警告 | 点击外部链接自动弹窗提示 |

---

## NPM 命令速查

| 命令 | 功能 |
|------|------|
| `npm run build` | 构建站点（输出到 `dist/`） |
| `npm run dev` | 监听模式（文件修改自动重建） |
| `npm run serve` | 构建 + 启动本地服务器（默认 3000 端口） |
| `npm start` | 同 `npm run serve` |
| `npx wrangler pages publish dist --project-name=s-ynapse` | 部署到 Cloudflare Pages |

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

---

## License

MIT
