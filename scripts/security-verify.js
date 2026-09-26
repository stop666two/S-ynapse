#!/usr/bin/env node
// Security regression verification for S-ynapse.
// Injects a hostile article into articles/, runs a real build, and asserts
// that no XSS payload reaches dist/ output (post page HTML + search index).
// Restores the workspace by removing the temp article and rebuilding.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMP_FILE = path.join(ROOT, 'articles', 'zh', '_sec-verify.md');
const TEMP_SLUG_FILE = path.join(ROOT, 'articles', 'zh', '_sec-slug.md');
const TEMP_SLUG = '_sec-verify';
const ESCAPE_NAME = '_sec_escape_out';
const DIST_INDEX = path.join(ROOT, 'dist', 'zh', TEMP_SLUG, 'index.html');
const DIST_SEARCH = path.join(ROOT, 'dist', 'zh', 'search-index.json');

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

<img srcset=a"onerror="alert(5)>
`;

const MALICIOUS_SLUG = `---
title: 'Slug escape attempt'
slug: ../../${ESCAPE_NAME}
date: 2020-01-02 00:00
---

# slug escape
`;

function fail(msg) {
  throw new Error(msg);
}

function build() {
  execFileSync(process.execPath, [path.join('scripts', 'build.js')], {
    cwd: ROOT,
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
// 回退到 style-src 同样拒绝内联）；frame-ancestors 'none' 存在；dist 下所有内联 <style> 块
// 都带有该 nonce（否则会被 CSP 拦截），且所有 HTML 不含元素 style 属性。
function verifyCspNonceCoverage() {
  const headersPath = path.join(ROOT, 'dist', '_headers');
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
  for (const file of collectHtmlFiles(path.join(ROOT, 'dist'))) {
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
try {
  fs.writeFileSync(TEMP_FILE, MALICIOUS, 'utf-8');
  build();

  if (!fs.existsSync(DIST_INDEX)) fail(`post page not generated: ${DIST_INDEX}`);
  const html = fs.readFileSync(DIST_INDEX, 'utf-8');
  const searchRaw = fs.existsSync(DIST_SEARCH) ? fs.readFileSync(DIST_SEARCH, 'utf-8') : '';
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
  const searchJson = searchRaw ? JSON.parse(searchRaw) : [];
  if (!Array.isArray(searchJson)) fail('search index is not valid JSON array');
  // Regression: cache-bust must rewrite featuredImage paths inside search-index.json,
  // otherwise lazy search thumbnails 404 in production.
  for (const item of searchJson) {
    if (item && item.featuredImage) {
      const rel = String(item.featuredImage).replace(/^\//, '');
      if (!fs.existsSync(path.join(ROOT, 'dist', rel))) {
        fail('search index featuredImage missing in dist (cache-bust rewrite broken): ' + item.featuredImage);
      }
    }
  }

  // Phase 2: an invalid front-matter slug must abort the build (no silent content loss,
  // no path escape). Build is expected to exit non-zero.
  fs.writeFileSync(TEMP_SLUG_FILE, MALICIOUS_SLUG, 'utf-8');
  let slugAborted = false;
  try { build(); } catch (e) { slugAborted = true; }
  if (!slugAborted) fail('invalid article slug did not abort the build');
  if (fs.existsSync(path.join(ROOT, ESCAPE_NAME))) fail('invalid article slug escaped the project directory');
  if (fs.existsSync(path.join(ROOT, 'dist', 'zh', ESCAPE_NAME))) fail('invalid article slug produced a page outside its language directory');
  fs.rmSync(TEMP_SLUG_FILE, { force: true });

  console.log('[PASS] Security verification: no XSS payload reached dist/; whitelist preserved.');
} catch (err) {
  console.error('[FAIL] Security verification threw:', err.message);
  failed = true;
} finally {
  try { fs.rmSync(TEMP_FILE, { force: true }); } catch { /* 忽略：临时文件清理失败不影响验证结论 */ }
  try { fs.rmSync(TEMP_SLUG_FILE, { force: true }); } catch { /* 忽略：临时文件清理失败不影响验证结论 */ }
  try {
    build();
    console.log('[INFO] Rebuilt clean site after verification.');
  } catch (err) {
    console.error('[WARN] Final rebuild failed:', err.message);
  }
}
process.exit(failed ? 1 : 0);
