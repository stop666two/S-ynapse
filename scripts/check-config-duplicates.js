#!/usr/bin/env node
'use strict';
// 配置重复键守卫（verify:config-dupes）：扫描 JSON5 配置中「同一对象内重复出现的键」。
//
// 动机：JSON5 对重复键不报错（后者生效、前者静默失效），重复定义会让配置看起来生效、
// 实际被覆盖，属构建期不可见的隐性错误；本守卫把这类重复暴露为可执行的失败信号。
//
// 用法：
//   node scripts/check-config-duplicates.js [目录...]
//   无参数时默认扫描仓库根 *.json5 与 real-site/*.json5（存在才扫）；
//   传入目录时逐个扫描该目录下的 *.json5（非递归，与配置文件平铺布局一致）。
//
// 豁免：scripts/config-duplicates-allowlist.json 按「文件 + 键」登记（理由必填），
// 命中项在输出中显式列出，不做静默放过。
// 输出：文件:重复行:键名（含首次位置）；存在未豁免重复键时退出码 1，否则 0。

const fs = require('fs');
const path = require('path');
const { findDuplicateKeys, filterAllowlisted } = require('./lib/config-duplicates');

const ROOT = path.resolve(__dirname, '..');
const ALLOWLIST_FILE = path.join(__dirname, 'config-duplicates-allowlist.json');

function loadAllowlist(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    console.error('[verify:config-dupes] 无法读取豁免名单 ' + path.relative(ROOT, file).replace(/\\/g, '/') + '：' + error.message);
    process.exit(1);
  }
  return Array.isArray(parsed.allow) ? parsed.allow : [];
}

// 目标文件：默认 [仓库根, 仓库根/real-site]，否则为显式目录；每个目录只取直属 *.json5。
function resolveTargets(args) {
  const dirs = args.length > 0 ? args : [ROOT, path.join(ROOT, 'real-site')];
  const files = [];
  for (const dir of dirs) {
    const abs = path.resolve(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json5')) files.push(path.join(abs, entry.name));
    }
  }
  return files.sort();
}

function toRel(file) {
  const rel = path.relative(ROOT, file);
  if (rel === '' || rel.startsWith('..')) return file.replace(/\\/g, '/');
  return rel.replace(/\\/g, '/');
}

function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const allow = loadAllowlist(ALLOWLIST_FILE);
  const files = resolveTargets(args);
  const keptAll = [];
  const suppressedAll = [];
  let keyCount = 0;

  for (const file of files) {
    const rel = toRel(file);
    let text;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch (error) {
      console.error('[verify:config-dupes] 读取失败 ' + rel + '：' + error.message);
      process.exitCode = 1;
      continue;
    }
    const result = findDuplicateKeys(text);
    keyCount += result.keyCount;
    if (result.findings.length === 0) continue;
    const split = filterAllowlisted(result.findings, allow, rel);
    for (const finding of split.kept) keptAll.push({ file: rel, finding });
    for (const finding of split.suppressed) suppressedAll.push({ file: rel, finding });
  }

  console.log('[verify:config-dupes] 扫描 ' + files.length + ' 个 JSON5 文件 / ' + keyCount + ' 个对象键');
  for (const item of suppressedAll) {
    console.log('  [豁免] ' + item.file + ':' + item.finding.duplicateLine + ': ' + item.finding.key +
      '（首次 ' + item.file + ':' + item.finding.firstLine + '；理由：' + item.finding.reason + '）');
  }
  if (keptAll.length > 0) {
    console.error('[verify:config-dupes] 发现 ' + keptAll.length + ' 处未豁免重复键：');
    for (const item of keptAll) {
      console.error('  - ' + item.file + ':' + item.finding.duplicateLine + ': ' + item.finding.key +
        '（首次 ' + item.file + ':' + item.finding.firstLine + '）');
    }
    console.error('[verify:config-dupes] FAIL：同一对象内重复键会让较早定义静默失效；请删除较早定义，或在 scripts/config-duplicates-allowlist.json 登记理由。');
    if (process.exitCode !== 1) process.exitCode = 1;
    return;
  }
  console.log('[verify:config-dupes] PASS：零未豁免重复键' +
    (suppressedAll.length > 0 ? '（' + suppressedAll.length + ' 处已登记豁免）' : ''));
}

main();
