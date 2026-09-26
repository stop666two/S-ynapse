/**
 * 构建默认值注册表（T0 单一默认值来源）
 * ---------------------------------------------------------------
 * 本文件由 scripts/build.js 内联 defaults 原样抽取而来，供：
 *   1) scripts/build.js 合并用户配置时作为基底；
 *   2) scripts/check-config-consistency.js（npm run verify:config）
 *      对 site/navigation/sidebar/footer 等配置文件做结构一致性监守。
 * 修改默认值只改这里；features 默认值仍在 lib/features-schema.js。
 */
'use strict';

const { DEFAULT_FEATURES } = require('./features-schema.js');

const DEFAULT_CONFIG = {
    site: {
      title: 'My Blog',
      titleEn: '',
      subtitle: '',
      subtitleEn: '',
      description: '',
      descriptionEn: '',
      author: '',
      email: '',
      url: 'http://localhost',
      language: 'en',
      languageEn: '',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      copyright: '',
      postsPerPage: 10,
      paginationPrev: '上一页',
      paginationNext: '下一页',
      prevPostLabel: '上一篇',
      nextPostLabel: '下一篇',
      rss: { enabled: false, path: '/feed.xml', fullContent: true, maxItems: 50, injectHeadLinks: true, jsonFeed: { enabled: false, path: '/feed.json', fullContent: false, maxItems: 20 } },
      seo: {
        metaKeywords: [], metaKeywordsEn: [], metaRobots: 'index, follow',
        ogImage: '', ogType: 'website',
        twitterCard: 'summary_large_image', twitterSite: '',
        canonicalURL: false,
        ogImageAlt: true, articleTimes: true, twitterLabels: true,
        structuredData: { enabled: false, type: 'BlogPosting' },
        titleTemplate: { index: '{site} · {subtitle}', post: '{title} | {site}', default: '{title} | {site}' }
      },
      social: { enabled: false, items: {} },
      comments: { enabled: false, provider: 'giscus', giscus: {}, disqus: {}, utterances: {} },
      sitemap: { enabled: true, path: '/sitemap.xml', changefreq: 'weekly', priority: 0.8 },
      pwa: { enabled: false, manifest: {}, serviceWorker: '/sw.js', cacheName: 's-ynapse-v1' },
      favicon: { enabled: true, svg: '/icons/favicon.svg', png32: '/icons/favicon-32x32.png', appleTouch: '/icons/apple-touch-icon.png' },
      build: {
        cleanDist: true, cacheControl: true, minifyHTML: false, minifyCSS: false, minifyJS: false,
        removeConsole: false,
        generateIndex: true, generateArchive: true, generateTags: true, generateCategories: true,
        generateGallery: true,
        copyStatic: true, optimizeMedia: false, mediaQuality: 85,
        mediaResponsiveSizes: [640, 1024, 1920], mediaFormats: ['webp', 'original'],
        avif: { enabled: true, quality: 50, effort: 5 },
        usePictureTag: true,
        relatedArticles: true, cjkSpacing: true,
        cjkFonts: { enabled: true, family: 'Noto Sans SC', weights: [400, 700], fetchTimeoutMs: 15000 },
        buildReport: true, forceContentWidth: true,
        enableCacheBusting: false, cacheBustingPattern: '.*\\.(css|js|png|jpg|svg)$',
        externalLinksTarget: '_blank', externalLinksRel: 'noopener noreferrer',
        cssOutDir: 'assets/css', cssFileBase: 'site', hashLength: 10, hashAlgorithm: 'md5'
      },
      externalLinkWarning: {
        enabled: false, whitelist: [], blacklist: [],
        title: '', titleEn: '', message: '', messageEn: '',
        confirmText: '', confirmTextEn: '', cancelText: '', cancelTextEn: ''
      },
      redirects: [],
      customHead: '',
      customBodyStart: '',
      customBodyEnd: '',
      authorProfile: { name: '', avatar: '', bio: '', bioEn: '', skills: [], timeline: [], socials: [] },
      hero: {
        enabled: true, title: '', titleEn: '', subtitle: '', subtitleEn: '',
        showSearch: true, showTags: true, showCta: true,
        ctaLabel: '', ctaLabelEn: '', ctaUrl: '', tagCount: 8
      },
      reward: {
        enabled: false, note: '', noteEn: '', custom: [],
        wechat: { label: '微信', labelEn: '', image: '', url: '' },
        alipay: { label: '支付宝', labelEn: '', image: '', url: '' }
      },
      languages: ['zh', 'en'],
      performance: {
        preloadFonts: true, preloadFeaturedImage: true, fontDisplay: 'swap',
        imageDecoding: 'async', scriptLoading: 'defer', preconnect: [],
        prefetchNextPage: false, resourceHints: true, imageSizes: 'auto'
      },
      webAnalytics: { enabled: false, token: '' },
      showRepoLink: true, repoUrl: ''
    },
    // Content policy defaults are minimal here — content-policy.json5 (optional)
    // supplies the real lists; classifyFile() in lib/content-policy.js falls
    // back to its own built-in default policy when keys are absent.
    contentPolicy: {
      enabled: true,
      mediaExts: [], videoMode: '', assetExts: [], blockedExts: [],
      documentRenderedTypes: [], blockedFilenames: [], svgSanitize: true
    },
    tagAliases: { enabled: true, aliases: {} },
    friends: { enabled: false, title: '友情链接', labels: {}, description: '', descriptionEn: '', applyNote: '', applyNoteEn: '', friends: [] },
    // Features domain defaults mirror features.json5 (single source of truth in
    // lib/features-schema.js). User overrides come from features.json5.
    features: DEFAULT_FEATURES,
    theme: {
      colors: { primary: '#2d3748', secondary: '#2563eb', accent: '#c53030', background: '#f7fafc', surface: '#ffffff', text: '#1a202c', textSecondary: '#4a5568', textLight: '#64748b', border: '#e2e8f0', shadow: 'rgba(0,0,0,0.1)', hover: '#edf2f7', codeBackground: '#2d3748', codeText: '#f7fafc' },
      darkMode: { enabled: false, toggle: true, default: 'system', colors: {} },
      preset: null, presetOverrides: {},
      fontSystem: { stack: 'inter', customStack: '', scale: 1, bodyWeight: 400, headingStack: 'inherit', numbersMono: true },
      rounding: 'md', shadowLevel: 'soft', borderStyle: 'subtle',
      avatar: { shape: 'round', ring: false, ringColor: '', badge: true },
      fontFamily: 'sans-serif',
      fontFamilyMono: 'monospace',
      fontSizeBase: '16px', lineHeight: 1.8,
      headingFontWeight: 700, letterSpacing: '0.02em',
      spacing: { containerWidth: '960px', gap: '1.618rem', padding: '2.618rem', radius: '0.618rem', radiusLarge: '1.618rem' },
      shadow: { card: '0 4px 6px rgba(0,0,0,0.1)', dropdown: '0 10px 15px -3px rgba(0,0,0,0.1)', fixed: '0 2px 4px rgba(0,0,0,0.08)' },
      layout: { headerStyle: 'fixed', headerHeight: '60px', footerStyle: 'simple', sidebarPosition: 'right', contentWidth: 'main', postLayout: 'standard', archiveLayout: 'list' },
      animation: { enable: true, transitionDuration: '0.3s', transitionTiming: 'ease-in-out' },
      card: { showDate: true, showTags: true, showCategories: true, showExcerpt: true, excerptLength: 150, showReadTime: true, readTimeSpeed: 265, showWordCount: true },
      button: { radius: '0.25rem', padding: '0.5rem 1.5rem', primaryBackground: '#2563eb', primaryText: '#ffffff', hoverScale: 1.02 },
      externalAssets: { styles: [], scripts: [] },
      contentOffset: 0, headerContentGap: 0, tocWidth: '200px', sidebarWidth: '280px', tocMinLeft: '10px', sidebarMinRight: '10px'
    },
    navigation: {
      menu: [],
      navbar: { fixed: true, showLogo: true, logoText: '', logoTextEn: '', logoImage: '', logoWidth: '40px', shadow: true, breakpoint: '768px' },
      navbarOptions: {
        height: '60px', glassBlur: '', glassAlpha: 0, navGap: '.25rem',
        logoSize: '1.272em', navFontSize: '.9375rem', iconSize: '18px', shadowShow: true
      },
      socialInNav: { enabled: false, order: [] },
      search: { enabled: false, placeholder: '搜索...', placeholderEn: 'Search...', provider: 'local' },
      userMenu: { enabled: false }
    },
    sidebar: {
      enabled: false, position: 'right', width: '280px', sticky: true, widgets: [],
      options: { width: '318px', gap: '1.618rem', radius: '0.618rem', padding: '1rem', titleSize: '.9375rem', titleWeight: 600, hoverLift: true, borderShow: false },
      mobile: { enabled: true, collapsed: true, toggleButton: true, overlay: true }
    },
    footer: {
      copyright: '', layout: 'simple', columns: 3, customHtml: '',
      columnItems: { enabled: true, items: [] },
      bottomLinks: { enabled: true, items: [] },
      social: { enabled: false, iconSize: '24px' },
      poweredBy: { enabled: false, text: 'S-ynapse' },
      beian: { enabled: false, icp: '', gongan: '' },
      options: { paddingV: '2.618rem', gap: '2rem', linkSize: '.875rem', copyrightSize: '.8125rem', icpSize: '.75rem', socialIconSize: '18px', socialGap: '.75rem', linkHoverUnderline: true }
    },
    security: {
      headers: {}, csp: { enabled: false, directives: {}, reportOnly: false },
      robots: { enabled: false, rules: [], sitemap: '/sitemap.xml' },
      rateLimiting: { enabled: false, maxRequests: 100, windowMs: 60000 },
      pathRestrictions: [], forceHttps: false,
      customHeaders: {}
    }
  };

module.exports = { DEFAULT_CONFIG };
