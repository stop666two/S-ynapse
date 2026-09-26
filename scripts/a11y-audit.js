'use strict';
// 全页无障碍审计（axe-core + puppeteer-core）：
//   1. 页面集合自动从 dist/ 派生——收录全部 .html（仅排除内部构建报告 build-report.html），
//      中英双语首页/文章/归档/标签/分类/搜索/画廊/系列/收藏/友链等一页不漏；
//      dist/404.html 由 serve 以真实文件形式提供（HTTP 200），因此直接审计并计数记录；
//   2. 逐页校验 HTTP 2xx，非 2xx 记为 httpFailures 并计入退出码；
//   3. axe 规则集含 WCAG 2.2 AA（wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa），明暗双主题各跑一次；
//   4. 输出页数/失败数/违规明细（impact 分级 + 规则聚合 + 节点样例）；
//   5. 退出码：critical + serious + httpFailures > 0 即 1，否则 0（moderate/minor 仅报告不阻断）。
// 运行：npm run audit:a11y（无外部地址时自行拉起 serve，构建 + 服务 + 审计一次完成）
//       node scripts/a11y-audit.js <baseUrl>（已有 serve 时复用，如 .tmp-scripts/run-a11y.js）
process.env.SYNAPSE_SERVE_PARENT_PID = process.env.SYNAPSE_SERVE_PARENT_PID || String(process.pid);
process.env.SYNAPSE_SERVE_IDLE_MS = process.env.SYNAPSE_SERVE_IDLE_MS || '600000';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DEFAULT_PORT = 3224;
const EXPLICIT_BASE = String(process.argv[2] || process.env.A11Y_BASE || '').trim();
let BASE = EXPLICIT_BASE;
const AXE_PATH = path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EXCLUDE = new Set(['build-report.html']);
const HTML_SUMMARY_MAX = 120;
const NODES_PER_RULE_MAX = 3;

function urlFor(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel;
}

function collectPages() {
  const files = [];
  (function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith('.html')) files.push(abs);
    }
  })(DIST);
  const out = [];
  for (const abs of files) {
    const rel = path.relative(DIST, abs).split(path.sep).join('/');
    if (EXCLUDE.has(rel)) continue;
    out.push({
      url: urlFor(rel).split('/').map(encodeURIComponent).join('/'),
      file: rel,
      is404: /(^|\/)404\.html$/.test(rel)
    });
  }
  return out;
}

if (!fs.existsSync(DIST)) {
  console.error('FATAL 未找到 dist/；请先运行 `npm run build`。');
  process.exit(1);
}
const PAGES = collectPages();
if (PAGES.length === 0) {
  console.error('FATAL dist/ 下没有可审计的 HTML；请先运行 `npm run build`。');
  process.exit(1);
}
const NOT_FOUND_PAGES = PAGES.filter((p) => p.is404).length;

const AXE_TAGS = { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] };

function summarizeHtml(html) {
  return String(html || '').replace(/\s+/g, ' ').trim().slice(0, HTML_SUMMARY_MAX);
}

function probeOnce() {
  return new Promise((resolve) => {
    const req = http.get(BASE + '/', { timeout: 2000 }, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitReady(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await probeOnce()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function waitPortReleased(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!(await probeOnce())) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// 选一个确定空闲的端口自起 serve：避免与本机残留的旧 serve（含其它会话的孤儿进程）抢占
// 同一端口后「连上旧服务、扫描到半新产物」的竞态。显式传入 BASE 时不做自起。
function findFreePort(start, attempts) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', () => {
      if (attempts <= 1) reject(new Error('端口 ' + start + ' 起连续不可用'));
      else resolve(findFreePort(start + 1, attempts - 1));
    });
    srv.listen(start, '127.0.0.1', () => {
      srv.close(() => resolve(start));
    });
  });
}

// Windows 上 child.kill 偶见不彻底（句柄/子孙进程），用 taskkill /T /F 兜底整树强杀。
function hardKill(pid) {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch (e) { /* 进程已退出 */ }
}

(async () => {
  let server = null;
  let browser = null;
  let exitCode;
  if (!EXPLICIT_BASE) {
    const port = await findFreePort(DEFAULT_PORT, 40);
    BASE = 'http://127.0.0.1:' + port;
    server = spawn(process.execPath, ['scripts/build.js', '--serve', '--port', String(port)], {
      cwd: ROOT,
      stdio: 'ignore'
    });
    console.log('A11Y SERVE 自拉起构建+服务 ' + BASE + '（构建中，等待就绪…）');
    if (!(await waitReady(300000))) {
      console.error('FATAL serve 未在 300s 内就绪（构建失败或端口被占用）。');
      hardKill(server.pid);
      process.exit(1);
    }
  }
  try {
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
    const stats = {
      critical: { occ: 0, nodes: 0 },
      serious: { occ: 0, nodes: 0 },
      moderate: { occ: 0, nodes: 0 },
      minor: { occ: 0, nodes: 0 }
    };
    const ruleStats = new Map();
    let critical = 0;
    let serious = 0;
    let total = 0;
    let checks = 0;
    let runs = 0;
    let httpFailures = 0;
    let failedPages = 0;

    const record = (pageUrl, mode, item) => {
      const impact = item.impact || 'unknown';
      total++;
      if (impact === 'critical') critical++;
      else if (impact === 'serious') serious++;
      if (stats[impact]) { stats[impact].occ++; stats[impact].nodes += item.nodes.length; }
      const rule = ruleStats.get(item.id) || { impact, occ: 0, nodes: 0 };
      rule.occ++;
      rule.nodes += item.nodes.length;
      ruleStats.set(item.id, rule);
      console.log('[' + pageUrl + ' ' + mode + '] ' + impact + ' ' + item.id + ' x' + item.nodes.length);
      for (const node of item.nodes.slice(0, NODES_PER_RULE_MAX)) {
        console.log('    target: ' + node.target.join(' '));
        console.log('    html: ' + summarizeHtml(node.html));
      }
      if (item.nodes.length > NODES_PER_RULE_MAX) {
        console.log('    ... ' + (item.nodes.length - NODES_PER_RULE_MAX) + ' more node(s)');
      }
    };

    for (const spec of PAGES) {
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 1440, height: 900 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      let resp;
      try {
        resp = await page.goto(BASE + spec.url, { waitUntil: 'load' });
      } catch (err) {
        resp = null;
        console.error('[FAIL] ' + spec.url + ' navigate error: ' + err.message);
      }
      if (!resp || resp.status() < 200 || resp.status() >= 300) {
        httpFailures++;
        console.error('[FAIL] ' + spec.url + ' HTTP ' + (resp ? resp.status() : 'no-response'));
        await page.close();
        continue;
      }
      checks++;
      // 稳定化（axe 官方推荐做法，非禁用规则）：冻结动画/过渡并强制 reveal 终态，
      // 避免在页面淡入（.page-enter）与卡片入场（.motion-reveal 过渡中 opacity<1）的
      // 中间态取色——中间态会把前景与背景混色，产生成片的虚假 color-contrast 违规。
      await page.addStyleTag({
        content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;' +
          'transition-duration:0s!important;transition-delay:0s!important}' +
          '.motion-reveal{opacity:1!important;transform:none!important}'
      });
      await page.evaluate(() => new Promise((resolve) => {
        const done = () => requestAnimationFrame(() => setTimeout(resolve, 150));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(done).catch(done);
        else setTimeout(done, 150);
      }));
      await page.addScriptTag({ path: AXE_PATH });
      const runAxe = async (mode) => {
        runs++;
        const result = await page.evaluate(async (tags) => await window.axe.run(document, { runOnly: tags }), AXE_TAGS);
        for (const item of result.violations) record(spec.url, mode, item);
        return result.violations.length;
      };
      let pageViolations = await runAxe('light');
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await new Promise((r) => setTimeout(r, 250));
      pageViolations += await runAxe('dark');
      if (pageViolations > 0) failedPages++;
      await page.close();
    }

    const impactLine = ['critical', 'serious', 'moderate', 'minor']
      .map((k) => k + '=' + stats[k].occ + '(nodes=' + stats[k].nodes + ')')
      .join(' ');
    console.log('A11Y SUMMARY pages=' + PAGES.length + '(404=' + NOT_FOUND_PAGES + ') checked=' + checks +
      ' httpFailures=' + httpFailures + ' runs=' + runs + ' failedPages=' + failedPages +
      ' violations=' + total + ' critical=' + critical + ' serious=' + serious);
    console.log('A11Y IMPACTS ' + impactLine);
    const sortedRules = Array.from(ruleStats.entries()).sort((a, b) => b[1].occ - a[1].occ || a[0].localeCompare(b[0]));
    for (const [id, r] of sortedRules) {
      console.log('A11Y RULE ' + id + ' impact=' + r.impact + ' occurrences=' + r.occ + ' nodes=' + r.nodes);
    }
    const moderateMinor = sortedRules.filter(([, r]) => r.impact === 'moderate' || r.impact === 'minor');
    if (moderateMinor.length) {
      console.log('A11Y MODERATE/MINOR ' + moderateMinor.map(([id, r]) => id + '(' + r.impact + ' x' + r.occ + ')').join(', '));
    } else {
      console.log('A11Y MODERATE/MINOR none');
    }
    exitCode = critical + serious + httpFailures > 0 ? 1 : 0;
  } catch (err) {
    console.error('FATAL ' + err.message);
    exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) {
      server.kill();
      let released = await waitPortReleased(8000);
      if (!released) {
        console.error('[a11y] 警告：serve 端口未释放，taskkill 整树强杀 PID=' + server.pid);
        hardKill(server.pid);
        released = await waitPortReleased(5000);
      }
      if (released) console.log('[a11y] serve 已停止，端口已释放');
      else { console.error('[a11y] 警告：端口仍未释放 PID=' + server.pid); exitCode = 1; }
      try { process.kill(server.pid, 0); console.error('[a11y] 警告：serve 进程仍存活 PID=' + server.pid); exitCode = 1; }
      catch (e) { /* 已退出 */ }
    }
  }
  process.exit(exitCode);
})();
