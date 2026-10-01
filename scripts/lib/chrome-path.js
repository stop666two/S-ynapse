'use strict';

// Chrome 可执行文件共享探测（a11y/perf/mermaid 渲染共用）：
// 优先级 explicitPath > CHROME_PATH > internals.chrome.path > 平台默认安装路径 > PATH。
// deps 可注入（env/platform/exists/which/internalsChromePath）以便单测不依赖真实文件系统。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadInternals } = require('./internals');

const WINDOWS_CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];
const MAC_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const POSIX_CHROME_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

function defaultWhich(name) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const res = spawnSync(cmd, [name], { encoding: 'utf-8', timeout: 5000 });
    if (res.status === 0 && res.stdout) {
      const first = res.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
      if (first) return first;
    }
  } catch (err) { /* 探测失败按未找到处理 */ }
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
