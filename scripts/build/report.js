'use strict';
// 构建报告与性能预算（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createReportModule(ctx) 注入产物目录、发布过滤器、内联配置体积读取器与构建错误收集器。
// 唯一构建报告为 dist/build-report.html（纯静态、无外部依赖、无内联脚本）；渲染纯函数见 lib/build-report-html.js。
const fs = require('fs');
const path = require('path');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { gzipSize, evaluatePerfBudget, formatPerfBudget } = require('../lib/perf-budget');
const { renderBuildReportHtml } = require('../lib/build-report-html');
const { performanceWarnings, reportTopN } = require('../lib/feature-wiring');
const { getAllFiles } = require('./fs-utils');
const { loadInternals } = require('../lib/internals');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.bmp'];
const REPORT_FILENAME = 'build-report.html';

function createReportModule(ctx) {
  // 报告展示上限与状态色来自 internals（report.topN / ui.reportColors）。
  const internals = loadInternals();
  const REPORT_TOP_N = internals.report.topN;
  const REPORT_COLORS = internals.ui.reportColors;

  // 全站 HTML 页面（构建报告自身不计入页面清单与体积统计）。
  function listHtmlPages() {
    return getAllFiles(ctx.distDir)
      .filter((file) => /\.html?$/i.test(file) && path.basename(file) !== REPORT_FILENAME)
      .map((file) => path.relative(ctx.distDir, file).split(path.sep).join('/'))
      .sort();
  }

  // 单文件体积（字节）；不可读时返回 null。
  function fileSize(file) {
    try { return fs.statSync(file).size; } catch (err) { return null; }
  }

  // 目录体积与文件数：按「相对产物根的 POSIX 路径」判定归属（distPrefix 为目录前缀）。
  function dirStats(dir, predicate, withGzip) {
    let files = 0;
    let raw = 0;
    let gzip = 0;
    if (!fs.existsSync(dir)) return { files: 0, rawKb: 0, gzipKb: withGzip ? 0 : null };
    for (const file of getAllFiles(dir)) {
      if (predicate && !predicate(file)) continue;
      const size = fileSize(file);
      if (size === null) continue;
      files += 1;
      raw += size;
      if (withGzip) {
        try { gzip += gzipSize(fs.readFileSync(file)); } catch (err) { /* 单文件不可读时只计 raw */ }
      }
    }
    return { files, rawKb: raw / 1024, gzipKb: withGzip ? gzip / 1024 : null };
  }

  // 媒体/OG 目录的图片数量（不计体积排序，避免为计数而全量排序）。
  function countImages(dir) {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    for (const file of getAllFiles(dir)) {
      if (IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) count += 1;
    }
    return count;
  }

  // 媒体/OG 目录的图片体积 Top N（按体积降序）。
  function topImages(dir, cap) {
    const found = [];
    if (!fs.existsSync(dir)) return found;
    for (const file of getAllFiles(dir)) {
      if (!IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) continue;
      const size = fileSize(file);
      if (size === null) continue;
      found.push({ path: '/' + path.relative(ctx.distDir, file).split(path.sep).join('/'), kb: size / 1024 });
    }
    return found.sort((a, b) => b.kb - a.kb).slice(0, cap);
  }

  // 产物体积与页面清单：压缩与 cacheBust 之后调用，统计的是最终字节。
  function collectArtifactStats() {
    const topN = REPORT_TOP_N;
    const htmlFiles = listHtmlPages();
    const rawKbs = [];
    const gzipKbs = [];
    for (const rel of htmlFiles) {
      const file = path.join(ctx.distDir, rel.split('/').join(path.sep));
      const size = fileSize(file);
      if (size === null) continue;
      rawKbs.push(size / 1024);
      try { gzipKbs.push(gzipSize(fs.readFileSync(file)) / 1024); } catch (err) { /* 单文件不可读时跳过 gzip */ }
    }
    const median = (list) => {
      if (!list.length) return null;
      const sorted = list.slice().sort((a, b) => a - b);
      return sorted[Math.floor((sorted.length - 1) / 2)];
    };
    const jsDir = path.join(ctx.distDir, 'assets', 'js');
    const groups = [];
    const groupDefs = [
      { key: 'app', pattern: /^app\./ },
      { key: 'deferred', pattern: /^deferred\./ },
      { key: 'shared', pattern: /^shared\./ },
      { key: 'runtime', pattern: /^runtime\./ }
    ];
    const jsFiles = fs.existsSync(jsDir) ? getAllFiles(jsDir).filter((f) => f.endsWith('.js')) : [];
    const assigned = new Set();
    for (const def of groupDefs) {
      const stat = dirStats(jsDir, (file) => def.pattern.test(path.basename(file)), true);
      if (stat.files > 0) groups.push({ key: def.key, files: stat.files, rawKb: stat.rawKb, gzipKb: stat.gzipKb });
      for (const file of jsFiles) {
        if (def.pattern.test(path.basename(file))) assigned.add(file);
      }
    }
    const otherStat = dirStats(jsDir, (file) => !assigned.has(file), true);
    if (otherStat.files > 0) groups.push({ key: 'other', files: otherStat.files, rawKb: otherStat.rawKb, gzipKb: otherStat.gzipKb });
    const jsTotal = dirStats(jsDir, null, true);
    const cssDir = path.join(ctx.distDir, 'assets');
    const cssStat = dirStats(cssDir, (file) => file.endsWith('.css') && !file.includes(path.sep + 'vendor' + path.sep), true);
    const vendor = dirStats(path.join(cssDir, 'vendor'), null, true);
    const fonts = dirStats(path.join(cssDir, 'fonts'), null, false);
    const mediaDir = path.join(ctx.distDir, 'media');
    const ogDir = path.join(ctx.distDir, 'og');
    const mediaTop = topImages(mediaDir, topN);
    const ogTop = topImages(ogDir, topN);
    return {
      html: {
        pages: htmlFiles.length,
        rawMaxKb: rawKbs.length ? Math.max(...rawKbs) : null,
        rawMedianKb: median(rawKbs),
        gzipMaxKb: gzipKbs.length ? Math.max(...gzipKbs) : null,
        gzipMedianKb: median(gzipKbs)
      },
      css: { files: cssStat.files, rawKb: cssStat.rawKb, gzipKb: cssStat.gzipKb },
      js: { groups, files: jsTotal.files, rawKb: jsTotal.rawKb, gzipKb: jsTotal.gzipKb },
      vendor: { files: vendor.files, rawKb: vendor.rawKb, gzipKb: vendor.gzipKb },
      fonts: { files: fonts.files, rawKb: fonts.rawKb, gzipKb: fonts.gzipKb },
      media: { count: countImages(mediaDir), top: mediaTop },
      og: { count: countImages(ogDir), top: ogTop }
    };
  }

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
    const htmlRawMaxKb = rawKbs.length ? rawKbs[rawKbs.length - 1] : 0;
    return { htmlKb, htmlRawKb, htmlRawMaxKb, inlineConfigKb, jsKb: jsBytes / 1024, requests, pages: htmlFiles.length };
  }

  // 扫描产物媒体目录（dist/media）中超过 kb 阈值的用户图片（按体积降序，最多
  // site.build.reportTopN 条；缺失/非法回退 internals.report.topN）。
  // 只针对用户上传资产（OG 图尺寸由 features.ogImage 控制，不属“未压缩”告警范围）。
  function collectLargeImages(maxKb, topN) {
    const limit = Number.isFinite(+maxKb) && +maxKb > 0 ? +maxKb : 0;
    if (!limit) return [];
    const cap = reportTopN({ build: { reportTopN: topN } }, REPORT_TOP_N);
    const found = [];
    const dir = path.join(ctx.distDir, 'media');
    if (!fs.existsSync(dir)) return found;
    for (const file of getAllFiles(dir)) {
      if (!IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) continue;
      try {
        const kb = fs.statSync(file).size / 1024;
        if (kb > limit) found.push({ path: '/' + path.relative(ctx.distDir, file).split(path.sep).join('/'), kb });
      } catch (e) { /* 单文件不可读时跳过 */ }
    }
    return found.sort((a, b) => b.kb - a.kb).slice(0, cap);
  }

  // 性能阈值告警（features.performance.warning*）：超限仅输出 [WARN]，不阻断构建；
  // 预算门禁见 checkPerfBudget（features.perfBudget）。
  function checkPerformanceWarnings(config, elapsedSeconds) {
    const perf = (config.features && config.features.performance) || {};
    const stats = collectBudgetStats();
    stats.largeImages = collectLargeImages(perf.warningImageKb, config.site && config.site.build && config.site.build.reportTopN);
    const warnings = performanceWarnings(perf, stats, elapsedSeconds * 1000);
    for (const msg of warnings) console.warn('  [WARN] ' + msg);
  }

  // 返回预算评估结果（enabled=false 时返回 null），供报告聚合复用，避免重复统计。
  function checkPerfBudget(config) {
    const budget = (config.features && config.features.perfBudget) || {};
    if (budget.enabled === false) return null;
    const stats = collectBudgetStats();
    const report = evaluatePerfBudget(stats, budget);
    console.log('\n' + formatPerfBudget(report, budget.warnOnly !== false));
    console.log('  (统计页数: ' + stats.pages + '；JS 预算仅计 assets/js 应用代码，vendor 库按需懒加载不计入)');
    if (!report.ok && budget.warnOnly === false) {
      throw new Error('性能预算超限: ' + report.items.filter(item => !item.ok).map(item => item.label).join(', '));
    }
    return report;
  }

  // 生成唯一构建报告 dist/build-report.html（报告阶段、压缩与 cacheBust 之后写入，天然豁免压缩）。
  // 无头验证摘要仅在「本轮实际运行验证」时读取结果文件，避免历史结果被误当成本轮结论。
  function generateBuildReport(input) {
    const data = input && typeof input === 'object' ? input : {};
    let verify;
    if (data.verifyRan === true) {
      const verifyPath = process.env.SYNAPSE_COMPRESSION_VERIFY_REPORT
        || ctx.compressionVerifyReportPath
        || path.join(ctx.distDir, '..', '.cache', 'compression-verify', 'last.json');
      let report = null;
      try {
        report = JSON.parse(fs.readFileSync(verifyPath, 'utf-8'));
      } catch (err) {
        console.warn('  [WARN] 压缩验证结果读取失败（报告将标注为缺失）: ' + err.message);
      }
      verify = { ran: true, report };
    } else {
      verify = { ran: false, report: null };
    }
    const policy = data.policy && typeof data.policy === 'object' ? data.policy : { blocked: [], copied: 0 };
    const build = data.build && typeof data.build === 'object' ? data.build : {};
    const reportData = {
      generatedAt: data.generatedAt,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      totalMs: data.totalMs,
      version: data.version,
      commit: data.commit,
      nodeVersion: data.nodeVersion || process.version,
      lang: data.lang || 'zh',
      siteTitle: data.siteTitle || '',
      colors: REPORT_COLORS,
      nonce: ctx.cspNonce || '',
      phases: data.phases,
      artifacts: collectArtifactStats(),
      pages: listHtmlPages(),
      budget: data.budget,
      compression: data.compression,
      verify,
      cacheHits: data.cacheHits,
      warnings: data.warnings,
      failures: data.failures,
      policy: {
        blocked: Array.isArray(policy.blocked) ? policy.blocked : [],
        copied: policy.copied
      },
      build: {
        articles: build.articles,
        customPages: build.customPages,
        tags: build.tags,
        categories: build.categories,
        configKeys: build.configKeys,
        outputSize: getDirSize(ctx.distDir)
      }
    };
    writeFileAtomicSync(path.join(ctx.distDir, REPORT_FILENAME), renderBuildReportHtml(reportData), 'utf-8');
    console.log('  Created: ' + REPORT_FILENAME);
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

  return {
    collectBudgetStats,
    collectLargeImages,
    collectArtifactStats,
    checkPerfBudget,
    checkPerformanceWarnings,
    generateBuildReport,
    getDirSize
  };
}

module.exports = { createReportModule };
