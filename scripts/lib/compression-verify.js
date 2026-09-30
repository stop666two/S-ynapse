'use strict';
// 压缩无头对比验证核心库：基线快照 / 恢复 / 逐字节复核 / 无头断言 / 端口与进程管理。
// 由 scripts/build/minify.js 在压缩增强步骤完成后、cacheBust 之前内联调用；
// 也可由 scripts/verify-compression.js 经完整构建间接运行（同一实现）。
//
// 对比模型：同一构建的「增强后 dist」与「增强前基线快照」各起一个本地静态服务
// （scripts/compression-verify-server.js），puppeteer-core（系统 Chrome）逐页断言：
//   ① DOM 归一化结构一致（JS 关闭的静态页）——剔除压缩无关差异（注释 / 空白文本节点 /
//      属性顺序），显式白名单：内联 <style> 元素整体剔除（同页合并是预期结构变化，
//      样式等价由 ② 断言）、构建期 nonce 归一化、app/deferred bundle 与 runtime 引导脚本
//      的文件名哈希归一化（混淆/压缩按最终字节改名是预期差异）；
//      关闭 JS 以隔离运行时注入（reveal 动画类、代码块工具栏属性、speculationrules 脚本
//      等时序相关差异），压缩作用于静态字节，这属于压缩无关差异；
//   ② 采样元素计算样式一致（JS 关闭的静态页）——每页可见元素前 N 个的 getComputedStyle 关键属性串；
//   ③ 两态 0 控制台错误（JS 开启，逐页；唯一过滤项：浏览器默认 favicon 请求噪声）；
//   ④ 压缩态交互冒烟（JS 开启）——软导航点击文章无整页刷新、搜索可打开、主题切换可用；
//   ⑤ runtime 压缩或 js.obfuscate.enabled 时压缩态额外断言 __T/__SB 与 deferred 动态加载。
// 失败由调用方按 verify.fallbackOnFailure 决定回退；
// Chrome 探测失败或启动失败 → status=skipped（构建不失败，仅告警）。
//
// 端口与进程：两个子服务均以 --port 0 由系统分配（互不相同），结束时无条件关闭
// 并探测端口释放；子进程注入 SYNAPSE_SERVE_PARENT_PID / SYNAPSE_SERVE_IDLE_MS /
// SYNAPSE_SERVE_MAX_MS 看门狗（父进程消失、空闲或超寿命时自退，防孤儿）。

const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { writeFileAtomicSync, commitAtomicTemp } = require('./atomic-write');
const { resolveChromePath } = require('./mermaid-render');

// 快照范围：增强步骤可能触及的全部文本类产物扩展名（HTML/CSS/JS/JSON）。
const SNAPSHOT_EXTENSIONS = Object.freeze(['.html', '.css', '.js', '.json']);
const BASELINE_MANIFEST = 'baseline-manifest.json';
const SERVER_ENTRY = path.resolve(__dirname, '..', 'compression-verify-server.js');
const SERVE_PORT_LINE = /SYNAPSE_SERVE_PORT=(\d+)/;
const DEFAULT_SERVER_START_TIMEOUT_MS = 20000;
const DEFAULT_PORT_RELEASE_TIMEOUT_MS = 3000;
const DEFAULT_PAGE_TIMEOUT_MS = 30000;
const PAGE_SETTLE_MS = 300;
// 验证服务看门狗：父进程（构建）消失 / 空闲 3 分钟 / 寿命 10 分钟即自退。
const VERIFY_WATCHDOG = Object.freeze({ idleMs: 180000, maxMs: 600000 });
const STYLE_SAMPLE_LIMIT = 80;
// 计算样式采样属性：只取确定性布局/排版/颜色属性，避开动画时相（transform/opacity）
// 与视口相关尺寸（width/height/getBoundingClientRect 仅用于可见性判定）。
const STYLE_PROPS = Object.freeze([
  'display', 'visibility', 'position', 'color', 'background-color', 'font-family', 'font-size',
  'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform',
  'text-decoration-line', 'border-top-width', 'border-right-width', 'border-bottom-width',
  'border-left-width', 'border-top-color', 'border-bottom-color', 'border-radius', 'box-sizing',
  'padding-top', 'padding-left', 'margin-top', 'margin-left', 'overflow-x'
]);
// 页面发现时排除的非文章目录段（自定义页/归档/检索等）。
const RESERVED_SEGMENTS = Object.freeze([
  'search', 'archive', 'tags', 'categories', 'about', 'favorites', 'links',
  'privacy', 'terms', 'disclaimer', 'gallery', 'gallery-media'
]);

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// ---------------------------------------------------------------------------
// 纯逻辑：快照 / 恢复 / 逐字节复核
// ---------------------------------------------------------------------------

/** 相对路径（POSIX 形式）转绝对路径。@returns {string} */
function resolvedPath(root, rel) {
  return path.join(root, rel.split('/').join(path.sep));
}

/**
 * 列出 dist 下全部需要快照的文本产物（.html/.css/.js/.json，大小写不敏感）。
 * @param {string} distDir
 * @returns {string[]} 相对 dist 根的 POSIX 路径（已排序）
 */
function collectSnapshotTargets(distDir) {
  const targets = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!SNAPSHOT_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) continue;
      targets.push(path.relative(distDir, abs).split(path.sep).join('/'));
    }
  };
  walk(distDir);
  return targets.sort();
}

function copyFileAtomicSync(src, dest) {
  const tmp = dest + '.tmp-copy-' + process.pid;
  fs.copyFileSync(src, tmp);
  commitAtomicTemp(tmp, dest);
}

/**
 * 读取基线快照清单。
 * @param {string} baselineDir
 * @throws {Error} 清单缺失或格式非法
 */
function readBaselineManifest(baselineDir) {
  const file = path.join(baselineDir, BASELINE_MANIFEST);
  if (!fs.existsSync(file)) throw new Error('基线快照清单不存在: ' + file);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!parsed || !Array.isArray(parsed.files)) throw new Error('基线快照清单格式非法: ' + file);
  return parsed;
}

/**
 * 建立基线快照：把 dist 下全部文本产物复制到项目内持久目录（默认 .cache/compression-baseline）。
 * 先整目录重建，避免上一轮构建的陈旧快照残留；全部文件就位后写入清单。
 * @param {string} distDir
 * @param {string} baselineDir
 * @returns {{ dir: string, files: string[], fileCount: number, bytes: number }}
 */
function createBaselineSnapshot(distDir, baselineDir) {
  fs.rmSync(baselineDir, { recursive: true, force: true });
  fs.mkdirSync(baselineDir, { recursive: true });
  const files = collectSnapshotTargets(distDir);
  let bytes = 0;
  for (const rel of files) {
    const src = resolvedPath(distDir, rel);
    const dest = resolvedPath(baselineDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    copyFileAtomicSync(src, dest);
    try { bytes += fs.statSync(src).size; } catch (err) { /* 体积统计失败不影响快照正确性 */ }
  }
  const manifest = { version: 1, createdAt: new Date().toISOString(), files };
  writeFileAtomicSync(path.join(baselineDir, BASELINE_MANIFEST), JSON.stringify(manifest, null, 2));
  return { dir: baselineDir, files, fileCount: files.length, bytes };
}

/**
 * 用基线快照覆写 dist 中被增强触及的文件，并删除快照之后新增的文本产物
 * （例如混淆重命名产生的新 bundle），使文本产物集合回到增强前状态。
 * 不触碰 .html/.css/.js/.json 之外的资产（增强步骤本就不修改它们）。
 * @param {string} baselineDir
 * @param {string} distDir
 * @returns {{ restored: number, removed: number, removedFiles: string[], missingBaseline: string[] }}
 */
function restoreBaselineSnapshot(baselineDir, distDir) {
  const manifest = readBaselineManifest(baselineDir);
  const baselineSet = new Set(manifest.files);
  let restored = 0;
  const missingBaseline = [];
  for (const rel of manifest.files) {
    const src = resolvedPath(baselineDir, rel);
    if (!fs.existsSync(src)) { missingBaseline.push(rel); continue; }
    const dest = resolvedPath(distDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    copyFileAtomicSync(src, dest);
    restored += 1;
  }
  const removedFiles = [];
  for (const rel of collectSnapshotTargets(distDir)) {
    if (baselineSet.has(rel)) continue;
    try {
      fs.rmSync(resolvedPath(distDir, rel), { force: true });
      removedFiles.push(rel);
    } catch (err) { /* 删除失败时由 compareSnapshotBytes 的逐字节复核暴露残留 */ }
  }
  return { restored, removed: removedFiles.length, removedFiles, missingBaseline };
}

/**
 * 逐字节复核：对基线清单内每个文件比较基线快照与 dist 的 sha256。
 * @param {string} baselineDir
 * @param {string} distDir
 * @returns {{ files: number, match: boolean, mismatches: string[] }}
 */
function compareSnapshotBytes(baselineDir, distDir) {
  const manifest = readBaselineManifest(baselineDir);
  const mismatches = [];
  for (const rel of manifest.files) {
    try {
      const baselineHash = crypto.createHash('sha256').update(fs.readFileSync(resolvedPath(baselineDir, rel))).digest('hex');
      const distPath = resolvedPath(distDir, rel);
      const distHash = fs.existsSync(distPath)
        ? crypto.createHash('sha256').update(fs.readFileSync(distPath)).digest('hex')
        : '';
      if (baselineHash !== distHash) mismatches.push(rel);
    } catch (err) {
      mismatches.push(rel);
    }
  }
  return { files: manifest.files.length, match: mismatches.length === 0, mismatches };
}

// ---------------------------------------------------------------------------
// 纯逻辑：白名单归一化 / 环境开关 / 端口 / 页面发现
// ---------------------------------------------------------------------------

/**
 * 断言白名单归一化：把两态之间预期存在的差异折叠为占位符。
 *   ① nonce 属性值与 CSP 串（同一构建下两态本应一致，归一化用于防御跨构建复用）；
 *   ② app/deferred bundle 与 runtime 引导脚本的文件名哈希：混淆/压缩按最终字节重命名，
 *      两态必然不同（改动内容已由控制台错误、交互与运行时断言覆盖）。
 * 幂等；仅归一化具名白名单，其余差异一律保留为失败信号。
 * @param {string} text 规范 DOM 串
 * @returns {string}
 */
function normalizeWhitelistText(text) {
  return String(text == null ? '' : text)
    .replace(/(nonce\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1"NONCE"')
    .replace(/'nonce-[^']*'/gi, "'nonce-NONCE'")
    .replace(/\b(app|deferred|runtime)\.[0-9A-Za-z]{6,12}\.js/g, '$1.HASH.js');
}

/**
 * 读取内联验证开关：SYNAPSE_COMPRESSION_VERIFY=off|0|false 时不执行无头对比
 * （测试/隔离构建用；缺省 on）。
 * @param {Record<string, string|undefined>} [env]
 * @returns {'on'|'off'}
 */
function verifyModeFromEnv(env) {
  const raw = String((env && env.SYNAPSE_COMPRESSION_VERIFY) || '').trim().toLowerCase();
  if (raw === 'off' || raw === '0' || raw === 'false') return 'off';
  return 'on';
}

/**
 * 从验证服务子进程 stdout 解析实际监听端口。
 * @param {string} output
 * @returns {number} 未找到返回 0
 */
function parseServerPort(output) {
  const match = SERVE_PORT_LINE.exec(String(output || ''));
  return match ? Number(match[1]) : 0;
}

/**
 * 判定端口集合是否全部为正整数且互不相同。
 * @param {number[]} ports
 * @returns {boolean}
 */
function assertDistinctPorts(ports) {
  const seen = new Set();
  for (const port of ports) {
    if (!Number.isInteger(port) || port <= 0 || seen.has(port)) return false;
    seen.add(port);
  }
  return true;
}

function pageFile(distDir, urlPath) {
  const clean = String(urlPath || '').split('?')[0].split('#')[0];
  const rel = clean.replace(/^\/+/, '');
  if (!rel || clean.endsWith('/')) return path.join(distDir, rel.split('/').join(path.sep), 'index.html');
  return path.join(distDir, rel.split('/').join(path.sep));
}

function pageExists(distDir, urlPath) {
  try { return fs.existsSync(pageFile(distDir, urlPath)); } catch (err) { return false; }
}

/** 从首页 post-card 链接发现一篇文章页；失败时扫描 zh 一级目录回退。@returns {string} 空串表示未找到 */
function discoverArticlePath(distDir) {
  try {
    const html = fs.readFileSync(pageFile(distDir, '/zh/'), 'utf-8');
    const re = /href="\/zh\/([a-z0-9][a-z0-9-]*)\/?"/g;
    let match;
    while ((match = re.exec(html))) {
      if (!RESERVED_SEGMENTS.includes(match[1])) return '/zh/' + match[1] + '/';
    }
  } catch (err) { /* 首页不可读时退化为目录扫描 */ }
  try {
    for (const entry of fs.readdirSync(path.join(distDir, 'zh'), { withFileTypes: true })) {
      if (!entry.isDirectory() || RESERVED_SEGMENTS.includes(entry.name)) continue;
      if (fs.existsSync(path.join(distDir, 'zh', entry.name, 'index.html'))) return '/zh/' + entry.name + '/';
    }
  } catch (err) { /* zh 目录不可用时返回空 */ }
  return '';
}

/**
 * 发现验证页面集（≥6 页）：/zh/、/en/、一篇文章（首页卡片链接发现，缺失时回退标签页）、
 * /zh/search/、/zh/archive/、/zh/404.html。
 * @param {string} distDir
 * @returns {string[]}
 */
function discoverVerifyPages(distDir) {
  const head = ['/zh/', '/en/'];
  const tail = ['/zh/search/', '/zh/archive/', '/zh/404.html'];
  const middle = [];
  const article = discoverArticlePath(distDir);
  if (article) middle.push(article);
  for (const fallback of ['/zh/tags/', '/zh/categories/', '/en/archive/']) {
    if (head.length + middle.length + tail.length >= 6) break;
    if (pageExists(distDir, fallback)) middle.push(fallback);
  }
  return head.concat(middle, tail);
}

/**
 * 等待端口释放（可重新绑定即视为释放）。用于构建结束后的无条件关闭校验。
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
function waitForPortRelease(port, timeoutMs) {
  const deadline = Date.now() + (Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_PORT_RELEASE_TIMEOUT_MS);
  return new Promise((resolve) => {
    const attempt = () => {
      const probe = net.createServer();
      probe.once('error', () => {
        try { probe.close(); } catch (err) { /* 未监听成功时忽略 */ }
        if (Date.now() < deadline) setTimeout(attempt, 100);
        else resolve(false);
      });
      try {
        probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
      } catch (err) {
        if (Date.now() < deadline) setTimeout(attempt, 100);
        else resolve(false);
      }
    };
    attempt();
  });
}

// ---------------------------------------------------------------------------
// 失败汇总与结果报告
// ---------------------------------------------------------------------------

function firstDifference(a, b) {
  const limit = Math.max(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  const from = Math.max(0, index - 80);
  return {
    index,
    compressed: a.slice(from, index + 120),
    baseline: b.slice(from, index + 120),
    lengths: { compressed: a.length, baseline: b.length }
  };
}

function firstArrayDifference(a, b) {
  const limit = Math.max(a.length, b.length);
  for (let i = 0; i < limit; i++) {
    if (a[i] !== b[i]) return { index: i, compressed: a[i] || null, baseline: b[i] || null };
  }
  return { index: -1 };
}

/** 把失败列表压成一行为日志可读摘要。@param {Array<object>} failures @returns {string} */
function summarizeFailures(failures) {
  const list = Array.isArray(failures) ? failures : [];
  const head = list.slice(0, 3).map((item) => {
    const detail = typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail);
    return (item.kind || '?') + (item.page ? '@' + item.page : '') + ': ' + detail;
  }).join('；');
  return head + (list.length > 3 ? '；等共 ' + list.length + ' 项' : '');
}

/**
 * 写入验证结果 JSON（原子写；目录不存在时自动创建）。
 * @param {string} reportPath
 * @param {object} report
 * @returns {boolean}
 */
function writeVerifyReport(reportPath, report) {
  try {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileAtomicSync(reportPath, JSON.stringify(report, null, 2));
    return true;
  } catch (err) {
    console.warn('  [WARN] 压缩验证结果写入失败 ' + reportPath + ': ' + err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 验证服务子进程管理
// ---------------------------------------------------------------------------

function startVerifyServer(opts) {
  const args = [SERVER_ENTRY, '--root', opts.rootDir];
  if (opts.fallbackDir) args.push('--fallback', opts.fallbackDir);
  const child = spawn(process.execPath, args, {
    cwd: opts.cwd || process.cwd(),
    env: Object.assign({}, process.env, opts.env || {}),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  let settled = false;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('验证服务启动超时（未在 ' + DEFAULT_SERVER_START_TIMEOUT_MS + 'ms 内打印端口）'));
    }, DEFAULT_SERVER_START_TIMEOUT_MS);
    if (typeof timer.unref === 'function') timer.unref();
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
      const port = parseServerPort(stdout);
      if (port > 0 && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(port);
      }
    });
    child.once('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('验证服务提前退出（code=' + code + '）' + (stderr ? '；' + stderr.trim() : '')));
    });
    child.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
  return { child, ready };
}

function stopVerifyServer(handle) {
  return new Promise((resolve) => {
    const child = handle.child;
    if (!child || child.exitCode !== null || child.signalCode) { resolve(); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    child.once('exit', finish);
    try { child.kill('SIGTERM'); } catch (err) { finish(); return; }
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (err) { /* 已退出 */ }
      finish();
    }, 3000).unref();
  });
}

function injectCorruption(distDir, logger) {
  const target = pageFile(distDir, '/zh/');
  const marker = '<div id="s-compression-verify-corrupt">corrupt</div>';
  const html = fs.readFileSync(target, 'utf-8');
  const next = html.includes('</body>') ? html.replace('</body>', marker + '</body>') : html + marker;
  writeFileAtomicSync(target, next);
  logger.warn('  [WARN] SYNAPSE_COMPRESSION_VERIFY_CORRUPT 测试钩子已注入破坏：' + target);
}

// ---------------------------------------------------------------------------
// 浏览器上下文函数（page.evaluate 序列化执行；禁止引用本模块作用域）
// ---------------------------------------------------------------------------

function browserCanonicalDom() {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === 8) return;
    if (node.nodeType === 3) {
      const text = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (text) out.push(text);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = String(node.tagName || '').toLowerCase();
    if (tag === 'style') return;
    const attrs = [];
    const list = node.attributes || [];
    for (let i = 0; i < list.length; i++) {
      attrs.push([String(list[i].name).toLowerCase(), String(list[i].value)]);
    }
    attrs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    let open = '<' + tag;
    for (const item of attrs) open += ' ' + item[0] + '="' + item[1] + '"';
    out.push(open + '>');
    const children = node.childNodes || [];
    for (let i = 0; i < children.length; i++) walk(children[i]);
    out.push('</' + tag + '>');
  };
  walk(document.documentElement);
  return out.join('');
}

function browserSampleStyles(limit, props) {
  const out = [];
  const nodes = document.body ? document.body.querySelectorAll('*') : [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const parts = [];
    for (const prop of props) parts.push(prop + ':' + cs.getPropertyValue(prop));
    out.push(el.tagName.toLowerCase() + '|' + parts.join(';'));
    if (out.length >= limit) break;
  }
  return out;
}

async function browserInteractions() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const doc = document;
  const win = /** @type {any} */ (window);
  const clickIfPossible = (el) => {
    const target = /** @type {any} */ (el);
    if (target && typeof target.click === 'function') target.click();
    return !!(target && typeof target.click === 'function');
  };
  const out = { search: false, theme: false, softNav: false, softNavApplicable: false };
  const overlay = doc.getElementById('searchOverlay');
  if (!clickIfPossible(doc.querySelector('.hero-search')) && typeof win.openSearch === 'function') win.openSearch();
  await sleep(500);
  out.search = !!(overlay && overlay.classList.contains('open'));
  const themeBefore = doc.documentElement.getAttribute('data-theme');
  if (clickIfPossible(doc.querySelector('.dark-toggle'))) {
    await sleep(600);
    out.theme = doc.documentElement.getAttribute('data-theme') !== themeBefore;
  }
  win.__COMPRESSION_VERIFY_MARK = 771;
  // 软导航冒烟需要首页存在同语言文章卡片；空站骨架（0 文章）没有可点击目标，
  // 标记为不适用，由 runInteractions 跳过该项断言。
  const softNavTarget = doc.querySelector('.post-card a[href^="/zh/"]');
  out.softNavApplicable = !!softNavTarget;
  if (clickIfPossible(softNavTarget)) {
    await sleep(2000);
    out.softNav = win.__COMPRESSION_VERIFY_MARK === 771 && location.pathname !== '/zh/';
    out.after = location.pathname;
  }
  return out;
}

async function browserRuntimeBootstrap() {
  const win = /** @type {any} */ (window);
  const out = { t: typeof win.__T === 'function', sb: typeof win.__SB === 'function', load: '', has: '', search: false };
  try {
    const mod = await import(win.__DEFERRED_URL__);
    out.load = typeof mod.load;
    out.has = typeof mod.has;
    out.search = typeof mod.has === 'function' ? mod.has('search') : false;
  } catch (err) {
    out.error = String((err && err.message) || err);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 无头断言编排
// ---------------------------------------------------------------------------

async function preparePage(page, jsEnabled) {
  try {
    await page.setJavaScriptEnabled(jsEnabled !== false);
  } catch (err) { /* 旧版协议不支持时按默认（启用）处理 */ }
  try {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  } catch (err) { /* 旧版协议不支持时忽略：settle 等待仍提供稳定性 */ }
  page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(DEFAULT_PAGE_TIMEOUT_MS);
}

// 静态对比页面关闭 JavaScript：压缩作用于静态字节，DOM/计算样式须与运行时注入
// （reveal 动画类、代码块工具栏属性、speculationrules 脚本等时序相关差异）解耦；
// JS 运行时正确性由控制台错误断言与交互冒烟单独覆盖。
// 等待 CSSOM 与字体就绪（document.fonts.ready）后采样：字体度量会影响 line-height 等
// 计算值，必须先稳定再对比；但不等全部图片（load 事件），避免大图拉长门禁时间。
async function sampleStaticPage(page, url, opts) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.pageTimeoutMs || DEFAULT_PAGE_TIMEOUT_MS });
  await page.evaluate(() => {
    const fonts = document.fonts;
    return fonts && fonts.ready ? fonts.ready.then(() => true) : true;
  }).catch(() => {});
  await sleep(150);
  const rawDom = await page.evaluate(browserCanonicalDom);
  const styles = await page.evaluate(browserSampleStyles, STYLE_SAMPLE_LIMIT, STYLE_PROPS);
  return { dom: normalizeWhitelistText(rawDom), styles };
}

// 运行时页面（JS 开启）等待运行时引导就绪后收集控制台错误；不做 DOM/样式采样。
async function settleRuntimePage(page, timeoutMs) {
  await page.waitForFunction(() => typeof (/** @type {any} */ (window)).__T === 'function', { timeout: timeoutMs || 6000 }).catch(() => {});
  await sleep(PAGE_SETTLE_MS);
}

function attachConsole(page) {
  const errors = [];
  page.on('pageerror', (err) => { errors.push('pageerror: ' + String((err && err.message) || err)); });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // 白名单：浏览器默认 /favicon.ico 探测噪声（与页面产物无关）。
    if (/favicon\.ico/i.test(text)) return;
    errors.push(text);
  });
  return {
    errors,
    reset: () => { errors.length = 0; }
  };
}

// Chrome 关闭兜底：Windows 上 browser.close() 偶发长时间等待浏览器进程退出
// （后台网络/杀软扫描等），超出阈值后直接终止进程，避免门禁被清理阶段拖垮。
// 强杀可能残留临时 profile 目录（系统 %TEMP%），不影响构建产物与端口回收校验。
async function closeBrowserSafely(browser, timeoutMs) {
  const limit = Number.isFinite(timeoutMs) ? timeoutMs : 2000;
  const proc = (() => { try { return browser.process(); } catch (err) { return null; } })();
  const exited = new Promise((resolve) => {
    if (!proc || proc.exitCode !== null) return resolve();
    proc.once('exit', resolve);
  });
  const closedByApi = browser.close().then(() => true).catch(() => false);
  const closed = await Promise.race([closedByApi, sleep(limit).then(() => false)]);
  if (closed) return { closedByApi: true, forcedKill: false };
  try { if (proc && !proc.killed) proc.kill('SIGKILL'); } catch (err) { /* 进程已退出 */ }
  await Promise.race([exited, sleep(limit)]);
  return { closedByApi: false, forcedKill: true };
}

async function sampleRuntimeErrors(page, url, consoleState, opts) {
  consoleState.reset();
  await page.goto(url, { waitUntil: 'load', timeout: opts.pageTimeoutMs || DEFAULT_PAGE_TIMEOUT_MS });
  await settleRuntimePage(page);
  return consoleState.errors.slice();
}

function compareStaticPage(page, compressed, baseline, report) {
  if (compressed.dom !== baseline.dom) {
    report.failures.push({ kind: 'dom', page, detail: firstDifference(compressed.dom, baseline.dom) });
  }
  if (JSON.stringify(compressed.styles) !== JSON.stringify(baseline.styles)) {
    report.failures.push({ kind: 'style', page, detail: firstArrayDifference(compressed.styles, baseline.styles) });
  }
}

function compareConsoleErrors(page, compressedErrors, baselineErrors, report) {
  if (compressedErrors.length > 0 || baselineErrors.length > 0) {
    report.failures.push({
      kind: 'console',
      page,
      detail: { compressed: compressedErrors.slice(0, 5), baseline: baselineErrors.slice(0, 5) }
    });
  }
}

async function runInteractions(page, report) {
  let outcome;
  try {
    outcome = await page.evaluate(browserInteractions);
  } catch (err) {
    outcome = { search: false, theme: false, softNav: false, error: String((err && err.message) || err) };
  }
  // 空站骨架没有文章卡片（softNavApplicable=false）时 softNav 判为不适用而跳过；
  // 有目标或返回值缺失该字段（异常兜底）时仍按原断言要求 softNav === true。
  const checks = outcome.softNavApplicable === false ? ['search', 'theme'] : ['search', 'theme', 'softNav'];
  for (const name of checks) {
    if (outcome[name] !== true) {
      report.failures.push({ kind: 'interaction', page: '/zh/', detail: name + ' 冒烟未通过: ' + JSON.stringify(outcome) });
    }
  }
  return outcome;
}

async function checkRuntimeBootstrap(page, report) {
  let info;
  try {
    info = await page.evaluate(browserRuntimeBootstrap);
  } catch (err) {
    info = { t: false, sb: false, error: String((err && err.message) || err) };
  }
  if (!(info.t && info.sb && info.load === 'function' && info.has === 'function' && info.search === true)) {
    report.failures.push({ kind: 'runtime', page: '/zh/', detail: info });
  }
  return info;
}

/**
 * @typedef {object} CompressionVerifyOptions
 * @property {string} distDir 增强后的产物目录
 * @property {string} baselineDir 增强前的基线快照目录
 * @property {string} [chromePath] 显式 Chrome 路径（缺省按 resolveChromePath 探测）
 * @property {boolean} [obfuscateEnabled] 是否启用 JS 混淆（保留字段；引导断言条件之一）
 * @property {boolean} [bootstrapAssertions] 是否断言运行时引导（__T/__SB 与 deferred 动态加载）：
 *   runtime 压缩或 JS 混淆任一开启时为 true（缺省回退 obfuscateEnabled）
 * @property {number} [pageTimeoutMs] 单页加载超时（毫秒）
 * @property {string} [profileDir] 持久 Chrome profile 目录（复用可跳过首次导航初始化与临时
 *   profile 清理等待；同一目录同一时刻只允许一个 Chrome 实例，构建应串行执行）
 * @property {string} [cwd] 子服务进程工作目录
 * @property {Record<string, string|undefined>} [env] 环境变量（测试注入）
 * @property {Console} [logger] 日志输出
 */

/**
 * 执行无头对比验证。
 * @param {CompressionVerifyOptions} [options]
 * @returns {Promise<object>} 验证报告（status: passed | failed | skipped）
 */
async function verifyCompression(options) {
  const opts = /** @type {CompressionVerifyOptions} */ (options || {});
  const logger = opts.logger || console;
  const report = {
    version: 1,
    status: 'skipped',
    reason: '',
    checkedAt: new Date().toISOString(),
    pages: [],
    servers: [],
    portsReleased: null,
    comparisons: [],
    failures: [],
    injectedFailure: false,
    durationsMs: 0
  };
  const startedAt = Date.now();
  const finish = (status) => {
    report.status = status;
    report.durationsMs = Date.now() - startedAt;
    return report;
  };
  const distDir = path.resolve(opts.distDir);
  const baselineDir = path.resolve(opts.baselineDir);
  const chromePath = opts.chromePath || resolveChromePath('');
  if (!chromePath) {
    report.reason = 'chrome-not-found';
    return finish('skipped');
  }
  let puppeteerCore;
  try {
    puppeteerCore = require('puppeteer-core');
  } catch (err) {
    report.reason = 'puppeteer-core 不可用: ' + err.message;
    return finish('skipped');
  }
  if (!fs.existsSync(path.join(baselineDir, BASELINE_MANIFEST))) {
    report.failures.push({ kind: 'internal', detail: '基线快照缺失: ' + baselineDir });
    return finish('failed');
  }

  const env = opts.env || process.env;
  if (String(env.SYNAPSE_COMPRESSION_VERIFY_CORRUPT || '') !== '') {
    try {
      injectCorruption(distDir, logger);
      report.injectedFailure = true;
    } catch (err) {
      report.failures.push({ kind: 'internal', detail: '测试破坏注入失败: ' + err.message });
    }
  }

  report.pages = discoverVerifyPages(distDir);
  const phase = { startedAt: Date.now() };
  const mark = (name) => { phase[name] = Date.now(); };
  const serverHandles = [];
  let browser = null;
  try {
    mark('serversStartedAt');
    const watchdogEnv = {
      SYNAPSE_SERVE_PARENT_PID: String(process.pid),
      SYNAPSE_SERVE_IDLE_MS: String(VERIFY_WATCHDOG.idleMs),
      SYNAPSE_SERVE_MAX_MS: String(VERIFY_WATCHDOG.maxMs)
    };
    const compressedServer = startVerifyServer({ rootDir: distDir, env: watchdogEnv, cwd: opts.cwd });
    const baselineServer = startVerifyServer({ rootDir: baselineDir, fallbackDir: distDir, env: watchdogEnv, cwd: opts.cwd });
    serverHandles.push(compressedServer, baselineServer);
    const compressedPort = await compressedServer.ready;
    const baselinePort = await baselineServer.ready;
    report.servers = [
      { role: 'compressed', port: compressedPort },
      { role: 'baseline', port: baselinePort }
    ];
    if (!assertDistinctPorts([compressedPort, baselinePort])) {
      report.failures.push({ kind: 'server', detail: '验证服务端口未互异: ' + compressedPort + ',' + baselinePort });
    }
    mark('serversReadyAt');

    const profileDir = opts.profileDir ? path.resolve(opts.profileDir) : '';
    if (profileDir) fs.mkdirSync(profileDir, { recursive: true });
    try {
      browser = await puppeteerCore.launch({
        executablePath: chromePath,
        headless: true,
        userDataDir: profileDir || undefined,
        // --no-proxy-server：跳过 Windows 系统代理自动探测（WPAD），否则首个导航可能被拖到秒级；
        // --disable-features：关闭翻译/优化提示等与验证无关的后台初始化。
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-proxy-server', '--disable-features=Translate,OptimizationHints'],
        timeout: 30000,
        protocolTimeout: 120000
      });
    } catch (err) {
      report.reason = 'chrome-launch-failed: ' + String((err && err.message) || err);
      return finish('skipped');
    }
    mark('browserReadyAt');

    const compressedBase = 'http://127.0.0.1:' + compressedPort;
    const baselineBase = 'http://127.0.0.1:' + baselinePort;

    // ① 静态产物对比（JS 关闭）：DOM 归一化结构 + 采样计算样式。
    const staticA = await browser.newPage();
    const staticB = await browser.newPage();
    await preparePage(staticA, false);
    await preparePage(staticB, false);
    for (const pagePath of report.pages) {
      const staticStartedAt = Date.now();
      const [compressed, baseline] = await Promise.all([
        sampleStaticPage(staticA, compressedBase + pagePath, opts),
        sampleStaticPage(staticB, baselineBase + pagePath, opts)
      ]);
      report.comparisons.push({
        page: pagePath,
        staticMs: Date.now() - staticStartedAt,
        compressed: { domLength: compressed.dom.length, styleSamples: compressed.styles.length },
        baseline: { domLength: baseline.dom.length, styleSamples: baseline.styles.length }
      });
      compareStaticPage(pagePath, compressed, baseline, report);
    }
    await staticA.close().catch(() => {});
    await staticB.close().catch(() => {});
    mark('staticReadyAt');

    // ② 运行时控制台错误（JS 开启）：两态逐页收集，均须为 0。
    const runtimeA = await browser.newPage();
    const runtimeB = await browser.newPage();
    await preparePage(runtimeA, true);
    await preparePage(runtimeB, true);
    const consoleA = attachConsole(runtimeA);
    const consoleB = attachConsole(runtimeB);
    for (const pagePath of report.pages) {
      const [compressedErrors, baselineErrors] = await Promise.all([
        sampleRuntimeErrors(runtimeA, compressedBase + pagePath, consoleA, opts),
        sampleRuntimeErrors(runtimeB, baselineBase + pagePath, consoleB, opts)
      ]);
      const entry = report.comparisons.find((item) => item.page === pagePath);
      if (entry) {
        entry.compressed.errors = compressedErrors.slice(0, 3);
        entry.baseline.errors = baselineErrors.slice(0, 3);
      }
      compareConsoleErrors(pagePath, compressedErrors, baselineErrors, report);
    }
    mark('runtimeReadyAt');

    // ③ 交互与运行时断言固定用压缩态首页（页面集对比后页面可能已离开首页）。
    await runtimeA.goto(compressedBase + '/zh/', { waitUntil: 'load', timeout: opts.pageTimeoutMs || DEFAULT_PAGE_TIMEOUT_MS });
    await settleRuntimePage(runtimeA);
    if (opts.bootstrapAssertions === true || opts.obfuscateEnabled === true) {
      report.runtime = await checkRuntimeBootstrap(runtimeA, report);
    }
    report.interactions = await runInteractions(runtimeA, report);
    mark('interactionsReadyAt');
  } catch (err) {
    report.failures.push({ kind: 'internal', detail: String((err && err.stack) || err) });
  } finally {
    let browserCloseForced = false;
    if (browser) {
      const closeResult = await closeBrowserSafely(browser);
      browserCloseForced = closeResult.forcedKill;
    }
    const stopStartedAt = Date.now();
    await Promise.all(serverHandles.map((handle) => stopVerifyServer(handle)));
    const serverStopMs = Date.now() - stopStartedAt;
    mark('cleanupAt');
    report.phaseDurationsMs = {
      servers: (phase.serversReadyAt || phase.startedAt) - phase.serversStartedAt,
      browserLaunch: (phase.browserReadyAt || 0) - (phase.serversReadyAt || 0),
      staticCompare: (phase.staticReadyAt || 0) - (phase.browserReadyAt || 0),
      runtimeConsole: (phase.runtimeReadyAt || 0) - (phase.staticReadyAt || 0),
      interactions: (phase.interactionsReadyAt || 0) - (phase.runtimeReadyAt || 0),
      cleanup: phase.cleanupAt - (phase.interactionsReadyAt || phase.runtimeReadyAt || phase.startedAt),
      browserCloseForced,
      serverStopMs
    };
    const ports = report.servers.map((server) => server.port);
    if (ports.length > 0) {
      const released = [];
      for (const port of ports) released.push(await waitForPortRelease(port, DEFAULT_PORT_RELEASE_TIMEOUT_MS));
      report.portsReleased = released.every(Boolean);
      if (!report.portsReleased) {
        logger.warn('  [WARN] 压缩验证服务端口未完全释放: ' + report.servers.filter((server, index) => !released[index]).map((server) => server.port).join('/'));
      }
    }
  }
  return finish(report.failures.length > 0 ? 'failed' : 'passed');
}

module.exports = {
  SNAPSHOT_EXTENSIONS,
  BASELINE_MANIFEST,
  STYLE_PROPS,
  VERIFY_WATCHDOG,
  collectSnapshotTargets,
  createBaselineSnapshot,
  restoreBaselineSnapshot,
  compareSnapshotBytes,
  readBaselineManifest,
  normalizeWhitelistText,
  verifyModeFromEnv,
  parseServerPort,
  assertDistinctPorts,
  discoverArticlePath,
  discoverVerifyPages,
  pageExists,
  runInteractions,
  waitForPortRelease,
  summarizeFailures,
  writeVerifyReport,
  verifyCompression,
  attachConsole,
  closeBrowserSafely,
  settleRuntimePage,
  sampleRuntimeErrors,
  sleep
};
