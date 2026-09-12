#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const OUT_DIR = path.join(ROOT, 'dist', 'og');
const WIDTH = 1200;
const HEIGHT = 630;
const FONT = 'Microsoft YaHei, system-ui, sans-serif';
const DEFAULT_FROM = '#1a2b4a';
const DEFAULT_TO = '#2d4a7a';

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

async function loadCoverBuffer(cover) {
  if (/^https?:\/\//i.test(cover)) return fetchUrl(cover, 0);
  const rel = cover.replace(/\\/g, '/').replace(/^\/+/, '');
  const candidates = [
    path.join(ROOT, rel),
    path.join(ROOT, 'media', rel),
    path.join(ROOT, 'static', rel),
    path.join(ROOT, 'assets', rel)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c);
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

function fitLines(lines) {
  if (lines.length <= 2) return lines;
  lines = lines.slice(0, 2);
  lines[1] = lines[1] + '…';
  return lines;
}

function shadowTextLines(x, y, size, lines, lineHeight, anchor) {
  const safeLines = lines.map(esc);
  const parts = [];
  safeLines.forEach((ln, i) => {
    const ty = y + i * lineHeight;
    parts.push(`<text x="${x}" y="${ty + 2}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#000" opacity="0.4">${ln}</text>`);
    parts.push(`<text x="${x}" y="${ty}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#fff" font-style="normal">${ln}</text>`);
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

function gradientSvg(siteTitle, titleLines, siteUrl, fromColor, toColor) {
  const titleSize = 58;
  const lineHeight = 74;
  const startY = 315 - Math.round(((titleLines.length - 1) * lineHeight) / 2) + 20;
  const parts = [];
  parts.push(`<text x="80" y="110" font-family="${FONT}" font-size="42" font-weight="700" fill="#fff" opacity="0.95">${esc(siteTitle)}</text>`);
  parts.push(shadowTextLines(600, startY, titleSize, titleLines, lineHeight, 'middle'));
  if (siteUrl) {
    parts.push(`<text x="1120" y="588" text-anchor="end" font-family="${FONT}" font-size="24" fill="#fff" opacity="0.6">${esc(siteUrl)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${fromColor}"/><stop offset="100%" stop-color="${toColor}"/></linearGradient></defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  ${parts.join('\n  ')}
</svg>`;
}

async function main() {
  const siteConfig = readConfigFile('site.json5') || {};
  const themeConfig = readConfigFile('theme.json5') || {};
  const siteTitle = (siteConfig.title || 'S-ynapse').toString();
  const siteUrl = String(siteConfig.domain || siteConfig.url || '');
  const themeColors = themeConfig.colors || themeConfig;
  const fromColor = parseColor(themeColors.primary || themeConfig.colorPrimary, DEFAULT_FROM);
  const toColor = parseColor(themeColors.secondary || themeConfig.colorSecondary, DEFAULT_TO);

  const args = process.argv.slice(2);
  let only = null;
  if (args[0] === '--only' && args[1]) {
    only = new Set(args[1].split(',').map(s => s.trim()).filter(Boolean));
  }

  const files = walkArticles(ARTICLES_DIR, []);
  if (!files.length) {
    console.log('No articles found in articles/');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const usedSlugs = new Map();
  const madeSlugs = new Map();
  let success = 0;
  let failed = 0;

  for (const file of files) {
    let slug;
    let title;
    let cover;
    let fileTitle;
    let slugBase;
    let langDir = 'zh';
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const attrs = parseFrontMatter(raw);
      const rel = path.relative(ARTICLES_DIR, file).replace(/\.md$/i, '');
      const relParts = rel.split(/[\\/]/);
      langDir = relParts.length > 1 ? relParts[0] : 'zh';
      const nameOnly = relParts.length > 1 ? relParts.slice(1).join('--') : relParts[0];
      slugBase = nameOnly;
      slug = nameOnly;
      if (!usedSlugs.has(langDir)) usedSlugs.set(langDir, new Set());
      const langUsed = usedSlugs.get(langDir);
      let n = 2;
      while (langUsed.has(slug)) {
        slug = nameOnly + '-' + n;
        n++;
      }
      langUsed.add(slug);
      fileTitle = path.basename(rel);
      title = (attrs.title || '').trim() || fileTitle;
      cover = (attrs.cover || attrs.featuredImage || '').trim();
    } catch (err) {
      failed++;
      console.error(`  [ERROR] ${path.relative(ARTICLES_DIR, file)}: ${err.message}`);
      continue;
    }

    if (only && !(only.has(slug) || only.has(slugBase) || only.has(path.basename(file, '.md')))) continue;

    const langOut = path.join(OUT_DIR, langDir);
    fs.mkdirSync(langOut, { recursive: true });
    const outPath = path.join(langOut, slug + '.png');
    try {
      let img;
      if (cover) {
        try {
          const coverBuf = await loadCoverBuffer(cover);
          if (coverBuf) {
            const overlay = Buffer.from(coverOverlay(siteTitle, fitLines(wrapTitle(title, 20))));
            img = await sharp(coverBuf)
              .resize(WIDTH, HEIGHT, { fit: 'cover' })
              .composite([{ input: overlay }])
              .png()
              .toFile(outPath);
          }
        } catch (coverErr) {
          img = null;
        }
      }
      if (!img) {
        const svg = Buffer.from(gradientSvg(siteTitle, fitLines(wrapTitle(title, 12)), siteUrl, fromColor, toColor));
        await sharp(svg).png().toFile(outPath);
      }
      madeSlugs.set(slug, path.basename(outPath));
      success++;
      console.log(`generated: ${slug} (${path.basename(outPath)})`);
    } catch (err) {
      failed++;
      console.error(`  [ERROR] ${slug}: ${err.message}`);
    }
  }

  console.log(`\nOG images: ${success} generated, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('[FAIL] generate-og:', err.message);
  process.exit(1);
});
