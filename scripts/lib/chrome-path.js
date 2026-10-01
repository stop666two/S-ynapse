'use strict';

// Chrome 可执行文件共享探测（a11y/perf/mermaid 渲染共用）：
// 优先级 explicitPath > CHROME_PATH > internals.chrome.path > 平台默认安装路径 > PATH。
// deps 可注入（env/platform/exists/which/internalsChromePath）以便单测不依赖真实文件系统。

const fs = require('fs');
const path = require('path');
const { loadInternals } = require('./internals');

const WINDOWS_CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];
const MAC_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const POSIX_CHROME_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

// 直接扫描 PATH 目录（Windows 叠加 PATHEXT），不启动子进程：
// 既避免 where/which 在负载下超时抖动，也不依赖系统自带工具。
function defaultWhich(name) {
  const isWindows = process.platform === 'win32';
  const dirs = String(process.env.PATH || '').split(isWindows ? ';' : ':').filter(Boolean);
  const suffixes = isWindows
    ? String(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  for (const dir of dirs) {
    for (const suffix of suffixes) {
      const candidate = path.join(dir, name + suffix);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (!isWindows) fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch (err) { /* 候选不可用则继续扫描 */ }
    }
  }
  return null;
}

function internalsChromePath() {
  try {
    return loadInternals().chrome.path || '';
  } catch (err) {
    return '';
  }
}

function resolveChromePath(explicitPath, deps) {
  const d = Object.assign({
    env: process.env,
    platform: process.platform,
    exists: (p) => { try { return fs.existsSync(p); } catch (err) { return false; } },
    which: defaultWhich
  }, deps || {});
  const candidates = [];
  if (explicitPath) candidates.push(explicitPath);
  if (d.env && d.env.CHROME_PATH) candidates.push(d.env.CHROME_PATH);
  const internal = d.internalsChromePath !== undefined ? d.internalsChromePath : internalsChromePath();
  if (internal) candidates.push(internal);
  if (d.platform === 'win32') {
    for (const p of WINDOWS_CHROME_PATHS) candidates.push(p);
    if (d.env && d.env.LOCALAPPDATA) candidates.push(path.join(d.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  } else if (d.platform === 'darwin') {
    candidates.push(MAC_CHROME_PATH);
  }
  for (const candidate of candidates) {
    if (candidate && d.exists(candidate)) return candidate;
  }
  if (d.platform !== 'win32') {
    for (const name of POSIX_CHROME_COMMANDS) {
      const hit = d.which(name);
      if (hit) return hit;
    }
  }
  return null;
}

module.exports = { resolveChromePath, defaultWhich, WINDOWS_CHROME_PATHS, MAC_CHROME_PATH, POSIX_CHROME_COMMANDS };
