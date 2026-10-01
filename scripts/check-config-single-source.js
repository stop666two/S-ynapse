#!/usr/bin/env node
'use strict';

// 配置单一事实源守卫（verify:config-single-source）：
//   R1 回退字面量绑定：scripts/config-fallback-bindings.json 中每条 bindings 的 snippet
//      必须仍存在于目标文件，且 literal 与注册表默认值严格相等（防 schema 默认漂移）；
//   R2 矩阵文档新鲜度：docs/config-switch-matrix.md 必须与 gen-config-switch-matrix 输出逐字一致；
//   R3 覆盖完整性：所有开关必须有「测试 marker / 既有引用 / 豁免理由」之一，缺失即 FAIL；
//      未知 marker、未知豁免键、已覆盖键的冗余豁免同样 FAIL。
// 退出码：0 = 全部通过；1 = 存在问题（逐条打印）。

const fs = require('fs');
const path = require('path');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { DEFAULT_TUNING } = require('./lib/tuning-defaults.js');
const { DEFAULT_CONFIG } = require('./lib/site-defaults.js');
const { DEFAULTS: INTERNAL_DEFAULTS } = require('./lib/internals-defaults.js');
const { ROOT, collectInventory, collectAllMarkers, collectRegistryPaths, buildMatrix } = require('./lib/config-switch-inventory.js');

const BINDINGS_FILE = path.join(ROOT, 'scripts', 'config-fallback-bindings.json');
const MATRIX_FILE = path.join(ROOT, 'docs', 'config-switch-matrix.md');

function resolveDefault(keyPath) {
  const segments = keyPath.split('.');
  const registry = segments[0];
  const rest = segments.slice(1);
  let root;
  if (registry === 'features') root = DEFAULT_FEATURES;
  else if (registry === 'tuning') root = DEFAULT_TUNING;
  else if (registry === 'internals') root = INTERNAL_DEFAULTS;
  else if (Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, registry)) root = DEFAULT_CONFIG[registry];
  else return { found: false };
  let current = root;
  for (const segment of rest) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function checkBindings(bindings, readFile) {
  const problems = [];
  for (const binding of bindings) {
    if (!binding || typeof binding.file !== 'string' || typeof binding.snippet !== 'string' || typeof binding.key !== 'string') {
      problems.push('绑定条目结构非法：' + JSON.stringify(binding));
      continue;
    }
    let text;
    try {
      text = readFile(binding.file);
    } catch (error) {
      problems.push('绑定文件不可读：' + binding.file + '（' + error.message + '）');
      continue;
    }
    if (!text.includes(binding.snippet)) {
      problems.push('绑定 snippet 失配（代码已重写）：' + binding.file + ' ⇐ ' + JSON.stringify(binding.snippet) + '；请同步 scripts/config-fallback-bindings.json');
      continue;
    }
    const resolved = resolveDefault(binding.key);
    if (!resolved.found) {
      problems.push('绑定键不在注册表：' + binding.key);
      continue;
    }
    if (!Object.is(resolved.value, binding.literal)) {
      problems.push('回退字面量漂移：' + binding.file + ' 的 ' + binding.key + ' 回退 ' +
        JSON.stringify(binding.literal) + '，注册表默认 ' + JSON.stringify(resolved.value));
    }
  }
  return problems;
}

function checkMatrix(inventory) {
  const problems = [];
  if (!fs.existsSync(MATRIX_FILE)) {
    problems.push('缺少 docs/config-switch-matrix.md；运行 node scripts/gen-config-switch-matrix.js');
    return problems;
  }
  const committed = fs.readFileSync(MATRIX_FILE, 'utf-8').replace(/\r\n/g, '\n').replace(/\s+$/, '');
  const generated = buildMatrix(inventory).replace(/\r\n/g, '\n').replace(/\s+$/, '');
  if (committed !== generated) {
    problems.push('矩阵文档过期：运行 node scripts/gen-config-switch-matrix.js 重新生成并提交');
  }
  return problems;
}

function checkCoverage(inventory) {
  const problems = [];
  const known = new Set(inventory.map((row) => row.keyPath));
  const registryPaths = collectRegistryPaths();
  for (const [key, hits] of collectAllMarkers()) {
    if (!known.has(key) && !registryPaths.has(key)) problems.push('测试 marker 指向未知开关：' + key + '（' + hits[0] + '）');
  }
  for (const row of inventory) {
    if (row.status === 'MISSING') {
      problems.push('开关缺失覆盖：' + row.keyPath + '（消费 ' + (row.consumers[0] || '未知') + '）需补测试 marker 或登记豁免');
    }
  }
  const exemptions = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'config-switch-exemptions.json'), 'utf-8'));
  for (const key of Object.keys(exemptions.keys || {})) {
    if (!known.has(key)) problems.push('豁免表含未知键：' + key);
  }
  for (const row of inventory) {
    if (row.exemptReason && row.status !== 'exempt') {
      problems.push('冗余豁免（已有 ' + row.status + ' 覆盖）：' + row.keyPath + '；请从 scripts/config-switch-exemptions.json 删除');
    }
  }
  return problems;
}

function collectProblems() {
  const inventory = collectInventory();
  const rawBindings = JSON.parse(fs.readFileSync(BINDINGS_FILE, 'utf-8'));
  const problems = [];
  problems.push(...checkBindings(rawBindings.bindings || [], (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')));
  problems.push(...checkMatrix(inventory));
  problems.push(...checkCoverage(inventory));
  return { inventory, problems };
}

function main() {
  const { inventory, problems } = collectProblems();
  const counts = { tested: 0, existing: 0, exempt: 0, MISSING: 0 };
  for (const row of inventory) counts[row.status] += 1;
  console.log('[verify:config-single-source] 开关 ' + inventory.length + '：已测 ' + counts.tested +
    ' / 既有引用 ' + counts.existing + ' / 豁免 ' + counts.exempt + ' / 缺失 ' + counts.MISSING);
  if (problems.length) {
    console.error('[verify:config-single-source] FAIL：' + problems.length + ' 项');
    for (const problem of problems) console.error('  - ' + problem);
    process.exit(1);
  }
  console.log('[verify:config-single-source] PASS：回退字面量零漂移，矩阵新鲜，开关零缺失');
}

if (require.main === module) main();

module.exports = { resolveDefault, checkBindings, checkMatrix, checkCoverage, collectProblems };
