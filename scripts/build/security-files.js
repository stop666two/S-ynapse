'use strict';

// 安全文件生成模块（scripts/build/security-files.js）。
// 由 scripts/build.js 机械拆分 4/N 迁移而来：函数体原样搬移，行为与拆分前保持一致，
// 以产物哈希等价门禁（scripts/dist-hash-guard.js diff）与 test:build 验证。
const fs = require('fs');
const path = require('path');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { trimCspDirectives } = require('../lib/csp');

function createSecurityFilesModule(ctx) {
  const { distDir, cspNonce, applyHeaderHardening, buildSitemapUrls } = ctx;

// The _headers file sets CSP directives, HTTP security headers, and custom headers
// from the security.json5 configuration. Applied to all paths (/*).
// Note: security-worker.js provides a parallel security layer at the Worker level.
// Generate Cloudflare Pages _redirects file from site.json5 redirects array.
// Each entry: {from, to, permanent} — permanent=true → 301, false → 302.
// Supports wildcard syntax (e.g. "/old/* /new/:splat 301") via CF Pages native matching.
function generateRedirects(config, customPages) {
  const list = config.site.redirects;
  const lines = [];
  const valid = [];

  const langs = (config.site.languages && config.site.languages.length) ? config.site.languages : ['zh'];
  for (const r of list) {
    if (!r || !r.from || !r.to) {
      console.warn('  [WARN] Skipped invalid redirect entry (missing from/to): ' + JSON.stringify(r || null));
      continue;
    }
    // 清洗重定向规则：控制字符（\x00-\x1f 与 \x7f）混入 from/to 会造成规则解析歧义，必须剔除
    // eslint-disable-next-line no-control-regex
    const from = String(r.from).replace(/[\s\u0000-\u001f\u007f]+/g, '');
    // eslint-disable-next-line no-control-regex
    const to = String(r.to).replace(/[\s\u0000-\u001f\u007f]+/g, '');
    if (!from.startsWith('/') || !/^(?:\/|https?:\/\/)/i.test(to)) {
      console.warn('  [WARN] Skipped invalid redirect entry (from must start with "/", to must be a path or http(s) URL): ' + JSON.stringify(r));
      continue;
    }
    const status = r.permanent === false ? 302 : 301;
    valid.push({ from, to, status });
    lines.push(`${from} ${to} ${status}`);
  }
  if (langs.length > 0 && langs[0] !== 'en') {
    if (!lines.some(l => l.startsWith('/ '))) {
      lines.unshift(`/ /${langs[0]}/ 302`);
    }
  }
  for (const l of langs) {
    const pf = '/' + l;
    // manifest 由 PWA 步骤直接产出在根目录（关闭时不产出），不设语言别名，避免 302 到不存在的文件
    const rootAliases = ['/search-index.json', '/feed.xml', '/404.html'];
    for (const alias of rootAliases) {
      if (!lines.some(x => x.startsWith(alias + ' '))) {
        lines.push(`${alias} ${pf}${alias} 302`);
      }
    }
  }
  const firstPf = '/' + (langs[0] || 'zh') + '/';
  for (const p of (customPages || [])) {
    if (!p || !p.slug) continue;
    for (const from of ['/' + p.slug, '/' + p.slug + '/']) {
      if (!lines.some(x => x.startsWith(from + ' '))) {
        lines.push(`${from} ${firstPf}${p.slug}/ 302`);
      }
    }
  }
  if (lines.length === 0) { return; }
  fs.mkdirSync(distDir, { recursive: true });
  writeFileAtomicSync(path.join(distDir, '_redirects'), lines.join('\n') + '\n', 'utf-8');
  console.log('  Created: /_redirects (' + valid.length + ' custom + ' + (lines.length - valid.length) + ' language rules)');
  return valid;
}

/** CSP 裁剪上下文：giscus 是否真正启用、统计 token 是否配置、外链资源引用（决定保留哪些可选域名）。 */
function buildCspTrimContext(config) {
  const site = config.site || {};
  const features = config.features || {};
  const theme = config.theme || {};
  const comments = site.comments || {};
  const fComments = features.comments || {};
  const fGiscus = features.giscus || {};
  const wa = site.webAnalytics || {};
  return {
    giscusNeeded: !!(comments.enabled === true && comments.provider === 'giscus' && fComments.enabled !== false && fGiscus.enabled !== false),
    analyticsNeeded: !!(wa.enabled !== false && wa.token),
    externalAssets: theme.externalAssets || {}
  };
}

// 把构建期 cspNonce 注入内存配置（幂等）：移除 script-src 的 'unsafe-inline'，
// 追加 'nonce-...'。必须早于页面数据组装（meta CSP）、generateSecurityHeaders() 与
// Worker 配置生成，保证三处 directives 完全一致。
function applyCspNonce(config) {
  const csp = config && config.security && config.security.csp;
  if (!csp || !csp.directives || !Array.isArray(csp.directives['script-src'])) return;
  const token = "'nonce-" + cspNonce + "'";
  const next = csp.directives['script-src'].filter(function (v) { return v !== "'unsafe-inline'"; });
  if (next.indexOf(token) === -1) next.push(token);
  csp.directives['script-src'] = next;
}

function generateSecurityHeaders(config) {
  console.log('[10/14] Generating security files...');
  const lines = [];
  const extraSections = [];

  if (config.security.csp && config.security.csp.enabled) {
    const cspName = config.security.csp.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    // 构建期裁剪：按 giscus 开关与 externalAssets 引用移除未使用的可选域名（最小权限）；
    // security.csp.autoTrim=false 时完全按配置原样输出。
    const rawDirectives = config.security.csp.directives || {};
    const directivesObj = config.security.csp.autoTrim === false
      ? rawDirectives
      : trimCspDirectives(rawDirectives, buildCspTrimContext(config));
    const directives = [];
    for (const [key, vals] of Object.entries(directivesObj)) {
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

  const finalHeaders = applyHeaderHardening(config.security);
  for (const [key, val] of Object.entries(finalHeaders)) {
    if (val) lines.push(`  ${key}: ${val}`);
  }

  // Speculation Rules 响应头下发（delivery=header/both）：写规则文件 + 让 CDN 以
  // application/speculationrules+json 提供；Cloudflare Speed Brain 检测到自有规则后会礼让。
  const spec = (config.features && config.features.speculation) || {};
  const specDelivery = spec.delivery || 'inline';
  if (spec.enabled !== false && (specDelivery === 'header' || specDelivery === 'both')) {
    const rule = { where: { and: [{ href_matches: '/*' }] }, eagerness: spec.eagerness || 'moderate' };
    (spec.excludeSelectors || []).forEach(function (sel) { if (sel) rule.where.and.push({ not: { selector_matches: sel } }); });
    rule.where.and.push({ not: { href_matches: '/*\\?*' } });
    const rulesJson = {};
    const mode = spec.mode || 'both';
    if (mode === 'prefetch' || mode === 'both') rulesJson.prefetch = [rule];
    if (mode === 'prerender' || mode === 'both') rulesJson.prerender = [rule];
      writeFileAtomicSync(path.join(distDir, 'speculation-rules.json'), JSON.stringify(rulesJson), 'utf-8');
    console.log('  Created: speculation-rules.json');
    lines.push('  Speculation-Rules: /speculation-rules.json');
    extraSections.push('/speculation-rules.json\n  Content-Type: application/speculationrules+json\n  Access-Control-Allow-Origin: *');
  }

  // Browser cache policy (audit P-5). Only assets/css/* is content-fingerprinted
  // today (site.<hash>.css); /assets/js and /assets/vendor keep stable names, so
  // they must NOT be immutable or upgrades would serve stale files for a year.
  // Media/OG names may be reused when content changes → 7d + revalidate.
  // Disable via site.build.cacheControl === false.
  if (config.site.build.cacheControl !== false) {
    // 运行时配置为内容寻址文件名（config.<sha1前10>.json），内容变即换名，可 immutable。
    extraSections.push('/assets/config.*.json\n  Cache-Control: public, max-age=31536000, immutable');
    extraSections.push('/assets/css/*\n  Cache-Control: public, max-age=31536000, immutable');
    extraSections.push('/assets/js/*\n  Cache-Control: public, max-age=3600, stale-while-revalidate=86400');
    // 打包产物为内容哈希（app/deferred/runtime.<hash>.js），可 immutable；后置规则覆盖上条兜底
    extraSections.push('/assets/js/app.*.js\n  Cache-Control: public, max-age=31536000, immutable');
    extraSections.push('/assets/js/deferred.*.js\n  Cache-Control: public, max-age=31536000, immutable');
    extraSections.push('/assets/js/runtime.*.js\n  Cache-Control: public, max-age=31536000, immutable');
    extraSections.push('/assets/vendor/*\n  Cache-Control: public, max-age=3600, stale-while-revalidate=86400');
    extraSections.push('/media/*\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400');
    extraSections.push('/og/*\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400');
  }

  if (lines.length > 0) {
    let headerContent = '/*\n' + lines.join('\n') + '\n';
    if (extraSections.length) headerContent += '\n' + extraSections.join('\n\n') + '\n';
    writeFileAtomicSync(path.join(distDir, '_headers'), headerContent, 'utf-8');
    console.log('  Created: _headers');
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
      const sitemapUrls = buildSitemapUrls({
        baseUrl: config.site.url,
        sitemapPath: config.security.robots.sitemap,
        languages: (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en'])
      });
      if (!sitemapUrls.length) console.warn('  [WARN] robots.txt: site.url 未配置，已跳过 Sitemap 行');
      for (const smUrl of sitemapUrls) robotLines.push(`Sitemap: ${smUrl}`);
    }
    writeFileAtomicSync(path.join(distDir, 'robots.txt'), robotLines.join('\n'), 'utf-8');
    console.log('  Created: robots.txt');
  }
}

  return { generateRedirects, buildCspTrimContext, applyCspNonce, generateSecurityHeaders };
}

module.exports = { createSecurityFilesModule };
