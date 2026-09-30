'use strict';
// 浏览器无头验证共享底座（冒烟 test:smoke 与覆盖率 test:cov-web 共用）：
//   - 静态服务子进程：复用 compression-verify-server.js（端口 0 系统分配、看门狗环境变量防孤儿）；
//   - Chrome 启动/关闭：resolveChromePath 探测系统 Chrome，无 Chrome 由调用方跳过；
//   - 控制台错误收集：attachConsole 与压缩无头验证同一白名单标准（favicon 噪声除外）；
//   - 构建入口：runBuild 以 --out 隔离输出目录，关闭构建内嵌压缩验证避免嵌套无头流程。
// 所有资源使用方法返回的句柄显式收尾（关闭浏览器 → 停服务 → 端口释放校验）。

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const { resolveChromePath } = require('./mermaid-render');
const {
  parseServerPort,
  waitForPortRelease,
  attachConsole,
  closeBrowserSafely,
  settleRuntimePage,
  sampleRuntimeErrors,
  sleep
} = require('./compression-verify');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_ENTRY = path.resolve(__dirname, '..', 'compression-verify-server.js');
const SERVER_START_TIMEOUT_MS = 20000;
const PORT_RELEASE_TIMEOUT_MS = 5000;
const DEFAULT_BUILD_TIMEOUT_MS = 300000;
const WATCHDOG = Object.freeze({ idleMs: 300000, maxMs: 900000 });

/** @returns {string} Chrome 可执行路径；未检测到返回空串 */
function resolveChrome() {
  return resolveChromePath('');
}

/**
 * 运行真实构建到指定输出目录（--out 隔离，不触碰部署产物目录）。
 * @param {string} outDir
 * @param {{ noBundle?: boolean, extraArgs?: string[], env?: Record<string, string|undefined>, timeoutMs?: number }} [options]
 * @returns {{ ok: boolean, status: number|null, stdout: string, stderr: string }}
 */
function runBuild(outDir, options) {
  const opts = options || {};
  const args = ['scripts/build.js', '--out', outDir];
  if (opts.noBundle) args.push('--no-bundle');
  for (const extra of opts.extraArgs || []) args.push(extra);
  const result = spawnSync(process.execPath, args, {
    cwd: PROJECT_ROOT,
    env: Object.assign({}, process.env, {
      SYNAPSE_OUT_DIR: outDir,
      NODE_ENV: 'production',
      SYNAPSE_COMPRESSION_VERIFY: 'off'
    }, opts.env || {}),
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: opts.timeoutMs || DEFAULT_BUILD_TIMEOUT_MS
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || '')
  };
}

/**
 * 启动静态服务子进程（端口 0 系统分配）。
 * @param {string} rootDir 服务根目录
 * @returns {{ child: import('node:child_process').ChildProcess, ready: Promise<number>, stderr: () => string }}
 */
function startStaticServer(rootDir) {
  const child = spawn(process.execPath, [SERVER_ENTRY, '--root', rootDir], {
    cwd: PROJECT_ROOT,
    env: Object.assign({}, process.env, {
      SYNAPSE_SERVE_PARENT_PID: String(process.pid),
      SYNAPSE_SERVE_IDLE_MS: String(WATCHDOG.idleMs),
      SYNAPSE_SERVE_MAX_MS: String(WATCHDOG.maxMs)
    }),
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
      reject(new Error('静态服务启动超时（未在 ' + SERVER_START_TIMEOUT_MS + 'ms 内打印端口）'));
    }, SERVER_START_TIMEOUT_MS);
    timer.unref();
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
      reject(new Error('静态服务提前退出（code=' + code + '）' + (stderr ? '；' + stderr.trim() : '')));
    });
    child.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
  return { child, ready, stderr: () => stderr };
}

/**
 * 停止静态服务子进程（SIGTERM → 3 秒后 SIGKILL 兜底）。
 * @param {{ child: import('node:child_process').ChildProcess }} handle
 * @returns {Promise<void>}
 */
function stopStaticServer(handle) {
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

/**
 * 启动无头 Chrome（puppeteer-core + 系统 Chrome）。
 * @param {string} chromePath
 * @returns {Promise<any>} Browser 实例
 */
function launchChrome(chromePath) {
  const puppeteerCore = require('puppeteer-core');
  return puppeteerCore.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-proxy-server', '--disable-features=Translate,OptimizationHints'],
    timeout: 30000,
    protocolTimeout: 180000
  });
}

/**
 * 关闭 Chrome（API 关闭 → 2 秒后强杀兜底）。
 * @param {any} browser
 * @returns {Promise<{ closedByApi: boolean, forcedKill: boolean }>}
 */
function closeChrome(browser) {
  return closeBrowserSafely(browser, 3000);
}

/**
 * 等待端口释放（可重新绑定即视为释放）。
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function checkPortReleased(port) {
  return waitForPortRelease(port, PORT_RELEASE_TIMEOUT_MS);
}

/**
 * 访问页面并等待运行时引导完成（__T 可用 + 固定沉降），返回控制台错误列表。
 * @param {any} page
 * @param {string} url
 * @param {{ errors: string[], reset: () => void }} consoleState
 * @param {number} [timeoutMs]
 * @returns {Promise<string[]>}
 */
async function visitAndCollectErrors(page, url, consoleState, timeoutMs) {
  consoleState.reset();
  await page.goto(url, { waitUntil: 'load', timeout: timeoutMs || 30000 });
  await settleRuntimePage(page);
  return consoleState.errors.slice();
}

module.exports = {
  PROJECT_ROOT,
  WATCHDOG,
  DEFAULT_BUILD_TIMEOUT_MS,
  resolveChrome,
  runBuild,
  startStaticServer,
  stopStaticServer,
  launchChrome,
  closeChrome,
  checkPortReleased,
  visitAndCollectErrors,
  attachConsole,
  settleRuntimePage,
  sampleRuntimeErrors,
  sleep
};
