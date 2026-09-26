'use strict';
// 构建报告与性能预算（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createReportModule(ctx) 注入产物目录、发布过滤器、内联配置体积读取器与构建错误收集器。
const fs = require('fs');
const path = require('path');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { escapeHtml } = require('../lib/utils');
const { gzipSize, evaluatePerfBudget, formatPerfBudget } = require('../lib/perf-budget');
const { getAllFiles } = require('./fs-utils');

function createReportModule(ctx) {
  function collectBudgetStats() {
    const inlineConfigKb = ctx.getInlineConfigKb();
    const htmlFiles = [];
    (function walk(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return; }
      for (const entry of entries) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name));
        else if (entry.name === 'index.html') htmlFiles.push(path.join(dir, entry.name));
      }
    })(ctx.distDir);
    let htmlKb = 0;
    let requests = 0;
    const rawKbs = [];
    for (const file of htmlFiles) {
      const raw = fs.readFileSync(file);
      const kb = gzipSize(raw) / 1024;
      if (kb > htmlKb) htmlKb = kb;
      rawKbs.push(raw.length / 1024);
      const html = raw.toString('utf-8');
      const req = (html.match(/<script[^>]*\ssrc=/gi) || []).length
        + (html.match(/<link[^>]*rel=["']?stylesheet/gi) || []).length
        + (html.match(/<link[^>]*rel=["']?modulepreload/gi) || []).length;
      if (req > requests) requests = req;
    }
    let jsBytes = 0;
    (function walkJs(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return; }
      for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walkJs(p);
        else if (entry.name.endsWith('.js')) jsBytes += gzipSize(fs.readFileSync(p));
      }
    })(path.join(ctx.distDir, 'assets', 'js'));
    rawKbs.sort((a, b) => a - b);
    const htmlRawKb = rawKbs.length ? rawKbs[Math.floor((rawKbs.length - 1) / 2)] : 0;
    return { htmlKb, htmlRawKb, inlineConfigKb, jsKb: jsBytes / 1024, requests, pages: htmlFiles.length };
  }

  function checkPerfBudget(config) {
    const budget = (config.features && config.features.perfBudget) || {};
    if (budget.enabled === false) return;
    const stats = collectBudgetStats();
    const report = evaluatePerfBudget(stats, budget);
    console.log('\n' + formatPerfBudget(report, budget.warnOnly !== false));
    console.log('  (统计页数: ' + stats.pages + '；JS 预算仅计 assets/js 应用代码，vendor 库按需懒加载不计入)');
    if (!report.ok && budget.warnOnly === false) {
      throw new Error('性能预算超限: ' + report.items.filter(item => !item.ok).map(item => item.label).join(', '));
    }
  }

  // Generate an HTML build report page with stats: build time, article count, tag/category counts,
  // output size, and feature enablement status. Written to dist/build-report.html.
  function generateBuildReport(config, articles, tags, categories, customPages, elapsed, policyResult) {
    try {
      const policyBlocked = (policyResult && policyResult.blocked) || [];
      const policyCopied = (policyResult && policyResult.copied) || 0;
      const published = ctx.getPublished(articles);
      const tc = config.theme.colors;
      const totalSize = getDirSize(ctx.distDir);
      const html = `<!DOCTYPE html><html lang="${config.site.language}"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>构建报告 - ${config.site.title}</title><style nonce="${ctx.cspNonce}">body{font-family:system-ui,sans-serif;max-width:700px;margin:2rem auto;padding:0 1rem;color:${tc.text}}h1{font-size:1.5rem}.stat{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid ${tc.border}}.stat-label{color:${tc.textSecondary}}.stat-value{font-weight:600}.report-time{color:${tc.textSecondary}}.good{color:#16a34a}.warn{color:#d97706}</style></head><body><h1>构建报告</h1><p class="report-time">${new Date().toISOString().replace('T',' ').slice(0,19)}</p>
      <div class="stat"><span class="stat-label">构建耗时</span><span class="stat-value">${elapsed}s</span></div>
      <div class="stat"><span class="stat-label">文章数</span><span class="stat-value">${published.length}</span></div>
      <div class="stat"><span class="stat-label">自定义页面</span><span class="stat-value">${(customPages||[]).length}</span></div>
      <div class="stat"><span class="stat-label">标签数</span><span class="stat-value">${tags.length}</span></div>
      <div class="stat"><span class="stat-label">分类数</span><span class="stat-value">${categories.length}</span></div>
      <div class="stat"><span class="stat-label">输出体积</span><span class="stat-value">${totalSize}</span></div>
      <div class="stat"><span class="stat-label">配置文件</span><span class="stat-value">${Object.keys(config).length}</span></div>
      <div class="stat"><span class="stat-label">依赖</span><span class="stat-value">${published.reduce((s,a)=>s+(a.wordCount||0),0)} 字</span></div>
      <div class="stat"><span class="stat-label">压缩</span><span class="stat-value ${config.site.build.minifyHTML?'good':'warn'}">${config.site.build.minifyHTML?'已启用':'未启用'}</span></div>
      <div class="stat"><span class="stat-label">图片优化</span><span class="stat-value ${config.site.build.optimizeMedia?'good':'warn'}">${config.site.build.optimizeMedia?'已启用':'未启用'}</span></div>
      <div class="stat"><span class="stat-label">内容策略拦截</span><span class="stat-value ${policyBlocked.length?'warn':'good'}">${policyBlocked.length} 项</span></div>
      <div class="stat"><span class="stat-label">受保护资产复制</span><span class="stat-value">${policyCopied}</span></div>
      <div class="stat"><span class="stat-label">缓存清除</span><span class="stat-value ${config.site.build.enableCacheBusting?'good':'warn'}">${config.site.build.enableCacheBusting?'已启用':'未启用'}</span></div>
      <div class="stat"><span class="stat-label">CSP</span><span class="stat-value ${config.security.csp&&config.security.csp.enabled?'good':'warn'}">${config.security.csp&&config.security.csp.enabled?'已启用':'未启用'}</span></div>
      <div class="stat"><span class="stat-label">RSS</span><span class="stat-value ${config.site.rss&&config.site.rss.enabled?'good':'warn'}">${config.site.rss&&config.site.rss.enabled?'已启用':'未启用'}</span></div>
      ${policyBlocked.length ? `<h2>被拦截文件（内容策略）</h2><ul>${policyBlocked.map(b => `<li><code>${escapeHtml(String(b.path || ''))}</code> — ${escapeHtml(String(b.reason || ''))}</li>`).join('')}</ul>` : ''}</body></html>`;
      writeFileAtomicSync(path.join(ctx.distDir, 'build-report.html'), html, 'utf-8');
      console.log('  Created: build-report.html');
    } catch (err) {
      console.error(`  [ERROR] Build report failed: ${err.message}`);
      ctx.recordBuildFailure('report', `Build report failed: ${err.message}`);
    }
  }

  // Calculate the total size of a directory recursively. Returns human-readable string (B/KB/MB).
  function getDirSize(dir) {
    try {
      const files = getAllFiles(dir);
      let total = 0;
      for (const f of files) total += fs.statSync(f).size || 0;
      if (total < 1024) return total + ' B';
      if (total < 1048576) return (total / 1024).toFixed(1) + ' KB';
      return (total / 1048576).toFixed(1) + ' MB';
    } catch { return '?'; }
  }

  return { collectBudgetStats, checkPerfBudget, generateBuildReport, getDirSize };
}

module.exports = { createReportModule };
