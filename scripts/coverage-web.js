#!/usr/bin/env node
'use strict';
// 无头 Web 覆盖率汇总（test:cov-web）：
//   ① 以 --no-bundle + 压缩关闭构建到独立目录（build-artifacts/web-coverage/site）——
//      no-bundle 使产物 URL 与 js/** 源文件一一对应，压缩关闭使脚本保持源码行结构；
//   ② 自起静态服务 + 系统 Chrome 无头访问代表页集合（首页/文章/搜索/标签/归档/双语并排/主题实验室/省流）；
//   ③ 经 CDP Profiler 精确覆盖（callCount + detailed）逐页 take 并累加：ranges 的第一个区间即函数范围
//      （count 为调用次数），其余区间为块；函数覆盖 = 出现过的函数中 count>0 的比例，
//      行覆盖 = count>0 区间的行并集，行文本直接读 js/** 源文件；
//   ④ 按 URL 聚合 js/**（排除 vendor），输出 build-artifacts/web-coverage/{summary.txt,coverage.json}；
//   ⑤ 阈值来自 scripts/lib/web-coverage-thresholds.js，未达标 exit 1；无 Chrome 跳过（exit 0）。
// 运行：npm run test:cov-web [-- --build --no-build --chrome <path> --json]

const fs = require('node:fs');
const path = require('node:path');
const {
  PROJECT_ROOT,
  resolveChrome,
  runBuild,
  startStaticServer,
  stopStaticServer,
  launchChrome,
  closeChrome,
  checkPortReleased,
  settleRuntimePage,
  sleep
} = require('./lib/web-harness');
const { discoverArticlePath, pageExists } = require('./lib/compression-verify');
const { writeFileAtomicSync } = require('./lib/atomic-write');
const thresholds = require('./lib/web-coverage-thresholds');

const OUT_DIR = path.join(PROJECT_ROOT, 'build-artifacts', 'web-coverage', 'site');
const REPORT_DIR = path.join(PROJECT_ROOT, 'build-artifacts', 'web-coverage');
const COMPRESSION_OFF_FILE = path.join(REPORT_DIR, 'compression-off.json5');
const COV_BUILD_STAMP = '.cov-build-stamp.json';
const COV_BUILD_MODE = 'no-bundle+compression-off';
const JS_ASSET_PREFIX = '/assets/js/';

function parseArgs(argv) {
  const out = { outDir: OUT_DIR, chrome: '', build: false, noBuild: false, json: false };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--out' && value) { out.outDir = path.resolve(value); i++; }
    else if (key === '--chrome' && value) { out.chrome = value; i++; }
    else if (key === '--build') out.build = true;
    else if (key === '--no-build') out.noBuild = true;
    else if (key === '--json') out.json = true;
  }
  return out;
}

function newestMtime(dir) {
  let newest = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (err) { return 0; }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = newestMtime(abs);
      if (nested > newest) newest = nested;
    } else {
      try {
        const m = fs.statSync(abs).mtimeMs;
        if (m > newest) newest = m;
      } catch (err) { /* 单文件不可读时忽略 */ }
    }
  }
  return newest;
}

// 产物新鲜度：构建成功后写戳文件（记录模式与产物目录）；戳缺失、来源更新或模式不符即重建。
// 不依赖产物文本形态做启发式判断（js/core/main.js 等源文件本身可能只有一行 import 链）。
function needsBuild(outDir, args) {
  if (args.noBuild) return false;
  if (args.build) return true;
  const marker = path.join(outDir, 'zh', 'index.html');
  const stampFile = path.join(outDir, COV_BUILD_STAMP);
  if (!fs.existsSync(marker) || !fs.existsSync(stampFile)) return true;
  try {
    const stamp = JSON.parse(fs.readFileSync(stampFile, 'utf-8'));
    if (stamp.mode !== COV_BUILD_MODE || path.resolve(stamp.outDir) !== path.resolve(outDir)) return true;
  } catch (err) {
    return true;
  }
  const builtAt = fs.statSync(marker).mtimeMs;
  for (const source of ['js', 'templates', path.join('scripts', 'build'), path.join('scripts', 'lib')]) {
    if (newestMtime(path.join(PROJECT_ROOT, source)) > builtAt) return true;
  }
  return false;
}

// 代表页步骤：覆盖全部交互功能域（交互选择器缺失时仅告警，不阻断覆盖率采集）。
// 顺序注意：省流开关在「阅读」页、主题实验室在「主题」页——先点省流再切主题页，否则前者被隐藏不可点击。
function collectSteps(outDir) {
  const steps = [
    { url: '/zh/', waitMs: 500, label: '首页' },
    { url: '/en/', waitMs: 500, label: '英文首页' }
  ];
  const article = discoverArticlePath(outDir);
  if (article) {
    steps.push({ url: article, waitMs: 500, label: '文章页' });
    steps.push({
      url: article,
      label: '文章页交互',
      clicks: [
        { selector: '#bilingualSwitch', waitMs: 1200, label: '双语并排' },
        { selector: '#readerGear', waitMs: 400, label: '阅读设置' },
        { selector: '#saveDataToggle', waitMs: 900, label: '省流模式' },
        { selector: '#rtabTheme', waitMs: 900, label: '主题实验室' }
      ]
    });
  }
  if (pageExists(outDir, '/zh/search/')) steps.push({ url: '/zh/search/', type: { selector: '#searchPageInput', text: 'hello' }, waitMs: 900, label: '搜索页' });
  if (pageExists(outDir, '/zh/tags/')) steps.push({ url: '/zh/tags/', waitMs: 400, label: '标签页' });
  if (pageExists(outDir, '/zh/archive/')) steps.push({ url: '/zh/archive/', waitMs: 400, label: '归档页' });
  return steps;
}

function lineStartsOf(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineForOffset(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// 非空白行标记（行覆盖分母只算有代码字符的行，避免缩进/空行稀释指标）。
function codeLineFlags(text, starts) {
  const flags = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    flags.push(text.slice(start, end).trim().length > 0);
  }
  return flags;
}

function createFileEntry(rel) {
  const sourceFile = path.join(PROJECT_ROOT, 'js', rel.split('/').join(path.sep));
  const text = fs.readFileSync(sourceFile, 'utf-8');
  const starts = lineStartsOf(text);
  return {
    file: 'js/' + rel,
    text,
    starts,
    lineHits: new Array(starts.length).fill(false),
    codeFlags: codeLineFlags(text, starts),
    functions: new Map()
  };
}

function relFromUrl(url, baseUrl) {
  if (!url.startsWith(baseUrl + JS_ASSET_PREFIX)) return '';
  let rel;
  try {
    rel = decodeURIComponent(url.slice(baseUrl.length + JS_ASSET_PREFIX.length).split('?')[0].split('#')[0]);
  } catch (err) {
    return '';
  }
  if (!rel || rel.startsWith('vendor/') || rel.split('/').includes('..')) return '';
  if (!fs.existsSync(path.join(PROJECT_ROOT, 'js', rel.split('/').join(path.sep)))) return '';
  return rel;
}

// 把一次 takePreciseCoverage 的结果累加进 files：
// 函数分母按「ranges[0] 区间」去重（同一函数跨多次导航/多个 scriptId 只计一次），计数取最大值；
// 行覆盖对所有 count>0 的区间做行并集。
function mergeCoverage(files, result, baseUrl) {
  for (const script of result) {
    const rel = relFromUrl(String(script.url || ''), baseUrl);
    if (!rel) continue;
    let entry = files.get(rel);
    if (!entry) {
      entry = createFileEntry(rel);
      files.set(rel, entry);
    }
    for (const fn of script.functions || []) {
      const ranges = Array.isArray(fn.ranges) ? fn.ranges : [];
      if (!ranges.length) continue;
      const head = ranges[0];
      const key = head.startOffset + ':' + head.endOffset;
      entry.functions.set(key, Math.max(entry.functions.get(key) || 0, head.count || 0));
      for (const range of ranges) {
        if ((range.count || 0) <= 0) continue;
        const first = lineForOffset(entry.starts, range.startOffset);
        const last = lineForOffset(entry.starts, Math.max(range.startOffset, range.endOffset - 1));
        for (let line = first; line <= last; line++) entry.lineHits[line] = true;
      }
    }
  }
}

async function collectCoverage(page, session, baseUrl, steps, warnings, files) {
  await session.send('Profiler.enable');
  await session.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  for (const step of steps) {
    try {
      await page.goto(baseUrl + step.url, { waitUntil: 'load', timeout: 30000 });
      await settleRuntimePage(page);
    } catch (err) {
      warnings.push('导航失败 ' + step.url + ': ' + String((err && err.message) || err));
      continue;
    }
    for (const click of step.clicks || []) {
      try {
        await page.click(click.selector);
        await sleep(click.waitMs || 600);
      } catch (err) {
        warnings.push('点击 ' + click.selector + '（' + step.url + '）失败: ' + String((err && err.message) || err));
      }
    }
    if (step.type) {
      try {
        await page.type(step.type.selector, step.type.text, { delay: 20 });
        await sleep(step.waitMs || 600);
      } catch (err) {
        warnings.push('输入 ' + step.type.selector + ' 失败: ' + String((err && err.message) || err));
      }
    } else if (step.waitMs) {
      await sleep(step.waitMs);
    }
    const { result } = await session.send('Profiler.takePreciseCoverage');
    mergeCoverage(files, result, baseUrl);
  }
  await session.send('Profiler.stopPreciseCoverage').catch(() => {});
}

function fileStats(entry) {
  let total = 0;
  let covered = 0;
  for (let i = 0; i < entry.codeFlags.length; i++) {
    if (!entry.codeFlags[i]) continue;
    total += 1;
    if (entry.lineHits[i]) covered += 1;
  }
  let rangesTotal = entry.functions.size;
  let rangesCovered = 0;
  for (const count of entry.functions.values()) {
    if (count > 0) rangesCovered += 1;
  }
  return { total, covered, rangesTotal, rangesCovered };
}

function pct(covered, total) {
  return total > 0 ? Math.round((covered / total) * 1000) / 10 : 0;
}

function buildReportRows(files) {
  const rows = [];
  const totals = { codeLines: 0, coveredLines: 0, ranges: 0, coveredRanges: 0 };
  for (const entry of files.values()) {
    const stats = fileStats(entry);
    totals.codeLines += stats.total;
    totals.coveredLines += stats.covered;
    totals.ranges += stats.rangesTotal;
    totals.coveredRanges += stats.rangesCovered;
    rows.push({
      file: entry.file,
      lines: stats.total,
      coveredLines: stats.covered,
      linePct: pct(stats.covered, stats.total),
      ranges: stats.rangesTotal,
      coveredRanges: stats.rangesCovered,
      functionPct: pct(stats.rangesCovered, stats.rangesTotal)
    });
  }
  rows.sort((a, b) => a.linePct - b.linePct || a.file.localeCompare(b.file));
  return {
    files: rows,
    totals: {
      codeLines: totals.codeLines,
      coveredLines: totals.coveredLines,
      linePct: pct(totals.coveredLines, totals.codeLines),
      ranges: totals.ranges,
      coveredRanges: totals.coveredRanges,
      functionPct: pct(totals.coveredRanges, totals.ranges)
    }
  };
}

function renderSummary(report) {
  const lines = [
    'S-YNAPSE Web 覆盖率摘要',
    '时间: ' + report.generatedAt,
    '产物: ' + report.outDir,
    'Chrome: ' + (report.chrome || '(未使用)'),
    '阈值: 行 >= ' + report.threshold.lines + '%  函数 >= ' + report.threshold.functions + '%',
    '',
    '代表页:'
  ];
  for (const step of report.steps) {
    lines.push('  ' + step.url + (step.label ? ' [' + step.label + ']' : ''));
  }
  lines.push('', '文件（js/**，排除 vendor；按行覆盖升序）:');
  for (const row of report.files) {
    lines.push('  ' + row.file.padEnd(48) + ' 行 ' + row.coveredLines + '/' + row.lines + ' (' + row.linePct + '%)' +
      '  函数 ' + row.coveredRanges + '/' + row.ranges + ' (' + row.functionPct + '%)');
  }
  lines.push('', '合计: ' + (report.totals
    ? '行 ' + report.totals.coveredLines + '/' + report.totals.codeLines + ' (' + report.totals.linePct + '%)' +
      '  函数 ' + report.totals.coveredRanges + '/' + report.totals.ranges + ' (' + report.totals.functionPct + '%)'
    : '（未采集到数据）'));
  lines.push('结果: ' + (report.passed ? '通过' : '未达标') + '；端口释放: ' + report.portsReleased);
  if (report.warnings.length) {
    lines.push('', '告警:');
    for (const warning of report.warnings.slice(0, 20)) lines.push('  - ' + warning);
  }
  return lines.join('\n') + '\n';
}

function writeReports(report, args) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  writeFileAtomicSync(path.join(REPORT_DIR, 'coverage.json'), JSON.stringify(report, null, 2));
  writeFileAtomicSync(path.join(REPORT_DIR, 'summary.txt'), renderSummary(report));
  if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const report = {
    generatedAt: new Date().toISOString(),
    outDir: args.outDir,
    chrome: '',
    skipped: '',
    threshold: { lines: thresholds.LINES_PCT, functions: thresholds.FUNCTIONS_PCT },
    steps: [],
    files: [],
    totals: null,
    warnings: [],
    portsReleased: null,
    passed: false,
    durationMs: 0
  };
  const startedAt = Date.now();

  if (needsBuild(args.outDir, args)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    if (!fs.existsSync(COMPRESSION_OFF_FILE)) fs.writeFileSync(COMPRESSION_OFF_FILE, '{ enabled: false }\n', 'utf-8');
    process.stdout.write('[cov-web] 构建（--no-bundle + 压缩关闭）到 ' + args.outDir + ' …\n');
    const build = runBuild(args.outDir, { noBundle: true, extraArgs: ['--compression-override', COMPRESSION_OFF_FILE] });
    if (!build.ok) {
      report.warnings.push('构建失败 status=' + build.status + '；' + build.stdout.slice(-1500) + build.stderr.slice(-1500));
      writeReports(report, args);
      process.stderr.write('[cov-web] 构建失败，无法采集覆盖率\n');
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(
      path.join(args.outDir, COV_BUILD_STAMP),
      JSON.stringify({ mode: COV_BUILD_MODE, outDir: args.outDir, builtAt: new Date().toISOString() }, null, 2) + '\n',
      'utf-8'
    );
  }

  const chromePath = args.chrome || resolveChrome();
  if (!chromePath) {
    report.skipped = 'chrome-not-found';
    process.stdout.write('[SKIP] 未检测到系统 Chrome（CHROME_PATH/google-chrome/chromium），跳过 Web 覆盖率采集\n');
    writeReports(report, args);
    return;
  }
  report.chrome = chromePath;

  const steps = collectSteps(args.outDir);
  report.steps = steps.map((step) => ({ url: step.url, label: step.label || '' }));
  const server = startStaticServer(args.outDir);
  const files = new Map();
  let browser = null;
  let port = 0;
  try {
    port = await server.ready;
    process.stdout.write('[cov-web] serve 127.0.0.1:' + port + '\n');
    browser = await launchChrome(chromePath);
    const page = await browser.newPage();
    const session = await page.target().createCDPSession();
    const baseUrl = 'http://127.0.0.1:' + port;
    await collectCoverage(page, session, baseUrl, steps, report.warnings, files);
    process.stdout.write('[cov-web] 覆盖采集完成（' + files.size + ' 个源文件）\n');
    if (files.size === 0) report.warnings.push('未匹配到任何 js/** 源文件（检查产物形态与 URL 映射）');
    const aggregated = buildReportRows(files);
    report.files = aggregated.files;
    report.totals = aggregated.totals;
  } catch (err) {
    report.warnings.push('采集异常: ' + String((err && err.stack) || err));
  } finally {
    if (browser) await closeChrome(browser);
    await stopStaticServer(server);
    if (port > 0) {
      report.portsReleased = await checkPortReleased(port);
      if (!report.portsReleased) report.warnings.push('端口未释放 ' + port);
    }
  }

  if (report.totals === null) {
    writeReports(report, args);
    process.stderr.write('[cov-web] 未采集到覆盖率数据，失败\n');
    process.exitCode = 1;
    return;
  }
  report.durationMs = Date.now() - startedAt;
  report.passed = report.totals.linePct >= thresholds.LINES_PCT &&
    report.totals.functionPct >= thresholds.FUNCTIONS_PCT &&
    report.portsReleased !== false;
  writeReports(report, args);
  process.stdout.write('[cov-web] 行 ' + report.totals.linePct + '%（阈值 ' + thresholds.LINES_PCT + '%）' +
    '；函数 ' + report.totals.functionPct + '%（阈值 ' + thresholds.FUNCTIONS_PCT + '%）' +
    '；' + (report.passed ? '通过' : '未达标') +
    '；端口' + (report.portsReleased ? '已释放' : '未释放') + '\n');
  if (report.warnings.length) {
    for (const warning of report.warnings.slice(0, 10)) process.stderr.write('[cov-web] 告警: ' + warning + '\n');
  }
  if (!report.passed) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write('[cov-web] 未捕获错误: ' + String((err && err.stack) || err) + '\n');
  process.exitCode = 1;
});
