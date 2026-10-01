#!/usr/bin/env node
'use strict';
/* global document */
// 浏览器冒烟（test:smoke）：真实构建产物 + 系统 Chrome 无头访问代表页集合，
// 断言 HTTP 200、非空标题、通用 DOM 结构与零控制台错误。
// 无 Chrome 环境跳过（exit 0 并打印 [SKIP]，与 verify:compression 的降级语义一致）。
// 运行：npm run test:smoke [-- --out dist --build --chrome <path>]

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
  attachConsole
} = require('./lib/web-harness');
const { discoverArticlePath, pageExists } = require('./lib/compression-verify');

const REPORT_DIR = path.join(PROJECT_ROOT, 'build-artifacts', 'web-smoke');

function parseArgs(argv) {
  const out = { outDir: path.join(PROJECT_ROOT, 'dist'), build: false, chrome: '', json: false };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--out' && value) { out.outDir = path.resolve(value); i++; }
    else if (key === '--build') out.build = true;
    else if (key === '--chrome' && value) { out.chrome = value; i++; }
    else if (key === '--json') out.json = true;
  }
  return out;
}

function collectPages(outDir) {
  const pages = ['/zh/', '/en/'];
  const articlePath = discoverArticlePath(outDir);
  if (articlePath) {
    pages.push(articlePath);
    const enArticle = articlePath.replace(/^\/zh\//, '/en/');
    if (enArticle !== articlePath && pageExists(outDir, enArticle)) pages.push(enArticle);
  }
  for (const candidate of ['/zh/search/', '/en/search/', '/zh/tags/', '/zh/archive/', '/zh/categories/']) {
    if (pageExists(outDir, candidate)) pages.push(candidate);
  }
  pages.push('/404.html');
  return pages;
}

function tail(text, limit) {
  const value = String(text || '');
  return value.length > limit ? '…' + value.slice(-limit) : value;
}

async function main() {
  const args = parseArgs(process.argv);
  const report = { startedAt: new Date().toISOString(), outDir: args.outDir, pages: [], failures: [], skipped: '', portsReleased: null };

  if (args.build || !fs.existsSync(path.join(args.outDir, 'zh', 'index.html'))) {
    process.stdout.write('[smoke-web] 构建到 ' + args.outDir + ' …\n');
    const build = runBuild(args.outDir);
    if (!build.ok) {
      process.stderr.write('[smoke-web] 构建失败（status=' + build.status + '）\n' + tail(build.stdout, 3000) + '\n' + tail(build.stderr, 3000) + '\n');
      report.failures.push({ kind: 'build', detail: 'exit=' + build.status });
      writeReport(report, args);
      process.exitCode = 1;
      return;
    }
  }

  const chromePath = args.chrome || resolveChrome();
  if (!chromePath) {
    report.skipped = 'chrome-not-found';
    process.stdout.write('[SKIP] 未检测到系统 Chrome（CHROME_PATH/google-chrome/chromium），跳过浏览器冒烟\n');
    writeReport(report, args);
    return;
  }

  const pages = collectPages(args.outDir);
  report.pages = pages.map((url) => ({ url }));
  const server = startStaticServer(args.outDir);
  let browser = null;
  let port = 0;
  try {
    port = await server.ready;
    process.stdout.write('[smoke-web] serve 127.0.0.1:' + port + '\n');
    browser = await launchChrome(chromePath, { allowedPorts: [port] });
    const page = await browser.newPage();
    const consoleState = attachConsole(page);
    for (const entry of report.pages) {
      const response = await page.goto('http://127.0.0.1:' + port + entry.url, { waitUntil: 'load', timeout: 30000 });
      const status = response ? response.status() : 0;
      const title = await page.title();
      const dom = await page.evaluate(() => ({
        hasHeader: !!document.querySelector('header'),
        bodyLength: document.body ? document.body.innerHTML.length : 0,
        lang: document.documentElement.getAttribute('lang') || ''
      }));
      await new Promise((resolve) => setTimeout(resolve, 300));
      const errors = consoleState.errors.slice();
      entry.status = status;
      entry.title = title;
      entry.consoleErrors = errors.slice(0, 5);
      if (status !== 200) report.failures.push({ kind: 'http', page: entry.url, detail: 'status=' + status });
      if (!title.trim()) report.failures.push({ kind: 'title', page: entry.url, detail: '空标题' });
      if (dom.bodyLength < 200) report.failures.push({ kind: 'dom', page: entry.url, detail: 'body 内容过短 ' + dom.bodyLength });
      if (entry.url !== '/404.html' && !dom.hasHeader) report.failures.push({ kind: 'dom', page: entry.url, detail: '缺少 header 元素' });
      if (errors.length > 0) report.failures.push({ kind: 'console', page: entry.url, detail: errors.slice(0, 3) });
      process.stdout.write('[smoke-web] ' + entry.url + ' ' + status + ' 控制台错误 ' + errors.length + (errors.length ? ' ✖' : ' ✔') + '\n');
    }
  } catch (err) {
    report.failures.push({ kind: 'internal', detail: String((err && err.stack) || err) });
  } finally {
    if (browser) await closeChrome(browser);
    await stopStaticServer(server);
    if (port > 0) {
      report.portsReleased = await checkPortReleased(port);
      if (!report.portsReleased) report.failures.push({ kind: 'ports', detail: '端口未释放 ' + port });
    }
  }

  const passed = report.failures.length === 0;
  process.stdout.write('[smoke-web] ' + (passed ? '通过' : '失败') + '：' + report.pages.length + ' 页；端口' + (report.portsReleased ? '已释放' : '释放校验未通过') + '\n');
  if (!passed) {
    for (const failure of report.failures.slice(0, 10)) {
      process.stderr.write('[smoke-web] ✖ ' + (failure.page || failure.kind) + ': ' + JSON.stringify(failure.detail) + '\n');
    }
    process.exitCode = 1;
  }
  writeReport(report, args);
}

function writeReport(report, args) {
  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const file = path.join(REPORT_DIR, 'summary.txt');
    const lines = [
      'S-YNAPSE 浏览器冒烟摘要',
      '时间: ' + report.startedAt,
      '产物目录: ' + report.outDir,
      '跳过: ' + (report.skipped || '否'),
      '端口释放: ' + (report.portsReleased === null ? '-' : report.portsReleased),
      '页面:'
    ];
    for (const entry of report.pages) {
      lines.push('  ' + entry.url + ' status=' + entry.status + ' consoleErrors=' + (entry.consoleErrors || []).length);
    }
    lines.push('失败: ' + report.failures.length);
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf-8');
    if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (err) {
    process.stderr.write('[smoke-web] 摘要写入失败: ' + err.message + '\n');
  }
}

main().catch((err) => {
  process.stderr.write('[smoke-web] 未捕获错误: ' + String((err && err.stack) || err) + '\n');
  process.exitCode = 1;
});
