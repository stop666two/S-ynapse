'use strict';

const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const BASE = process.argv[2] || process.env.A11Y_BASE || 'http://127.0.0.1:3224';
const AXE_PATH = path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIST = path.join(__dirname, '..', 'dist');
const RESERVED = new Set(['page', 'tags', 'categories', 'archive', 'search', 'gallery', 'favorites', 'links', '404', 'og', 'media', 'assets', 'icons']);

// Pages are derived from the actual build output so the audit can never pass
// against a stale hard-coded slug (audit F-7).
function collectPages() {
  const out = [];
  for (const lang of ['zh', 'en']) {
    const langDir = path.join(DIST, lang);
    if (!fs.existsSync(path.join(langDir, 'index.html'))) continue;
    out.push({ url: '/' + lang + '/', dark: true });
    const dirs = fs.readdirSync(langDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !RESERVED.has(e.name))
      .map((e) => e.name)
      .sort();
    for (const slug of dirs.slice(0, 2)) {
      if (fs.existsSync(path.join(langDir, slug, 'index.html'))) {
        out.push({ url: '/' + lang + '/' + slug + '/', dark: true });
      }
    }
    for (const extra of ['archive', 'tags', 'about', 'search']) {
      if (fs.existsSync(path.join(langDir, extra, 'index.html'))) out.push({ url: '/' + lang + '/' + extra + '/' });
    }
  }
  return out;
}

const PAGES = collectPages();
if (PAGES.length === 0) {
  console.error('FATAL no built pages found under dist/; run `npm run build` first.');
  process.exit(1);
}

const AXE_TAGS = { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  let critical = 0;
  let serious = 0;
  let total = 0;
  let checks = 0;
  let httpFailures = 0;

  for (const spec of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const resp = await page.goto(BASE + spec.url, { waitUntil: 'domcontentloaded' });
    if (!resp || resp.status() < 200 || resp.status() >= 300) {
      httpFailures++;
      console.error('[FAIL] ' + spec.url + ' HTTP ' + (resp ? resp.status() : 'no-response'));
      await page.close();
      continue;
    }
    checks++;
    await new Promise(r => setTimeout(r, 800));
    if (spec.dark) {
      await page.evaluate(() => { const b = document.querySelector('.dark-toggle'); if (b) b.click(); });
      await new Promise(r => setTimeout(r, 500));
    }
    await page.addScriptTag({ path: AXE_PATH });
    const result = await page.evaluate(async (tags) => await window.axe.run(document, { runOnly: tags }), AXE_TAGS);
    const mode = spec.dark ? 'dark' : 'light';
    for (const item of result.violations) {
      const impact = item.impact || 'unknown';
      if (impact === 'critical') critical++;
      else if (impact === 'serious') serious++;
      total++;
      const target = item.nodes[0] && item.nodes[0].target ? item.nodes[0].target.join(' ') : '';
      console.log('[' + spec.url + ' ' + mode + '] ' + impact + ' ' + item.id + ' x' + item.nodes.length + ' :: ' + target);
    }
    await page.close();
  }

  console.log('A11Y SUMMARY pages=' + PAGES.length + ' checked=' + checks + ' httpFailures=' + httpFailures + ' violations=' + total + ' critical=' + critical + ' serious=' + serious);
  await browser.close();
  process.exit(critical + serious + httpFailures > 0 ? 1 : 0);
})().catch(err => { console.error('FATAL ' + err.message); process.exit(1); });
