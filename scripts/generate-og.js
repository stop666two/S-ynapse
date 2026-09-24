#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const sharp = require('sharp');
const { safeSlug, validateSlug } = require('./lib/utils');
const { resolveOgFormat } = require('./lib/og-format');
const { atomicTempPath, commitAtomicTemp, discardAtomicTemp } = require('./lib/atomic-write');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const OUT_DIR = path.join(ROOT, 'dist', 'og');
let WIDTH = 1200;
let HEIGHT = 630;
const FONT = 'Microsoft YaHei, system-ui, sans-serif';

function stripBom(text) {
  return text.includes('\uFEFF') ? text.replace(/^\uFEFF/, '') : text;
}

function readConfigFile(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return null;
  let raw = stripBom(fs.readFileSync(file, 'utf-8')).replace(/\r\n/g, '\n');
  try {
    return require('json5').parse(raw);
  } catch (e) {
    try {
      return JSON.parse(raw);
    } catch (e2) {
      return null;
    }
  }
}

function parseFrontMatter(raw) {
  const text = stripBom(String(raw)).replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!m) return {};
  const attrs = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let val = kv[2].trim();
    const q = val.match(/^['"]([\s\S]*)['"]$/);
    if (q) val = q[1];
    attrs[kv[1]] = val;
  }
  return attrs;
}

function walkArticles(dir, out) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkArticles(p, out);
    else if (/\.md$/i.test(name)) out.push(p);
  }
  return out;
}

function fetchUrl(url, redirects) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 3) {
        res.resume();
        resolve(fetchUrl(new URL(res.headers.location, url).toString(), redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// 读取封面本地文件（frontmatter 的 cover/featuredImage 可能是相对路径）。
// 安全约束：解析后的绝对路径必须位于项目根内；越界路径（如 ../../etc/hosts 或
// C:/Windows/...）一律拒绝并告警，防止被篡改的 frontmatter 读取仓库外文件。
// 返回：Buffer（找到且合法）或 null（不存在/越界）；网络 URL 走 fetchUrl。
async function loadCoverBuffer(cover) {
  if (/^https?:\/\//i.test(cover)) return fetchUrl(cover, 0);
  const rel = cover.replace(/\\/g, '/').replace(/^\/+/, '');
  const rootResolved = path.resolve(ROOT) + path.sep;
  const candidates = [
    path.join(ROOT, rel),
    path.join(ROOT, 'media', rel),
    path.join(ROOT, 'static', rel),
    path.join(ROOT, 'assets', rel)
  ];
  let warned = false;
  for (const c of candidates) {
    const abs = path.resolve(c);
    if (!abs.startsWith(rootResolved)) {
      if (!warned) {
        console.warn('  [WARN] generate-og: 封面路径越界已拒绝: ' + String(cover).slice(0, 120));
        warned = true;
      }
      continue;
    }
    if (fs.existsSync(abs)) return fs.readFileSync(abs);
  }
  return null;
}

function parseColor(val, fallback) {
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(s) || /^rgba?\([^)]*\)$/.test(s)) return s;
  }
  return fallback;
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapTitle(text, maxChars) {
  const chars = Array.from((text || '').trim());
  const out = [];
  let line = '';
  for (const ch of chars) {
    line += ch;
    if (Array.from(line).length >= maxChars) {
      out.push(line);
      line = '';
    } else if (/[\s,，。；;、—!?！？)）]/.test(ch) && Array.from(line).length >= Math.ceil(maxChars * 0.6)) {
      out.push(line);
      line = '';
    }
  }
  if (line) out.push(line);
  return out;
}

function fitLines(lines, max) {
  const n = max > 0 ? max : 2;
  if (lines.length <= n) return lines;
  lines = lines.slice(0, n);
  lines[n - 1] = lines[n - 1] + '…';
  return lines;
}

function shadowTextLines(x, y, size, lines, lineHeight, anchor, fill, shadow, letterSpacing) {
  fill = fill || '#fff';
  const lsStyle = letterSpacing ? ` letter-spacing="${letterSpacing}"` : '';
  const safeLines = lines.map(esc);
  const parts = [];
  safeLines.forEach((ln, i) => {
    const ty = y + i * lineHeight;
    if (shadow !== false) parts.push(`<text x="${x}" y="${ty + 2}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#000" opacity="0.4"${lsStyle}>${ln}</text>`);
    parts.push(`<text x="${x}" y="${ty}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${fill}" font-style="normal"${lsStyle}>${ln}</text>`);
  });
  return parts.join('\n  ');
}

function coverOverlay(siteTitle, titleLines) {
  const barTop = HEIGHT - 270;
  const titleSize = 50;
  const lineHeight = 66;
  const startY = 528;
  const texts = [];
  texts.push(shadowTextLines(80, 466, 24, [siteTitle], 0, 'start'));
  texts.push(shadowTextLines(80, startY, titleSize, titleLines, lineHeight, 'start'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs><linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.78"/></linearGradient></defs>
  <rect x="0" y="${barTop}" width="${WIDTH}" height="${HEIGHT - barTop}" fill="url(#bar)"/>
  ${texts.join('\n  ')}
</svg>`;
}

const TEMPLATE_CHARS = { aurora: 12, mesh: 14, grid: 14, paper: 16, duotone: 14 };

function hashHue(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function hsl(h, s, l) { return 'hsl(' + (((h % 360) + 360) % 360) + ',' + s + '%,' + l + '%)'; }
function catOf(raw) {
  const m = String(raw || '').match(/\[([^\]]*)\]|(.+)/);
  const inner = (m && (m[1] || m[2])) || '';
  return inner.split(/[,，]/)[0].replace(/["']/g, '').trim();
}
function angleXY(angle) {
  const a = (parseFloat(angle) || 135) * Math.PI / 180;
  return { x1: '0%', y1: '0%', x2: Math.round((Math.cos(a) + 1) * 50) + '%', y2: Math.round((Math.sin(a) + 1) * 50) + '%' };
}
function textLayer(siteTitle, siteUrl, lines, size, lineHeight, align, style, fill, shadow) {
  const parts = [];
  if (style.showSite !== false) parts.push(`<text x="80" y="110" font-family="${FONT}" font-size="42" font-weight="700" fill="${fill}" opacity="0.95">${esc(siteTitle)}</text>`);
  const left = align === 'left';
  const x = left ? 90 : Math.round(WIDTH / 2);
  const anchor = left ? 'start' : 'middle';
  const total = (lines.length - 1) * lineHeight;
  const startY = Math.round(HEIGHT / 2 - total / 2 + size * 0.36);
  parts.push(shadowTextLines(x, startY, size, lines, lineHeight, anchor, fill, shadow, style.letterSpacing || ''));
  if (siteUrl && style.showUrl !== false) parts.push(`<text x="${WIDTH - 80}" y="${HEIGHT - 42}" text-anchor="end" font-family="${FONT}" font-size="24" fill="${fill}" opacity="0.6">${esc(siteUrl)}</text>`);
  return parts.join('\n  ');
}
function chipLayer(category, style, from) {
  if (!category || style.showCategory === false) return '';
  const label = esc(category);
  const w = Math.max(120, label.length * 26 + 48);
  const x = WIDTH - 80 - w;
  return `<rect x="${x}" y="64" rx="24" width="${w}" height="48" fill="${from}" opacity="0.92"/><text x="${x + w / 2}" y="96" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="600" fill="#fff">${label}</text>`;
}
function renderCover(o) {
  const style = o.style || {};
  const t = o.template || 'aurora';
  const from = o.from, to = o.to;
  const pal = o.palette || {};
  const grad = angleXY(style.gradientAngle);
  const text = textLayer(o.siteTitle, o.siteUrl, o.lines, o.size, o.lineHeight, style.align, style, t === 'paper' ? pal.paperText : pal.darkText, t !== 'paper');
  const chip = chipLayer(o.category, style, from);
  if (t === 'mesh') {
    const a = hsl(hashHue(o.category || o.siteTitle) + 40, 62, 55);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="m1" cx="20%" cy="18%" r="70%"><stop offset="0%" stop-color="${from}" stop-opacity="0.95"/><stop offset="100%" stop-color="${from}" stop-opacity="0"/></radialGradient>
    <radialGradient id="m2" cx="82%" cy="30%" r="65%"><stop offset="0%" stop-color="${to}" stop-opacity="0.9"/><stop offset="100%" stop-color="${to}" stop-opacity="0"/></radialGradient>
    <radialGradient id="m3" cx="55%" cy="95%" r="70%"><stop offset="0%" stop-color="${a}" stop-opacity="0.55"/><stop offset="100%" stop-color="${a}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${pal.darkBg}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#m1)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#m2)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#m3)"/>
  ${chip}
  ${text}
</svg>`;
  }
  if (t === 'grid') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs><pattern id="gp" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${pal.darkText}" stroke-opacity="0.07" stroke-width="1"/></pattern>
  <linearGradient id="gb" x1="${grad.x1}" y1="${grad.y1}" x2="${grad.x2}" y2="${grad.y2}"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#gb)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#gp)"/>
  <rect x="0" y="${HEIGHT - 10}" width="${WIDTH}" height="10" fill="${from}"/>
  ${chip}
  ${text}
</svg>`;
  }
  if (t === 'paper') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs><filter id="nz"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${pal.paperBg}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" filter="url(#nz)" opacity="0.05"/>
  <rect x="90" y="${Math.round(HEIGHT * 0.74)}" width="160" height="8" rx="4" fill="${from}"/>
  ${chip}
  ${text}
</svg>`;
  }
  if (t === 'duotone') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${from}"/>
  <polygon points="${WIDTH},0 ${WIDTH},${HEIGHT} ${Math.round(WIDTH * 0.42)},${HEIGHT} ${Math.round(WIDTH * 0.62)},0" fill="${to}"/>
  ${chip}
  ${text}
</svg>`;
  }
  const useGrad = style.useGradient !== false;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs><linearGradient id="bg" x1="${grad.x1}" y1="${grad.y1}" x2="${grad.x2}" y2="${grad.y2}"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${useGrad ? 'url(#bg)' : from}"/>
  ${chip}
  ${text}
</svg>`;
}

// 清理陈旧 OG 产物：删除 dist/og/{lang}/ 下本次未生成的 PNG（历史草稿、改名/删除文章遗留）。
// 仅在未指定 --only 时调用（--only 是定向补图，不代表完整集合，不能作为删除依据）。
// 只删 png/jpg；目录结构保留。返回删除数量。
function pruneStaleOg(madeByLang) {
  if (!fs.existsSync(OUT_DIR)) return 0;
  let removed = 0;
  for (const lang of fs.readdirSync(OUT_DIR)) {
    const dir = path.join(OUT_DIR, lang);
    if (!fs.statSync(dir).isDirectory()) continue;
    const keep = madeByLang.get(lang) || new Set();
    for (const name of fs.readdirSync(dir)) {
      if (!/\.(png|jpg)$/i.test(name) || keep.has(name)) continue;
      try {
        fs.unlinkSync(path.join(dir, name));
        removed++;
        console.log(`pruned: ${lang}/${name}`);
      } catch (err) {
        console.warn(`  [WARN] 无法删除陈旧 OG 图 ${lang}/${name}: ${err.message}`);
      }
    }
  }
  if (removed) console.log(`OG cleanup: ${removed} stale image(s) removed`);
  return removed;
}

async function main() {
  const siteConfig = readConfigFile('site.json5') || {};
  const themeConfig = readConfigFile('theme.json5') || {};
  const siteTitle = (siteConfig.title || 'S-ynapse').toString();
  const siteUrl = String(siteConfig.domain || siteConfig.url || '');
  const themeColors = themeConfig.colors || themeConfig;
  const darkColors = (themeConfig.darkMode && themeConfig.darkMode.colors) || {};
  const fromColor = parseColor(themeColors.primary || themeConfig.colorPrimary);
  const toColor = parseColor(themeColors.secondary || themeConfig.colorSecondary);
  const darkBg = parseColor(darkColors.background, parseColor(themeColors.text));
  const darkText = parseColor(darkColors.text, parseColor(themeColors.background));
  const paperBg = parseColor(themeColors.background);
  const paperText = parseColor(themeColors.text);
  if (!fromColor || !toColor || !darkBg || !darkText || !paperBg || !paperText) {
    console.error('[FATAL] generate-og: theme.json5 必须提供 colors.primary/secondary/background/text 与 darkMode.colors.background/text（不允许代码内置配色兜底）');
    process.exit(1);
  }
  const palette = { darkBg, darkText, paperBg, paperText };
  const featuresConfig = readConfigFile('features.json5') || {};
  const ogCfg = featuresConfig.ogImage || {};
  const ogFmt = resolveOgFormat(ogCfg);
  const styleCfg = featuresConfig.ogImageStyle || {};
  if (ogFmt.format === 'jpeg') console.log(`  OG format: jpeg (quality ${ogFmt.quality})`);
  const paletteMode = styleCfg.palette || 'theme';
  if (+ogCfg.width > 0) WIDTH = +ogCfg.width;
  if (+ogCfg.height > 0) HEIGHT = +ogCfg.height;

  const args = process.argv.slice(2);
  let only = null;
  if (args[0] === '--only' && args[1]) {
    only = new Set(args[1].split(',').map(s => s.trim()).filter(Boolean));
  }
  // --drafts：与 `npm run dev`（build.js --watch --drafts）一致，生成草稿 OG 以便本地预览。
  const showDrafts = args.includes('--drafts');

  const files = walkArticles(ARTICLES_DIR, []);
  if (!files.length) {
    console.log('No articles found in articles/');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const usedSlugs = new Map();
  const madeSlugs = new Map();
  const madeByLang = new Map();
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    let slug;
    let title;
    let cover;
    let fileTitle;
    let catRaw;
    let isDraft;
    let slugBase;
    let langDir;
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const attrs = parseFrontMatter(raw);
      const rel = path.relative(ARTICLES_DIR, file).replace(/\.md$/i, '');
      const relParts = rel.split(/[\\/]/);
      langDir = relParts.length > 1 ? relParts[0] : 'zh';
      const nameOnly = relParts.length > 1 ? relParts.slice(1).join('--') : relParts[0];
      slugBase = nameOnly;
      fileTitle = path.basename(rel);
      // 标题解析与 build.js 保持一致: frontmatter.title > 正文首个 h1 > 文件名
      title = (attrs.title || '').toString().trim();
      if (!title) {
        const fmSplit = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
        const body = fmSplit ? fmSplit[1] : raw;
        const h1m = body.match(/^#\s+(.+)/m);
        title = h1m ? h1m[1].trim() : fileTitle;
      }
      // slug 解析与 build.js 保持一致: frontmatter.slug（校验后）> safeSlug(title)
      if (attrs.slug != null) {
        const slugCheck = validateSlug(attrs.slug);
        if (!slugCheck.ok) {
          failed++;
          console.error(`  [ERROR] ${path.relative(ARTICLES_DIR, file)}: invalid frontmatter slug (${slugCheck.reason})`);
          continue;
        }
        slug = slugCheck.slug;
      } else {
        slug = safeSlug(title);
      }
      if (!usedSlugs.has(langDir)) usedSlugs.set(langDir, new Set());
      const langUsed = usedSlugs.get(langDir);
      let n = 2;
      const slugBaseForDedup = slug;
      while (langUsed.has(slug)) {
        slug = slugBaseForDedup + '-' + n;
        n++;
      }
      langUsed.add(slug);
      cover = (attrs.cover || attrs.featuredImage || '').trim();
      catRaw = (attrs.categories || '').toString();
      // 与 build.js:1000 的草稿判定保持一致（frontmatter 值为字符串 'true' 或布尔 true）。
      isDraft = attrs.draft === true || attrs.draft === 'true';
    } catch (err) {
      failed++;
      console.error(`  [ERROR] ${path.relative(ARTICLES_DIR, file)}: ${err.message}`);
      continue;
    }

    if (only && !(only.has(slug) || only.has(slugBase) || only.has(path.basename(file, '.md')))) continue;
    // 草稿默认跳过：不落盘、不进入 cache-bust 清单（旧产物由 pruneStaleOg 清理）。
    if (isDraft && !showDrafts) {
      skipped++;
      console.log(`skipped (draft): ${slug}`);
      continue;
    }

    const langOut = path.join(OUT_DIR, langDir);
    fs.mkdirSync(langOut, { recursive: true });
    const outPath = path.join(langOut, slug + '.' + ogFmt.ext);
    let pendingTmp = null;
    try {
      let img;
      if (cover) {
        try {
          const coverBuf = await loadCoverBuffer(cover);
          if (coverBuf) {
            const overlay = Buffer.from(coverOverlay(siteTitle, fitLines(wrapTitle(title, 20))));
            const coverPipe = sharp(coverBuf).resize(WIDTH, HEIGHT, { fit: 'cover' }).composite([{ input: overlay }]);
            pendingTmp = atomicTempPath(outPath);
            img = await (ogFmt.format === 'jpeg'
              ? coverPipe.jpeg({ quality: ogFmt.quality, mozjpeg: true })
              : coverPipe.png()).toFile(pendingTmp);
            commitAtomicTemp(pendingTmp, outPath);
            pendingTmp = null;
          }
        } catch (coverErr) {
      if (pendingTmp) { discardAtomicTemp(pendingTmp); }
          img = null;
        }
      }
      if (!img) {
        let palFrom = fromColor, palTo = toColor;
        if (paletteMode === 'hash' && catRaw) { const h = hashHue(catRaw); palFrom = hsl(h, 52, 34); palTo = hsl(h + 38, 52, 16); }
        const chars = TEMPLATE_CHARS[styleCfg.template] || 12;
        const maxLines = Math.min(4, Math.max(1, +styleCfg.maxLines || 2));
        const size = Math.round((+styleCfg.fontSizeBase || 64) * ((+ogCfg.fontScale > 0) ? +ogCfg.fontScale : 1));
        const lh = Math.round(size * 1.2);
        const svg = Buffer.from(renderCover({ template: styleCfg.template || 'aurora', siteTitle, siteUrl, lines: fitLines(wrapTitle(title, chars), maxLines), size, lineHeight: lh, from: palFrom, to: palTo, style: styleCfg, category: catOf(catRaw), palette }));
        const svgPipe = sharp(svg);
        pendingTmp = atomicTempPath(outPath);
        await (ogFmt.format === 'jpeg'
          ? svgPipe.jpeg({ quality: ogFmt.quality, mozjpeg: true })
          : svgPipe.png()).toFile(pendingTmp);
        commitAtomicTemp(pendingTmp, outPath);
        pendingTmp = null;
      }
      madeSlugs.set(slug, path.basename(outPath));
      if (!madeByLang.has(langDir)) madeByLang.set(langDir, new Set());
      madeByLang.get(langDir).add(path.basename(outPath));
      success++;
      console.log(`generated: ${slug} (${path.basename(outPath)})`);
    } catch (err) {
      if (pendingTmp) { discardAtomicTemp(pendingTmp); pendingTmp = null; }
      failed++;
      console.error(`  [ERROR] ${slug}: ${err.message}`);
    }
  }

  // 有生成失败时保留旧文件（避免因个别失败产生缺口或误删仍被引用的图片）
  if (!only && failed === 0) pruneStaleOg(madeByLang);
  else if (!only) console.warn('  [WARN] OG cleanup skipped: ' + failed + ' image(s) failed to generate');
  console.log(`\nOG images: ${success} generated, ${skipped} skipped (draft), ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('[FAIL] generate-og:', err.message);
  process.exit(1);
});
