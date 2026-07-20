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
let json5, deepmerge, Feed, sharp, htmlMinifier, CleanCSS, terser, chokidar;
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
try { htmlMinifier = require('html-minifier'); } catch (e) { htmlMinifier = null; }
try { CleanCSS = require('clean-css'); } catch (e) { CleanCSS = null; }
try { terser = require('terser'); } catch (e) { terser = null; }
try { chokidar = require('chokidar'); } catch (e) { chokidar = null; }

// Optional local hooks script (scripts/hooks.js) — allows external plugins to hook into build lifecycle
// Hook functions: preBuild(config), transformMarkdown(content, attrs), transformHTML(html, data), postBuild(config, stats)
let hooks;
try { hooks = require('./hooks'); } catch (e) { hooks = null; }
const { formatDate, safeSlug, escapeAttr, escapeHtml, stripHtml, insertCjkSpacing, applyCjkSpacingToHtml, extractToc } = require('./lib/utils');

// Project directory structure — all paths relative to project root
const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');          // Markdown article source files
const INCLUDES_DIR = path.join(ROOT, 'includes');           // Legacy shared content (kept for backward compat)
const STATIC_DIR = path.join(ROOT, 'static');               // Unprocessed static assets (copied verbatim)
const MEDIA_DIR = path.join(ROOT, 'media');                 // Source images (processed by sharp)
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
    console.error(`  [FATAL] Failed to parse ${filename}: ${err.message}`);
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
    theme: {
      colors: { primary: '#2d3748', secondary: '#4a90d9', accent: '#e53e3e', background: '#f7fafc', surface: '#ffffff', text: '#1a202c', textSecondary: '#4a5568', textLight: '#a0aec0', border: '#e2e8f0', shadow: 'rgba(0,0,0,0.1)', hover: '#edf2f7', codeBackground: '#2d3748', codeText: '#f7fafc' },
      darkMode: { enabled: false, toggle: true, default: 'system', colors: {} },
      fontFamily: 'sans-serif',
      fontFamilyMono: 'monospace',
      fontSizeBase: '16px', lineHeight: 1.8,
      headingFontWeight: 700, letterSpacing: '0.02em',
      spacing: { containerWidth: '960px', gap: '2rem', padding: '2rem', radius: '0.5rem', radiusLarge: '1rem' },
      shadow: { card: '0 4px 6px rgba(0,0,0,0.1)', dropdown: '0 10px 15px -3px rgba(0,0,0,0.1)', fixed: '0 2px 4px rgba(0,0,0,0.08)' },
      layout: { headerStyle: 'fixed', headerHeight: '60px', footerStyle: 'simple', sidebarPosition: 'right', contentWidth: 'main', postLayout: 'standard', archiveLayout: 'list' },
      animation: { enable: true, transitionDuration: '0.3s', transitionTiming: 'ease-in-out', scrollBehavior: 'smooth', pageTransition: 'fade' },
      codeHighlight: { lineNumbers: false, copyButton: true, wrapLongLines: false, highlightLines: true },
      card: { showDate: true, showTags: true, showCategories: true, showExcerpt: true, excerptLength: 150, showReadTime: true, readTimeSpeed: 265 },
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

  const config = deepmerge.all([defaults, { site, theme, navigation, sidebar, footer, security }]);
  return config;
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
    const validTypes = ['author', 'recent', 'tags', 'categories', 'archive', 'search', 'custom', 'newsletter', 'toc'];
    for (const w of config.sidebar.widgets) {
      if (w.enabled && !validTypes.includes(w.type)) warnings.push(`sidebar.widget type "${w.type}" is unknown`);
    }
  }

  if (config.security.csp && config.security.csp.enabled) {
    if (config.security.csp.directives['script-src'] && config.security.csp.directives['script-src'].includes("'unsafe-inline'")) {
      warnings.push('security.csp: script-src includes unsafe-inline, consider removing for stricter CSP');
    }
  }

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
function generateOgImage(outputPath, title, siteTitle, colors) {
  const bg = colors?.primary || '#2d3748';
  const fg = colors?.codeText || '#f7fafc';
  const accent = colors?.secondary || '#4a90d9';
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fontSize = safeTitle.length > 20 ? '42' : safeTitle.length > 10 ? '52' : '64';
  const lines = [];
  if (safeTitle.length > 28) {
    const mid = Math.ceil(safeTitle.length / 2);
    const split = safeTitle.slice(0, mid);
    const rest = safeTitle.slice(mid);
    const breakIdx = Math.max(split.lastIndexOf(' '), split.lastIndexOf('—'), split.lastIndexOf('-'), split.lastIndexOf(','));
    if (breakIdx > 0) {
      lines.push(safeTitle.slice(0, breakIdx + 1));
      lines.push(safeTitle.slice(breakIdx + 1).trim());
    } else {
      lines.push(split);
      lines.push(rest);
    }
  } else {
    lines.push(safeTitle);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${bg}"/><stop offset="100%" style="stop-color:${accent}"/></linearGradient></defs>
  <rect fill="url(#bg)" width="1200" height="630"/>
  <text x="80" y="280" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">${lines[0]}</text>
  ${lines[1] ? `<text x="80" y="360" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">${lines[1]}</text>` : ''}
  <text x="80" y="520" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="24" fill="${fg}" opacity="0.6">${siteTitle}</text>
</svg>`;
  fs.writeFileSync(outputPath, svg, 'utf-8');
  console.log(`  [OG] Generated: media/og-${path.basename(outputPath, '.svg').replace('og-','')}.svg`);
}

// Create the output directory structure under dist/.
// If cleanDist is enabled, removes the entire dist/ first.
// Required subdirectories: articles/, tags/, categories/, page/
function setupDist(config) {
  console.log('[2/14] Setting up dist directory...');
  if (config.site.build.cleanDist && fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    console.log('  Cleaned dist/');
  }
  const dirs = [
    DIST_DIR,
    path.join(DIST_DIR, 'articles'),
    path.join(DIST_DIR, 'tags'),
    path.join(DIST_DIR, 'categories'),
    path.join(DIST_DIR, 'page')
  ];
  dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
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
      const entry = { original: `/${parsed.dir ? parsed.dir + '/' : ''}${parsed.base}`, variants: {} };
      for (const size of sizes) {
        if (originalWidth <= size) continue;
        for (const fmt of formats) {
          const suffix = fmt === 'original' ? ext : '.webp';
          const variantName = `${parsed.name}-${size}${suffix}`;
          const outPath = path.join(destDir, parsed.dir || '', variantName);
          const outDir = path.dirname(outPath);
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          let pipeline = sharp(imgPath).resize(size, null, { withoutEnlargement: true });
          if (fmt === 'webp') pipeline = pipeline.webp({ quality });
          else if (ext === '.png') pipeline = pipeline.png({ quality });
          else pipeline = pipeline.jpeg({ quality });
          await pipeline.toFile(outPath);
          entry.variants[`${size}-${fmt}`] = `/${parsed.dir ? parsed.dir + '/' : ''}${variantName}`;
        }
      }
      const originalDest = path.join(destDir, parsed.dir || '', parsed.base);
      const origDir = path.dirname(originalDest);
      if (!fs.existsSync(origDir)) fs.mkdirSync(origDir, { recursive: true });
      fs.copyFileSync(imgPath, originalDest);
      manifest[relPath.replace(/\\/g, '/')] = entry;
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
  const usePicture = config.site.build.usePictureTag !== false;
  const lazyLoad = config.site.build.lazyLoadImages !== false;
  const extTarget = config.site.build.externalLinksTarget || '_blank';
  const extRel = config.site.build.externalLinksRel || 'noopener noreferrer';
  const showLineNumbers = config.theme.codeHighlight && config.theme.codeHighlight.lineNumbers;
  const siteUrl = (config.site.url || '').replace(/\/+$/, '');

  marked.use({
    renderer: {
      // Image renderer with responsive fallback chain:
      // 1. If usePicture + manifest: <picture> with WebP + size variants + original fallback
      // 2. If manifest only (picture disabled): <img> with original path from manifest
      // 3. No manifest: raw <img> with the href as-is
      image(href, title, text) {
        if (!href) return '';
        const alt = text || '';
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        const loading = lazyLoad ? ' loading="lazy"' : '';
        const decodedHref = href.replace(/&amp;/g, '&');
        if (usePicture && mediaManifest) {
          const normHref = decodedHref.replace(/^\//, '');
          const entry = mediaManifest[normHref];
          if (entry && entry.variants && Object.keys(entry.variants).length > 0) {
            const webpSources = [];
            const origSources = [];
            const sizesAttr = '(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1920px';
            for (const [key, val] of Object.entries(entry.variants)) {
              const [size, fmt] = key.split('-');
              const escaped = escapeAttr(val);
              if (fmt === 'webp') webpSources.push(`  <source srcset="${escaped}" sizes="${sizesAttr}" type="image/webp">`);
              else origSources.push(`  <source srcset="${escaped}" sizes="${sizesAttr}" type="image/${fmt}">`);
            }
            const fallbackSrc = escapeAttr(entry.original || decodedHref);
            let html = '<picture>\n';
            html += webpSources.join('\n') + '\n';
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

// Load shared content fragments from includes/ as key-value map (filename → {title, content, body}).
// Legacy — kept for backward compatibility. New content should use pages/.
// The results are passed to templates as includesContent variable.
function processIncludes(config) {
  const result = {};
  if (!fs.existsSync(INCLUDES_DIR)) {
    console.log('  includes/ directory not found, skipping');
    return null;
  }
  const files = fs.readdirSync(INCLUDES_DIR).filter(f => /\.md$/i.test(f));
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(INCLUDES_DIR, file), 'utf-8');
      const fm = frontMatter(raw);
      const body = fm.body || '';
      const name = path.basename(file, '.md');
      result[name] = {
        title: (fm.attributes && fm.attributes.title) || name,
        content: applyCjkSpacingToHtml ? applyCjkSpacingToHtml(marked.parse(body)) : marked.parse(body),
        body: body
      };
    } catch (err) {
      console.error(`  [ERROR] Failed to process include ${file}: ${err.message}`);
    }
  }
  return Object.keys(result).length ? result : null;
}

// Load Markdown content from pages/ as key-value map (filename → {title, content, body}).
// Used by templates for article footer, custom sections, and any content that
// needs to be shared across multiple pages without being a full standalone page.
// Also distinct from processCustomPages which renders these as standalone HTML pages.
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
        content: applyCjkSpacingToHtml ? applyCjkSpacingToHtml(marked.parse(body)) : marked.parse(body),
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
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => /\.md$/i.test(f));
  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
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
      const url = `/${slug}/`;
      const excerpt = attrs.excerpt || '';
      const date = attrs.date || null;
      const tags = Array.isArray(attrs.tags) ? attrs.tags : [];
      const categories = Array.isArray(attrs.categories) ? attrs.categories : [];
      const draft = attrs.draft === true || attrs.draft === 'true';
      let htmlContent = marked.parse(content);
      if (config.site.build.cjkSpacing !== false) htmlContent = applyCjkSpacingToHtml(htmlContent);
      // Auto-generate excerpt from rendered HTML (strip tags, truncate)
      let excerptText = excerpt;
      if (!excerptText) {
        const textOnly = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const excerptLen = config.site.build.excerptLength || config.theme.card?.excerptLength || 150;
        excerptText = textOnly.length > excerptLen ? textOnly.slice(0, excerptLen) + '...' : textOnly;
      }
      // Read time: word count / reading speed (default 265 wpm), minimum 1 minute
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const readSpeed = config.theme.card?.readTimeSpeed || 265;
      const readTime = Math.max(1, Math.ceil(wordCount / readSpeed));
      const toc = extractToc(htmlContent);
      // Auto-generate OG image if no featuredImage provided in frontmatter
      if (!attrs.featuredImage && config.site.build.autoOgImage !== false) {
        const ogDir = path.join(DIST_DIR, 'media', 'og');
        if (!fs.existsSync(ogDir)) fs.mkdirSync(ogDir, { recursive: true });
        const ogPath = path.join(ogDir, `${slug}.svg`);
        generateOgImage(ogPath, title, config.site.title, config.theme.colors);
        attrs.featuredImage = `/media/og/${slug}.svg`;
      }
      articles.push({
        slug, title, url, date, tags, categories, draft,
        content: htmlContent,
        excerpt: excerptText,
        wordCount, readTime, toc,
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
function collectTags(articles) {
  const map = new Map();
  for (const a of articles) {
    for (const tag of a.tags) {
      const slug = safeSlug(tag);
      if (!map.has(slug)) map.set(slug, { name: tag, slug, count: 0, url: `/tags/${slug}/` });
      map.get(slug).count++;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
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
      if (score > 0) scored.push({ slug: other.slug, title: other.title, url: other.url, score, tags: sharedTags });
    }
    scored.sort((a, b) => b.score - a.score);
    article.relatedArticles = scored.slice(0, maxCount);
  }
}

// Aggregate categories across all articles with count and slugified URL.
// Returns array sorted by count descending.
function collectCategories(articles) {
  const map = new Map();
  for (const a of articles) {
    for (const cat of a.categories) {
      const slug = safeSlug(cat);
      if (!map.has(slug)) map.set(slug, { name: cat, slug, count: 0, url: `/categories/${slug}/` });
      map.get(slug).count++;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
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
function renderPage(templateName, data, layoutTemplate) {
  const templateStr = getTemplate(templateName);
  if (!templateStr) {
    console.error(`  [ERROR] Template not found: ${templateName}`);
    return null;
  }
  try {
    const bodyContent = ejs.render(templateStr, data, { filename: path.join(TEMPLATES_DIR, templateName) });
    let result;
    if (layoutTemplate) {
      result = ejs.render(layoutTemplate, { ...data, body: bodyContent }, { filename: path.join(TEMPLATES_DIR, 'layout.ejs') });
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
  const fullContent = config.site.build.searchFullContent !== false;
  const data = getPublished(articles).map(a => ({
    title: a.title,
    url: a.url,
    excerpt: a.excerpt ? stripHtml(a.excerpt).substring(0, 200) : '',
    content: fullContent ? stripHtml(a.content).substring(0, 3000) : '',
    tags: a.tags || [],
    categories: a.categories || []
  }));
  return JSON.stringify(data);
}

// Build the unified data object passed to every EJS template.
// Contains: site config, theme, nav, sidebar, footer, security settings,
// all articles, tags, categories, archives, and helper functions.
// This is the base context — individual page generators add page-specific keys on top.
function buildPageData(config, articles, tags, categories) {
  const published = getPublished(articles);
  return {
    site: config.site,
    theme: config.theme,
    nav: config.navigation,
    sidebar: config.sidebar,
    footer: config.footer,
    security: config.security,
    allArticles: published,
    recentPosts: published.slice(0, 10),
    allTags: tags,
    allCategories: categories,
    archives: groupByYearMonth(published),
    currentUrl: '/',
    currentPage: 'index',
    formatDate: (d) => formatDate(d, config.site.dateFormat),
    generateSlug: safeSlug,
    JSON: JSON,
    Array: Array,
    Math: Math,
    Date: Date,
    config,
    searchData: generateSearchData(config, published)
  };
}

// Render standalone pages from Markdown files in pages/ directory.
// Each .md file becomes a full HTML page at /{slug}/index.html using page.ejs + layout.ejs.
// Title priority: frontmatter.title > filename. Slug priority: slugOverride > attrs.slug > safeSlug(title).
// The built-inPages fallback to includes/ was removed in favor of a single source: pages/.
// Duplicate slugs are silently skipped (first writer wins).
function processCustomPages(config, baseData) {
  console.log('Processing custom pages...');
  const layoutTemplate = getTemplate('layout.ejs');
  const pageTemplate = getTemplate('page.ejs');
  if (!layoutTemplate || !pageTemplate) {
    console.error('  [FATAL] Layout or page template not found');
    return [];
  }
  const createdSlugs = new Set();
  const customPages = [];
  function renderOne(sourcePath, file, slugOverride) {
    try {
      const raw = fs.readFileSync(sourcePath, 'utf-8');
      const fm = frontMatter(raw);
      const attrs = fm.attributes || {};
      const content = fm.body || '';
      const title = attrs.title || path.basename(file, '.md');
      const description = attrs.description || config.site.description || '';
      const slug = slugOverride || attrs.slug || safeSlug(title);
      if (createdSlugs.has(slug)) return;
      createdSlugs.add(slug);
      const date = attrs.date || null;
      let htmlContent = marked.parse(content);
      if (config.site.build.cjkSpacing !== false) htmlContent = applyCjkSpacingToHtml(htmlContent);
      const pageData = {
        ...baseData,
        title,
        description,
        pageTitle: title,
        pageContent: htmlContent,
        currentUrl: '/' + slug + '/',
        currentPage: 'page'
      };
      const bodyHtml = ejs.render(pageTemplate, pageData, { filename: path.join(TEMPLATES_DIR, 'page.ejs') });
      const fullHtml = ejs.render(layoutTemplate, { ...pageData, body: bodyHtml }, { filename: path.join(TEMPLATES_DIR, 'layout.ejs') });
      const outputPath = path.join(DIST_DIR, slug, 'index.html');
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, fullHtml, 'utf-8');
      console.log('  Created custom page: ' + slug + '/index.html');
      customPages.push({ slug, title, url: '/' + slug + '/', date });
    } catch (err) {
      console.error('  [ERROR] Failed to process custom page ' + file + ': ' + err.message);
    }
  }
  if (fs.existsSync(PAGES_DIR)) {
    const files = fs.readdirSync(PAGES_DIR).filter(f => /\.md$/i.test(f));
    for (const file of files) renderOne(path.join(PAGES_DIR, file), file);
  }
  console.log('  Total: ' + customPages.length + ' custom pages processed');
  return customPages;
}

// Generate all HTML pages for the site:
// - Index pages with pagination
// - Article detail pages (with prev/next navigation)
// - Archive page (grouped by year-month)
// - Tags overview page + individual tag pages
// - Categories overview page + individual category pages
// - 404 page
// - Search page (if enabled)
// Each is rendered via renderPage() which wraps content in layout.ejs.
async function generatePages(config, articles, preBuiltBaseData, customPages) {
  console.log('[6/14] Generating pages...');
  const tags = collectTags(articles);
  const categories = collectCategories(articles);
  const layoutTemplate = getTemplate('layout.ejs');
  if (!layoutTemplate) {
    console.error('  [FATAL] layout.ejs not found in templates/');
    return;
  }
  const baseData = preBuiltBaseData || buildPageData(config, articles, tags, categories);
  if (customPages && customPages.length) {
    baseData.customPages = customPages;
  }
  const published = getPublished(articles);

  async function writeFile(relPath, content) {
    if (!content) return;
    const fullPath = path.join(DIST_DIR, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`  Created: ${relPath}`);
  }

  if (config.site.build.generateIndex !== false) {
    const postsPerPage = config.site.postsPerPage || 10;
    const totalPages = Math.max(1, Math.ceil(published.length / postsPerPage));
    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * postsPerPage;
      const end = start + postsPerPage;
      const pageArticles = published.slice(start, end);
      const data = {
        ...baseData,
        articles: pageArticles,
        pagination: {
          current: page,
          total: totalPages,
          prev: page > 1 ? (page === 2 ? '/' : `/page/${page - 1}/`) : null,
          next: page < totalPages ? `/page/${page + 1}/` : null,
          prevLabel: config.site.paginationPrev || '上一页',
          nextLabel: config.site.paginationNext || '下一页',
          pages: Array.from({ length: totalPages }, (_, i) => ({
            num: i + 1,
            url: i === 0 ? '/' : `/page/${i + 1}/`,
            current: i + 1 === page
          }))
        },
        currentUrl: page === 1 ? '/' : `/page/${page}/`,
        currentPage: 'index'
      };
      const html = renderPage('index.ejs', data, layoutTemplate);
      if (html) {
        if (page === 1) await writeFile('index.html', html);
        else await writeFile(`page/${page}/index.html`, html);
      }
    }
  }

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    if (article.draft) continue;
    const prev = i > 0 ? articles[i - 1] : null;
    const next = i < articles.length - 1 ? articles[i + 1] : null;
    const data = {
      ...baseData,
      article,
      prevArticle: prev && !prev.draft ? { title: prev.title, url: prev.url } : null,
      nextArticle: next && !next.draft ? { title: next.title, url: next.url } : null,
      currentUrl: article.url,
      currentPage: 'post'
    };
    const html = renderPage('post.ejs', data, layoutTemplate);
    if (html) {
      await writeFile(`${article.slug}/index.html`, html);
    }
  }

  if (config.site.build.generateArchive !== false) {
    const data = {
      ...baseData,
      currentUrl: '/archive',
      currentPage: 'archive'
    };
    const html = renderPage('archive.ejs', data, layoutTemplate);
    if (html) await writeFile('archive/index.html', html);
  }

  if (config.site.build.generateTags !== false) {
    const data = {
      ...baseData,
      currentUrl: '/tags',
      currentPage: 'tags'
    };
    const html = renderPage('tags.ejs', data, layoutTemplate);
    if (html) await writeFile('tags/index.html', html);

    for (const tag of tags) {
      const tagArticles = articles.filter(a => !a.draft && a.tags.includes(tag.name));
      const tagData = {
        ...baseData,
        tag,
        tagName: tag.name,
        articles: tagArticles,
        currentUrl: tag.url,
        currentPage: 'tag'
      };
      const tagHtml = renderPage('tag.ejs', tagData, layoutTemplate);
      if (tagHtml) await writeFile(`tags/${tag.slug}/index.html`, tagHtml);
    }
  }

  if (config.site.build.generateCategories !== false) {
    const data = {
      ...baseData,
      currentUrl: '/categories',
      currentPage: 'categories'
    };
    const html = renderPage('categories.ejs', data, layoutTemplate);
    if (html) await writeFile('categories/index.html', html);

    for (const cat of categories) {
      const catArticles = articles.filter(a => !a.draft && a.categories.includes(cat.name));
      const catData = {
        ...baseData,
        category: cat,
        categoryName: cat.name,
        articles: catArticles,
        currentUrl: cat.url,
        currentPage: 'category'
      };
      const catHtml = renderPage('category.ejs', catData, layoutTemplate);
      if (catHtml) await writeFile(`categories/${cat.slug}/index.html`, catHtml);
    }
  }

  const data404 = { ...baseData, currentUrl: '/404', currentPage: '404' };
  const html404 = renderPage('404.ejs', data404, layoutTemplate);
  if (html404) await writeFile('404.html', html404);

  if (config.navigation.search && config.navigation.search.enabled) {
    const searchData = { ...baseData, currentUrl: '/search', currentPage: 'search' };
    const searchHtml = renderPage('search.ejs', searchData, layoutTemplate);
    if (searchHtml) await writeFile('search/index.html', searchHtml);
  }
}

// Generate an RSS 2.0 feed using the `feed` package.
// Includes full article content if site.rss.fullContent is true.
// Limited to site.rss.maxItems (default 50) most recent published articles.
async function generateRSS(config, articles) {
  if (!config.site.rss || !config.site.rss.enabled || !Feed) {
    console.log('  [SKIP] RSS generation disabled or feed package not available');
    return;
  }
  console.log('[7/14] Generating RSS feed...');
  try {
    const feed = new Feed({
      title: config.site.title || 'Blog',
      description: config.site.description || '',
      id: config.site.url || '',
      link: config.site.url || '',
      language: config.site.language || 'en',
      copyright: config.site.copyright || '',
      updated: articles.length > 0 && articles[0].date ? new Date(articles[0].date) : new Date(),
      generator: 'S-ynapse'
    });
    if (config.site.author) {
      feed.author = { name: config.site.author, email: config.site.email || '' };
    }
    const maxItems = config.site.rss.maxItems || 50;
    const items = getPublished(articles).slice(0, maxItems);
    for (const article of items) {
      const link = `${config.site.url.replace(/\/+$/, '')}${article.url}`;
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
    const rssPath = config.site.rss.path || '/feed.xml';
    const outputPath = path.join(DIST_DIR, rssPath.replace(/^\//, ''));
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputPath, feed.rss2(), 'utf-8');
    console.log(`  Created: ${rssPath}`);
  } catch (err) {
    console.error(`  [ERROR] RSS generation failed: ${err.message}`);
  }
}

// Generate a standard XML sitemap for search engines.
// Includes: index (1.0), articles (0.8), archive (0.5), tags/categories (0.4), custom pages (0.5), pagination (0.6).
// Only published (non-draft) articles are included.
async function generateSitemap(config, articles, tags, categories, customPages) {
  if (!config.site.sitemap || !config.site.sitemap.enabled) {
    console.log('  [SKIP] Sitemap generation disabled');
    return;
  }
  console.log('[8/14] Generating sitemap...');
  try {
    const url = config.site.url.replace(/\/+$/, '');
    const changefreq = config.site.sitemap.changefreq || 'weekly';
    const priority = config.site.sitemap.priority || 0.8;
    const urls = [];
    if (config.site.build.generateIndex !== false) {
      urls.push({ loc: '/', changefreq, priority: '1.0' });
      const postsPerPage = config.site.postsPerPage || 10;
      const published = getPublished(articles);
      const totalPages = Math.max(1, Math.ceil(published.length / postsPerPage));
      for (let p = 2; p <= totalPages; p++) {
        urls.push({ loc: `/page/${p}/`, changefreq, priority: '0.6' });
      }
    }
    for (const a of articles) {
      if (a.draft) continue;
      urls.push({ loc: a.url, changefreq: 'monthly', priority: '0.8', lastmod: a.date || undefined });
    }
    if (config.site.build.generateArchive !== false) {
      urls.push({ loc: '/archive/', changefreq: 'weekly', priority: '0.5' });
    }
    if (config.site.build.generateTags !== false) {
      urls.push({ loc: '/tags/', changefreq: 'weekly', priority: '0.4' });
      for (const tag of tags) urls.push({ loc: `/tags/${tag.slug}/`, changefreq: 'weekly', priority: '0.4' });
    }
    if (config.site.build.generateCategories !== false) {
      urls.push({ loc: '/categories/', changefreq: 'weekly', priority: '0.4' });
      for (const cat of categories) urls.push({ loc: `/categories/${cat.slug}/`, changefreq: 'weekly', priority: '0.4' });
    }
    for (const cp of (customPages || [])) {
      urls.push({ loc: cp.url, changefreq: 'monthly', priority: '0.5' });
    }
    const xml = ['<?xml version="1.0" encoding="UTF-8"?>'];
    xml.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    for (const u of urls) {
      xml.push('  <url>');
      xml.push(`    <loc>${url}${u.loc}</loc>`);
      if (u.lastmod) {
        const d = new Date(u.lastmod);
        if (!isNaN(d.getTime())) xml.push(`    <lastmod>${d.toISOString()}</lastmod>`);
      }
      xml.push(`    <changefreq>${u.changefreq}</changefreq>`);
      xml.push(`    <priority>${u.priority}</priority>`);
      xml.push('  </url>');
    }
    xml.push('</urlset>');
    const sitemapPath = config.site.sitemap.path || '/sitemap.xml';
    const outputPath = path.join(DIST_DIR, sitemapPath.replace(/^\//, ''));
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputPath, xml.join('\n'), 'utf-8');
    console.log(`  Created: ${sitemapPath}`);
  } catch (err) {
    console.error(`  [ERROR] Sitemap generation failed: ${err.message}`);
  }
}

// Generate a JSON search index for client-side full-text search.
// Written to dist/search-index.json. Contains title, url, excerpt (200 chars),
// content (5000 chars for full search), tags, and categories.
// Only published articles are indexed.
function generateSearchIndex(config, articles) {
  if (!config.navigation.search || !config.navigation.search.enabled || config.navigation.search.provider !== 'local') {
    console.log('  [SKIP] Search index generation disabled or provider not local');
    return;
  }
  console.log('[9/14] Generating search index...');
  const fullContent = config.site.build.searchFullContent !== false;
  const published = getPublished(articles);
  const index = published.map(a => ({
    title: a.title,
    url: a.url,
    excerpt: stripHtml(a.excerpt || '').substring(0, 200),
    content: fullContent ? stripHtml(a.content).substring(0, 5000) : '',
    tags: a.tags,
    categories: a.categories
  }));
  const outputPath = path.join(DIST_DIR, 'search-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`  Created: search-index.json (${index.length} entries)`);
}

// Generate an HTML build report page with stats: build time, article count, tag/category counts,
// output size, and feature enablement status. Written to dist/build-report.html.
function generateBuildReport(config, articles, tags, categories, customPages, elapsed) {
  try {
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
    <div class="stat"><span class="stat-label">缓存清除</span><span class="stat-value ${config.site.build.enableCacheBusting?'good':'warn'}">${config.site.build.enableCacheBusting?'已启用':'未启用'}</span></div>
    <div class="stat"><span class="stat-label">CSP</span><span class="stat-value ${config.security.csp&&config.security.csp.enabled?'good':'warn'}">${config.security.csp&&config.security.csp.enabled?'已启用':'未启用'}</span></div>
    <div class="stat"><span class="stat-label">RSS</span><span class="stat-value ${config.site.rss&&config.site.rss.enabled?'good':'warn'}">${config.site.rss&&config.site.rss.enabled?'已启用':'未启用'}</span></div></body></html>`;
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

// Minify all HTML files in a directory tree using html-minifier.
// Only runs when site.build.minifyHTML is enabled and html-minifier is installed.
async function minifyHTMLInDir(dir, config) {
  if (!config.site.build.minifyHTML || !htmlMinifier) return;
  const files = getAllFiles(dir).filter(f => /\.html?$/i.test(f));
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const minified = htmlMinifier.minify(content, {
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeAttributeQuotes: true,
        removeEmptyAttributes: true,
        minifyCSS: config.site.build.minifyCSS,
        minifyJS: config.site.build.minifyJS,
        processScripts: ['text/javascript'],
        decodeEntities: true
      });
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
  const files = getAllFiles(DIST_DIR).filter(f => bustRegex.test(f) && !f.includes('node_modules'));
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
    const mediaManifest = await optimizeMedia(config);
    const articles = await processArticles(config, mediaManifest);
    if (articles.length === 0) console.log('  [WARN] No articles found');
    const tags = collectTags(articles);
    const categories = collectCategories(articles);
    if (config.site.build.relatedArticles !== false) computeRelatedArticles(articles);
    const includesData = processIncludes(config);
    const pagesContent = processPagesContent(config);
    if (config.theme.articleFooter && config.theme.articleFooter.enabled && config.theme.articleFooter.source) {
      if (!pagesContent || !pagesContent[config.theme.articleFooter.source]) {
        console.warn(`  [WARN] articleFooter.source "${config.theme.articleFooter.source}" not found in pages/ directory`);
      }
    }
    const baseData = buildPageData(config, articles, tags, categories);
    if (includesData) baseData.includesContent = includesData;
    if (pagesContent) baseData.pagesContent = pagesContent;
    const customPages = processCustomPages(config, baseData);
    await generatePages(config, articles, baseData, customPages);
    await generateRSS(config, articles);
    await generateSitemap(config, articles, tags, categories, customPages);
    generateSearchIndex(config, articles);
    generateSecurityHeaders(config);
    await minifyAll(config);
    await cacheBust(config);
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
    if (config.site.build.buildReport !== false) generateBuildReport(config, articles, tags, categories, customPages, elapsed);
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
  var mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain' };
  http.createServer(function(req, res) {
    var urlPath = decodeURIComponent(req.url.split('?')[0]);
    var urlNoSlash = urlPath.replace(/\/$/, '');
    var filePath = urlNoSlash ? path.join(DIST_DIR, urlNoSlash) : path.join(DIST_DIR, 'index.html');
    try { if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html'); } catch(e) {}
    if (!fs.existsSync(filePath)) {
      var alt = filePath + '.html';
      if (fs.existsSync(alt)) filePath = alt;
      else filePath = path.join(DIST_DIR, '404.html');
    }
    fs.readFile(filePath, function(err, data) {
      if (err) { res.writeHead(500); res.end('Server Error'); return; }
      var ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(PORT, function() {
    console.log('  Server: http://localhost:' + PORT + '/');
    console.log('  (Press Ctrl+C to stop)');
  });
}
