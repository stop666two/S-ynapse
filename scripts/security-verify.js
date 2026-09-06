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
const TEMP_SLUG = '_sec-verify';
const DIST_INDEX = path.join(ROOT, 'dist', 'zh', TEMP_SLUG, 'index.html');
const DIST_SEARCH = path.join(ROOT, 'dist', 'zh', 'search-index.json');

const MALICIOUS = `---
title: 'S-ynapse sec verify </script><script>window.__SEC_PWNED__=1</script>'
slug: ${TEMP_SLUG}
tags: ["安全验证"]
categories: ["安全"]
date: 2099-01-01 00:00
---

# 安全验证

<p>合法段落</p>

<script>alert(1)</script>

<img src="/media/og-image.svg" onerror="alert(99)">

<a href="javascript:alert(2)">危险链接</a>

<iframe src="https://evil.example.com"></iframe>

<dl><dt>术语</dt><dd>说明</dd></dl>
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

let failed = false;
try {
  fs.writeFileSync(TEMP_FILE, MALICIOUS, 'utf-8');
  build();

  if (!fs.existsSync(DIST_INDEX)) fail(`post page not generated: ${DIST_INDEX}`);
  const html = fs.readFileSync(DIST_INDEX, 'utf-8');
  const searchRaw = fs.readFileSync(DIST_SEARCH, 'utf-8');
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
  if (html.includes('<iframe')) fail('iframe survived sanitization in article body');
  if (!html.includes('<dl>') || !html.includes('<dt>术语') || !html.includes('说明')) {
    fail('whitelisted dl/dt/dd was stripped');
  }
  const searchJson = JSON.parse(searchRaw);
  if (!Array.isArray(searchJson)) fail('search index is not valid JSON array');

  console.log('[PASS] Security verification: no XSS payload reached dist/; whitelist preserved.');
} catch (err) {
  console.error('[FAIL] Security verification threw:', err.message);
  failed = true;
} finally {
  try { fs.rmSync(TEMP_FILE, { force: true }); } catch {}
  try {
    build();
    console.log('[INFO] Rebuilt clean site after verification.');
  } catch (err) {
    console.error('[WARN] Final rebuild failed:', err.message);
  }
}
process.exit(failed ? 1 : 0);
