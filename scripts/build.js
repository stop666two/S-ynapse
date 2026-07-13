#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const frontMatter = require('front-matter');
const { marked } = require('marked');
const ejs = require('ejs');

let json5, deepmerge, Feed, sharp, htmlMinifier, CleanCSS, terser, chokidar;
try { json5 = require('json5'); } catch (e) { json5 = { parse: JSON.parse }; }
try { deepmerge = require('deepmerge'); } catch (e) { deepmerge = function(a, b) { return { ...a, ...b }; }; }
try { const feedMod = require('feed'); Feed = feedMod.Feed || feedMod; } catch (e) { Feed = null; }
try { sharp = require('sharp'); } catch (e) { sharp = null; }
try { htmlMinifier = require('html-minifier'); } catch (e) { htmlMinifier = null; }
try { CleanCSS = require('clean-css'); } catch (e) { CleanCSS = null; }
try { terser = require('terser'); } catch (e) { terser = null; }
try { chokidar = require('chokidar'); } catch (e) { chokidar = null; }

let hooks;
try { hooks = require('./hooks'); } catch (e) { hooks = null; }

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const STATIC_DIR = path.join(ROOT, 'static');
const MEDIA_DIR = path.join(ROOT, 'media');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const DIST_DIR = path.join(ROOT, 'dist');
const WATCH_MODE = process.argv.includes('--watch');
const SERVE_MODE = process.argv.includes('--serve');
const PAGES_DIR = path.join(ROOT, 'pages');
const CACHE_BUST_MANIFEST_PATH = path.join(DIST_DIR, 'cache-bust-manifest.json');

function loadConfigFile(filename) {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] Config file not found: ${filename}`);
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return json5.parse(raw);
  } catch (err) {
    console.error(`  [ERROR] Failed to parse ${filename}: ${err.message}`);
    return {};
  }
}

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
      description: '',
      url: 'http://localhost',
      language: 'en',
      postsPerPage: 10,
      rss: { enabled: false, path: '/feed.xml', fullContent: true, maxItems: 50 },
      sitemap: { enabled: true, path: '/sitemap.xml', changefreq: 'weekly', priority: 0.8 },
      pwa: { enabled: false, manifest: {}, serviceWorker: '/sw.js' },
      build: {
        cleanDist: true, minifyHTML: false, minifyCSS: false, minifyJS: false,
        generateIndex: true, generateArchive: true, generateTags: true, generateCategories: true,
        copyStatic: true, optimizeMedia: false, mediaQuality: 85,
        mediaResponsiveSizes: [640, 1024, 1920], mediaFormats: ['webp', 'original'],
        enableCacheBusting: false, cacheBustingPattern: '.*\\.(css|js|png|jpg|svg)$',
        externalLinksTarget: '_blank', externalLinksRel: 'noopener noreferrer'
      }
    },
    theme: { fontFamily: 'sans-serif', codeHighlight: { lineNumbers: false } },
    navigation: { menu: [] },
    sidebar: { enabled: false, widgets: [] },
    footer: {},
    security: { headers: {}, csp: { enabled: false, directives: {} }, robots: { enabled: false, rules: [] } }
  };

  const config = deepmerge.all([defaults, { site, theme, navigation, sidebar, footer, security }]);
  return config;
}

function validateConfig(config) {
  const errors = [];
  if (!config.site.title) errors.push('site.title is required');
  if (!config.site.url) errors.push('site.url is required');
  if (!config.site.language) errors.push('site.language is required');
  if (!config.site.postsPerPage || config.site.postsPerPage < 1) errors.push('site.postsPerPage must be >= 1');
  if (config.theme.darkMode && config.theme.darkMode.enabled) {
    if (!['light', 'dark', 'system'].includes(config.theme.darkMode.default)) {
      errors.push('theme.darkMode.default must be "light", "dark", or "system"');
    }
  }
  if (errors.length > 0) {
    console.error('\n[CONFIG VALIDATION ERRORS]');
    errors.forEach(e => console.error('  - ' + e));
    console.error('');
  }
  return errors.length === 0;
}

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

function copyStatic(config) {
  if (!config.site.build.copyStatic || !fs.existsSync(STATIC_DIR)) {
    console.log('  [SKIP] Static copy disabled or static/ not found');
    return;
  }
  console.log('[3/14] Copying static files...');
  copyDirSync(STATIC_DIR, DIST_DIR);
}

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

function formatDate(dateStr, fmt) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = n => String(n).padStart(2, '0');
  const map = {
    'YYYY': d.getFullYear(),
    'MM': pad(d.getMonth() + 1),
    'DD': pad(d.getDate()),
    'HH': pad(d.getHours()),
    'mm': pad(d.getMinutes()),
    'ss': pad(d.getSeconds())
  };
  let result = fmt || 'YYYY-MM-DD';
  for (const [k, v] of Object.entries(map)) result = result.replace(k, v);
  return result;
}

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

function getMediaManifest() {
  const manifestPath = path.join(DIST_DIR, 'media-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try { return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch (e) {}
  }
  if (fs.existsSync(path.join(ROOT, 'media-manifest.json'))) {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'media-manifest.json'), 'utf-8')); } catch (e) {}
  }
  return null;
}

function setupMarkedRenderer(config, mediaManifest) {
  const usePicture = config.site.build.usePictureTag !== false;
  const lazyLoad = config.site.build.lazyLoadImages !== false;
  const extTarget = config.site.build.externalLinksTarget || '_blank';
  const extRel = config.site.build.externalLinksRel || 'noopener noreferrer';
  const showLineNumbers = config.theme.codeHighlight && config.theme.codeHighlight.lineNumbers;
  const siteUrl = (config.site.url || '').replace(/\/+$/, '');

  marked.use({
    renderer: {
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

      heading(text, level) {
        if (level < 2 || level > 4) return `<h${level}>${text}</h${level}>`;
        const id = safeSlug(text.replace(/<[^>]+>/g, ''));
        return `<h${level} id="${escapeAttr(id)}"><a href="#${escapeAttr(id)}" class="heading-anchor">#</a>${text}</h${level}>`;
      },

      code(text, lang) {
        const langAttr = lang ? ` class="language-${escapeAttr(lang)}"` : '';
        const lnAttr = showLineNumbers ? ' data-line-numbers="true"' : '';
        const langLabel = lang ? ` data-language="${escapeAttr(lang)}"` : '';
        return `<pre${lnAttr}${langLabel}><code${langAttr}>${escapeHtml(text)}</code></pre>`;
      }
    }
  });
}

function escapeAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeSlug(text) {
  if (!text) return '';
  let slug = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || /^[-\s]*$/.test(slug)) {
    slug = encodeURIComponent(text).toLowerCase().replace(/%[0-9a-f]{2}/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (!slug) slug = 'tag-' + Math.random().toString(36).slice(2, 6);
  return slug;
}

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
      let title = attrs.title || '';
      if (!title) {
        const firstH1 = content.match(/^#\s+(.+)/m);
        title = firstH1 ? firstH1[1].trim() : path.basename(file, '.md');
      }
      const slug = attrs.slug || safeSlug(title);
      const url = `/${slug}/`;
      const excerpt = attrs.excerpt || '';
      const date = attrs.date || null;
      const tags = Array.isArray(attrs.tags) ? attrs.tags : [];
      const categories = Array.isArray(attrs.categories) ? attrs.categories : [];
      const draft = attrs.draft === true || attrs.draft === 'true';
      const htmlContent = marked.parse(content);
      let excerptText = excerpt;
      if (!excerptText) {
        const textOnly = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const excerptLen = config.site.build.excerptLength || config.theme.card?.excerptLength || 150;
        excerptText = textOnly.length > excerptLen ? textOnly.slice(0, excerptLen) + '...' : textOnly;
      }
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const readSpeed = config.theme.card?.readTimeSpeed || 265;
      const readTime = Math.max(1, Math.ceil(wordCount / readSpeed));
      articles.push({
        slug, title, url, date, tags, categories, draft,
        content: htmlContent,
        excerpt: excerptText,
        wordCount, readTime,
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

function getTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, name);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

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

function generateSearchData(config, articles) {
  if (!config.navigation.search || !config.navigation.search.enabled || config.navigation.search.provider !== 'local') return '[]';
  const data = articles.filter(a => !a.draft).map(a => ({
    title: a.title,
    url: a.url,
    excerpt: a.excerpt ? a.excerpt.replace(/<[^>]+>/g, '').substring(0, 200) : '',
    tags: a.tags || [],
    categories: a.categories || []
  }));
  return JSON.stringify(data);
}

function buildPageData(config, articles, tags, categories) {
  const published = articles.filter(a => !a.draft);
  return {
    site: config.site,
    theme: config.theme,
    nav: config.navigation,
    sidebar: config.sidebar,
    footer: config.footer,
    security: config.security,
    allArticles: published,
    recentPosts: published,
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

function processCustomPages(config, baseData) {
  console.log('Processing custom pages...');
  const layoutTemplate = getTemplate('layout.ejs');
  const pageTemplate = getTemplate('page.ejs');
  if (!layoutTemplate || !pageTemplate) {
    console.error('  [FATAL] Layout or page template not found');
    return [];
  }
  if (!fs.existsSync(PAGES_DIR)) {
    console.log('  pages/ directory not found, skipping');
    return [];
  }
  const files = fs.readdirSync(PAGES_DIR).filter(f => /\.md$/i.test(f));
  const customPages = [];
  for (const file of files) {
    const filePath = path.join(PAGES_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const fm = frontMatter(raw);
      const attrs = fm.attributes || {};
      const content = fm.body || '';
      const title = attrs.title || path.basename(file, '.md');
      const description = attrs.description || config.site.description || '';
      const slug = attrs.slug || safeSlug(title);
      const date = attrs.date || null;
      const htmlContent = marked.parse(content);
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
  console.log('  Total: ' + customPages.length + ' custom pages processed');
  return customPages;
}

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
  const published = articles.filter(a => !a.draft);

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
    const items = articles.filter(a => !a.draft).slice(0, maxItems);
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
      const published = articles.filter(a => !a.draft);
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

function generateSearchIndex(config, articles) {
  if (!config.navigation.search || !config.navigation.search.enabled || config.navigation.search.provider !== 'local') {
    console.log('  [SKIP] Search index generation disabled or provider not local');
    return;
  }
  console.log('[9/14] Generating search index...');
  const published = articles.filter(a => !a.draft);
  const index = published.map(a => ({
    title: a.title,
    url: a.url,
    excerpt: (a.excerpt || '').replace(/<[^>]+>/g, '').substring(0, 200),
    tags: a.tags,
    categories: a.categories
  }));
  const outputPath = path.join(DIST_DIR, 'search-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`  Created: search-index.json (${index.length} entries)`);
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
  // Update step numbers after security headers
}

async function cacheBust(config) {
  if (!config.site.build.enableCacheBusting) {
    console.log('  [SKIP] Cache busting disabled');
    return;
  }
  console.log('[12/14] Cache busting...');
  const bustPattern = config.site.build.cacheBustingPattern || '.*\\.(css|js|png|jpg|svg)$';
  const bustRegex = new RegExp(bustPattern, 'i');
  const pattern = new RegExp(bustPattern, 'i');
  const files = getAllFiles(DIST_DIR).filter(f => pattern.test(f) && !f.includes('node_modules'));
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

async function build() {
  console.log('========================================');
  console.log('  S-ynapse Static Blog Builder v1.0.0');
  console.log('========================================\n');
  const startTime = Date.now();
  try {
    const config = loadConfig();
    validateConfig(config);
    if (hooks && hooks.preBuild) await hooks.preBuild(config);
    setupDist(config);
    copyStatic(config);
    const mediaManifest = await optimizeMedia(config);
    const articles = await processArticles(config, mediaManifest);
    if (articles.length === 0) console.log('  [WARN] No articles found');
    const tags = collectTags(articles);
    const categories = collectCategories(articles);
    const baseData = buildPageData(config, articles, tags, categories);
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

function startServer() {
  var http = require('http');
  var PORT = parseInt(process.argv[process.argv.indexOf('--port') + 1]) || 3000;
  var mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain' };
  http.createServer(function(req, res) {
    var urlPath = req.url.split('?')[0];
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
