#!/usr/bin/env node
// S-ynapse Static Blog Builder — main build pipeline
// Reads Markdown articles + JSON5 configs + EJS templates → fully static HTML site
// Pipeline order: config → validate → dist → static → media → articles → pages → RSS → sitemap → search → security headers → minify → cache bust → PWA

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const frontMatter = require('front-matter');
const { marked } = require('marked');
const ejs = require('ejs');

// Optional dependency loading — each fails gracefully to null/fallback
// This allows the build to run with missing packages (features degrade instead of crashing)
let json5, deepmerge, Feed, sharp, minifyHtmlNode, CleanCSS, terser, chokidar;
const { spawnSync } = require('child_process');
try { json5 = require('json5'); } catch (e) {
  console.warn('[WARN] json5 package not found, config files with comments will fail to parse. Run: npm install json5');
  json5 = { parse: JSON.parse };
}
// deepmerge fallback: recursive object merge (supports indefinite nesting)
try { deepmerge = require('deepmerge'); } catch (e) {
  deepmerge = function deepMerge(...objs) {
    const result = {};
    for (const obj of objs) {
      if (!obj || typeof obj !== 'object') continue;
      for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) {
          result[key] = obj[key].slice();
        } else if (obj[key] && typeof obj[key] === 'object') {
          result[key] = deepMerge(result[key] || {}, obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
    return result;
  };
}
try { const feedMod = require('feed'); Feed = feedMod.Feed || feedMod; } catch (e) { Feed = null; }
try { sharp = require('sharp'); } catch (e) { sharp = null; }
try { minifyHtmlNode = require('@minify-html/node'); } catch (e) { minifyHtmlNode = null; }
try { CleanCSS = require('clean-css'); } catch (e) { CleanCSS = null; }
try { terser = require('terser'); } catch (e) { terser = null; }
try { chokidar = require('chokidar'); } catch (e) { chokidar = null; }
let generateWorkerSecurity;
try { generateWorkerSecurity = require('./generate-security-config').generateSecurityConfig; } catch (e) { generateWorkerSecurity = null; }

// Optional local hooks script (scripts/hooks.js) — allows external plugins to hook into build lifecycle
// Hook functions: preBuild(config), transformMarkdown(content, attrs), transformHTML(html, data), postBuild(config, stats)
let hooks;
try { hooks = require('./hooks'); } catch (e) { hooks = null; }
const { formatDate, safeSlug, escapeAttr, escapeHtml, stripHtml, insertCjkSpacing, applyCjkSpacingToHtml, extractToc, sanitizeHtml, escapeJsonForScript, countWords, resolveWikiLinks } = require('./lib/utils');
const { classifyFile, sanitizeSvg } = require('./lib/content-policy');
const { DEFAULT_FEATURES, validateFeatures } = require('./lib/features-schema');
const { PRESETS: THEME_PRESETS, resolveTheme: resolveThemePreset, validatePreset: validateThemePreset } = require('./lib/theme-presets');
const { formatConfigError } = require('./lib/config-error');

// Project directory structure — all paths relative to project root
const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');          // Markdown article source files

const STATIC_DIR = path.join(ROOT, 'static');               // Unprocessed static assets (copied verbatim)
const MEDIA_DIR = path.join(ROOT, 'media');                 // Source images (processed by sharp)
const VIDEOS_DIR = path.join(ROOT, 'videos');               // Source videos (copied with policy filter)
const ASSETS_DIR = path.join(ROOT, 'assets');               // Source downloadable files (copied with policy filter)
const TEMPLATES_DIR = path.join(ROOT, 'templates');         // EJS template files
const DIST_DIR = path.join(ROOT, 'dist');                   // Build output directory
const PAGES_DIR = path.join(ROOT, 'pages');                 // Standalone page Markdown files (about, privacy, etc.)

// CLI flags parsed from process.argv
const WATCH_MODE = process.argv.includes('--watch');        // Rebuild on file changes
const SERVE_MODE = process.argv.includes('--serve');        // Start dev HTTP server after build
const SHOW_DRAFTS = process.argv.includes('--drafts') || WATCH_MODE;  // Include draft articles

const CACHE_BUST_MANIFEST_PATH = path.join(DIST_DIR, 'cache-bust-manifest.json');

// Filter out draft articles unless SHOW_DRAFTS is active
function getPublished(articles) { return articles.filter(a => !a.draft || SHOW_DRAFTS); }

// Build a detailed, actionable error report for a JSON5 parse failure:
// file path, line/column, the offending line with a caret, context lines, cause
// and a repair hint. Config syntax errors must never be a one-line mystery.
// Load a JSON5 config file from project root.
// Strips BOM and normalizes line endings before parsing.
// Exits the process with [FATAL] on any failure — config errors must not be silent.
function loadConfigFile(filename) {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`  [FATAL] Config file not found: ${filename}`);
    process.exit(1);
  }
  try {
    let raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    raw = raw.replace(/\r\n/g, '\n');
    return json5.parse(raw);
  } catch (err) {
    const filePath = path.join(ROOT, filename);
    const fileText = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    console.error(formatConfigError(filename, err, { filePath, fileText }));
    process.exit(1);
  }
}

// Load an optional config file. Missing file → null (no error).
// Present-but-invalid → fatal, matching the strict behavior of loadConfigFile.
function loadOptionalConfigFile(filename) {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    let raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    raw = raw.replace(/\r\n/g, '\n');
    return json5.parse(raw);
  } catch (err) {
    const filePath = path.join(ROOT, filename);
    const fileText = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    console.error(formatConfigError(filename, err, { filePath, fileText }));
    process.exit(1);
  }
}

// Load and merge all 6 config files with deep defaults.
// The defaults object provides every possible key so user configs can be sparse.
// deepmerge.all([defaults, userConfig]) ensures nested keys (e.g. theme.colors.primary)
// fall through to defaults when user omits them.
// Each loaded config overrides only the keys the user explicitly set.
function loadConfig() {
  console.log('[1/14] Loading configuration...');
  const site = loadConfigFile('site.json');
  const theme = loadConfigFile('theme.json');
  const navigation = loadConfigFile('navigation.json');
  const sidebar = loadConfigFile('sidebar.json');
  const footer = loadConfigFile('footer.json');
  const security = loadConfigFile('security.json');
  // Content policy is optional — when the file is missing the built-in default
  // policy from scripts/lib/content-policy.js is used.
  const contentPolicy = loadOptionalConfigFile('content-policy.json') || {};
  // Tag aliases + friends are optional external config files (single source per feature).
  const tagAliasData = loadOptionalConfigFile('tag-aliases.json') || {};
  const friendsData = loadOptionalConfigFile('friends.json') || {};
  // Features domain is optional: missing features.json5 falls back to the
  // built-in DEFAULT_FEATURES (matching current behavior).
  const features = loadOptionalConfigFile('features.json5') || {};
  // UI strings domain (feature 18): optional ui-strings.json5 — template
  // fallbacks stay in place when missing. Deep-merged (uiStrings overrides
  // only the keys it defines).
  const uiStrings = loadOptionalConfigFile('ui-strings.json5') || {};

  const defaults = {
    site: {
      title: 'My Blog',
      subtitle: '',
      description: '',
      author: '',
      email: '',
      url: 'http://localhost',
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      copyright: '',
      postsPerPage: 10,
      paginationPrev: '上一页',
      paginationNext: '下一页',
      prevPostLabel: '上一篇',
      nextPostLabel: '下一篇',
      rss: { enabled: false, path: '/feed.xml', fullContent: true, maxItems: 50 },
      seo: {
        metaKeywords: [], metaRobots: 'index, follow',
        ogImage: '', ogType: 'website',
        twitterCard: 'summary_large_image', twitterSite: '',
        canonicalURL: false,
        structuredData: { enabled: false, type: 'BlogPosting' }
      },
      social: { enabled: false, items: {} },
      comments: { enabled: false, provider: 'giscus' },
      sitemap: { enabled: true, path: '/sitemap.xml', changefreq: 'weekly', priority: 0.8 },
      pwa: { enabled: false, manifest: {}, serviceWorker: '/sw.js' },
      build: {
        cleanDist: true, minifyHTML: false, minifyCSS: false, minifyJS: false,
        removeConsole: false,
        generateIndex: true, generateArchive: true, generateTags: true, generateCategories: true,
        generateGallery: true,
        generateAuthorPages: false, copyStatic: true, optimizeMedia: false, mediaQuality: 85,
        mediaResponsiveSizes: [640, 1024, 1920], mediaFormats: ['webp', 'original'],
        lazyLoadImages: true, useSrcset: true, usePictureTag: true,
        searchFullContent: true, relatedArticles: true, cjkSpacing: true, buildReport: true, autoOgImage: true, forceContentWidth: true,
        enableCacheBusting: false, cacheBustingPattern: '.*\\.(css|js|png|jpg|svg)$',
        externalLinksTarget: '_blank', externalLinksRel: 'noopener noreferrer'
      },
      externalLinkWarning: { enabled: false, whitelist: [], blacklist: [] },
      showRepoLink: true, repoUrl: ''
    },
    // Content policy defaults are minimal here — content-policy.json (optional)
    // supplies the real lists; classifyFile() in lib/content-policy.js falls
    // back to its own built-in default policy when keys are absent.
    contentPolicy: { enabled: true },
    tagAliases: { enabled: true, aliases: {} },
    friends: { enabled: false, title: '友情链接', description: '', applyNote: '', friends: [] },
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
      spacing: { containerWidth: '960px', gap: '2rem', padding: '2rem', radius: '0.5rem', radiusLarge: '1rem' },
      shadow: { card: '0 4px 6px rgba(0,0,0,0.1)', dropdown: '0 10px 15px -3px rgba(0,0,0,0.1)', fixed: '0 2px 4px rgba(0,0,0,0.08)' },
      layout: { headerStyle: 'fixed', headerHeight: '60px', footerStyle: 'simple', sidebarPosition: 'right', contentWidth: 'main', postLayout: 'standard', archiveLayout: 'list' },
      animation: { enable: true, transitionDuration: '0.3s', transitionTiming: 'ease-in-out', scrollBehavior: 'smooth', pageTransition: 'fade' },
      codeHighlight: { theme: 'github-dark', highlightLines: true },
      card: { showDate: true, showTags: true, showCategories: true, showExcerpt: true, excerptLength: 150, showReadTime: true, readTimeSpeed: 265, showWordCount: true },
      button: { radius: '0.25rem', padding: '0.5rem 1.5rem', primaryBackground: '#4a90d9', primaryText: '#ffffff', hoverScale: 1.02 },
      customCSS: {},
      externalAssets: { styles: [], scripts: [] },
      contentOffset: 0, headerContentGap: 0, tocWidth: '200px', sidebarWidth: '280px', tocMinLeft: '10px', sidebarMinRight: '10px'
    },
    navigation: { menu: [], navbar: { fixed: true, showLogo: true, logoText: '' }, socialInNav: { enabled: false, order: [] }, search: { enabled: false, placeholder: '搜索...', provider: 'local' }, userMenu: { enabled: false } },
    sidebar: { enabled: false, position: 'right', width: '280px', sticky: true, widgets: [], mobile: { enabled: true, collapsed: true, toggleButton: true, overlay: true } },
    footer: { copyright: '', layout: 'simple', columnItems: { enabled: true, items: [] }, bottomLinks: { enabled: true, items: [] }, social: { enabled: false, iconSize: '24px' }, poweredBy: { enabled: false, text: 'S-ynapse' }, beian: { enabled: false } },
    security: {
      headers: {}, csp: { enabled: false, directives: {}, reportOnly: false },
      robots: { enabled: false, rules: [] },
      rateLimiting: { enabled: false, maxRequests: 100, windowMs: 60000 },
      sri: { enabled: false, algorithms: ['sha256', 'sha384'] },
      pathRestrictions: [], forceHttps: false,
      securityLogging: { enabled: false },
      customHeaders: {},
      contentFilter: { enabled: false, disallowTags: [], disallowAttributes: [], escapeHTML: true },
      uploadSecurity: { maxFileSize: 5242880 }
    }
  };

  const config = deepmerge.all([defaults, { site, theme, navigation, sidebar, footer, security, contentPolicy, features, uiStrings }, { tagAliases: tagAliasData, friends: friendsData }]);
  // Features arrays must replace, not concatenate (e.g. share.order must drop
  // platforms the user removed). Deepmerge's default arrayMerge concatenates,
  // so features gets its own merge pass with a replace strategy.
  config.features = deepmerge.all([{}, DEFAULT_FEATURES, features], { arrayMerge: (target, source) => source });
  // Cloudflare Web Analytics token: explicit config wins, else env fallback.
  if (config.site && config.site.webAnalytics && config.site.webAnalytics.enabled) {
    const wa = config.site.webAnalytics;
    if (!wa.token && process.env.CF_WEB_ANALYTICS_TOKEN) wa.token = process.env.CF_WEB_ANALYTICS_TOKEN;
    if (!wa.token) {
      console.log('  [WARN] webAnalytics.enabled=true but no token set (config token or CF_WEB_ANALYTICS_TOKEN); beacon will not be injected');
      wa.enabled = false;
    }
  }
  // Theme preset resolution: built-in preset → presetOverrides. When a preset
  // is active it takes over colors/dark colors; manual colors field is only
  // honored when preset is null (see theme.json header notes).
  const themeRes = resolveThemePreset(config.theme);
  if (themeRes.warnings.length > 0) {
    themeRes.warnings.forEach(w => console.log('  [WARN] ' + w));
  } else if (themeRes.appliedPreset) {
    console.log('  [THEME] Preset applied: ' + themeRes.appliedPreset);
  }
  config.theme.appliedPreset = themeRes.appliedPreset;
  config.theme.colors = themeRes.colors;
  config.theme.darkMode = themeRes.darkMode;
  // Visual tiers (rounding / shadow / border) resolve to concrete CSS vars.
  applyVisualTiers(config.theme);
  // Layout density tiers (compact/balanced/airy) resolve container/gap/columns.
  applyDensity(config.theme);
  if (config.sidebar && config.theme && config.theme.density && config.theme.density.sidebarWidth) {
    config.sidebar.width = config.theme.density.sidebarWidth;
  }
  // Font system resolves stack → family + Google Fonts link; custom stack keeps
  // the hand-written theme.fontFamily with priority.
  resolveFontSystem(config.theme);
  return config;
}

// DENSITY_TIERS — 三档布局密度。
const DENSITY_TIERS = {
  compact: { containerWidth: '1000px', gap: '1.25rem', sidebarWidth: '240px', columns: 2 },
  balanced: { containerWidth: '1250px', gap: '2rem', sidebarWidth: '280px', columns: 2 },
  airy: { containerWidth: '1400px', gap: '2.5rem', sidebarWidth: '320px', columns: 3 }
};

function applyDensity(theme) {
  if (!theme.density) theme.density = {};
  const preset = theme.density.preset;
  const tier = (preset && DENSITY_TIERS[preset]) || null;
  const d = theme.density;
  theme.density.columns = tier ? tier.columns : (Number.isInteger(d.columns) ? d.columns : 2);
  if (tier) {
    theme.density.containerWidth = tier.containerWidth;
    theme.density.gap = tier.gap;
    theme.density.sidebarWidth = tier.sidebarWidth;
  }
  theme.spacing = theme.spacing || {};
  theme.spacing.containerWidth = theme.density.containerWidth || theme.spacing.containerWidth || '1250px';
  theme.spacing.gap = theme.density.gap || theme.spacing.gap || '2rem';
  theme.sidebarWidth = theme.density.sidebarWidth || theme.sidebarWidth || '280px';
}

// FONT_STACKS — fontSystem.stack 预设枚举 → CSS font-family 栈。
const FONT_STACKS = {
  inter: "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  'noto-sans': "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  'noto-serif': "'Noto Serif SC', Georgia, 'Songti SC', serif",
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
};
const FONT_LINKS = {
  inter: 'https://fonts.googleapis.com/css2?family=Inter&display=swap',
  'noto-sans': 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
  'noto-serif': 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap',
  system: null,
  custom: null
};

function resolveFontSystem(theme) {
  const fs = theme.fontSystem || {};
  const stack = fs.stack || 'inter';
  const family = stack === 'custom'
    ? (fs.customStack || theme.fontFamily || FONT_STACKS.inter)
    : (FONT_STACKS[stack] || FONT_STACKS.inter);
  theme.fontFamily = family;
  theme.fontFamilyHeading = fs.headingStack === 'serif'
    ? "Georgia, 'Noto Serif SC', 'Songti SC', 'STSong', serif"
    : (fs.headingStack === 'sans' ? FONT_STACKS.inter : family);
  theme.fontScale = (typeof fs.scale === 'number' && fs.scale > 0 && fs.scale <= 2) ? fs.scale : 1;
  theme.fontNumbersMono = fs.numbersMono !== false;
  const link = FONT_LINKS[stack] || null;
  if (link) {
    theme.externalAssets = theme.externalAssets || { styles: [], scripts: [] };
    theme.externalAssets.styles = theme.externalAssets.styles.filter(s => s !== link);
    theme.externalAssets.styles.unshift(link);
  }
}

// VISUAL_TIERS — rounding/shadowLevel/borderStyle 档位 → 具体 CSS 变量值。
// 这些档位只叠加非颜色项（spacing.radius/shadow.*/colors.border），
// 与预设色板正交，可在任何预设下自由组合。
const VISUAL_ROUNDING = {
  sharp: { radius: '2px', radiusLarge: '8px', button: '2px' },
  sm: { radius: '4px', radiusLarge: '10px', button: '3px' },
  md: { radius: '0.5rem', radiusLarge: '1rem', button: '0.25rem' },
  lg: { radius: '0.75rem', radiusLarge: '1.25rem', button: '0.5rem' }
};
const VISUAL_SHADOW = {
  flat: { card: 'none', dropdown: 'none', fixed: 'none' },
  soft: { card: '0 4px 6px rgba(0,0,0,0.1)', dropdown: '0 10px 15px -3px rgba(0,0,0,0.1)', fixed: '0 2px 4px rgba(0,0,0,0.08)' },
  medium: { card: '0 6px 16px rgba(0,0,0,0.12)', dropdown: '0 12px 28px rgba(0,0,0,0.14)', fixed: '0 2px 8px rgba(0,0,0,0.10)' },
  strong: { card: '0 12px 32px rgba(0,0,0,0.16)', dropdown: '0 18px 44px rgba(0,0,0,0.18)', fixed: '0 4px 14px rgba(0,0,0,0.14)' }
};
const VISUAL_BORDER = {
  none: { light: '#00000000', dark: '#00000000' },
  subtle: { light: '#e2e8f0', dark: '#334155' },
  visible: { light: '#cbd5e1', dark: '#475569' }
};

function applyVisualTiers(theme) {
  const rd = VISUAL_ROUNDING[theme.rounding] || VISUAL_ROUNDING.md;
  const sh = VISUAL_SHADOW[theme.shadowLevel] || VISUAL_SHADOW.soft;
  const bd = VISUAL_BORDER[theme.borderStyle] || VISUAL_BORDER.subtle;
  theme.spacing.radius = rd.radius;
  theme.spacing.radiusLarge = rd.radiusLarge;
  theme.button.radius = rd.button;
  theme.shadow.card = sh.card;
  theme.shadow.dropdown = sh.dropdown;
  theme.shadow.fixed = sh.fixed;
  if (!theme.colors) theme.colors = {};
  theme.colors.border = bd.light;
  if (theme.darkMode && theme.darkMode.enabled) {
    if (!theme.darkMode.colors) theme.darkMode.colors = {};
    theme.darkMode.colors.border = bd.dark;
  }
}

// Validate merged config for required fields and suspicious values.
// Returns boolean. Errors = build-stopping problems. Warnings = advisory only.
// Caller must check the return value and abort if false.
function validateConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config.site.title) errors.push('site.title is required');
  if (!config.site.url) errors.push('site.url is required');
  if (config.site.url && !/^https?:\/\//.test(config.site.url)) errors.push('site.url must start with http:// or https://');
  if (!config.site.language) errors.push('site.language is required');
  if (!config.site.postsPerPage || config.site.postsPerPage < 1) errors.push('site.postsPerPage must be >= 1');

  if (config.site.rss && config.site.rss.enabled) {
    if (!config.site.rss.path) warnings.push('site.rss.path not set, using default /feed.xml');
  }
  if (config.site.sitemap && config.site.sitemap.enabled) {
    if (!['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].includes(config.site.sitemap.changefreq)) {
      warnings.push(`site.sitemap.changefreq "${config.site.sitemap.changefreq}" is not standard`);
    }
  }

  if (config.theme.colors) {
    for (const [key, val] of Object.entries(config.theme.colors)) {
      if (val && !val.startsWith('#') && !val.startsWith('rgba') && !val.startsWith('rgb(')) {
        warnings.push(`theme.colors.${key}: "${val}" may not be a valid color`);
      }
    }
  }
  if (config.theme.darkMode && config.theme.darkMode.enabled) {
    if (!['light', 'dark', 'system'].includes(config.theme.darkMode.default)) {
      errors.push('theme.darkMode.default must be "light", "dark", or "system"');
    }
  }
  if (config.theme.spacing) {
    const cw = config.theme.spacing.containerWidth;
    if (cw && !/^\d+(px|rem|em|%|vw)$/.test(cw)) warnings.push(`theme.spacing.containerWidth "${cw}" may be invalid`);
  }

  if (config.navigation.menu) {
    for (const item of config.navigation.menu) {
      if (!item.label) errors.push('navigation.menu item missing label');
      if (!item.url) errors.push('navigation.menu item missing url');
    }
  }

  if (config.sidebar && config.sidebar.enabled && config.sidebar.widgets) {
    const validTypes = ['author', 'recent', 'tags', 'categories', 'archive', 'search', 'custom', 'newsletter', 'toc', 'series', 'friends', 'stats', 'quote'];
    for (const w of config.sidebar.widgets) {
      if (w.enabled && !validTypes.includes(w.type)) warnings.push(`sidebar.widget type "${w.type}" is unknown`);
    }
  }

  if (config.security.csp && config.security.csp.enabled) {
    if (config.security.csp.directives['script-src'] && config.security.csp.directives['script-src'].includes("'unsafe-inline'")) {
      warnings.push('security.csp: script-src includes unsafe-inline, consider removing for stricter CSP');
    }
  }

  const featureResults = validateFeatures(config.features, 'features');
  errors.push(...featureResults.errors);
  warnings.push(...featureResults.warnings);

  const themeErrors = validateThemePreset(config.theme);
  errors.push(...themeErrors);
  if (config.theme.rounding && !VISUAL_ROUNDING[config.theme.rounding]) errors.push('theme.rounding 无效，可选: sharp | sm | md | lg');
  if (config.theme.shadowLevel && !VISUAL_SHADOW[config.theme.shadowLevel]) errors.push('theme.shadowLevel 无效，可选: flat | soft | medium | strong');
  if (config.theme.borderStyle && !VISUAL_BORDER[config.theme.borderStyle]) errors.push('theme.borderStyle 无效，可选: none | subtle | visible');

  if (errors.length > 0) {
    console.error('\n[CONFIG VALIDATION ERRORS]');
    errors.forEach(e => console.error('  - ' + e));
    return false;
  }
  if (warnings.length > 0) {
    console.warn('\n[CONFIG WARNINGS]');
    warnings.forEach(w => console.warn('  - ' + w));
  }
  return true;
}

// Generate an SVG Open Graph image for social sharing (1200×630).
// Uses theme colors for background gradient, auto-splits long titles onto two lines.
// Output is written to dist/media/og/{slug}.svg during article processing.

// Create the output directory structure under dist/.
// If cleanDist is enabled, removes the entire dist/ first.
// Required subdirectories: articles/, tags/, categories/, page/
function setupDist(config) {
  console.log('[2/14] Setting up dist directory...');
  if (config.site.build.cleanDist && fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    console.log('  Cleaned dist/');
  }
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Copy everything from static/ into dist/ as-is.
// This covers: icons, media assets, fonts, and any other unprocessed files.
function copyStatic(config) {
  if (!config.site.build.copyStatic || !fs.existsSync(STATIC_DIR)) {
    console.log('  [SKIP] Static copy disabled or static/ not found');
    return;
  }
  console.log('[3/14] Copying static files...');
  copyDirSync(STATIC_DIR, DIST_DIR);
}

// Recursive directory copy — creates destination directories on the fly.
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Apply the content policy (content-policy.json) to videos/, assets/, and the
// non-sharp-optimized part of media/ (svg sanitized, gif/avif/bmp/ico raw copy).
// Violations are NOT copied → the deployed URL naturally 404s.
// Returns { copied, blocked: [{ path, reason }] } for the build report.
function copyProtectedAssets(config) {
  const policy = config.contentPolicy || {};
  if (policy.enabled === false) {
    console.log('  [SKIP] Content policy disabled');
    return { copied: 0, blocked: [] };
  }
  console.log('  [POLICY] Applying content policy to videos/, assets/, media/...');
  const blocked = [];
  let copied = 0;

  const copyFiltered = (srcDir, destDir, srcCategory) => {
    if (!fs.existsSync(srcDir)) return;
    for (const srcPath of getAllFiles(srcDir)) {
      const rel = path.relative(srcDir, srcPath);
      const baseName = rel.replace(/\\/g, '/').split('/').pop().toLowerCase();
      if (baseName === '.gitkeep') continue; // directory placeholder, never published
      const verdict = classifyFile(rel, srcCategory, policy);
      if (!verdict.allowed) {
        blocked.push({ path: `${srcCategory}/${rel.replace(/\\/g, '/')}`, reason: verdict.reason });
        continue;
      }
      const destPath = path.join(destDir, rel);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  };

  copyFiltered(ASSETS_DIR, path.join(DIST_DIR, 'assets'), 'assets');
  copyFiltered(VIDEOS_DIR, path.join(DIST_DIR, 'videos'), 'videos');

  // media/: files sharp does not handle are copied verbatim here (svg after
  // sanitization). Files classified 'media-optimized' are left to optimizeMedia().
  if (policy.svgSanitize !== false && fs.existsSync(MEDIA_DIR)) {
    const mediaDest = path.join(DIST_DIR, 'media');
    for (const srcPath of getAllFiles(MEDIA_DIR)) {
      const rel = path.relative(MEDIA_DIR, srcPath);
      const baseName = rel.replace(/\\/g, '/').split('/').pop().toLowerCase();
      if (baseName === '.gitkeep') continue;
      const verdict = classifyFile(rel, 'media', policy);
      if (!verdict.allowed) {
        blocked.push({ path: `media/${rel.replace(/\\/g, '/')}`, reason: verdict.reason });
        continue;
      }
      if (verdict.category === 'media-optimized') continue;
      const destPath = path.join(mediaDest, rel);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      if (/\.svg$/i.test(srcPath)) {
        const svg = sanitizeSvg(fs.readFileSync(srcPath, 'utf-8'));
        if (!svg.safe) {
          blocked.push({ path: `media/${rel.replace(/\\/g, '/')}`, reason: 'svg-unsafe' });
          continue;
        }
        fs.writeFileSync(destPath, svg.content, 'utf-8');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
      copied++;
    }
  }

  if (blocked.length) {
    console.warn(`  [POLICY] Blocked ${blocked.length} file(s) by content policy:`);
    for (const b of blocked) console.warn(`    - ${b.path} (${b.reason})`);
  } else {
    console.log(`  [POLICY] Copied ${copied} protected asset(s), no violations`);
  }
  return { copied, blocked };
}

// Optimize images from media/ using sharp.
// Generates responsive variants at configured sizes and formats (WebP + original).
// Output: dist/media/ with a media-manifest.json mapping original paths to variants.
// The manifest is consumed by setupMarkedRenderer for <picture>/<img> tag generation.
// Returns the manifest object, or null if disabled/sharp unavailable.
async function optimizeMedia(config) {
  if (!config.site.build.optimizeMedia || !sharp) {
    console.log('  [SKIP] Media optimization disabled or sharp not available');
    return null;
  }
  console.log('[4/14] Optimizing media...');
  if (!fs.existsSync(MEDIA_DIR)) {
    console.log('  media/ directory not found, skipping');
    return null;
  }
  const manifest = {};
  const sizes = config.site.build.mediaResponsiveSizes || [640, 1024, 1920];
  const quality = config.site.build.mediaQuality || 85;
  const avifCfg = config.site.build.avif || { enabled: false, quality: 50, effort: 6 };
  const formats = config.site.build.mediaFormats || ['webp', 'original'];
  const destDir = path.join(DIST_DIR, 'media');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const images = getAllFiles(MEDIA_DIR).filter(f => /\.(jpg|jpeg|png|gif|tiff|webp)$/i.test(f));
  let count = 0;
  for (const imgPath of images) {
    const relPath = path.relative(MEDIA_DIR, imgPath);
    const parsed = path.parse(relPath);
    const ext = parsed.ext.toLowerCase();
    const supportedExts = ['.jpg', '.jpeg', '.png', '.tiff', '.webp'];
    if (!supportedExts.includes(ext)) continue;
    try {
      const metadata = await sharp(imgPath).metadata();
      const originalWidth = metadata.width;
      const urlDir = parsed.dir ? parsed.dir + '/' : '';
      const entry = { original: `/media/${urlDir}${parsed.base}`, variants: {} };
      const activeFormats = avifCfg.enabled ? ['avif', ...formats.filter(f => f !== 'avif')] : formats;
      for (const size of sizes) {
        if (originalWidth <= size) continue;
        for (const fmt of activeFormats) {
          const suffix = fmt === 'original' ? ext : fmt === 'webp' ? '.webp' : '.avif';
          const variantName = `${parsed.name}-${size}${suffix}`;
          const outPath = path.join(destDir, parsed.dir || '', variantName);
          const outDir = path.dirname(outPath);
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          let pipeline = sharp(imgPath).resize(size, null, { withoutEnlargement: true });
          if (fmt === 'webp') pipeline = pipeline.webp({ quality });
          else if (fmt === 'avif') pipeline = pipeline.avif({ quality: avifCfg.quality || 50, effort: avifCfg.effort || 6 });
          else if (ext === '.png') pipeline = pipeline.png({ quality });
          else pipeline = pipeline.jpeg({ quality });
          await pipeline.toFile(outPath);
          entry.variants[`${size}-${fmt}`] = `/media/${urlDir}${variantName}`;
        }
      }
      const originalDest = path.join(destDir, parsed.dir || '', parsed.base);
      const origDir = path.dirname(originalDest);
      if (!fs.existsSync(origDir)) fs.mkdirSync(origDir, { recursive: true });
      fs.copyFileSync(imgPath, originalDest);
      manifest[`media/${relPath.replace(/\\/g, '/')}`] = entry;
      count++;
    } catch (err) {
      console.error(`  [ERROR] Failed to optimize ${relPath}: ${err.message}`);
    }
  }
  const manifestPath = path.join(DIST_DIR, 'media-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`  Optimized ${count} images`);
  return manifest;
}

// Recursive file listing — returns absolute paths of all files under a directory.
function getAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllFiles(full));
    else results.push(full);
  }
  return results;
}

// Read the media manifest from dist/ (build output) or root (pre-generated).
// The manifest maps original image paths to their responsive variants.
// Returns null if no manifest exists (images render without optimization).
function getMediaManifest() {
  const manifestPath = path.join(DIST_DIR, 'media-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try { return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch (e) {
      console.warn(`  [WARN] Failed to parse media manifest: ${e.message}`);
    }
  }
  const rootManifest = path.join(ROOT, 'media-manifest.json');
  if (fs.existsSync(rootManifest)) {
    try { return JSON.parse(fs.readFileSync(rootManifest, 'utf-8')); } catch (e) {
      console.warn(`  [WARN] Failed to parse root media manifest: ${e.message}`);
    }
  }
  return null;
}

// Configure the marked Markdown renderer with custom handlers for:
// - Image: responsive <picture> tags with WebP sources (when mediaManifest is available)
// - Link: external links get target="_blank" + rel="noopener noreferrer"
// - Heading: h2-h4 get anchor links (slugified IDs) for ToC navigation
// - Code: language-labeled <pre> blocks with optional line numbers
// Called once per build before article/page parsing.
function setupMarkedRenderer(config, mediaManifest) {
  const F = config.features || {};
  const imgLazy = (F.imageLazy && F.imageLazy.enabled !== false);
  const usePicture = config.site.build.usePictureTag !== false;
  const showLineNumbers = !!(F.codeBlock && (F.codeBlock.lineNumbers || F.codeBlock.showLineNumbers));
  const extTarget = config.site.build.externalLinksTarget || '_blank';
  const extRel = config.site.build.externalLinksRel || 'noopener noreferrer';
  const siteUrl = (config.site.url || '').replace(/\/+$/, '');

  // Math-guard extension: captures KaTeX-style math spans (*before* supSub / other
  // inline extensions) so that superscript/subscript syntax inside formulas stays
  // untouched for client-side auto-render (KaTeX).
  // - Block level:  $$ ... $$ (may span lines)
  // - Inline level: $ ... $, \( ... \), \[ ... \]
  marked.use({
    extensions: [
      {
        name: 'mathGuardBlock',
        level: 'block',
        start(src) {
          // Block formulas must start a line (^$$) — not appear mid-line
          // or inside inline code spans.
          const m = /^\$\$/m.exec(src);
          return m ? m.index : undefined;
        },
        tokenizer(src) {
          const m = /^\$\$[\s\S]*?\$\$/.exec(src);
          if (m) return { type: 'mathGuardBlock', raw: m[0] };
          return undefined;
        },
        renderer(token) { return token.raw; }
      },
      {
        name: 'mathGuardInline',
        level: 'inline',
        start(src) {
          // Skip backtick-wrapped inline code spans: math delimiters inside
          // `code` must stay untouched for marked's code tokenizer.
          let inCode = false;
          for (let i = 0; i < src.length; i++) {
            if (src[i] === '`') {
              while (i < src.length && src[i] === '`') i++;
              inCode = !inCode;
              i--;
              continue;
            }
            if (inCode) continue;
            if (src[i] === '$' || src[i] === '\\') return i;
          }
          return undefined;
        },
        tokenizer(src) {
          const m = /^(?:\$\$(?!\s)[^\n]*?\$\$|\$(?!\$)(?:\\.|[^$\\\n])+\$(?!\d)|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/.exec(src);
          if (m) return { type: 'mathGuardInline', raw: m[0] };
          return undefined;
        },
        renderer(token) { return token.raw; }
      }
    ]
  });

  // Superscript / subscript extension (marked 12 has no built-in ^x^ / ~x~ syntax):
  marked.use({
    extensions: [{
      name: 'supSub',
      level: 'inline',
      start(src) {
        const m = src.match(/[\^~]/);
        return m ? m.index : undefined;
      },
      tokenizer(src) {
        const match = /^([~^])([^~^\n]+?)\1/.exec(src);
        if (match) {
          return {
            type: 'supSub',
            raw: match[0],
            text: match[2],
            up: match[1] === '^'
          };
        }
        return undefined;
      },
      renderer(token) {
        const body = escapeHtml(token.text);
        return token.up ? `<sup>${body}</sup>` : `<sub>${body}</sub>`;
      }
    }]
  });

  marked.use({
    renderer: {
      // Task-list checkbox with accessible name (WCAG label):
      checkbox(checked) {
        return `<input type="checkbox" disabled${checked ? ' checked' : ''} aria-label="任务">`;
      },
      // Image renderer with responsive fallback chain:
      // 1. If usePicture + manifest: <picture> with WebP + size variants + original fallback
      // 2. If manifest only (picture disabled): <img> with original path from manifest
      // 3. No manifest: raw <img> with the href as-is
      image(href, title, text) {
        if (!href) return '';
        const alt = text || '';
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        const loading = imgLazy ? ' loading="lazy"' : '';
        const decodedHref = href.replace(/&amp;/g, '&');
        if (usePicture && mediaManifest) {
          const normHref = decodedHref.replace(/^\//, '');
          const entry = mediaManifest[normHref];
          if (entry && entry.variants && Object.keys(entry.variants).length > 0) {
            const webpSources = [];
            const avifSources = [];
            const origSources = [];
            const sizesAttr = '(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1920px';
            for (const [key, val] of Object.entries(entry.variants)) {
              const [size, fmt] = key.split('-');
              const escaped = escapeAttr(val);
              if (fmt === 'webp') webpSources.push(`  <source srcset="${escaped}" sizes="${sizesAttr}" type="image/webp">`);
              else if (fmt === 'avif') avifSources.push(`  <source srcset="${escaped}" sizes="${sizesAttr}" type="image/avif">`);
              else origSources.push(`  <source srcset="${escaped}" sizes="${sizesAttr}" type="image/${fmt}">`);
            }
            const fallbackSrc = escapeAttr(entry.original || decodedHref);
            let html = '<picture>\n';
            html += avifSources.join('\n');
            if (avifSources.length && (webpSources.length || origSources.length)) html += '\n';
            html += webpSources.join('\n');
            if (webpSources.length && origSources.length) html += '\n';
            html += origSources.join('\n') + '\n';
            html += `  <img src="${fallbackSrc}" alt="${escapeAttr(alt)}"${titleAttr}${loading}>\n`;
            html += '</picture>';
            return html;
          }
        }
        if (mediaManifest) {
          const norm = decodedHref.replace(/^\//, '');
          const entry = mediaManifest[norm];
          if (entry && entry.original) {
            return `<img src="${escapeAttr(entry.original)}" alt="${escapeAttr(alt)}"${titleAttr}${loading}>`;
          }
        }
        return `<img src="${escapeAttr(decodedHref)}" alt="${escapeAttr(alt)}"${titleAttr}${loading}>`;
      },

      // Link renderer — adds target="_blank" + rel="noopener noreferrer" to external links.
      // Internal links (starts with site URL or relative) render as-is.
      // If href is empty, returns the link text unwrapped (safe fallback).
      link(href, title, text) {
        if (!href) return text || '';
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        const isExternal = /^https?:\/\//.test(href) && !href.startsWith(siteUrl);
        let extra = '';
        if (isExternal) {
          extra += ` target="${escapeAttr(extTarget)}" rel="${escapeAttr(extRel)}"`;
        }
        return `<a href="${escapeAttr(href)}"${titleAttr}${extra}>${text}</a>`;
      },

      // Heading renderer — generates anchor-linked headings for h2-h4.
      // h1 (page title) and h5-h6 do not get anchor links.
      // The anchor uses safeSlug() on the stripped text for URL-friendly IDs.
      heading(text, level) {
        if (level < 2 || level > 4) return `<h${level}>${text}</h${level}>`;
        const id = safeSlug(text.replace(/<[^>]+>/g, ''));
        return `<h${level} id="${escapeAttr(id)}"><a href="#${escapeAttr(id)}" class="heading-anchor">#</a>${text}</h${level}>`;
      },

      // Code block renderer — wraps in <pre><code> with language class.
      // When line numbers are enabled, adds data-line-numbers attribute.
      // The data-language attribute drives the CSS ::before label in layout.ejs.
      code(text, lang) {
        const langAttr = lang ? ` class="language-${escapeAttr(lang)}"` : '';
        const lnAttr = showLineNumbers ? ' data-line-numbers="true"' : '';
        const langLabel = lang ? ` data-language="${escapeAttr(lang)}"` : '';
        return `<pre${lnAttr}${langLabel}><code${langAttr}>${escapeHtml(text)}</code></pre>`;
      }
    }
  });
}

// Load Markdown content from pages/ as key-value map (filename → {title, content, body}).
// Used by templates (e.g. article footer) for content that needs to be embedded into pages
// without being rendered as a standalone HTML page. Also consumed by processCustomPages
// which renders the same files as full standalone pages.
// Key = filename without .md extension.
function processPagesContent(config) {
  const result = {};
  if (!fs.existsSync(PAGES_DIR)) {
    console.warn('  [WARN] pages/ directory not found, pages content will not be available');
    return null;
  }
  const files = fs.readdirSync(PAGES_DIR).filter(f => /\.md$/i.test(f));
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(PAGES_DIR, file), 'utf-8');
      const fm = frontMatter(raw);
      const body = fm.body || '';
      const name = path.basename(file, '.md');
      result[name] = {
        title: (fm.attributes && fm.attributes.title) || name,
        content: applyCjkSpacingToHtml ? sanitizeHtml(applyCjkSpacingToHtml(marked.parse(body))) : sanitizeHtml(marked.parse(body)),
        body: body
      };
    } catch (err) {
      console.error(`  [ERROR] Failed to process page content ${file}: ${err.message}`);
    }
  }
  if (!Object.keys(result).length) {
    console.warn('  [WARN] pages/ directory is empty, pages content will not be available');
    return null;
  }
  return result;
}

// Parse all Markdown articles from articles/ into structured article objects.
// For each article:
//   1. Extract frontmatter (title, slug, date, tags, categories, draft, excerpt)
//   2. Validate: max 1 h1 per article, reject articles with >1 h1
//   3. Render Markdown → HTML using marked with the custom renderer
//   4. Auto-generate excerpt from content if not in frontmatter
//   5. Calculate read time based on word count
//   6. Extract table of contents from headings
//   7. Auto-generate OG image if no featuredImage in frontmatter
//   8. If hooks.transformMarkdown exists, run content through it first
// Returns array sorted by date descending.
// Articles with multiple h1 tags are skipped with error.
async function processArticles(config, mediaManifest) {
  console.log('[5/14] Processing articles...');
  setupMarkedRenderer(config, mediaManifest);
  const articles = [];
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.log('  articles/ directory not found');
    return articles;
  }
  const LANGS = ['zh', 'en'];
  const files = [];
  for (const lang of LANGS) {
    const langDir = path.join(ARTICLES_DIR, lang);
    if (fs.existsSync(langDir)) {
      for (const f of fs.readdirSync(langDir).filter(ff => /\.md$/i.test(ff))) {
        files.push({ file: f, lang, dir: langDir });
      }
    }
  }
  // Pre-scan pass: build a title/slug lookup so [[wiki links]] resolve across articles.
  const wikiLookup = { titles: new Map(), slugs: new Map() };
  const tagAliasesCfg = config.tagAliases || {};
  const aliasEnabled = tagAliasesCfg.enabled !== false;
  const tagAliases = tagAliasesCfg.aliases && typeof tagAliasesCfg.aliases === 'object' ? tagAliasesCfg.aliases : {};
  for (const meta of files) {
    const { file, lang } = meta;
    try {
      const fm = frontMatter(fs.readFileSync(path.join(meta.dir, file), 'utf-8'));
      const attrs = fm.attributes || {};
      const t = attrs.title || '';
      const s = attrs.slug || (t ? safeSlug(t) : path.basename(file, '.md').replace(/\.md$/i, ''));
      const entry = { title: t || s, url: '/' + lang + '/' + s + '/' };
      wikiLookup.titles.set((t || s).toLowerCase(), entry);
      wikiLookup.slugs.set(s, entry);
    } catch (e) { /* skip unreadable files in lookup */ }
  }
  function applyTagAliases(tags) {
    if (!aliasEnabled || !Object.keys(tagAliases).length) return tags;
    return tags.map(function(tag) {
      const k = (tag || '').trim();
      const direct = tagAliases[k];
      if (direct) return String(direct);
      const lowHit = tagAliases[k.toLowerCase()];
      if (lowHit) return String(lowHit);
      return tag;
    });
  }
  const MATH_RX = /(\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/;
  const MERMAID_RX = /```[ \t]*mermaid\b/i;
  const seenSlugs = new Map();
  for (const meta of files) {
    const { file, lang } = meta;
    const filePath = path.join(meta.dir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const fm = frontMatter(raw);
      const attrs = fm.attributes || {};
      let content = fm.body || '';
      if (hooks && hooks.transformMarkdown) {
        content = hooks.transformMarkdown(content, attrs) || content;
      }
      const noCodeContent = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
      const h1Matches = noCodeContent.match(/^#\s+/gm);
      const h1Count = h1Matches ? h1Matches.length : 0;
      if (h1Count > 1) {
        console.error(`  [ERROR] ${file}: ${h1Count} h1 headings found (max 1). Skipping.`);
        continue;
      }
      // Title resolution priority: frontmatter.title > first markdown h1 > filename
      let title = attrs.title || '';
      if (!title) {
        const firstH1 = content.match(/^#\s+(.+)/m);
        title = firstH1 ? firstH1[1].trim() : path.basename(file, '.md');
      }
      // Slug priority: frontmatter.slug > safeSlug(title)
      const slug = attrs.slug || safeSlug(title);
      if ((seenSlugs.get(lang) || new Set()).has(slug)) {
        console.error(`  [ERROR] ${file}: duplicate slug "${slug}" (already used by another article in ${lang}). Skipping.`);
        continue;
      }
      if (!seenSlugs.has(lang)) seenSlugs.set(lang, new Set());
      seenSlugs.get(lang).add(slug);
      const url = `/${lang}/${slug}/`;
      const excerpt = attrs.excerpt || '';
      const date = attrs.date || null;
      if (date && isNaN(new Date(date).getTime())) {
        console.error(`  [ERROR] ${file}: frontmatter "date: ${date}" is not a valid date. Expected YYYY-MM-DD or ISO 8601. Skipping.`);
        continue;
      }
      if (!date) {
        console.warn(`  [WARN] ${file}: no frontmatter date; article is sorted before dated posts (use "date: YYYY-MM-DD" to control order).`);
      }
      if (attrs.tags !== undefined && !Array.isArray(attrs.tags)) {
        console.warn(`  [WARN] ${file}: frontmatter "tags" must be an array like ["a","b"]; auto-splitting "${attrs.tags}" on commas.`);
        attrs.tags = String(attrs.tags).split(',').map(function(s2) { return s2.trim(); }).filter(Boolean);
      }
      if (attrs.categories !== undefined && !Array.isArray(attrs.categories)) {
        console.warn(`  [WARN] ${file}: frontmatter "categories" must be an array like ["a"]; auto-splitting "${attrs.categories}" on commas.`);
        attrs.categories = String(attrs.categories).split(',').map(function(s2) { return s2.trim(); }).filter(Boolean);
      }
      const tags = applyTagAliases(Array.isArray(attrs.tags) ? attrs.tags : []);
      const categories = Array.isArray(attrs.categories) ? attrs.categories : [];
      const draft = attrs.draft === true || attrs.draft === 'true';
      const pinned = attrs.pinned === true || attrs.pinned === 'true';
      const series = attrs.series ? String(attrs.series).trim() : null;
      content = resolveWikiLinks(content, wikiLookup);
      const hasMath = MATH_RX.test(content);
      const hasMermaid = MERMAID_RX.test(content);
      let htmlContent = marked.parse(content);
      if (config.site.build.cjkSpacing !== false) htmlContent = applyCjkSpacingToHtml(htmlContent);
      htmlContent = sanitizeHtml(htmlContent);
      // Auto-generate excerpt from rendered HTML (strip tags, truncate)
      let excerptText = excerpt;
      if (!excerptText) {
        const textOnly = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const as = (config.features && config.features.autoSummary) || {};
        const excerptLen = as.maxLength || config.site.build.excerptLength || config.theme.card?.excerptLength || 150;
        excerptText = textOnly.length > excerptLen ? textOnly.slice(0, excerptLen) + (as.ellipsis || '...') : textOnly;
      }
      // Read time: word count (CJK-aware) / reading speed (default 265 wpm), minimum 1 minute
      const wordCount = countWords(content);
      const readSpeed = (config.features && config.features.wordCount && config.features.wordCount.wpm) || config.theme.card?.readTimeSpeed || 265;
      const readTime = Math.max(1, Math.ceil(wordCount / readSpeed));
      const toc = extractToc(htmlContent);
      // Auto OG image handled by scripts/generate-og.js (per-language PNG pipeline).

      articles.push({
        slug, title, url, date, tags, categories, draft, pinned, series,
        lang, langPrefix: '/' + lang + '/',
        content: htmlContent,
        excerpt: excerptText,
        wordCount, readTime, toc, hasMath, hasMermaid,
        featuredImage: attrs.featuredImage || '',
        frontmatter: attrs,
        filename: file,
        year: date ? new Date(date).getFullYear() : null,
        month: date ? String(new Date(date).getMonth() + 1).padStart(2, '0') : null,
        formattedDate: date ? formatDate(date, config.site.dateFormat) : ''
      });
      console.log(`  Processed: ${file} -> ${url}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to process ${file}: ${err.message}`);
    }
  }
  articles.sort((a, b) => {
    const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (!a.date && !b.date) return a.title.localeCompare(b.title);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });
  console.log(`  Total: ${articles.length} articles processed`);
  return articles;
}

// Aggregate tags across all articles with count and slugified URL.
// Returns array sorted by count descending.
function collectTopTags(articles, limit, lang) {
  const counts = {};
  const published = getPublished(articles).filter(a => !lang || a.lang === lang);
  published.forEach(function(a) {
    (a.tags || []).forEach(function(t) { counts[t] = (counts[t] || 0) + 1; });
  });
  const prefix = lang ? '/' + lang : '';
  return Object.keys(counts)
    .sort(function(a, b) { return counts[b] - counts[a] || a.localeCompare(b); })
    .slice(0, limit || 8)
    .map(function(t) { return { name: t, count: counts[t], url: prefix + '/tags/' + safeSlug(t) + '/' }; });
}

function collectTags(articles) {
  const result = [];
  const langSet = new Set(articles.map(a => a.lang).filter(Boolean));
  for (const lang of langSet) {
    const map = new Map();
    for (const a of articles) {
      if (a.lang !== lang) continue;
      for (const tag of a.tags) {
        const slug = safeSlug(tag);
        if (!map.has(slug)) map.set(slug, { name: tag, slug, count: 0, url: `/${lang}/tags/${slug}/`, lang });
        map.get(slug).count++;
      }
    }
    for (const v of Array.from(map.values()).sort((a, b) => b.count - a.count)) result.push(v);
  }
  return result;
}

// Compute related articles using a tag/category scoring algorithm.
// Each shared tag = 3 points, each shared category = 2 points.
// Top N results are stored in-memory on each article object (article.relatedArticles).
// Called before page generation so templates can access relatedArticles directly.
function computeRelatedArticles(articles, maxCount) {
  maxCount = maxCount || 4;
  const published = getPublished(articles);
  for (const article of published) {
    const scored = [];
    for (const other of published) {
      if (other.slug === article.slug) continue;
      let score = 0;
      const sharedTags = article.tags.filter(t => other.tags.includes(t));
      score += sharedTags.length * 3;
      const sharedCategories = article.categories.filter(c => other.categories.includes(c));
      score += sharedCategories.length * 2;
      if (score > 0) scored.push({ slug: other.slug, title: other.title, url: other.url, score, tags: sharedTags, excerpt: other.excerpt || '' });
    }
    scored.sort((a, b) => b.score - a.score);
    article.relatedArticles = scored.slice(0, maxCount);
  }
}

// Group articles into series (front-matter `series`). Each series lists its
// articles in chronological order (oldest first) and annotates each article
// with prev/next navigation inside the series for the detail-page panel.
function collectSeries(articles) {
  const map = new Map();
  for (const a of articles) {
    if (!a.series) continue;
    if (!map.has(a.series)) map.set(a.series, []);
    map.get(a.series).push(a);
  }
  const result = [];
  for (const [name, list] of map) {
    list.sort((x, y) => {
      if (!x.date && !y.date) return x.title.localeCompare(y.title);
      if (!x.date) return 1;
      if (!y.date) return -1;
      return new Date(x.date) - new Date(y.date);
    });
    list.forEach(function(a, i) {
      a.seriesIndex = i + 1;
      a.seriesTotal = list.length;
      a.seriesPrevUrl = i > 0 ? list[i - 1].url : null;
      a.seriesNextUrl = i < list.length - 1 ? list[i + 1].url : null;
    });
    result.push({ name, slug: safeSlug(name), count: list.length, firstUrl: list[0].url, articles: list });
  }
  return result.sort((a, b) => b.count - a.count);
}

function collectFriends(config) {
  const cfg = config.friends || {};
  if (!cfg.enabled || !Array.isArray(cfg.friends) || !cfg.friends.length) return null;
  return cfg;
}

// Extract all media images referenced by published articles (featured images
// plus inline markdown images) for the /gallery/ page. Deduplicates by src.
// Returns array of {src, title, url, alt} sorted by source-article date desc.
function collectGalleryImages(articles) {
  const seen = new Set();
  const items = [];
  const published = getPublished(articles);
  // Newest first; markdown body images come before the featured image so the
  // cover is not presented first.
  const newOrder = published.slice().reverse();
  const IMG_RX = /<img[^>]+src="([^"]+)"/g;
  for (const a of newOrder) {
    for (let m = IMG_RX.exec(a.content); m !== null; m = IMG_RX.exec(a.content)) {
      const src = m[1].startsWith('/') ? m[1] : null;
      if (!src || seen.has(src)) continue;
      seen.add(src);
      items.push({ src, title: a.title, url: a.url, alt: a.title });
    }
    if (a.featuredImage && !seen.has(a.featuredImage)) {
      seen.add(a.featuredImage);
      items.push({ src: a.featuredImage, title: a.title, url: a.url, alt: a.title });
    }
  }
  return items;
}

// Aggregate simple site statistics for the archive stats panel and sidebar
// widget: published counts, total words, first/last publish date and daily avg.
function collectSiteStats(articles, tags, categories) {
  const published = getPublished(articles);
  let words = 0;
  let early = null;
  let late = null;
  for (const a of published) {
    words += (a.wordCount || 0);
    if (a.date) {
      const t = new Date(a.date).getTime();
      if (!early || t < early) early = t;
      if (!late || t > late) late = t;
    }
  }
  const days = early && late ? Math.max(1, Math.floor((late - early) / 86400000) + 1) : 0;
  const count = published.length;
  return {
    posts: count,
    words,
    tags: (tags || []).length,
    categories: (categories || []).length,
    earliestDate: early ? new Date(early) : null,
    latestDate: late ? new Date(late) : null,
    days,
    avgPerDay: days && count ? (count / days).toFixed(2) : 0
  };
}

// Aggregate categories across all articles with count and slugified URL.
// Returns array sorted by count descending.
function collectCategories(articles) {
  const result = [];
  const langSet = new Set(articles.map(a => a.lang).filter(Boolean));
  for (const lang of langSet) {
    const map = new Map();
    for (const a of articles) {
      if (a.lang !== lang) continue;
      for (const cat of a.categories) {
        const slug = safeSlug(cat);
        if (!map.has(slug)) map.set(slug, { name: cat, slug, count: 0, url: `/${lang}/categories/${slug}/`, lang });
        map.get(slug).count++;
      }
    }
    for (const v of Array.from(map.values()).sort((a, b) => b.count - a.count)) result.push(v);
  }
  return result;
}

// Group articles by year-month for the archive page.
// Articles without dates are excluded. Groups sorted newest first.
function groupByYearMonth(articles) {
  const groups = {};
  for (const a of articles) {
    if (!a.year) continue;
    const key = `${a.year}-${a.month || '00'}`;
    if (!groups[key]) groups[key] = { year: a.year, month: a.month, articles: [], label: `${a.year}-${a.month || '??'}` };
    groups[key].articles.push(a);
  }
  return Object.values(groups).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return (b.month || '00').localeCompare(a.month || '00');
  });
}

// Read an EJS template file from templates/ directory. Returns raw string or null.
function getTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, name);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

// Render an EJS template inside the layout template.
// 1. Render inner template (e.g. index.ejs) → body HTML
// 2. Wrap body in layout.ejs with merged data
// 3. Run hooks.transformHTML if available
// Returns full HTML string, or null on failure.
// Compose the final HTML <title> for a page based on seo.titleTemplate in site.json.
// Placeholders: {site} {subtitle} {title}. Falls back to '{title} | {site}' (index: just site title).
function applyTitleTemplate(config, pageType, pageTitle, lang) {
  const tplSrc = (config.site.seo && config.site.seo.titleTemplate) || null;
  const fallback = pageType === 'index' ? '{site}' : '{title} | {site}';
  const tpl = tplSrc ? (tplSrc[pageType] || tplSrc.default || fallback) : fallback;
  const site = (lang === 'en' && config.site.titleEn) ? config.site.titleEn : (config.site.title || '');
  const subtitle = (lang === 'en' && config.site.subtitleEn) ? config.site.subtitleEn : (config.site.subtitle || '');
  let out = tpl.replace(/\{site\}/g, site).replace(/\{subtitle\}/g, subtitle);
  if (pageTitle) out = out.replace(/\{title\}/g, pageTitle);
  else out = out.replace(/\{title\}/g, site);
  return out.trim();
}

function renderPage(templateName, data, layoutTemplate, cfg) {
  const templateStr = getTemplate(templateName);
  if (!templateStr) {
    console.error(`  [ERROR] Template not found: ${templateName}`);
    return null;
  }
  try {
    const rawTitle = (typeof data.title !== 'undefined' && data.title) ? data.title : null;
    const pageTitleFinal = applyTitleTemplate(cfg || config, data.currentPage || 'index', rawTitle, data.lang);
    const bodyContent = ejs.render(templateStr, data, { filename: path.join(TEMPLATES_DIR, templateName) });
    let result;
    if (layoutTemplate) {
      result = ejs.render(layoutTemplate, { ...data, pageTitleFinal, body: bodyContent }, { filename: path.join(TEMPLATES_DIR, 'layout.ejs') });
    } else {
      result = bodyContent;
    }
    if (hooks && hooks.transformHTML) {
      result = hooks.transformHTML(result, { template: templateName, ...data }) || result;
    }
    return result;
  } catch (err) {
    console.error(`  [ERROR] Failed to render template ${templateName}: ${err.message}`);
    return null;
  }
}

// Build the search JSON data embedded into the page for client-side search.
// Each entry: {title, url, excerpt (200 chars), content (3000 chars), tags, categories}.
// Returns stringified JSON, or '[]' if search is disabled/not local.
function generateSearchData(config, articles) {
  if (!config.navigation.search || !config.navigation.search.enabled || config.navigation.search.provider !== 'local') return '[]';
  const fullContent = !!(config.features && config.features.search && config.features.search.fullContent !== false);
  const data = getPublished(articles).map(a => ({
    title: a.title,
    url: a.url,
    excerpt: a.excerpt ? stripHtml(a.excerpt).substring(0, 200) : '',
    featuredImage: a.featuredImage || '',
    content: fullContent ? stripHtml(a.content).substring(0, 3000) : '',
    tags: a.tags || [],
    categories: a.categories || []
  }));
  return escapeJsonForScript(data);
}

// Build the unified data object passed to every EJS template.
// Contains: site config, theme, nav, sidebar, footer, security settings,
// all articles, tags, categories, archives, and helper functions.
// This is the base context — individual page generators add page-specific keys on top.

  const BUILTIN_QUOTES = [
    { text: '认识你自己。', author: '苏格拉底' },
    { text: '我思故我在。', author: '笛卡尔' },
    { text: '知行合一。', author: '王阳明' },
    { text: '路漫漫其修远兮，吾将上下而求索。', author: '屈原' },
    { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
    { text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游' },
    { text: 'Where there is a will, there is a way.', author: 'Thomas Edison' }
  ];
function buildPageData(config, articles, tags, categories) {
  const published = getPublished(articles);
  const friendsCfg = collectFriends(config);
  let nav = config.navigation;
// Auto-inject a 友链 menu entry when friends are configured but no menu item points to /links/.
  // Inserted right after the "关于" menu item (falling back to append at end).
  if (friendsCfg && nav && Array.isArray(nav.menu)) {
    const hasLinks = nav.menu.some(function(m) { return m && (m.url === '/links/' || m.url === '/links'); });
    if (!hasLinks) {
      const menu = nav.menu.slice();
      const aboutIdx = menu.findIndex(function(m) { return m && /\/about\/?$/.test(m.url) && /关于/.test(m.label || ''); });
      const linkItem = { label: '友链', labelEn: 'Links', url: '/links/', type: 'page' };
      if (aboutIdx > -1) { menu.splice(aboutIdx + 1, 0, linkItem); }
      else { menu.push(linkItem); }
      nav = { ...nav, menu };
    }
  }
  return {
    site: config.site,
    theme: config.theme,
    features: config.features,
    uiStrings: config.uiStrings || {},
    nav,
    sidebar: config.sidebar,
    footer: config.footer,
    security: config.security,
    allArticles: published,
    page: {},
    recentPosts: published.slice(0, 10),
    allTags: tags,
    allCategories: categories,
    archives: groupByYearMonth(published),
    seriesList: collectSeries(published),
    friends: friendsCfg,
    galleryItems: collectGalleryImages(articles),
    siteStats: collectSiteStats(articles, tags, categories),
    listCoverEnabled: !!(config.features && config.features.listCover && config.features.listCover.enabled !== false),
    topTags: collectTopTags(published, 8),
    currentUrl: '/',
    currentPage: 'index',
    presets: (function() {
      const out = [];
      for (const id of Object.keys(THEME_PRESETS)) {
        const p = THEME_PRESETS[id];
        out.push({ id: id, label: p.label, labelEn: p.labelEn || p.label, light: p.light, dark: p.dark,
          sample: { light: [p.light.background, p.light.primary, p.light.secondary, p.light.accent],
                    dark: [p.dark.background, p.dark.primary, p.dark.secondary, p.dark.accent] } });
      }
      return out;
    })(),
    formatDate: (d) => formatDate(d, config.site.dateFormat),
    generateSlug: safeSlug,
    escapeAttr: escapeAttr,
    ui: function(path, fallback, lang) {
      let o = config.uiStrings || {};
      if (lang === 'en' && o.en) o = o.en;
      for (const k of String(path).split('.')) {
        if (o == null) return fallback;
        o = o[k];
      }
      return (o === undefined || o === null) ? fallback : o;
    },
    i18nDict: (typeof uiStrings !== 'undefined' ? uiStrings : {}),
    escapeJsonForScript: escapeJsonForScript,
    JSON: JSON,
    Array: Array,
    Math: Math,
    Date: Date,
    config,
    dailyQuotes: BUILTIN_QUOTES,
    searchData: generateSearchData(config, published)
  };
}

// Parse standalone pages from Markdown files in pages/ directory (parsing only, no rendering).
// Each .md file is rendered per language by generatePages() to /{lang}/{slug}/index.html.
// Language override: pages/{lang}/{file} wins over pages/{file} when present (fallback = default file).
// Title priority: frontmatter.title > filename. Slug priority: slugOverride > attrs.slug > safeSlug(title).
// The same files are also loaded by processPagesContent() for template embedding (e.g. article footer).
// Duplicate slugs are silently skipped (first writer wins).
function processCustomPages(config) {
  console.log('Processing custom pages...');
  const createdSlugs = new Set();
  const customPages = [];
  const langs = (config.site.languages && config.site.languages.length) ? config.site.languages : ['zh', 'en'];
  function parseOne(sourcePath, file, slugOverride) {
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const fm = frontMatter(raw);
    const attrs = fm.attributes || {};
    const content = fm.body || '';
    const title = attrs.title || path.basename(file, '.md');
    const description = attrs.description || config.site.description || '';
    const slug = slugOverride || attrs.slug || safeSlug(title);
    let htmlContent = marked.parse(content);
    if (config.site.build.cjkSpacing !== false) htmlContent = applyCjkSpacingToHtml(htmlContent);
    htmlContent = sanitizeHtml(htmlContent);
    return { slug, title, description, content: htmlContent, date: attrs.date || null };
  }
  if (fs.existsSync(PAGES_DIR)) {
    const files = fs.readdirSync(PAGES_DIR).filter(f => /\.md$/i.test(f));
    for (const file of files) {
      try {
        const def = parseOne(path.join(PAGES_DIR, file), file);
        if (createdSlugs.has(def.slug)) continue;
        createdSlugs.add(def.slug);
        const page = {
          slug: def.slug,
          date: def.date,
          default: { title: def.title, description: def.description, content: def.content },
          langs: {}
        };
        for (const lang of langs) {
          const langFile = path.join(PAGES_DIR, lang, file);
          if (fs.existsSync(langFile)) {
            const ov = parseOne(langFile, file, def.slug);
            page.langs[lang] = { title: ov.title, description: ov.description, content: ov.content };
          }
        }
        customPages.push(page);
      } catch (err) {
        console.error('  [ERROR] Failed to process custom page ' + file + ': ' + err.message);
      }
    }
  }
  console.log('  Total: ' + customPages.length + ' custom pages processed');
  return customPages;
}

// Generate all HTML pages for the site (per-language):
// For each language (config.site.languages or ['zh','en']), renders:
// - Index pages with pagination (/{lang}/, /{lang}/page/N/)
// - Article detail pages (/{lang}/{slug}/)
// - Archive (/{lang}/archive/)
// - Tags overview + individual tag pages (/{lang}/tags/)
// - Categories overview + individual category pages (/{lang}/categories/)
// - 404 (/{lang}/404.html), search (/{lang}/search/), favorites (/{lang}/favorites/)
// - gallery (/{lang}/gallery/), links (/{lang}/links/)
// - Env: baseData.articles/friends/pagesContent are language-agnostic; each lang
//   filters its own published articles and tags/categories below.
function localizeSidebar(sidebar, lang) {
  if (!sidebar || !sidebar.widgets) return sidebar;
  const copy = JSON.parse(JSON.stringify(sidebar));
  copy.widgets = copy.widgets.map(w => {
    if (lang === 'en' && w.titleEn) return { ...w, title: w.titleEn };
    return w;
  });
  return copy;
}

function localizeNav(nav, pf, lang) {
  if (!nav || !nav.menu) return nav;
  const copy = JSON.parse(JSON.stringify(nav));
  copy.menu = copy.menu.map(m => {
    const u = m.url || '';
    return { ...m, url: (u.startsWith('/') && !u.startsWith('//')) ? pf + u.replace(/^\//, '') : u, label: (lang === 'en' && m.labelEn) ? m.labelEn : m.label };
  });
  return copy;
}

function localizeFooter(footer, pf, lang) {
  if (!footer) return footer;
  const copy = JSON.parse(JSON.stringify(footer));
  const fix = (l) => {
    const u = l.url || '';
    return { ...l, url: (u.startsWith('/') && !u.startsWith('//')) ? pf + u.replace(/^\//, '') : u, label: (lang === 'en' && l.labelEn) ? l.labelEn : l.label };
  };
  if (copy.columnItems && copy.columnItems.items) {
    copy.columnItems.items = copy.columnItems.items.map(c => {
      const fixed = { ...c };
      if (c.titleEn) fixed.title = (lang === 'en') ? c.titleEn : c.title;
      if (!c.links) return fixed;
      return { ...fixed, links: c.links.map(l => l.enabled === false ? l : fix(l)) };
    });
  }
  if (copy.bottomLinks && copy.bottomLinks.items) {
    copy.bottomLinks.items = copy.bottomLinks.items.map(l => l.enabled === false ? l : fix(l));
  }
  return copy;
}

async function generatePages(config, articles, preBuiltBaseData, customPages) {
  console.log('[6/14] Generating pages...');
  const layoutTemplate = getTemplate('layout.ejs');
  if (!layoutTemplate) { console.error('  [FATAL] layout.ejs not found in templates/'); return; }
  const baseData = preBuiltBaseData || buildPageData(config, articles, collectTags(articles), collectCategories(articles));
  if (customPages && customPages.length) baseData.customPages = customPages;

  const siteLangs = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);

  async function writeFile(relPath, content) {
    if (!content) return;
    const fullPath = path.join(DIST_DIR, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`  Created: ${relPath}`);
  }

  for (const lang of siteLangs) {
    const pf = '/' + lang + '/';
    const langArticles = articles.filter(a => a.lang === lang);
    const langPublished = getPublished(langArticles);
    const langTags = collectTags(langArticles);
    const langCategories = collectCategories(langArticles);
    const langTopTags = collectTopTags(langArticles, null, lang);
    const langData = {
      ...baseData,
      lang,
      langPrefix: pf,
      title: lang === 'en' ? (config.site.titleEn || config.site.title) : config.site.title,
      articleTitle: null,
      ui: (path, fallback) => {
        let o = config.uiStrings || {};
        if (lang === 'en' && o.en) o = o.en;
        for (const k of String(path).split('.')) {
          if (o == null) return fallback;
          o = o[k];
        }
        return (o === undefined || o === null) ? fallback : o;
      },
      articles: langArticles,
      allArticles: langPublished,
      topTags: langTopTags,
      tags: langTags,
      allTags: langTags,
      categories: langCategories,
      allCategories: langCategories,
      nav: localizeNav(baseData.nav, pf, lang),
      footer: localizeFooter(baseData.footer, pf, lang),
      sidebar: localizeSidebar(baseData.sidebar, lang)
    };

    if (config.site.build.generateIndex !== false) {
      const postsPerPage = config.site.postsPerPage || 10;
      const totalPages = Math.max(1, Math.ceil(langPublished.length / postsPerPage));
      for (let page = 1; page <= totalPages; page++) {
        const start = (page - 1) * postsPerPage;
        const end = start + postsPerPage;
        const pageArticles = langPublished.slice(start, end);
        const f = config.features;
        const heroEnabled = page === 1 && config.site.hero && config.site.hero.enabled !== false && f.hero.enabled !== false;
        const data = {
          ...langData,
          articles: pageArticles,
          heroData: heroEnabled ? {
            title: (lang === 'en' && config.site.hero.titleEn) ? config.site.hero.titleEn : (config.site.hero.title || config.site.title),
            subtitle: (lang === 'en' && config.site.hero.subtitleEn) ? config.site.hero.subtitleEn : (config.site.hero.subtitle || config.site.subtitle || config.site.description),
            showSearch: config.site.hero.showSearch !== false && f.hero.showSearch !== false,
            showTags: config.site.hero.showTags !== false && f.hero.showTags !== false,
            showCta: config.site.hero.showCta !== false && f.hero.showCta !== false,
            ctaLabel: lang === 'en' ? (config.site.hero.ctaLabelEn || f.hero.ctaLabelEn || 'View all posts') : (config.site.hero.ctaLabel || '查看全部文章'),
            ctaUrl: config.site.hero.ctaUrl || '#latest-post',
            showDate: f.hero.showDate === true,
            date: (langPublished[0] && langPublished[0].formattedDate) || '',
            tagCount: config.site.hero.tagCount || f.hero.tagCount || 8,
            tags: langTopTags.slice(0, config.site.hero.tagCount || f.hero.tagCount || 8)
          } : null,
          pagination: {
            current: page,
            total: totalPages,
            prev: page > 1 ? (page === 2 ? pf : pf + 'page/' + (page - 1) + '/') : null,
            next: page < totalPages ? pf + 'page/' + (page + 1) + '/' : null,
            prevLabel: lang === 'en' ? 'Previous' : (config.site.paginationPrev || '上一页'),
            nextLabel: lang === 'en' ? 'Next' : (config.site.paginationNext || '下一页'),
            pages: Array.from({ length: totalPages }, (_, i) => ({
              num: i + 1,
              url: i === 0 ? pf : pf + 'page/' + (i + 1) + '/',
              current: i + 1 === page
            }))
          },
          currentUrl: page === 1 ? pf : pf + 'page/' + page + '/',
          currentPage: 'index'
        };
        const html = renderPage('index.ejs', data, layoutTemplate, config);
        if (html) {
          if (page === 1) await writeFile(lang + '/index.html', html);
          else await writeFile(lang + '/page/' + page + '/index.html', html);
        }
      }
    }

    // Article detail pages (per language)
    for (const article of langArticles) {
      if (article.draft) continue;
      const idx = langArticles.indexOf(article);
      const prev = idx > 0 ? langArticles[idx - 1] : null;
      const next = idx < langArticles.length - 1 ? langArticles[idx + 1] : null;
      const data = {
        ...langData,
        article,
        title: article.title,
        prevArticle: prev && !prev.draft ? { title: prev.title, url: prev.url, featuredImage: prev.featuredImage || '' } : null,
        nextArticle: next && !next.draft ? { title: next.title, url: next.url, featuredImage: next.featuredImage || '' } : null,
        currentUrl: article.url,
        currentPage: 'post'
      };
      const html = renderPage('post.ejs', data, layoutTemplate, config);
      if (html) await writeFile(lang + '/' + article.slug + '/index.html', html);
    }

    if (config.site.build.generateArchive !== false) {
      const data = { ...langData, title: lang === 'en' ? 'Archive' : '归档', currentUrl: pf + 'archive', currentPage: 'archive' };
      const html = renderPage('archive.ejs', data, layoutTemplate, config);
      if (html) await writeFile(lang + '/archive/index.html', html);
    }

    if (config.site.build.generateTags !== false) {
      const data = { ...langData, title: lang === 'en' ? 'Tags' : '标签', currentUrl: pf + 'tags', currentPage: 'tags' };
      const html = renderPage('tags.ejs', data, layoutTemplate, config);
      if (html) await writeFile(lang + '/tags/index.html', html);
      for (const tag of langTags) {
        const tagArticles = langArticles.filter(a => !a.draft && a.tags.includes(tag.name));
        const tagData = { ...langData, title: tag.name, tag, tagName: tag.name, articles: tagArticles, currentUrl: tag.url, currentPage: 'tag' };
        const tagHtml = renderPage('tag.ejs', tagData, layoutTemplate, config);
        if (tagHtml) await writeFile(lang + '/tags/' + tag.slug + '/index.html', tagHtml);
      }
    }

    if (config.site.build.generateCategories !== false) {
      const data = { ...langData, title: lang === 'en' ? 'Categories' : '分类', currentUrl: pf + 'categories', currentPage: 'categories' };
      const html = renderPage('categories.ejs', data, layoutTemplate, config);
      if (html) await writeFile(lang + '/categories/index.html', html);
      for (const cat of langCategories) {
        const catArticles = langArticles.filter(a => !a.draft && a.categories.includes(cat.name));
        const catData = { ...langData, title: cat.name, category: cat, categoryName: cat.name, articles: catArticles, currentUrl: cat.url, currentPage: 'category' };
        const catHtml = renderPage('category.ejs', catData, layoutTemplate, config);
        if (catHtml) await writeFile(lang + '/categories/' + cat.slug + '/index.html', catHtml);
      }
    }

    const data404 = { ...langData, title: '404', currentUrl: pf + '404', currentPage: '404' };
    const html404 = renderPage('404.ejs', data404, layoutTemplate, config);
    if (html404) await writeFile(lang + '/404.html', html404);

    if (config.features && config.features.favorites && config.features.favorites.enabled !== false) {
      const favData = { ...langData, title: lang === 'en' ? 'Favorites' : '收藏', currentUrl: pf + 'favorites', currentPage: 'favorites' };
      const favHtml = renderPage('favorites.ejs', favData, layoutTemplate, config);
      if (favHtml) await writeFile(lang + '/favorites/index.html', favHtml);
    }

    if (config.site.build.generateGallery !== false) {
      const galleryData = { ...langData, title: lang === 'en' ? 'Gallery' : '图库', currentUrl: pf + 'gallery', currentPage: 'gallery' };
      const galleryHtml = renderPage('gallery.ejs', galleryData, layoutTemplate, config);
      if (galleryHtml) await writeFile(lang + '/gallery/index.html', galleryHtml);
    }

    if (baseData.friends) {
      const fdTitle = (baseData.friends.labels && (lang === 'en' ? baseData.friends.labels.en : baseData.friends.labels.zh)) || (lang === 'en' ? 'Friends' : '友情链接');
      const linksData = { ...langData, title: fdTitle, currentUrl: pf + 'links/', currentPage: 'links', pageTitle: fdTitle };
      const linksHtml = renderPage('links.ejs', linksData, layoutTemplate, config);
      if (linksHtml) await writeFile(lang + '/links/index.html', linksHtml);
    }

    if (config.navigation.search && config.navigation.search.enabled) {
      const searchData = { ...langData, title: lang === 'en' ? 'Search' : '搜索', currentUrl: pf + 'search', currentPage: 'search' };
      const searchHtml = renderPage('search.ejs', searchData, layoutTemplate, config);
      if (searchHtml) await writeFile(lang + '/search/index.html', searchHtml);
    }

    if (customPages && customPages.length) {
      for (const cp of customPages) {
        const ov = (cp.langs && cp.langs[lang]) || cp.default;
        const pageData = {
          ...langData,
          title: ov.title,
          description: ov.description,
          pageTitle: ov.title,
          pageContent: ov.content,
          currentUrl: pf + cp.slug + '/',
          currentPage: 'page'
        };
        const pageHtml = renderPage('page.ejs', pageData, layoutTemplate, config);
        if (pageHtml) await writeFile(lang + '/' + cp.slug + '/index.html', pageHtml);
      }
    }
  }
  // Root / landing = zh index + auto language redirect script.
  {
    const rootLang = 'zh';
    const pf = '/' + rootLang + '/';
    const rp = getPublished(articles.filter(a => a.lang === rootLang));
    const postsPerPage = config.site.postsPerPage || 10;
    const totalPages = Math.max(1, Math.ceil(rp.length / postsPerPage));
    const start = 0;
    const end = start + postsPerPage;
    const rootArticles = rp.slice(start, end);
    const f = config.features;
    const rt = collectTopTags(articles.filter(a => a.lang === rootLang), null, rootLang);
    const heroEnabled = config.site.hero && config.site.hero.enabled !== false && f.hero.enabled !== false;
    const rootData = {
      ...baseData,
      lang: rootLang,
      langPrefix: pf,
      articles: rootArticles,
      allArticles: rp,
      topTags: rt,
      heroData: heroEnabled ? {
        title: config.site.hero.title || config.site.title,
        subtitle: config.site.hero.subtitle || config.site.subtitle || config.site.description,
        showSearch: config.site.hero.showSearch !== false && f.hero.showSearch !== false,
        showTags: config.site.hero.showTags !== false && f.hero.showTags !== false,
        showCta: config.site.hero.showCta !== false && f.hero.showCta !== false,
        ctaLabel: config.site.hero.ctaLabel || '查看全部文章',
        ctaUrl: config.site.hero.ctaUrl || '#latest-post',
        showDate: f.hero.showDate === true,
        date: (rp[0] && rp[0].formattedDate) || '',
        tagCount: config.site.hero.tagCount || f.hero.tagCount || 8,
        tags: rt.slice(0, config.site.hero.tagCount || f.hero.tagCount || 8)
      } : null,
      pagination: {
        current: 1, total: totalPages,
        prev: null,
        next: totalPages > 1 ? pf + 'page/2/' : null,
        prevLabel: '上一页', nextLabel: '下一页',
        pages: Array.from({ length: totalPages }, (_, i) => ({ num: i + 1, url: i === 0 ? pf : pf + 'page/' + (i + 1) + '/', current: i === 0 }))
      },
      currentUrl: pf,
      currentPage: 'index'
    };
    const html = renderPage('index.ejs', rootData, layoutTemplate, config);
    if (html) {
      const redirectSnippet = '<script>/*S-LANG-REDIRECT*/if(navigator.language&&/(en|en-US|en-GB|en-CA)/i.test(navigator.language)&&!localStorage.getItem("s-ss-lang")){location.replace("/en/");}</script>';
      const finalHtml = html.replace('</head>', redirectSnippet + '</head>');
      await writeFile('index.html', finalHtml);
    }
  }
}

// Generate an RSS 2.0 feed (per-language).
// Uses the `feed` package. Includes full content if site.rss.fullContent true.
// Writes /{lang}/feed.xml for each configured site.language.
async function generateRSS(config, articles) {
  if (!config.site.rss || !config.site.rss.enabled || !Feed) {
    console.log('  [SKIP] RSS generation disabled or feed package not available');
    return;
  }
  console.log('[7/14] Generating RSS feed...');
  const siteLangsRSS = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);
  const baseUrl = (config.site.url || '').replace(/\/+$/, '');
  for (const rssLang of siteLangsRSS) {
    const rssArticles = articles.filter(a => a.lang === rssLang);
    const rssPublished = getPublished(rssArticles);
    try {
      const feed = new Feed({
        title: config.site.title || 'Blog',
        description: config.site.description || '',
        id: baseUrl + '/' + rssLang,
        link: baseUrl + '/' + rssLang + '/',
        language: rssLang === 'en' ? 'en-US' : (config.site.language || 'zh-CN'),
        copyright: config.site.copyright || '',
        updated: rssPublished.length > 0 && rssPublished[0].date ? new Date(rssPublished[0].date) : new Date(),
        generator: 'S-ynapse'
      });
      if (config.site.author) feed.author = { name: config.site.author, email: config.site.email || '' };
      const maxItems = config.site.rss.maxItems || 50;
      const items = rssPublished.slice(0, maxItems);
      for (const article of items) {
        const link = baseUrl + article.url;
        feed.addItem({
          title: article.title,
          id: link,
          link,
          description: article.excerpt || '',
          content: config.site.rss.fullContent ? article.content : (article.excerpt || ''),
          date: article.date ? new Date(article.date) : new Date(),
          category: article.tags.map(t => ({ name: t })),
          author: config.site.author ? [{ name: config.site.author }] : undefined
        });
      }
      const rssPath = (config.site.rss.path || '/feed.xml').replace(/^\//, '');
      const outputPath = path.join(DIST_DIR, rssLang, rssPath);
      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outputPath, feed.rss2(), 'utf-8');
      console.log(`  Created: /${rssLang}/${rssPath}`);
    } catch (err) {
      console.error(`  [ERROR] RSS generation failed: ${err.message}`);
    }
  }
}

// Generate JSON Feed (https://jsonfeed.org/version/1.1) alongside RSS.
// Reuses the `feed` package output (feed.json1()). Same source data as RSS:
// published articles limited to site.rss.maxItems, content per rss.fullContent.
// Enabled via site.rss.jsonFeed.enabled (default: follow rss.enabled).
async function generateJSONFeed(config, articles) {
  const rss = config.site.rss || {};
  const enabled = rss.jsonFeed ? rss.jsonFeed.enabled : rss.enabled;
  if (!enabled || !rss.enabled || !Feed) {
    console.log('  [SKIP] JSON Feed generation disabled or feed package not available');
    return;
  }
  console.log('[7b] Generating JSON Feed...');
  const siteLangsJF = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);
  const baseUrl = (config.site.url || '').replace(/\/+$/, '');
  try {
    for (const lang of siteLangsJF) {
      const langArticles = articles.filter(a => a.lang === lang);
      const feed = new Feed({
        title: config.site.title || 'Blog',
        description: config.site.description || '',
        id: baseUrl + '/' + lang,
        link: baseUrl + '/' + lang + '/',
        language: lang === 'en' ? 'en-US' : (config.site.language || 'zh-CN'),
        copyright: config.site.copyright || '',
        updated: langArticles.length > 0 && langArticles[0].date ? new Date(langArticles[0].date) : new Date(),
        generator: 'S-ynapse'
      });
      if (config.site.author) feed.author = { name: config.site.author, email: config.site.email || '' };
      const maxItems = rss.maxItems || 50;
      const items = getPublished(langArticles).slice(0, maxItems);
      for (const article of items) {
        const link = baseUrl + article.url;
        feed.addItem({
          title: article.title,
          id: link,
          link,
          description: article.excerpt || '',
          content: rss.fullContent ? article.content : (article.excerpt || ''),
          date: article.date ? new Date(article.date) : new Date(),
          category: article.tags.map(t => ({ name: t })),
          author: config.site.author ? [{ name: config.site.author }] : undefined
        });
      }
      const jfPath = (rss.jsonFeed.path || '/feed.json').replace(/^\//, '');
      const outputPath = path.join(DIST_DIR, lang, jfPath);
      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outputPath, feed.json1(), 'utf-8');
      console.log(`  Created: /${lang}/${jfPath}`);
    }
  } catch (err) {
    console.error('  [ERROR] JSON Feed generation failed: ' + err.message);
  }
}
// Generate a standard XML sitemap (per-language).
// Includes: index (1.0), articles (0.8), archive (0.5), tags/categories (0.4), custom pages (0.5), pagination (0.6).
// Each configured language gets its own prefixed URLs under /{lang}/.
async function generateSitemap(config, articles, tags, categories, customPages) {
  if (!config.site.sitemap || !config.site.sitemap.enabled) {
    console.log('  [SKIP] Sitemap generation disabled');
    return;
  }
  console.log('[8/14] Generating sitemap...');
  try {
    const url = config.site.url.replace(/\/+$/, '');
    const feats = (config.features && config.features.sitemap) || {};
    const split = feats.split !== false;
    const perFile = Math.max(10, feats.maxUrlsPerFile || 500);
    const postFreq = feats.postFrequency || 'weekly';
    const postPr = parseFloat(feats.postPriority != null ? feats.postPriority : 0.8);
    const pageFreq = feats.pageFrequency || 'monthly';
    const pagePr = parseFloat(feats.pagePriority != null ? feats.pagePriority : 0.6);
    const tagFreq = feats.tagFrequency || 'monthly';
    const tagPr = parseFloat(feats.tagPriority != null ? feats.tagPriority : 0.4);
    const siteLangsSM = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);

    async function writeSitemapFor(lang) {
      const pf = '/' + lang + '/';
      const langArticles = articles.filter(a => a.lang === lang);
      const langPubs = getPublished(langArticles);
      const langTags = collectTags(langArticles);
      const langCats = collectCategories(langArticles);
      const urls = [];
      if (config.site.build.generateIndex !== false) {
        urls.push({ loc: pf, changefreq: pageFreq, priority: '1.0' });
        const postsPerPage = config.site.postsPerPage || 10;
        const totalPages = Math.max(1, Math.ceil(langPubs.length / postsPerPage));
        for (let p = 2; p <= totalPages; p++) {
          urls.push({ loc: pf + 'page/' + p + '/', changefreq: pageFreq, priority: String(pagePr) });
        }
      }
      for (const a of langArticles) {
        if (a.draft) continue;
        urls.push({ loc: a.url, changefreq: postFreq, priority: String(postPr), lastmod: a.date || undefined });
      }
      if (config.site.build.generateArchive !== false) urls.push({ loc: pf + 'archive/', changefreq: pageFreq, priority: String(pagePr) });
      if (config.site.build.generateGallery !== false) urls.push({ loc: pf + 'gallery/', changefreq: pageFreq, priority: String(pagePr) });
      if (config.site.build.generateTags !== false) {
        urls.push({ loc: pf + 'tags/', changefreq: tagFreq, priority: String(tagPr) });
        for (const tag of langTags) urls.push({ loc: pf + 'tags/' + tag.slug + '/', changefreq: tagFreq, priority: String(tagPr) });
        const topTagT = collectTopTags(langArticles, null, lang);
        for (const tt of topTagT) urls.push({ loc: pf + 'tags/' + safeSlug(tt.name) + '/', changefreq: tagFreq, priority: String(tagPr) });
      }
      if (config.site.build.generateCategories !== false) {
        urls.push({ loc: pf + 'categories/', changefreq: tagFreq, priority: String(tagPr) });
        for (const cat of langCats) urls.push({ loc: pf + 'categories/' + cat.slug + '/', changefreq: tagFreq, priority: String(tagPr) });
      }
      for (const p of (customPages || [])) {
        if (p.draft || !p.slug) continue;
        urls.push({ loc: pf + p.slug + '/', changefreq: pageFreq, priority: String(pagePr) });
      }
      const sitemapPath = (config.site.sitemap.path || '/sitemap.xml').replace(/^\//, '');
      const entryPath = path.join(DIST_DIR, lang, sitemapPath);
      const outDir = path.dirname(entryPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const writeOne = (item, prio) => {
        let x = '<loc>' + url + item.loc + '</loc>';
        if (item.lastmod) x += '<lastmod>' + item.lastmod + '</lastmod>';
        x += '<changefreq>' + item.changefreq + '</changefreq><priority>' + item.priority + '</priority>';
        return x;
      };
      if (!split || urls.length <= perFile) {
        let xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        for (const item of urls) xml += '<url>' + writeOne(item) + '</url>';
        xml += '</urlset>';
        fs.writeFileSync(entryPath, xml, 'utf-8');
        console.log(`  Created: /${lang}/${sitemapPath} (${urls.length} urls)`);
        return;
      }
      const parts = [];
      for (let i = 0; i < urls.length; i += perFile) parts.push(urls.slice(i, i + perFile));
      const idxUrls = [];
      for (let i = 0; i < parts.length; i++) {
        const partName = 'sitemap-' + (i + 1) + '.xml';
        idxUrls.push({ loc: pf + partName, changefreq: pageFreq, priority: '0.6' });
        let part = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        for (const item of parts[i]) part += '<url>' + writeOne(item) + '</url>';
        part += '</urlset>';
        fs.writeFileSync(path.join(outDir, partName), part, 'utf-8');
      }
      let index = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
      for (const item of idxUrls) index += '<sitemap>' + url + item.loc + '</sitemap>';
      index += '</sitemapindex>';
      fs.writeFileSync(entryPath, index, 'utf-8');
      console.log(`  Created: /${lang}/${sitemapPath} (index ${parts.length} parts, ${urls.length} urls)`);
    }

    for (const lang of siteLangsSM) await writeSitemapFor(lang);
  } catch (err) {
    console.error('  [ERROR] Sitemap generation failed: ' + err.message);
  }
}

async function pingSearchEngines(config) {
  const ping = (config.features && config.features.searchEnginePing) || {};
  if (!ping.enabled) return;
  if (SERVE_MODE || WATCH_MODE) return;
  if (ping.onlyProduction && process.env.NODE_ENV !== 'production' && !process.env.CI) return;
  const base = (config.site.url || '').replace(/\/+$/, '');
  if (!base) { console.log('  [SKIP] Sitemap ping: site.url not configured'); return; }
  const sitemapPath = (config.security && config.security.robots && config.security.robots.sitemap) || '/sitemap.xml';
  const sitemapUrl = encodeURIComponent(base + sitemapPath);
  const engines = Array.isArray(ping.engines) ? ping.engines : ['google'];
  const endpoints = {
    google: 'https://www.google.com/ping?sitemap=',
    bing: 'https://www.bing.com/ping?sitemap='
  };
  for (const name of engines) {
    const ep = endpoints[name];
    if (!ep) { console.warn('  [WARN] Unknown ping engine: ' + name); continue; }
    try {
      const res = await fetch(ep + sitemapUrl, { method: 'GET', signal: AbortSignal.timeout(ping.timeoutMs || 5000) });
      console.log(`  Pinged ${name}: HTTP ${res.status}`);
      if (!res.ok) console.warn('  [WARN] ' + name + ' ping rejected (HTTP ' + res.status + '); usually fine locally');
    } catch (err) {
      console.warn(`  [WARN] ${name} ping failed: ${err.message}`);
    }
  }
}
function generateSearchIndex(config, articles) {
  if (!config.navigation.search || !config.navigation.search.enabled || config.navigation.search.provider !== 'local') {
    console.log('  [SKIP] Search index generation disabled or provider not local');
    return;
  }
  console.log('[9/14] Generating search index...');
  const fullContent = !!(config.features && config.features.search && config.features.search.fullContent !== false);
  const siteLangsSI = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);
  for (const lang of siteLangsSI) {
    const langArticles = articles.filter(a => a.lang === lang);
    const published = getPublished(langArticles);
    const index = published.map(a => ({
      title: a.title,
      url: a.url,
      excerpt: stripHtml(a.excerpt || '').substring(0, 200),
      featuredImage: a.featuredImage || '',
      content: fullContent ? stripHtml(a.content).substring(0, 5000) : '',
      tags: a.tags,
      categories: a.categories,
      lang
    }));
    const outputPath = path.join(DIST_DIR, lang, 'search-index.json');
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`  Created: /${lang}/search-index.json (${index.length} entries)`);
  }
}

// Generate an HTML build report page with stats: build time, article count, tag/category counts,
// output size, and feature enablement status. Written to dist/build-report.html.
function generateBuildReport(config, articles, tags, categories, customPages, elapsed, policyResult) {
  try {
    const policyBlocked = (policyResult && policyResult.blocked) || [];
    const policyCopied = (policyResult && policyResult.copied) || 0;
    const published = getPublished(articles);
    const totalSize = getDirSize(DIST_DIR);
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>构建报告 - ${config.site.title}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:2rem auto;padding:0 1rem;color:#333}h1{font-size:1.5rem}.stat{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #eee}.stat-label{color:#666}.stat-value{font-weight:600}.good{color:#16a34a}.warn{color:#d97706}</style></head><body><h1>构建报告</h1><p style="color:#666">${new Date().toISOString().replace('T',' ').slice(0,19)}</p>
    <div class="stat"><span class="stat-label">构建耗时</span><span class="stat-value">${elapsed}s</span></div>
    <div class="stat"><span class="stat-label">文章数</span><span class="stat-value">${published.length}</span></div>
    <div class="stat"><span class="stat-label">自定义页面</span><span class="stat-value">${(customPages||[]).length}</span></div>
    <div class="stat"><span class="stat-label">标签数</span><span class="stat-value">${tags.length}</span></div>
    <div class="stat"><span class="stat-label">分类数</span><span class="stat-value">${categories.length}</span></div>
    <div class="stat"><span class="stat-label">输出体积</span><span class="stat-value">${totalSize}</span></div>
    <div class="stat"><span class="stat-label">配置文件</span><span class="stat-value">${Object.keys(config).length}</span></div>
    <div class="stat"><span class="stat-label">依赖</span><span class="stat-value">${published.reduce((s,a)=>s+(a.wordCount||0),0)} 字</span></div>
    <div class="stat"><span class="stat-label">压缩</span><span class="stat-value ${config.site.build.minifyHTML?'good':'warn'}">${config.site.build.minifyHTML?'已启用':'未启用'}</span></div>
    <div class="stat"><span class="stat-label">图片优化</span><span class="stat-value ${config.site.build.optimizeMedia?'good':'warn'}">${config.site.build.optimizeMedia?'已启用':'未启用'}</span></div>
    <div class="stat"><span class="stat-label">内容策略拦截</span><span class="stat-value ${policyBlocked.length?'warn':'good'}">${policyBlocked.length} 项</span></div>
    <div class="stat"><span class="stat-label">受保护资产复制</span><span class="stat-value">${policyCopied}</span></div>
    <div class="stat"><span class="stat-label">缓存清除</span><span class="stat-value ${config.site.build.enableCacheBusting?'good':'warn'}">${config.site.build.enableCacheBusting?'已启用':'未启用'}</span></div>
    <div class="stat"><span class="stat-label">CSP</span><span class="stat-value ${config.security.csp&&config.security.csp.enabled?'good':'warn'}">${config.security.csp&&config.security.csp.enabled?'已启用':'未启用'}</span></div>
    <div class="stat"><span class="stat-label">RSS</span><span class="stat-value ${config.site.rss&&config.site.rss.enabled?'good':'warn'}">${config.site.rss&&config.site.rss.enabled?'已启用':'未启用'}</span></div>
    ${policyBlocked.length ? `<h2>被拦截文件（内容策略）</h2><ul>${policyBlocked.map(b => `<li><code>${b.path}</code> — ${b.reason}</li>`).join('')}</ul>` : ''}</body></html>`;
    fs.writeFileSync(path.join(DIST_DIR, 'build-report.html'), html, 'utf-8');
    console.log('  Created: build-report.html');
  } catch (err) {
    console.error(`  [ERROR] Build report failed: ${err.message}`);
  }
}

// Calculate the total size of a directory recursively. Returns human-readable string (B/KB/MB).
function getDirSize(dir) {
  try {
    const files = getAllFiles(dir);
    let total = 0;
    for (const f of files) total += fs.statSync(f).size || 0;
    if (total < 1024) return total + ' B';
    if (total < 1048576) return (total / 1024).toFixed(1) + ' KB';
    return (total / 1048576).toFixed(1) + ' MB';
  } catch { return '?'; }
}

// Generate Cloudflare-compatible _headers file and robots.txt.
// The _headers file sets CSP directives, HTTP security headers, and custom headers
// from the security.json configuration. Applied to all paths (/*).
// Note: security-worker.js provides a parallel security layer at the Worker level.
// Generate Cloudflare Pages _redirects file from site.json redirects array.
// Each entry: {from, to, permanent} — permanent=true → 301, false → 302.
// Supports wildcard syntax (e.g. "/old/* /new/:splat 301") via CF Pages native matching.
function generateRedirects(config, customPages) {
  const list = Array.isArray(config.site.redirects) ? config.site.redirects : [];
  const lines = [];
  const valid = [];

  const langs = (config.site.languages && config.site.languages.length) ? config.site.languages : ['zh'];
  for (const r of list) {
    if (!r || !r.from || !r.to) {
      console.warn('  [WARN] Skipped invalid redirect entry (missing from/to): ' + JSON.stringify(r || null));
      continue;
    }
    const status = r.permanent === false ? 302 : 301;
    valid.push({ from: r.from, to: r.to, status });
    lines.push(`${r.from} ${r.to} ${status}`);
  }
  if (langs.length > 0 && langs[0] !== 'en') {
    if (!lines.some(l => l.startsWith('/ '))) {
      lines.unshift(`/ /${langs[0]}/ 302`);
    }
  }
  const pwaOn = !!(config.site.pwa && config.site.pwa.enabled);
  for (const l of langs) {
    const pf = '/' + l;
    const rootAliases = ['/search-index.json', '/feed.xml', '/manifest.json', '/404.html', '/site.webmanifest'];
    for (const alias of rootAliases) {
      if (pwaOn && alias === '/manifest.json') continue;
      if (!lines.some(x => x.startsWith(alias + ' '))) {
        lines.push(`${alias} ${pf}${alias} 302`);
      }
    }
  }
  const firstPf = '/' + (langs[0] || 'zh') + '/';
  for (const p of (customPages || [])) {
    if (!p || !p.slug) continue;
    for (const from of ['/' + p.slug, '/' + p.slug + '/']) {
      if (!lines.some(x => x.startsWith(from + ' '))) {
        lines.push(`${from} ${firstPf}${p.slug}/ 302`);
      }
    }
  }
  if (lines.length === 0) { return; }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, '_redirects'), lines.join('\n') + '\n', 'utf-8');
  console.log('  Created: /_redirects (' + valid.length + ' custom + ' + (lines.length - valid.length) + ' language rules)');
  return valid;
}

function generateSecurityHeaders(config) {
  console.log('[10/14] Generating security files...');
  const lines = [];

  if (config.security.csp && config.security.csp.enabled) {
    const cspName = config.security.csp.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    const directives = [];
    for (const [key, vals] of Object.entries(config.security.csp.directives || {})) {
      if (Array.isArray(vals) && vals.length > 0) {
        directives.push(`${key} ${vals.join(' ')}`);
      }
    }
    if (directives.length > 0) {
      if (config.security.csp.reportUri) {
        directives.push(`report-uri ${config.security.csp.reportUri}`);
      }
      lines.push(`  ${cspName}: ${directives.join('; ')}`);
    }
  }

  for (const [key, val] of Object.entries(config.security.headers || {})) {
    if (val) lines.push(`  ${key}: ${val}`);
  }

  for (const [key, val] of Object.entries(config.security.customHeaders || {})) {
    if (val) lines.push(`  ${key}: ${val}`);
  }

  if (lines.length > 0) {
    const headerContent = '/*\n' + lines.join('\n') + '\n';
    fs.writeFileSync(path.join(DIST_DIR, '_headers'), headerContent, 'utf-8');
    console.log('  Created: _headers');
  }

  const redirectLines = ['# S-ynapse redirects'];
  if (config.security.forceHttps) {
    redirectLines.push('');
    redirectLines.push('# Force HTTPS');
  }
  if (config.security.robots && config.security.robots.enabled) {
    const robotLines = [];
    for (const rule of config.security.robots.rules || []) {
      const ua = rule.userAgent || '*';
      const allows = rule.allow ? `Allow: ${rule.allow}` : '';
      const disallows = rule.disallow ? `Disallow: ${rule.disallow}` : '';
      robotLines.push(`User-agent: ${ua}`);
      if (allows) robotLines.push(allows);
      if (disallows) robotLines.push(disallows);
      robotLines.push('');
    }
    if (config.security.robots.sitemap) {
      const sitemapUrl = `${config.site.url.replace(/\/+$/, '')}${config.security.robots.sitemap}`;
      robotLines.push(`Sitemap: ${sitemapUrl}`);
    }
    fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotLines.join('\n'), 'utf-8');
    console.log('  Created: robots.txt');
  }
}

// Minify all HTML files in a directory tree using @minify-html/node.
// Only runs when site.build.minifyHTML is enabled and the package is installed.
// Structural compression is handled here; JS/CSS keep their dedicated pass
// (terser / CleanCSS) so minify_js / minify_css stay off by default.
async function minifyHTMLInDir(dir, config) {
  if (!config.site.build.minifyHTML || !minifyHtmlNode) return;
  const files = getAllFiles(dir).filter(f => /\.html?$/i.test(f));
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const minified = minifyHtmlNode.minify(Buffer.from(content, 'utf-8'), {
        keep_comments: false,
        minify_js: false,
        minify_css: false,
        minify_doctype: false,
        keep_html_and_head_opening_tags: true,
        preserve_brace_template_syntax: true
      }).toString('utf-8');
      if (minified.length < content.length) {
        fs.writeFileSync(file, minified, 'utf-8');
      }
    } catch (err) {
      console.error(`  [ERROR] Failed to minify HTML ${file}: ${err.message}`);
    }
  }
}

// Minify all CSS files in a directory tree using CleanCSS (level 2 optimization).
async function minifyCSSInDir(dir, config) {
  if (!config.site.build.minifyCSS || !CleanCSS) return;
  const files = getAllFiles(dir).filter(f => /\.css$/i.test(f));
  const minifier = new CleanCSS({ level: 2 });
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const result = minifier.minify(content);
      if (!result.errors.length && result.styles.length < content.length) {
        fs.writeFileSync(file, result.styles, 'utf-8');
      }
      for (const err of result.errors) console.error(`  [ERROR] CSS minify error: ${err}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to minify CSS ${file}: ${err.message}`);
    }
  }
}

// Minify all JS files in a directory tree using Terser.
// Optionally removes console.* statements when site.build.removeConsole is true.
async function minifyJSInDir(dir, config) {
  if (!config.site.build.minifyJS || !terser) return;
  const files = getAllFiles(dir).filter(f => /\.js$/i.test(f));
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const result = await terser.minify(content, {
        compress: { drop_console: config.site.build.removeConsole || false },
        mangle: { toplevel: true },
        output: { comments: false }
      });
      if (result.code && result.code.length < content.length) {
        fs.writeFileSync(file, result.code, 'utf-8');
      }
      if (result.error) console.error(`  [ERROR] JS minify error: ${result.error}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to minify JS ${file}: ${err.message}`);
    }
  }
}

// Run all three minifiers (HTML, CSS, JS) across the dist/ directory.
// Each skips gracefully if its package is missing or the feature is disabled.
async function minifyAll(config) {
  console.log('[11/14] Minifying assets...');
  await minifyHTMLInDir(DIST_DIR, config);
  await minifyCSSInDir(DIST_DIR, config);
  await minifyJSInDir(DIST_DIR, config);
  const types = [];
  if (config.site.build.minifyHTML) types.push('HTML');
  if (config.site.build.minifyCSS) types.push('CSS');
  if (config.site.build.minifyJS) types.push('JS');
  if (types.length)     console.log(`  Minified: ${types.join(', ')}`);
  else console.log('  [SKIP] Minification disabled');
}

// Cache-busting via MD5 content hashing.
// For each matched file (css|js|png|jpg|svg), renames to {name}.{hash}.{ext}
// and updates all HTML references pointing to the old path.
// The cache-bust-manifest.json file records the old→new mapping.
async function cacheBust(config) {
  if (!config.site.build.enableCacheBusting) {
    console.log('  [SKIP] Cache busting disabled');
    return;
  }
  console.log('[12/14] Cache busting...');
  const bustPattern = config.site.build.cacheBustingPattern || '.*\\.(css|js|png|jpg|svg)$';
  const bustRegex = new RegExp(bustPattern, 'i');
  const files = getAllFiles(DIST_DIR).filter(f => bustRegex.test(f) && !f.includes('node_modules') && !f.includes('media' + path.sep + 'og'));
  const mapping = {};
  for (const file of files) {
    try {
      const content = fs.readFileSync(file);
      const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 10);
      const parsed = path.parse(file);
      const basename = parsed.name;
      const hashedName = `${basename}.${hash}${parsed.ext}`;
      const hashedPath = path.join(parsed.dir, hashedName);
      if (file !== hashedPath && !fs.existsSync(hashedPath)) {
        fs.renameSync(file, hashedPath);
      }
      const relOrig = path.relative(DIST_DIR, file).replace(/\\/g, '/');
      const relNew = path.relative(DIST_DIR, hashedPath).replace(/\\/g, '/');
      if (relOrig !== relNew) {
        mapping['/' + relOrig] = '/' + relNew;
      }
    } catch (err) {
      console.error(`  [ERROR] Cache bust ${file}: ${err.message}`);
    }
  }
  if (Object.keys(mapping).length > 0) {
    const htmlFiles = getAllFiles(DIST_DIR).filter(f => /\.html?$/i.test(f));
    for (const htmlFile of htmlFiles) {
      try {
        let content = fs.readFileSync(htmlFile, 'utf-8');
        let changed = false;
        for (const [orig, hashed] of Object.entries(mapping)) {
          const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(escaped, 'g');
          if (re.test(content)) {
            content = content.replace(re, hashed);
            changed = true;
          }
        }
        if (changed) fs.writeFileSync(htmlFile, content, 'utf-8');
      } catch (err) {
        console.error(`  [ERROR] Update refs in ${htmlFile}: ${err.message}`);
      }
    }
    fs.writeFileSync(CACHE_BUST_MANIFEST_PATH, JSON.stringify(mapping, null, 2), 'utf-8');
    console.log(`  Renamed ${Object.keys(mapping).length} files, updated HTML refs`);
  } else {
    console.log('  No files to bust');
  }
}

// Generate PWA manifest.json and service worker.
// The service worker implements a cache-first strategy: serves from cache, fetches in background,
// updates cache on successful fetch. Activated only when site.pwa.enabled is true.
// Note: the generated SW has a fixed cache name (s-ynapse-v1) and ASSETS list.
function copyJsAssets() {
  const SRC = path.join(ROOT, 'js');
  if (!fs.existsSync(SRC)) return;
  const DEST = path.join(DIST_DIR, 'assets', 'js');
  const walk = (dir, rel) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const src = path.join(dir, f.name);
      const dst = path.join(DEST, rel, f.name);
      if (f.isDirectory()) walk(src, path.join(rel, f.name));
      else if (f.name.endsWith('.js')) {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
      }
    }
  };
  walk(SRC, '');
  console.log('  Copied js/ assets to /assets/js/');
}

async function generatePWA(config) {
  if (!config.site.pwa || !config.site.pwa.enabled) {
    console.log('  [SKIP] PWA generation disabled');
    return;
  }
  console.log('[13/14] Generating PWA assets...');
  const manifest = config.site.pwa.manifest || {};
  if (Object.keys(manifest).length > 0) {
    const manifestPath = path.join(DIST_DIR, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log('  Created: manifest.json');
  }
  const swUrl = config.site.pwa.serviceWorker || '/sw.js';
  const swContent = `const CACHE = 's-ynapse-v1';
const ASSETS = [
  '/',
  '/manifest.json'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});`;
  const swPath = path.join(DIST_DIR, swUrl.replace(/^\//, ''));
  const swDir = path.dirname(swPath);
  if (!fs.existsSync(swDir)) fs.mkdirSync(swDir, { recursive: true });
  fs.writeFileSync(swPath, swContent, 'utf-8');
  console.log(`  Created: ${swUrl.replace(/^\//, '')}`);
}

// Pre-flight syntax check for all 6 JSON5 config files.
// Runs before loadConfig() to catch syntax errors early.
// Returns true if all files parse successfully, false otherwise.
// This is a fast check — loadConfig() does the actual parsing with fatal error handling.
function validateJsonSyntax() {
  const files = ['site.json', 'theme.json', 'navigation.json', 'sidebar.json', 'footer.json', 'security.json'];
  let hasError = false;
  for (const file of files) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      console.error(`  [ERROR] Config file not found: ${file}`);
      hasError = true;
      continue;
    }
    try {
      let raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      json5.parse(raw);
    } catch (err) {
      console.error(`  [ERROR] Syntax error in ${file}: ${err.message}`);
      hasError = true;
    }
  }
  return !hasError;
}

// Main build orchestrator — runs all 14 pipeline steps sequentially.
// Each step is independently skippable via its corresponding config flag.
// Lifecycle hooks (preBuild, postBuild) fire before step 1 and after step 14.
// On any fatal error, exits with code 1 after printing the error stack.
async function build() {
  console.log('========================================');
  console.log('  S-ynapse Static Blog Builder v1.0.0');
  console.log('========================================\n');
  const startTime = Date.now();
  if (!validateJsonSyntax()) {
    console.error('\n[FATAL] Build aborted due to configuration errors.\n');
    process.exit(1);
  }
  try {
    const config = loadConfig();
    if (!validateConfig(config)) {
      console.error('\n[FATAL] Build aborted due to configuration errors.\n');
      process.exit(1);
    }
    if (hooks && hooks.preBuild) await hooks.preBuild(config);
    setupDist(config);
    copyStatic(config);
    const policyResult = copyProtectedAssets(config);
    const mediaManifest = await optimizeMedia(config);
    const articles = await processArticles(config, mediaManifest);
    if (articles.length === 0) console.log('  [WARN] No articles found');
    const tags = collectTags(articles);
    const categories = collectCategories(articles);
    if (config.site.build.relatedArticles !== false) computeRelatedArticles(articles);
    const pagesContent = processPagesContent(config);
    if (config.theme.articleFooter && config.theme.articleFooter.enabled && config.theme.articleFooter.source) {
      if (!pagesContent || !pagesContent[config.theme.articleFooter.source]) {
        console.warn(`  [WARN] articleFooter.source "${config.theme.articleFooter.source}" not found in pages/ directory`);
      }
    }
    const baseData = buildPageData(config, articles, tags, categories);
    if (pagesContent) baseData.pagesContent = pagesContent;
    const customPages = processCustomPages(config, baseData);
    await generatePages(config, articles, baseData, customPages);
    const zh404 = path.join(DIST_DIR, 'zh', '404.html');
    if (fs.existsSync(zh404)) {
      fs.copyFileSync(zh404, path.join(DIST_DIR, '404.html'));
    }
    await generateRSS(config, articles);
    await generateJSONFeed(config, articles);
    await generateSitemap(config, articles, tags, categories, customPages);
    if (config.features && config.features.ogImage && config.features.ogImage.enabled !== false && articles.length > 0) {
      const ogRes = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-og.js')], { stdio: 'inherit' });
      if (ogRes.status !== 0) {
        console.warn('  [WARN] OG image generation reported errors (see above); continuing build.');
      }
    }
    await pingSearchEngines(config);
    generateSearchIndex(config, articles);
    generateSecurityHeaders(config);
    generateRedirects(config, customPages);
    if (generateWorkerSecurity) {
      generateWorkerSecurity(config.security, path.join(ROOT, 'workers', 'security-config.js'));
    }
    await minifyAll(config);
    await cacheBust(config);
    copyJsAssets();
    await generatePWA(config);
    if (hooks && hooks.postBuild) {
      await hooks.postBuild(config, {
        articles: articles.length,
        pages: (customPages || []).length,
        tags: tags.length,
        categories: categories.length,
        outputDir: DIST_DIR
      });
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n========================================`);
    console.log(`  Build complete in ${elapsed}s`);
    console.log(`  Output: dist/`);
    console.log(`========================================`);
    if (config.site.build.buildReport !== false) generateBuildReport(config, articles, tags, categories, customPages, elapsed, policyResult);
  } catch (err) {
    console.error(`\n[FATAL] Build failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

if (WATCH_MODE) {
  console.log('========================================');
  console.log('  S-ynapse Watch Mode');
  console.log('========================================\n');
  if (!chokidar) {
    console.error('[FATAL] chokidar not available for watch mode');
    process.exit(1);
  }
  let building = false;
  let rebuildQueued = false;
  async function rebuild() {
    if (building) { rebuildQueued = true; return; }
    building = true;
    rebuildQueued = false;
    console.log('\n[WATCH] Change detected, rebuilding...\n');
    await build();
    building = false;
    if (rebuildQueued) rebuild();
  }
  const watchPaths = [
    path.join(ROOT, 'articles', '**', '*.md'),
    path.join(ROOT, 'templates', '**', '*.ejs'),
    path.join(ROOT, 'static', '**', '*'),
    path.join(ROOT, 'media', '**', '*'),
    path.join(ROOT, 'videos', '**', '*'),
    path.join(ROOT, 'assets', '**', '*'),
    path.join(ROOT, '*.json')
  ];
  const watcher = chokidar.watch(watchPaths, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 300 } });
  watcher.on('all', rebuild);
  process.on('SIGINT', () => { watcher.close(); process.exit(0); });
  process.on('SIGTERM', () => { watcher.close(); process.exit(0); });
  build();
} else {
  build().then(function() {
    if (SERVE_MODE) startServer();
  });
}

// Simple development HTTP server for previewing the built site.
// Serves files from dist/ with basic MIME type detection.
// Supports clean URLs (auto-appends index.html for directories, .html for missing files).
// Falls back to 404.html when no match is found.
function startServer() {
  var http = require('http');
  var PORT = parseInt(process.argv[process.argv.indexOf('--port') + 1]) || 3000;
  var MAINTENANCE = process.argv.indexOf('--maintenance') !== -1 || process.env.MAINTENANCE === '1';
  var MAINT_MSG = process.env.MAINTENANCE_MESSAGE || '本站正在维护中，请稍后再来。';
  var maintPage = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>维护中 - ' + MAINT_MSG + '</title><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f7fafc;color:#1a202c}p{color:#4a5568}</style></head><body><main><h1>维护中</h1><p>' + MAINT_MSG + '</p></main></body></html>';
  var REDIRECT_LIST = [];
  try {
    var rc = fs.readFileSync(path.join(DIST_DIR, '_redirects'), 'utf-8');
    rc.split('\n').forEach(function(line) {
      if (!line.trim()) return;
      var parts = line.trim().split(/\s+/);
      if (parts.length >= 3) REDIRECT_LIST.push({ from: parts[0], to: parts[1], status: parts[2] === '302' ? 302 : 301 });
    });
  } catch (e) {}
  var mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.txt':'text/plain','.mp4':'video/mp4','.webm':'video/webm','.avi':'video/x-msvideo','.mov':'video/quicktime','.mkv':'video/x-matroska','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.flac':'audio/flac','.pdf':'application/pdf','.csv':'text/csv','.zip':'application/zip','.7z':'application/x-7z-compressed','.rar':'application/x-rar-compressed','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.eot':'application/vnd.ms-fontobject' };
  http.createServer(function(req, res) {
    if (MAINTENANCE) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' });
      res.end(maintPage);
      return;
    }
    var urlPath = decodeURIComponent(req.url.split('?')[0]);
    var redirects = REDIRECT_LIST;
    if (redirects.length) {
      for (var i = 0; i < redirects.length; i++) {
        var rd = redirects[i];
        var wildcardTail = rd.from.charAt(rd.from.length - 1) === '*';
        if (rd.from === urlPath || (wildcardTail && urlPath.startsWith(rd.from.slice(0, -1)))) {
          var to = rd.to;
          if (wildcardTail && to.indexOf('*') !== -1) {
            to = to.split('*').join(urlPath.slice(rd.from.length - 1));
          }
          res.writeHead(rd.status, { Location: to, 'Cache-Control': 'no-store' });
          res.end();
          return;
        }
      }
    }
    var urlNoSlash = urlPath.replace(/\/$/, '');
    var filePath = urlNoSlash ? path.resolve(DIST_DIR, '.' + urlNoSlash) : path.join(DIST_DIR, 'index.html');
    if (!filePath.startsWith(path.resolve(DIST_DIR) + path.sep) && !filePath.startsWith(path.resolve(DIST_DIR) + '/')) {
      filePath = path.join(DIST_DIR, '404.html');
    }
    try { if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html'); } catch(e) {}
    var isNotFound = false;
    if (!fs.existsSync(filePath)) {
      var alt = filePath + '.html';
      if (fs.existsSync(alt)) filePath = alt;
      else { filePath = path.join(DIST_DIR, '404.html'); isNotFound = true; }
    }
    fs.readFile(filePath, function(err, data) {
      if (err) { res.writeHead(500); res.end('Server Error'); return; }
      var ext = path.extname(filePath).toLowerCase();
      res.writeHead(isNotFound ? 404 : 200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(PORT, function() {
    console.log('  Server: http://localhost:' + PORT + '/');
    console.log('  (Press Ctrl+C to stop)');
  });
}
