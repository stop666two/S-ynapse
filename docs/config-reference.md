# S-ynapse 配置文件完整参考

> 全部配置文件位于项目根目录,采用 **JSON5**(支持注释与单引号/无引号键)。
> 构建时自动加载+深度合并;缺省任意字段时使用与本站行为一致的内置默认值。
> 配置文件语法错误(缺逗号、引号未闭合等)会**立即终止构建**,并输出:文件名+行列+上下文+原因+修复提示。
> 本文是逐字段权威参考。字段左侧符号:`=默认`(内置)/`必填`(缺失即报错)。

---

## 目录
1. [site.json5 — 站点主体](#1-sitejson--站点主体)
2. [theme.json5 — 视觉与主题](#2-themejson--视觉与主题)
3. [features.json5 — 功能总控(54 模块)](#3-featuresjson5--功能总控54-模块)
4. [navigation.json5 — 导航](#4-navigationjson--导航)
5. [sidebar.json5 — 侧栏](#5-sidebarjson--侧栏)
6. [footer.json5 — 页脚](#6-footerjson--页脚)
7. [security.json5 — 安全](#7-securityjson--安全)
8. [content-policy.json5 — 内容策略](#8-content-policyjson--内容策略)
9. [tag-aliases.json5 / friends.json5 — 可选数据文件](#9-tag-aliasesjson--friendsjson--可选数据文件)
10. [tuning.json5 — UI 微调参数层](#10-tuningjson5--ui-微调参数层)

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
| `author` | string | `''` | 作者名 |
| `email` | string | `''` | 作者邮箱 |
| `url` | string | `http://localhost` | `必填` 站点根 URL(必须以 http:// 或 https:// 开头) |
| `language` | string | `en` | 页面语言(如 zh-CN,影响日期/朗读) |
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

### site.seo — SEO
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `seo.metaKeywords` | array | `[]` | meta keywords |
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
| `social.items.<key>.popupContent` | string | 值 | 弹窗说明文案 |

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

### site.pwa / site.build — PWA 与构建开关
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `pwa.enabled` | bool | `false` | 生成 manifest/sw.js |
| `pwa.manifest` | object | `{}` | manifest 字段 |
| `pwa.serviceWorker` | string | `/sw.js` | SW 路径 |
| `build.cleanDist` | bool | `true` | 构建前清空 dist |
| `build.minifyHTML/CSS/JS` | bool | `false` | 压缩开关 |
| `build.removeConsole` | bool | `false` | 剥离 console.* |
| `build.generateIndex/Archive/Tags/Categories/Gallery` | bool | `true` | 页面生成开关 |
| `build.generateAuthorPages` | bool | `false` | 作者页 |
| `build.copyStatic` | bool | `true` | 复制 static/ |
| `build.optimizeMedia` | bool | `false` | sharp 媒体优化 |
| `build.mediaQuality` | number | `85` | 压缩质量 |
| `build.mediaResponsiveSizes` | array | `[640,1024,1920]` | 响应式宽度档位 |
| `build.mediaFormats` | array | `['webp','original']` | 输出格式(可含 avif) |
| `build.avif.enabled` | bool | `false` | AVIF 输出 |
| `build.avif.quality` | number | `50` | AVIF 质量 |
| `build.avif.effort` | number | `6` | AVIF 编码努力(0-10) |
| `build.lazyLoadImages` | bool | `true` | loading=lazy |
| `build.useSrcset` / `usePictureTag` | bool | `true` | 响应式标签 |
| `build.searchFullContent` | bool | `true` | 搜索索引含正文 |
| `build.relatedArticles` | bool | `true` | 相关推荐 |
| `build.cjkSpacing` | bool | `true` | 中英文间细空格 |
| `build.buildReport` | bool | `true` | build-report.html |
| `build.autoOgImage` | bool | `true` | 自动 OG 图 |
| `build.forceContentWidth` | bool | `true` | 主内容强制宽高布局 |
| `build.enableCacheBusting` | bool | `false` | MD5 缓存戳 |
| `build.cacheBustingPattern` | string | `.*\.(css\|js\|png\|jpg\|svg)$` | 戳名模式 |
| `build.externalLinksTarget` / `externalLinksRel` | string | `_blank` / `noopener noreferrer` | 外链属性 |

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
| `reward.wechat.image/url/label` | — | — | 微信收款二维码/链接 |
| `reward.alipay.*` | — | — | 支付宝 |
| `reward.custom[]` | — | `[]` | 自定义(`{label,image,url}`) |
| `webAnalytics.enabled` | bool | `true` | CF Web Analytics |
| `webAnalytics.token` | string | `''` | 令牌(或环境变量 CF_WEB_ANALYTICS_TOKEN) |
| `showRepoLink` | bool | `true` | 显示仓库链接 |
| `repoUrl` | string | `''` | 仓库 URL |

---

## 2. theme.json5 — 视觉与主题

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `colors.primary` | string | `#2d3748` | 主色(标题/高亮) |
| `colors.secondary` | string | `#4a90d9` | 次色(链接/强调) |
| `colors.accent` | string | `#e53e3e` | 强调色(危险/徽标) |
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
| `spacing.containerWidth` | string | `960px` | 容器宽度 |
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
| `customCSS` | object | `{}` | 注入 CSS |
| `externalAssets.styles/scripts` | array | `[]` | 额外 CSS/JS（Prism 高亮脚本由构建本地注入；字体样式由 fontSystem 自动追加） |
| `contentOffset` | number | `0` | 内容偏移 |
| `headerContentGap` | number | `0` | 头内容间隙 |
| `tocWidth` | string | `200px` | 目录宽 |
| `sidebarWidth` | string | `280px` | 侧栏宽 |
| `tocMinLeft` / `sidebarMinRight` | string | `10px` | 边界 |

---

## 3. features.json5 — 功能总控(38 模块)

**加载规则**:可选文件;缺失时使用内置默认(与文件内容一致的当前行为)。
**合并规则**:数组字段(share.order 等)为用户覆盖,不拼接;一切字段均可缺省。
**校验**:每个模块必须是对象;enabled 必须是布尔;枚举字段(如 heatmap.scaling)非法值直接报错终止构建。

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
| `closeOnBackdrop` | `true` | 点遮罩关闭 |
| `showCounter` | `true` | N / M 计数器 |
| `counterFormat` | `{current} / {total}` | 计数模板 |
| `maxWidthVw` / `maxSizePx` / `maxHeightVh` | `92`/`1600`/`82` | 图片约束 |
| `openDurationMs` / `switchDurationMs` | `180`/`120` | 动画时长 |
| `backdropOpacity` | `0.9` | 遮罩透明度 |
| `preloadAdjacent` | `true` | 预载相邻图 |
| `rememberPosition` | `false` | 记忆上次位置 |

### 3.2 readingProgress — 阅读进度条
`enabled true` / `articleOnly true` / `clickToJump true` / `showDot true` / `dotSize 10px` / `barHeight 3px` / `useGradient true` / `gradientStart var(--color-s)` / `gradientEnd var(--color-a)` / `tipDisplayMs 500` / `updateThrottleMs 30` / `ariaAnnounce true` / `topOffset 0`

### 3.3 backToTop — 返回顶部
`enabled true` / `showAfterPx 400` / `rightOffset 2rem` / `bottomOffset 2rem` / `size 44px` / `scrollDurationMs 450` / `smoothScroll true` / `hotkey ''` / `htmlAnchorFallback false`

### 3.4 search — 客户端搜索
`enabled true` / `minChars 1` / `maxResults 30` / `highlightMatches true` / `showCount true` / `placeholder 搜索...` / `emptyHint 输入关键词开始搜索` / `noResultText 未找到匹配内容` / `excerptLength 120` / `includeContent true` / `matchTags true` / `matchCategories true` / `weightTitle 5` / `weightExcerpt 2` / `weightContent 1` / `closeOnOverlay true` / `focusOnOpen true` / `openAnimation fade` / `pinyinFuzzy false`

### 3.5 imageLazy — 懒加载
`enabled true` / `fadeIn true` / `fadeInDurationMs 300` / `placeholderColor var(--color-hover)` / `preserveAspectRatio true` / `loadingClass img-loading`(加载中占位 class) / `errorClass img-error`(加载失败 class) / `eagerFirst 3`(前 N 张图立即加载,不懒加载)

### 3.6 codeBlock — 代码块
`enabled true` / `copyButtonVisibility hover`(`hover|always|never`) / `copySuccessText 已复制` / `copyFailText 复制失败` / `showLanguageTag true` / `lineNumbers false` / `wrapLongLines false` / `highlightBackground var(--color-hover)` / `borderRadius 0.375rem` / `maxHeight ''` / `copyAllButton false` / `downloadButton false`

### 3.7 externalLink — 外链拦截
`enabled true`(需 site.externalLinkWarning.enabled 同真) / `whitelist []` / `blacklist []` / `mode warn`(`warn|prohibit|hint`) / `message 即将离开本站,前往外部链接：` / `confirmText 继续访问` / `cancelText 返回` / `showFullUrl true` / `openInNewTab true` / `whitelistNewTab false` / `copyButtonText 复制`

### 3.8 themeToggle
`enabled true` / `defaultTheme system` / `rememberChoice true` / `animationMs 250` / `iconStyle sun-moon` / `transitionAll true` / `persistKey ss-theme`(主题选择的 localStorage 键) / `toggleIconSwap true`(切换时交替太阳/月亮图标) / `zIndex 100`(按钮 CSS z-index)

### 3.9 shortcuts — 快捷键
`enabled true` / `openSearch /`(空=禁用,下同) / `toggleTheme d` / `prevPost k` / `nextPost j` / `help ?` / `close Escape` / `showHelpHint true` / `helpTitle 快捷键一览` / `showHelpTable true` / `ignoreInInputs true`

### 3.10 toc — 目录(桌面侧)
`enabled true` / `minLevel 2` / `maxLevel 4` / `collapsible true` / `defaultOpenLevel 2` / `highlightActive true` / `activeOffset 120`

### 3.11 mobileToc — 移动目录抽屉
`enabled true` / `borderRadius 1rem` / `maxHeightVh 70` / `autoClose true` / `overlayClose true` / `lockScroll true` / `position right`。移动端目录抽屉;显示断点由 `mobile.tocBreakpoint` 控制。

### 3.12 readingPanel — 阅读设置面板
`enabled true` / `fontSizeMin 15`/`fontSizeMax 26`/`fontSizeStep 1`/`fontSizeDefault 19` / `lineHeightMin 1.4`/`LineHeightMax 2.6`/`Step 0.1`/`Default 1.9` / `widthMin 560`/`widthMax 1200`/`Step 40`/`Default 800` / `remember true` / `storageKey readerPrefs` / `resetText 重置` / `position right`

### 3.13 readMode — 阅读模式
`enabled true` / `persist true` / `label 阅读模式` / `focusOnlyContent true` / `fontScale 1`

### 3.14 tts — 朗读
`enabled true` / `rate 0.5`(0.1~10) / `pitch 1` / `volume 1` / `preferDefaultVoice true` / `voiceBy lang` / `readSelector .post-content` / `icon speaker` / `highlightParagraph false` / `position toolbar`

### 3.15 wikiLinks — 双链
`enabled true` / `unknownMode text`(`text|link|hide`) / `unknownSuffix ''` / `openNewTab false` / `caseInsensitive true` / `allowCustomLabel true`

### 3.16 supSub — 上下标
`enabled true` / `supMarker ^` / `subMarker ~` / `skipInsideMath false` / `preserveUnmatched true`

### 3.17 math — KaTeX
`enabled true` / `autoDetect true` / `version 0.16.22` / `inlineDelimiters ['$']` / `blockDelimiters ['$$']` / `throwOnError false` / `strict false` / `renderRoundParens true` / `renderSquareBrackets true` / `selector .post-content` / `mathml true`

### 3.18 mermaid
`enabled true` / `autoDetect true` / `version 11.4.1` / `followTheme true` / `lightTheme default` / `darkTheme dark` / `securityLevel strict` / `copyAfterRender false` / `errorText [图表渲染失败]`

### 3.19 series — 系列
`enabled true` / `showBadge true` / `badgeFormat 系列 · {name}` / `showNavPanel true` / `sidebarWidget true` / `order asc` / `panelTitle 本系列共 {total} 篇` / `showPosition true` / `defaultWidgetCount 8` / `prevLabel 上一篇` / `nextLabel 下一篇` / `progressLabel {index} / {total}`(进度模板) / `sidebarTitle 系列`(侧栏 widget 标题,sidebar.json5 w.title 为空时使用)

### 3.20 related — 相关推荐
`enabled true` / `topN 4` / `sameCategoryWeight 2` / `sameTagWeight 3` / `minScore 2` / `excludeCurrent true` / `title 相关推荐` / `showExcerpt true`(卡片显示摘要) / `excerptLength 80`(摘要截断长度) / `showCount false`(显示共享标签数徽章)

### 3.21 pinned — 置顶
`enabled true` / `badgeText 置顶` / `badgeStyle pill`(`pill|corner|none`) / `sortRule pinned-first`(`pinned-first|normal`)

### 3.22 wordCount — 字数
`enabled true` / `onCards true` / `inArticle true` / `textFormat {count} 字` / `readTimeFormat {minutes} 分钟阅读` / `wpm 265` / `countCjkChars true` / `countDigits false`

### 3.23 share — 分享
`enabled true` / `order ['weibo','qq','wechat','x','facebook','mail','copy']`(顺序即显示顺序) / `position toolbar` / `popupWidth 640` / `popupHeight 520` / `wechatText {title} 分享自 {url}` / `copiedText 链接已复制` / `copiedShowMs 2500` / `showLabel false` / `label 分享文章` / `useNativeShare false`(支持 navigator.share 时优先原生分享) / `copyFallback true`(剪贴板 API 不可用时 textarea 回退)

### 3.24 reward — 打赏前端
`enabled false`(需 site.reward.enabled) / `buttonText 打赏` / `note 感谢支持` / `popupTitle 打赏支持` / `closeByBtn true` / `closeByOverlay true` / `closeByEsc true` / `qrSize 180px` / `maxWidth 560px` / `showNote true`(显示打赏说明文字) / `qrMaxWidth 180px`(二维码最大宽度 CSS) / `closeText 关闭`(关闭按钮文本)

### 3.25 gallery — 图库页
`enabled true` / `title 图库` / `description 站内图片集，点击查看大图。` / `emptyText 暂无图片` / `columns 4` / `columnMin 220px` / `showSource true` / `collectFeatured true` / `order newest` / `incrementalByDefault true` / `maxItems 0`(0=不限) / `gap 12px`(瀑布流列间距 CSS) / `showCaption true`(图片下方显示来源说明) / `borderRadius 8px`(卡片圆角 CSS)

### 3.26 heatmap — 归档热力图
`enabled true` / `levels 5`(2~7) / `scaling auto`(`auto|fixed`) / `palette []`(fixed 时色表) / `showLegend true` / `legendLow 少` / `legendHigh 多` / `tooltipFormat {year}-{month}: {count} 篇` / `showMonthNumbers true` / `gap 3px`(单元格间距) / `borderRadius 3px`(单元格圆角) / `cellSize 13px`(单元格尺寸,置空则撑满容器) / `emptyColor var(--color-border)`(空月份颜色)

### 3.27 stats — 站点统计
`enabled true` / `showArchiveCards true` / `labelPosts 文章总数` / `labelDays 发文天数` / `labelWords 总字数` / `labelAvg 日均篇数` / `labelAvgPerDay 日均`(归档页日均标签) / `labelTags 标签数` / `labelCategories 分类数` / `cardColumns auto-fit`(统计卡列模式,也可固定列数) / `showSidebar true`(侧栏统计 widget 开关,sidebar.json5 需含 type=stats) / `linkArchive /archive/`

### 3.28 prevNext
`enabled true` / `showLabels true` / `prevLabel 上一篇` / `nextLabel 下一篇` / `hideWhenMissing false` / `showThumbnail false`(导航卡缩略图) / `labelPosition left`(`left|center|right`) / `scrollToTopOnClick true`(点击导航后滚回顶部)

### 3.29 feed — 订阅
`rssEnabled true` / `rssPath /feed.xml` / `rssFullContent true` / `rssMaxItems 50` / `jsonFeedPath /feed.json` / `jsonFeedFullContent false` / `jsonFeedMaxItems 20` / `injectHeadLinks true` / `injectFooterLink false`

### 3.30 analytics
`enabled true` / `scriptSrc https://static.cloudflareinsights.com/beacon.min.js` / `injectAt body` / `emitBeacon true` / `siteTag ''`

### 3.31 redirects
`enabled false`(规则在 site.json5 redirects) / `generatePagesFile true` / `applyInServe true` / `invalidRule abort`(`warn-only|abort`)

### 3.32 maintenance
`enabled false` / `message 站点维护中，请稍后再来。` / `status 503` / `setRetryAfter true` / `retryAfter 3600`

### 3.33 mobile
`enabled true` / `searchFullscreen true` / `buttonStackGap 4rem` / `touchFallback true` / `codeScrollHint true` / `tocBreakpoint 768`(移动端 TOC 按钮断点 px) / `safeAreaBottom true`(底部安全区留白) / `tapHighlight false`(取消点击高亮)

### 3.34 comments 前端
`enabled true` / `loadContainer true` / `renderPlaceholder true` / `placeholderText 评论加载中…`(占位文案) / `loadDelayMs 300`(占位显示时长 ms,过后无组件则显示 emptyText) / `emptyText 暂无评论`(无评论提示) / `title 评论`

### 3.35 contactPopup
`enabled true` / `title 联系方式` / `copyText 复制` / `copySuccessText ''`(复制成功提示,留空用内置双语文案) / `popupWidth 360px` / `showAllItems true` / `showIcon true`(弹窗顶部图标) / `maxItems 4`(最多联系方式条目数,多行值按行截断)

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
`enabled false`(默认关) / `darkFrom '22:00'` / `lightFrom '06:00'` / `respectManualOverride true` / `applyInstantly true` / `checkIntervalMs 60000` / `smoothTransition true`。按固定每日时段自动切主题,检查周期以毫秒计(默认 60000 = 每分钟);smoothTransition 开启时切换瞬间给 html 加 `theme-switching` 类,300ms 过渡动画。

### 3.42 readDock — 移动端阅读侧栏
`enabled true` / `showProgressRing true` / `showTocButton true` / `showTopButton true` / `hideOnScrollDown true` / `position right`。移动端右下角的进度环 + 回目录 + 回顶按钮。

### 3.43 sidebarDrag — 侧栏拖拽重排
`enabled true` / `persistOrder true` / `storageKey 's-sidebarOrder'` / `touchLongPress true` / `showHandleOnHover true` / `resetOnLoadFail true`。用户可拖拽侧栏 widget 重排顺序,存储于 localStorage;移动端长按 500ms 触发。

### 3.44 ogImageStyle — 社交卡片样式
`enabled true` / `pattern 'gradient'` / `preview true` / `preferImage true`。自动生成 OG 图片(基于文章卡片),与 site.seo.ogImage 联动。

### 3.45 hero — 首页 Hero
`enabled true` / `showSearch true` / `showTags true` / `tagCount 5` / `showDate false`(显示最新文章日期) / `ctaLabelEn View all posts`(en CTA 文案) / `heightVh 60`(Hero 最小高度 vh) / `backgroundImage ''`(背景图 URL,空则纯色/渐变)。首页顶部横幅,显示标题简介+搜索+热门标签。

### 3.46 background — 背景特效
`enabled false` / `pattern 'none'` (particles/grid/dots/mesh) / `intensity 'medium'` / `reducedMotion false`。站点背景特效(粒子/网格/圆点/网格渐变)。

### 3.47 motion — 滚动动效
`enabled true` / `ease cubic-bezier(.4,0,.2,1)` / `pageEnterDurationMs 240`(页面入场时长 ms) / `cardHoverScale 1.02`(卡片悬停缩放) / `linkUnderlineOffset 3px`(下划线偏移) / `cardHoverLift true` / `cardHoverLiftPx 4` / `linkUnderline true` / `linkUnderlineThickness 2px` / `buttonRipple true` / `rippleDurationMs 500` / `scrollReveal true` / `revealCards true` / `revealHeadings true` / `revealImages true` / `revealBlocks false` / `revealDurationMs 250` / `revealDelayMs 0` / `revealStaggerMax 80` / `revealOffset 10px` / `revealOnce true` / `revealThreshold 0.08` / `respectReducedMotion true`。滚动渐入/悬停上浮/涟漪/下划线动效总控。

### 3.48 dailyQuote — 每日一言
`enabled true` / `widgetStyle 'sidebar'` / `label '每日一言'` / `source 'builtin'` / `count 7` / `quoteColor ''`。侧栏每日名言(内置 7 条,按日期轮换)。

### 3.49 favorites — 收藏(纯前端)
`enabled true` / `position 'toolbar'` / `storageKey 's-favorites'` / `label '收藏'` / `listIcon true` / `notText '收藏'` / `favedText '已收藏'`。文章收藏按钮+收藏页(仅 localStorage,无后端);按钮切换收藏/取消(状态+aria-pressed+统一 toast)、收藏页列表渲染与移除、空状态;en 页文案经 ui-strings 词典。

### 3.50 prismTheme — 代码高亮配色开关
`enabled true`。总开关：关闭后代码块不着色（回退纯文本）；token 配色值定义在 `theme.json5` 的 `codeHighlight.palette`（浅色/暗色两套，随主题自动切换）。

### 3.51 cover — 封面样式库
`enabled true` / `patterns[]` (gradient/stripes/dots/blob/mesh) / `defaultPattern 'gradient'` / `preview true` / `preferImage true`。文章封面样式库(渐变/条纹/圆点/气泡/网格),在线预览。

### 3.52 i18n — 内容级双语
`enabled false` / `defaultLanguage 'zh'` / `languages[] ('zh','en')` / `navToggle true`。**内容级双语**:文章存于 `articles/zh/` 与 `articles/en/` 双目录,URL 带语言前缀(`/zh/slug/`、`/en/slug/`),每语言生成完整站点(首页/文章/归档/标签/分类/搜索/RSS/sitemap/search-index),根路径 `/` 按浏览器语言跳转(localStorage `s-ss-lang` 记忆)。界面文案经 `ui-strings.json5` 词典 + 服务端 `ui()` / 运行时 `__T()` 双语渲染;导航/页脚/侧栏/主题预设支持 `labelEn`/`titleEn` 字段。

### 3.53 pagefind — Pagefind 全文搜索
`enabled true` / `indexPath '/pagefind'` / `integrate true`。使用 Pagefind 的离线全文搜索(search.provider='pagefind' 时生效,构建生成索引)。

### 3.54 giscus — Giscus 评论
`enabled false`(默认关) / `repo ''` / `repoId ''` / `category 'Announcements'` / `categoryId ''` / `mapping 'title'` / `theme 'preferred_color_scheme'` / `loading 'lazy'` / `crossorigin 'anonymous'`。与 site.comments(provider='giscus')联动——两者都必须配置才显示。

### 3.55 scrollBehavior — 滚动行为
`enabled true` / `behavior 'smooth'`(`smooth|auto`) / `anchorOffset '18px'`(锚点额外偏移,最终 scroll-padding-top = calc(var(--hh) + 该值)) / `respectReducedMotion true`(reduced-motion 时降级 auto)。统一接管全站平滑滚动(CSS scroll-behavior + JS 滚动调用经 `__SB()`);原 theme.animation.scrollBehavior 已移除。

### 3.56 toast — 统一轻提示
`enabled true` / `position 'bottom-center'`(`bottom-center|top-center|top-right|bottom-right|top-left|bottom-left`) / `durationMs 2500` / `maxVisible 3`。统一 `window.__toast(msg,{type,duration})` API;内置 info/success/warning/error 四类(无需配置);分享复制与联系复制已迁移到统一 toast(原内联提示元素移除)。

### 3.57 breadcrumb — 面包屑导航
`enabled true` / `separator '›'` / `showHome true` / `showCurrent true`。所有页面(首页与 404 除外)顶部显示;文章页层级:首页 › 分类 › 标题(与 JSON-LD 结构化数据一致);列表页:首页 › 归档/标签/分类/搜索/收藏/图库/友情链接;自定义页:首页 › 标题。

### 3.58 pageTransition — 页面切换过渡
`enabled true` / `type 'slide'`(`slide|fade`) / `durationMs 180`(入场) / `outDurationMs 120`(离开淡出) / `respectReducedMotion true` / `excludeSelector '[data-no-transition]'`。内链点击淡出 → 导航 → 新页入场;外链/新窗口/hash/下载链接不拦截;原 `motion.pageEnterDurationMs` 与 `theme.animation.pageTransition` 已移除。

### 3.59 pwa — PWA 运行时
`enabled true` / `registerSW true` / `updatePrompt true` / `offlineNotice true`。运行时总开关(需 `site.pwa.enabled` 同时开启);注册 `site.pwa.serviceWorker` 并监听更新(toast 提示)、监听离线/恢复(toast 提示);修复 `_redirects` 将根 `/manifest.json` 302 到不存在语言路径导致 SW 安装失败的问题。

---

## 4. navigation.json5 — 导航

| 字段 | 默认 | 说明 |
|---|---|---|
| `menu[]` | `[]` | 菜单项 `{label,url,target?,rel?,type}`(type: page/tag/category) |
| `navbar.fixed` | `true` | 固定头部 |
| `navbar.showLogo` | `true` | 显示 Logo |
| `navbar.logoText` | `''` | 自定义 Logo 文本 |
| `socialInNav.enabled` / `order[]` | `false`/`[]` | 导航社交图标 |
| `search.enabled` | `false` | 搜索开关(需要 features.search.enabled) |
| `search.placeholder` | `搜索...` | 占位文本 |
| `search.provider` | `local` | 本地索引 |
| `userMenu.enabled` | `false` | 用户菜单(预留) |

---

## 5. sidebar.json5 — 侧栏

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `false` | 侧栏总开关 |
| `position` | `right` | 位置 |
| `width` | `280px` | 宽度 |
| `sticky` | `true` | 吸顶 |
| `mobile.enabled/collapsed/toggleButton/overlay` | `true/true/true/true` | 移动端行为 |
| `widgets[]` | `[]` | 组件列表(见下) |

组件类型(`type` 字段):
- `author` `{title,avatar,bio}`
- `recent` `{title,count,showDate}`
- `tags` `{title,limit,showCount}`
- `categories` `{title,showCount}`
- `archive` `{title,showCount}`
- `search` `{title,placeholder}`
- `toc` `{title}`(仅文章页)
- `stats` `{title}`(需 features.stats.enabled)
- `series` `{title}`(需 features.series.enabled)
- `friends` `{title}`(需 friends.json5)
- `newsletter` `{title,action,buttonText}`
- `custom` `{title,html}`(原始 HTML)

---

## 6. footer.json5 — 页脚

| 字段 | 默认 | 说明 |
|---|---|---|
| `copyright` | `''` | 版权文本 |
| `fromYear` | `''` | 起始年份 |
| `layout` | `simple` | `simple|multi-column` |
| `columnItems.enabled` / `items[]` | `true`/`[]` | 多列 `{title,links[{label,url}],html}` |
| `bottomLinks.enabled` / `items[]` | `true`/`[]` | 底部链接 |
| `social.enabled` / `iconSize` | `false`/`24px` | 社交图标 |
| `poweredBy.enabled` / `text` | `false`/`S-ynapse` | Powered by |
| `beian.enabled` / `icp` / `gongan` | `false`/… | 备案号 |
| `customHtml` | `''` | 原始 HTML |

---

## 7. security.json5 — 安全

| 字段 | 默认 | 说明 |
|---|---|---|
| `headers` | `{}` | 自定义响应头 |
| `csp.enabled` / `directives` / `reportOnly` / `reportUri` | `false`/`{}`/`false`/`/csp-report` | Content-Security-Policy |
| `robots.enabled` / `rules[]` | `false`/`[]` | robots 规则 |
| `rateLimiting.enabled` | `false` | Worker 限流(100 req/60s) |
| `rateLimiting.maxRequests/windowMs` | `100`/`60000` | 参数 |
| `sri.enabled` / `algorithms` | `false`/`['sha256','sha384']` | SRI |
| `pathRestrictions` | `[]` | 路径限制(如 `/admin/*`) |
| `forceHttps` | `false` | HTTPS 强制 |
| `securityLogging.enabled` | `false` | 安全日志 |
| `customHeaders` | `{}` | 额外头 |
| `contentFilter.disallowTags/disallowAttributes/escapeHTML` | `[]`/`[]`/`true` | 内容过滤 |
| `uploadSecurity.maxFileSize` | `5242880` | 上传上限(字节) |

> 注意:`workers/security-config.js` 由构建从本文件自动生成,不要手改(生成器:scripts/generate-security-config.js)。

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
影响:标签页聚合、卡片标签显示。

**friends.json5**: 友链。
```json
{ "enabled": false, "title": "友情链接", "description": "", "applyNote": "", "friends": [ { "name": "示例", "url": "https://example.com", "description": "", "logo": "" } ] }
```
影响:自动注入导航「友链」、/links/ 页、侧栏 friends widget。

---

## 10. tuning.json5 — UI 微调参数层

独立 UI 参数文件(25 分类 / 162 项,逐项中文注释)。构建时全量注入为 `:root` CSS 变量,命名规则 `--{分类}-{参数}`(如 `--hero-maxWidth`、`--toc-indentL3`)。

**优先级语义**:CSS 类参数已绑定到样式规则并优先于 theme/features 的同名默认值(微调层——改 tuning 值即生效);行为类参数(motion/search/toc/tts/dailyQuote/readingPanel/header 滚动)经 `window.__TUNING__` 注入、运行时优先读取(回退 features);与 features/site 重叠的键已在「tuning 收尾」中全部清理(单一入口归各自模块配置);仅剩 10 项无实现目标的键(如 comments.avatarSize、tags.cloudMinSize、pagination.maxVisible)已在注释中标注「待实现」。

**分类(25)**:typography / layout / radius / motion / hero / card / toc / search / reading / comments / header / pagination / stats / breadcrumb / share / prevNext / contactPopup / reward / dailyQuote / tags / series / backToTop / texture / glow / code。

**已绑定示例(118 项 CSS + 15 项行为)**:`--hero-maxWidth`、`--layout-tabletBreakpoint`/`mobileBreakpoint`/`tocHideBreakpoint`(媒体查询断点,经 EJS 直读)、`--radius-default/large/button/avatar`、`--typography-lineHeight/letterSpacing/headingWeight`、`--toast-offsetBottom/borderWidth/radius`、`--breadcrumb-fontSize/gap/marginBottom`、`--card-padding/metaSize/radius`、`--toc-stickyTop`/`--sidebar-stickyTop`(粘性定位)、`--header-iconSize`、`--share-gap`、`--header-scrolledHeight/hairlineStrength`、`--code-borderWidth/borderMix`、`--texture-noiseOpacity`、`--glow-heroStrength`、`--card-imageHoverScale/excerptLines/gridGap`、`--motion-transitionTiming/buttonPressScale`、`--reading-quoteTint/imageHoverScale/h2AccentWidth/Height`;行为侧:search 历史/热词/去抖/结果上限/空文案、toc 滚动偏移与默认折叠、tts 语速/音调、dailyQuote 作者显示/每日刷新、readingPanel 字号/行距步进。

**注意**:绑定值均已对齐现有视觉(如 toast.radius=999px 对应胶囊形),修改前建议先在浏览器 DevTools 中试值。

---

## 校验与错误上报行为
1. **配置错误 → 立即终止**:缺逗号/引号未闭合/非法字符 → `[FATAL]` + 文件名、行列、上下文(带 `^` 定位)、原因、中文修复提示。
2. **校验失败 → 终止**:类型错误(如 enabled: "yes")、枚举越界、share 平台名未知、URL 非 http(s)、站点名缺失。
3. **校验警告 → 继续构建**:颜色疑似非法、changefreq 非标准、CSP unsafe-inline、tags 写成字符串(自动拆分)、无 date(排序前置)。
4. **文章数据 → 逐篇校验**:重复 slug 跳过并报错;非法日期跳过并报错;h1 超一个跳过;标题为空回退文件名(警告)。

## 环境变量
| 变量 | 作用 |
|---|---|
| `CF_WEB_ANALYTICS_TOKEN` | 未在 site.json5 填写 token 时读取;缺失则跳过注入并警告 |
| `MAINTENANCE` | 生产 Worker / 本地 serve 维护模式(`1` 生效) |
