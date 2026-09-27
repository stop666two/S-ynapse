# S-ynapse 配置文件完整参考

> 全部配置文件位于项目根目录,采用 **JSON5**(支持注释与单引号/无引号键)。
> 构建时自动加载+深度合并;缺省任意字段时使用与本站行为一致的内置默认值。
> 配置文件语法错误(缺逗号、引号未闭合等)会**立即终止构建**,并输出:文件名+行列+上下文+原因+修复提示。
> 注释约定:字段均带中文注释(作用/类型/可填值/不可填值/推荐/注意);`ui-strings.json5` 为文案表,以「键名即文档」为策略(仅分节注释)。
> 本文是逐字段权威参考。字段左侧符号:`=默认`(内置)/`必填`(缺失即报错)。

---

## 目录
1. [site.json5 — 站点主体](#1-sitejson5--站点主体)
2. [theme.json5 — 视觉与主题](#2-themejson5--视觉与主题)
3. [features.json5 — 功能总控(97 模块)](#3-featuresjson5--功能总控97-模块)
4. [navigation.json5 — 导航](#4-navigationjson5--导航)
5. [sidebar.json5 — 侧栏](#5-sidebarjson5--侧栏)
6. [footer.json5 — 页脚](#6-footerjson5--页脚)
7. [security.json5 — 安全](#7-securityjson5--安全)
8. [content-policy.json5 — 内容策略](#8-content-policyjson5--内容策略)
9. [tag-aliases.json5 / friends.json5 — 可选数据文件](#9-tag-aliasesjson5--friendsjson5--可选数据文件)
10. [tuning.json5 — UI 微调参数层](#10-tuningjson5--ui-微调参数层)
11. [guard.json5 — 防护与交互控制域](#11-guardjson5--防护与交互控制域)
12. [compression.json5 — 构建产物压缩](#12-compressionjson5--构建产物压缩)
13. [ui-strings.json5 — 界面文案词典](#13-ui-stringsjson5--界面文案词典)

---

## 1. site.json5 — 站点主体

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `title` | string | `My Blog` | `必填` 站点名称(标题栏/Logo/OG) |
| `titleEn` | string | `''` | 英文站点名称(en 语言页标题栏/Logo/OG;空则回退 `title`) |
| `subtitle` | string | `''` | 副标题(Logo 旁小字) |
| `subtitleEn` | string | `''` | 英文副标题(en 语言页 Logo 旁小字;空则回退 `subtitle`) |
| `languages` | string[] | `['zh','en']` | 站点支持语言列表(每语言生成完整站点:首页/文章/归档/标签/分类/搜索/RSS/sitemap;对应 `articles/{lang}/` 目录) |
| `description` | string | `''` | 站点描述(meta/OG/RSS) |
| `descriptionEn` | string | `''` | 英文站描述(en 页 meta/OG/RSS/JSON Feed;空则回退 `description`) |
| `author` | string | `''` | 作者名 |
| `email` | string | `''` | 作者邮箱 |
| `url` | string | `http://localhost` | `必填` 站点根 URL(必须以 http:// 或 https:// 开头) |
| `language` | string | `en` | 页面语言(如 zh-CN,影响日期/朗读) |
| `languageEn` | string | `''` | 英文站语言标签(en 页 `<html lang>` 与侧栏“最近文章”日期本地化;空则回退 `en-US`) |
| `timezone` | string | `UTC` | 未实现聚合;保留字段 |
| `dateFormat` | string | `YYYY-MM-DD` | 日期显示格式(YYYY/MM/DD HH:mm) |
| `copyright` | string | `''` | 版权文本(页脚) |
| `postsPerPage` | number | `10` | 首页每页文章数 |
| `paginationPrev` | string | `上一页` | 分页上一页文本 |
| `paginationNext` | string | `下一页` | 分页下一页文本 |
| `prevPostLabel` | string | `上一篇` | 文章页上一篇标签 |
| `nextPostLabel` | string | `下一篇` | 文章页下一篇标签 |

### site.rss — RSS/JSON Feed
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `rss.enabled` | bool | `false` | 是否生成 RSS |
| `rss.path` | string | `/feed.xml` | RSS 输出路径 |
| `rss.fullContent` | bool | `true` | RSS 条目含全文(否则摘要) |
| `rss.maxItems` | number | `50` | RSS 条目数上限 |
| `rss.injectHeadLinks` | bool | `true` | 是否在 `<head>` 输出 RSS/JSON Feed alternate `<link>`（false=不输出；feed 文件本身仍生成） |
| `rss.jsonFeed.enabled` | bool | `true` | 是否生成 /feed.json(JSON Feed) |
| `rss.jsonFeed.path` | string | `/feed.json` | JSON Feed 输出路径(按语言自动加前缀) |
| `rss.jsonFeed.fullContent` | bool | `false` | JSON Feed 条目含全文(否则摘要);非布尔值忽略并回退 `rss.fullContent` |
| `rss.jsonFeed.maxItems` | number | `20` | JSON Feed 条目数上限;非正数/非数字忽略并回退 `rss.maxItems` |

### site.seo — SEO
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `seo.metaKeywords` | array | `[]` | meta keywords |
| `seo.metaKeywordsEn` | array | `[]` | 英文站 meta keywords(en 页;空数组回退 `seo.metaKeywords`) |
| `seo.ogImageAlt` | boolean | `true` | 为 `og:image` 输出 alt 文本(文章页=标题) |
| `seo.articleTimes` | boolean | `true` | 文章页输出 `article:published_time`/`article:modified_time`(modified 仅当 frontmatter 提供) |
| `seo.twitterLabels` | boolean | `true` | 分享卡片读数标签(`twitter:label1/2`=阅读时长/字数,仅文章页) |
| `seo.metaRobots` | string | `index, follow` | robots meta |
| `seo.ogImage` | string | `''` | 全局 OG 图(留空则文章自动生成) |
| `seo.ogType` | string | `website` | og:type |
| `seo.twitterCard` | string | `summary_large_image` | Twitter Card 类型 |
| `seo.twitterSite` | string | `''` | Twitter 账号(带 @) |
| `seo.canonicalURL` | bool | `false` | 是否输出 canonical |
| `seo.structuredData.enabled` | bool | `false` | JSON-LD |
| `seo.structuredData.type` | string | `BlogPosting` | JSON-LD 类型 |
| `seo.titleTemplate.index` | string | `{site} · {subtitle}` | 首页 `<title>` 模板;`{site}/{title}/{subtitle}` 占位符 |
| `seo.titleTemplate.post` | string | `{title} · {site}` | 文章页 |
| `seo.titleTemplate.default` | string | `{title} · {site}` | 其它页 |

### site.social — 社交链接
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `social.enabled` | bool | `false` | 总开关 |
| `social.items.<key>.enabled` | bool | `true` | 单项开关 |
| `social.items.<key>.type` | string | `link` | `link` 跳转 / `popup` 弹窗复制 |
| `social.items.<key>.url` | string | `''` | link 型 URL |
| `social.items.<key>.value` | string | `''` | popup 型值(微信号/QQ 号…) |
| `social.items.<key>.popupTitle` | string | 键名 | 弹窗标题 |
| `social.items.<key>.popupTitleEn` | string | `''` | 弹窗标题英文（en 站;空则回退 `popupTitle`） |
| `social.items.<key>.popupContent` | string | 值 | 弹窗说明文案 |
| `social.items.<key>.popupContentEn` | string | `''` | 弹窗说明英文（en 站;空则回退 `popupContent`） |

### site.comments — 评论
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `comments.enabled` | bool | `false` | 文章页评论 |
| `comments.provider` | string | `giscus` | `giscus`/`utterances`/`disqus` |
| `comments.giscus.*` | — | 需填 | `repo/repoId/category/categoryId/mapping/strict/reactionsEnabled/emitMetadata/inputPosition/theme/lang` |
| `comments.utterances.*` | — | 需填 | `repo/label/theme` |
| `comments.disqus.*` | — | 需填 | `shortname` |

### site.sitemap — 站点地图
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `sitemap.enabled` | bool | `true` | 生成 sitemap.xml |
| `sitemap.path` | string | `/sitemap.xml` | 输出路径 |
| `sitemap.changefreq` | string | `weekly` | always/hourly/daily/weekly/monthly/yearly/never |
| `sitemap.priority` | number | `0.8` | 0~1 优先级 |

### site.favicon — 站点图标（浏览器标签/书签/主屏）
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `favicon.enabled` | bool | `true` | 注入图标 `<link>`；`false` 完全不输出（浏览器可能自行请求 `/favicon.ico`） |
| `favicon.svg` | string | `/icons/favicon.svg` | SVG 图标（现代浏览器首选）；站内路径或完整 URL |
| `favicon.png32` | string | `/icons/favicon-32x32.png` | 32×32 PNG 回退 |
| `favicon.appleTouch` | string | `/icons/apple-touch-icon.png` | iOS 主屏图标（180×180 PNG） |

构建时逐个检测站内路径的文件存在性：存在则注入（并参与 cache-bust 内容哈希重命名），缺失则跳过并输出 `[WARN]`；PNG 的 `sizes` 属性取自文件 IHDR 实际像素尺寸（32×32 / 180×180 自动派生，不写死）；三项全部缺失时自动注入内置 data-URI SVG 兜底（颜色取主题色），不再出现 `/favicon` 404。默认三件套源文件位于 `static/icons/`，随构建拷贝到 `dist/icons/`。

### site.pwa / site.build — PWA 与构建开关
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `pwa.enabled` | bool | `false` | 生成 manifest/sw.js |
| `pwa.manifest` | object | `{}` | manifest 字段 |
| `pwa.serviceWorker` | string | `/sw.js` | SW 路径 |
| `pwa.cacheName` | string | `s-ynapse-v1` | SW 缓存名（改版递增可强制废弃旧缓存） |
| `build.cleanDist` | bool | `true` | 构建前清空 dist |
| `build.cacheControl` | bool | `true` | 分级 Cache-Control 响应头（css 1 年 immutable；js/vendor 1 小时 + SWR；media/og 7 天 + SWR）；`false` 完全不输出 |
| `build.minifyHTML/CSS/JS` | bool | `true` | 压缩开关：HTML（含残留内联脚本/样式）压缩去注释；站点主样式（外链 `dist/assets/css/site.<hash>.css`）与残留内联 `<style>`（customCSS 等）均经 CleanCSS(level 1) 压缩；JS 压缩范围 = `dist/assets/js`（vendor 上游已压缩、自动跳过）；JSON 输出（search-index/manifest/speculation-rules 等）始终紧凑 |
| `build.removeConsole` | bool | `false` | 剥离 console.*（仅作用于 `dist/assets/js`） |
| `build.generateIndex` | bool | `true` | 生成首页 `/{lang}/index.html` 与分页 |
| `build.generateArchive` | bool | `true` | 生成归档页 `/{lang}/archive/`（按年归档列表） |
| `build.generateTags` | bool | `true` | 生成标签云与标签文章列表 |
| `build.generateCategories` | bool | `true` | 生成分类列表与分类文章列表 |
| `build.generateGallery` | bool | `true` | 生成图库页 `/{lang}/gallery/` |
| `build.generateAuthorPages` | bool | `false` | 作者页 |
| `build.copyStatic` | bool | `true` | 复制 static/ |
| `build.optimizeMedia` | bool | `false` | sharp 媒体优化 |
| `build.mediaQuality` | number | `85` | 压缩质量 |
| `build.mediaResponsiveSizes` | array | `[640,1024,1920]` | 响应式宽度档位 |
| `build.mediaFormats` | array | `['webp','original']` | 输出格式(可含 avif) |
| `build.avif.enabled` | bool | `true` | AVIF 输出（图多省流量；构建时间敏感可关） |
| `build.avif.quality` | number | `50` | AVIF 质量 |
| `build.avif.effort` | number | `5` | AVIF 编码努力(0-10) |
| `build.lazyLoadImages` | bool | `true` | loading=lazy |
| `build.useSrcset` / `usePictureTag` | bool | `true` | 响应式标签 |
| `build.searchFullContent` | bool | `true` | 搜索索引含正文 |
| `build.relatedArticles` | bool | `true` | 相关推荐 |
| `build.cjkSpacing` | bool | `true` | 中英文间细空格 |
| `build.cjkFonts` | object | 见下 | 中文字体（Noto Sans SC）构建期子集化 |
| `build.buildReport` | bool | `true` | build-report.html |
| `build.autoOgImage` | bool | `true` | 自动 OG 图 |
| `build.forceContentWidth` | bool | `true` | 主内容强制宽高布局 |
| `build.enableCacheBusting` | bool | `false` | MD5 缓存戳 |
| `build.cacheBustingPattern` | string | `.*\.(css\|js\|png\|jpg\|svg)$` | 戳名模式 |
| `build.cssOutDir` | string | `assets/css` | 站点主样式输出目录（相对 dist/） |
| `build.cssFileBase` | string | `site` | 主样式文件名前缀（最终 `{前缀}.{哈希}.css`） |
| `build.hashLength` | number | `10` | 内容哈希截取长度（6–16） |
| `build.hashAlgorithm` | string | `md5` | 内容哈希算法（Node crypto 名称；仅作缓存键） |
| `build.externalLinksTarget` / `externalLinksRel` | string | `_blank` / `noopener noreferrer` | 外链属性 |

#### build.cjkFonts — 中文字体子集化（Noto Sans SC）
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `cjkFonts.enabled` | bool | `true` | 总开关；关闭后页面用系统字体链（`Noto Sans SC` 不存在时自动落到苹方/雅黑等） |
| `cjkFonts.family` | string | `Noto Sans SC` | Google Fonts 字体族名（同时作为字体栈首位名与输出目录 slug） |
| `cjkFonts.weights` | array | `[400,700]` | 需要的字重；空数组回退默认 |
| `cjkFonts.fetchTimeoutMs` | number | `15000` | 单次网络请求超时（毫秒） |

构建流程：页面生成后扫描 dist 全部 HTML 与产出 JSON 的实际用字（正文/`<title>`/meta/内联及外部化运行时配置），只下载命中的 Google Fonts woff2 分片，自托管到 `dist/assets/fonts/noto-sans-sc/` 并生成 `dist/assets/css/cjk-fonts.css`（保留 `unicode-range`、`font-display: swap`）；HTML 中的样式引用自动带内容哈希查询串（配合 `/assets/css/*` 与 `/assets/fonts/*` 的 1 年 immutable 缓存）。
> 注意：首次构建需联网拉取字体清单与分片，结果缓存于 `.cache/fonts/`（不入库，7 天清单 TTL，之后离线可复用）；断网/超时/解析失败时自动跳过并 `console.warn`，页面回退系统字体链，构建不会失败。`/assets/fonts/*` 与 `/assets/css/*` 的长期缓存由 `build.cacheControl`（默认开）统一管理。

### site.performance — 性能优化
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `performance.preloadFonts` | bool | `true` | 预加载字体样式(preload) |
| `performance.fontDisplay` | string | `swap` | @font-face 显示策略:swap/block/fallback/optional/auto(非法值回退 swap) |
| `performance.imageDecoding` | string | `async` | 图片解码:async/sync/auto |
| `performance.scriptLoading` | string | `defer` | 外部脚本加载:defer/module/async |
| `performance.preconnect` | array | `[fonts.googleapis.com, fonts.gstatic.com]` | preconnect 域名列表 |
| `performance.prefetchNextPage` | bool | `false` | 空闲预取下一页 |
| `performance.resourceHints` | bool | `true` | 输出 preconnect/dns-prefetch |
| `performance.imageSizes` | string | `auto` | srcset sizes 策略:auto/自定义表达式 |
| `performance.preloadFeaturedImage` | bool | `true` | 文章首图 `<link rel=preload as=image fetchpriority=high>`（LCP 提速） |

> 说明:压缩、缓存戳、构建报告等构建级开关统一由 `site.build.*` 提供（单开关原则,不再提供 performance.* 重复项）;本段仅保留渲染期与网络提示项。

### site.externalLinkWarning — 外链警告(与 features.externalLink 联动)
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `externalLinkWarning.enabled` | bool | `false` | 开关(需 features.externalLink.enabled 同时为 true) |
| `externalLinkWarning.whitelist` | array | `[]` | 白名单(`*.github.com`、`example.com/path`) |
| `externalLinkWarning.blacklist` | array | `[]` | 黑名单(命中直接拦截) |
| `externalLinkWarning.message` | string | `即将离开本站…` | 提示文案(`{url}` 占位) |
| `externalLinkWarning.messageEn` | string | `''` | 英文提示文案(en 语言页;空则回退 `message`) |
| `externalLinkWarning.confirmText` | string | `继续访问` | 确认按钮 |
| `externalLinkWarning.confirmTextEn` | string | `''` | 英文确认按钮(en 语言页;空则回退 `confirmText`) |
| `externalLinkWarning.cancelText` | string | `取消返回` | 取消按钮 |
| `externalLinkWarning.cancelTextEn` | string | `''` | 英文取消按钮(en 语言页;空则回退 `cancelText`) |
| `externalLinkWarning.title` | string | `安全提醒` | 弹窗标题 |
| `externalLinkWarning.titleEn` | string | `''` | 英文弹窗标题(en 语言页;空则回退 `title`) |

### site.redirects — 重定向
数组元素:`{ from:'/old/', to:'/new/', permanent:true }`;支持 `*` 通配符。构建生成 CF Pages `_redirects`;本地 serve 同步生效。

### site.reward / site.webAnalytics
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `reward.enabled` | bool | `false` | 打赏(需 features.reward.enabled) |
| `reward.note` | string | `''` | 打赏提示 |
| `reward.noteEn` | string | `''` | 打赏提示英文（en 站;空则回退 `note`，再由 `features.reward.noteEn` 兜底） |
| `reward.wechat.image/url/label` | — | — | 微信收款二维码/链接（`labelEn` 为英文方式名，空回退 `label`） |
| `reward.alipay.*` | — | — | 支付宝（同上，`labelEn` 可选） |
| `reward.custom[]` | — | `[]` | 自定义(`{label,labelEn,image,url}`) |
| `webAnalytics.enabled` | bool | `true` | CF Web Analytics |
| `webAnalytics.token` | string | `''` | 令牌(或环境变量 CF_WEB_ANALYTICS_TOKEN) |
| `showRepoLink` | bool | `true` | 显示仓库链接 |
| `repoUrl` | string | `''` | 仓库 URL |

### site.hero — 首页 Hero 内容源
`site.hero.*` 与 `features.hero.*` 同名键合并：`site.hero` 提供内容，`features.hero` 提供开关与视觉参数；两者同名时以 `site.hero` 优先（`ctaLabelEn` 为 en 站文案，空回退 `features.hero.ctaLabelEn` 再回退中文）。

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `hero.enabled` | bool | `true` | Hero 总开关（与 `features.hero.enabled` 同时为真才渲染） |
| `hero.title` / `hero.titleEn` | string | `''` | Hero 标题（空回退站点名 `title`/`titleEn`） |
| `hero.subtitle` / `hero.subtitleEn` | string | `''` | Hero 副标题（空回退站点副标题，再回退描述） |
| `hero.showSearch` | bool | `true` | 显示搜索按钮（与 features 同键取与） |
| `hero.showCta` | bool | `true` | 显示 CTA 按钮（与 features 同键取与） |
| `hero.ctaLabel` / `hero.ctaLabelEn` | string | `查看全部文章` / `View all posts` | CTA 文案（en 站空回退中文与 features 默认） |
| `hero.ctaUrl` | string | `#latest-post` | CTA 目标（站内锚点或路径） |
| `hero.showTags` | bool | `true` | 显示热门标签区（与 features 同键取与） |
| `hero.tagCount` | number | `8` | 热门标签展示条数（features 同键兜底） |

### site.customHead / customBodyStart / customBodyEnd — 原样 HTML 注入
三项均为 string（HTML 片段），原样插入对应位置（不做消毒，写入前请自行确认内容可信）：

| 字段 | 默认 | 插入位置 | 注意 |
|---|---|---|---|
| `customHead` | `''` | 每页 `</head>` 前 | 适合第三方验证 `<meta>`；引入外链脚本需同步放行 CSP |
| `customBodyStart` | `''` | `<body>` 开标签后 | 如 GTM `<noscript>` |
| `customBodyEnd` | `''` | `</body>` 前 | 如统计脚本，注意 CSP 与隐私声明 |

> 注入内容不会经过 `sanitize-html`；构建产物等价性护栏与安全回归以配置空值为基线。

---

## 2. theme.json5 — 视觉与主题

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `colors.primary` | string | `#2d3748` | 主色(标题/高亮) |
| `colors.secondary` | string | `#2563eb` | 次色(链接/强调) |
| `colors.accent` | string | `#c53030` | 强调色(危险/徽标) |
| `colors.background/surface/text/textSecondary/textLight/border/shadow/hover/codeBackground/codeText` | string | 见代码 | 全站色板 |
| `darkMode.enabled` | bool | `false` | 暗色模式总开关 |
| `darkMode.toggle` | bool | `true` | 页面切换按钮 |
| `darkMode.default` | string | `system` | 默认主题：`light`/`dark`/`system`（唯一来源） |
| `darkMode.rememberChoice` | bool | `true` | `false`=偏好仅存 sessionStorage（当次会话），true=localStorage 持久记忆 |
| `darkMode.iconStyle` | string | `sun-moon` | 切换按钮图标：`sun-moon`/`single`/`switch` |
| `darkMode.transitionAll` | bool | `true` | 切换时给 html 加 `.theme-switching` 过渡；false=瞬时 |
| `darkMode.colors.*` | — | `{}` | 暗色覆盖色板 |
| `fontFamily` / `fontFamilyMono` | string | `sans-serif`/`monospace` | 字体 |
| `fontSystem.stack/displayStack/headingStack/scale` | string/number | `inter`/`sora`/`manrope`/`1` | 字体系统：正文族 / 展示层（h1·Logo）/ 次级标题（h2-h6·卡片·部件）族 / 全局缩放；中文字符自动回退 CJK 字体链；字体文件构建期本地化到 `assets/vendor/fonts/` 并自动预加载 |
| `fontSystem.customStack` | string | `''` | 自定义字体栈（仅 `stack='custom'` 时作为正文字体族；CSS font-family 列表，未随站点提供的字体名会回退，视觉不可控） |
| `fontSystem.bodyWeight` | number | `400` | 正文字重（300 细 / 400 常规 / 500 中等 / 600 半粗 / 700 粗） |
| `fontSystem.numbersMono` | bool | `true` | 统计数字/阅读面板进度等使用等宽字体（对齐更整齐） |
| `fontSizeBase` / `lineHeight` | string/number | `16px`/`1.8` | 基础字号/行高 |
| `headingFontWeight` | number | `700` | 标题字重 |
| `letterSpacing` | string | `0.02em` | 字符间距 |
| `spacing.containerWidth` | string | `1250px` | 容器宽度(balanced 档位写入) |
| `spacing.radiusLarge` | string | `1.618rem` | 大圆角（图片/弹窗），与 `spacing.radius`（卡片/输入框）独立 |
| `spacing.gap/padding` | — | — | 间距 |
| `tiers.rounding/shadow/border/density` | object | — | 档位数值表（"选档"见 rounding/shadowLevel/borderStyle 与 density.preset，数值全部在此定义） |
| `surfaceHighlight.light/dark` | string | — | 表面高光/描边（`0 0 #0000` = 关闭） |
| `layout.headerStyle` | string | `fixed` | 头部 `fixed`/`static` |
| `layout.headerHeight` | string | `60px` | 头部高度(锚点偏移基准) |
| `layout.footerStyle` | string | `simple` | 页脚样式 |
| `layout.sidebarPosition` | string | `right` | 侧栏位置 |
| `layout.contentWidth`/`postLayout`/`archiveLayout` | string | — | 布局预设 |
| `animation.enable` | bool | `true` | 动画 |
| `animation.transitionDuration/timing` | — | — | 动画参数 |
| `codeHighlight.palette.light/dark` | object | — | 代码 token 配色（comment/keyword/string/number/fn/attr/punct，随明暗模式自动切换；开关见 features.prismTheme.enabled） |
| `card.showDate/showTags/showCategories/showExcerpt` | bool | `true` | 卡片信息开关 |
| `card.excerptLength` | number | `150` | 摘要长度 |
| `card.showReadTime` / `readTimeSpeed` | bool/number | `true`/`265` | 阅读时长(wpm) |
| `card.showWordCount` | bool | `true` | 字数 |
| `button.radius/padding/primaryBackground/primaryText/hoverScale` | — | — | 按钮 |
| ~~`customCSS`~~ | — | — | 已迁移至 features.customCSS（本文件不再读取该键） |
| `externalAssets.styles/scripts` | array | `[]` | 额外 CSS/JS；元素可为字符串 URL 或对象 `{ href/src, integrity?, crossorigin? }`（第三方 CDN 建议配 SRI：`integrity` 校验要求 CORS，跨域一般同时填 `crossorigin: 'anonymous'`；同源/本地无需填）。默认 Prism 项按页门控：仅含高亮代码块的页面注入 `/assets/vendor/prism.js`（首页/列表等零成本页不加载），其他额外脚本照常全局输出；字体样式由 fontSystem 自动追加。Prism 高亮脚本由构建本地注入 |
| `contentOffset` | number | `0` | 内容偏移 |
| `headerContentGap` | number | `0` | 头内容间隙 |
| `tocWidth` | string | `200px` | 目录宽 |
| `sidebarWidth` | string | `280px` | 侧栏宽 |
| `tocMinLeft` / `sidebarMinRight` | string | `10px` | 边界 |
| `preset` / `presetOverrides` | string/object | `classic-blue`/`{}` | 颜色预设(9 套内置)与单色微调（预设接管时 colors 段不生效） |
| `glass.enabled/blur/alpha/darkAlpha/rgb` | bool/string/number | `true`/`12px`/`0.8`/`0.85`/`255,255,255` | 导航毛玻璃（navigation.navbarOptions 优先） |
| `background.mode/colors/gradientAngle/gridSize/dotSize/opacity` | string/array/number | `particles`/—/`135`/`24`/`1`/`1` | 页面背景特效（粒子细节见 features.background.particles） |
| `avatar.shape/ring/ringColor/badge` | string/bool/string/bool | `round`/`false`/`''`/`true` | 头像外观与首字母徽章 |
| `density.preset/columns` | string/number | `balanced`/`2` | 布局密度档位（compact/balanced/airy;数值见 tiers.density） |
| `articleFooter.enabled` | bool | `true` | 文章页脚公告栏总开关（见下方子表） |
| `articleFooter.source` | string | `disclaimer` | 内容来源：`pages/` 下文件名（不含扩展名；不存在则公告栏为空） |

#### theme.appearance — 外观细节
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `appearance.selectionBg` | string | `''` | 文本选中背景色（空 = 辅色 25% 透明） |
| `appearance.scrollbarWidth` | string | `8px` | 滚动条宽度（WebKit） |
| `appearance.scrollbarRadius` | string | `4px` | 滚动条圆角 |
| `appearance.focusRingWidth` | string | `2px` | 键盘焦点环宽度（无障碍必备） |
| `appearance.focusRingOffset` | string | `2px` | 焦点环与元素间距 |
| `appearance.codePadding` | string | `1rem` | 代码块内边距 |
| `appearance.codeLineHeight` | number | `1.6` | 代码块行高 |
| `appearance.blockquoteBorderWidth` | string | `3px` | 引用块左侧竖线宽度 |
| `appearance.tableStripeBg` | string | `''` | 表格斑马纹背景（空 = hover 色 50%） |
| `appearance.tableCellPadding` | string | `.6rem .9rem` | 表格单元格内边距 |
| `appearance.hrOpacity` | number | `0.6` | 分隔线不透明度（0–1） |
| `appearance.imageCaptionAlign` | string | `center` | 图注对齐：`left`/`center`/`right` |

#### theme.articleFooter — 文章页脚公告栏
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `articleFooter.backgroundColor` | string | `#f0f4f8` | 背景色（与页面背景轻微区分） |
| `articleFooter.textColor` | string | `#4a5568` | 文字色 |
| `articleFooter.borderColor` | string | `#cbd5e1` | 边框色 |
| `articleFooter.borderWidth` | string | `1px` | 边框粗细 |
| `articleFooter.borderRadius` | string | `0.5rem` | 圆角 |
| `articleFooter.paddingTop` / `paddingBottom` | string | `1.25rem` | 上下内边距 |
| `articleFooter.paddingLeft` / `paddingRight` | string | `1.5rem` | 左右内边距 |

> 内容在构建期从 `pages/<source>.md` 读取并按语言取用；样式经构建期写入 CSS 变量。

---

## 3. features.json5 — 功能总控(97 模块)

**加载规则**:可选文件;缺失时使用内置默认(与文件内容一致的当前行为)。
**合并规则**:数组字段(share.order 等)为用户覆盖,不拼接;一切字段均可缺省。
**校验**:每个模块必须是对象;enabled 必须是布尔;枚举字段(如 heatmap.scaling)非法值直接报错终止构建。
**双语约定（*En 字段）**:所有文案型字段均可追加同名 `En` 后缀（如 `reward.buttonTextEn`）提供英文站文案；类型与中文值一致，**空字符串 = en 站回退中文值**。共覆盖 60 键：search / codeBlock / externalLink / shortcuts / readingTime / codeCopy / readMode / readingPanel / mermaid / series / related / pinned / wordCount / share / reward / gallery / heatmap / stats / prevNext / maintenance / comments / contactPopup / hero / dailyQuote / favorites / subscribe。构建期模板按页面语言渲染 `*En`；运行时模块（`search.js`/`share.js`/`code-block.js`/`comments.js`/`contact-popup.js`/`favorites.js`）按当前页面语言（`data-lang`）取 `*En`。


### 3.0 未接线键总表（已清零）

> 状态口径：全部键均已处置——**不存在「看起来能调、实际无效且无标注」的键**：
> - **已接线**：代码读取且生效（见各模块小节）；
> - **已删除**：与唯一来源重复或语义与实现相悖的键（迁移映射见 CHANGELOG 与对应小节）；
> - **自动守卫**：`npm run verify:config-refs`（`scripts/check-config-refs.js`）按「叶子键名零引用」扫描，发现未接线键即失败；允许名单见 `scripts/config-refs-allowlist.json`（数据/展示层配置经整体对象注入，不按键名引用）。
> 已知盲区：通用短键名（`enabled`/`size` 等）不参与静态判定；features 动态拼接键（`stats.label*En`）已在允许名单登记。


### 3.1 lightbox — 图片灯箱
| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `zoomEnabled` | `true` | 缩放总开关（false 时禁用滚轮/双击/按钮/双指缩放） |
| `panEnabled` | `true` | 放大后可拖拽平移 |
| `rotateEnabled` | `true` | 旋转（按钮左右 90°） |
| `pinchEnabled` | `true` | 双指捏合缩放（触屏） |
| `zoomStep` | `0.25` | 按钮/滚轮单步缩放倍数 |
| `zoomMin` / `zoomMax` | `1` / `4` | 缩放范围（1 = 原始尺寸） |
| `dblClickZoom` | `true` | 双击切换放大/复位 |
| `wheelZoom` | `true` | 滚轮缩放（桌面） |
| `showZoomButtons` | `true` | 显示 ＋/− 按钮 |
| `selectors` | `.post-content img, .gallery-item img` | 收集目标 CSS 选择器 |
| `minSize` | `60` | 触发最小边长(px),过滤小图标 |
| `prevNextButtons` | `true` | 上/下一张按钮 |
| `closeButton` | `true` | 关闭按钮 |
| `keyboardNavigate` | `true` | ←/→ 切图 |
| `escToClose` | `true` | Esc 关闭 |
| `swipeToNavigate` | `true` | 移动端滑动 |
| `swipeClose` | `true` | 下/上滑动关闭(移动端下拉关闭、放大态不触发) |
| `closeOnBackdrop` | `true` | 点遮罩关闭 |
| `showCounter` | `true` | N / M 计数器 |
| `counterFormat` | `{current} / {total}` | 计数模板 |
| `maxWidthVw` / `maxSizePx` / `maxHeightVh` | `92`/`1600`/`82` | 图片约束 |
| `openDurationMs` / `switchDurationMs` | `180`/`120` | 打开/切换动画时长(ms;0=瞬时) |
| `transitionDurationMs` | `220` | 通用过渡时长兜底（`openDurationMs`/`switchDurationMs` 未设时回退） |
| `backdropOpacity` | `0.9` | 遮罩透明度 |
| `preloadAdjacent` | `true` | 预载相邻图 |
| `rememberPosition` | `false` | 记忆上次位置 |
| `showCaption` | `true` | 显示图片标题（`alt`/`title`） |
| `captionMaxLines` | `2` | 标题最多行数（超出省略） |
| `swipeThresholdPx` | `50` | 触屏横向滑动切图最小位移(px) |
| `swipeCloseThresholdPx` | `80` | 触屏下拉关闭最小位移(px;仅未放大时生效) |
| `mouseSwipeThresholdPx` | `80` | 桌面鼠标横向拖拽切图最小位移(px) |
| `dblClickZoomLevel` | `2` | 双击放大到的倍数(再双击复位) |
| `clickTolerancePx` | `6` | 遮罩点击判定容差(px;超出视为拖拽不关闭) |

> **接线说明**：
> - `maxWidthVw` = 灯箱图片最大宽度（vw）：构建期归一化为 CSS 变量 `--lightbox-maxWidthVw`（可被 customCSS 覆盖），专键优先；未设/非法时回退兼容旧键 `imageFit.lightbox.maxWidthPct`，再回退 92。默认两者同值（92），渲染不变。
> - `openDurationMs` / `switchDurationMs` = 打开 / 切换（上一张/下一张）的轻量透明度补间（WAAPI）：**专键优先，未设回退通用 `transitionDurationMs`（再回退 220）**；0 = 瞬时。系统减少动效（`prefers-reduced-motion: reduce`）下不播放动画。此前打开/切换无可感知过渡，为默认 180/120ms 淡入（见 CHANGELOG Changed）。
> - canonical：`scripts/lib/feature-wiring.js → lightboxConfig/lightboxGestureConfig`（单测覆盖；手势阈值默认 50/80/80/2/6 = 历史行为）。

### 3.2 readingProgress — 阅读进度条
`enabled true` / `articleOnly true` / `clickToJump true` / `showDot true` / `dotSize 10px` / `barHeight 3px` / `useGradient true` / `gradientStart var(--color-s)` / `gradientEnd var(--color-a)` / `tipDisplayMs 500`(点击跳转后百分比气泡停留时长；悬停/聚焦期间常显) / `showTip true`(是否显示跟随进度圆点的百分比提示气泡) / `updateThrottleMs 30` / `ariaAnnounce true`(进度条输出 `aria-valuenow`，屏幕阅读器可读) / `topOffset 0`(进度条距视口顶部偏移，构建期写入 `.reading-progress` 的 `top`，值需含单位如 `8px`/`2vh`，`0` 默认贴顶) / `zIndex 1000`(进度条层级，与其他浮层冲突时调大) / `rememberPosition true`(同文章回访恢复滚动位置) / `rememberPositionMaxAgeHours 72`(超时不再恢复;哈希导航与前进/后退不触发) / `keyboardStep 0.05`(进度条聚焦后 ←/→ 单步比例;Home/End 不受影响) / `minRestorePx 160`(恢复位置的最小 y，低于不恢复) / `maxStoredPositions 80`(本地记忆路径上限,超出按最旧淘汰) / `saveThrottleMs 400`(滚动保存节流 ms)。点击跳转支持键盘（聚焦进度条后 ←/→ 按 keyboardStep 步进、Home/End 首尾）

> canonical：`scripts/lib/feature-wiring.js → readingRestoreConfig`（单测覆盖；默认 0.05/160/80/400 = 历史行为）。

### 3.3 backToTop — 返回顶部
`enabled true` / `showAfterPx 400` / `size 44px` / `scrollDurationMs 450` / `smoothScroll true` / `hotkey ''`(KeyboardEvent.key 值如 `Home`;空=禁用;非输入框且无 Ctrl/Cmd/Alt 时生效) / `htmlAnchorFallback false`

> **接线说明**：
> - 按钮位置由 `tuning.json5 → backToTop.offsetSide/offsetBottom` 控制（模板经 `var(--backToTop-offsetSide/offsetBottom, 2rem)` 消费，桌面沿用；移动端底部固定 4rem 以配合按钮堆叠）。
> - `scrollDurationMs` = 点击按钮 / 快捷键的返回顶部动画时长（ms），实现为 rAF + easeOutCubic 逐帧步进（`behavior:'instant'` 绕过 CSS `scroll-behavior:smooth`，避免二次平滑）；`0` = 瞬时。`smoothScroll=false`、`window.__SB()==='auto'`（`scrollBehavior` 关闭 / behavior=auto / 系统减少动效且未豁免）或系统减少动效时均瞬时；用户滚轮/触摸即中断动画。默认 450ms。
> - `htmlAnchorFallback=true` = 页面输出 `<noscript>` 内的锚点链接（`href="#top"`，复用 `.back-to-top` 样式与文案），无 JS 环境可返回顶部；JS 可用时该链接不渲染、由 `#btt` 接管。默认 false（不输出，保持历史 DOM）。
> - canonical：`scripts/lib/feature-wiring.js → backToTopConfig`（单测覆盖）。

### 3.4 search — 客户端搜索
`enabled true` / `minChars 1` / `maxResults 30` / `highlightMatches true`（与 `searchHighlight.enabled` 联动，任一 false 即不高亮） / `showCount true`（结果计数显隐：false 时浮层结果区与 /search 页均不显示；文案取 `ui-strings.search.foundCount`，`{count}` 占位，中英双语） / `emptyHint ''` / `emptyHintEn ''` / `noResultText 未找到匹配内容` / `noResultTextEn No matching content`(空回退中文链) / `excerptLength 120` / `includeContent true`(构建期生效:是否将正文写入 search-index.json) / `matchTags true` / `matchCategories true` / `weightTitle 5` / `weightExcerpt 2` / `weightContent 1` / `closeOnOverlay true` / `focusOnOpen true` / `focusDelayMs 100`(打开搜索后延迟聚焦输入框 ms) / `openAnimation fade`(`fade`=弹层淡入/`slide`=自下而上滑入;尊重系统减少动效) / `debounceMs 120` / `showHistoryOnFocus true` / `maxHistory 5`

> **检索语义（浮层搜索与 /search 页统一）**：命中字段得分 = 字段权重 × 命中出现次数（线性计数），按总分降序；同分保持索引原序（`search-index.json` 由构建期按日期倒序生成，等价「同分按日期」）。**权重为 0 = 该字段既不参与匹配也不参与计分**（如 `weightContent=0` 时正文不再命中）。`tags`/`categories` 命中仅参与「是否入选」（计 0 分，排在所有加权命中之后），分别由 `matchTags`/`matchCategories` 门控（默认 true → 结果为历史行为的超集）。canonical 纯函数：`scripts/lib/feature-wiring.js → rankSearchEntries`（单测覆盖）。
> **无结果文案优先级链**：`emptyHint(En)` > `noResultText(En)` > `tuning.search.emptyText(En)` > i18n 内置文案；`emptyHint` 非空时也作为「输入为空」的浮层提示（默认空串 = 不显示，保持历史输出「未找到匹配内容」）。注意：features 键优先于 tuning（两者默认文案同值，默认渲染不变）。
> **连续查询**：每次渲染前清空旧结果节点（修复此前结果容器追加、旧结果残留的缺陷）；`search-index.json` 已含 `tags`/`categories` 字段（构建期由 `scripts/build/feeds.js` 写入）。
> **检索实现**：子串匹配 + 字段加权（标题/摘要/正文/标签/分类），无拼音模糊；搜索框占位文案的单一来源为 `navigation.json5 → search.placeholder/placeholderEn`（SSR 直接消费，模板不再读本模块）。

### 3.5 imageLazy — 懒加载
`enabled true` / `fadeIn true` / `fadeInDurationMs 300` / `placeholderColor var(--color-hover)` / `preserveAspectRatio true` / `loadingClass img-loading`(加载中占位 class) / `errorClass img-error`(加载失败 class) / `eagerFirst 3`(前 N 张图立即加载,不懒加载) / `lqip true`(构建期模糊占位,内联 `data-lqip`,运行时经本模块应用到图片背景) / `lqipWidth 24`(占位宽度 px)

> 接线说明：`preserveAspectRatio=true`（默认，历史行为）构建期输出 width/height（CLS 保护），覆盖 markdown 正文图片与 pages 出图路径（卡片/头图/图库/prev-next 缩略图，经 `scripts/build/pages.js` 的 imgDimsAttrs/buildCardImgAttrs/cardCoverAttrs/postCoverAttrs）；`false` 时不输出 width/height，交由 CSS 自适应。`data-lqip` 与 `data-iw` 不受影响。

### 3.6 codeBlock — 代码块
`enabled true` / `copyButtonVisibility hover`(`hover|always|never`) / `copySuccessText 已复制` / `copyFailText 复制失败` / `copyFailTextEn ''`(en 站失败文案，空回退中文) / `showLanguageTag true` / `lineNumbers true`(纯文本块也可用) / `wrapLongLines false`(true=软换行,行号仍按行高对齐) / `highlightBackground var(--color-hover)`(hover 混色基色,力度见 tuning.code.hoverBgMix) / `borderRadius 0.375rem` / `maxHeight ''` / `copyAllButton false`(true=首块上方一键复制全页) / `downloadButton true` / `blobRevokeDelayMs 1000`(下载后释放 Blob URL 延迟 ms) / `prismBatchMs 8`(Prism 高亮单批主线程预算 ms) / `prismIdleTimeoutMs 300`(首帧高亮空闲超时 ms) / `prismIdleFallbackMs 60`(无 requestIdleCallback 时的兜底间隔 ms)

视觉细化项(tuning.json5)：`code`(lineNumberColor/lineNumberOpacity/hoverBorderMix/hoverShadowMix/hoverBgMix/inlineRadius/inlineHairlineMix/diffAddMix/diffDelMix) / `icons`(strokeWidth/hoverLift)；终端语言自动前缀(bash/sh/shell/zsh/fish→`$ lang`；powershell→`PS> powershell`；console→`> console`)；diff 增删行着色(.token.inserted/.deleted)；菜单图标见 navigation.json5 的 `icon`(内置 home/archive/tags/info/book/link/folder/search/rss/download)。

### 3.7 externalLink — 外链拦截
`enabled true`(需 site.externalLinkWarning.enabled 同真) / `whitelist []` / `blacklist []` / `mode warn`(`warn|prohibit|hint`) / `message 即将离开本站,前往外部链接：` / `messageEn ''`(en 站提示文案,空回退中文) / `confirmText 继续访问` / `confirmTextEn ''` / `cancelText 返回` / `cancelTextEn ''` / `copyButtonText 复制` / `copyButtonTextEn ''` / `copyFeedbackMs 1500`(复制成功反馈停留 ms，超时还原) / `showFullUrl true` / `openInNewTab true` / `whitelistNewTab false`

> 接线说明：`whitelistNewTab=true` 时白名单外链强制新标签页打开（`target=_blank + noopener/noreferrer` 等效，经 `window.open`，动态插入链接同样生效）；false（默认）= 浏览器默认行为（当前页跳转），保持历史行为。`copyButtonText(En)` 控制外链提醒浮层「复制链接」按钮文案（点击复制目标 URL，短暂显示「已复制」）：`copyButtonTextEn`（en 站，空回退中文键）> `copyButtonText` > `ui-strings.toolbar.copyLink`（新增双语）> 内置文案；默认 `复制`/`Copy`（见 CHANGELOG Added）。

### 3.8 themeToggle
`enabled true` / `persistKey ss-theme`(主题偏好存储键；`theme.darkMode.rememberChoice=false` 时改用 sessionStorage 同键) / `toggleIconSwap true`(仅在 `theme.darkMode.iconStyle='sun-moon'` 时生效：切换交替太阳/月亮图标) / `zIndex 100`(按钮 CSS z-index)。**切换过渡时长的唯一来源为 `theme.animation.transitionDuration`（经 `tuning.motion.transitionDuration` 覆盖）；默认主题/是否记忆/图标样式/是否整体过渡的唯一来源为 `theme.json5 → darkMode.default / rememberChoice / iconStyle / transitionAll`**（运行时经外置配置 `window.__THEME__.darkMode` 读取，模板早置脚本服务端直读）。`iconStyle`：`sun-moon` 双图标交替（默认）/ `single` 常显单个月亮图标 / `switch` CSS 滑块开关；`transitionAll=true`（默认）切换时给 `<html>` 加 `.theme-switching`（`--td` 时长后移除），false=不加类瞬时切换。`rememberChoice=false` 时早置脚本与切换均忽略 localStorage 旧值、仅用 sessionStorage。

### 3.9 shortcuts — 快捷键
`enabled true` / `openSearch /`(空=禁用,下同) / `toggleTheme d` / `prevPost k` / `nextPost j` / `help ?` / `close Escape` / `showHelpHint true`(页脚 `?` 提示按钮；false=不渲染，文案取 ui-strings `toolbar.shortcutHint` 双语) / `helpTitle 快捷键一览`（`helpTitleEn` en 站；作为帮助面板 `aria-label`，空回退 ui-strings） / `showHelpTable true`(false 时不渲染快捷键表) / `ignoreInInputs true`(true=输入框内按键不触发快捷键;false=输入框内也触发)

### 3.10 toc — 目录(桌面侧)
`enabled true` / `minLevel 2` / `maxLevel 4`（两者接线到构建期 TOC 提取；受正文标题锚点限制收敛到 2–4，minLevel=3 可只收 h3 及以下） / `collapsible true` / `defaultOpenLevel 2`（初始展开层级：0=全折叠；N≥1 展开到「minLevel+N-1」级，默认 2 且 minLevel=2 → 展开 h2/h3，h4 初始折叠可点分组箭头展开；`tuning.toc.collapsedByDefault=true` 优先级更高） / `highlightActive true`(false = 关闭当前章节高亮) / `activeOffset 120` / `progressLine true`(目录顶部阅读进度线) / `updateUrl true`(滚动时以 `history.replaceState` 更新地址栏 hash，不产生历史记录) / `smoothScroll true`(条目点击平滑滚动；`scrollBehavior` 关闭时仍瞬时) / `visitedFade true`(已读章节淡显) / `groupCollapse true`(二级项带折叠箭头,可收起其下三级项) / `titleText 目录`（`titleTextEn Contents` en 站标题，空回退中文） / `showTitle true`(侧栏/抽屉显示标题行) / `maxWidthPx 320`(桌面目录最大宽度 px)

### 3.11 mobileToc — 移动目录抽屉
`enabled true` / `borderRadius 1rem` / `maxHeightVh 70` / `autoClose true` / `overlayClose true` / `lockScroll true` / `position right` / `showCurrent true`(胶囊按钮显示当前章节名与进度百分比)。移动端目录抽屉;显示断点由 `mobile.tocBreakpoint` 控制。

### 3.12 readingPanel — 阅读设置面板
`enabled true` / `fontSizeMin 15` / `fontSizeMax 26` / `fontSizeStep 1` / `fontSizeDefault 19` / `lineHeightMin 1.4` / `lineHeightMax 2.6` / `lineHeightStep 0.1` / `lineHeightDefault 1.9` / `widthMin 560` / `widthMax 1200` / `widthStep 40` / `widthDefault 800` / `remember true` / `persistKey 'ss-reading'`(阅读设置 localStorage 键) / `showReset true`(显示「重置」按钮) / `resetText 重置`（`resetTextEn` 为 en 站文案，空回退中文） / `position right`

### 3.13 readMode — 阅读模式
`enabled true` / `persist true`(true=localStorage 记忆;false=仅当次会话并清理旧值) / `storageKey 'readingMode'`(持久化键名) / `label 阅读模式`（`labelEn` 为 en 站文案，空回退中文） / `focusOnlyContent true`（true=隐藏侧栏/目录仅保留正文（现行为）；false=保留侧栏，仅收窄正文；运行时 `html[data-reading-focus]` 门控） / `fontScale 1`

### 3.14 tts — 朗读
`enabled true` / `rate 0.5`(0.1~10) / `pitch 1` / `volume 1` / `preferDefaultVoice true` / `voiceBy lang` / `readSelector .post-content` / `skipSelectors 'pre, .katex, .mermaid'`(朗读时跳过的 CSS 选择器，避免读出代码/公式/图表源码) / `icon speaker` / `highlightParagraph false` / `position toolbar` / `resumeIntervalMs 500`(Chromium 长文本自动暂停后的心跳恢复间隔 ms) / `resumeMaxTries 3`(心跳恢复最大次数，超过即结束朗读)

> **接线说明（语音选择与段落高亮）**：
> - `preferDefaultVoice=true`（默认）= 命中语音中按 `localService`(2 分) + `default`(1 分) 取最高分（稳定序）；`false` = 取平台返回顺序首个。无命中时不设置 `voice`，由浏览器默认语音朗读。
> - `voiceBy`：`'lang'`（默认）= 按 `voice.lang` 精确匹配页面语言，再前缀匹配（如 `zh` 命中 `zh-CN`）；`'name'` = 按 `voice.name` 含语言显示名匹配（`Intl.DisplayNames` 英文名 + 页面语言名；兼容 lang 标签不可靠的平台），name 无命中自动回退 lang 策略。非法值回退 `'lang'`。
> - `highlightParagraph=true` = 逐段朗读（每段一条 utterance）并把 `highlightClass`（默认 `tts-highlight`）加到当前段落；停止 / 切段自动清理，无 boundary 事件也可靠（接管高亮后不再叠加 `highlightReading` 的字级高亮）。默认 false = 历史单段朗读 + boundary 字级高亮。
> - canonical：`scripts/lib/feature-wiring.js → ttsConfig/pickTtsVoice`（单测覆盖两策略与评分）；运行时 `js/domains/features/tts.js` 同源实现（runner 经 speechSynthesis 桩验证）。

### 3.15 wikiLinks — 双链
`enabled true`(false = `[[...]]` 原样保留) / `unknownMode text`(`text`=未知目标降级纯文本（默认，历史行为）/`link`=渲染为站内搜索链接 `/{lang}/search/?q=<encodeURIComponent(目标)>`/`hide`=整体移除) / `unknownSuffix ''`(仅未知目标显示文本追加后缀；已知目标不加) / `openNewTab false` / `caseInsensitive true`(false = 按原始标题精确匹配；slug 始终精确匹配) / `allowCustomLabel true`(false = 忽略 `[[目标|自定义文本]]` 的 `|` 后文本，已知用规范标题、未知用目标、外链用 URL)

> 接线说明：构建期 `scripts/lib/utils.js → resolveWikiLinks(content, lookup, options)` 参数化，`scripts/build/articles.js` 传入本组键（`unknownMode`/`unknownSuffix`/`caseInsensitive`/`allowCustomLabel` + 当前语言）；`enabled=false` 跳过整个解析。查表新增 `titlesExact`（原始大小写标题）供 `caseInsensitive=false` 使用。单测覆盖三模式与各键四态（含 URL 编码）。

### 3.16 supSub — 上下标
`enabled true` / `supMarker ^` / `subMarker ~` / `skipInsideMath true` / `preserveUnmatched true`

> 接线说明：标记参数化（≥1 字符，正则元字符按字面量匹配；`supMarker` 与 `subMarker` 相同时以上标优先），构建期 `scripts/build/markdown.js` 的 marked 扩展按配置生成 tokenizer；`preserveUnmatched=true`（默认）= 孤立标记保持原文，`false` = 剥离孤立标记（标记重复如 `~~` 视为删除线等其它语法，不剥离）；`skipInsideMath=true`（默认，历史行为）= 数学段内不处理（`math.autoDetect=true` 时由 mathGuard 保护，数学段内成对标记保持原样）；`false` = 数学段内也应用上下标转换（renderer 内对定界符内部文本转换，可能破坏公式，谨慎使用；`autoDetect=false` 时无数学段，此键无效）。`skipInsideMath` 默认 true。单测：`scripts/config-wiring.test.js`（四键四态 + matcher 边界）。

### 3.17 math — KaTeX
`enabled true` / `autoDetect true` / `version 0.16.22` / `inlineDelimiters ['$']` / `blockDelimiters ['$$']` / `throwOnError false` / `strict false` / `renderRoundParens true` / `renderSquareBrackets true` / `selector .post-content` / `mathml true`

> 接线说明（构建期 mathGuard + 客户端 auto-render 共用同一份配置，经外置 `window.__FEATURES__.math`）：
> - `autoDetect=true`（默认）= 解析 `inlineDelimiters`（对称、不跨行；单字符 `$` 结尾避免数字，防金额误报）与 `blockDelimiters`（对称、可跨行、须位于行首）；`\(`/`\[` 由 `renderRoundParens`/`renderSquareBrackets` 独立控制。`false` = **不自动解析任何定界符**（不保护、不加载 KaTeX 按需渲染），仅渲染 ` ```math ` 围栏块：构建期输出 `<div class="math-block" data-tex="…">`，客户端 KaTeX 渲染（`throwOnError`/`strict`/`mathml` 同样生效）。
> - 定界符数组去空去重；全部经正则转义（如 `['**']` 按字面量匹配）；空数组回退 `['$']`/`['$$']`。
> - `mathml=true`（默认，历史行为）= KaTeX `output='htmlAndMathml'`；`false` = `'html'`（不输出 MathML 节点）。
> - KaTeX 按需加载口径：`$$` / `\(` / `\[` / 配置的自定义定界符成对出现即触发；**单字符 `$` 与默认 `$$` 不走自定义检测**，单 `$` 单独出现不触发（历史口径，可配置非 `$` 的 `inlineDelimiters` 规避）。canonical：`scripts/lib/feature-wiring.js → mathNeeded/mathConfig/buildMathGuardPatterns`（单测覆盖）。
> - `inlineDelimiters` 置空串/缺失回退默认；`autoDetect`/`mathml` 仅在显式 `false` 时关闭。

### 3.18 mermaid

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `true` | 总开关 |
| `autoDetect` | bool | `true` | 构建期识别显式 ` ```mermaid ` 围栏并 SSR；false = 不渲染、保留围栏回退客户端 |
| `version` | string | `11.17.2` | 版本标识（镜像 `package.json` 安装版本；构建期 SSR 与缓存键、客户端 vendor 均直接使用安装版本，改此值不改变加载来源；`scripts/config-count.test.js` 锁定二者一致） |
| `followTheme` | bool | `true` | 图表主题跟随站点（明/暗双份）；false = 仅明色单份 |
| `lightTheme` / `darkTheme` | string | `default` / `dark` | 明/暗两份 SVG 使用的 mermaid 主题名 |
| `securityLevel` | string | `strict` | mermaid 安全级别（`strict` 禁用 HTML 标签） |
| `mode` | string | `build` | `build` = 构建期服务端渲染（生成双主题内联 `<svg>`，页面不再加载 3.5MB vendor；失败或无 Chrome 自动回退客户端）/ `client` = 保持懒加载 vendor + `__mmStart` 客户端渲染 |
| `darkMode` | bool | `true` | 仅 `mode='build'` 生效：明/暗各渲染一份 SVG，页内 CSS 切换、零闪烁；false = 仅明色 |
| `chromePath` | string | `''` | 仅 `mode='build'` 自动探测失败时使用；探测顺序：`CHROME_PATH` 环境变量 > Windows 默认安装路径 > Linux/macOS 的 `google-chrome`/`chromium` |
| `idleTimeoutMs` / `idleFallbackMs` | number | `1500` / `200` | 客户端懒加载 vendor 的空闲超时与无 `requestIdleCallback` 兜底（ms） |
| `rerenderIdleTimeoutMs` / `rerenderIdleFallbackMs` | number | `300` / `60` | 主题切换重渲染的空闲超时与兜底（ms） |
| `renderTimeoutMs` | number | `10000` | 构建期单块渲染超时（ms） |
| `copyAfterRender` | bool | `false` | 每张已渲染 SSR 图附「复制图表代码」按钮 |
| `errorText` / `errorTextEn` | string | `[图表渲染失败]` | 渲染失败占位文案（en 站空回退中文；均空回退内置英文兜底） |

`size` 子块 — 图表尺寸（全局默认，单图可覆盖）：
- `width ''` / `height ''`(全局默认宽高，空=自然尺寸；单位白名单 px/%/vw/vh/rem，纯数字按 px)
- `minWidth '320px'` / `minHeight '200px'`(下限，始终生效)
- `maxWidth 'none'` / `maxHeight 'none'`(`none`=不限制；`scroll` 模式下可横向滚动，设 `'100%'`/`'70vh'` 可强制限制)
- `fit 'scroll'`(`scroll`=不缩放、超宽容器横向滚动（推荐，时序图/宽图不挤压） / `scale`=缩放到容器宽度（旧行为）)
- 单图覆盖：代码块语言标记后追加 `w=` / `h=`，如 ` ```mermaid w=900 h=520 `；不填项走全局，非法值忽略并回退默认 — `scripts/build.js`(解析) + `templates/layout.ejs`(应用)

> **接线说明**：
> - `autoDetect=true`（默认）= 构建期 SSR（仅识别显式 ` ```mermaid ` 围栏）；`false` = **构建期不检测/不渲染**，保留围栏代码并回退客户端渲染（`article.hasMermaid` 保持 true，页面懒加载 vendor 由 `__mmStart` 接管；仍仅识别显式围栏，不扫描普通文本）。`mode='client'` 时本键无额外作用。
> - `followTheme=true`（默认）= 图表主题跟随站点（明/暗双份，受 `darkMode` 控制）；`false` = 仅明色单份 SVG（暗色沿用同一张图；同时修复既有缺陷：单主题产物在暗色模式下曾被 CSS 隐藏，现按 `data-theme-pair="light"` 保持可见）。客户端 `mode='client'` 下 `followTheme=false` 时固定明色主题且主题切换不重渲染。
> - `copyAfterRender=true` = 每张已渲染（SSR）图右上角附「复制图表代码」按钮：原始 mermaid 源码经 `data-mm-code` 保留在产物中，点击复制（CSP 合规：事件委托 + `navigator.clipboard`，失败回退 `execCommand`；文案按页面语言 zh/en）。
> - `errorText(En)` = 渲染失败占位文案：SSR 失败块在回退客户端的 `<pre>` 上携带 `data-mm-error`，客户端渲染最终失败时显示；`autoDetect=false` / `mode='client'` 场景由页面内联常量兜底（en 站取 `errorTextEn`，空回退中文）。canonical：`scripts/lib/feature-wiring.js → mermaidConfig/mermaidErrorText`。

### 3.19 series — 系列
`enabled true` / `showBadge true` / `badgeFormat 系列 · {name}` / `showNavPanel true` / `sidebarWidget true` / `order asc` / `panelTitle 本系列共 {total} 篇` / `showPosition true` / `defaultWidgetCount 8`(侧栏系列 widget 最多展示条数,超出截断) / `prevLabel 上一篇` / `nextLabel 下一篇` / `progressLabel {index} / {total}`(进度模板) / `sidebarTitle 系列`(侧栏 widget 标题,sidebar.json5 w.title 为空时使用)。以上文案键均有同名 `*En`（`badgeFormatEn`/`panelTitleEn`/`prevLabelEn`/`nextLabelEn`/`sidebarTitleEn`），空回退中文

> 接线说明：
> - `showBadge=false` = 卡片（首页/标签/分类列表）不渲染系列徽标；`badgeFormat`/`badgeFormatEn` = 徽标文本模板（`{name}` 替换系列名；en 站取 `badgeFormatEn`，空回退中文模板；显式空串回退 `ui-strings.card.series` 词典）— `templates/index.ejs`/`tag.ejs`/`category.ejs`。
> - `panelTitle`/`panelTitleEn` = 文章页系列导航面板标题（`{total}` 替换总篇数；空回退 `ui-strings.post.seriesLabel` 词典）；`showPosition=false` = 隐藏面板内进度文本（`progressLabel`）与进度条；`showNavPanel=false` 仍为整面板开关。
> - `sidebarWidget=false` = 不渲染侧栏 `type: series` widget（sidebar.json5 配置仍保留）。
> - 文案优先级（统一链）：`*En`（en 站）> 中文模板 > ui-strings 词典；未设置=默认模板，显式空串=词典。canonical：`scripts/lib/feature-wiring.js → seriesConfig/seriesBadgeText/seriesPanelTitle`（单测覆盖）。

### 3.20 related — 相关推荐
`enabled true` / `topN 4` / `sameCategoryWeight 2` / `sameTagWeight 3` / `minScore 2` / `excludeCurrent true` / `title 相关推荐`（`titleEn` en 站文案，空回退中文） / `showExcerpt true`(卡片显示摘要) / `excerptLength 80`(摘要截断长度) / `showCount false`(显示共享标签数徽章)

> 接线说明：`excludeCurrent=true`（默认，历史行为）相关推荐排除当前文章；`false` = 允许自引用（当前文章与自身共享全部标签/分类，得分最高排第一，常见于「补全推荐位」场景，注意视觉自指）。构建期 `scripts/lib/related.js → computeRelatedArticles`（单测覆盖两态）。

### 3.21 pinned — 置顶
`enabled true`（false=不渲染徽标且不重排） / `badgeText 置顶`（`badgeTextEn` en 站文案，空回退中文；**配置文案优先于 ui-strings.card.pinned 词典**） / `badgeStyle pill`(`pill|corner|none`；`none`=不渲染徽标，`corner`=卡片左上角/标题行角标样式) / `sortRule pinned-first`(`pinned-first`=置顶前（现行为）/`normal`=仅标记不重排，按日期自然排序；构建期 `scripts/build/articles.js` 生效)。徽标应用于首页/归档/标签/分类/文章页 — `templates/index.ejs` + `templates/archive.ejs` + `templates/tag.ejs` + `templates/category.ejs` + `templates/post.ejs`。

### 3.22 wordCount — 字数
`enabled true` / `onCards true` / `inArticle true` / `textFormat {count} 字` / `readTimeFormat {minutes} 分钟阅读`（`textFormatEn`/`readTimeFormatEn` en 站模板，空回退中文） / `wpm 265` / `countCjkChars true` / `countDigits true`

> 接线说明：
> - 统计口径（`scripts/lib/utils.js → countWordsDetail(text, options)` 参数化，canonical）：`countCjkChars=true`（默认，历史行为）= CJK 字符逐字计数，`false` = CJK 不计入总数（拉丁词照计）；`countDigits=true`（默认，历史行为）= 数字作为普通拉丁词计数（`"123"` 计 1），`false` = 纯数字 token 不计（`"abc123"` 等混合 token 仍计 1，不拆分单词）。`countDigits` 默认 true。口径仅影响字数展示；阅读时长（readTime）的两段速度计算始终使用完整口径。
> - 模板优先级（统一链）：`*En`（en 站）> 中文模板 > ui-strings 词典（`card.wordUnit`/`card.minute`）；未设置=默认模板，显式空串=词典。`readTimeFormat` 显式置空时进一步回退 `features.readingTime.labelBefore/labelAfter(En)`（既有键保持可消费）。
> - `onCards`：卡片字数显示 = `wordCount.enabled && onCards && theme.card.showWordCount` 全真才显示（`onCards=false` 显式关闭，覆盖 theme）；`inArticle` 控制文章页 meta 字数（现行为）。
> - **缺陷修复**：文章页 readingTime 曾同时渲染两处（`post-reading-time` + meta 内 `分钟阅读`），现按配置单一来源渲染（`readTimeFormat` 链），每页仅一处。默认显示由「N 分钟」变为「N 分钟阅读」（与 wordCount 模板默认一致，见 CHANGELOG Changed）。
> - 覆盖范围：首页/标签/分类卡片（`readTimeFormat` 同时用于卡片与封面时间徽标）、文章页 meta — `scripts/build/pages.js` 注入 `wordCountLabel`/`readTimeLabel`；canonical：`scripts/lib/feature-wiring.js → wordCountConfig/wordCountText/readTimeText`（单测覆盖中英混排/纯数字/CJK 开关矩阵）。

### 3.23 share — 分享
`enabled true` / `order ['weibo','qq','wechat','x','facebook','mail','copy']`(顺序即显示顺序) / `position toolbar` / `popupWidth 640` / `popupHeight 520`（弹窗尺寸，应用于 `window.open` features 串） / `wechatText {title} 分享自 {url}` / `wechatTextEn ''`(en 站模板,空回退中文；微信复制按模板替换 `{title}`/`{url}`) / `copiedText 链接已复制` / `copiedTextEn ''` / `copiedShowMs 2500`(复制成功 toast 时长) / `showLabel false` / `label 分享文章` / `labelEn ''` / `useNativeShare false`(支持 navigator.share 时优先原生分享) / `copyFallback true`(剪贴板 API 不可用时 textarea 回退)。运行时复制成功提示按页面语言取 `copiedTextEn` — `js/domains/features/share.js`

### 3.24 reward — 打赏前端
`enabled false`(需 site.reward.enabled) / `buttonText 打赏` / `note 感谢支持` / `popupTitle 打赏支持` / `closeByBtn true` / `closeByOverlay true` / `closeByEsc true` / `qrSize 180px` / `maxWidth 560px` / `showNote true`(显示打赏说明文字) / `qrMaxWidth 180px`(二维码最大宽度 CSS) / `closeText 关闭`(关闭按钮文本) / `links []`(赞助平台链接数组,弹窗底部显示胶囊按钮,每项 `{label,url}`,新窗口 `noopener`;如 GitHub Sponsors / Ko-fi / 爱发电)。文案键均有同名 `*En`（`buttonTextEn`/`noteEn`/`popupTitleEn`/`closeTextEn`），空回退中文；弹窗内方式名称与说明优先取 `site.reward.*En`（见 §1）

> **接线说明（关闭路径门控）**：`closeByBtn` / `closeByOverlay` / `closeByEsc` 分别控制关闭按钮、点击遮罩、Esc 三种关闭方式，默认 `true`（现行为）；显式 `false` 使对应路径失效（其余路径仍可关闭）。canonical：`scripts/lib/feature-wiring.js → rewardCloseConfig`（单测覆盖三态）。

### 3.25 gallery — 图库页
`enabled true` / `title 图库` / `description 站内图片集，点击查看大图。` / `emptyText 暂无图片`（`titleEn`/`descriptionEn`/`emptyTextEn` en 站文案，空回退中文） / `columns 4` / `columnMin 220px` / `showSource true` / `collectFeatured true` / `order newest` / `maxItems 0`(0=不限) / `gap 12px`(瀑布流列间距 CSS) / `showCaption true`(图片下方显示来源说明) / `borderRadius 8px`(卡片圆角 CSS)

> 接线说明：`collectFeatured=true`（默认，历史行为）= 图库收集文章封面图 + 正文图片（按 src 去重）；`false` = 仅收集正文图片（`scripts/build/collectors.js → collectGalleryImages(articles, { collectFeatured })` 参数化，单测覆盖两态）。图库为全量聚合：每次构建按 `order`/`maxItems` 重新收集，无增量清单缓存。

### 3.26 heatmap — 归档热力图
`enabled true` / `levels 5`(2~7) / `scaling auto`(`auto|fixed`) / `palette []`(fixed 时色表) / `showLegend true` / `legendLow 少` / `legendHigh 多` / `tooltipFormat {year}-{month}: {count} 篇`（`legendLowEn`/`legendHighEn`/`tooltipFormatEn` en 站文案，空回退中文） / `showMonthNumbers true` / `gap 3px`(单元格间距) / `borderRadius 3px`(单元格圆角) / `cellSize 13px`(单元格尺寸,置空则撑满容器) / `emptyColor var(--color-border)`(空月份颜色)

> **接线说明**：
> - `levels`（2~7，越界钳制，非法回退 5）= 非空层级数：色阶 `l1..l(levels-1)` 由浅到深 + 顶层 `l(levels)` 为强调混色。`levels=5` 时逐字保持历史色阶（25/45/65% + 实色 + 强调混色），渲染不变；其他层数按 25%→100% 线性等分。分桶口径保留历史：`maxCount<=2` 用 `count+1` 阶梯，否则 `ceil(count/maxCount*levels)`。CSS 色阶由 `heatmapPalette(levels)` 生成。
> - **色表（`scaling` / `palette`）**：`scaling='fixed'` 且 `palette`（长度 ≥ levels，取前 levels 项）时使用固定色表替代 color-mix 自动色阶；`palette` 不足 levels 或 `scaling='auto'`（默认）时回退自动色阶，前者构建期输出 `[WARN]` 提示。`palette` 项为空串/非字符串时被过滤。canonical：`scripts/lib/feature-wiring.js → resolveHeatmapPalette`（单测覆盖）。
> - `showLegend=false` 不渲染图例；`legendLow(_En)`/`legendHigh(_En)` 为「少 → 多」两端文案，链为 `*En`(en 站) > 中文 > `ui-strings archive.legendLow/legendHigh`（新增双语）；图例示色层级随 `levels` 自适应（levels=5 → l0/l1/l2/l4，历史不变）。
> - `tooltipFormat(_En)` = 单元格悬停提示模板，占位符 `{year}`/`{month}`/`{count}`；空串回退内置 `{year}-{month}: {count} <文章单位>`（单位取 `ui-strings archive.postUnit`）。默认模板与历史输出逐字一致。
> - `showMonthNumbers=false` = 单元格不显示月份数字（仅保留色块与悬停提示）。
> - **顺带修复**：图例首项此前渲染 `ui-strings archive.count` 的原始模板串（字面 `{count} 文章`），现改用 `archive.textArticle`（文章 / articles）；见 CHANGELOG Fixed。
> - canonical：`scripts/lib/feature-wiring.js → heatmapConfig/heatmapBucketLevel/heatmapPalette/heatmapLegendLevels/heatmapLegendText/heatmapTooltip`（单测覆盖钳制/分桶/色阶/文案链）。

### 3.27 stats — 站点统计
`enabled true` / `showArchiveCards true` / `labelPosts 文章总数` / `labelPostsEn Posts` / `labelDays 发文天数` / `labelDaysEn Days` / `labelWords 总字数` / `labelWordsEn Words` / `labelAvg 日均篇数` / `labelAvgEn Avg/Day` / `labelAvgPerDay 日均`(归档页日均标签,优先于 labelAvg) / `labelAvgPerDayEn Avg/Day` / `labelTags 标签数` / `labelTagsEn Tags` / `labelCategories 分类数` / `labelCategoriesEn Categories`（全部 `*En` 空回退中文） / `cardColumns auto-fit`(统计卡列模式,也可固定列数) / `showSidebar true`(侧栏统计 widget 开关,sidebar.json5 需含 type=stats) / `linkArchive /archive/`

> **接线说明（归档页统计卡；侧栏统计 widget 不受影响）**：
> - `showArchiveCards=false` 不渲染整个统计卡网格（归档页标题与列表保留）。
> - 标签文案链：`*En`(en 站) > 中文配置 > `ui-strings.archive.stat*` 词典；日均卡文案链为 `labelAvgPerDay(En)` > `labelAvg(En)` > `archive.statAvg`。默认配置值与词典同值，渲染不变。
> - `linkArchive` = 卡片跳转目标（非空时卡片渲染为 `<a class="stats-card">`，空串/空白 = 不跳转保持纯文本卡）。默认 `/archive/`：归档页自身为同页链接；改指向 `/` 或 `/tags/` 等可作导航入口。**默认渲染由纯文本变为链接**（见 CHANGELOG Changed）。
> - canonical：`scripts/lib/feature-wiring.js → statsConfig/statsLabel`（单测覆盖文案链与空串回退）。

### 3.28 prevNext
`enabled true` / `showLabels true` / `prevLabel 上一篇` / `nextLabel 下一篇`（`prevLabelEn`/`nextLabelEn` en 站文案，空回退中文；`site.prevPostLabel`/`nextPostLabel` 为中文次回退） / `hideWhenMissing false` / `showThumbnail false`(导航卡缩略图) / `labelPosition left`(`left|center|right`) / `scrollToTopOnClick true`(点击导航后滚回顶部)

### 3.29 popupNotice — 弹窗公告

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `false` | 总开关；启用但无任何内容（title/body/image/qr/buttons 全空）仅告警不渲染 |
| `delayMs` | number | `1500` | 页面加载后延迟弹出毫秒 |
| `frequency` | string | `day` | 记忆频率：`session`（当次会话）/`day`（每日一次）/`always`（每次都弹） |
| `reshowOnChange` | bool | `true` | 内容哈希变化后忽略频率记忆重新弹出 |
| `storageKey` | string | `s-popupNotice` | 关闭记忆 localStorage 键 |
| `width` | string | `440px` | 弹窗最大宽度（CSS 长度） |
| `removeDelayMs` | number | `240` | 关闭后移除 DOM 延迟毫秒（配合淡出动画） |
| `title` / `titleEn` | string | `''` | 标题（en 站空回退中文） |
| `body` / `bodyEn` | string | `''` | 正文（空行分段，纯文本渲染，不解析 Markdown） |
| `image` / `imageAlt` / `imageAltEn` | string | `''` | 插图路径与替代文本（`imageAltEn` 空回退中文） |
| `qr.enabled` | bool | `false` | 二维码区块开关 |
| `qr.src` | string | `''` | 二维码图片路径 |
| `qr.caption` / `qr.captionEn` | string | `''` | 二维码下方说明（en 站空回退中文） |
| `buttons[]` | array | `[]` | 按钮数组，每项 `{label,labelEn,url,style:primary\|ghost,newTab}` |
| `closeButton.enabled` | bool | `true` | 底部关闭按钮 |
| `closeButton.label` / `labelEn` | string | `知道啦` / `Got it` | 关闭按钮文案 |
| `closeButton.style` | string | `primary` | 按钮风格（同 buttons） |
| `closeIcon` | bool | `true` | 右上角 × 图标 |
| `closeOnBackdrop` | bool | `true` | 点遮罩关闭 |
| `escToClose` | bool | `true` | Esc 关闭 |
| `colors.*` | object | `{}` | 配色覆盖：`overlay`/`background`/`text`/`textSecondary`/`border`/`primary`/`primaryText`/`ghost`，留空跟随主题变量 |

> 构建期由 `scripts/lib/popup-notice-config.js` 归一化并校验；配置随运行时外置配置注入，移动端真机点检项见 `docs/mobile-checklist.md` 第 9 条。

### 3.30 analytics

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `true` | 统计注入开关（同时要求 `site.webAnalytics.enabled` 为真且解析出 token） |
| `scriptSrc` | string | `https://static.cloudflareinsights.com/beacon.min.js` | 信标脚本地址（换非 CF 域名需同步放行 CSP） |
| `injectAt` | string | `body` | 注入位置：`body`（`</body>` 前）/`head`（`</head>` 前）；非法值由 schema 拒绝 |
| `emitBeacon` | bool | `true` | 是否输出 `data-cf-beacon` JSON（false = 不把 token 下发到页面） |
| `siteTag` | string | `''` | 站点级 token 覆盖（非空优先于 `site.webAnalytics.token` 与环境变量） |

> **接线说明（构建期注入）**：
> - 注入条件：`features.analytics.enabled` 与 `site.webAnalytics.enabled` 同为真，且解析出 token（见下）；token 为空时不注入（保持历史「无 token 警告」）。
> - token 优先级：**`siteTag`（非空）> `site.webAnalytics.token` > 环境变量 `CF_WEB_ANALYTICS_TOKEN`**；`siteTag` 作为 token 的站点级覆盖来源（切换统计属性/环境时无需改 site.json5）。
> - `injectAt`：`body`（默认）= 在 `</body>` 前注入引导脚本；`head` = 在 `</head>` 前注入。非非法值（含 `end-of-body` 等描述写法）由 schema 枚举校验拒绝。
> - `emitBeacon=false`：脚本仍按 `scriptSrc` 加载，但不输出 `data-cf-beacon` JSON（token 不下发到页面）。
> - `scriptSrc` 更换为非 Cloudflare 域名时需同步 `security.csp` 放行（CSP 自动裁剪只认 Cloudflare 官方域名）。
> - canonical：`scripts/lib/feature-wiring.js → analyticsConfig / buildAnalyticsTag`（单测覆盖转义与开关）、`scripts/build/config.js`（token 优先级）。

### 3.31 redirects

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `true` | `site.json5` 自定义规则开关（false 时仍生成框架语言/别名规则） |
| `generatePagesFile` | bool | `true` | false = 完全不产出 `dist/_redirects`（含框架别名） |
| `applyInServe` | bool | `true` | false = `_redirects` 照常生成，仅本地 serve 不应用 |
| `invalidRule` | string | `abort` | 非法规则策略：`abort`（记录构建失败，非零退出）/`warn-only`（告警并跳过该条） |

> **接线说明**：
> - `enabled=false`：跳过 `site.redirects` 自定义规则，仍生成框架语言/别名规则（`/ → /{lang}/`、`/feed.xml`、`/search-index.json`、自定义页面别名）。默认 `true`（对齐历史「恒应用自定义规则」行为；原默认 false 与实现漂移已修正，见 CHANGELOG Changed）。
> - `generatePagesFile=false`：完全不产出 `dist/_redirects`（含框架别名）；本地 serve 无文件可读。
> - `applyInServe=false`：`dist/_redirects` 照常生成（部署侧生效），仅本地 serve 跳过应用，便于直测真实页面。
> - `invalidRule`：`abort`（默认）= 非法规则记录构建失败（`recordBuildFailure`，构建以非零退出；`--allow-degraded` 可降级继续）；`warn-only` = 仅 `[WARN]` 并跳过该条。非法判定与清洗见 `scripts/lib/redirect-rules.js`（单测覆盖：缺失字段、非 `/` 开头、非 http(s) 目标、控制字符剔除）。
> - canonical：`scripts/lib/redirect-rules.js` + `scripts/build/security-files.js` + `scripts/build/serve.js`。

### 3.32 maintenance

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `false` | 声明维护响应参数是否生效于服务端配置生成（运行开关仍为 `MAINTENANCE=1`/`--maintenance`） |
| `message` / `messageEn` | string | `站点维护中，请稍后再来。` | 维护页文案（en 站空回退中文） |
| `status` | number | `503` | 维护响应状态码 |
| `setRetryAfter` | bool | `true` | 是否输出 `Retry-After` 响应头 |
| `retryAfter` | number | `3600` | `Retry-After` 秒数（非法/非正回退 3600） |

> **接线说明（本地 serve 与 Worker 同源）**：`setRetryAfter=false` 时维护响应不输出 `Retry-After`；`retryAfter`（秒，非法/非正回退 3600）为响应值。构建期经 `scripts/generate-security-config.js → maintenanceWorkerConfig` 写入 `workers/security-config.js`，Worker 读取后应用于维护响应；本地 serve 直接读 `config.features.maintenance`。运行开关仍为 `--maintenance`/`MAINTENANCE=1`（serve）与 Worker 环境变量 `MAINTENANCE=1`（`enabled` 键不参与运行时开关）。单测：`scripts/security-worker.test.js`（Worker 关闭态）+ `scripts/config-wiring.test.js`（归一化）；runner 覆盖 serve 两态。

### 3.33 mobile
`enabled true` / `searchFullscreen true` / `buttonStackGap 3.4rem` / `touchFallback true` / `codeScrollHint true` / `tocBreakpoint 768`(移动端 TOC 按钮断点 px) / `safeAreaBottom true`(底部安全区留白) / `tapHighlight false`(取消点击高亮)

> **接线说明**：
> - `searchFullscreen=false` = 移动端（≤ mobileBreakpoint）搜索不再全屏：遮罩透明化 + 头部下方下拉面板（`pointer-events:none` 透传页面，弹层本体可交互；点遮罩关闭随之不可用，Esc / 关闭按钮保留）。`true`（默认）= 全屏遮罩层（现状）。
> - `buttonStackGap` = 移动端目录按钮与返回顶部按钮的堆叠步进（CSS 变量 `--mobile-buttonStackGap`）：m-toc-btn 底距 = `tuning.mobileToc.btnMobileBottom - 3.4rem + 本键`；默认 `3.4rem`（原默认 `4rem` 与历史实现不符，按视觉不变修正为 3.4rem → 7.4rem，见 CHANGELOG Changed）。
> - `touchFallback=true`（默认）= 触屏设备（`ontouchstart` / `maxTouchPoints` / `hover:none`）由 `js/domains/features/touch-fallback.js` 置 `html[data-touch-fallback]`，点击/聚焦 pre、标题（h2-h4）、Mermaid 容器时加 `.touch-reveal` 显形复制按钮/标题锚点/图表复制；卡片遮罩用 `:active`。`false` = 不注入任何触屏替代交互（CSS 规则亦不输出）。
> - `codeScrollHint=true`（默认）= 超宽（scrollWidth 超出 8px 以上）代码块右下角显示「可横向滚动」提示（`ui-strings toolbar.codeScrollHint` 双语），首次横滚后加 `.code-scrolled` 自动隐藏；`prefers-reduced-motion: reduce` 下关闭过渡；`false` = 无提示且 CSS 不输出。
> - canonical：`scripts/lib/feature-wiring.js → mobileConfig`（单测覆盖门控与默认值）。

### 3.34 comments 前端
`enabled true` / `loadContainer true` / `renderPlaceholder true` / `placeholderText 评论加载中…`(占位文案;`placeholderTextEn` en 站) / `loadDelayMs 300`(占位显示时长 ms,过后无组件则显示 emptyText) / `emptyText 暂无评论`(无评论提示;`emptyTextEn` en 站，运行时按语言取) / `title 评论`（`titleEn` en 站；均空回退中文）

### 3.35 contactPopup
`enabled true` / `title 联系方式` / `copyText 复制` / `copySuccessText ''`(复制成功提示,留空用内置双语文案)（`titleEn`/`copyTextEn`/`copySuccessTextEn` 为 en 站文案，空回退中文） / `popupWidth 400px` / `showAllItems true` / `showIcon true`(弹窗顶部图标) / `maxItems 4`(最多联系方式条目数,多行值按行截断)。弹窗实际标题/正文来自 `site.social.items[].popupTitle/popupContent`（en 站优先 `popupTitleEn`/`popupContentEn`，见 §1 site.social）

> **接线说明**：
> - `popupWidth` = 弹窗最大宽度（构建期写入 `.contact-popup-modal` 的 `max-width`）。**默认值由 `360px` 修正为 `400px`**（原默认从未生效，模板恒 400px；按「视觉不变」对齐实现，见 CHANGELOG Changed）。
> - `copyText(_En)` = 值块「复制按钮」的 `title`/`aria-label`（值块为 `role=button` + `tabindex=0`，Enter/Space 可复制）；链为 `*En`(en 站) > 中文 > `ui-strings common.copy`（新增引用）。
> - `showAllItems=false` = 条目超过 2 条时折叠为前 2 条 + 「更多」展开器（展开后显示全部至 `maxItems`，按钮切换为「收起」；文案取 `ui-strings common.more` / `toolbar.collapseAll`）。默认 `true` = 全量展示。
> - canonical：`scripts/lib/feature-wiring.js → contactPopupConfig/contactCopyText`（单测覆盖宽度默认与文案链）。

### 3.36 softNavigation — 软导航（无整页刷新跳转）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `true` | 总开关 |
| `toggle.show` | bool | `true` | 显示页内「页面加速」开关（导航栏闪电图标） |
| `toggle.defaultOn` | bool | `true` | 首次访问默认开启 |
| `toggle.storageKey` | string | `s-soft-nav` | 开关记忆 localStorage 键 |
| `prefetchOnHover` | bool | `true` | 悬停链接时预取目标页 HTML |
| `prefetchDelayMs` | number | `80` | 悬停预取延迟毫秒（防误触） |
| `cacheTtlMs` | number | `300000` | 内存缓存有效期毫秒（前进/后退复用同页） |
| `timeoutMs` | number | `10000` | fetch 超时毫秒，超时回退整页跳转 |
| `viewTransition` | bool | `true` | 同文档过渡动画（配合 `features.viewTransition`） |
| `excludeSelectors[]` | array | `['[data-no-soft-nav]','.no-soft-nav']` | 不拦截的链接选择器 |
| `scrollToTop` | bool | `true` | 进入新页后回到顶部（后退恢复原滚动位置） |
| `cacheMaxEntries` | number | `16` | 内存缓存最多页面数（超出按最旧淘汰；≥1） |

> 仅拦截同源、同语言段（`/zh/` 或 `/en/`）、非资源文件的左键链接；跨语言、外部链接、下载、`target=_blank`、仅 hash 跳转均走原生导航；任何异常（超时/目标结构缺失/交换报错）自动回退 `location.href` 整页跳转。页面级模块经 `window.__SOFTNAV_HOOKS__` 注册重绑；`window.__softNav` 提供 `isOn/setOn/navigate` 调试句柄。CF Web Analytics 信标只在文档加载时计数，软导航不产生新的页面浏览记录（如需 SPA 级统计请关闭软导航或自行接埋点）。

### 3.37 performance

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `warningJsKb` | number | `80` | `assets/js` 全部应用 JS（gzip 合计）超限告警 |
| `warningHtmlKb` | number | `400` | 最大 HTML 原始体积（单页 raw）超限告警 |
| `warningImageKb` | number | `300` | `dist/media` 用户图片（优化后）超限告警，列最多 10 条；OG 产物不计 |
| `warningBuildMs` | number | `30000` | 本次构建耗时超限告警 |

> **构建性能告警（仅提示，不阻断）**：构建收尾按实测值逐项输出 `[WARN]`——
> - `warningJsKb`：`assets/js` 全部应用 JS（gzip 合计）超限；
> - `warningHtmlKb`：最大 HTML 原始体积（单页 raw）超限；
> - `warningImageKb`：`dist/media` 用户图片（优化后）超限，列最多 10 条；OG 产物不计（尺寸由 `features.ogImage` 控制）；
> - `warningBuildMs`：本次构建耗时超限。
> 阈值 ≤0/非法 = 不告警；与预算门禁 `features.perfBudget` 职责区分：**本组只发 `[WARN]`，perfBudget 输出 `[budget]` 报告且可配置 `warnOnly=false` 阻断构建**。canonical：`scripts/lib/feature-wiring.js → performanceWarnings`（单测覆盖）+ `scripts/build/report.js`。

### 3.38 debug

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `verbose` | bool | `false` | 输出构建阶段耗时标记（`[DEBUG] …（+Nms）`）与增量构建逐页跳过明细 |
| `listPages` | bool | `false` | 构建末输出渲染页面清单（相对产物根路径、按字典序） |
| `dumpConfig` | bool | `false` | 配置校验后输出解析合并配置摘要（顶层模块与键数、关键开关；敏感字段只显示是否已设置，不输出明文） |

> **开发助手（默认全关，不影响正常输出）**：
> - `verbose=true`：输出构建阶段耗时标记（`[DEBUG] …（+Nms）`）与增量构建逐页跳过明细（`[incremental] skip: path`）；
> - `listPages=true`：构建末输出渲染页面清单（相对产物根路径、按字典序）；
> - `dumpConfig=true`：配置校验后输出解析合并配置摘要（顶层模块与键数、关键开关；token/secret 等敏感字段只显示是否已设置，绝不输出明文）。

### 3.39 sitemap — 站点地图拆分(Sitemap Split)
> 配置位于 `features.json5` 下的 `sitemap` 段。拆分语义:URL 总数 ≤ `maxUrlsPerFile` → 单一 `<urlset>` sitemap.xml;URL 总数 > `maxUrlsPerFile` → 生成 `sitemap-1.xml … sitemap-N.xml` + `sitemap.xml`(sitemapindex 索引)。与 `site.json5` 的 `sitemap` 段(csp 开关)联动——`site.sitemap.enabled=false` 时整体跳过。

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `split` | bool | `true` | 是否启用拆分。`false` 时无论 URL 多少永远单文件 |
| `maxUrlsPerFile` | number | `500` | 每个 sitemap 文件最多 URL 数;低于强制 `10`;逻辑上限 `50000`(协议) |
| `postPriority` | string | `'0.8'` | 文章页优先级(`0.0`~`1.0`) |
| `pagePriority` | string | `'0.6'` | 独立页面(首页/归档/相册/收藏)优先级 |
| `tagPriority` | string | `'0.4'` | 标签页优先级 |
| `postFrequency` | string | `'weekly'` | 文章页更新频率(always/hourly/daily/weekly/monthly/yearly/never) |
| `pageFrequency` | string | `'monthly'` | 页面更新频率 |
| `tagFrequency` | string | `'monthly'` | 标签页更新频率 |

**示例**(features.json5):
```json5
sitemap: {
  split: true,
  maxUrlsPerFile: 500,
  postPriority: '0.8',
  pagePriority: '0.6',
  tagPriority: '0.4',
  postFrequency: 'weekly',
  pageFrequency: 'monthly',
  tagFrequency: 'monthly'
}
```
拆分输出:URL 61 条(≤500)→ `sitemap.xml`(单一文件 61 url);URL 600 条(>500)→ `sitemap-1.xml`(500)+`sitemap-2.xml`(100)+`sitemap.xml`(sitemapindex 索引 2 条)。索引格式:`<sitemapindex>` → `<sitemap>https://host/sitemap-1.xml</sitemap>` + `sitemap-2.xml`。

### 3.40 themePresets — 主题预设切换器
`enabled true` / `pickerVisible true` / `persistChoice true` / `showInNavbar true` / `previewOnHover true`。6 套调色盘(Classic Blue / Cyber Purple / Forest Green / Sakura Pink / Editorial Gray / Midnight Black),点击即切换 CSS 变量并 localStorage 持久化(`ss-preset`)。

### 3.41 themeSchedule — 深色定时切换
`enabled false`(默认关) / `darkFrom '22:00'` / `lightFrom '06:00'` / `respectManualOverride true` / `applyInstantly true` / `checkIntervalMs 60000` / `smoothTransitionMs 350`(平滑过渡时长 ms) / `smoothTransition true`。按固定每日时段自动切主题,检查周期以毫秒计(默认 60000 = 每分钟);smoothTransition 开启时切换瞬间给 html 加 `theme-switching` 类,按 `smoothTransitionMs` 过渡。

### 3.42 readDock — 移动端阅读侧栏
`enabled true` / `showProgressRing true` / `showTocButton true` / `showTopButton true`（三者 false 逐项隐藏；全 false 时整个坞不渲染） / `hideOnScrollDown true` / `hideBelowPx 80`(低于该滚动距离恒显，避免首屏抖动) / `directionDeltaPx 12`(方向判定最小增量 px，抵抗抖动) / `position right`。移动端右下角的进度环 + 回目录 + 回顶按钮。

> canonical：`scripts/lib/feature-wiring.js → readDockScrollConfig`（默认 80/12 = 历史行为）。

### 3.43 sidebarDrag — 侧栏拖拽重排
`enabled true` / `persistOrder true` / `storageKey 's-sidebarOrder'` / `touchLongPress true` / `touchLongPressMs 500`(长按判定时长 ms) / `showHandleOnHover true` / `resetOnLoadFail true`。用户可拖拽侧栏 widget 重排顺序,存储于 localStorage;移动端长按 `touchLongPressMs`(默认 500ms) 触发。

### 3.44 ogImageStyle — 社交卡片样式
`enabled true` / `template 'aurora'`(`aurora|mesh|grid|paper|duotone`;无封面文章的 OG 底图模板) / `palette 'theme'`(`theme|hash`;hash=按首个分类名哈希取色,同分类同色) / `showCategory true`(封面角标) / `align 'center'`(`center|left`) / `showSite true`(站点名) / `showUrl true`(右下角站点 URL;false=保持画面简洁) / `useGradient true` / `gradientAngle '135deg'` / `fontSizeBase 64` / `maxLines 4` / `letterSpacing '0.02em'`。构建期为无封面文章生成模板化 OG 图(1200×630;尺寸与字号缩放经 `site.seo.ogImage` 的 width/height/fontScale 控制);有封面文章走"封面+底部渐变条"合成 — `scripts/generate-og.js`。

### 3.45 hero — 首页 Hero
`enabled true` / `showSearch true` / `showTags true` / `showCta true`(CTA 按钮开关，与 `site.hero.showCta` 取与) / `tagCount 8` / `showDate false`(显示最新文章日期) / `ctaLabel 查看全部文章`(`ctaLabelEn View all posts` en CTA 文案；`site.hero.ctaLabel(En)` 优先，空回退本模块) / `ctaUrl '#latest-post'`(CTA 目标；`site.hero.ctaUrl` 优先) / `searchPlaceholder 搜索文章…` / `searchPlaceholderEn Search posts…`（接线说明：构建期 SSR，hero 键 > `ui-strings.toolbar.searchPlaceholder(En)`；空串回退 ui-strings） / `heightVh 61.8`(Hero 最小高度 vh) / `backgroundImage ''`(背景图 URL,空则纯色/渐变)。首页顶部横幅,显示标题简介+搜索+热门标签；内容源优先取 `site.hero.*`（见 §1 site.hero）。

### 3.46 background — 背景特效
`background.particles.enabled true`（粒子总开关；仅 `theme.background.mode='particles'` 时生效，颜色自动跟随 `--color-s`） / `particles.count 72`(10~120，越少越省电) / `particles.speed 0.5`(0.2~2) / `particles.linkDistance 120`(连线距离 px) / `particles.opacity 0.7`(0~1) / `particles.showLines true` / `particles.autoDisableMobile false`(触屏/窄屏自动关闭粒子) / `particles.mobileMaxWidth 640`(autoDisableMobile 的窄屏阈值 px)。

### 3.47 motion — 滚动动效
`enabled true` / `ease cubic-bezier(.4,0,.2,1)` / `pageEnterDurationMs 240`(页面入场时长 ms) / `cardHoverScale 1.02`(卡片悬停缩放) / `linkUnderlineOffset 3px`(下划线偏移) / `cardHoverLift true` / `cardHoverLiftPx 4` / `linkUnderline true` / `linkUnderlineThickness 2px` / `buttonRipple true` / `rippleDurationMs 500` / `scrollReveal true` / `revealCards true` / `revealHeadings true` / `revealImages true` / `revealBlocks false` / `revealDurationMs 250` / `revealDelayMs 0` / `revealStaggerMax 500`(错峰总附加延迟上限 ms：单项 delay=min(revealDelayMs, 剩余预算)，预算耗尽后其余同时入场) / `revealOffset 10px` / `revealOnce true` / `revealThreshold 0.08` / `revealCleanupMs 1400`(reveal 结束清理 transitionDelay 延迟 ms) / `reducedMotion 'light'`(`light|off|full`,轻量版:更短/幅度更小)。滚动渐入/悬停上浮/涟漪/下划线动效总控。**注意**:顶部导航高亮与滑动指示器已抽为独立模块 `js/domains/core/nav-state.js`(构建期 `templates/layout.ejs` 输出 `nav-active`/`aria-current` 兜底),不受本开关影响——`enabled:false` 或 `reducedMotion:'off'` 时高亮仍由 SSR 保证,软导航后仍会更新。

### 3.48 dailyQuote — 每日一言
`enabled true` / `widgetStyle 'card'`（侧栏外观：`card` 卡片外框（默认/现行为）/`plain` 无外框仅文字与署名；兼容旧值 `sidebar`（=card）；运行时给 `.quote-widget` 附加 `quote-widget-card`/`quote-widget-plain`） / `label '每日一言'`（`labelEn` en 站文案，空回退中文） / `source 'builtin'`(内置 7 条;也支持相对项目根或绝对路径的 `.json`/`.json5`,格式 `["引语"]` 或 `[{text,author}]` 或 `{quotes:[...]}`;加载失败回退内置并告警) / `count 7` / `quoteColor ''`。侧栏每日名言(内置 7 条,按日期轮换)。

### 3.49 favorites — 收藏(纯前端)
`enabled true` / `position 'toolbar'`(`toolbar`=文章底部工具栏,默认/`meta`=标题下元信息行) / `storageKey 's-favorites'` / `label '收藏'` / `listIcon true`（/favorites 收藏页列表项显示收藏图标（inline SVG，aria-hidden）；false=纯文字列表） / `notText '收藏'` / `favedText '已收藏'`（`labelEn`/`notTextEn`/`favedTextEn` 为 en 站兜底文案，空回退中文；en 站优先取 ui-strings `favorites.*`）。文章收藏按钮+收藏页(仅 localStorage,无后端);按钮切换收藏/取消(状态+aria-pressed+统一 toast)、收藏页列表渲染与移除、空状态。

### 3.50 prismTheme — 代码高亮配色开关
`enabled true`。总开关：关闭后代码块不着色（回退纯文本）；token 配色值定义在 `theme.json5` 的 `codeHighlight.palette`（浅色/暗色两套，随主题自动切换）。

### 3.51 cover — 封面样式库
`enabled true` / `patterns[]` (gradient/stripes/dots/blob/mesh) / `defaultPattern 'gradient'`（封面样式选择器 initial active；不在 patterns 内时回退 patterns[0]；`preferImage=false` 时文章头图初始即应用该 pattern） / `preview true` / `preferImage true`（true=文章头图显示 featuredImage（现行为），点选样式后切换为 pattern 合成块；false=初始即渲染 defaultPattern 合成块替代图片 — `js/domains/features/cover.js`）。文章封面样式库(渐变/条纹/圆点/气泡/网格),点选即用；选择器按钮的运行时行为已补齐。

### 3.52 i18n — 内容级双语
`enabled false` / `defaultLanguage 'zh'` / `languages[] ('zh','en')` / `navToggle true` / `translationNotice true`(文章页翻译互链提示:另一语言存在同 slug 文章时在标题下显示胶囊链接,文案 `post.translationNotice` 支持 `{lang}` 占位) — `features.i18n` 另见 §3.73。**内容级双语**:文章存于 `articles/zh/` 与 `articles/en/` 双目录,URL 带语言前缀(`/zh/slug/`、`/en/slug/`),每语言生成完整站点(首页/文章/归档/标签/分类/搜索/RSS/sitemap/search-index),根路径 `/` 按浏览器语言跳转(localStorage `s-ss-lang` 记忆)。界面文案经 `ui-strings.json5` 词典 + 服务端 `ui()` / 运行时 `__T()` 双语渲染;导航/页脚/侧栏/主题预设支持 `labelEn`/`titleEn` 字段（页脚自定义 HTML 另支持 `htmlEn`）。站点级文案同样按语言取用：`descriptionEn`/`metaKeywordsEn`/`authorProfile.bioEn` 空则回退中文;`languageEn` 控制 en 页 `<html lang>` 与侧栏日期本地化（缺失时回退 `en-US`，避免英文页出现“2026年9月10日”式中文日期）。**运行时语言以 URL 前缀为准**（localStorage 仅作为无前缀路径的偏好记忆），语言切换保持当前子路径。

### 3.53 pagefind — Pagefind 全文搜索
`enabled true` / `indexPath '/pagefind'` / `integrate true`（false=即使 provider=pagefind 也回退内置本地搜索链路：搜索浮层与 /search/ 页均不加载 Pagefind UI，构建期同时产出 `search-index.json` 供本地链路使用）。使用 Pagefind 的离线全文搜索(navigation.search.provider='pagefind' 且本模块 enabled 时生效)。**构建在压缩与哈希之后自动生成索引,输出到 `indexPath`(不参与 cache-bust;先清空旧索引再写入);未安装 pagefind 依赖时告警跳过(`npm install -D --save-exact pagefind`;该依赖默认不在 devDependencies 中);serve/watch 模式同样生成,保证本地预览与生产一致。**

### 3.54 giscus — Giscus 评论
`enabled false`(默认关) / `repo ''` / `repoId ''` / `category 'Announcements'` / `categoryId ''` / `mapping 'title'` / `theme 'preferred_color_scheme'` / `loading 'lazy'` / `crossorigin 'anonymous'`。与 site.comments(provider='giscus')联动——两者都必须配置才显示。

### 3.55 scrollBehavior — 滚动行为
`enabled true` / `behavior 'smooth'`(`smooth|auto`) / `anchorOffset '18px'`(锚点额外偏移,最终 scroll-padding-top = calc(var(--hh) + 该值)) / `respectReducedMotion true`(reduced-motion 时降级 auto)。统一接管全站平滑滚动(CSS scroll-behavior + JS 滚动调用经 `__SB()`);原 theme.animation.scrollBehavior 已移除。

### 3.56 toast — 统一轻提示
`enabled true` / `position 'bottom-center'`(`bottom-center|top-center|top-right|bottom-right|top-left|bottom-left`) / `durationMs 2500` / `maxVisible 3` / `removeDelayMs 300`(淡出后移除节点延迟 ms)。统一 `window.__toast(msg,{type,duration})` API;内置 info/success/warning/error 四类(无需配置);分享复制与联系复制已迁移到统一 toast(原内联提示元素移除)。

### 3.57 breadcrumb — 面包屑导航
`enabled true` / `separator '›'` / `showHome true` / `showCurrent true`。所有页面(首页与 404 除外)顶部显示;文章页层级:首页 › 分类 › 标题(与 JSON-LD 结构化数据一致);列表页:首页 › 归档/标签/分类/搜索/收藏/图库/友情链接;自定义页:首页 › 标题。

### 3.58 pageTransition — 页面切换过渡
`enabled true` / `type 'slide'`(`slide|fade`) / `durationMs 180`(入场) / `outDurationMs 120`(离开淡出) / `reducedMotion 'light'`(`light|off|full`,轻量版:短纯淡出) / `excludeSelector '[data-no-transition]'` / `leaveGuardMs 2500`(导航失败兜底观察窗口 ms) / `reducedDurationMs 70`(reduced-motion 下离开时长上限 ms)。内链点击淡出 → 导航 → 新页入场;外链/新窗口/hash/下载链接不拦截;原 `motion.pageEnterDurationMs` 与 `theme.animation.pageTransition` 已移除。

### 3.59 pwa — PWA 运行时
`enabled true` / `registerSW true` / `updatePrompt true` / `offlineNotice true` / `offlinePage true` / `installPrompt true` / `installDismissKey 's-a2hs-dismissed'`(安装按钮关闭记忆键) / `updateToastMs 6000`(更新提示时长 ms)。运行时总开关(需 `site.pwa.enabled` 同时开启);注册 `site.pwa.serviceWorker` 并监听更新(toast 提示)、监听离线/恢复(toast 提示);PWA 关闭时不再生成根 `/manifest.json`/`/site.webmanifest` 重定向别名(`_redirects` 仅保留 `/search-index.json`、`/feed.xml`、`/404.html` 根别名)。启用时若 manifest 图标指向的文件不存在，构建会从 `site.favicon.svg` 自动生成 192/512 PNG 并剔除缺失项。`offlinePage` 构建生成 `offline.html` 兜底页(断网访问未缓存页面时显示双语提示与重试按钮,SW 预缓存并在导航失败时回退);`installPrompt` 支持 beforeinstallprompt 的浏览器显示"安装到桌面"浮动按钮(可关闭,写入 `installDismissKey` 记忆)。

---

### 3.60 customCSS — 自定义 CSS 注入
| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关（关闭则完全不注入） |
| `css` | `['blockquote{...}']` | CSS 片段数组：每项一段字符串（支持注释），按顺序合并注入；置空 `[]` 即不注入 |
| `target` | `before-closing-body` | 注入位置（当前仅实现 `before-closing-body`，其余值保留） |

### 3.61 morphIcons — 图标变形动画

`enabled true` / `vendorPath '/assets/vendor/morphicons'`(vendor 图标目录) / `spring 'snappy'`(`smooth|snappy|bouncy`) / `reducedMotion 'light'`(`light|off|full`;light=系统 reduce-motion 下改用更快的轻量弹簧) / `preload 'interaction'`(`interaction|idle|immediate`) / `idleTimeoutMs 3000`(仅 `preload='idle'` 生效：requestIdleCallback 强制加载超时 ms) / `perIcon {}`(单图标弹簧覆盖,值=预设名或 `{stiffness,damping}`) / `icons { theme, copy, favorite, tts, menu }`(各图标独立开关)。基于 morphicons(本地 vendor,懒加载,~7.5KB gzip):状态切换类图标用弹簧物理做形状变形(主题 sun↔moon、复制 copy→check、收藏空心↔实心、朗读扬声器↔停止、移动端汉堡↔X);关闭任意开关均回退原有静态实现;弹簧参数见 `tuning.morphicons`(stiffness/damping 与轻量版 reducedStiffness/reducedDamping;同时设置时优先于 spring 预设)。

### 3.62 viewTransition — 跨文档过渡动画

`enabled true` / `type 'fade'`(`fade|slide`) / `durationMs 180` / `shared true`(共享元素过渡:列表卡片封面/标题 → 文章封面/标题 形变衔接,不支持时自动忽略) / `reducedMotion 'light'`(`light|off|full`;light=系统 reduce 时 0.1s 纯淡出) / `toggle { show true, defaultOn true, storageKey 's-view-transition' }`。基于跨文档 View Transitions(`@view-transition{navigation:auto}`)：同源跳转无白屏交叉过渡；不支持 VT 的浏览器自动忽略并回退 `pageTransition` 淡出；VT 生效时旧淡出被抑制（避免双重动画）；页内导航栏闪电图标可开关（localStorage 记忆），不支持的浏览器该开关自动置灰、两项均不支持时整组隐藏。

### 3.63 speculation — 预取/预渲染

`enabled true` / `mode 'both'`(`prefetch|prerender|both`) / `eagerness 'moderate'`(`moderate|eager|conservative`) / `delivery 'inline'`(`inline`=内联脚本+页内开关可控;`header`=构建 `speculation-rules.json` 并以 `Speculation-Rules` 响应头下发(Speed Brain 会礼让),页内开关不生效;`both`=双下发) / `excludeSelectors ['[download]','[rel~=nofollow]','.no-speculate']` / `toggle { show true, defaultOn true, storageKey 's-speculation' }`。基于 Speculation Rules（悬停约 200ms 预取/预渲染，仅 Chromium 系生效，其余浏览器自动忽略）：排除选择器与含查询串 URL；CSP 已加 `'inline-speculation-rules'` 关键字；预渲染期间统计信标与 Service Worker 注册经 `document.prerendering` 守门延后到 `prerenderingchange`（避免重复计数与副作用）；页内开关同样带记忆。

### 3.64 cardFx — 卡片视觉增强

`enabled true` / `coverOverlay true`(封面底部渐变遮罩) / `categoryChip true`(左下分类色标;按分类名哈希取色经 `--cat-h` 驱动,同分类同色) / `readTimeBadge true`(右上阅读时长徽章) / `hoverShine true`(悬停光泽扫过,自动尊重 reduced-motion)。作用于首页与标签页文章卡片 — `templates/index.ejs` + `templates/tag.ejs` + `templates/layout.ejs`。

### 3.65 magazine — 杂志排版

`enabled true` / `dropCap true`(首段首字下沉:衬线展示字体 + 主题色,中英文均生效) / `figureBleed true`(正文独立成段的图片向两侧出血,宽屏超出正文栏、≤1100px 自动回退;基于 `:has()` 的渐进增强) / `tableHover true`(表格行悬停高亮,主色混合) / `headingNumbers false`(h2 自动编号 01/02…,默认关以免与手写序号重复)。视觉值经 `tuning.magazine` 6 项可调(dropCapSize/dropCapColor/dropCapWeight/bleedWidth/tableHoverMix/headingNumberColor) — `templates/post.ejs` + `templates/layout.ejs`。

### 3.66 schemaRich — 结构化数据增强

`enabled true` / `breadcrumbs true` / `dateModified true` / `blogHomepage true` / `authorUrl true`(Article 增加作者主页 URL) / `wordCount true`(正文字数) / `timeRequired true`(预计阅读时长 `PT{n}M`) / `keywords true`(标签拼接为 keywords) / `articleSection true`(首个分类) / `image true`(指向生成的 OG 图)。开关关闭或数据缺失时对应字段自动省略 — `templates/layout.ejs`。

### 3.67 perfBudget — 性能预算门禁

`enabled true` / `htmlKb 28`(单页 HTML gzip 上限,含内联 CSS/脚本) / `htmlRawKb 50`(页面 HTML raw 体积中位上限;长文等极端页面由中位口径自然豁免) / `inlineConfigKb 2`(页面内联关键配置降级子集上限) / `jsKb 60`(应用 JS `assets/js` 全量 gzip 合计;vendor 库按需懒加载不计入;60KB 口径含 app+deferred+runtime 三包,deferred 为按需 chunk,首屏实际约 28KB——跨模块去重达标后可回调 55) / `requests 12`(单页静态请求上限:script src + stylesheet + modulepreload) / `warnOnly true`(`true` 仅提醒;`false` 超限终止构建)。构建收尾输出 `[budget]` 报告 — `scripts/lib/perf-budget.js` + `scripts/build.js`。

### 3.68 scrollIndicator — 滚动进度条

`enabled true` / `height '2px'`(任意 CSS 长度) / `gradient true`(`true`=主题次级色→强调色渐变;`false`=单色) / `respectReducedMotion true`(系统减少动态效果时隐藏)。顶部固定 hairline 进度条,基于原生 scroll-driven 动画(`animation-timeline: scroll(root)`)——零 JS、零主线程开销;不支持该特性的浏览器自动不显示(渐进增强) — `templates/layout.ejs`。

### 3.69 commandPalette — 命令面板

`enabled true` / `hotkey 'ctrl+shift+p'`(组合键,支持 `ctrl`/`cmd`/`meta`/`shift`/`alt` 修饰键;不含 `+` 的旧写法如 `'k'` 等价于主修饰键 Ctrl/Cmd+该键;置空 = 不监听;默认避开浏览器打印 Ctrl+P 与全站搜索 Ctrl+K) / `includeNavigation true`(页面导航项) / `includeActions true`(切换主题/回到顶部/打开搜索/我的收藏) / `includeSearch true`(首次打开时懒加载 search-index.json) / `maxResults 10`(结果上限) / `autoFocus true`。快捷键呼出居中面板,支持键盘上下选择、Enter 执行、Esc 关闭,中文输入法(IME)组合期不误触;样式由 `tuning.commandPalette`(`width`/`topOffset`/`backdropMix`)微调 — `js/domains/features/command-palette.js`。

### 3.70 subscribe — 订阅组件

`enabled true` / `rss true`(页脚订阅条显示 RSS 链接,指向 `{lang}/feed.xml`) / `jsonFeed true`(显示 JSON Feed,仍受 `site.rss.jsonFeed.enabled` 总控) / `newsletterUrl ''`(外部邮件订阅表单地址,如 Buttondown/Substack;空 = 隐藏按钮) / `newsletterLabel ''`(按钮文案,空 = 界面文案表 `subscribe.mail`) / `newsletterLabelEn ''`(en 站按钮文案,空 = `subscribe.mail` 英文词条) / `newTab true`。页脚自动渲染「订阅与更新」条;顺带修复 `<head>` 中 RSS alternate 链接双斜杠问题(`/zh//feed.xml`→`/zh/feed.xml`) — `templates/layout.ejs`。

### 3.71 authorCard — 作者卡(关于页)

`enabled true` / `pageSlug 'about'`(显示页面 slug) / `showSocial true` / `showSkills true` / `showTimeline true` / `avatarSize '96px'`(头像尺寸) / `maxTimeline 20`(时间线最多条数,0=不限)。数据源为 `site.authorProfile`(`name`/`avatar`/`bio`/`bioEn`/`skills[]`/`timeline[{year,title,desc}]`/`socials[{label,url}]`,全可选、未填项自动隐藏、整块可删除;资料至少一项非空时才渲染;`bioEn` 空则回退 `bio`) — `templates/page.ejs`。

### 3.72 readingHistory — 继续阅读(本地阅读历史)

`enabled true` / `maxItems 5`(首页最多条数) / `maxStored 50`(本地最多保存条数；超出按最旧淘汰) / `storageKey 's-history'`(localStorage 键,修改会丢弃旧历史) / `showOnHome true`(false=只记录不展示) / `clearable true`(显示清除按钮)。文章页自动记录(标题+路径+时间,上限 `maxStored` 条),首页在卡片区上方展示最近阅读(相对时间,`Intl.RelativeTimeFormat` 双语);纯本地、无服务端 — `js/domains/features/reading-history.js`。

### 3.73 hreflang — 多语言替代声明(SEO)

`enabled true` / `includeSelf true`(当前语言条目也输出) / `canonical true` / `xDefault true`(输出 `hreflang="x-default"`,指向 `features.i18n.defaultLanguage` 版本)。与 `features.i18n` 配合:每页输出各语言(URL 前缀替换)+ x-default 的 `<link rel="alternate">`;新增翻译时按 `articles/{lang}/{slug}.md` 同 slug 放置即可获得互链与声明 — `templates/layout.ejs`。

### 3.74 printStyle — 打印样式

`enabled true` / `hideInteractive true`(打印隐藏导航/页脚/侧栏/按钮/评论/相关推荐等) / `expandLinks true`(正文外链打印为 `文字 (URL)`) / `avoidBreaks true`(代码块/图片/表格/引用避免跨页断裂)。打印/导出 PDF 时强制白底黑字、去阴影、正文全宽 — `templates/layout.ejs`。

### 3.75 atmosphere — 氛围

`enabled true` / `grain true`(全局颗粒纹理叠层) / `glow true`(首页 Hero 主题色光晕)。颗粒/光晕的视觉参数在 `tuning.json5` 的 `texture`(noiseOpacity/noiseOpacityDark/noiseBaseFrequency)与 `glow`(heroStrength/heroStrengthDark)分类微调 — `templates/layout.ejs`。

### 3.76 announcement — 公告条

`enabled true` / `text` / `textEn` / `url`(单条模式：中英文文案与可选链接) / `items []`(多条模式，每项 `{text,textEn,url,icon?}`，非空时优先；`icon` 为前缀徽标短文本如 `"NEW"`) / `rotateMs 6000`(多条轮播间隔毫秒，`0`=只显示第一条；`prefers-reduced-motion` 下瞬间切换) / `pauseOnHover true`(悬停/按住暂停轮播与进度条) / `transition 'fade'`(条目切换动画：`fade` 淡入淡出 / `slide` 上滑+淡入) / `tone 'accent'`(`accent` 主题色淡渐变 / `solid` 实心主题色 / `minimal` 素色+下边框 / `gradient` 主→辅强渐变白字) / `showProgress false`(轮播剩余时间进度条；仅多条+自动轮播时渲染) / `showDot true`(左侧装饰圆点) / `newTab true`(外链 `target=_blank rel=noopener`；`false` 则当前窗口) / `dismissible true`(关闭按钮) / `storageKey 's-announce-dismissed'`(关闭记忆键；值为按语言区分的 JSON 对象，如 `{"zh":"…","en":"…"}`，旧版单值记录会在访问时自动迁移) / `removeDelayMs 340`(关闭动画后移除 DOM 延迟 ms)。固定于页面顶部（通过 `--annH` 变量将固定头部、移动菜单、粘性目录整体下移，内容偏移同步；**关闭后 `--annH` 收起为 0，头部自动上移**）；关闭按全部内容哈希记忆（`s-announce-dismissed`）不再出现。视觉细节（字号/字距/高度 `height`，高度同时决定 `--annH` 下移量与公告条实际高度）在 `tuning.json5` 的 `announcement` 分类调整。**防闪机制**：公告条默认隐藏，`<head>` 早检脚本在首帧前确认未被关闭后添加 `html.ann-on` 才显示；关闭记忆按内容哈希（`s-announce-dismissed`），关闭态刷新/导航零可见帧（禁用 JS 时公告不显示，属预期设计） — `templates/layout.ejs` + `js/domains/core/announcement.js`。

### 3.77 guards — 防护与交互控制总控

`enabled true`（总开关，false 时 guard.json5 全文件失效）/ `preset 'soft'`（一键档位：`off` 全关 | `soft` 仅右键菜单+复制署名（默认，体验友好）| `strict` 各模块按 guard.json5 内 `enabled` 生效）/ `contextMenu true` / `copyGuard true`（模块启停，soft 档下仅这两项可被 preset 激活）。细节参数（菜单项、复制模式、选择/快捷键/水印/检测/控制台/隐私帘/篡改/门槛、绕过通道等 176 项）全部在 `guard.json5`（见第 11 章）；绕过通道（`?guard=on` 覆盖一切 > `?guard=off` > `localStorage['s-guards-off']` > `core.bypass.localhost`，accessGate 的 `?key=` 由 `core.bypass.accessGateKey` 控制）均可由 `guard.json5 → core.bypass` 逐项开关，`bypass.enabled=false` 全部失效。**诚实声明**：拦截/检测类能力均为威慑手段（可被浏览器菜单/开发者工具/阅读模式绕过），默认档位保持安全温和 — `js/domains/guard/core.js`。

### 3.78 loading — 加载遮罩

`enabled true`（false = 不渲染遮罩；无 JS 时也不会出现）/ `delayMs 120`（启动快于该值不显示，防“一闪而过”）/ `minShowMs 250`（一旦出现至少停留，含淡出）/ `maxShowMs 2000`（硬超时强制淡出，失败兜底；同时写入 CSS 动画兜底）/ `reducedMotion 'skip'`（`skip` 不显示 | `static` 显示但无动画）/ `text ''`（空 = `ui-strings` 的 `common.loading` 双语）/ `ariaBusy true`（启动期间 `<body aria-busy>`）/ `spinner true`（转圈动画开关，false 仅文字）/ `spinnerStyle 'orbit'`（`orbit` 三点轨道 | `ring` 单环旋转）/ `showTitle false`（在动画上方显示站点名，取自页面标题栏站点名）/ `overlayColor ''`（转圈主色，空 = 跟随主题 `--color-s`）/ `fadeMs 380`（收尾淡出时长，同步 CSS 变量 `--loading-fade`）/ `zIndex 3000`（遮罩层级，高于导航/公告）/ `failsafeBufferMs 60`（`maxShowMs` 到点后强制淡出的额外缓冲 ms）。视觉（圆点大小/间距/跳动高度/文案字号/底色透明度/模糊/单环尺寸/标题字号）在 `tuning.json5` → `loading` 分类 — `js/core/boot.js` + `templates/layout.ejs`。

### 3.79 boot — 启动调度

`enabled true`（false = 旧行为：全部模块立即初始化）/ `idleTimeoutMs 800`（`requestIdleCallback` 超时兜底）/ `interactionWake true`（首次点击/按键/触摸/滚轮立即唤醒后续切片，保 INP）/ `log false`（`[boot]` 时间线）/ `budgetMs 40`（每批时间片上限，越大越快但更易长任务；推荐 30-50）/ `heavyMode 'idle'`（重模块时机：`idle` 空闲即启 | `interaction` 等首次交互或兜底 | `immediate` 不等待）/ `idleFallbackMs 120`（无 `requestIdleCallback` 浏览器的回退间隔）/ `interactionEvents ['pointerdown','keydown','touchstart','wheel']`（唤醒事件名列表，可增删如 `scroll`）/ `configTimeoutMs 3000`（外置配置加载超时 ms；构建期经 `window.__CONFIG_TIMEOUT__` 注入、`js/core/runtime.js` 读取，超时降级内联最小子集）。机制：仅 14 个关键模块静态初始化；17 个交互类模块动态导入、按 `budgetMs` 空闲切片加载；重模块（粒子背景/打赏）按 `heavyMode` 时机启动；时间线写入 `window.__BOOT__`（start/critEnd/idleEnd/heavyEnd/budgetMs/heavyMode），完成后置 `window.__APP_READY__`。实测启动后长任务为 0（原两个长任务 238ms+66ms 已消除） — `js/core/main.js` + `js/core/boot.js`。

### 3.80 imageFit — 图片适配（四域）

`enabled true`。**四域**：`content`（正文图片：`upscale 'never'`（默认不放大）| `'cap'` 最多放大 `cap 1.5` 倍 | `'full'` 铺满；`maxHeightVh 0` 限高（如 60=最多 60vh）；`align 'center'|'left'`）· `cover`（封面与卡片：`fit 'cover'|'contain'|'fill'`；`position 'center'|'top'|'bottom'|'left'|'right'` 或自定义 `'50% 30%'` 焦点；`maxHeightVh 0` 封面限高；`aspect ''` 封面宽高比（空 = 模板默认 16/10，如 `'16/9'`、`'21/9'`）；`applyToCards true` 是否同时作用于列表卡片封面）· `gallery`（`stretch false` 小图不再被拉伸（修复旧版变形）| `true` 旧行为；`maxHeightPx 0` 单图限高）· `lightbox`（`fit 'contain'`（默认）| `'actual'` 原始尺寸；`maxWidthPct 92` 最大宽（vw）、`maxHeightVh 82` 最大高）。实现（运行时零 JS）：构建期为图片注入 `data-iw`（自然宽）并在 cap 模式生成 `[data-iw]` 宽度规则；四域分别烘焙为 `--if-*` CSS 变量 — `scripts/build.js` + `templates/layout.ejs` + `scripts/lib/utils.js`。

### 3.81 exportBackup — 备份导出

`enabled true`（总开关）/ `includeMedia true`（打包 `media/` 图片）/ `includeConfig true`（打包 14 个 JSON5 配置，含 compression.json5）/ `outputDir 'exports'`（输出目录）/ `fileNamePrefix 's-ynapse-backup'`（归档名前缀，实际文件名追加时间戳）。由 `npm run export` 调用：配置 + 文章 + 媒体打包为单一归档，便于迁移与留档 — `scripts/export.js`。

### 3.82 mediaAudit — 媒体审计

`enabled true` / `reportMissed true`（报告文章引用但磁盘缺失的图片）/ `reportUnreferenced true`（报告存在但未被任何文章引用的图片）/ `reportDuplicate false`（报告内容重复的文件，默认关，大站耗时）/ `output 'console'`（报告输出方式）。由 `npm run audit:media` 调用；构建期发现引用缺失会记入构建报告 — `scripts/audit-media.js`。

### 3.83 autoSummary — 自动摘要

`enabled true` / `maxLength 160`（摘要最大字符数）/ `fallback 'firstParagraph'`（front-matter 无 `description` 时的回退取值）/ `stripMarkdown true`（frontmatter `excerpt` 先剥离 Markdown 标记（链接/强调/标题/列表/代码/内联 HTML）再使用；false=原样保留，纯函数 `scripts/lib/feature-wiring.js → stripMarkdownText`。注：无 frontmatter excerpt 时自动摘要由渲染后 HTML 去标签生成，天然不含 Markdown）/ `ellipsis '…'`（截断省略号，空则不加）。用于 SEO `<meta name="description">` 与列表摘要 — `scripts/build/articles.js`。

### 3.84 searchEnginePing — 搜索引擎推送

`enabled false`（**默认关闭**）/ `engines ['google']`（推送目标引擎列表）/ `onlyProduction true`（仅生产构建推送，本地构建跳过）/ `timeoutMs 5000`（单次请求超时）。推送失败只写构建日志、不终止构建 — `scripts/build.js`。

### 3.85 ogImage — 自动 OG 图

`enabled true` / `width null` / `height null`（输出尺寸；**null = 自动**：全站文章封面仅 1 张 → 用该图尺寸；多张 → 取面积最大者；0 张 → 1200×630。显式填数字时需 width+height 同时提供，且优先于自动检测；示例 `width: 1200, height: 630`）/ `autoSize { enabled true, maxDimension 2560 }`（自动尺寸开关与长边上限，超限等比缩小）/ `coverFit 'cover'`（有封面时缩放方式：`cover` 裁切填满 / `contain` 完整显示可能留白（jpeg 留白为黑）/ `fill` 拉伸不推荐）/ `overlay { enabled true, wrap 20 }`（封面标题叠层开关与每行最大字符数）/ `format 'png'`（输出格式：`png` 默认无损 / `jpeg` 有损体积更小，`jpg` 视为同义；切换后旧格式文件下次构建自动清理）/ `jpegQuality 82`（`format='jpeg'` 时生效，1–100，越界回退 82）/ `useCover true`（有封面时以封面为底图）/ `gradientForNoCover true`（无封面时生成渐变底）/ `fontScale 0.75`（标题字号相对缩放）。OG 图 URL、`og:image`/`twitter:image`/JSON-LD image 与输出扩展名由 `format` 统一决定；页面 `<meta og:image:width/height>` 由构建期 `lib/og-size.js` 的同一解析结果（`baseData.ogImageSize`）注入，与实际产图尺寸一致（此前硬编码 1200×630）。`serve` 模式跳过生成 — `scripts/generate-og.js` + `scripts/lib/og-size.js` + `scripts/lib/og-format.js` + `templates/layout.ejs`。

### 3.86 hotSearches — 热门搜索

`enabled true` / `top 5`（热门搜索展示条数）/ `storageKey 's-hotSearches'`（最近搜索数组；词频存 `storageKey + ':hot'` 对象，最多保留 `maxWords` 词）/ `showInDropdown true`（搜索下拉展示「热门搜索」分组；false = 仅最近搜索）/ `showClear true`（提供清空热门词按钮）/ `maxWords 50`（词频表上限，超出按词频淘汰）。数据源为本地搜索历史词频，纯前端、无服务端；搜索时 `saveHistory` 同步累加词频，聚焦/空输入时渲染热门（按词频降序，`__T('search.hot')` 分组标题）— `js/domains/features/search.js`。

### 3.87 readingTime — 阅读时长

`enabled true` / `wordsPerMinuteCJK 250`（中文每分钟字数）/ `wordsPerMinuteLatin 200`（拉丁文每分钟词数）/ `showInMeta true`（文章元信息区展示；false 同时隐藏配置文案与模板内置「分钟阅读」两处）/ `labelBefore ''` / `labelAfter '阅读约需'`（`labelAfterEn` 为 en 站后缀「 min read」，空回退中文；前/后缀空则回退 `ui-strings` 词典）。CJK 与拉丁字符分别按各自速率估算后相加 — `templates/post.ejs`。

### 3.88 codeCopy — 代码块复制按钮

`enabled true` / `buttonText '复制'` / `copiedText '已复制'`（成功态文案）/ `buttonTextEn ''` / `copiedTextEn ''`（en 站文案，空回退中文/词典）/ `buttonTimeout 1500`（成功态停留毫秒）/ `showLineNumbers false`（行号列）。文案留空时回退 `ui-strings` 词典；运行时按页面语言取 `*En` — `js/domains/core/code-block.js`。**窗栏（Mac 窗栏样条）由 `features.codeBlock.windowBar` 控制（单一来源）。**

### 3.89 tocScrollSpy — 目录滚动高亮

`enabled true` / `activeClass 'current'`（当前标题对应条目的类名）/ `offset 80`（高亮判定用的顶部偏移像素，通常与固定头部高度一致）/ `throttleMs 60`（滚动监听节流毫秒）。与 `features.toc` 配合，仅负责「当前阅读到哪一节」的高亮 — `js/domains/core/toc.js`。

### 3.90 searchHighlight — 搜索结果高亮

`enabled true` / `markClass ''`（高亮 `<mark>` 附加类名；空=不附加（现行为）；非法字符过滤为 `[A-Za-z0-9_-]`；作用于搜索浮层与 /search/ 页；样式仍由 site.css 的 `mark` 选择器统一提供） / `maxMatches 20`（单页最多高亮处数，防止超长文渲染卡顿）。命中片段在结果列表与正文内以 `<mark>` 标注；`enabled=false` 或 `features.search.highlightMatches=false` 均关闭高亮 — `js/domains/features/search.js` + `templates/search.ejs`。

### 3.91 darkImageFilter — 暗色图片滤镜

`enabled true` / `filter 'brightness(0.85) saturate(0.9)'`（暗色模式下的 CSS `filter` 值，可直接填任意合法滤镜串）/ `applyImages true` / `applyVideos true`（是否分别作用于 `<img>` 与 `<video>`）。缓解纯白图在暗色主题下过曝刺眼 — `templates/layout.ejs`。

### 3.92 listCover — 列表封面

`enabled true` / `showOnHome true`（首页卡片）/ `showOnArchive true`（**标签归档列表页** `/tags/<tag>/` 封面显隐；false=列表卡片不渲染封面；/archive/ 年表页为纯文字列表不受影响）/ `fallback 'pattern'`（无封面文章的回退形态：`pattern` 渐变占位块显示标题文字（默认） / `none` 纯文字卡片不渲染占位块；`enabled=false` 时完全隐藏列表媒体区）/ `lazy true`（懒加载）/ `autoGenerate`（无封面文章构建期自动生成封面，见下）。与 `features.cover`（文章封面样式库）分工：此项控制列表页是否展示封面 — `templates/index.ejs` + `templates/tag.ejs` + `templates/post.ejs` + `scripts/build/pages.js`。**封面宽高比由 `tuning.card.imageAspect` 控制（CSS 变量 `--card-imageAspect`，单一来源）。**

**`autoGenerate` — 无封面文章自动封面**：文章 frontmatter 无 `featuredImage` 时，构建期为其生成列表卡片与文章页头图封面（主题色背景 + 自动换行标题 + 可选站点名/分类角标），输出到 `dist/og/cover-<slug>.<hash8>.<ext>`（hash = 标题 + 站点名 + 主题色 + 样式版本 + 宽高格式 + 样式开关；内容寻址命名，`/og/*` 已有 `_headers` 7 天缓存规则，且被 sitemap 与 cache-bust 忽略），缓存于 `.cache/covers/`（同输入二次构建命中直接复用，不重渲染）。**显式 `featuredImage` 始终优先（行为不变）；`enabled:false` 或单篇生成失败时回退上面的 `fallback` 形态（`pattern`/`none`），失败仅告警不阻断构建**。图片输出 `width`/`height` 属性（构建期定尺寸，防 CLS）。键位：`enabled true`（总开关）/ `width 1200` / `height 630`（64–4096，越界夹取）/ `format 'webp'`（`webp` | `jpeg`，`jpg` 同义；切换扩展名后旧产物下次构建清理）/ `backgroundStyle 'gradient'`（`gradient` 主→辅渐变 | `solid` 主色纯色）/ `showSiteName true`（左下角站点名，en 站取 `site.titleEn`）/ `showCategory false`（左上角分类/系列角标，取 `categories[0]`，缺省 `series`）。主题色取自 `theme.colors.primary/secondary` 与 `darkMode.colors.text`，缺失时跳过生成。

**示例**（features.json5）：
```json5
listCover: {
  enabled: true,
  fallback: 'pattern',
  autoGenerate: {
    enabled: true,
    width: 1200,
    height: 630,
    format: 'webp',
    backgroundStyle: 'gradient',
    showSiteName: true,
    showCategory: false
  }
}
```
— `scripts/lib/auto-cover.js` + `scripts/build/auto-cover.js` + `scripts/build/pages.js`。

### 3.93 imageFallback — 图片兜底

`enabled true` / `fallbackImage ''`（兜底图路径，空 = 不替换，仅隐藏破图）/ `showAlt true`（加载失败时以 `alt` 文本占位）。图片 404 或解码失败时避免页面出现破图与布局跳动 — `js/domains/core/image-lazy.js`。

### 3.94 mobileBottomNav — 移动端底部导航

`enabled true` / `items ['home','archive','search','theme']`（底部按钮项列表，按序展示）/ `onlyMobile true`（true=仅 ≤`tuning.layout.mobileBreakpoint` 断点内显示（现行为）；false=桌面端也显示（`data-only-mobile="false"` + CSS 门控））/ `labelHome ''` / `labelArchive ''` / `labelSearch ''` / `labelTheme ''` / `labelTop ''`（各按钮文案覆盖，空 = 使用 `ui-strings.json5` 的 `bottomNav.*` 词条，主题按钮文案随当前明暗状态动态切换）。层级经 `tuning.zIndex.mobileBottomNav` 调整。与 `features.mobile` 的抽屉菜单互补：底部导航负责高频入口 — `templates/layout.ejs` + `js/domains/core/navigation.js`。**iOS 安全区适配由 `features.mobile.safeAreaBottom` 控制（`env(safe-area-inset-bottom)`，单一来源）。**

### 3.95 incrementalBuild — 增量构建

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `true` | 页面级增量总开关 |
| `fullFlag` | string | `--full` | 强制全量重建的 CLI 参数名（`--full` 始终有效） |
| `watch` | bool | `true` | `--watch` 监听重建时启用增量；false 时仅显式 `--incremental` 生效 |
| `fingerprintHash` | string | `sha1` | 页面指纹哈希算法：`sha1`/`sha256`/`md5`（非法值回退 sha1） |
| `skipUnchanged` | bool | `true` | 指纹一致且产物存在时跳过重新渲染并复用现有产物 |

> **页面级增量渲染（最小可用实现）**：
> - 启用条件：`enabled` 且 `skipUnchanged` 非 false，且非强制全量，且请求来源为 `--watch`（`watch=true`）或显式 `--incremental`；普通 `npm run build` 始终全量（`cleanDist` 行为不变）。
> - 机制：每页指纹 = `relPath + 模板目录摘要 + 页面数据稳定序列化`（对象键排序、跳过函数、CSP nonce 归一化）经 `fingerprintHash`（sha1/sha256/md5）散列，写入 `.build-cache.json → pages`（与媒体/OG 缓存同文件）；指纹一致且产物文件存在时跳过重新渲染并复用现有产物，日志输出 `[incremental] skipped N page(s), rebuilt M page(s)`。
> - 增量模式在内存中暂时关闭 `site.build.cleanDist`（不清空 dist 才能复用；不写回配置文件）；非增量构建保持全量清理。
> - `fullFlag`（默认 `--full`，可自定义参数名；`--full` 始终有效）：强制全量重建。**删除文章/页面后请用 `--full` 清理残留产物**（增量模式不清理已删除源的旧文件）。
> - `fingerprintHash` 非法值回退 sha1。canonical：`scripts/lib/incremental.js`（单测覆盖指纹算法/稳定序列化/决策组合）+ `scripts/build/pages.js`（renderAndWrite）。
> - 完整分文件增量方案（文章解析/聚合页步骤级）仍见 `docs/incremental-build-design.md` 的远期设计，不在当前实现范围。

### 3.96 lcpOptimize — LCP 分相治理

弱网首屏渲染延迟优化，按 T5 实测分相数据收敛（本地 gzip serve + Slow4G + 4× CPU；生产复测需部署后执行）。

| 字段 | 默认 | 说明 |
|---|---|---|
| `revealExemptFirstPaint` | `false` | 首屏媒体豁免入场隐藏态。首页第一张卡片（`.blog-grid>article:first-child` 及其 `.post-card-image`）不再等待 JS 添加 `.in`，文章头图 `.post-featured-image.js-img` 不再等待懒加载模块添加 `.loaded`——CSS 直接覆盖其初始 `opacity:0`。代价：首屏第一张卡片/头图不再播放入场淡入（第二张起不受影响） |
| `asyncCjkFontCss` | `false` | CJK 字体 CSS 异步化：`cjk-fonts.css` 以 `media="print"` 低优先加载，加载完成后由 nonce 内联引导脚本翻回 `media="all"`（不依赖内联事件属性，兼容 CSP）。弱网下将该 23KB(gzip) 从渲染阻塞链移出、CJK 分片在首屏渲染后拉取。构建期字体管线失败剥离引用时脚本自动空转（回退系统字体）。代价：CJK 字形回退→自托管字体的切换时机后移（仍为 `font-display:swap` 语义，无空白期） |
| `skipLatinFontPreloadOnCjk` | `false` | CJK 语言页（`lang != en`）跳过拉丁字体 preload：`theme.externalAssets.fontPreloads`（Inter 48KB）不再输出 `<link rel=preload as=font>`，字体仍由 `@font-face` 首次使用时拉取（`font-display:swap` 回退）。zh 页字形来自 CJK 子集，拉丁字体只承担数字/英文片段，preload 占用首屏带宽大于收益；en 页不受影响。`site.performance.preloadFonts=false` 时本键无实际效果。代价：zh 页少量拉丁字符的系统字体→Inter 切换时机后移 |
| `contentVisibility` | `false` | 下折叠重型块跳过离屏渲染：文章页正文（`.post-content`）的直接子块——代码块 `pre` / `table` / Mermaid SSR `.mermaid` / `picture`——离屏时以 `content-visibility:auto` + `contain-intrinsic-size:auto <估算>` 占位（`auto` 记忆上次渲染尺寸），滚动接近时按真实尺寸渲染。收益：长文页首屏布局/样式计算量下降（A/B 中位 LCP 3576→2420ms、FCP 3044→2232ms）。**实测未达标、默认关闭**：估算总高与真实高度差约 1.5k px，冷锚点直达与首次滚动到未渲染区出现落点偏移与 CLS 恶化（冷锚点 0.38→0.68、滚动扫描 0.07→0.28）；TOC 高亮/返回顶部/软导航进出正常。回退即保持/置 `false`（条件 CSS 不输出），详见 CHANGELOG |

实测前后对照与分相明细见 `docs/perf-baseline-local-lcp.md`；采集口径见 `scripts/perf-audit.js` 顶部注释 — `templates/layout.ejs` + `templates/site-css.ejs` + `scripts/lib/features-schema.js`。

### 3.97 anchorStabilize — 锚点落点稳定

整页加载带 hash 直达（如 `/zh/long-stress/#结语`）时，浏览器可能在该锚点上方内容（字体/图片/动态块）完成布局前就完成锚定，晚到的布局增长把落点推走数百 px（长文页实测最后一段增长约 460px，发生在 `load` 之后）。本开关在 `load` 后校正落点，并用 `ResizeObserver` 跟踪文档高度变化，直到布局静默 `settleMs` 或超过 `maxTrackMs`；**仅当用户尚未产生输入**（`wheel`/`touchstart`/`pointerdown`/`keydown`）且未自行滚动时执行，因此不影响 TOC 点击、返回顶部、软导航（三者均不触发 `load`，各自处理滚动；软导航切换时模块自动退出）。配合「构建期图片定尺寸」（正文/头图/卡片/画廊图片输出 `width`/`height` 属性）使用，后者把冷锚点 CLS 从 0.53 降至 0.001 量级，本开关兜底晚到布局造成的落点漂移。

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关。关闭即不注册任何监听（回退成本为零） |
| `settleMs` | `300` | 布局静默窗口（ms）：文档高度变化后等待该时长无新变化才校正；连续变化（字体分片陆续应用）只会顺延 |
| `maxTrackMs` | `8000` | 最长跟踪时间（ms，自首次校正起算）：超时前做最后一次校正并断开 observer，避免长页面持续懒加载时无限校正；`0` = 不设时限 |

实测（2026-09，本地 gzip serve + Slow4G + 4× CPU，每页 3 次中位）：冷锚点最终落点误差 9.9px（校正瞬间即达理想位 156.1px，其后极晚布局回移约 10px，页面总高 13983px、不可感知；基线中位偏差 1431px、偶发 1903px）；冷锚点 CLS(sum) 0.5367 → 0.0011；滚动扫描 CLS 增量 0.0240 → 0.0002；TOC 高亮/返回顶部/软导航进出不受影响 — `js/domains/core/anchor-stabilize.js` + `js/core/main.js` + `scripts/lib/features-schema.js`。

---

## 4. navigation.json5 — 导航

| 字段 | 默认 | 说明 |
|---|---|---|
| `menu[]` | `[]` | 菜单项 `{label,labelEn?,url,icon?,target?}`（站内路径自动加语言前缀） |
| `navbar.fixed` | `true` | 吸顶（与 theme.layout.headerStyle 任一 true 即吸顶） |
| `navbar.showLogo` | `true` | 显示 Logo |
| `navbar.logoText` | `S-ynapse` | Logo 文字（空回退 site.title） |
| `navbar.logoTextEn` | `''` | 英文站 Logo 文字（空回退 logoText → site.title） |
| `navbar.logoImage` / `logoWidth` | `''`/`40px` | 图片 Logo（优先于文字）与显示宽度 |
| `navbar.shadow` / `breakpoint` | `true`/`768px` | 底部阴影 / 汉堡菜单断点 |
| `socialInNav.enabled` / `order[]` | `false`/`[]` | 导航社交图标（数据源 site.social.items） |
| `search.enabled` | `false` | 搜索开关(需要 features.search.enabled) |
| `search.provider` | `local` | 搜索后端:`local`(默认,构建 `search-index.json` 本地检索)/`pagefind`(构建期生成 Pagefind 静态索引,需 `npm install -D pagefind`;压缩与哈希之后生成,不参与 cache-bust;serve/watch 同样生成;浮层与独立搜索页均接入;索引生成失败时前端回退本地输入框) |
| `search.placeholder` | `搜索...` | 占位文本（中文） |
| `search.placeholderEn` | `Search...` | 占位文本（英文;en 站优先，空回退 `placeholder` → ui-strings） |
| `navbarOptions.height/glassBlur/glassAlpha` | `60px`/`12px`/`0.8` | 外观选项（优先于 navbar/theme.glass） |
| `navbarOptions.navGap/navFontSize/iconSize/logoSize/shadowShow` | — | 菜单间距/字号/图标尺寸/Logo 字号/滚动阴影 |

---

## 5. sidebar.json5 — 侧栏

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 侧栏总开关（关闭后内容区自动加宽居中） |
| `options.width/gap/radius/padding/titleSize/titleWeight` | `318px`/`1.618rem`/`0.618rem`/`1rem`/`.9375rem`/`600` | 外观选项（width 优先于根级旧键） |
| `options.hoverLift` / `borderShow` | `true`/`false` | 组件悬停上浮 / 描边显示 |
| `widgets[]` | `[]` | 组件列表（数组顺序即显示顺序;位置由 theme.layout.sidebarPosition 控制;每个部件可选 `icon` 字段,内置: clock/folder/tags/archive/collection/chart/quote/image/link/info/book/search/rss/download/home） |

组件类型(`type` 字段):
- `author` `{title,titleEn,avatar,bio,bioEn}`
- `recent` `{title,count,showDate}`
- `tags` `{title,limit,showCount,sortBy,minCount}`
- `categories` `{title,showCount}`
- `archive` `{title,showCount}`
- `search` `{title,placeholder,placeholderEn}`
- `toc` `{title}`(仅文章页)
- `stats` `{title}`(需 features.stats.enabled)
- `series` `{title}`(需 features.series.enabled)
- `friends` `{title}`(需 friends.json5；项目名 en 站取 `nameEn`)
- `newsletter` `{title,provider,mailchimpAction,buttonText,buttonTextEn,placeholder,placeholderEn}`(mailchimp 表单)
- `custom` `{title,html,htmlEn}`(原始 HTML)

---

## 6. footer.json5 — 页脚

| 字段 | 默认 | 说明 |
|---|---|---|
| `copyright` | `© 2026 …` | 版权文本（原样输出,不自动更新年份） |
| `columns` | `3` | 链接区列数（1–4） |
| `columnItems.enabled` / `items[]` | `true`/`[]` | 多列 `{enabled,title,titleEn,links[{enabled,label,labelEn,url}],html,htmlEn}`（htmlEn 为英文版自定义 HTML，空则回退 html） |
| `bottomLinks.enabled` / `items[]` | `true`/`[]` | 底栏链接（同上链接项结构） |
| `social.enabled` | `false` | 页脚社交图标行（尺寸/间距见 options.socialIconSize/socialGap） |
| `poweredBy.enabled` / `text` | `false`/`S-ynapse` | Powered by（repoUrl 有效时自动链接） |
| `beian.enabled` / `icp` / `gongan` | `false`/… | 备案号（gongan 空则不显示）。备案号为法定中文标识，**不提供 En 变体**（中英文站均原样展示） |
| `customHtml` | `''` | 原始 HTML（插入页脚顶部） |
| `options.paddingV/gap/linkSize/copyrightSize/icpSize/socialIconSize/socialGap/linkHoverUnderline` | — | 外观选项 |

---

## 7. security.json5 — 安全

| 字段 | 默认 | 说明 |
|---|---|---|
| `forceHttps` | bool | `true` | Worker 将 HTTP 请求 301 跳转到 HTTPS（静态托管由平台自带 HTTPS 处理；本地 serve 不适用） |
| `headers` | object | 见下 | 响应头默认值表（键名即头名，值即头值；与 `hardening` 覆盖段合并） |
| `headers.X-Frame-Options` | string | `DENY` | 禁止页面被 iframe 嵌入（与 CSP `frame-ancestors 'none'` 双保险） |
| `headers.X-Content-Type-Options` | string | `nosniff` | 禁止 MIME 嗅探 |
| `headers.Referrer-Policy` | string | `strict-origin-when-cross-origin` | 跨站来源策略 |
| `headers.Permissions-Policy` | string | `geolocation=(), microphone=(), camera=()` | 禁用敏感浏览器特性 |
| `headers.Strict-Transport-Security` | string | `max-age=31536000; includeSubDomains; preload` | HSTS（参数可由 `hardening.hsts*` 覆盖） |
| `headers.X-XSS-Protection` | string | `0` | 显式关闭已废弃的旧 XSS 过滤器 |
| `headers.Cross-Origin-Resource-Policy` | string | `same-origin` | 跨源资源策略 |
| `headers.Cross-Origin-Embedder-Policy` | string | `unsafe-none` | 跨源嵌入策略 |
| `headers.Cross-Origin-Opener-Policy` | string | `same-origin` | 跨源窗口隔离 |
| `csp.enabled` / `directives` / `reportOnly` / `reportUri` | `false`/`{}`/`false`/`/csp-report` | Content-Security-Policy。构建期为 `script-src` 与 `style-src` 注入同一枚 `'nonce-...'`（内联 `<script>`/`<style>` 同步注入 nonce 属性），二者移除 `'unsafe-inline'`；模板与产物已无内联 `style="..."` 属性，故不再声明 `style-src-attr`（属性语境按 CSP3 回退到 `style-src`，同样拒绝内联）；`frame-ancestors 'none'` 与 `X-Frame-Options: DENY` 双保险 |
| `csp.autoTrim` / `csp.metaEnabled` | `true`/`false` | 构建期按功能裁剪未用域名（giscus / jsdelivr / Google Fonts / Cloudflare 统计——统计域名仅在 site.webAnalytics 配置 token 时保留；在 Cloudflare 面板另开统计而未配 token 时请设 `false`）；`metaEnabled` 开启时额外输出 `<head>` meta CSP（与响应头使用同一裁剪结果，仅无响应头环境需要，默认关） |
| `robots.enabled` / `rules[]` | `false`/`[]` | robots 规则 |
| `rateLimiting.enabled` | `false` | Worker 限流(100 req/60s) |
| `rateLimiting.maxRequests/windowMs/blockDuration` | `100`/`60000`/`300000` | 参数（封禁时长毫秒） |
| `rateLimiting.whitelist[]`/`blacklist[]` | `[]` | IP 或 **CIDR**（IPv4/IPv6，如 `10.0.0.0/8`、`2001:db8::/32`；黑名单始终拦截，白名单跳过限流） |
| `rateLimiting.skipPaths[]` | `/assets/ /media/ /og/ /icons/ /pagefind/` | 不计限流的静态资源前缀（空数组 = 内置默认）；避免单页上百子资源误触 429 |
| `pathRestrictions[]` | `[{path}]` | 元素 `{path, requireAuth?, allowedIPs?}`：路径支持 `/*` 后缀、匹配时解码百分号编码并忽略大小写；`allowedIPs` 为 CIDR 时命中者放行；`requireAuth` 无鉴权提供方时保持拦截（fail-closed） |
| `hardening.hstsMaxAge/hstsIncludeSubDomains/hstsPreload` | `31536000`/`true`/`true` | 覆盖 HSTS（优先级高于 headers 段）；preload 默认保留 headers 段声明 |
| `hardening.referrerPolicy/permissionsPolicy/xssProtection` | — | 覆盖 headers 段同名头（`xssProtection` 默认 `"0"`：该头已被现代浏览器废弃，显式关闭） |
| `hardening.corsAllowedOrigins` | `[]` | 非空时输出 Access-Control-Allow-Origin（多来源逗号拼接） |
| `customHeaders` | `{}` | 追加响应头（同步进 Worker） |

> 注意:`workers/security-config.js` 由构建从本文件自动生成,不要手改(生成器:scripts/generate-security-config.js)。Worker 与静态层 `_headers` 共用同一 hardening 合并逻辑（`applyHeaderHardening`），两层头部完全一致；Worker 侧 `_headers` 的路径限制与限流逻辑见 `workers/security-worker.js` 与 `workers/lib/*.mjs`（CIDR/限流均有单元测试）。`/csp-report` 端点受限流保护、载荷上限 16KB、日志只记录关键字段。CSP 默认仅通过响应头下发（`_headers` 或 Worker）；仅在托管环境无法设置响应头时才开启 `csp.metaEnabled` 兜底（meta 无法表达 report-only）。

---

## 8. content-policy.json5 — 内容策略

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 策略开关 |
| `mediaExts` | 13 种(见代码) | media/ 白名单 |
| `videoMode` | `deny-list` | videos/ 采用排除制 |
| `assetExts` | 42 种(文本/文档/pdf/压缩包/音频/字体) | assets/ 白名单 |
| `blockedExts` | 75 种(可执行+脚本源码) | 可执行黑名单(**优先于白名单**) |
| `documentRenderedTypes` | `html,htm,xhtml,xml,xsl,xslt,dtd,svg,shtml` | 渲染型文档 |
| `blockedFilenames` | `.ds_store,thumbs.db,desktop.ini,.gitkeep` | 文件名黑名单 |
| `svgSanitize` | `true` | SVG 消毒 |

判定优先级:文件名 > 可执行 > 渲染文档 > 白名单。被拦截文件不进入 dist(托管自然 404),并在构建报告与 console 中逐条列出。

---

## 9. tag-aliases.json5 / friends.json5 — 可选数据文件

**tag-aliases.json5**: 标签归一化。
```json
{ "enabled": true, "aliases": { "js": "JavaScript", "ts": "TypeScript" } }
```
影响:标签页聚合、卡片标签显示。 匹配规则:先精确匹配键名,再按键名小写回退（键建议统一小写,值即最终展示名）。

**friends.json5**: 友链。
```json
{ "enabled": false, "title": "友情链接", "labels": { "zh": "友情链接", "en": "Friends" }, "description": "", "descriptionEn": "", "applyNote": "", "applyNoteEn": "", "friends": [ { "name": "示例", "nameEn": "", "url": "https://example.com", "desc": "一句话简介", "descEn": "", "logo": "" } ] }
```
影响:自动注入导航「友链」、/links/ 页、侧栏 friends widget。 友链项字段为 `{name,nameEn,url,desc,descEn,logo}`（desc 不是 description）;labels 为多语言标题覆盖（`labels.en` 优先于 `title`，故不再单设 `titleEn`）;`descriptionEn`/`applyNoteEn`/`nameEn`/`descEn` 为 en 站文案，**空 = 回退对应中文值**。

---

## 10. tuning.json5 — UI 微调参数层

独立 UI 参数文件(37 分类 / 273 项,逐项中文注释)。构建时全量注入为 `:root` CSS 变量,命名规则 `--{分类}-{参数}`(如 `--hero-maxWidth`、`--toc-indentL3`)。

**优先级语义**:CSS 类参数已绑定到样式规则并优先于 theme/features 的同名默认值(微调层——改 tuning 值即生效);行为类参数(motion/search/toc/tts/dailyQuote/readingPanel/header 滚动)经 `window.__TUNING__` 注入、运行时优先读取(回退 features);与 features/site 重叠的键已全部清理(单一入口归各自模块配置);原「待实现」键已全部接线(导语字号/评论区标记头像与圆角/分隔线/分页窗口省略/标签云字号梯度/系列进度条/打赏弹窗圆角),全部参数均有真实消费点。

**分类(37)**:typography / layout / radius / motion / hero / card / toc / search / reading / comments / header / pagination / stats / breadcrumb / share / prevNext / contactPopup / reward / dailyQuote / tags / series / backToTop / texture / glow / code / icons / morphicons / magazine / commandPalette / announcement / guard / loading / mobileToc / ui / lightbox / toast / zIndex。

**完整键名索引（按分类；键后为其默认值，含义与取值见 `tuning.json5` 逐项注释）**：
- **typography（18 项）**：bodySize 1.0625rem / h1Size 2.058em / h2Size 1.618em / h3Size 1.272em / h4Size 1em / h5Size .875em / h6Size .8125em / smallSize .875em / tinySize .75em / lineHeight 1.8 / headingLineHeight 1.3 / letterSpacing 0.02em / headingWeight 700 / monoSize .875em / quoteSize 1.05em / captionSize .8125rem / metaSize .875rem / leadSize 1.272em
- **layout（14 项）**：articlePadding 2rem / containerWidth 1250px / tocWidth 200px / gap 1.618rem / padding 2.618rem / contentOffset -10px / headerContentGap 48px / tocMinLeft 10px / sidebarMinRight 10px / mobileBreakpoint 768px / tocHideBreakpoint 900px / tabletBreakpoint 1024px / maxContentWidth 1600px / gridCollapseBreakpoint 640px
- **radius（7 项）**：default 0.618rem / large 1.618rem / button 0.382rem / image 0.618rem / avatar 50% / badge 1rem / input 0.382rem
- **motion（11 项）**：hoverLiftPx 4 / hoverScale 1.02 / underlineThickness 2px / underlineOffset 3px / rippleDurationMs 500 / revealDurationMs 250 / revealOffset 10px / staggerDelayMs 60 / buttonPressScale 0.97 / transitionDuration 0.3s / transitionTiming cubic-bezier(0.22, 1, 0.36, 1)
- **hero（9 项）**：titleSize 2.618em / subSize 1.05em / maxWidth 760px / actionsGap .75rem / tagGap .5rem / ctaRadius 0.382rem / paddingTop 1rem / paddingBottom 2rem / dateSize .9375rem
- **card（12 项）**：imageAspect 16/10 / radius 0.618rem / padding 1.5rem / titleSize 1.272rem / excerptLines 3 / metaSize .8125rem / nocoverMinSize 1.272rem / nocoverMaxSize 1.618rem / gridGap 1.618rem / imageHoverScale 1.02 / bentoFeatured true / bentoAspect 21/10
- **toc（9 项）**：fontSize .8125rem / labelSize .6875rem / indentL2 .5rem / indentL3 1.2rem / indentL4 1.9rem / progressHeight 3px / stickyTop 80px / scrollOffset 80 / collapsedByDefault false
- **search（19 项）**：overlayPadding 12vh 1rem 2rem / modalPadding 2.5rem 2.5rem 2rem / modalMaxHeight 78vh / closeBtnSize 36px / modalWidth 760px / inputHeight 56px / inputFontSize 1.375rem / historyCount 5 / hotCount 5 / debounceMs 120 / minQueryLength 1 / excerptLength 120 / resultLimit 30 / emptyText 未找到匹配内容 / emptyTextEn No matching content / indexTimeoutMs 5000 / indexRetry 1 / errorText '' / errorTextEn ''
- **reading（21 项）**：progressHeight 3px / dockBottom 5.6rem / dockRight 1.35rem / dockBtnSize 40px / dockRightTablet 1rem / dockBottomTablet 6.4rem / gearBottom 14.6rem / gearMobileBottom 10.8rem / panelBottom 13.2rem / panelWidth 280px / dockMobileBottom 14.2rem / ttsRate 1 / ttsPitch 1 / fontSizeStep 1 / lineHeightStep 0.1 / readingMaxWidth 72ch / quoteTint 6% / imageHoverScale 1.01 / h2AccentWidth .25rem / h2AccentHeight 1em / h2AccentColor var(--color-s)
- **comments（5 项）**：avatarSize 40px / marginTop 2rem / width 100% / borderRadius 0.618rem / dividerShow true
- **header（7 项）**：height 60px / logoSize 1.272em / iconSize 18px / scrolledHeight 56px / scrollShrink true / scrollThresholdPx 8 / hairlineStrength 30%
- **pagination（6 项）**：btnMinWidth 40px / btnHeight 40px / maxVisible 5 / gap .5rem / activeScale 1.05 / radius 0.618rem
- **stats（5 项）**：numberSize 1.5rem / labelSize .8125rem / cardPadding 1rem 1.25rem / gap 1rem / hoverLiftPx 2px
- **breadcrumb（4 项）**：fontSize .8125rem / gap .4rem / marginBottom 1rem / currentWeight 600
- **share（4 项）**：btnSize 32px / gap .35rem / iconSize 16px / radius .375rem
- **prevNext（5 项）**：thumbSize 64px / thumbHeight 44px / gap 1rem / marginTop 2rem / titleLines 1
- **contactPopup（4 项）**：iconSize 30px / radius 1.618rem / valueFontSize 1.25rem / titleSize 1.25rem
- **reward（3 项）**：btnFontSize .8125rem / popupRadius 0.618rem / entryGap .75rem
- **dailyQuote（5 项）**：showAuthor true / quoteFontSize .95rem / authorFontSize .8rem / markSize 2rem / refreshDaily true
- **tags（5 项）**：cloudMinSize .75rem / cloudMaxSize 1.25rem / cloudGap .5rem / showCount true / hoverScale 1.05
- **series（4 项）**：panelRadius 0.618rem / progressHeight 4px / badgeColor var(--color-s) / panelPadding 1rem 1.25rem
- **backToTop（3 项）**：hiddenOffset 20px / offsetBottom 2rem / offsetSide 2rem
- **texture（3 项）**：noiseBaseFrequency 0.8 / noiseOpacity 0.025 / noiseOpacityDark 0.035
- **glow（2 项）**：heroStrength 8% / heroStrengthDark 12%
- **code（12 项）**：windowDotSize 11px / borderWidth 1px / borderMix 65% / lineNumberColor var(--color-tl) / lineNumberOpacity .5 / hoverBorderMix 35% / hoverShadowMix 25% / hoverBgMix 92% / inlineRadius 4px / inlineHairlineMix 70% / diffAddMix 12% / diffDelMix 12%
- **icons（2 项）**：strokeWidth 1.75 / hoverLift 1px
- **morphicons（4 项）**：stiffness 420 / damping 30 / reducedStiffness 900 / reducedDamping 55
- **magazine（6 项）**：dropCapSize 3.4em / dropCapColor var(--color-s) / dropCapWeight 600 / bleedWidth 4rem / tableHoverMix 6% / headingNumberColor color-mix(in srgb, var(--color-ts) 55%, transparent)
- **commandPalette（4 项）**：width 560px / listMaxHeight 420px / topOffset 16vh / backdropMix 55%
- **announcement（3 项）**：fontSize 0.8125rem / letterSpacing 0.015em / height 34px
- **guard（6 项）**：menuWidth 232px / menuRadius 0.618rem / menuBlur 10px / itemRadius 0.382rem / itemGap 2px / menuMaxHeight 70vh
- **loading（8 项）**：dotSize 0.55rem / dotGap 0.45rem / dotLift 6px / textSize 0.8125rem / overlayAlpha 92% / blurPx 6px / ringSize 2rem / titleSize 1rem
- **mobileToc（5 项）**：btnBottom 6rem / btnRight 2rem / btnMobileBottom 7.4rem / btnMaxWidth 340px / labelMaxWidth 9.5rem
- **ui（3 项）**：errorSvgMaxWidth 460px / errorSuggestMaxWidth 560px / errorCodeFontSize 7rem
- **lightbox（2 项）**：btnSize 44px / btnOffset 14px
- **toast（3 项）**：maxWidth 420px / radius 999px / offsetBottom 2rem
- **zIndex（30 项）**：header 1000 / mobileNav 999 / announcement 999 / mobileBottomNav 1200 / readingDock 990 / readingGear 998 / readerPanel 1500 / mobileToc 999 / mobileTocDrawer 1500 / kbdHelp 1500 / searchOverlay 2000 / navBoostPanel 1200 / presetPop 1600 / toast 1200 / scrollIndicator 1100 / readingTip 10000 / lightbox 2000 / reward 1900 / linkWarning 3000 / contactPopup 4000 / pwaInstall 1050 / softnavBusy 2000 / grain 2000 / guardMenu 1900 / guardFlash 1890 / guardCurtain 1880 / guardLock 1895 / guardGate 1898 / guardWmOverLightbox 1700 / popupNotice 2100

**已绑定示例(150 项 CSS + 19 项行为)**:`--hero-maxWidth`、`--zIndex-*`(全站浮层层级,30 项:header/mobileNav/announcement/mobileBottomNav/readingDock/readingGear/readerPanel/mobileToc/mobileTocDrawer/kbdHelp/searchOverlay/navBoostPanel/presetPop/toast/scrollIndicator/readingTip/lightbox/reward/linkWarning/contactPopup/pwaInstall/softnavBusy/grain/guardMenu/guardFlash/guardCurtain/guardLock/guardGate/guardWmOverLightbox/popupNotice；模板以 `var(--zIndex-键, 原值)` 消费)、`--layout-tabletBreakpoint`/`mobileBreakpoint`/`tocHideBreakpoint`/`gridCollapseBreakpoint`(媒体查询断点,经 EJS 直读)、`--radius-default/large/button/avatar`、`--typography-lineHeight/letterSpacing/headingWeight`、`--toast-offsetBottom/borderWidth/radius/maxWidth`、`--breadcrumb-fontSize/gap/marginBottom`、`--card-padding/metaSize/radius`、`--toc-stickyTop`/`--sidebar-stickyTop`(粘性定位)、`--header-iconSize`、`--share-gap`、`--header-scrolledHeight/hairlineStrength`、`--code-borderWidth/borderMix/windowDotSize`、`--texture-noiseOpacity`、`--glow-heroStrength`、`--card-imageHoverScale/excerptLines/gridGap`、`--motion-transitionTiming/buttonPressScale`、`--reading-quoteTint/imageHoverScale/h2AccentWidth/Height/dockRight/dockBtnSize/dockRightTablet/dockBottomTablet/gearBottom/gearMobileBottom/panelBottom/panelWidth/dockMobileBottom`、`--search-overlayPadding/modalPadding/modalMaxHeight/closeBtnSize`、`--mobileToc-btnBottom/btnRight/btnMobileBottom/btnMaxWidth/labelMaxWidth`、`--ui-errorSvgMaxWidth/errorSuggestMaxWidth/errorCodeFontSize`、`--lightbox-btnSize/btnOffset`、`--pagination-btnMinWidth/btnHeight`、`--backToTop-hiddenOffset`、`--commandPalette-listMaxHeight`、`--layout-articlePadding`;行为侧:search 历史/热词/去抖/结果上限/空文案(`search.emptyTextEn` 为 en 站空结果文案,空回退 `emptyText`)、toc 滚动偏移与默认折叠、tts 语速/音调、dailyQuote 作者显示/每日刷新、readingPanel 字号/行距步进、morphicons 弹簧刚度/阻尼/轻量版弹簧。

**注意**:绑定值均已对齐现有视觉(如 toast.radius=999px 对应胶囊形),修改前建议先在浏览器 DevTools 中试值。

---

## 11. guard.json5 — 防护与交互控制域

第 13 个配置文件（11 个模块 / 176 项，统计口径：对象逐层展开、数组元素逐项计入；逐字段中文注释：作用/类型/可填值/不可填值原因/推荐值/注意）。仅在 `features.guards.enabled !== false` 时注入 `window.__GUARD__`，客户端按 preset 懒加载对应模块（`js/domains/guard/`），未启用模块零加载零开销。

**结构**：
- `core`（13 项）：`preset 'soft'` / `bypass.enabled true` / `bypass.urlParam true` / `bypass.localStorage true` / `bypass.localhost false` / `bypass.cleanUrl true` / `bypass.queryParam 'guard'` / `bypass.storageFlag 's-guards-off'` / `bypass.accessGateKey true` / `logLevel 'off'` / `respectEditable true` / `i18nFallbackLang 'zh'` / `edgePadding '8px'`。绕过优先级：`?guard=on` 覆盖一切（含其余绕过通道）> `?guard=off` > localStorage 标志 > localhost（开启时）；`bypass.enabled=false` 时四条通道（含 accessGate `?key=`）全部失效，判定原因经 `window.__GUARD_BYPASS__` 可观测（`url-off`/`url-on`/`storage`/`localhost`/`disabled`/`none`）。`?guard=` 与 `?key=` 在绕过判定/解锁读取完成后由 `history.replaceState` 从地址栏移除（保留其它查询串与 hash；`bypass.cleanUrl=false` 时保留），参数名跟随 `bypass.queryParam`。

`core.bypass` 字段表（默认值 = 历史行为；配置缺失时回退内置默认）：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `bypass.enabled` | bool | `true` | 绕过通道总开关；false = URL/localStorage/localhost 与 accessGate `?key` 全部失效（guard 本身仍按 preset 生效） |
| `bypass.urlParam` | bool | `true` | 是否允许 `?guard=off/on`（on 覆盖一切；off 覆盖其余绕过通道）；false 时参数被忽略 |
| `bypass.localStorage` | bool | `true` | 是否允许 `s-guards-off=1` 持久关闭；false 时 `storageFlag` 被忽略 |
| `bypass.localhost` | bool | `false` | localhost/127.0.0.1/::1 自动关闭全部防护 |
| `bypass.cleanUrl` | bool | `true` | 判定后是否 `history.replaceState` 清洗 `?guard` 与 accessGate `?key`（保留其它查询串与 hash）；false 保留参数、判定结果不变 |
| `bypass.queryParam` | string | `'guard'` | URL 参数名；空字符串回退默认（禁用该通道请用 `urlParam:false`） |
| `bypass.storageFlag` | string | `'s-guards-off'` | localStorage 键名；空字符串 = 关闭该通道 |
| `bypass.accessGateKey` | bool | `true` | 是否允许 accessGate 的 `?key=` 解锁码绕过访问门槛（是否可用仍由 `accessGate.unlockCodes` 决定） |
- `contextMenu`（35 项）：`enabled` / `revokeDelayMs 3000`(下载后释放 Blob URL 延迟 ms) / `translateUrl`(划词翻译模板，`{lang}`/`{text}`；空=隐藏翻译项) / `disableNative` / `trigger.longPress`+`longPressMs 550` / `searchFocusDelayMs 60`(「搜索所选文字」打开搜索后聚焦输入框延迟 ms) / `behavior.closeOnEsc|closeOnScroll|closeOnOutside|closeOnBlur` / `style.width|radius|blur|animMs|shadowOpacity`（width/radius 留空=走 `tuning.json5` → `guard` 分类）/ `showOn.selection|link|image|code|blank` / `builtin.*`（copy/copyLink/openNewTab/searchSelected/translate/backToTop/toggleTheme/print/copyCode/copyRaw/download；`viewSource`/`inspect` 默认关）/ `items[]` 自定义项（`label`/`labelEn`/`icon`/`url`|`action`/`selector`；自定义动作派发 `guard:menu-action` 事件）/ `excludeSelectors[]` / `ariaLabel`。
- `copyGuard`（18 项）：`mode 'attribution'`（`off` | `attribution` 追加出处 | `weakBlock` 首次拦截并提示、再次放行 | `block` 硬拦截）/ `attribution.text`+`textEn`（占位符 `{title}{url}{author}{site}`）/ `position after|before` / `separator` / `minChars 40`（短复制不打扰）/ `onlyArticles true` / `allow.codeBlocks true`+`allow.selectors[]`（代码块与可编辑区始终放行）/ `block.toast|toastText|flash`（复用统一 `__toast`）/ `extra.alsoCut|imageNotice|iOSOverride` / `noticeOncePerSession true` / `logCopyEvents false`（仅本地 console，无网络上报）/ `flashRemoveMs 600`(闪烁遮罩移除延迟 ms)。
- `selectionGuard`（7 项，**默认关**）：`mode 'content'`（`allow` | `content` 正文禁选 | `strict` 全域）/ `allowSelectors[]`+`allowCode true`（代码白名单）/ `allowCtrlA|allowShiftArrows true`（保留键盘选择，无障碍优先）/ `noticeToast|noticeText`。实现：CSS `user-select:none`（正文/全域）+ `selectstart` 事件双保险，输入框与代码始终豁免。
- `hotkeyGuard`（12 项，**默认关**）：`keys.f12|ctrlShiftI|ctrlShiftJ|ctrlShiftC` 默认拦截；`ctrlU|ctrlS|ctrlP` 默认放行（分别与查看源码/保存网页/打印冲突，可按需开启）（macOS 自动等效 Cmd）/ `keys.printScreen false`（仅检测提示）/ `keys.custom[]`（`'ctrl+alt+x'` 语法）/ `noticeToast|noticeText|noticeOncePerSession`。仅拦键盘路径（浏览器菜单/独立窗口不可拦，威慑级），输入框豁免。
- `watermark`（18 项，**默认关**）：`type 'diagonal'`（`fixed`|`tiled`|`diagonal`）/ `text|textEn`（`{site}{date}{time}{id}`）/ `identity 'none'`（`none`|`random`|`storage` 本地短哈希，无指纹）/ `idLength 6`（标识显示长度 4–16）/ `opacity 0.06` / `fontSize` / `color`（空=主题次级色）/ `rotate -22` / `gapX|gapY` / `position`（fixed 专用）/ `zIndex 40` / `hideOnPrint true` / `showInLightbox false` / `mobileEnabled false` / `animate false`（缓慢漂移，尊重减少动效）。`pointer-events:none` + `aria-hidden`，不挡交互。
- `devtoolsDetect`（15 项，**默认关**）：`methods.sizeDiff|timingDebugger`（停靠尺寸差 / `debugger` 计时）/ `intervalMs 1500`（下限 1000）/ `thresholdSizePx 160` / `thresholdTimingMs 120` / `action 'notice'`（`none`|`notice`|`blurPage`|`lockOverlay`|`reload`，锁屏自带关闭键；`reload` 带会话熔断——每会话最多触发一次，避免尺寸误报导致无限刷新）/ `lockTitle|lockText`（空 = 走 `ui-strings.json5` 的 `guard.lockTitle`/`guard.lockText`，按页面语言中英自动切换；填固定文本会覆盖 i18n）/ `reloadDelayMs` / `pauseWhenHidden` / `logDetect`；命中时派发 `guard:devtools` 事件（供 consoleGuard 联动清屏）。检测非 100%（窗口缩放等会误报），仅威慑。
- `consoleGuard`（18 项，**默认关**）：`bannerEnabled|bannerText|bannerTextEn|bannerAscii`（控制台站方留言）/ `clearEnabled|clearIntervalMs|clearOnDetect`（周期清屏与检测联动）/ `muteEnabled|muteMethods[]|muteFreeze`（对页面脚本伪装 console 方法）/ `trapEnabled|trapAction|trapText`（console.log 访问陷阱）/ `hideSelfLogs` / `noticeOncePerSession`。无法拦截真实控制台求值，仅作用于页面上下文。
- `privacyCurtain`（10 项，**默认关**）：`blurOnBlur`（窗口失焦）/ `blurOnVisibility`（切标签）/ `blurAmount '8px'` / `curtainText|curtainTextEn`（帘上文案）/ `revealDelayMs 200`（恢复去抖）/ `prtScNotice|prtScText|prtScOncePerSession`（PrintScreen 仅检测提示）。`backdrop-filter` 静态遮罩 + `pointer-events:none`，不挡交互。
- `tamperWatch`（19 项，**默认关**）：`scripts.monitor|action`（动态 `<script>` 注入；action `toast`|`remove`|`report`）+ `scripts.allowPathPrefixes[]`（同源路径前缀白名单，默认 `['/pagefind/']` 豁免 Pagefind 索引脚本，置 `[]` 关闭）/ `attrs.monitor`（动态内联事件）/ `iframes.monitor|action` / `prototype.watch`（fetch/XHR/eval 原型替换，周期比较）/ `dom.monitor|targets[]`（关键节点缺失检测）/ `probeIntervalMs 2000` / `reportEndpoint ''`（默认不上报；自定义跨域端点需加入 CSP `connect-src`，否则会被静默拦截）+ `reportTimeoutMs 5000`（上报超时 ms，1000–30000） + `reportThrottleMs 10000`（上报节流窗口 ms，0 关闭，上限 60000）+ `reportPrivacyMode true`（仅事件类型，URL 去除查询串）/ `cspViolationToast` / `noticeOncePerSession` / `logDetect`。页面级监视可被先行关闭，属异常发现而非安全边界。
- `accessGate`（12 项，**默认关**）：`password.enabled|hash|salt|rememberHours|title|placeholder|errorText`（SHA-256(salt+密码) 十六进制，`crypto.subtle` 校验）/ `focusDelayMs 50`(解锁后聚焦密码框延迟 ms)/ `paths[]`（路径前缀，空=全站）/ `viewsPerDay|viewsAction`（本地限次，`toast`|`lock`）/ `unlockCodes[]`（`?key=` 永久解锁本机；解锁逻辑读取完成后 `history.replaceState` 清除地址栏参数，保留其它查询串与 hash）/ `logDetect`。诚实声明：静态站密码为软防护（哈希在前端源码中可离线分析），敏感内容请用 Cloudflare Access 等后端方案。

**测试**：`.tmp-scripts/verify-guard-p1.js` 17 项 + `verify-guard-p2.js` 20 项 + `verify-guard-p3.js` 11 项 + `verify-guard-p4.js` 13 项断言（P1：原生菜单拦截、菜单项与上下文匹配、Esc/输入框豁免、复制署名改写、代码块放行、`?guard=off` 完全绕过、block 拦截+toast；P2：选择拦截/代码放行/可编辑豁免、F12 与 Ctrl+Shift+I 拦截+提示、Ctrl+A 保留、水印三模式与默认关反例；P3：检测提示/锁屏与关闭键、控制台静音（页面脚本无输出）、隐私帘显示/恢复与默认关反例；P4：门槛显示/错误提示/正确解锁与会话记忆/解锁码/限次锁定、脚本注入与关键节点缺失提示、默认关反例）；界面截图已目检（明暗菜单、拦截提示、对角/固定角水印、锁屏、隐私帘、访问门槛） — `js/domains/guard/{core,context-menu,copy-guard,selection-guard,hotkey-guard,watermark,devtools-detect,console-guard,privacy-curtain,tamper-watch,access-gate}.js`。

**绕过通道配置化测试**：`scripts/guard-bypass.test.js` 25 例（默认/非法值回退、三通道判定矩阵、通道优先级、URL 清洗、`guard.json5` ↔ `scripts/lib/guard-defaults.js` ↔ `bypass.js` 内置默认三处一致性）；浏览器 runner `.tmp-scripts/run-guard-bypass.js`（端口 3332，父死/空闲看门狗 + 端口释放校验）10 场景 35 断言：`?guard=off`（关闭 + 地址栏清洗并保留其它查询串与 hash）、`?guard=on`（强制开启并覆盖 localStorage）、localStorage 通道、未知值回退，以及 `urlParam=false`/`localStorage=false`/`localhost=true`/`cleanUrl=false`/`enabled=false` 五个配置变体（真实右键菜单探针 + `window.__GUARD_BYPASS__` 判定原因 + 0 控制台错误） — `js/domains/guard/bypass.js`。

---

## 12. compression.json5 — 构建产物压缩

第 14 个配置文件。对 `dist/` 产物做可配置压缩：HTML/CSS/JS/JSON 单行化与去注释、CSS 同页 `<style>` 合并去重（C3 已实装）、可选 JS 混淆（C4 已实装，默认关）；增强阶段完成后执行无头对比门禁，失败自动回退未压缩产物（已实装）。加载与校验由 `scripts/lib/compression-config.js` 承担，压缩执行位于 `scripts/build/minify.js` 的压缩阶段，无头对比/回退核心位于 `scripts/lib/compression-verify.js`，`dist/report.txt` 摘要渲染位于 `scripts/lib/build-report-text.js`（`scripts/compression-config.test.js` 覆盖默认合并/类型/枚举/glob 语义，`scripts/compression-pipeline.test.js` 覆盖增强步骤装配，`scripts/css-merge.test.js` 与 `scripts/js-obfuscate.test.js` 覆盖 C3/C4 纯函数，`scripts/compression-verify.test.js` 覆盖快照/恢复/归一化/端口纯逻辑，`scripts/build-report-text.test.js` 覆盖摘要段渲染与缺失容错）。

**生效范围（重要）**
- 仅作用于 `dist/` 产物；`exclude` 命中的路径按原字节复制。
- `--serve` / `--watch` 自动关闭：本地调试所见即未压缩产物，无需改配置。
- 压缩发生在内容哈希（cacheBust）之前：文件名哈希对应压缩后的最终字节；改配置 → 产物字节变化 → 哈希换代，不会出现「哈希未变、内容已变」的脏缓存。
- `dist/report.txt` 与 `build-report.html` 在报告阶段生成（压缩与 cacheBust 之后），天然豁免压缩。`report.txt` 汇总：阶段耗时（配置/预校验/页面/媒体/OG/压缩增强/cacheBust/PWA/报告/其它）、HTML/CSS/JS/JSON 的压缩前后 raw/gzip 与节省率（含变更/新增/移除/跳过/豁免计数）、CSS 合并/去重跳过计数与明细（文件 + 原因）、压缩阶段失败清单、无头验证摘要（读取 `.cache/compression-verify/last.json`；本轮未运行则如实标注）、非阻断告警、perfBudget 5 项对照与压缩目标现状值（本阶段口径：基线压缩前 → 增强/压缩后；HTML gzip ≥10%、JS gzip ≥20% 混淆关态，三态对照与未达原因见 `docs/plans/2026-09-27-compression.md`「C8 结果」）。`report.txt` 已列入默认 `exclude`，且被产物等价护栏 `scripts/lib/dist-hash.js` 的默认忽略项覆盖（与 `build-report.html` 同为含时间戳的非确定性产物）。

**语义：基线压缩 vs 增强步骤**
- **基线压缩**：`site.build.minifyHTML/minifyCSS/minifyJS` 驱动的既有 minify-html / CleanCSS / Terser 行为，恒定执行且**不受本文件开关影响**（默认态产物字节与引入本文件前一致）。`exclude` 只约束增强步骤，不改变基线。
- **增强步骤**（仅当 `enabled=true` 且非 serve/watch 时执行；逐文件先经 `isExcluded(distRelPath, exclude)`）：
  - `html.aggressive=true`：minify-html 叠加真实支持的激进选项（省略可选闭合标签 `<html>/<head>` 无属性开标签、属性值去引号与属性间空格折叠、`minify_doctype`、移除 bangs/处理指令）。默认 false 时选项与基线逐字段一致（产物哈希可证明）；开启后需 C5 无头门禁裁决。C8 实测（2026-09-27）：门禁 6 页 PASS，但 84 页 HTML gzip 仅 −0.46%（三态见计划文档），收益不显著，默认保持 false。
  - `html.removeComments=false`：保留 HTML 注释（压缩阶段的基线选项回退，仅 `enabled` 时生效；默认 true 与基线一致）。
  - `json.enabled=true`：`dist/**/*.json` 去空白（`JSON.parse → JSON.stringify`，键序保持、输出合法 JSON、Unicode 原样）。跳过：已是紧凑单行、`exclude` 命中项、`assets/config.<hash>.json`（文件名由内容哈希派生，是 HTML 的引用键；重写会破坏一致性——该文件写入时已紧凑，天然无需处理）。逐文件失败只告警并保留原文件。
  - `css.mergeInlineStyles`（C3 已实装）：同页内联 `<style>` 安全合并——只合并「同组（nonce 与 media 一致）且中间无其它样式源」的相邻块，合并块落在首块位置并保留 nonce/media；SVG 与 `<noscript>` 内的 style、外链 `<link rel=stylesheet>` 一律视为截断源（不跨越，避免层叠顺序改变）；非 nonce/media 属性（如 `id=customCSS`）在合并时丢弃。因此数学页（正文含 KaTeX 外链）等被 stylesheet 截断的页面保持两块，这是顺序安全的必然结果。
  - `css.dedupe`（C3 已实装）：保守去重——①同一规则内同属性且同 `!important` 状态的重复声明保留最后一条（重要性与普通混合时一律不动，避免破坏层叠）；②相邻（仅空白分隔）且完全相同的规则保留前一条；非相邻重复不折叠、`@keyframes` 内部与 at-rule 结构不动、规则顺序不动。作用于页面内联 style 与 dist 外链 CSS 文件（`assets/**` 不参与 cacheBust，外链 CSS 只改内容不改名，与基线 CleanCSS 行为一致）；解析异常（真实标签缺失闭合/计数不平衡、括号/引号/注释不配平）跳过该文件并告警，跳过计数与原因写入 `dist/report.txt`，不计入失败账本、不阻断构建。标签配平采用上下文感知扫描（注释、`title`/`textarea` RCDATA、`script`/`style` 内容与带引号属性值中的 `<` 不计为标签），避免 `</script><script>` 一类惰性文本误判。
  - `js.minify`（runtime 引导脚本压缩，C8 实装）：`copyRuntimeBootstrap` 原样复制的 `runtime.<hash>.js`（classic script，基线打包的 esbuild minify 不覆盖）走 Terser 压缩（`module:false`，不改顶层标识符），压缩后按最终字节以 md5-10 重命名并同步改写全部 HTML 引用（`<script src>`），维持「文件名哈希=最终字节」；失败保留原文件并告警。实测 raw 3.75KB → 2.85KB、gzip 1.79KB → 1.34KB。
  - `js.obfuscate.enabled=true`（C4 已实装）：对**本轮 esbuild 产物** `app.<hash>.js` / `deferred.<hash>.js` 执行混淆，随后按混淆后字节重算文件名（md5-10）并同步改写全部 HTML 引用（app `src` 与 `window.__DEFERRED_URL__` 内联 URL），维持「文件名哈希=最终字节」。`runtime.<hash>.js` 因文件名哈希由内容派生、HTML 以该名引用（参与内容哈希引用），排除在混淆之外（其内容寻址改名由上一项 `js.minify` 压缩步骤承担）；vendor、`--no-bundle` 源码拷贝与增量残留旧文件永不命中（白名单=本轮 bundle 清单）。依赖 `javascript-obfuscator` 为 devDependency，仅在开关开启时惰性加载；单文件失败保留原名原文件并告警。
- `html.collapseWhitespace=false` 暂不受支持：minify-html 恒折叠安全空白，配置为 false 时输出 `[WARN]` 并保持折叠。
- `verify.headless` / `verify.fallbackOnFailure`（无头对比门禁 + 自动回退，已实装）：见下节「无头对比门禁与自动回退」。
- 失败处理：配置加载/覆盖校验错误 → 记录构建失败 + 告警 + 降级内置默认值（不中止构建流程；`--allow-degraded` 可让退出码为 0）；逐文件压缩失败 → 告警 + 保留原文件 + 记录构建失败；例外：CSS 合并/去重解析异常按「跳过 + 告警 + 计入 skipped 明细」降级（产物正确性不受影响），不记录失败账本。
- `--compression-override <path>`：隔离验证/预览构建的第二态压缩配置（JSON5 深合并、仍过 `validateCompression`、不写仓库 `compression.json5`）；文件缺失或解析错误在构建 try 内按 `--features-override`/`--theme-override` 同模式中止（watch 下被 rebuild 循环捕获，不再使监听进程退出）。

**无头对比门禁与自动回退（verify）**

- **时机**：增强步骤前把将被增强触及的 dist 文本产物（HTML/CSS/JS/JSON）快照到项目 `.cache/compression-baseline/`；增强完成后、cacheBust 之前启动两个本地静态服务（压缩产物 / 基线叠加层，端口由系统分配且互不相同，子进程注入 `SYNAPSE_SERVE_PARENT_PID`/`SYNAPSE_SERVE_IDLE_MS`/`SYNAPSE_SERVE_MAX_MS` 看门狗），用系统 Chrome（`puppeteer-core`）逐页断言。因验证先于 cacheBust，回退后参与内容哈希的即回退产物（哈希=最终字节不破）。
- **页面集（≥6 页）**：`/zh/`、`/en/`、一篇文章（首页卡片链接发现）、`/zh/search/`、`/zh/archive/`、`/zh/404.html`。
- **断言**：① 两态静态页（JavaScript 关闭以隔离运行时注入噪声）DOM 归一化结构一致——剔除注释/空白文本节点/属性顺序，白名单仅内联 `<style>` 元素整体剔除（同页合并为预期结构变化）、构建期 nonce 归一化、`app`/`deferred` bundle 与 `runtime` 引导脚本的文件名哈希归一化（混淆/压缩按最终字节改名是预期差异）；② 静态页可见元素前 80 个的 `getComputedStyle` 关键属性串一致；③ 两态（JavaScript 开启）逐页 0 控制台错误（唯一过滤项：浏览器默认 favicon 探测噪声）；④ 压缩态交互冒烟：软导航点击文章无整页刷新、搜索可打开、主题切换可用；⑤ runtime 压缩或 `js.obfuscate.enabled=true` 时压缩态额外断言 `__T`/`__SB` 可用与 deferred 动态加载成功。
- **跳过语义**：Chrome 探测失败（`CHROME_PATH`/系统路径/PATH 均无）、puppeteer-core 不可用或 Chrome 启动失败 → 跳过验证并 `[WARN]`，构建照常成功；结果 JSON 标注 `status=skipped` 与原因。可用环境变量 `SYNAPSE_COMPRESSION_VERIFY=off` 显式关闭构建内联验证（测试/隔离构建）。
- **回退语义**：验证失败且 `fallbackOnFailure=true` → 用基线快照覆写 dist 文本产物（并删除快照后新增的增强产物），以 `[WARN]` + 非阻断记录（`compression-verify`，构建退出码保持 0）继续；回退后逐字节复核，不一致则升级为阻断失败。`fallbackOnFailure=false` → 不回退、保留压缩产物并记录阻断失败（构建退出码非零）。Chrome 缺失属环境原因，不进入回退。
- **产物与缓存**：验证结果 JSON 写入 `.cache/compression-verify/last.json`（含 `phaseDurationsMs` 阶段耗时、端口与释放结论、逐页对比摘要）；基线快照默认验证后删除（`SYNAPSE_COMPRESSION_BASELINE_KEEP=1` 保留供人工比对）；Chrome 使用项目内持久 profile `.cache/chrome-verify-profile`（跳过首次导航初始化，可安全删除；同一时刻只允许一个构建使用）。
- **独立命令**：`npm run verify:compression`（`scripts/verify-compression.js`）执行一次完整构建并读取验证结果：`passed → 0`、`failed → 1`（即使构建已回退，显式门禁仍报失败供人工介入）、`skipped → 0`；支持 `--out <dir>`、`--chrome <path>`、`--keep-baseline`、`--json`。CI（`.github/workflows/deploy.yml`）在 Chrome 可用时条件执行该命令。

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `true` | 压缩总开关；false = 整个压缩阶段跳过（serve/watch 下强制 false，配置无法覆盖） |
| `html.enabled` | bool | `true` | HTML 压缩开关（与 `site.build.minifyHTML` 相互独立） |
| `html.removeComments` | bool | `true` | 移除 `<!-- -->` 注释；false = 压缩阶段保留（仅增强步骤生效，默认与基线一致） |
| `html.collapseWhitespace` | bool | `true` | 折叠可安全移除的空白（minify-html 恒折叠，false 暂不受支持，输出告警） |
| `html.aggressive` | bool | `false` | 实验性激进压缩（省略可选闭合标签/属性引号折叠等）；需经无头门禁裁决；C8 实测门禁通过但 gzip 收益仅 −0.46%，默认保持关闭 |
| `css.enabled` | bool | `true` | 外链 CSS 压缩开关（增强步骤门；基线 CleanCSS 恒定执行） |
| `css.mergeInlineStyles` | bool | `true` | 同页内联 `<style>` 安全合并（C3 实装）：同组相邻块合并、保留 nonce/media、跨 link/SVG/noscript 不合并 |
| `css.dedupe` | bool | `true` | 保守去重（C3 实装）：同规则同属性同 important 保留最后一条、相邻完全重复规则保留前一条、@keyframes 不动 |
| `js.enabled` | bool | `true` | JS 压缩开关（vendor 与豁免名单始终排除） |
| `js.minify` | bool | `true` | Terser 压缩（空白/注释/死代码/局部变量名）；C8 起同时压缩 `runtime.<hash>.js` 引导脚本（压缩后改名 + 同步 HTML 引用） |
| `js.obfuscate.enabled` | bool | `false` | JS 混淆开关（C4 实装）：仅本轮 app/deferred bundle，runtime/vendor 排除（runtime 压缩由 `js.minify` 承担）；混淆后重命名并更新 HTML 引用 |
| `js.obfuscate.preset` | string | `'medium'` | 混淆强度：`low`（仅标识符重命名）/ `medium`（+stringArray base64）/ `high`（+控制流平坦化等）；代价见下 |
| `js.obfuscate.seed` | number | `0` | 0 = 每次随机；固定正整数保证每次构建字节一致（同 seed 复跑已实测逐字节确定） |
| `json.enabled` | bool | `true` | JSON 产物去空白（本波实装；跳过紧凑单行与 `assets/config.*.json`，输出始终合法） |
| `exclude` | string[] | 见文件 | 相对 dist 根的 glob 豁免名单；整体替换（不与默认项合并） |
| `verify.headless` | bool | `true` | 压缩后无头对比门禁（已实装）：增强后、cacheBust 前对比压缩产物与基线快照（6 页 DOM/采样计算样式/控制台错误/交互冒烟）；无 Chrome 跳过并告警（构建不失败），`SYNAPSE_COMPRESSION_VERIFY=off` 可显式关闭 |
| `verify.fallbackOnFailure` | bool | `true` | 门禁失败时：true=用基线快照回退未压缩产物并以非阻断告警继续（逐字节复核）；false=保留压缩产物并记录阻断失败 |

**C4 混淆代价与注意（2026-09-27 本机实测，medium 档 + seed=20260927）**
- 体积：app + deferred 合计 raw 189.6KB → 253.3KB（+33.6%）、gzip 60.2KB → 96.3KB（+59.9%）；runtime 不参与混淆（C8 起按 `js.minify` 独立压缩，2.8KB）。esbuild 已极致压缩，混淆器短名与包装代码会净增体积。
- 加载与运行：本地 gzip 服务下 `/zh/` 首页 JS 传输 61.1KB → 97.2KB、load 中位 180ms → 327ms（单机对照，非生产基准）；官方参考低档运行时约 +10-20%、中档 +30-50%、高档 +50-80%。
- 构建耗时：默认 4.75s → 混淆开启 7.46s（+2.7s，仍 < 8s 目标）。
- 建议：仅在对代码保护有明确需求时开启；开启时固定 `seed` 保持内容寻址稳定；`medium`/`high` 增加首屏执行开销，移动端谨慎；`high` 档（控制流平坦化）体积约 +117%，默认不推荐。
- `runtime.*.js` 排除混淆的理由：首屏引导脚本，混淆既破坏「混淆后文件名哈希=最终字节」原则，又让最小引导文件承担执行风险；其压缩收益由 `js.minify` 的 Terser 步骤覆盖（`module:false`、不改顶层标识符、压缩后 md5-10 改名并同步 HTML 引用）。app/deferred 通过「混淆 → 按最终字节重命名 → 更新 HTML 引用」维持哈希语义。

**`exclude` glob 语义**：`**` 跨目录（可匹配零层）、`*` 仅段内、`?` 单字符；大小写敏感（与线上 Cloudflare 文件系统语义一致）；分隔符用 `/`，反斜杠会归一化；不带 `**/` 的模式只匹配 dist 根位置。

**默认豁免与理由**
- `assets/vendor/**`：第三方库/字体/图标已自带压缩版，二次压缩收益小且易破坏 source map；`assets/fonts/**` 同属二进制或已子集化资源。
- `media/**`、`og/**` 与 `**/*.woff2|avif|webp|png|jpg|svg`：二进制或被外部按原字节引用的资源，压缩无收益且可能损坏。
- `report.txt` / `build-report.html`：构建报告必须保持人类可读（报告阶段生成，天然不经过压缩阶段）。

**与 perfBudget（`features.perfBudget`）的关系**：两者独立——perfBudget 是**结果口径**的体积门禁（统计压缩后的 dist 产物，超预算按 `warnOnly` 提醒或阻断构建），compression.json5 是**达成手段**（决定压缩开关与豁免范围）。关闭压缩或扩大豁免会让预算更易超线；预算数值本身不在本文件配置，HTML gzip 体积与请求数仍以 perfBudget 的实测为准。

## 13. ui-strings.json5 — 界面文案词典

第 14 个配置文件中的文案数据表。结构与策略（「键名即文档」——值为实际文案，不逐键复述）：

- **结构**：顶部各区为中文文案；文件后半的 `en` 键为英文镜像（同名同构）。构建期服务端 `ui()` 与客户端 `__I18N__` / `__T()` 共用同一份词典。
- **回退链**：当前语言词典 → 中文原文 → 代码内置默认（`ui('key','默认')`）。`en` 镜像未覆盖的键，英文站显示中文原文。
- **占位符**：形如 `{count}` / `{name}` 的花括号占位符由调用方替换，勿删；键缺省时回退内置默认；新增未被代码引用的键不生效（谨慎添加）。

| 模块键 | 用途 |
|---|---|
| `top` | 顶部/页面文本（语言、主题预设等） |
| `bottomNav` | 移动端底部导航 |
| `search` | 搜索浮层与结果页（占位、热词、错误态、重试等） |
| `group` | 搜索结果分组（文章/标签/分类） |
| `nav` | 导航（菜单、面包屑、关项目等） |
| `sidebar` | 侧边栏各组件标题与提示 |
| `card` | 卡片与列表（阅读全文、空态、置顶等） |
| `post` | 文章页（上下篇、目录、朗读、分享、打赏等） |
| `toolbar` | 文章工具栏与浮层操作按钮（灯箱、代码、快捷键帮助等） |
| `archive` | 归档页（统计、图例、空态） |
| `gallery` | 图库页 |
| `category` | 分类列表与计数 |
| `tag` | 标签文章列表 |
| `tags` | 标签云/标签页 |
| `links` | 友情链接页（空态、申请） |
| `favorites` | 收藏页与收藏操作提示 |
| `notFound` | 404 页（返回首页、站内搜索、热门文章） |
| `pagination` | 分页上一页/下一页 |
| `announcement` | 公告条 |
| `pwa` | PWA（更新、离线、安装、重试） |
| `common` | 通用（空态、重试、确认、取消、复制成功、返回等） |
| `commandPalette` | 命令面板（分组与动作名） |
| `subscribe` | 订阅组件 |
| `readingHistory` | 继续阅读（清除） |
| `guard` | 防护模块提示（复制拦截、快捷键拦截、检测提示、访问门槛等） |
| `en` | 英文镜像（结构与中文区一致；未覆盖键回退中文） |

> 修改文案后需重新构建；`guard` 区文案与 `guard.json5` 的模块一一对应（`guard.json5` 内的 `noticeText` 等专用键可覆盖词典）。

## 校验与错误上报行为
1. **配置错误 → 立即终止**:缺逗号/引号未闭合/非法字符 → `[FATAL]` + 文件名、行列、上下文(带 `^` 定位)、原因、中文修复提示。
2. **校验失败 → 终止**:类型错误(如 enabled: "yes")、枚举越界、share 平台名未知、URL 非 http(s)、站点名缺失。
3. **校验警告 → 继续构建**:颜色疑似非法、changefreq 非标准、CSP unsafe-inline、tags 写成字符串(自动拆分)、无 date(排序前置)。
4. **文章数据 → 逐篇校验**:重复 slug 跳过并报错;非法日期跳过并报错;h1 超一个跳过;标题为空回退文件名(警告)。

## 环境变量
| 变量 | 作用 |
|---|---|
| `CF_API_TOKEN` | 部署专用（GitHub Actions Secrets / 本地）；Pages 部署与 Worker 发布 |
| `NODE_ENV` | 构建环境标识（`production` / `development`），影响构建分支与日志 |
| `SITE_URL` | 覆盖 `site.json5` 的 `site.url`（CI 预览/多域名部署；留空则用配置文件值） |
| `CF_WEB_ANALYTICS_TOKEN` | 未在 site.json5 填写 token 时读取;缺失则跳过注入并警告 |
| `MAINTENANCE` | 生产 Worker / 本地 serve 维护模式(`1` 生效) |
| `MAINTENANCE_MESSAGE` | 维护页自定义文案（Worker 运行时变量，HTML 转义后输出）；未设置时按 `Accept-Language` 选择内置中/英文案（`en*` → 英文，其余 → 中文） |
| `LOG_LEVEL` | Worker 结构化日志级别：`off`/`error`/`warn`/`info`/`debug`（默认 `info`）；日志为 JSON Lines（含 `requestId`/`level`/`event`），响应头 `X-Request-Id` 可对同请求溯源；不落 IP 明文（短哈希关联） |

> 构建/部署变量的模板见根目录 `.env.example`；Worker 运行时变量（`MAINTENANCE` 系列）在 Cloudflare Dashboard → Workers 环境变量中配置。

---

## 附：运行时配置外置（/assets/config.<hash>.json）

- 构建把 `features` / `tuning` / `guard`（启用时）/ `morphIcons` / `presets` / `quotes` / `ui-strings`（i18n）/ `linkWarning` / `pwa` 写入内容寻址文件 `/assets/config.<sha1 前 10 位>.json`（内容变即换名，与 `/assets/*` 同享 1 年 immutable 缓存）。
- HTML 仅内联 ≤2KB 的降级子集（`features.guards` + `pwa` 开关；连同逐页小项 `__SITE_TITLE__`/`__ART_TITLE__`/`__SEARCH_PROVIDER__`）。
- 前端启动时异步加载该文件并写入 `window.__FEATURES__` 等全局；失败自动重试 1 次，3 秒超时后使用内置最小子集继续运行（fail-open，`window.__CONFIG_OK__=false`）。
- `site.build.cacheControl: false` 时该文件的缓存响应头同样不下发（与其它资源一致）。
- `popupNotice` / `softNavigation` 等交互配置同样随该文件外置下发（前端启动后从 `window.__FEATURES__` 取用）；逐字段说明见 §3.29 popupNotice 与 §3.36 softNavigation。
