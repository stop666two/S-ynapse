#!/usr/bin/env node
'use strict';

// 工程内部参数守卫（verify:internals）：
//   1. .nvmrc 存在且与 internals.ci.nodeVersion 一致（CI 用 node-version-file 读它）；
//   2. workers/wrangler.toml 的 [assets] directory 解析后与 internals.deploy.workerAssetsDir 一致；
//   3. CI 兼容任务（deploy.yml compat-node20）的 node-version 与 internals.ci.compatNodeVersion 一致；
//      派生副本（SYNAPSE_DERIVED_COPY=1）自带 CI 配置（.github 不随主仓同步），跳过本项；
//   4. 关键写死形态已消失（抽样正则，防止回退成双源字面量）。
// 退出码：全部通过 → 0；任一失败 → 1（打印逐条原因）。

const fs = require('fs');
const path = require('path');
const { loadInternals } = require('./lib/internals');

const ROOT = path.resolve(__dirname, '..');
const DERIVED_COPY = process.env.SYNAPSE_DERIVED_COPY === '1';
const failures = [];

function read(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  } catch (err) {
    failures.push(rel + '：无法读取（' + err.message + '）');
    return '';
  }
}

function normalizeVersion(text) {
  return String(text).trim().replace(/^v/i, '');
}

function checkNvmrc(internals) {
  const file = path.join(ROOT, '.nvmrc');
  if (!fs.existsSync(file)) {
    failures.push('.nvmrc：文件缺失（CI 依赖 node-version-file 读取）');
    return;
  }
  const actual = normalizeVersion(fs.readFileSync(file, 'utf-8'));
  const expected = normalizeVersion(internals.ci.nodeVersion);
  if (actual !== expected) {
    failures.push('.nvmrc：内容 "' + actual + '" 与 internals.ci.nodeVersion "' + expected + '" 不一致');
  }
}

// 解析 wrangler.toml 的 [assets] 段 directory（相对 wrangler.toml 所在目录解析），
// 与 internals.deploy.workerAssetsDir（相对仓库根）比对为同一实际目录。
function readWranglerAssetsDir() {
  const text = read(path.join('workers', 'wrangler.toml'));
  const lines = text.split(/\r?\n/);
  let inAssets = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (/^\[[^\]]+\]$/.test(line)) {
      inAssets = line === '[assets]';
      continue;
    }
    if (!inAssets) continue;
    const match = /^directory\s*=\s*["']([^"']+)["']/.exec(line);
    if (match) return match[1];
  }
  return '';
}

function checkWranglerAssets(internals) {
  const raw = readWranglerAssetsDir();
  if (!raw) {
    failures.push('workers/wrangler.toml：[assets] directory 缺失或不可解析');
    return;
  }
  const actual = path.resolve(ROOT, 'workers', raw);
  const expected = path.resolve(ROOT, internals.deploy.workerAssetsDir);
  if (actual !== expected) {
    failures.push('workers/wrangler.toml：[assets] directory "' + raw + '"（解析为 ' + actual + '）与 internals.deploy.workerAssetsDir "' + internals.deploy.workerAssetsDir + '"（' + expected + '）不一致；部署前必须对齐构建输出目录');
  }
}

function checkDeployWorkflow(internals) {
  const deployYml = read(path.join('.github', 'workflows', 'deploy.yml'));
  const compatToken = 'node-version: ' + internals.ci.compatNodeVersion;
  const compatPattern = new RegExp('node-version:\\s*[\'"]?' + internals.ci.compatNodeVersion.replace(/\./g, '\\.') + '[\'"]?');
  if (!compatPattern.test(deployYml)) {
    failures.push('deploy.yml：compat 任务未声明 node-version "' + internals.ci.compatNodeVersion + '"（须与 internals.ci.compatNodeVersion 一致）');
  }
  if (compatToken && !deployYml.includes('node-version-file: .nvmrc')) {
    failures.push('deploy.yml：主任务应使用 node-version-file: .nvmrc（由 .nvmrc/internals 单源控制版本）');
  }
  if (!deployYml.includes('node scripts/ci-checks.js')) {
    failures.push('deploy.yml：未调用聚合检查器 scripts/ci-checks.js');
  }
  if (!deployYml.includes('ci-report')) {
    failures.push('deploy.yml：未上传 ci-report 工件');
  }
}

// 抽样正则：这些写死形态必须已迁移到 internals/features/site 单源，禁止回退。
const LITERAL_GUARDS = [
  { file: 'scripts/a11y-audit.js', pattern: /Program Files[\\/]Google[\\/]Chrome/, label: 'Chrome 安装路径' },
  { file: 'scripts/perf-audit.js', pattern: /Program Files[\\/]Google[\\/]Chrome/, label: 'Chrome 安装路径' },
  { file: 'scripts/build/serve.js', pattern: /\|\|\s*3000\b/, label: 'serve 默认端口字面量' },
  { file: 'js/core/runtime.js', pattern: /\|\|\s*3000\b/, label: '配置超时兜底字面量' },
  { file: 'js/core/soft-nav.js', pattern: /300000/, label: '软导航缓存 TTL 字面量' },
  { file: 'js/core/soft-nav.js', pattern: /CACHE_MAX_FALLBACK\s*=\s*16/, label: '软导航缓存容量字面量' },
  { file: 'scripts/export.js', pattern: /'s-ynapse-backup'/, label: '导出前缀字面量' },
  { file: 'scripts/build/minify.js', pattern: /!==\s*'sw\.js'/, label: 'SW 固定文件名字面量' },
  { file: 'scripts/build/minify.js', pattern: /icon-\(192\|512\)/, label: 'PWA 图标名正则字面量' },
  { file: 'scripts/lib/pwa-sw.js', pattern: /'s-ynapse'/, label: 'SW 缓存基名字面量' },
  { file: 'scripts/release-prune.js', pattern: /RELEASE_LIST_LIMIT\s*=\s*200/, label: 'Release 列表上限字面量' },
  { file: 'scripts/dist-hash-guard.js', pattern: /PREVIEW_LIMIT\s*=\s*20/, label: 'diff 预览上限字面量' },
  { file: 'scripts/build/report.js', pattern: /#(?:16a34a|d97706)/i, label: '报告状态色字面量' },
  { file: 'scripts/build/report.js', pattern: /slice\(0,\s*10\)/, label: '报告 topN 字面量' },
  { file: 'scripts/build/helpers.js', pattern: /#fff\b/i, label: 'favicon 兜底颜色字面量' },
  { file: 'package.json', pattern: /--project-name=s-ynapse/, label: 'Pages 项目名字面量' },
  { file: 'package.json', pattern: /--port\s+3000/, label: 'serve 端口字面量' },
  { file: 'scripts/ci-checks.js', pattern: /node-version/, label: 'CI Node 版本字面量（应由 .nvmrc/internals 单源控制）' }
];

function checkLiteralGuards() {
  for (const guard of LITERAL_GUARDS) {
    const text = read(guard.file);
    if (guard.pattern.test(text)) {
      failures.push(guard.file + '：仍存在' + guard.label + '（' + guard.pattern + '），应改为 internals 单源');
    }
  }
}

function main() {
  let internals;
  try {
    internals = loadInternals();
  } catch (err) {
    console.error('[verify:internals] ' + err.message);
    process.exit(1);
  }
  checkNvmrc(internals);
  checkWranglerAssets(internals);
  if (DERIVED_COPY) {
    console.log('[verify:internals] 派生副本：跳过 deploy.yml 一致性检查（.github 不随主仓同步）');
  } else {
    checkDeployWorkflow(internals);
  }
  checkLiteralGuards();

  if (failures.length) {
    console.error('[verify:internals] FAIL：' + failures.length + ' 项：');
    for (const item of failures) console.error('  - ' + item);
    process.exit(1);
  }
  console.log('[verify:internals] PASS：.nvmrc / wrangler assets / CI 版本 / 关键写死形态 均与 internals 一致');
}

if (require.main === module) main();

module.exports = { checkNvmrc, checkWranglerAssets, checkDeployWorkflow, checkLiteralGuards, LITERAL_GUARDS };
