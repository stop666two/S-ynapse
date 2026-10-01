'use strict';

// 进程守卫：为可能挂起的脚本提供兜底——绝对生命周期上限、父进程死亡检测、信号处理、
// 退出时清理整棵进程树。仅在设置了 SYNAPSE_GUARD=1 / SYNAPSE_MAX_MS / SYNAPSE_PARENT_PID
// 时生效（由 scripts/spawn.js 或自动化调用方注入），人工直接运行脚本不受影响。

const { execFileSync } = require('node:child_process');

let installed = false;
let finishing = false;
let cleaned = false;
const timers = [];

function readNum(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function killTree() {
  if (cleaned) return;
  cleaned = true;
  try {
    if (process.platform === 'win32') {
      sweepWindowsDescendants();
    } else {
      try { process.kill(-process.pid, 'SIGKILL'); } catch { /* 无独立进程组时忽略 */ }
    }
  } catch { /* 清理失败不再抛错 */ }
}

function sweepWindowsDescendants() {
  let pids = [];
  try {
    const out = execFileSync('wmic', ['process', 'where', `(ParentProcessId=${process.pid})`, 'get', 'ProcessId', '/format:value'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500, encoding: 'utf8' });
    pids = out.split(/\r?\n/).map((line) => Number((line.match(/ProcessId=(\d+)/) || [])[1])).filter((n) => Number.isInteger(n) && n > 0);
  } catch { /* wmic 不可用时退化为尽力而为 */ }
  for (const pid of pids) {
    try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 1500 }); } catch { /* 单个失败不影响其余 */ }
  }
}

function finish(code) {
  if (finishing) return;
  finishing = true;
  for (const t of timers) { clearTimeout(t); clearInterval(t); }
  killTree();
  const finalCode = typeof code === 'number' ? code : (process.exitCode || 0);
  process.exitCode = finalCode;
  process.exit(finalCode);
}

function install() {
  if (installed) return api;
  installed = true;
  const active = process.env.SYNAPSE_GUARD === '1'
    || (process.env.SYNAPSE_MAX_MS !== undefined && process.env.SYNAPSE_MAX_MS !== '')
    || (process.env.SYNAPSE_PARENT_PID !== undefined && process.env.SYNAPSE_PARENT_PID !== '');
  if (!active) return api;
  const maxMs = readNum('SYNAPSE_MAX_MS', 15 * 60 * 1000);
  const parentPid = readNum('SYNAPSE_PARENT_PID', 0);
  if (maxMs > 0) {
    const t = setTimeout(() => {
      console.error(`[process-guard] 超过最大生命周期 ${maxMs}ms，强制清理退出`);
      finish(87);
    }, maxMs);
    if (typeof t.unref === 'function') t.unref();
    timers.push(t);
  }
  if (parentPid > 0 && parentPid !== process.pid) {
    const t = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch {
        console.error('[process-guard] 父进程已退出，随之清理退出');
        finish(86);
      }
    }, 2000);
    if (typeof t.unref === 'function') t.unref();
    timers.push(t);
  }
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
      console.error(`[process-guard] 收到 ${sig}，清理退出`);
      finish(sig === 'SIGINT' ? 130 : 143);
    });
  }
  return api;
}

const api = {
  install,
  finish,
  killTree,
  done(code) { finish(code); },
  get installed() { return installed; },
};

module.exports = install();
