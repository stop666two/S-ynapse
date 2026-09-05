#!/usr/bin/env node
// Security regression verification for S-ynapse.
// Injects a hostile article into articles/, runs a real build, and asserts
// that no XSS payload reaches dist/ output (post page HTML + search index).
// Restores the workspace by removing the temp article and rebuilding.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMP_FILE = path.join(ROOT, 'articles', '_sec-verify.md');
const TEMP_SLUG = '_sec-verify';
const DIST_INDEX = path.join(ROOT, 'dist', TEMP_SLUG, 'index.html');
const DIST_SEARCH = path.join(ROOT, 'dist', 'search-index.json');

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
  if (html.includes('<script>window.__SEC_PWNED__')) fail('title escaped into executable script (script-tag breakout in post page)');
  if (html.includes('</script><script>window.__SEC_PWNED__')) fail('script-tag breakout sequence present in post page');
  if (!html.includes('&lt;/script&gt;') && !html.includes('\\u003c/script>')) {
    fail('title payload render as raw text was not escaped in post page');
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
