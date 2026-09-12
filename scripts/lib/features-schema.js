// features-schema.js — single source of truth for the features config domain.
// DEFAULT_FEATURES mirrors features.json5 (the user-facing config file with
// comments). The schema drives structural validation at build time.

const DEFAULT_FEATURES = {
  lightbox: {
    enabled: true,
    zoomEnabled: true, panEnabled: true, rotateEnabled: true,
    pinchEnabled: true, zoomStep: 0.25, zoomMin: 1, zoomMax: 4,
    dblClickZoom: true, wheelZoom: true, showZoomButtons: true,
    selectors: '.post-content img, .gallery-item img',
    minSize: 60, prevNextButtons: true, closeButton: true,
    keyboardNavigate: true, escToClose: true, swipeToNavigate: true,
    closeOnBackdrop: true, showCounter: true, counterFormat: '{current} / {total}',
    maxWidthVw: '92', maxSizePx: '1600', maxHeightVh: '82',
    openDurationMs: 180, switchDurationMs: 120, backdropOpacity: '0.9',
    preloadAdjacent: true, rememberPosition: false,
    showCaption: true, captionMaxLines: 2, transitionDurationMs: 220
  },
  readingProgress: {
    enabled: true, articleOnly: true, clickToJump: true, showDot: true,
    dotSize: '10px', barHeight: '3px', useGradient: true,
    gradientStart: 'var(--color-s)', gradientEnd: 'var(--color-a)',
    tipDisplayMs: 500, updateThrottleMs: 30, ariaAnnounce: true, topOffset: '0',
    zIndex: 1000, showTip: true, progressColor: 'var(--color-a)',
    rememberPosition: true, rememberPositionMaxAgeHours: 72
  },
  backToTop: {
    enabled: true, showAfterPx: 400, rightOffset: '2rem', bottomOffset: '2rem',
    size: '44px', scrollDurationMs: 450, smoothScroll: true, hotkey: '',
    htmlAnchorFallback: false, zIndex: 999
  },
  search: {
    enabled: true, minChars: 1, maxResults: 30, highlightMatches: true,
    showCount: true, placeholder: '搜索...', emptyHint: '输入关键词开始搜索',
    noResultText: '未找到匹配内容', excerptLength: 120, includeContent: true,
    matchTags: true, matchCategories: true, weightTitle: 5, weightExcerpt: 2,
    weightContent: 1, closeOnOverlay: true, focusOnOpen: true,
    openAnimation: 'fade', pinyinFuzzy: false,
    debounceMs: 120, showHistoryOnFocus: true, maxHistory: 5
  },
  imageLazy: {
    enabled: true, fadeIn: true,
    fadeInDurationMs: 300, placeholderColor: 'var(--color-hover)', preserveAspectRatio: true,
    loadingClass: 'img-loading', errorClass: 'img-error', eagerFirst: 3,
    lqip: true, lqipWidth: 24
  },
  codeBlock: {
    enabled: true, copyButtonVisibility: 'hover', copySuccessText: '已复制',
    copyFailText: '复制失败', showLanguageTag: true, lineNumbers: true, windowBar: true,
    wrapLongLines: false, highlightBackground: 'var(--color-hover)',
    borderRadius: '0.375rem', maxHeight: '', copyAllButton: true, downloadButton: true,
    maxHeightVh: 'none', headerHeight: '36px', fontSize: '0.92em'
  },
  externalLink: {
    enabled: true, whitelist: [], blacklist: [], mode: 'warn',
    message: '即将离开本站,前往外部链接：', confirmText: '继续访问',
    cancelText: '返回', showFullUrl: true, openInNewTab: true,
    whitelistNewTab: false, copyButtonText: '复制'
  },
  themeToggle: {
    enabled: true, defaultTheme: 'system', rememberChoice: true,
    animationMs: 250, iconStyle: 'sun-moon', transitionAll: true,
    persistKey: 'ss-theme', toggleIconSwap: true, zIndex: 100
  },
  themePresets: {
    enabled: true, pickerVisible: true, persistChoice: true,
    showInNavbar: true, previewOnHover: true
  },
  themeSchedule: {
    enabled: false, darkFrom: '22:00', lightFrom: '06:00',
    respectManualOverride: true, applyInstantly: true, checkIntervalMs: 60000,
    smoothTransition: true
  },
  shortcuts: {
    enabled: true, openSearch: '/', toggleTheme: 'd', prevPost: 'k',
    nextPost: 'j', help: '?', close: 'Escape', showHelpHint: true,
    helpTitle: '快捷键一览', showHelpTable: true, ignoreInInputs: true
  },
  toc: {
    enabled: true, minLevel: 2, maxLevel: 4, collapsible: true,
    defaultOpenLevel: 2, highlightActive: true, activeOffset: 120,
    progressLine: true, updateUrl: true, smoothScroll: true,
    visitedFade: true, groupCollapse: true, titleText: '目录', titleTextEn: 'Contents',
    showTitle: true, maxWidthPx: 320
  },
  mobileToc: {
    enabled: true, borderRadius: '1rem',
    maxHeightVh: '70', autoClose: true, overlayClose: true,
    lockScroll: true, position: 'right', showCurrent: true
  },
  readDock: {
    enabled: true, showProgressRing: true, showTocButton: true,
    showTopButton: true, hideOnScrollDown: true, position: 'right'
  },
  dailyQuote: {
    enabled: true, widgetStyle: 'sidebar', label: '每日一言',
    source: 'builtin', count: 7, quoteColor: ''
  },
  favorites: {
    enabled: true, position: 'toolbar', storageKey: 's-favorites',
    label: '收藏', listIcon: true, notText: '收藏', favedText: '已收藏'
  },
  prismTheme: {
    enabled: true
  },
  cover: {
    enabled: true, patterns: ['gradient', 'stripes', 'dots', 'blob', 'mesh'],
    defaultPattern: 'gradient', preview: true, preferImage: true
  },
  i18n: {
    enabled: true, defaultLanguage: 'zh', languages: ['zh', 'en'], navToggle: true, translationNotice: true
  },
  pagefind: {
    enabled: true, indexPath: '/pagefind', integrate: true
  },
  giscus: {
    enabled: false, repo: '', repoId: '', category: 'Announcements',
    categoryId: '', mapping: 'title', theme: 'preferred_color_scheme',
    loading: 'lazy', crossorigin: 'anonymous'
  },
  sitemap: {
    split: true, postPriority: '0.8', pagePriority: '0.6', tagPriority: '0.4',
    postFrequency: 'weekly', pageFrequency: 'monthly', tagFrequency: 'monthly',
    maxUrlsPerFile: 500
  },
  scrollBehavior: {
    enabled: true, behavior: 'smooth', anchorOffset: '18px', respectReducedMotion: true
  },
  toast: {
    enabled: true, position: 'bottom-center', durationMs: 2500, maxVisible: 3
  },
  breadcrumb: {
    enabled: true, separator: '›', showHome: true, showCurrent: true
  },
  pageTransition: {
    enabled: true, type: 'slide', durationMs: 180, outDurationMs: 120,
    reducedMotion: 'light', excludeSelector: '[data-no-transition]'
  },
  pwa: {
    enabled: true, registerSW: true, updatePrompt: true, offlineNotice: true, offlinePage: true, installPrompt: true
  },
  morphIcons: {
    enabled: true, spring: 'snappy', reducedMotion: 'light', preload: 'interaction', perIcon: {},
    icons: { theme: true, copy: true, favorite: true, tts: true, menu: true }
  },
  viewTransition: {
    enabled: true, type: 'fade', durationMs: 180, shared: true, reducedMotion: 'light',
    toggle: { show: true, defaultOn: true, storageKey: 's-view-transition' }
  },
  speculation: {
    enabled: true, mode: 'both', eagerness: 'moderate',
    excludeSelectors: ['[download]', '[rel~=nofollow]', '.no-speculate'],
    toggle: { show: true, defaultOn: true, storageKey: 's-speculation' }
  },
  cardFx: {
    enabled: true, coverOverlay: true, categoryChip: true, readTimeBadge: true, hoverShine: true
  },
  magazine: {
    enabled: true, dropCap: true, figureBleed: true, tableHover: true, headingNumbers: false
  },
  perfBudget: {
    enabled: true, htmlKb: 70, jsKb: 90, requests: 18, warnOnly: true
  },
  scrollIndicator: {
    enabled: true, height: '2px', gradient: true, respectReducedMotion: true
  },
  commandPalette: {
    enabled: true, hotkey: 'k', includeNavigation: true, includeActions: true,
    includeSearch: true, maxResults: 10, autoFocus: true
  },
  subscribe: {
    enabled: true, rss: true, jsonFeed: true, newsletterUrl: '',
    newsletterLabel: '', newTab: true
  },
  authorCard: {
    enabled: true, pageSlug: 'about', showSocial: true, showSkills: true,
    showTimeline: true, avatarSize: '96px', maxTimeline: 20
  },
  readingHistory: {
    enabled: true, maxItems: 5, storageKey: 's-history',
    showOnHome: true, clearable: true
  },
  printStyle: {
    enabled: true, hideInteractive: true, expandLinks: true, avoidBreaks: true
  },
  atmosphere: {
    enabled: true, grain: true, glow: true
  },
  sidebarDrag: {
    enabled: true, persistOrder: true, storageKey: 's-sidebarOrder',
    touchLongPress: true, showHandleOnHover: true, resetOnLoadFail: true
  },
  exportBackup: {
    enabled: true, includeMedia: true, includeConfig: true, outputDir: 'exports',
    fileNamePrefix: 's-ynapse-backup'
  },
  mediaAudit: {
    enabled: true, reportMissed: true, reportUnreferenced: true,
    reportDuplicate: false, output: 'console'
  },
  autoSummary: {
    enabled: true, maxLength: 160, fallback: 'firstParagraph',
    stripMarkdown: true, ellipsis: '…'
  },
  searchEnginePing: {
    enabled: false, engines: ['google'], onlyProduction: true, timeoutMs: 5000
  },
  hreflang: {
    enabled: true, includeSelf: true, canonical: true, xDefault: true
  },
  schemaRich: {
    enabled: true, breadcrumbs: true, dateModified: true, blogHomepage: true,
    authorUrl: true, wordCount: true, timeRequired: true, keywords: true, articleSection: true, image: true
  },
  ogImage: {
    enabled: true, width: 1200, height: 630, useCover: true,
    gradientForNoCover: true, fontScale: 0.75, cacheDir: '.og-cache'
  },
  hotSearches: {
    enabled: true, top: 5, storageKey: 's-hotSearches', showInDropdown: true,
    showClear: true
  },
  readingTime: {
    enabled: true, wordsPerMinuteCJK: 250, wordsPerMinuteLatin: 200,
    showInMeta: true, labelBefore: '', labelAfter: '阅读约需'
  },
  codeCopy: {
    enabled: true, buttonText: '复制', copiedText: '已复制', buttonTimeout: 1500,
    showLineNumbers: false, includeWindowBar: true
  },
  tocScrollSpy: {
    enabled: true, activeClass: 'current', offset: 80, throttleMs: 60
  },
  searchHighlight: {
    enabled: true, markClass: 'search-hit', maxMatches: 20
  },
  darkImageFilter: {
    enabled: true, filter: 'brightness(0.85) saturate(0.9)',
    applyImages: true, applyVideos: true
  },
  listCover: {
    enabled: true, showOnHome: true, showOnArchive: true, fallback: 'none',
    aspectRatio: '21/9', lazy: true
  },
  imageFallback: {
    enabled: true, fallbackImage: '', altText: '图片不可用', showAlt: true
  },
  mobileBottomNav: {
    enabled: true, items: ['home', 'archive', 'search', 'theme'],
    onlyMobile: true, useSafeArea: true
  },
  incrementalBuild: {
    enabled: true, cacheDir: '.build-cache', fullFlag: '--full',
    watch: true, fingerprintHash: 'sha1', skipUnchanged: true
  },
  customCSS: {
    enabled: true, css: [], target: 'before-closing-body'
  },
  readingPanel: {
    enabled: true, fontSizeMin: 15, fontSizeMax: 26, fontSizeStep: 1,
    fontSizeDefault: 19, lineHeightMin: 1.4, lineHeightMax: 2.6,
    lineHeightStep: 0.1, lineHeightDefault: 1.9, widthMin: 560, widthMax: 1200,
    widthStep: 40, widthDefault: 800, remember: true, storageKey: 'readerPrefs',
    resetText: '重置', position: 'right', persistKey: 'ss-reading', showReset: true
  },
  readMode: {
    enabled: true, persist: true, label: '阅读模式', focusOnlyContent: true,
    fontScale: 1
  },
  tts: {
    enabled: true, rate: 0.5, pitch: 1, volume: 1, preferDefaultVoice: true,
    voiceBy: 'lang', readSelector: '.post-content', icon: 'speaker',
    highlightParagraph: false, position: 'toolbar',
    highlightReading: true, highlightClass: 'tts-highlight',
    skipSelectors: 'pre, .katex, .mermaid'
  },
  wikiLinks: {
    enabled: true, unknownMode: 'text', unknownSuffix: '', openNewTab: false,
    caseInsensitive: true, allowCustomLabel: true
  },
  supSub: {
    enabled: true, supMarker: '^', subMarker: '~', skipInsideMath: false,
    preserveUnmatched: true
  },
  math: {
    enabled: true, autoDetect: true, version: '0.16.22',
    inlineDelimiters: ['$'], blockDelimiters: ['$$'], throwOnError: false,
    strict: false, renderRoundParens: true, renderSquareBrackets: true,
    selector: '.post-content', mathml: true
  },
  mermaid: {
    enabled: true, autoDetect: true, version: '11.4.1', followTheme: true,
    lightTheme: 'default', darkTheme: 'dark', securityLevel: 'strict',
    copyAfterRender: false, errorText: '[图表渲染失败]'
  },
  series: {
    enabled: true, showBadge: true, badgeFormat: '系列 · {name}',
    showNavPanel: true, sidebarWidget: true, order: 'asc',
    panelTitle: '本系列共 {total} 篇', showPosition: true, defaultWidgetCount: 8,
    prevLabel: '上一篇', nextLabel: '下一篇',
    progressLabel: '{index} / {total}', sidebarTitle: '系列'
  },
  related: {
    enabled: true, topN: 4, sameCategoryWeight: 2, sameTagWeight: 3,
    minScore: 2, excludeCurrent: true, title: '相关推荐',
    showExcerpt: true, excerptLength: 80, showCount: false
  },
  pinned: {
    enabled: true, badgeText: '置顶', badgeStyle: 'pill', sortRule: 'pinned-first'
  },
  wordCount: {
    enabled: true, onCards: true, inArticle: true, textFormat: '{count} 字',
    readTimeFormat: '{minutes} 分钟阅读', wpm: 265, countCjkChars: true, countDigits: false
  },
  share: {
    enabled: true, order: ['weibo', 'qq', 'wechat', 'x', 'facebook', 'mail', 'copy'],
    position: 'toolbar', popupWidth: 640, popupHeight: 520,
    wechatText: '{title} 分享自 {url}', copiedText: '链接已复制',
    copiedShowMs: 2500, showLabel: false, label: '分享文章',
    useNativeShare: false, copyFallback: true
  },
  reward: {
    enabled: false, buttonText: '打赏', note: '感谢支持', popupTitle: '打赏支持',
    closeByBtn: true, closeByOverlay: true, closeByEsc: true,
    qrSize: '180px', maxWidth: '560px', showNote: true,
    qrMaxWidth: '180px', closeText: '关闭', links: []
  },
  gallery: {
    enabled: true, title: '图库', description: '站内图片集，点击查看大图。',
    emptyText: '暂无图片', columns: 4, columnMin: '220px', showSource: true,
    collectFeatured: true, order: 'newest', incrementalByDefault: true, maxItems: 0,
    gap: '12px', showCaption: true, borderRadius: '8px'
  },
  heatmap: {
    enabled: true, levels: 5, scaling: 'auto', palette: [], showLegend: true,
    legendLow: '少', legendHigh: '多', tooltipFormat: '{year}-{month}: {count} 篇',
    showMonthNumbers: true, gap: '3px', borderRadius: '3px', cellSize: '13px',
    emptyColor: 'var(--color-border)'
  },
  stats: {
    enabled: true, showArchiveCards: true,
    labelPosts: '文章总数', labelDays: '发文天数', labelWords: '总字数',
    labelAvg: '日均篇数', labelTags: '标签数', labelCategories: '分类数',
    linkArchive: '/archive/', cardColumns: 'auto-fit', showSidebar: true,
    labelAvgPerDay: '日均'
  },
  prevNext: {
    enabled: true, showLabels: true, prevLabel: '上一篇', nextLabel: '下一篇',
    hideWhenMissing: false,
    showThumbnail: false, labelPosition: 'left', scrollToTopOnClick: true
  },
  hero: {
    enabled: true, showSearch: true, showCta: true, showTags: true,
    ctaLabel: '查看全部文章', ctaUrl: '#latest-post', tagCount: 8,
    searchPlaceholder: '搜索文章…', showDate: false,
    ctaLabelEn: 'View all posts', heightVh: 60, backgroundImage: ''
  },
  feed: {
    rssEnabled: true, rssPath: '/feed.xml', rssFullContent: true, rssMaxItems: 50,
    jsonFeedPath: '/feed.json', jsonFeedFullContent: false, jsonFeedMaxItems: 20,
    injectHeadLinks: true, injectFooterLink: false
  },
  analytics: {
    enabled: true, scriptSrc: 'https://static.cloudflareinsights.com/beacon.min.js',
    injectAt: 'body', emitBeacon: true, siteTag: ''
  },
  redirects: { enabled: false, generatePagesFile: true, applyInServe: true, invalidRule: 'abort' },
  maintenance: {
    enabled: false, message: '站点维护中，请稍后再来。', status: 503,
    setRetryAfter: true, retryAfter: 3600
  },
  mobile: {
    enabled: true, searchFullscreen: true, buttonStackGap: '4rem',
    touchFallback: true, codeScrollHint: true,
    tocBreakpoint: 900, safeAreaBottom: true, tapHighlight: false
  },
  comments: {
    enabled: true, loadContainer: true, renderPlaceholder: true, title: '评论',
    placeholderText: '评论加载中…', loadDelayMs: 300, emptyText: '暂无评论'
  },
  contactPopup: {
    enabled: true, title: '联系方式', copyText: '复制',
    popupWidth: '360px', showAllItems: true,
    showIcon: true, copySuccessText: '', maxItems: 4
  },
  linkBehavior: {
    matchMode: 'hostname', skipInternal: true, mailtoMode: 'leave', lateTargeted: false
  },
  performance: { warningJsKb: 80, warningHtmlKb: 400, warningImageKb: 300, warningBuildMs: 30000 },
  debug: { verbose: false, listPages: false, dumpConfig: false },
  background: {
    particles: {
      enabled: true, count: 55, speed: 0.5, linkDistance: 120,
      opacity: 0.6, showLines: true, autoDisableMobile: false
    }
  },
  motion: {
    enabled: true,
    cardHoverScale: 1.02,
    linkUnderlineOffset: '3px',
    cardHoverLift: true, cardHoverLiftPx: 4,
    linkUnderline: true, linkUnderlineThickness: '2px',
    buttonRipple: true, rippleDurationMs: 500,
    scrollReveal: true, revealCards: true, revealHeadings: true,
    revealImages: true, revealBlocks: false,
    revealDurationMs: 250, revealDelayMs: 0, revealStaggerMax: 80, revealOffset: '10px',
    revealOnce: true, revealThreshold: 0.08, reducedMotion: 'light'
  },
  ogImageStyle: {
    enabled: true, align: 'center', showSite: true, useGradient: true,
    gradientAngle: '135deg', fontSizeBase: 64, maxLines: 4,
    letterSpacing: '0.02em', template: 'aurora', palette: 'theme', showCategory: true
  }
};

const FEATURE_MODULES = Object.keys(DEFAULT_FEATURES);

const SHARE_PLATFORMS = ['weibo', 'qq', 'wechat', 'x', 'facebook', 'mail', 'copy'];
const ENUM_FIELDS = {
  imageLazy: { mode: ['lazy', 'native', 'eager'] },
  externalLink: { mode: ['warn', 'prohibit', 'hint'] },
  themeToggle: { defaultTheme: ['light', 'dark', 'system'], iconStyle: ['auto', 'sun-moon', 'toggle'] },
  wikiLinks: { unknownMode: ['text', 'link', 'hide'] },
  mermaid: { followTheme: ['enabled', true, false] },
  series: { order: ['asc', 'desc'] },
  pinned: { badgeStyle: ['pill', 'corner', 'none'], sortRule: ['pinned-first', 'normal'] },
  share: { position: ['toolbar', 'floating'] },
  prevNext: { labelPosition: ['left', 'center', 'right'] },
  scrollBehavior: { behavior: ['smooth', 'auto'] },
  toast: { position: ['bottom-center', 'top-center', 'top-right', 'bottom-right', 'top-left', 'bottom-left'] },
  pageTransition: { type: ['slide', 'fade'], reducedMotion: ['light', 'off', 'full'] },
  gallery: { order: ['newest', 'longest'] },
  heatmap: { scaling: ['auto', 'fixed'] },
  analytics: { injectAt: ['body', 'head'] },
  redirects: { invalidRule: ['warn-only', 'abort'] },
  maintenance: { status: [503, 502, 500] },
  codeBlock: { copyButtonVisibility: ['hover', 'always', 'never'] },
  mobileToc: { position: ['right', 'left'] },
  readingPanel: { position: ['right', 'left'] },
  motion: { reducedMotion: ['light', 'off', 'full'] },
  morphIcons: { spring: ['smooth', 'snappy', 'bouncy'], reducedMotion: ['light', 'off', 'full'], preload: ['interaction', 'idle', 'immediate'] },
  viewTransition: { type: ['fade', 'slide'], reducedMotion: ['light', 'off', 'full'] },
  speculation: { mode: ['prefetch', 'prerender', 'both'], eagerness: ['moderate', 'eager', 'conservative'], delivery: ['inline', 'header', 'both'] },
  ogImageStyle: { template: ['aurora', 'mesh', 'grid', 'paper', 'duotone'], palette: ['theme', 'hash'] }
};
// Numeric fields computed per module via typeof === 'number' check. All non-
// numeric array fields (whitelist/blacklist/order/palette) must be arrays.
const ARRAY_FIELDS = {
  lightbox: [], readingProgress: [], backToTop: [], search: [], imageLazy: [],
  codeBlock: [], externalLink: ['whitelist', 'blacklist'], themeToggle: [],
  shortcuts: [], toc: [], mobileToc: [], readingPanel: [], tts: [], wikiLinks: [],
  supSub: [], math: ['inlineDelimiters', 'blockDelimiters'], mermaid: [],
  series: [], related: [], pinned: [], wordCount: [], share: ['order'],
  reward: [], gallery: [], heatmap: ['palette'], stats: [], prevNext: [],
  feed: [], analytics: [], redirects: [], maintenance: [], mobile: [],
  comments: [], contactPopup: [], linkBehavior: [], performance: [], debug: [],
  scrollBehavior: [], toast: [], breadcrumb: [], pageTransition: [], pwa: [],
  morphIcons: [],
  viewTransition: [],
  speculation: ['excludeSelectors'],
  background: ['particles'], motion: [], ogImageStyle: []
};

function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function validateFeatures(features, moduleName) {
  const errors = [];
  const warnings = [];
  if (features == null || typeof features !== 'object' || Array.isArray(features)) {
    errors.push(`${moduleName} must be an object`);
    return { errors, warnings };
  }
  for (const mod of FEATURE_MODULES) {
    const cfg = features[mod];
    if (cfg == null) continue;
    if (typeof cfg !== 'object' || Array.isArray(cfg)) {
      errors.push(`${moduleName}.${mod} must be an object`);
      continue;
    }
    if ('enabled' in cfg && typeof cfg.enabled !== 'boolean') {
      errors.push(`${moduleName}.${mod}.enabled must be a boolean`);
    }
    if (Math.round(cfg.levels) !== cfg.levels && cfg.levels > 0) {
      warnings.push(`${moduleName}.${mod}.levels should be a whole number`);
    }
    for (const [key, val] of Object.entries(cfg)) {
      const type = typeof val;
      if (type === 'number' && (val !== 0 && !isFinite(val))) {
        errors.push(`${moduleName}.${mod}.${key} must be a finite number`);
      }
      if (type === 'boolean') continue;
      if (type === 'number') continue;
      if (type === 'string') continue;
      if (Array.isArray(val) && (ARRAY_FIELDS[mod] && ARRAY_FIELDS[mod].includes(key) || typeName(val) === 'array')) continue;
      if (val !== null && type === 'object') continue;
    }
    const enumSpec = ENUM_FIELDS[mod];
    if (enumSpec) {
      for (const [key, allowed] of Object.entries(enumSpec)) {
        if (cfg[key] != null && !allowed.includes(cfg[key])) {
          const list = allowed.map(String).join(', ');
          errors.push(`${moduleName}.${mod}.${key} must be one of: ${list}`);
        }
      }
    }
    if (mod === 'share' && Array.isArray(cfg.order)) {
      for (const p of cfg.order) {
        if (!SHARE_PLATFORMS.includes(p)) errors.push(`${moduleName}.share.order includes unknown platform "${p}"`);
      }
    }
  }
  for (const key of Object.keys(features)) {
    if (!FEATURE_MODULES.includes(key)) {
      warnings.push(`${moduleName}.${key} is not a known feature module (typo?)`);
    }
  }
  return { errors, warnings };
}

module.exports = { DEFAULT_FEATURES, FEATURE_MODULES, validateFeatures, SHARE_PLATFORMS };
