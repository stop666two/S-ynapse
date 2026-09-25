'use strict';
/* global document, window */

// 用途：在固定网络/CPU 条件下对目标 URL 做可复现的冷加载性能采样，
//       输出控制台中文表格、可选 Markdown 基线与 JSON 结构化结果。
// 运行：npm run perf:audit -- --url <URL> [--runs N] [--out <markdown>] [--json <文件>] [--chrome <路径>]
// 口径：Slow 4G（下行 1.6 Mbps = 200000 B/s、上行 750 kbps = 93750 B/s、RTT 150ms）
//       + CPU 4x 节流 + 禁用缓存 + 每次运行独立浏览器上下文。
//       LCP/CLS 取自 PerformanceObserver 原生条目；INP 为「≥16ms 交互事件最大 duration」代理值；
//       TBT 为 longtask 总时长代理值（非标准 TBT，仅用于同口径回归对比）。
// 依赖：puppeteer-core（devDependencies）；Chrome 默认取系统安装路径，CHROME_PATH 或 --chrome 可覆盖。

const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const DEFAULT_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const NAV_TIMEOUT_MS = 40000, NETWORK_IDLE_MS = 10000, INTERACTION_SETTLE_MS = 1000, CPU_THROTTLE_RATE = 4;
const SLOW_4G = { downloadThroughput: 200000, uploadThroughput: 93750, latency: 150 };
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 };
const METRIC_KEYS = ['lcp', 'cls', 'maxEvent', 'tbt', 'htmlBytes', 'totalBytes', 'requestCount'];
const METRIC_LABELS = { lcp: 'LCP(ms)', cls: 'CLS', maxEvent: '交互最大时长(ms)', tbt: 'TBT(ms)', htmlBytes: 'HTML传输字节', totalBytes: '总传输字节', requestCount: '请求数' };
const USAGE = '用法: node scripts/perf-audit.js --url <URL> [--runs N] [--out <markdown>] [--json <文件>] [--chrome <路径>]';

// CLI 解析（纯函数）：非法参数抛错，由 main 统一转为退出码 2
function parseArgs(argv, env) {
  const cfg = { url: '', runs: 3, out: '', json: '', chrome: String(env.CHROME_PATH || '').trim() || DEFAULT_CHROME };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i], value = argv[i + 1];
    if (flag === '--url') { cfg.url = value || ''; i++; }
    else if (flag === '--runs') { cfg.runs = Number.parseInt(value, 10); i++; }
    else if (flag === '--out') { cfg.out = value || ''; i++; }
    else if (flag === '--json') { cfg.json = value || ''; i++; }
    else if (flag === '--chrome') { cfg.chrome = String(value || '').trim(); i++; }
    else throw new Error('未知参数: ' + flag);
  }
  if (!cfg.url) throw new Error('缺少必填参数 --url <URL>');
  if (!Number.isInteger(cfg.runs) || cfg.runs < 1 || cfg.runs > 20) throw new Error('--runs 必须是 1-20 的整数');
  if (!cfg.chrome) throw new Error('--chrome 不能为空');
  return cfg;
}

// 注入页面（导航前注册）：LCP / CLS / 交互最大时长 / longtask 累计
function installPerfCollector() {
  window.__perf = { lcp: 0, lcpEl: '', cls: 0, maxEvent: 0, longTasks: 0, tbt: 0 };
  const describe = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls;
  };
  const observe = (type, options, handle) => {
    try { new PerformanceObserver((list) => handle(list.getEntries())).observe(Object.assign({ type, buffered: true }, options)); }
    catch (e) { /* 观测器类型不支持时静默降级 */ }
  };
  observe('largest-contentful-paint', {}, (entries) => {
    const last = entries[entries.length - 1];
    if (!last) return;
    window.__perf.lcp = last.startTime;
    if (last.element && last.element.tagName) window.__perf.lcpEl = describe(last.element);
  });
  observe('layout-shift', {}, (entries) => {
    for (const entry of entries) if (!entry.hadRecentInput) window.__perf.cls += entry.value;
  });
  observe('event', { durationThreshold: 16 }, (entries) => {
    for (const entry of entries) if (entry.duration > window.__perf.maxEvent) window.__perf.maxEvent = entry.duration;
  });
  observe('longtask', {}, (entries) => {
    for (const entry of entries) { window.__perf.longTasks += 1; window.__perf.tbt += entry.duration; }
  });
}

// 温和交互：优先 #themeToggle，其次 .dark-toggle，最后首个可见 nav a
function gentleInteraction() {
  const toggle = document.querySelector('#themeToggle') || document.querySelector('.dark-toggle');
  if (toggle) { toggle.click(); return '#themeToggle/.dark-toggle'; }
  const links = Array.prototype.slice.call(document.querySelectorAll('nav a')).filter((a) => {
    const rect = a.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (links.length > 0) {
    // 阻止默认跳转：导航会销毁当前页采集状态，交互测量只关心事件响应本身
    links[0].addEventListener('click', (event) => event.preventDefault(), { once: true, capture: true });
    links[0].click();
    return 'nav a';
  }
  return '无可用交互元素';
}

// 页面内读取：资源传输量按类型聚合，HTML 文档传输字节单独取 navigation 条目
function readPerfData() {
  const nav = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');
  const byType = { script: 0, css: 0, img: 0, font: 0, other: 0 };
  let totalBytes = 0;
  for (const r of resources) {
    const bytes = r.transferSize || 0;
    totalBytes += bytes;
    let type = 'other';
    if (/\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(r.name)) type = 'font';
    else if (r.initiatorType === 'script' || /\.m?js(\?|#|$)/i.test(r.name)) type = 'script';
    else if (r.initiatorType === 'css' || /\.css(\?|#|$)/i.test(r.name)) type = 'css';
    else if (r.initiatorType === 'img') type = 'img';
    byType[type] += bytes;
  }
  return {
    lcp: window.__perf.lcp, lcpEl: window.__perf.lcpEl, cls: window.__perf.cls,
    maxEvent: window.__perf.maxEvent, longTasks: window.__perf.longTasks, tbt: window.__perf.tbt,
    htmlBytes: nav ? (nav.transferSize || nav.encodedBodySize || 0) : 0,
    totalBytes, requestCount: resources.length + 1, byType
  };
}

// 单次采样：独立 context + 禁用缓存 + CDP Slow 4G / CPU 4x 限速
async function measureRun(browser, cfg) {
  const context = await browser.createBrowserContext();
  let page = null;
  try {
    page = await context.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport(VIEWPORT);
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', Object.assign({ offline: false }, SLOW_4G));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });
    await page.evaluateOnNewDocument(installPerfCollector);
    const response = await page.goto(cfg.url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    if (response && response.status() >= 400) throw new Error('HTTP ' + response.status());
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: NETWORK_IDLE_MS }).catch(() => {});
    const interactionTarget = await page.evaluate(gentleInteraction);
    await new Promise((resolve) => setTimeout(resolve, INTERACTION_SETTLE_MS));
    const metrics = await page.evaluate(readPerfData);
    metrics.interactionTarget = interactionTarget;
    return { ok: true, metrics };
  } finally {
    if (page) await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

// 中位数与聚合（纯函数）
function median(values) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function aggregate(runs) {
  const ok = runs.filter((run) => run.ok);
  const medians = {};
  for (const key of METRIC_KEYS) medians[key] = median(ok.map((run) => run.metrics[key] || 0));
  return medians;
}

// 中文列宽（CJK 按 2 列计算），保证控制台表格对齐
function displayWidth(text) {
  let width = 0;
  for (const ch of String(text)) width += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1;
  return width;
}

function padCell(text, width) {
  const value = String(text);
  return value + ' '.repeat(Math.max(0, width - displayWidth(value)));
}

function renderConsoleTable(runs, medians) {
  const header = ['运行'].concat(METRIC_KEYS.map((key) => METRIC_LABELS[key]));
  const rows = runs.map((run, index) => [String(index + 1)].concat(
    METRIC_KEYS.map((key) => run.ok ? Number(run.metrics[key]).toFixed(key === 'cls' ? 4 : 0) : '-')));
  if (runs.some((run) => run.ok)) {
    rows.push(['中位数'].concat(METRIC_KEYS.map((key) => Number(medians[key]).toFixed(key === 'cls' ? 4 : 0))));
  }
  const widths = header.map((title, col) => Math.max(displayWidth(title), ...rows.map((row) => displayWidth(row[col]))));
  const lines = [header.map((cell, col) => padCell(cell, widths[col])).join(' | ')];
  lines.push(widths.map((width) => '-'.repeat(width)).join('-+-'));
  for (const row of rows) lines.push(row.map((cell, col) => padCell(cell, widths[col])).join(' | '));
  return lines.join('\n');
}

const escapeCell = (text) => String(text).replace(/\|/g, '\\|');

// Markdown 生成（纯函数）：含命令行、环境说明、逐次指标、中位数与局限
function renderMarkdown(result) {
  const okCount = result.runs.filter((run) => run.ok).length;
  const lines = [
    '# 性能基线记录', '',
    '> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。', '',
    '## 采样信息', '',
    '| 项 | 值 |', '| --- | --- |',
    `| 生成时间（UTC） | ${result.timestamp} |`,
    `| 目标 URL | ${result.url} |`,
    `| 命令行 | \`${result.command}\` |`,
    `| 运行环境 | ${result.environment.chrome}（${result.environment.browserVersion}） |`,
    '| 网络条件 | Slow 4G：下行 1.6 Mbps / 上行 750 kbps / RTT 150ms |',
    '| CPU 节流 | 4x |',
    '| 缓存 | 禁用（独立上下文 + `setCacheEnabled(false)`） |',
    '| 视口 | 1440×900 @1x |',
    `| 运行次数 | ${result.runs.length}（成功 ${okCount}） |`, '',
    '## 指标', '',
    '| 运行 | LCP(ms) | CLS | 交互最大时长(ms)（INP 代理） | TBT(ms)（长任务总时长代理） | HTML 传输字节 | 总传输字节 | 请求数 | 长任务数 | LCP 元素 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ];
  result.runs.forEach((run, index) => {
    if (!run.ok) { lines.push(`| ${index + 1} | 失败：${escapeCell(run.error)} | - | - | - | - | - | - | - | - |`); return; }
    const m = run.metrics;
    lines.push(`| ${index + 1} | ${Math.round(m.lcp)} | ${m.cls.toFixed(4)} | ${Math.round(m.maxEvent)} | ${Math.round(m.tbt)} | ${Math.round(m.htmlBytes)} | ${Math.round(m.totalBytes)} | ${m.requestCount} | ${m.longTasks} | ${escapeCell(m.lcpEl || '-')} |`);
  });
  if (okCount > 0) {
    const med = result.medians;
    lines.push(`| **中位数** | ${Math.round(med.lcp)} | ${med.cls.toFixed(4)} | ${Math.round(med.maxEvent)} | ${Math.round(med.tbt)} | ${Math.round(med.htmlBytes)} | ${Math.round(med.totalBytes)} | ${Math.round(med.requestCount)} | - | - |`);
  }
  lines.push('', '## 说明与局限', '');
  lines.push(
    '- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。',
    '- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。',
    '- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。',
    '- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。'
  );
  if (okCount < 3) lines.push(`- 待补：本地环境基线与 3 次运行中位数（当前成功 ${okCount} 次；建议以 \`--runs 3\` 复测）。`);
  return lines.join('\n') + '\n';
}

function writeText(file, content) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

async function main() {
  let cfg;
  try { cfg = parseArgs(process.argv.slice(2), process.env); }
  catch (err) { console.error('参数错误: ' + err.message); console.error(USAGE); process.exit(2); }
  if (!fs.existsSync(cfg.chrome)) {
    console.error('未找到 Chrome: ' + cfg.chrome);
    console.error('请通过 --chrome <路径> 或环境变量 CHROME_PATH 指定 Chrome 可执行文件。');
    process.exit(2);
  }
  const command = 'node scripts/perf-audit.js ' + process.argv.slice(2).join(' ');
  console.log(`性能审计 URL=${cfg.url} runs=${cfg.runs}`);
  console.log('条件: Slow 4G(下行 200000 B/s / 上行 93750 B/s / RTT 150ms) CPU=4x 缓存=禁用');
  let browser = null;
  try {
    browser = await puppeteer.launch({ executablePath: cfg.chrome, headless: true, args: ['--no-sandbox'] });
    const browserVersion = await browser.version();
    const runs = [];
    for (let i = 0; i < cfg.runs; i++) {
      try {
        const result = await measureRun(browser, cfg);
        runs.push(result);
        console.log(`[run ${i + 1}] OK LCP=${Math.round(result.metrics.lcp)}ms CLS=${result.metrics.cls.toFixed(4)} 请求数=${result.metrics.requestCount} 交互=${result.metrics.interactionTarget}`);
      } catch (err) {
        runs.push({ ok: false, error: err.message });
        console.error(`[run ${i + 1}] FAIL ${err.message}`);
      }
    }
    const okCount = runs.filter((run) => run.ok).length;
    const medians = aggregate(runs);
    console.log('\n' + renderConsoleTable(runs, medians));
    const payload = {
      timestamp: new Date().toISOString(), url: cfg.url, command,
      environment: {
        chrome: cfg.chrome, browserVersion,
        network: 'Slow 4G (200000 B/s down / 93750 B/s up / RTT 150ms)',
        cpuThrottle: '4x', cache: 'disabled', viewport: '1440x900'
      },
      runs, medians
    };
    if (cfg.out && okCount > 0) { writeText(cfg.out, renderMarkdown(payload)); console.log('已写入 Markdown: ' + cfg.out); }
    if (cfg.json) { writeText(cfg.json, JSON.stringify(payload, null, 2) + '\n'); console.log('已写入 JSON: ' + cfg.json); }
    await browser.close();
    browser = null;
    process.exit(okCount === 0 ? 1 : 0);
  } catch (err) {
    console.error('FATAL ' + err.message);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
}

main();
