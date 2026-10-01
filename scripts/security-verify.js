#!/usr/bin/env node
require('./lib/process-guard.js');
// Security regression verification for S-ynapse.
// Injects a hostile article into an isolated .tmp-test site (never the real
// articles/), runs a real build, and asserts that no XSS payload reaches the
// output (post page HTML + search index). The isolated site is removed afterwards.
// 构建输出固定写入 build-artifacts/sec-verify/site（独立目录）：CI 会导出
// SYNAPSE_OUT_DIR=<仓库>/dist 供其他步骤使用，若这里沿用环境变量/默认解析，
// 夹具站点会被构建进真实 dist，污染后续 test:smoke。验证成功即清理，失败保留现场。

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createTestSite } = require('./lib/test-site-builder');

const PROJECT_DIR = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(PROJECT_DIR, 'build-artifacts', 'sec-verify');
const TEMP_SLUG = '_sec-verify';
const ESCAPE_NAME = '_sec_escape_out';

const MALICIOUS = `---
title: 'S-ynapse sec verify </script><script>window.__SEC_PWNED__=1</script>'
slug: ${TEMP_SLUG}
tags: ["安全验证"]
categories: ["安全"]
date: 2020-01-01 00:00
---

# 安全验证

<p>合法段落</p>

<script>alert(1)</script>

<img src="/assets/sec-verify-placeholder.png" onerror="alert(99)">

<a href="javascript:alert(2)">危险链接</a>

<iframe src="https://evil.example.com"></iframe>

<dl><dt>术语</dt><dd>说明</dd></dl>

<a href="jav&#x61;script:alert(3)">实体编码链接</a>

<a title="x>y" href="javascript:alert(4)">属性截断</a>

<img srcset=a"onerror="alert(5)">
`;

const MALICIOUS_SLUG = `---
title: 'Slug escape attempt'
slug: ../../${ESCAPE_NAME}
date: 2020-01-02 00:00
---

# slug escape
`;

const site = createTestSite({
  articles: 0,
  pages: 0,
  langs: ['zh'],
  linkProject: true,
  extraFiles: { [path.join('articles', 'zh', TEMP_SLUG + '.md')]: MALICIOUS }
});
// 夹具默认 security.json5 为空（CSP 关闭），无法验证 nonce 注入；此处启用最小 CSP 与安全头，
// 与真实站点生成路径一致（构建期 applyCspNonce 会注入 nonce 并移除 unsafe-inline）。
fs.writeFileSync(path.join(site.root, 'security.json5'), `{
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'frame-ancestors': ["'none'"]
    }
  },
  headers: { 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' }
}
`, 'utf-8');
const ROOT = site.root;
const DIST = path.join(ARTIFACTS_DIR, 'site');
const TEMP_SLUG_FILE = path.join(ROOT, 'articles', 'zh', '_sec-slug.md');
const DIST_INDEX = path.join(DIST, 'zh', TEMP_SLUG, 'index.html');

// 搜索索引为内容寻址产物（dist/assets/search-index.<hash>.json）：优先按 zh 页面注入的 URL 定位，
// 回退扫描 assets 目录（页面缺失/构建降级时仍能覆盖索引内容检查）。
function findSearchIndexFile() {
  const zhIndexHtml = path.join(DIST, 'zh', 'index.html');
  if (fs.existsSync(zhIndexHtml)) {
    const m = fs.readFileSync(zhIndexHtml, 'utf-8').match(/__SEARCH_INDEX_URL__\s*=\s*"([^"]+)"/);
    if (m) {
      const file = path.join(DIST, m[1].replace(/^\//, '').split('/').join(path.sep));
      if (fs.existsSync(file)) return file;
    }
  }
  const assetsDir = path.join(DIST, 'assets');
  if (!fs.existsSync(assetsDir)) return '';
  for (const name of fs.readdirSync(assetsDir)) {
    if (/^search-index\.[0-9a-f]+\.json$/.test(name)) return path.join(assetsDir, name);
  }
  return '';
}

function fail(msg) {
  throw new Error(msg);
}

function build() {
  // 显式 --out 优先于环境变量（resolveOutputDir 语义：--out > SYNAPSE_OUT_DIR > internals > dist），
  // 保证 CI 导出的 SYNAPSE_OUT_DIR 不会把构建引向真实 dist。
  execFileSync(process.execPath, [path.join(PROJECT_DIR, 'scripts', 'build.js'), '--out', DIST], {
    cwd: PROJECT_DIR,
    env: Object.assign({}, process.env, { SYNAPSE_ROOT: ROOT, SYNAPSE_OUT_DIR: DIST }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function collectHtmlFiles(dir) {
  const out = [];
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.html?$/i.test(entry.name)) out.push(p);
    }
  })(dir);
  return out;
}

// CSP 回归断言：_headers 中 script-src 与 style-src 携带同一枚构建期 nonce 且 elem 语境
// 均无 'unsafe-inline'；不再声明 style-src-attr（模板/产物无内联 style 属性，属性语境按 CSP3
// 回退到 style-src 同样拒绝内联）；frame-ancestors 'none' 存在；产物下所有内联 <style> 块
// 都带有该 nonce（否则会被 CSP 拦截），且所有 HTML 不含元素 style 属性。
function verifyCspNonceCoverage() {
  const headersPath = path.join(DIST, '_headers');
  if (!fs.existsSync(headersPath)) fail('_headers not generated');
  const headersText = fs.readFileSync(headersPath, 'utf-8');
  const cspLine = headersText.split('\n').find((line) => line.includes('Content-Security-Policy'));
  if (!cspLine) fail('CSP header missing in dist/_headers');
  const directives = cspLine.split(';').map((part) => part.trim());
  const scriptSrc = directives.find((part) => part.startsWith('script-src ')) || '';
  const styleSrc = directives.find((part) => part.startsWith('style-src ')) || '';
  const styleAttr = directives.find((part) => part.startsWith('style-src-attr ')) || '';
  const scriptNonce = /'nonce-([^']+)'/.exec(scriptSrc);
  const styleNonce = /'nonce-([^']+)'/.exec(styleSrc);
  if (!scriptNonce) fail('script-src missing build-time nonce in _headers');
  if (!styleNonce) fail('style-src missing build-time nonce in _headers');
  if (scriptNonce[1] !== styleNonce[1]) fail('script-src and style-src must share the same build-time nonce');
  if (scriptSrc.includes("'unsafe-inline'")) fail("script-src must not allow 'unsafe-inline'");
  if (styleSrc.includes("'unsafe-inline'")) fail("style-src must not allow 'unsafe-inline' (element context)");
  if (styleAttr.includes("'unsafe-inline'")) fail("style-src-attr must not allow 'unsafe-inline' (inline style attributes are eliminated)");
  if (!cspLine.includes("frame-ancestors 'none'")) fail("frame-ancestors 'none' missing in _headers CSP");
  let styleTags = 0;
  for (const file of collectHtmlFiles(DIST)) {
    const text = fs.readFileSync(file, 'utf-8');
    const re = /<style\b([^>]*)>/gi;
    let match;
    while ((match = re.exec(text))) {
      styleTags += 1;
      if (!/\bnonce\s*=\s*["']/.test(match[1])) {
        fail('inline <style> without nonce: ' + path.relative(ROOT, file));
      }
      if (!match[1].includes(styleNonce[1])) {
        fail('inline <style> nonce mismatch in ' + path.relative(ROOT, file));
      }
    }
    if (/[\s"']style\s*=/.test(text)) {
      fail('inline style attribute found (style-src-attr would block it): ' + path.relative(ROOT, file));
    }
  }
  if (styleTags === 0) fail('no inline <style> found in dist; nonce injection cannot be verified');
}

let failed = false;
fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
try {
  build();

  if (!fs.existsSync(DIST_INDEX)) fail(`post page not generated: ${DIST_INDEX}`);
  const html = fs.readFileSync(DIST_INDEX, 'utf-8');
  const searchFile = findSearchIndexFile();
  const searchRaw = searchFile ? fs.readFileSync(searchFile, 'utf-8') : '';
  // HTML semantics: <title> is RCDATA, and quoted attribute values never
  // start elements — minify-html re-serializes character references there,
  // so a naked `<script>window.__SEC_PWNED__` inside them is inert text, not
  // a real element. The original string checks false-positived on those.
  // Scan with a mini tokenizer that respects quoted attributes and RCDATA
  // element boundaries, matching browser tag-splitting.
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  const titleText = titleMatch ? titleMatch[1] : '';
  if (titleText.includes('</title>')) fail('title payload breaks out of the RCDATA title element');
  if (!titleText.includes('S-ynapse sec verify')) {
    fail('title payload not rendered as text in post page');
  }
  const scanScripts = (doc) => {
    const scripts = [];
    let i = 0;
    while (i < doc.length) {
      const lt = doc.indexOf('<', i);
      if (lt === -1) break;
      let j = lt + 1;
      let quote = null;
      let gt = -1;
      while (j < doc.length) {
        const c = doc[j];
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '>') { gt = j; break; }
        j++;
      }
      if (gt === -1) break;
      const tagText = doc.slice(lt + 1, gt);
      const mi = /^[ \t]*([a-zA-Z][a-zA-Z0-9]*)/.exec(tagText);
      if (!mi) { i = lt + 1; continue; }
      const name = mi[1].toLowerCase();
      if (name === 'script') {
        const rest = doc.slice(gt + 1);
        const cm = /<\/script\s*>/i.exec(rest);
        const content = cm ? rest.slice(0, cm.index) : rest;
        scripts.push({ tagText, content });
        i = gt + 1 + (cm ? cm.index + cm[0].length : rest.length);
      } else if (name === 'title' || name === 'style') {
        const rest = doc.slice(gt + 1);
        const cm = new RegExp('</' + name + '\\s*>', 'i').exec(rest);
        i = gt + 1 + (cm ? cm.index + cm[0].length : rest.length);
      } else {
        i = gt + 1;
      }
    }
    return scripts;
  };
  for (const s of scanScripts(html)) {
    const typeM = /type\s*=\s*([^\s>]+)/.exec(s.tagText);
    const typeVal = typeM ? typeM[1].replace(/^["']|["']$/g, '') : '';
    if (typeVal === 'application/ld+json') {
      if (s.content.includes('</script>')) fail('ld+json payload breaks out of its script element');
      continue;
    }
    if (!s.content.includes('window.__SEC_PWNED__')) continue;
    // Payload inside a JS string literal (e.g. window.__SEARCH_DATA__ JSON)
    // is inert data; executable code is not.
    const code = s.content.replace(/"(?:\\.|[^"\\])*"/g, '')
      .replace(/'(?:\\.|[^'\\])*'/g, '').replace(/`(?:\\.|[^`\\])*`/g, '');
    if (code.includes('window.__SEC_PWNED__')) fail('payload is executable code in <script> element');
  }
  if (html.includes('<script>alert(1)')) fail('script tag survived sanitization in article body');
  if (html.includes('onerror="alert(99)"')) fail('event handler attribute survived in article body');
  if (html.includes('javascript:alert(2)')) fail('javascript: URI survived in article body');
  if (html.includes('javascript:alert(3)')) fail('entity-encoded javascript: URI survived in article body');
  if (html.includes('javascript:alert(4)')) fail('quoted-gt javascript: URI survived in article body');
  if (html.includes('alert(3)') || html.includes('alert(4)')) fail('obfuscated javascript payload text reached article body');
  if (/\sonerror\s*=\s*["']?alert\(5\)/i.test(html)) fail('srcset attribute escape created an executable onerror attribute');
  if (html.includes('<iframe')) fail('iframe survived sanitization in article body');
  if (!html.includes('<dl>') || !html.includes('<dt>术语') || !html.includes('说明')) {
    fail('whitelisted dl/dt/dd was stripped');
  }
  verifyCspNonceCoverage();
  const searchJson = searchRaw ? JSON.parse(searchRaw) : null;
  if (!searchJson || !Array.isArray(searchJson.docs)) fail('search index is not a valid v2 index (docs array missing)');
  // Regression: search index featuredImage paths must resolve to files in dist
  // (build-time content addressing must match the final cache-busted media names).
  for (const item of searchJson.docs) {
    if (item && item.featuredImage) {
      const rel = String(item.featuredImage).replace(/^\//, '');
      if (!fs.existsSync(path.join(DIST, rel))) {
        fail('search index featuredImage missing in dist (content addressing broken): ' + item.featuredImage);
      }
    }
  }

  // Phase 2: an invalid front-matter slug must abort the build (no silent content loss,
  // no path escape). Build is expected to exit non-zero.
  fs.writeFileSync(TEMP_SLUG_FILE, MALICIOUS_SLUG, 'utf-8');
  let slugAborted = false;
  try { build(); } catch (e) { slugAborted = true; }
  if (!slugAborted) fail('invalid article slug did not abort the build');
  if (fs.existsSync(path.join(ROOT, ESCAPE_NAME))) fail('invalid article slug escaped the site root');
  if (fs.existsSync(path.join(DIST, 'zh', ESCAPE_NAME))) fail('invalid article slug produced a page outside its language directory');

  console.log('[PASS] Security verification: no XSS payload reached output; whitelist preserved.');
} catch (err) {
  console.error('[FAIL] Security verification threw:', err.message);
  failed = true;
} finally {
  try { site.cleanup(); } catch { /* 忽略：夹具清理失败不影响验证结论 */ }
  if (failed) {
    process.stderr.write('[sec-verify] 失败现场保留：' + path.relative(PROJECT_DIR, ARTIFACTS_DIR).split(path.sep).join('/') + '\n');
  } else {
    try { fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* 忽略：工件清理失败不影响验证结论 */ }
  }
}
process.exit(failed ? 1 : 0);
