# S-ynapse 配置文件完整参考

> 全部配置文件位于项目根目录,采用 **JSON5**(支持注释与单引号/无引号键)。
> 构建时自动加载+深度合并;缺省任意字段时使用与本站行为一致的内置默认值。
> 配置文件语法错误(缺逗号、引号未闭合等)会**立即终止构建**,并输出:文件名+行列+上下文+原因+修复提示。
> 注释约定:字段均带中文注释(作用/类型/可填值/不可填值/推荐/注意);`ui-strings.json5` 为文案表,以「键名即文档」为策略(仅分节注释)。
> 本文是逐字段权威参考。字段左侧符号:`=默认`(内置)/`必填`(缺失即报错)。

---

## 目录
1. [site.json5 — 站点主体](#1-sitejson--站点主体)
2. [theme.json5 — 视觉与主题](#2-themejson--视觉与主题)
3. [features.json5 — 功能总控(95 模块)](#3-featuresjson5--功能总控95-模块)
4. [navigation.json5 — 导航](#4-navigationjson--导航)
5. [sidebar.json5 — 侧栏](#5-sidebarjson--侧栏)
6. [footer.json5 — 页脚](#6-footerjson--页脚)
7. [security.json5 — 安全](#7-securityjson--安全)
8. [content-policy.json5 — 内容策略](#8-content-policyjson--内容策略)
9. [tag-aliases.json5 / friends.json5 — 可选数据文件](#9-tag-aliasesjson--friendsjson--可选数据文件)
10. [tuning.json5 — UI 微调参数层](#10-tuningjson5--ui-微调参数层)
11. [guard.json5 — 防护与交互控制域](#11-guardjson5--防护与交互控制域)

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
| `build.generateIndex/Archive/Tags/Categories/Gallery` | bool | `true` | 页面生成开关 |
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
| `darkMode.default` | string | `system` | `light`/`dark`/`system` |
| `darkMode.colors.*` | — | `{}` | 暗色覆盖色板 |
| `fontFamily` / `fontFamilyMono` | string | `sans-serif`/`monospace` | 字体 |
| `fontSystem.stack/displayStack/headingStack/scale` | string/number | `inter`/`sora`/`manrope`/`1` | 字体系统：正文族 / 展示层（h1·Logo）/ 次级标题（h2-h6·卡片·部件）族 / 全局缩放；中文字符自动回退 CJK 字体链；字体文件构建期本地化到 `assets/vendor/fonts/` 并自动预加载 |
| `fontSizeBase` / `lineHeight` | string/number | `16px`/`1.8` | 基础字号/行高 |
| `headingFontWeight` | number | `700` | 标题字重 |
| `letterSpacing` | string | `0.02em` | 字符间距 |
| `spacing.containerWidth` | string | `1250px` | 容器宽度(balanced 档位写入) |
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
| `appearance.*` | — | 见 theme.json5 | 外观细节（选中色/滚动条/焦点环/代码/表格/分隔线/图注） |
| `articleFooter.enabled/source/...` | bool/string | `true`/`disclaimer` | 文章页脚公告栏（内容源为 pages/ 下文件） |

---

## 3. features.json5 — 功能总控(98 模块)

**加载规则**:可选文件;缺失时使用内置默认(与文件内容一致的当前行为)。
**合并规则**:数组字段(share.order 等)为用户覆盖,不拼接;一切字段均可缺省。
**校验**:每个模块必须是对象;enabled 必须是布尔;枚举字段(如 heatmap.scaling)非法值直接报错终止构建。
**双语约定（*En 字段）**:所有文案型字段均可追加同名 `En` 后缀（如 `reward.buttonTextEn`）提供英文站文案；类型与中文值一致，**空字符串 = en 站回退中文值**。共覆盖 60 键：search / codeBlock / externalLink / shortcuts / readingTime / codeCopy / readMode / readingPanel / mermaid / series / related / pinned / wordCount / share / reward / gallery / heatmap / stats / prevNext / maintenance / comments / contactPopup / hero / dailyQuote / favorites / subscribe。构建期模板按页面语言渲染 `*En`；运行时模块（`search.js`/`share.js`/`code-block.js`/`comments.js`/`contact-popup.js`/`favorites.js`）按当前页面语言（`data-lang`）取 `*En`。


### 3.0 未接线键总表（预留状态；第二轮配置闭环 2026-09-27）

> 状态口径：本轮「已接线」= 代码读取且生效（见各模块小节说明）；「未接线（已标注）」= 功能未实现或实现固定，JSON5 对应键上方已加 `// ⚠ 未接线（预留）：…` 注释，**修改暂不生效**；「已实现」= 本轮新增实现（hotSearches 热门词、readingProgress 悬停气泡与 aria、readingTime.showInMeta、toc min/maxLevel、mobileToc overlayClose/lockScroll、readDock show*、externalLink showFullUrl/openInNewTab、share copiedShowMs/popupWidth/popupHeight/wechatText、tts.volume、comments.loadContainer、darkImageFilter.applyImages、mobileToc.autoClose、themePresets.showInNavbar/previewOnHover、themeSchedule.applyInstantly、shortcuts.helpTitle/showHelpTable、ogImage.useCover/gradientForNoCover、search.highlightMatches/closeOnOverlay/focusOnOpen、searchHighlight.enabled 门控）。
> 本表由审计脚本扫出（`js/templates/scripts` 对叶子键名的引用检测）；`enabled`、`height`、`size` 等通用名键不在机器扫描口径内，已按跨文件重复与抽样核验处理（见 `docs/config-audit-2026-09-27.md`「第二轮闭环结果」）。

| 模块 | 未接线键（JSON5 已标注） | 原因 / 替代来源 |
|---|---|---|
| `lightbox` | `maxWidthVw` / `openDurationMs` / `switchDurationMs` | 灯箱打开/切换补间未实现；现由 CSS transition（transitionDurationMs）统一控制 |
| `backToTop` | `rightOffset` / `bottomOffset` / `scrollDurationMs` / `htmlAnchorFallback` | 返回顶部用原生 scrollTo（smooth/auto 由 smoothScroll 控制<sup>①</sup>），自定义时长与无 JS 锚点回退未实现 |
| `search` | `emptyHint` / `emptyHintEn` / `matchTags` / `matchCategories` / `weightTitle` / `weightExcerpt` / `weightContent` / `pinyinFuzzy` | 前端检索实现固定（仅标题/摘要/正文子串匹配，无加权与拼音）；文案由 navigation/ui-strings 提供 |
| `imageLazy` | `preserveAspectRatio` | 构建期已恒输出 width/height 防抖；关闭需改构建模板 |
| `externalLink` | `whitelistNewTab` / `copyButtonText` / `copyButtonTextEn` | 白名单链路不做 target 改写；联系弹窗为图标点击复制，无按钮文案位 |
| `themeToggle` | `defaultTheme` / `rememberChoice` / `iconStyle` / `transitionAll` | 实际由 theme.darkMode.default 与模板固定行为控制（同义键，保留兼容） |
| `shortcuts` | `showHelpHint` | 帮助提示按钮未实现（快捷键 ? 恒可开帮助面板） |
| `toc` | `defaultOpenLevel` | 默认展开层级未实现（折叠由 collapsible + tuning.toc.collapsedByDefault 控制） |
| `autoSummary` | `stripMarkdown` | 摘要由渲染后 HTML 去标签生成，Markdown 已天然剥离；frontmatter excerpt 原样使用 |
| `codeCopy` | `includeWindowBar` | 代码窗栏复用由 features.codeBlock.windowBar 控制（同义键） |
| `searchHighlight` | `markClass` | 高亮使用内置 `<mark>` 标签，未附加自定义类名 |
| `listCover` | `showOnArchive` / `aspectRatio` | 归档页封面与卡片比例由 theme.card / tuning.card.imageAspect 控制（近似同义键） |
| `mobileBottomNav` | `onlyMobile` / `useSafeArea` | CSS 恒仅移动端显示；安全区由 features.mobile.safeAreaBottom 控制 |
| `incrementalBuild` | `fullFlag` / `fingerprintHash` / `skipUnchanged` | 增量构建方案未实现（见 docs/incremental-build-design.md） |
| `readMode` | `focusOnlyContent` | 阅读模式 CSS 恒仅保留正文（data-reading） |
| `tts` | `preferDefaultVoice` / `voiceBy` / `highlightParagraph` | 语音选择与逐句高亮实现固定（highlightParagraph 与 highlightReading 重叠） |
| `wikiLinks` | `unknownMode` / `unknownSuffix` / `caseInsensitive` / `allowCustomLabel` | 双链解析实现固定（未知目标按纯文本、区分大小写、支持自定义标签） |
| `supSub` | `supMarker` / `subMarker` / `skipInsideMath` / `preserveUnmatched` | 上下标标记固定为 ^/~，构建期正则未做动态标记 |
| `math` | `autoDetect` / `inlineDelimiters` / `blockDelimiters` / `mathml` | 定界符固定为 $/$$；MathML 输出恒开 |
| `mermaid` | `autoDetect` / `followTheme` / `copyAfterRender` / `errorTextEn` | 图表检测/主题跟随实现固定（构建期 SSR） |
| `series` | `showBadge` / `badgeFormat` / `badgeFormatEn` / `sidebarWidget` / `panelTitle` / `panelTitleEn` / `showPosition` | 模板当前恒渲染徽标/面板；文案由 ui-strings 词典提供 |
| `related` | `excludeCurrent` | 相关推荐恒排除当前文章 |
| `pinned` | `badgeText` / `badgeTextEn` / `badgeStyle` / `sortRule` | 徽标文案由 ui-strings.card.pinned 提供；样式/排序固定 pill/pinned-first |
| `wordCount` | `onCards` / `textFormat` / `textFormatEn` / `readTimeFormat` / `readTimeFormatEn` / `countCjkChars` / `countDigits` | 卡片字数由 theme.card.showWordCount 控制；文案由 ui-strings 词典提供；统计口径固定 |
| `reward` | `closeByBtn` / `closeByOverlay` / `closeByEsc` | 弹窗固定支持按钮/遮罩/Esc 三种关闭方式（不可单独禁用） |
| `gallery` | `collectFeatured` / `incrementalByDefault` | 图库恒收集文章封面且始终增量收集 |
| `heatmap` | `levels` / `showLegend` / `legendLow` / `legendLowEn` / `legendHigh` / `legendHighEn` / `tooltipFormat` / `tooltipFormatEn` / `showMonthNumbers` | 热力图层级/图例/月份数字模板固定；文案由 ui-strings 词典提供 |
| `stats` | `showArchiveCards` / `labelPosts` / `labelPostsEn` / `labelDays` / `labelDaysEn` / `labelWords` / `labelWordsEn` / `labelAvg` / `labelAvgEn` / `labelTags` / `labelTagsEn` / `labelCategories` / `labelCategoriesEn` / `linkArchive` | 归档统计文案由 ui-strings.archive.* 提供；卡片跳转恒指向 /archive/ |
| `feed` | `rssEnabled` / `rssFullContent` / `rssMaxItems` / `jsonFeedPath` / `jsonFeedFullContent` / `jsonFeedMaxItems` / `injectHeadLinks` / `injectFooterLink` | 订阅实际以 site.rss / site.rss.jsonFeed 为准（模块头已注明） |
| `analytics` | `injectAt` / `emitBeacon` / `siteTag` | 统计注入固定 body + beacon（域名随 CSP 自动裁剪） |
| `redirects` | `generatePagesFile` / `applyInServe` / `invalidRule` | 重定向实现固定：恒生成 _redirects 并在 serve 应用（非法规则 abort） |
| `maintenance` | `setRetryAfter` / `retryAfter` | 维护响应固定设置 Retry-After: 3600（Worker 侧） |
| `mobile` | `searchFullscreen` / `buttonStackGap` / `touchFallback` / `codeScrollHint` | 搜索全屏/按钮堆叠由 tuning 位置控制；触屏悬停与滚动提示未实现 |
| `contactPopup` | `copyTextEn` / `showAllItems` | 弹窗宽度模板固定 400px（与默认 360px 存在漂移，待统一）；复制文案由 ui-strings 提供；条目全量展示 |
| `linkBehavior` | `matchMode` / `skipInternal` / `mailtoMode` / `lateTargeted` | 模块未接入 external-link 链路（外链行为由 features.externalLink 控制） |
| `performance` | `warningJsKb` / `warningHtmlKb` / `warningImageKb` / `warningBuildMs` | 构建性能阈值未消费（预算门禁由 features.perfBudget 控制） |
| `debug` | `verbose` / `listPages` / `dumpConfig` | 构建日志由 CLI 参数控制，未读取本组键 |
| `hero` | `searchPlaceholderEn` | Hero 搜索占位由 ui-strings.toolbar.searchPlaceholder 提供（en 站同源双语） |
| `motion` | `revealStaggerMax` | 错峰总时长上限未实现（motion.js 未做 revealStaggerMax） |
| `dailyQuote` | `widgetStyle` | 每日一言恒渲染在侧栏/文章引用位（widgetStyle 未分流） |
| `favorites` | `listIcon` | 列表页收藏图标未实现（仅文章页按钮与 /favorites 页） |
| \`cover\` | \`defaultPattern\` / \`preferImage\` | 封面样式选择器已渲染（\`enabled\`/\`patterns\`）；默认 pattern 与「图片优先」行为固定为 gradient/优先图片，未读取本键 |
| `pagefind` | `integrate` | Pagefind 集成恒开（provider=pagefind 时直接接入浮层） |

> ①：`backToTop.rightOffset/bottomOffset` 与 `tuning.backToTop.offsetSide/offsetBottom` 同义，实际生效 tuning 值；`scrollDurationMs`/`htmlAnchorFallback` 未实现。

### 3.1 lightbox — 图片灯箱
| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
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
| `openDurationMs` / `switchDurationMs` | `180`/`120` | 动画时长 |
| `backdropOpacity` | `0.9` | 遮罩透明度 |
| `preloadAdjacent` | `true` | 预载相邻图 |
| `rememberPosition` | `false` | 记忆上次位置 |

### 3.2 readingProgress — 阅读进度条
`enabled true` / `articleOnly true` / `clickToJump true` / `showDot true` / `dotSize 10px` / `barHeight 3px` / `useGradient true` / `gradientStart var(--color-s)` / `gradientEnd var(--color-a)` / `tipDisplayMs 500`(点击跳转后百分比气泡停留时长；悬停/聚焦期间常显，第二轮接线) / `updateThrottleMs 30` / `ariaAnnounce true`(进度条输出 `aria-valuenow`，屏幕阅读器可读；第二轮接线) / `topOffset 0` / `rememberPosition true`(同文章回访恢复滚动位置) / `rememberPositionMaxAgeHours 72`(超时不再恢复;哈希导航与前进/后退不触发)。点击跳转支持键盘（聚焦进度条后 ←/→ 步进 5%、Home/End 首尾）

### 3.3 backToTop — 返回顶部
`enabled true` / `showAfterPx 400` / `rightOffset 2rem` / `bottomOffset 2rem` / `size 44px` / `scrollDurationMs 450` / `smoothScroll true` / `hotkey ''`(KeyboardEvent.key 值如 `Home`;空=禁用;非输入框且无 Ctrl/Cmd/Alt 时生效) / `htmlAnchorFallback false`

### 3.4 search — 客户端搜索
`enabled true` / `minChars 1` / `maxResults 30` / `noResultText 未找到匹配内容`（`noResultTextEn` 为 en 站文案，空回退中文；`tuning.search.emptyTextEn` 优先于它） / `excerptLength 120` / `includeContent true`(构建期生效:是否将正文写入 search-index.json) / `focusDelayMs 100`(打开搜索后延迟聚焦输入框 ms) / `openAnimation fade`(`fade`=弹层淡入/`slide`=自下而上滑入;尊重系统减少动效)

> 未接线预留键（当前修改不生效，JSON5 已加 ⚠ 注释）: `showCount` / `placeholder`（实际使用 navigation.json5 search.placeholder / search.placeholderEn） / `emptyHint`（`emptyHintEn` 同步预留） / `matchTags` / `matchCategories` / `weightTitle` / `weightExcerpt` / `weightContent`(前端无加权排序) / `pinyinFuzzy`(拼音首字母匹配未实现)。`highlightMatches`/`closeOnOverlay`/`focusOnOpen` 已于第二轮接线生效（与 `searchHighlight.enabled` 联动；`tuning.hotCount` 为预留，热门词条数实际读 `hotSearches.top`）。

### 3.5 imageLazy — 懒加载
`enabled true` / `fadeIn true` / `fadeInDurationMs 300` / `placeholderColor var(--color-hover)` / `preserveAspectRatio true` / `loadingClass img-loading`(加载中占位 class) / `errorClass img-error`(加载失败 class) / `eagerFirst 3`(前 N 张图立即加载,不懒加载) / `lqip true`(构建期模糊占位,内联 `data-lqip`,运行时经本模块应用到图片背景) / `lqipWidth 24`(占位宽度 px)

### 3.6 codeBlock — 代码块
`enabled true` / `copyButtonVisibility hover`(`hover|always|never`) / `copySuccessText 已复制` / `copyFailText 复制失败` / `showLanguageTag true` / `lineNumbers true`(纯文本块也可用) / `wrapLongLines false`(true=软换行,行号仍按行高对齐) / `highlightBackground var(--color-hover)`(hover 混色基色,力度见 tuning.code.hoverBgMix) / `borderRadius 0.375rem` / `maxHeight ''` / `copyAllButton false`(true=首块上方一键复制全页) / `downloadButton true` / `blobRevokeDelayMs 1000`(下载后释放 Blob URL 延迟 ms) / `prismBatchMs 8`(Prism 高亮单批主线程预算 ms) / `prismIdleTimeoutMs 300`(首帧高亮空闲超时 ms) / `prismIdleFallbackMs 60`(无 requestIdleCallback 时的兜底间隔 ms)

视觉细化项(tuning.json5)：`code`(lineNumberColor/lineNumberOpacity/hoverBorderMix/hoverShadowMix/hoverBgMix/inlineRadius/inlineHairlineMix/diffAddMix/diffDelMix) / `icons`(strokeWidth/hoverLift)；终端语言自动前缀(bash/sh/shell/zsh/fish→`$ lang`；powershell→`PS> powershell`；console→`> console`)；diff 增删行着色(.token.inserted/.deleted)；菜单图标见 navigation.json5 的 `icon`(内置 home/archive/tags/info/book/link/folder/search/rss/download)。

### 3.7 externalLink — 外链拦截
`enabled true`(需 site.externalLinkWarning.enabled 同真) / `whitelist []` / `blacklist []` / `mode warn`(`warn|prohibit|hint`) / `message 即将离开本站,前往外部链接：` / `messageEn ''`(en 站提示文案,空回退中文) / `confirmText 继续访问` / `confirmTextEn ''` / `cancelText 返回` / `cancelTextEn ''` / `copyButtonText 复制` / `copyButtonTextEn ''` / `showFullUrl true` / `openInNewTab true` / `whitelistNewTab false`

### 3.8 themeToggle
`enabled true` / `defaultTheme system` / `rememberChoice true` / `iconStyle sun-moon` / `transitionAll true` / `persistKey ss-theme`(主题选择的 localStorage 键) / `toggleIconSwap true`(切换时交替太阳/月亮图标) / `zIndex 100`(按钮 CSS z-index)。**主题切换过渡时长唯一来源为 `theme.animation.transitionDuration`（经 `tuning.motion.transitionDuration` 覆盖）；原 `themeToggle.animationMs` 语义重复，已删除（2026-09-27 第二轮配置闭环）。**`defaultTheme` / `rememberChoice` / `iconStyle` / `transitionAll` / `toggleIconSwap` 未接线（实际由 `theme.darkMode.default` 与模板固定行为控制，见 3.0 总表）。

### 3.9 shortcuts — 快捷键
`enabled true` / `openSearch /`(空=禁用,下同) / `toggleTheme d` / `prevPost k` / `nextPost j` / `help ?` / `close Escape` / `showHelpHint true`(未接线，见 3.0) / `helpTitle 快捷键一览`（`helpTitleEn` en 站；第二轮接线为帮助面板 `aria-label`，空回退 ui-strings） / `showHelpTable true`(false 时不渲染快捷键表；第二轮接线) / `ignoreInInputs true`(true=输入框内按键不触发快捷键;false=输入框内也触发)

### 3.10 toc — 目录(桌面侧)
`enabled true` / `minLevel 2` / `maxLevel 4`（两者第二轮接线到构建期 TOC 提取；受正文标题锚点限制收敛到 2–4，minLevel=3 可只收 h3 及以下） / `collapsible true` / `defaultOpenLevel 2`（未接线，见 3.0） / `highlightActive true`(false = 关闭当前章节高亮；第二轮接线) / `activeOffset 120` / `groupCollapse true`(二级项带折叠箭头,可收起其下三级项)

### 3.11 mobileToc — 移动目录抽屉
`enabled true` / `borderRadius 1rem` / `maxHeightVh 70` / `autoClose true` / `overlayClose true` / `lockScroll true` / `position right` / `showCurrent true`(胶囊按钮显示当前章节名与进度百分比)。移动端目录抽屉;显示断点由 `mobile.tocBreakpoint` 控制。

### 3.12 readingPanel — 阅读设置面板
`enabled true` / `fontSizeMin 15`/`fontSizeMax 26`/`fontSizeStep 1`/`fontSizeDefault 19` / `lineHeightMin 1.4`/`LineHeightMax 2.6`/`Step 0.1`/`Default 1.9` / `widthMin 560`/`widthMax 1200`/`Step 40`/`Default 800` / `remember true` / `persistKey 'ss-reading'`(阅读设置 localStorage 键) / `resetText 重置`（`resetTextEn` 为 en 站文案，空回退中文） / `position right`

### 3.13 readMode — 阅读模式
`enabled true` / `persist true` / `label 阅读模式`（`labelEn` 为 en 站文案，空回退中文） / `focusOnlyContent true` / `fontScale 1`

### 3.14 tts — 朗读
`enabled true` / `rate 0.5`(0.1~10) / `pitch 1` / `volume 1` / `preferDefaultVoice true` / `voiceBy lang` / `readSelector .post-content` / `icon speaker` / `highlightParagraph false` / `position toolbar` / `resumeIntervalMs 500`(Chromium 长文本自动暂停后的心跳恢复间隔 ms) / `resumeMaxTries 3`(心跳恢复最大次数，超过即结束朗读)

### 3.15 wikiLinks — 双链
`enabled true` / `unknownMode text`(`text|link|hide`) / `unknownSuffix ''` / `openNewTab false` / `caseInsensitive true` / `allowCustomLabel true`

### 3.16 supSub — 上下标
`enabled true` / `supMarker ^` / `subMarker ~` / `skipInsideMath false` / `preserveUnmatched true`

### 3.17 math — KaTeX
`enabled true` / `autoDetect true` / `version 0.16.22` / `inlineDelimiters ['$']` / `blockDelimiters ['$$']` / `throwOnError false` / `strict false` / `renderRoundParens true` / `renderSquareBrackets true` / `selector .post-content` / `mathml true`

### 3.18 mermaid
`enabled true` / `autoDetect true` / `version 11.4.1` / `followTheme true` / `lightTheme default` / `darkTheme dark` / `securityLevel strict` / `mode 'build'`（渲染模式：`build`=构建期服务端渲染，生成双主题内联 `<svg>`，页面不再加载 3.5MB vendor，渲染失败或无 Chrome 自动回退客户端 / `client`=保持懒加载 vendor + `__mmStart` 客户端渲染） / `darkMode true`（仅 `mode='build'` 生效：明/暗各渲染一份 SVG，页内 CSS 切换、零闪烁；false=仅明色） / `chromePath ''`（仅 `mode='build'` 自动探测失败时使用；自动探测顺序：`CHROME_PATH` 环境变量 > Windows 默认安装路径 > Linux/macOS 的 `google-chrome`/`chromium`；缓存目录 `.cache/mermaid`，不入库） / `idleTimeoutMs 1500`(客户端懒加载 vendor 的空闲超时 ms) / `idleFallbackMs 200`(无 requestIdleCallback 兜底 ms) / `rerenderIdleTimeoutMs 300`(主题切换重渲染空闲超时 ms) / `rerenderIdleFallbackMs 60` / `renderTimeoutMs 10000`(构建期单块渲染超时 ms) / `copyAfterRender false` / `errorText [图表渲染失败]`（`errorTextEn` 为 en 站文案，空回退中文）

`size` 子块 — 图表尺寸（全局默认，单图可覆盖）：
- `width ''` / `height ''`(全局默认宽高，空=自然尺寸；单位白名单 px/%/vw/vh/rem，纯数字按 px)
- `minWidth '320px'` / `minHeight '200px'`(下限，始终生效)
- `maxWidth 'none'` / `maxHeight 'none'`(`none`=不限制；`scroll` 模式下可横向滚动，设 `'100%'`/`'70vh'` 可强制限制)
- `fit 'scroll'`(`scroll`=不缩放、超宽容器横向滚动（推荐，时序图/宽图不挤压） / `scale`=缩放到容器宽度（旧行为）)
- 单图覆盖：代码块语言标记后追加 `w=` / `h=`，如 ` ```mermaid w=900 h=520 `；不填项走全局，非法值忽略并回退默认 — `scripts/build.js`(解析) + `templates/layout.ejs`(应用)

### 3.19 series — 系列
`enabled true` / `showBadge true` / `badgeFormat 系列 · {name}` / `showNavPanel true` / `sidebarWidget true` / `order asc` / `panelTitle 本系列共 {total} 篇` / `showPosition true` / `defaultWidgetCount 8`(侧栏系列 widget 最多展示条数,超出截断) / `prevLabel 上一篇` / `nextLabel 下一篇` / `progressLabel {index} / {total}`(进度模板) / `sidebarTitle 系列`(侧栏 widget 标题,sidebar.json5 w.title 为空时使用)。以上文案键均有同名 `*En`（`badgeFormatEn`/`panelTitleEn`/`prevLabelEn`/`nextLabelEn`/`sidebarTitleEn`），空回退中文

### 3.20 related — 相关推荐
`enabled true` / `topN 4` / `sameCategoryWeight 2` / `sameTagWeight 3` / `minScore 2` / `excludeCurrent true` / `title 相关推荐`（`titleEn` en 站文案，空回退中文） / `showExcerpt true`(卡片显示摘要) / `excerptLength 80`(摘要截断长度) / `showCount false`(显示共享标签数徽章)

### 3.21 pinned — 置顶
`enabled true` / `badgeText 置顶`（`badgeTextEn` en 站文案，空回退中文） / `badgeStyle pill`(`pill|corner|none`) / `sortRule pinned-first`(`pinned-first|normal`)

### 3.22 wordCount — 字数
`enabled true` / `onCards true` / `inArticle true` / `textFormat {count} 字` / `readTimeFormat {minutes} 分钟阅读`（`textFormatEn`/`readTimeFormatEn` en 站模板，空回退中文） / `wpm 265` / `countCjkChars true` / `countDigits false`

### 3.23 share — 分享
`enabled true` / `order ['weibo','qq','wechat','x','facebook','mail','copy']`(顺序即显示顺序) / `position toolbar` / `popupWidth 640` / `popupHeight 520`（弹窗尺寸，第二轮接线到 `window.open` features 串） / `wechatText {title} 分享自 {url}` / `wechatTextEn ''`(en 站模板,空回退中文；微信复制按模板替换 `{title}`/`{url}`，第二轮接线) / `copiedText 链接已复制` / `copiedTextEn ''` / `copiedShowMs 2500`(复制成功 toast 时长，第二轮接线) / `showLabel false` / `label 分享文章` / `labelEn ''` / `useNativeShare false`(支持 navigator.share 时优先原生分享) / `copyFallback true`(剪贴板 API 不可用时 textarea 回退)。运行时复制成功提示按页面语言取 `copiedTextEn` — `js/domains/features/share.js`

### 3.24 reward — 打赏前端
`enabled false`(需 site.reward.enabled) / `buttonText 打赏` / `note 感谢支持` / `popupTitle 打赏支持` / `closeByBtn true` / `closeByOverlay true` / `closeByEsc true` / `qrSize 180px` / `maxWidth 560px` / `showNote true`(显示打赏说明文字) / `qrMaxWidth 180px`(二维码最大宽度 CSS) / `closeText 关闭`(关闭按钮文本) / `links []`(赞助平台链接数组,弹窗底部显示胶囊按钮,每项 `{label,url}`,新窗口 `noopener`;如 GitHub Sponsors / Ko-fi / 爱发电)。文案键均有同名 `*En`（`buttonTextEn`/`noteEn`/`popupTitleEn`/`closeTextEn`），空回退中文；弹窗内方式名称与说明优先取 `site.reward.*En`（见 §1）

### 3.25 gallery — 图库页
`enabled true` / `title 图库` / `description 站内图片集，点击查看大图。` / `emptyText 暂无图片`（`titleEn`/`descriptionEn`/`emptyTextEn` en 站文案，空回退中文） / `columns 4` / `columnMin 220px` / `showSource true` / `collectFeatured true` / `order newest` / `incrementalByDefault true` / `maxItems 0`(0=不限) / `gap 12px`(瀑布流列间距 CSS) / `showCaption true`(图片下方显示来源说明) / `borderRadius 8px`(卡片圆角 CSS)

### 3.26 heatmap — 归档热力图
`enabled true` / `levels 5`(2~7) / `scaling auto`(`auto|fixed`) / `palette []`(fixed 时色表) / `showLegend true` / `legendLow 少` / `legendHigh 多` / `tooltipFormat {year}-{month}: {count} 篇`（`legendLowEn`/`legendHighEn`/`tooltipFormatEn` en 站文案，空回退中文） / `showMonthNumbers true` / `gap 3px`(单元格间距) / `borderRadius 3px`(单元格圆角) / `cellSize 13px`(单元格尺寸,置空则撑满容器) / `emptyColor var(--color-border)`(空月份颜色)

### 3.27 stats — 站点统计
`enabled true` / `showArchiveCards true` / `labelPosts 文章总数` / `labelDays 发文天数` / `labelWords 总字数` / `labelAvg 日均篇数` / `labelAvgPerDay 日均`(归档页日均标签,运行时实际消费) / `labelTags 标签数` / `labelCategories 分类数`（以上标签均有同名 `*En`，空回退中文） / `cardColumns auto-fit`(统计卡列模式,也可固定列数) / `showSidebar true`(侧栏统计 widget 开关,sidebar.json5 需含 type=stats) / `linkArchive /archive/`

### 3.28 prevNext
`enabled true` / `showLabels true` / `prevLabel 上一篇` / `nextLabel 下一篇`（`prevLabelEn`/`nextLabelEn` en 站文案，空回退中文；`site.prevPostLabel`/`nextPostLabel` 为中文次回退） / `hideWhenMissing false` / `showThumbnail false`(导航卡缩略图) / `labelPosition left`(`left|center|right`) / `scrollToTopOnClick true`(点击导航后滚回顶部)

### 3.29 feed — 订阅【预留区，未接线】
`rssEnabled true` / `rssPath /feed.xml` / `rssFullContent true` / `rssMaxItems 50` / `jsonFeedPath /feed.json` / `jsonFeedFullContent false` / `jsonFeedMaxItems 20` / `injectHeadLinks true` / `injectFooterLink false`

> 注意: 本段各键当前未接入构建链路（修改不生效，仅作未来统一入口预留）。实际生效的订阅配置请改 `site.rss`（见 2.4 site.rss）与 `subscribe` 段；head 订阅链接恒随 `site.rss` 配置输出。

### 3.30 analytics
`enabled true` / `scriptSrc https://static.cloudflareinsights.com/beacon.min.js` / `injectAt body` / `emitBeacon true` / `siteTag ''`

### 3.31 redirects
`enabled false`(规则在 site.json5 redirects) / `generatePagesFile true` / `applyInServe true` / `invalidRule abort`(`warn-only|abort`)

### 3.32 maintenance
`enabled false` / `message 站点维护中，请稍后再来。`（`messageEn` en 站文案，空回退中文） / `status 503` / `setRetryAfter true` / `retryAfter 3600`

### 3.33 mobile
`enabled true` / `searchFullscreen true` / `buttonStackGap 4rem` / `touchFallback true` / `codeScrollHint true` / `tocBreakpoint 768`(移动端 TOC 按钮断点 px) / `safeAreaBottom true`(底部安全区留白) / `tapHighlight false`(取消点击高亮)

### 3.34 comments 前端
`enabled true` / `loadContainer true` / `renderPlaceholder true` / `placeholderText 评论加载中…`(占位文案;`placeholderTextEn` en 站) / `loadDelayMs 300`(占位显示时长 ms,过后无组件则显示 emptyText) / `emptyText 暂无评论`(无评论提示;`emptyTextEn` en 站，运行时按语言取) / `title 评论`（`titleEn` en 站；均空回退中文）

### 3.35 contactPopup
`enabled true` / `title 联系方式` / `copyText 复制` / `copySuccessText ''`(复制成功提示,留空用内置双语文案)（`titleEn`/`copyTextEn`/`copySuccessTextEn` 为 en 站文案，空回退中文） / `popupWidth 360px` / `showAllItems true` / `showIcon true`(弹窗顶部图标) / `maxItems 4`(最多联系方式条目数,多行值按行截断)。弹窗实际标题/正文来自 `site.social.items[].popupTitle/popupContent`（en 站优先 `popupTitleEn`/`popupContentEn`，见 §1 site.social）

### 3.36 linkBehavior
`matchMode hostname` / `skipInternal true` / `mailtoMode leave` / `lateTargeted false`

### 3.37 performance
`warningJsKb 80` / `warningHtmlKb 400` / `warningImageKb 300` / `warningBuildMs 30000`

### 3.38 debug
`verbose false` / `listPages false` / `dumpConfig false`

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
`enabled true` / `showProgressRing true` / `showTocButton true` / `showTopButton true`（三者 false 逐项隐藏；全 false 时整个坞不渲染；第二轮接线） / `hideOnScrollDown true` / `position right`。移动端右下角的进度环 + 回目录 + 回顶按钮。

### 3.43 sidebarDrag — 侧栏拖拽重排
`enabled true` / `persistOrder true` / `storageKey 's-sidebarOrder'` / `touchLongPress true` / `touchLongPressMs 500`(长按判定时长 ms) / `showHandleOnHover true` / `resetOnLoadFail true`。用户可拖拽侧栏 widget 重排顺序,存储于 localStorage;移动端长按 `touchLongPressMs`(默认 500ms) 触发。

### 3.44 ogImageStyle — 社交卡片样式
`enabled true` / `template 'aurora'`(`aurora|mesh|grid|paper|duotone`;无封面文章的 OG 底图模板) / `palette 'theme'`(`theme|hash`;hash=按首个分类名哈希取色,同分类同色) / `showCategory true`(封面角标) / `align 'center'`(`center|left`) / `showSite true`(站点名) / `showUrl true`(右下角站点 URL;false=保持画面简洁) / `useGradient true` / `gradientAngle '135deg'` / `fontSizeBase 64` / `maxLines 4` / `letterSpacing '0.02em'`。构建期为无封面文章生成模板化 OG 图(1200×630;尺寸与字号缩放经 `site.seo.ogImage` 的 width/height/fontScale 控制);有封面文章走"封面+底部渐变条"合成 — `scripts/generate-og.js`。

### 3.45 hero — 首页 Hero
`enabled true` / `showSearch true` / `showTags true` / `tagCount 5` / `showDate false`(显示最新文章日期) / `ctaLabelEn View all posts`(en CTA 文案;`ctaLabel` 中文,空回退) / `searchPlaceholder 搜索文章…`（`searchPlaceholderEn` en 站文案，空回退中文） / `heightVh 60`(Hero 最小高度 vh) / `backgroundImage ''`(背景图 URL,空则纯色/渐变)。首页顶部横幅,显示标题简介+搜索+热门标签。

### 3.46 background — 背景特效
`background.particles.enabled true`（粒子总开关；仅 `theme.background.mode='particles'` 时生效，颜色自动跟随 `--color-s`） / `particles.count 72`(10~120，越少越省电) / `particles.speed 0.5`(0.2~2) / `particles.linkDistance 120`(连线距离 px) / `particles.opacity 0.7`(0~1) / `particles.showLines true` / `particles.autoDisableMobile false`(触屏/窄屏自动关闭粒子) / `particles.mobileMaxWidth 640`(autoDisableMobile 的窄屏阈值 px)。

### 3.47 motion — 滚动动效
`enabled true` / `ease cubic-bezier(.4,0,.2,1)` / `pageEnterDurationMs 240`(页面入场时长 ms) / `cardHoverScale 1.02`(卡片悬停缩放) / `linkUnderlineOffset 3px`(下划线偏移) / `cardHoverLift true` / `cardHoverLiftPx 4` / `linkUnderline true` / `linkUnderlineThickness 2px` / `buttonRipple true` / `rippleDurationMs 500` / `scrollReveal true` / `revealCards true` / `revealHeadings true` / `revealImages true` / `revealBlocks false` / `revealDurationMs 250` / `revealDelayMs 0` / `revealStaggerMax 80` / `revealOffset 10px` / `revealOnce true` / `revealThreshold 0.08` / `revealCleanupMs 1400`(reveal 结束清理 transitionDelay 延迟 ms) / `reducedMotion 'light'`(`light|off|full`,轻量版:更短/幅度更小)。滚动渐入/悬停上浮/涟漪/下划线动效总控。**注意**:顶部导航高亮与滑动指示器已抽为独立模块 `js/domains/core/nav-state.js`(构建期 `templates/layout.ejs` 输出 `nav-active`/`aria-current` 兜底),不受本开关影响——`enabled:false` 或 `reducedMotion:'off'` 时高亮仍由 SSR 保证,软导航后仍会更新。

### 3.48 dailyQuote — 每日一言
`enabled true` / `widgetStyle 'sidebar'` / `label '每日一言'`（`labelEn` en 站文案，空回退中文） / `source 'builtin'`(内置 7 条;也支持相对项目根或绝对路径的 `.json`/`.json5`,格式 `["引语"]` 或 `[{text,author}]` 或 `{quotes:[...]}`;加载失败回退内置并告警) / `count 7` / `quoteColor ''`。侧栏每日名言(内置 7 条,按日期轮换)。

### 3.49 favorites — 收藏(纯前端)
`enabled true` / `position 'toolbar'`(`toolbar`=文章底部工具栏,默认/`meta`=标题下元信息行) / `storageKey 's-favorites'` / `label '收藏'` / `listIcon true` / `notText '收藏'` / `favedText '已收藏'`（`labelEn`/`notTextEn`/`favedTextEn` 为 en 站兜底文案，空回退中文；en 站优先取 ui-strings `favorites.*`）。文章收藏按钮+收藏页(仅 localStorage,无后端);按钮切换收藏/取消(状态+aria-pressed+统一 toast)、收藏页列表渲染与移除、空状态。

### 3.50 prismTheme — 代码高亮配色开关
`enabled true`。总开关：关闭后代码块不着色（回退纯文本）；token 配色值定义在 `theme.json5` 的 `codeHighlight.palette`（浅色/暗色两套，随主题自动切换）。

### 3.51 cover — 封面样式库
`enabled true` / `patterns[]` (gradient/stripes/dots/blob/mesh) / `defaultPattern 'gradient'` / `preview true` / `preferImage true`。文章封面样式库(渐变/条纹/圆点/气泡/网格),在线预览。

### 3.52 i18n — 内容级双语
`enabled false` / `defaultLanguage 'zh'` / `languages[] ('zh','en')` / `navToggle true` / `translationNotice true`(文章页翻译互链提示:另一语言存在同 slug 文章时在标题下显示胶囊链接,文案 `post.translationNotice` 支持 `{lang}` 占位) — `features.i18n` 另见 §3.73。**内容级双语**:文章存于 `articles/zh/` 与 `articles/en/` 双目录,URL 带语言前缀(`/zh/slug/`、`/en/slug/`),每语言生成完整站点(首页/文章/归档/标签/分类/搜索/RSS/sitemap/search-index),根路径 `/` 按浏览器语言跳转(localStorage `s-ss-lang` 记忆)。界面文案经 `ui-strings.json5` 词典 + 服务端 `ui()` / 运行时 `__T()` 双语渲染;导航/页脚/侧栏/主题预设支持 `labelEn`/`titleEn` 字段（页脚自定义 HTML 另支持 `htmlEn`）。站点级文案同样按语言取用：`descriptionEn`/`metaKeywordsEn`/`authorProfile.bioEn` 空则回退中文;`languageEn` 控制 en 页 `<html lang>` 与侧栏日期本地化（缺失时回退 `en-US`，避免英文页出现“2026年9月10日”式中文日期）。**运行时语言以 URL 前缀为准**（localStorage 仅作为无前缀路径的偏好记忆），语言切换保持当前子路径。

### 3.53 pagefind — Pagefind 全文搜索
`enabled true` / `indexPath '/pagefind'` / `integrate true`。使用 Pagefind 的离线全文搜索(navigation.search.provider='pagefind' 且本模块 enabled 时生效)。**构建在压缩与哈希之后自动生成索引,输出到 `indexPath`(不参与 cache-bust;先清空旧索引再写入);未安装 pagefind 依赖时告警跳过(`npm install -D --save-exact pagefind`;该依赖默认不在 devDependencies 中);serve/watch 模式同样生成,保证本地预览与生产一致。**

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

`enabled true` / `vendorPath '/assets/vendor/morphicons'`(vendor 图标目录) / `spring 'snappy'`(`smooth|snappy|bouncy`) / `reducedMotion 'light'`(`light|off|full`;light=系统 reduce-motion 下改用更快的轻量弹簧) / `preload 'interaction'`(`interaction|idle|immediate`) / `perIcon {}`(单图标弹簧覆盖,值=预设名或 `{stiffness,damping}`) / `icons { theme, copy, favorite, tts, menu }`(各图标独立开关)。基于 morphicons(本地 vendor,懒加载,~7.5KB gzip):状态切换类图标用弹簧物理做形状变形(主题 sun↔moon、复制 copy→check、收藏空心↔实心、朗读扬声器↔停止、移动端汉堡↔X);关闭任意开关均回退原有静态实现;弹簧参数见 `tuning.morphicons`(stiffness/damping 与轻量版 reducedStiffness/reducedDamping;同时设置时优先于 spring 预设)。

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

`enabled true` / `htmlKb 28`(单页 HTML gzip 上限,含内联 CSS/脚本) / `htmlRawKb 50`(页面 HTML raw 体积中位上限;长文等极端页面由中位口径自然豁免) / `inlineConfigKb 2`(页面内联关键配置降级子集上限) / `jsKb 55`(应用 JS `assets/js` 全量 gzip 合计;vendor 库按需懒加载不计入) / `requests 12`(单页静态请求上限:script src + stylesheet + modulepreload) / `warnOnly true`(`true` 仅提醒;`false` 超限终止构建)。构建收尾输出 `[budget]` 报告 — `scripts/lib/perf-budget.js` + `scripts/build.js`。

### 3.68 scrollIndicator — 滚动进度条

`enabled true` / `height '2px'`(任意 CSS 长度) / `gradient true`(`true`=主题次级色→强调色渐变;`false`=单色) / `respectReducedMotion true`(系统减少动态效果时隐藏)。顶部固定 hairline 进度条,基于原生 scroll-driven 动画(`animation-timeline: scroll(root)`)——零 JS、零主线程开销;不支持该特性的浏览器自动不显示(渐进增强) — `templates/layout.ejs`。

### 3.69 commandPalette — 命令面板

`enabled true` / `hotkey 'ctrl+shift+p'`(组合键,支持 `ctrl`/`cmd`/`meta`/`shift`/`alt` 修饰键;不含 `+` 的旧写法如 `'k'` 等价于主修饰键 Ctrl/Cmd+该键;置空 = 不监听;默认避开浏览器打印 Ctrl+P 与全站搜索 Ctrl+K) / `includeNavigation true`(页面导航项) / `includeActions true`(切换主题/回到顶部/打开搜索/我的收藏) / `includeSearch true`(首次打开时懒加载 search-index.json) / `maxResults 10`(结果上限) / `autoFocus true`。快捷键呼出居中面板,支持键盘上下选择、Enter 执行、Esc 关闭,中文输入法(IME)组合期不误触;样式由 `tuning.commandPalette`(`width`/`topOffset`/`backdropMix`)微调 — `js/domains/features/command-palette.js`。

### 3.70 subscribe — 订阅组件

`enabled true` / `rss true`(页脚订阅条显示 RSS 链接,指向 `{lang}/feed.xml`) / `jsonFeed true`(显示 JSON Feed,仍受 `site.rss.jsonFeed.enabled` 总控) / `newsletterUrl ''`(外部邮件订阅表单地址,如 Buttondown/Substack;空 = 隐藏按钮) / `newsletterLabel ''`(按钮文案,空 = 界面文案表 `subscribe.mail`) / `newsletterLabelEn ''`(en 站按钮文案,空 = `subscribe.mail` 英文词条) / `newTab true`。页脚自动渲染「订阅与更新」条;顺带修复 `<head>` 中 RSS alternate 链接双斜杠问题(`/zh//feed.xml`→`/zh/feed.xml`) — `templates/layout.ejs`。

### 3.71 authorCard — 作者卡(关于页)

`enabled true` / `pageSlug 'about'`(显示页面 slug) / `showSocial true` / `showSkills true` / `showTimeline true` / `avatarSize '96px'`(头像尺寸) / `maxTimeline 20`(时间线最多条数,0=不限)。数据源为 `site.authorProfile`(`name`/`avatar`/`bio`/`bioEn`/`skills[]`/`timeline[{year,title,desc}]`/`socials[{label,url}]`,全可选、未填项自动隐藏、整块可删除;资料至少一项非空时才渲染;`bioEn` 空则回退 `bio`) — `templates/page.ejs`。

### 3.72 readingHistory — 继续阅读(本地阅读历史)

`enabled true` / `maxItems 5`(首页最多条数) / `storageKey 's-history'`(localStorage 键,修改会丢弃旧历史) / `showOnHome true`(false=只记录不展示) / `clearable true`(显示清除按钮)。文章页自动记录(标题+路径+时间,上限 50 条),首页在卡片区上方展示最近阅读(相对时间,`Intl.RelativeTimeFormat` 双语);纯本地、无服务端 — `js/domains/features/reading-history.js`。

### 3.73 hreflang — 多语言替代声明(SEO)

`enabled true` / `includeSelf true`(当前语言条目也输出) / `canonical true` / `xDefault true`(输出 `hreflang="x-default"`,指向 `features.i18n.defaultLanguage` 版本)。与 `features.i18n` 配合:每页输出各语言(URL 前缀替换)+ x-default 的 `<link rel="alternate">`;新增翻译时按 `articles/{lang}/{slug}.md` 同 slug 放置即可获得互链与声明 — `templates/layout.ejs`。

### 3.74 printStyle — 打印样式

`enabled true` / `hideInteractive true`(打印隐藏导航/页脚/侧栏/按钮/评论/相关推荐等) / `expandLinks true`(正文外链打印为 `文字 (URL)`) / `avoidBreaks true`(代码块/图片/表格/引用避免跨页断裂)。打印/导出 PDF 时强制白底黑字、去阴影、正文全宽 — `templates/layout.ejs`。

### 3.75 atmosphere — 氛围

`enabled true` / `grain true`(全局颗粒纹理叠层) / `glow true`(首页 Hero 主题色光晕)。颗粒/光晕的视觉参数在 `tuning.json5` 的 `texture`(noiseOpacity/noiseOpacityDark/noiseBaseFrequency)与 `glow`(heroStrength/heroStrengthDark)分类微调 — `templates/layout.ejs`。

### 3.76 announcement — 公告条

`enabled true` / `text` / `textEn` / `url`(单条模式：中英文文案与可选链接) / `items []`(多条模式，每项 `{text,textEn,url,icon?}`，非空时优先；`icon` 为前缀徽标短文本如 `"NEW"`) / `rotateMs 6000`(多条轮播间隔毫秒，`0`=只显示第一条；`prefers-reduced-motion` 下瞬间切换) / `pauseOnHover true`(悬停/按住暂停轮播与进度条) / `transition 'fade'`(条目切换动画：`fade` 淡入淡出 / `slide` 上滑+淡入) / `tone 'accent'`(`accent` 主题色淡渐变 / `solid` 实心主题色 / `minimal` 素色+下边框 / `gradient` 主→辅强渐变白字) / `showProgress false`(轮播剩余时间进度条；仅多条+自动轮播时渲染) / `showDot true`(左侧装饰圆点) / `newTab true`(外链 `target=_blank rel=noopener`；`false` 则当前窗口) / `dismissible true`(关闭按钮) / `storageKey 's-announce-dismissed'`(关闭记忆键；值为按语言区分的 JSON 对象，如 `{"zh":"…","en":"…"}`，旧版单值记录会在访问时自动迁移) / `removeDelayMs 340`(关闭动画后移除 DOM 延迟 ms)。固定于页面顶部（通过 `--annH` 变量将固定头部、移动菜单、粘性目录整体下移，内容偏移同步；**关闭后 `--annH` 收起为 0，头部自动上移**）；关闭按全部内容哈希记忆（`s-announce-dismissed`）不再出现。视觉细节（字号/字距/高度 `height`，高度同时决定 `--annH` 下移量与公告条实际高度）在 `tuning.json5` 的 `announcement` 分类调整。**防闪机制**：公告条默认隐藏，`<head>` 早检脚本在首帧前确认未被关闭后添加 `html.ann-on` 才显示；关闭记忆按内容哈希（`s-announce-dismissed`），关闭态刷新/导航零可见帧（禁用 JS 时公告不显示，属预期设计） — `templates/layout.ejs` + `js/domains/core/announcement.js`。

### 3.77 guards — 防护与交互控制总控

`enabled true`（总开关，false 时 guard.json5 全文件失效）/ `preset 'soft'`（一键档位：`off` 全关 | `soft` 仅右键菜单+复制署名（默认，体验友好）| `strict` 各模块按 guard.json5 内 `enabled` 生效）/ `contextMenu true` / `copyGuard true`（模块启停，soft 档下仅这两项可被 preset 激活）。细节参数（菜单项、复制模式、选择/快捷键/水印/检测/控制台/隐私帘/篡改/门槛、绕过通道等 168 项）全部在 `guard.json5`（见第 11 章）；绕过通道优先级：`?guard=on|off` > `localStorage['s-guards-off']` > `guard.json5` `core.bypass.localhost`。**诚实声明**：拦截/检测类能力均为威慑手段（可被浏览器菜单/开发者工具/阅读模式绕过），默认档位保持安全温和 — `js/domains/guard/core.js`。

### 3.78 loading — 加载遮罩

`enabled true`（false = 不渲染遮罩；无 JS 时也不会出现）/ `delayMs 120`（启动快于该值不显示，防“一闪而过”）/ `minShowMs 250`（一旦出现至少停留，含淡出）/ `maxShowMs 2000`（硬超时强制淡出，失败兜底；同时写入 CSS 动画兜底）/ `reducedMotion 'skip'`（`skip` 不显示 | `static` 显示但无动画）/ `text ''`（空 = `ui-strings` 的 `common.loading` 双语）/ `ariaBusy true`（启动期间 `<body aria-busy>`）/ `spinner true`（转圈动画开关，false 仅文字）/ `spinnerStyle 'orbit'`（`orbit` 三点轨道 | `ring` 单环旋转）/ `showTitle false`（在动画上方显示站点名，取自页面标题栏站点名）/ `overlayColor ''`（转圈主色，空 = 跟随主题 `--color-s`）/ `fadeMs 380`（收尾淡出时长，同步 CSS 变量 `--loading-fade`）/ `zIndex 3000`（遮罩层级，高于导航/公告）/ `failsafeBufferMs 60`（`maxShowMs` 到点后强制淡出的额外缓冲 ms）。视觉（圆点大小/间距/跳动高度/文案字号/底色透明度/模糊/单环尺寸/标题字号）在 `tuning.json5` → `loading` 分类 — `js/core/boot.js` + `templates/layout.ejs`。

### 3.79 boot — 启动调度

`enabled true`（false = 旧行为：全部模块立即初始化）/ `idleTimeoutMs 800`（`requestIdleCallback` 超时兜底）/ `interactionWake true`（首次点击/按键/触摸/滚轮立即唤醒后续批次，保 INP）/ `log false`（`[boot]` 时间线）/ `budgetMs 40`（每批时间片上限，越大越快但更易长任务；推荐 30-50）/ `heavyMode 'idle'`（重模块时机：`idle` 空闲即启 | `interaction` 等首次交互或兜底 | `immediate` 不等待）/ `idleFallbackMs 120`（无 `requestIdleCallback` 浏览器的回退间隔）/ `interactionEvents ['pointerdown','keydown','touchstart','wheel']`（唤醒事件名列表，可增删如 `scroll`）/ `configTimeoutMs 3000`（外置配置加载超时 ms；构建期经 `window.__CONFIG_TIMEOUT__` 注入、`js/core/runtime.js` 读取，超时降级内联最小子集）。机制：仅 14 个关键模块静态初始化；17 个交互类模块动态导入、按 `budgetMs` 空闲切片加载；重模块（粒子背景/打赏）按 `heavyMode` 时机启动；时间线写入 `window.__BOOT__`（start/critEnd/idleEnd/heavyEnd/budgetMs/heavyMode），完成后置 `window.__APP_READY__`。实测启动后长任务为 0（原两个长任务 238ms+66ms 已消除） — `js/core/main.js` + `js/core/boot.js`。

### 3.80 imageFit — 图片适配（四域）

`enabled true`。**四域**：`content`（正文图片：`upscale 'never'`（默认不放大）| `'cap'` 最多放大 `cap 1.5` 倍 | `'full'` 铺满；`maxHeightVh 0` 限高（如 60=最多 60vh）；`align 'center'|'left'`）· `cover`（封面与卡片：`fit 'cover'|'contain'|'fill'`；`position 'center'|'top'|'bottom'|'left'|'right'` 或自定义 `'50% 30%'` 焦点；`maxHeightVh 0` 封面限高；`aspect ''` 封面宽高比（空 = 模板默认 16/10，如 `'16/9'`、`'21/9'`）；`applyToCards true` 是否同时作用于列表卡片封面）· `gallery`（`stretch false` 小图不再被拉伸（修复旧版变形）| `true` 旧行为；`maxHeightPx 0` 单图限高）· `lightbox`（`fit 'contain'`（默认）| `'actual'` 原始尺寸；`maxWidthPct 92` 最大宽（vw）、`maxHeightVh 82` 最大高）。实现（运行时零 JS）：构建期为图片注入 `data-iw`（自然宽）并在 cap 模式生成 `[data-iw]` 宽度规则；四域分别烘焙为 `--if-*` CSS 变量 — `scripts/build.js` + `templates/layout.ejs` + `scripts/lib/utils.js`。

### 3.81 exportBackup — 备份导出

`enabled true`（总开关）/ `includeMedia true`（打包 `media/` 图片）/ `includeConfig true`（打包 13 个 JSON5 配置）/ `outputDir 'exports'`（输出目录）/ `fileNamePrefix 's-ynapse-backup'`（归档名前缀，实际文件名追加时间戳）。由 `npm run export` 调用：配置 + 文章 + 媒体打包为单一归档，便于迁移与留档 — `scripts/export.js`。

### 3.82 mediaAudit — 媒体审计

`enabled true` / `reportMissed true`（报告文章引用但磁盘缺失的图片）/ `reportUnreferenced true`（报告存在但未被任何文章引用的图片）/ `reportDuplicate false`（报告内容重复的文件，默认关，大站耗时）/ `output 'console'`（报告输出方式）。由 `npm run audit:media` 调用；构建期发现引用缺失会记入构建报告 — `scripts/audit-media.js`。

### 3.83 autoSummary — 自动摘要

`enabled true` / `maxLength 160`（摘要最大字符数）/ `fallback 'firstParagraph'`（front-matter 无 `description` 时的回退取值）/ `stripMarkdown true`（剥离 Markdown 标记再截断）/ `ellipsis '…'`（截断省略号，空则不加）。用于 SEO `<meta name="description">` 与列表摘要 — `scripts/build.js`。

### 3.84 searchEnginePing — 搜索引擎推送

`enabled false`（**默认关闭**）/ `engines ['google']`（推送目标引擎列表）/ `onlyProduction true`（仅生产构建推送，本地构建跳过）/ `timeoutMs 5000`（单次请求超时）。推送失败只写构建日志、不终止构建 — `scripts/build.js`。

### 3.85 ogImage — 自动 OG 图

`enabled true` / `width null` / `height null`（输出尺寸；**null = 自动**：全站文章封面仅 1 张 → 用该图尺寸；多张 → 取面积最大者；0 张 → 1200×630。显式填数字时需 width+height 同时提供，且优先于自动检测；示例 `width: 1200, height: 630`）/ `autoSize { enabled true, maxDimension 2560 }`（自动尺寸开关与长边上限，超限等比缩小）/ `coverFit 'cover'`（有封面时缩放方式：`cover` 裁切填满 / `contain` 完整显示可能留白（jpeg 留白为黑）/ `fill` 拉伸不推荐）/ `overlay { enabled true, wrap 20 }`（封面标题叠层开关与每行最大字符数）/ `format 'png'`（输出格式：`png` 默认无损 / `jpeg` 有损体积更小，`jpg` 视为同义；切换后旧格式文件下次构建自动清理）/ `jpegQuality 82`（`format='jpeg'` 时生效，1–100，越界回退 82）/ `useCover true`（有封面时以封面为底图）/ `gradientForNoCover true`（无封面时生成渐变底）/ `fontScale 0.75`（标题字号相对缩放）。OG 图 URL、`og:image`/`twitter:image`/JSON-LD image 与输出扩展名由 `format` 统一决定；页面 `<meta og:image:width/height>` 由构建期 `lib/og-size.js` 的同一解析结果（`baseData.ogImageSize`）注入，与实际产图尺寸一致（此前硬编码 1200×630）。`serve` 模式跳过生成 — `scripts/generate-og.js` + `scripts/lib/og-size.js` + `scripts/lib/og-format.js` + `templates/layout.ejs`。

### 3.86 hotSearches — 热门搜索

`enabled true` / `top 5`（热门搜索展示条数）/ `storageKey 's-hotSearches'`（最近搜索数组；词频存 `storageKey + ':hot'` 对象，最多保留 50 词）/ `showInDropdown true`（搜索下拉展示「热门搜索」分组；false = 仅最近搜索）/ `showClear true`（提供清空热门词按钮）。数据源为本地搜索历史词频，纯前端、无服务端；搜索时 `saveHistory` 同步累加词频，聚焦/空输入时渲染热门（按词频降序，`__T('search.hot')` 分组标题）— `js/domains/features/search.js`。

### 3.87 readingTime — 阅读时长

`enabled true` / `wordsPerMinuteCJK 250`（中文每分钟字数）/ `wordsPerMinuteLatin 200`（拉丁文每分钟词数）/ `showInMeta true`（文章元信息区展示；false 同时隐藏配置文案与模板内置「分钟阅读」两处，第二轮接线）/ `labelBefore ''` / `labelAfter '阅读约需'`（`labelAfterEn` 为 en 站后缀「 min read」，空回退中文；前/后缀空则回退 `ui-strings` 词典）。CJK 与拉丁字符分别按各自速率估算后相加 — `templates/post.ejs`。

### 3.88 codeCopy — 代码块复制按钮

`enabled true` / `buttonText '复制'` / `copiedText '已复制'`（成功态文案）/ `buttonTextEn ''` / `copiedTextEn ''`（en 站文案，空回退中文/词典）/ `buttonTimeout 1500`（成功态停留毫秒）/ `showLineNumbers false`（行号列）/ `includeWindowBar true`（Mac 窗栏样条）。文案留空时回退 `ui-strings` 词典；运行时按页面语言取 `*En` — `js/domains/core/code-block.js`。

### 3.89 tocScrollSpy — 目录滚动高亮

`enabled true` / `activeClass 'current'`（当前标题对应条目的类名）/ `offset 80`（高亮判定用的顶部偏移像素，通常与固定头部高度一致）/ `throttleMs 60`（滚动监听节流毫秒）。与 `features.toc` 配合，仅负责「当前阅读到哪一节」的高亮 — `js/domains/core/toc.js`。

### 3.90 searchHighlight — 搜索结果高亮

`enabled true` / `markClass 'search-hit'`（高亮标记类名；未接线，见 3.0） / `maxMatches 20`（单页最多高亮处数，防止超长文渲染卡顿）。命中片段在结果列表与正文内以 `<mark>` 标注；`enabled=false` 或 `features.search.highlightMatches=false` 均关闭高亮（第二轮接线） — `js/domains/features/search.js`。

### 3.91 darkImageFilter — 暗色图片滤镜

`enabled true` / `filter 'brightness(0.85) saturate(0.9)'`（暗色模式下的 CSS `filter` 值，可直接填任意合法滤镜串）/ `applyImages true` / `applyVideos true`（是否分别作用于 `<img>` 与 `<video>`）。缓解纯白图在暗色主题下过曝刺眼 — `templates/layout.ejs`。

### 3.92 listCover — 列表封面

`enabled true` / `showOnHome true`（首页卡片）/ `showOnArchive true`（归档列表）/ `fallback 'pattern'`（无封面文章的回退形态：`pattern` 渐变占位块显示标题文字（默认） / `none` 纯文字卡片不渲染占位块；`enabled=false` 时完全隐藏列表媒体区）/ `aspectRatio '21/9'`（列表封面宽高比）/ `lazy true`（懒加载）/ `autoGenerate`（无封面文章构建期自动生成封面，见下）。与 `features.cover`（文章封面样式库）分工：此项控制列表页是否展示封面及其比例 — `templates/index.ejs` + `templates/tag.ejs` + `templates/post.ejs` + `scripts/build/pages.js`。

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

`enabled true` / `items ['home','archive','search','theme']`（底部按钮项列表，按序展示）/ `onlyMobile true`（仅移动端断点内显示）/ `useSafeArea true`（适配 iOS 安全区 `env(safe-area-inset-bottom)`）/ `labelHome ''` / `labelArchive ''` / `labelSearch ''` / `labelTheme ''` / `labelTop ''`（各按钮文案覆盖，空 = 使用 `ui-strings.json5` 的 `bottomNav.*` 词条，主题按钮文案随当前明暗状态动态切换）。层级经 `tuning.zIndex.mobileBottomNav` 调整。与 `features.mobile` 的抽屉菜单互补：底部导航负责高频入口 — `templates/layout.ejs` + `js/domains/core/navigation.js`。

### 3.95 incrementalBuild — 增量构建

**预留开关，当前未实现**；增量构建方案见 `docs/incremental-build-design.md`，站点内容增长到 100+ 篇后再评估实现。键位已预留：`enabled true` / `fullFlag '--full'`（强制全量构建的命令行参数）/ `watch true`（监听源文件变更）/ `fingerprintHash 'sha1'`（指纹算法）/ `skipUnchanged true`（跳过未变化源）。当前构建始终为全量，以上键位不产生实际效果 — `scripts/lib/features-schema.js`（仅登记校验，无运行时实现）。

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
| `headers` | `{}` | 自定义响应头 |
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

独立 UI 参数文件(37 分类 / 269 项,逐项中文注释)。构建时全量注入为 `:root` CSS 变量,命名规则 `--{分类}-{参数}`(如 `--hero-maxWidth`、`--toc-indentL3`)。

**优先级语义**:CSS 类参数已绑定到样式规则并优先于 theme/features 的同名默认值(微调层——改 tuning 值即生效);行为类参数(motion/search/toc/tts/dailyQuote/readingPanel/header 滚动)经 `window.__TUNING__` 注入、运行时优先读取(回退 features);与 features/site 重叠的键已在「tuning 收尾」中全部清理(单一入口归各自模块配置);10 项原「待实现」键已全部接线(导语字号/评论区标记头像与圆角/分隔线/分页窗口省略/标签云字号梯度/系列进度条/打赏弹窗圆角),全部参数均有真实消费点。

**分类(37)**:typography / layout / radius / motion / hero / card / toc / search / reading / comments / header / pagination / stats / breadcrumb / share / prevNext / contactPopup / reward / dailyQuote / tags / series / backToTop / texture / glow / code / icons / morphicons / magazine / commandPalette / announcement / guard / loading / mobileToc / ui / lightbox / toast / zIndex。

**已绑定示例(150 项 CSS + 19 项行为)**:`--hero-maxWidth`、`--zIndex-*`(全站浮层层级,30 项:header/mobileNav/announcement/mobileBottomNav/readingDock/readingGear/readerPanel/mobileToc/mobileTocDrawer/kbdHelp/searchOverlay/navBoostPanel/presetPop/toast/scrollIndicator/readingTip/lightbox/reward/linkWarning/contactPopup/pwaInstall/softnavBusy/grain/guardMenu/guardFlash/guardCurtain/guardLock/guardGate/guardWmOverLightbox/popupNotice；模板以 `var(--zIndex-键, 原值)` 消费)、`--layout-tabletBreakpoint`/`mobileBreakpoint`/`tocHideBreakpoint`/`gridCollapseBreakpoint`(媒体查询断点,经 EJS 直读)、`--radius-default/large/button/avatar`、`--typography-lineHeight/letterSpacing/headingWeight`、`--toast-offsetBottom/borderWidth/radius/maxWidth`、`--breadcrumb-fontSize/gap/marginBottom`、`--card-padding/metaSize/radius`、`--toc-stickyTop`/`--sidebar-stickyTop`(粘性定位)、`--header-iconSize`、`--share-gap`、`--header-scrolledHeight/hairlineStrength`、`--code-borderWidth/borderMix/windowDotSize`、`--texture-noiseOpacity`、`--glow-heroStrength`、`--card-imageHoverScale/excerptLines/gridGap`、`--motion-transitionTiming/buttonPressScale`、`--reading-quoteTint/imageHoverScale/h2AccentWidth/Height/dockRight/dockBtnSize/dockRightTablet/dockBottomTablet/gearBottom/gearMobileBottom/panelBottom/panelWidth/dockMobileBottom`、`--search-overlayPadding/modalPadding/modalMaxHeight/closeBtnSize`、`--mobileToc-btnBottom/btnRight/btnMobileBottom/btnMaxWidth/labelMaxWidth`、`--ui-errorSvgMaxWidth/errorSuggestMaxWidth/errorCodeFontSize`、`--lightbox-btnSize/btnOffset`、`--pagination-btnMinWidth/btnHeight`、`--backToTop-hiddenOffset`、`--commandPalette-listMaxHeight`、`--layout-articlePadding`;行为侧:search 历史/热词/去抖/结果上限/空文案(`search.emptyTextEn` 为 en 站空结果文案,空回退 `emptyText`)、toc 滚动偏移与默认折叠、tts 语速/音调、dailyQuote 作者显示/每日刷新、readingPanel 字号/行距步进、morphicons 弹簧刚度/阻尼/轻量版弹簧。

**注意**:绑定值均已对齐现有视觉(如 toast.radius=999px 对应胶囊形),修改前建议先在浏览器 DevTools 中试值。

---

## 11. guard.json5 — 防护与交互控制域

第 13 个配置文件（11 个模块 / 171 项，统计口径：对象逐层展开、数组元素逐项计入；逐字段中文注释：作用/类型/可填值/不可填值原因/推荐值/注意）。仅在 `features.guards.enabled !== false` 时注入 `window.__GUARD__`，客户端按 preset 懒加载对应模块（`js/domains/guard/`），未启用模块零加载零开销。

**结构**：
- `core`（8 项）：`preset 'soft'` / `bypass.localhost false` / `bypass.queryParam 'guard'` / `bypass.storageFlag 's-guards-off'` / `logLevel 'off'` / `respectEditable true` / `i18nFallbackLang 'zh'` / `edgePadding '8px'`。绕过优先级：URL 参数 > localStorage 标志 > localhost（开启时）。`?guard=`（含 `?guard=off`）在绕过判定完成后由 `history.replaceState` 从地址栏移除（保留其它查询串与 hash），参数名跟随 `bypass.queryParam`。
- `contextMenu`（35 项）：`enabled` / `revokeDelayMs 3000`(下载后释放 Blob URL 延迟 ms) / `translateUrl`(划词翻译模板，`{lang}`/`{text}`；空=隐藏翻译项) / `disableNative` / `trigger.longPress`+`longPressMs 550` / `searchFocusDelayMs 60`(「搜索所选文字」打开搜索后聚焦输入框延迟 ms) / `behavior.closeOnEsc|closeOnScroll|closeOnOutside|closeOnBlur` / `style.width|radius|blur|animMs|shadowOpacity`（width/radius 留空=走 `tuning.json5` → `guard` 分类）/ `showOn.selection|link|image|code|blank` / `builtin.*`（copy/copyLink/openNewTab/searchSelected/translate/backToTop/toggleTheme/print/copyCode/copyRaw/download；`viewSource`/`inspect` 默认关）/ `items[]` 自定义项（`label`/`labelEn`/`icon`/`url`|`action`/`selector`；自定义动作派发 `guard:menu-action` 事件）/ `excludeSelectors[]` / `ariaLabel`。
- `copyGuard`（18 项）：`mode 'attribution'`（`off` | `attribution` 追加出处 | `weakBlock` 首次拦截并提示、再次放行 | `block` 硬拦截）/ `attribution.text`+`textEn`（占位符 `{title}{url}{author}{site}`）/ `position after|before` / `separator` / `minChars 40`（短复制不打扰）/ `onlyArticles true` / `allow.codeBlocks true`+`allow.selectors[]`（代码块与可编辑区始终放行）/ `block.toast|toastText|flash`（复用统一 `__toast`）/ `extra.alsoCut|imageNotice|iOSOverride` / `noticeOncePerSession true` / `logCopyEvents false`（仅本地 console，无网络上报）/ `flashRemoveMs 600`(闪烁遮罩移除延迟 ms)。
- `selectionGuard`（7 项，**默认关**）：`mode 'content'`（`allow` | `content` 正文禁选 | `strict` 全域）/ `allowSelectors[]`+`allowCode true`（代码白名单）/ `allowCtrlA|allowShiftArrows true`（保留键盘选择，无障碍优先）/ `noticeToast|noticeText`。实现：CSS `user-select:none`（正文/全域）+ `selectstart` 事件双保险，输入框与代码始终豁免。
- `hotkeyGuard`（12 项，**默认关**）：`keys.f12|ctrlShiftI|ctrlShiftJ|ctrlShiftC` 默认拦截；`ctrlU|ctrlS|ctrlP` 默认放行（分别与查看源码/保存网页/打印冲突，可按需开启）（macOS 自动等效 Cmd）/ `keys.printScreen false`（仅检测提示）/ `keys.custom[]`（`'ctrl+alt+x'` 语法）/ `noticeToast|noticeText|noticeOncePerSession`。仅拦键盘路径（浏览器菜单/独立窗口不可拦，威慑级），输入框豁免。
- `watermark`（18 项，**默认关**）：`type 'diagonal'`（`fixed`|`tiled`|`diagonal`）/ `text|textEn`（`{site}{date}{time}{id}`）/ `identity 'none'`（`none`|`random`|`storage` 本地短哈希，无指纹）/ `opacity 0.06` / `fontSize` / `color`（空=主题次级色）/ `rotate -22` / `gapX|gapY` / `position`（fixed 专用）/ `zIndex 40` / `hideOnPrint true` / `showInLightbox false` / `mobileEnabled false` / `animate false`（缓慢漂移，尊重减少动效）。`pointer-events:none` + `aria-hidden`，不挡交互。
- `devtoolsDetect`（15 项，**默认关**）：`methods.sizeDiff|timingDebugger`（停靠尺寸差 / `debugger` 计时）/ `intervalMs 1500`（下限 1000）/ `thresholdSizePx 160` / `thresholdTimingMs 120` / `action 'notice'`（`none`|`notice`|`blurPage`|`lockOverlay`|`reload`，锁屏自带关闭键；`reload` 带会话熔断——每会话最多触发一次，避免尺寸误报导致无限刷新）/ `lockTitle|lockText`（空 = 走 `ui-strings.json5` 的 `guard.lockTitle`/`guard.lockText`，按页面语言中英自动切换；填固定文本会覆盖 i18n）/ `reloadDelayMs` / `pauseWhenHidden` / `logDetect`；命中时派发 `guard:devtools` 事件（供 consoleGuard 联动清屏）。检测非 100%（窗口缩放等会误报），仅威慑。
- `consoleGuard`（18 项，**默认关**）：`bannerEnabled|bannerText|bannerTextEn|bannerAscii`（控制台站方留言）/ `clearEnabled|clearIntervalMs|clearOnDetect`（周期清屏与检测联动）/ `muteEnabled|muteMethods[]|muteFreeze`（对页面脚本伪装 console 方法）/ `trapEnabled|trapAction|trapText`（console.log 访问陷阱）/ `hideSelfLogs` / `noticeOncePerSession`。无法拦截真实控制台求值，仅作用于页面上下文。
- `privacyCurtain`（10 项，**默认关**）：`blurOnBlur`（窗口失焦）/ `blurOnVisibility`（切标签）/ `blurAmount '8px'` / `curtainText|curtainTextEn`（帘上文案）/ `revealDelayMs 200`（恢复去抖）/ `prtScNotice|prtScText|prtScOncePerSession`（PrintScreen 仅检测提示）。`backdrop-filter` 静态遮罩 + `pointer-events:none`，不挡交互。
- `tamperWatch`（19 项，**默认关**）：`scripts.monitor|action`（动态 `<script>` 注入；action `toast`|`remove`|`report`）+ `scripts.allowPathPrefixes[]`（同源路径前缀白名单，默认 `['/pagefind/']` 豁免 Pagefind 索引脚本，置 `[]` 关闭）/ `attrs.monitor`（动态内联事件）/ `iframes.monitor|action` / `prototype.watch`（fetch/XHR/eval 原型替换，周期比较）/ `dom.monitor|targets[]`（关键节点缺失检测）/ `probeIntervalMs 2000` / `reportEndpoint ''`（默认不上报；自定义跨域端点需加入 CSP `connect-src`，否则会被静默拦截）+ `reportTimeoutMs 5000`（上报超时 ms，1000–30000） + `reportThrottleMs 10000`（上报节流窗口 ms，0 关闭，上限 60000）+ `reportPrivacyMode true`（仅事件类型，URL 去除查询串）/ `cspViolationToast` / `noticeOncePerSession` / `logDetect`。页面级监视可被先行关闭，属异常发现而非安全边界。
- `accessGate`（12 项，**默认关**）：`password.enabled|hash|salt|rememberHours|title|placeholder|errorText`（SHA-256(salt+密码) 十六进制，`crypto.subtle` 校验）/ `focusDelayMs 50`(解锁后聚焦密码框延迟 ms)/ `paths[]`（路径前缀，空=全站）/ `viewsPerDay|viewsAction`（本地限次，`toast`|`lock`）/ `unlockCodes[]`（`?key=` 永久解锁本机；解锁逻辑读取完成后 `history.replaceState` 清除地址栏参数，保留其它查询串与 hash）/ `logDetect`。诚实声明：静态站密码为软防护（哈希在前端源码中可离线分析），敏感内容请用 Cloudflare Access 等后端方案。

**测试**：`.tmp-scripts/verify-guard-p1.js` 17 项 + `verify-guard-p2.js` 20 项 + `verify-guard-p3.js` 11 项 + `verify-guard-p4.js` 13 项断言（P1：原生菜单拦截、菜单项与上下文匹配、Esc/输入框豁免、复制署名改写、代码块放行、`?guard=off` 完全绕过、block 拦截+toast；P2：选择拦截/代码放行/可编辑豁免、F12 与 Ctrl+Shift+I 拦截+提示、Ctrl+A 保留、水印三模式与默认关反例；P3：检测提示/锁屏与关闭键、控制台静音（页面脚本无输出）、隐私帘显示/恢复与默认关反例；P4：门槛显示/错误提示/正确解锁与会话记忆/解锁码/限次锁定、脚本注入与关键节点缺失提示、默认关反例）；界面截图已目检（明暗菜单、拦截提示、对角/固定角水印、锁屏、隐私帘、访问门槛） — `js/domains/guard/{core,context-menu,copy-guard,selection-guard,hotkey-guard,watermark,devtools-detect,console-guard,privacy-curtain,tamper-watch,access-gate}.js`。

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
- `popupNotice`（弹窗公告）：`enabled false`(总开关) / `delayMs 1500`(延迟弹出) / `frequency 'day'`(`session|day|always`，内容未变时频率) / `reshowOnChange true`(内容变化后重弹) / `storageKey 's-popupNotice'` / `width '440px'` / `title`/`titleEn` / `body`/`bodyEn`(空行分段，纯文本渲染) / `image`/`imageAlt`/`imageAltEn` / `qr{enabled,src,caption,captionEn}` / `buttons[]`(每项 `{label,labelEn,url,style:primary|ghost,newTab}`) / `closeButton{enabled,label,labelEn,style}` / `closeIcon true`(右上角 ×) / `closeOnBackdrop true` / `escToClose true` / `colors{overlay,background,text,textSecondary,border,primary,primaryText,ghost}`(留空跟随主题变量)。构建期由 `scripts/lib/popup-notice-config.js` 校验；启用但无任何内容仅告警。
- `softNavigation`（软导航）：`enabled true`(总开关) / `toggle { show true, defaultOn true, storageKey 's-soft-nav' }`(页内开关，位于「页面加速」面板) / `prefetchOnHover true`(悬停预取目标页 HTML) / `prefetchDelayMs 80` / `cacheTtlMs 300000`(内存缓存有效期，前进/后退复用) / `timeoutMs 10000`(fetch 超时即回退) / `viewTransition true`(同文档过渡动画) / `excludeSelectors ['[data-no-soft-nav]','.no-soft-nav']`(不拦截的链接) / `scrollToTop true`。仅拦截同源、同语言段（`/zh/` 或 `/en/`）、非资源文件的左键链接；跨语言、外部链接、下载、`target=_blank`、仅 hash 跳转均走原生导航；任何异常（超时/目标结构缺失/交换报错）自动回退 `location.href` 整页跳转。页面级模块经 `window.__SOFTNAV_HOOKS__` 注册重绑；`window.__softNav` 提供 `isOn/setOn/navigate` 调试句柄。注意：CF Web Analytics 信标只在文档加载时计数，软导航不产生新的页面浏览记录（如需 SPA 级统计请关闭软导航或自行接埋点）。
