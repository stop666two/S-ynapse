'use strict';

const path = require('node:path');
const puppeteer = require('puppeteer-core');

const BASE = process.argv[2] || process.env.A11Y_BASE || 'http://127.0.0.1:3224';
const AXE_PATH = path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PAGES = [
  { url: '/zh/', dark: true },
  { url: '/zh/hello-world/', dark: true },
  { url: '/zh/archive/' },
  { url: '/zh/tags/', dark: true },
  { url: '/zh/about/' },
  { url: '/zh/search/' },
  { url: '/en/', dark: true },
  { url: '/en/hello-world/' }
];

const AXE_TAGS = { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  let critical = 0;
  let serious = 0;
  let total = 0;
  let checks = 0;

  for (const spec of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + spec.url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 800));
    if (spec.dark) {
      await page.evaluate(() => { const b = document.querySelector('.dark-toggle'); if (b) b.click(); });
      await new Promise(r => setTimeout(r, 500));
    }
    await page.addScriptTag({ path: AXE_PATH });
    const result = await page.evaluate(async (tags) => await window.axe.run(document, { runOnly: tags }), AXE_TAGS);
    checks++;
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

  console.log('A11Y SUMMARY checks=' + checks + ' violations=' + total + ' critical=' + critical + ' serious=' + serious);
  await browser.close();
  process.exit(critical + serious > 0 ? 1 : 0);
})().catch(err => { console.error('FATAL ' + err.message); process.exit(1); });
