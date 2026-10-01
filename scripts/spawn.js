#!/usr/bin/env node
'use strict';

// 受控前台运行器：为子命令注入进程守卫并施加超时；超时或父进程死亡时清理整棵进程树。
// 自动化（AI/CI）运行任何可能挂起的命令必须走本运行器，禁止使用 Start-Process 等脱离监管的方式。
// 用法: node scripts/spawn.js [--max-ms N] [--log <文件>] [--status-file <文件>] [--heartbeat-ms N] [--] <命令> [参数...]

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const opts = { maxMs: 15 * 60 * 1000, log: '', statusFile: '', heartbeatMs: 30000, rest: [] };
  let i = 0;
  for (; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') { i += 1; break; }
    if (arg === '--max-ms') { opts.maxMs = Number(argv[i + 1]); i += 1; continue; }
    if (arg === '--log') { opts.log = argv[i + 1]; i += 1; continue; }
    if (arg === '--status-file') { opts.statusFile = argv[i + 1]; i += 1; continue; }
    if (arg === '--heartbeat-ms') { opts.heartbeatMs = Number(argv[i + 1]); i += 1; continue; }
    break;
  }
  opts.rest = argv.slice(i);
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.rest.length) {
  console.error('用法: node scripts/spawn.js [--max-ms N] [--log <文件>] [--status-file <文件>] [--heartbeat-ms N] [--] <命令> [参数...]');
  process.exit(2);
}
if (!Number.isFinite(opts.maxMs) || opts.maxMs < 0) {
  console.error('[spawn] --max-ms 必须是 ≥0 的数字（0 表示不限时，仍受父进程死亡兜底）');
  process.exit(2);
}

const startedAt = Date.now();
function writeStatus(code, extra) {
  if (!opts.statusFile) return;
  try {
    fs.mkdirSync(path.dirname(path.resolve(opts.statusFile)), { recursive: true });
    const payload = Object.assign({
      code,
      elapsedMs: Date.now() - startedAt,
      at: new Date().toISOString(),
      cmd: opts.rest.join(' ')
    }, extra || {});
    fs.writeFileSync(opts.statusFile, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch { /* 状态文件写入失败不影响主流程 */ }
}

const guardPath = path.join(__dirname, 'lib', 'process-guard.js').replace(/\\/g, '/');
const [cmd, ...args] = opts.rest;

const env = {
  ...process.env,
  SYNAPSE_GUARD: '1',
  SYNAPSE_MAX_MS: String(opts.maxMs),
  SYNAPSE_PARENT_PID: String(process.pid),
};
env.NODE_OPTIONS = `${env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ` : ''}--require "${guardPath}"`;

let outFd = 'inherit';
if (opts.log) {
  fs.mkdirSync(path.dirname(path.resolve(opts.log)), { recursive: true });
  outFd = fs.openSync(opts.log, 'a');
}

const detached = process.platform !== 'win32';
const child = spawn(cmd, args, {
  stdio: ['ignore', outFd, outFd],
  env,
  detached,
  windowsHide: true,
});

let timedOut = false;
let timer = null;
let heartbeat = null;
function killChildTree() {
  try {
    if (process.platform === 'win32') {
      require('node:child_process').execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10000 });
    } else {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 忽略 */ }
    }
  } catch { /* 清理失败不再抛错 */ }
}
if (opts.heartbeatMs > 0) {
  heartbeat = setInterval(() => {
    const line = `[spawn] 运行中 elapsed=${Math.round((Date.now() - startedAt) / 1000)}s pid=${child.pid}\n`;
    try {
      if (typeof outFd === 'number') fs.writeSync(outFd, line);
      else process.stderr.write(line);
    } catch { /* 心跳输出失败忽略 */ }
  }, opts.heartbeatMs);
  heartbeat.unref();
}
if (opts.maxMs > 0) {
  timer = setTimeout(() => {
    timedOut = true;
    console.error(`[spawn] 超过 --max-ms=${opts.maxMs}，清理进程树并退出`);
    writeStatus(124, { timedOut: true });
    killChildTree();
    setTimeout(() => {
      console.error('[spawn] 子进程未在清理后退出，强制结束');
      process.exit(124);
    }, 3000).unref();
  }, opts.maxMs);
  timer.unref();
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    console.error(`[spawn] 收到 ${sig}，清理子进程树`);
    if (heartbeat) clearInterval(heartbeat);
    writeStatus(sig === 'SIGINT' ? 130 : 143, { signal: sig });
    killChildTree();
    process.exit(sig === 'SIGINT' ? 130 : 143);
  });
}

child.on('error', (err) => {
  console.error(`[spawn] 启动失败: ${err.message}`);
  if (heartbeat) clearInterval(heartbeat);
  writeStatus(1, { error: err.message });
  process.exit(1);
});
child.on('close', (code) => {
  if (timer) clearTimeout(timer);
  if (heartbeat) clearInterval(heartbeat);
  if (timedOut) process.exit(124);
  const finalCode = typeof code === 'number' ? code : 1;
  writeStatus(finalCode);
  process.exit(finalCode);
});
