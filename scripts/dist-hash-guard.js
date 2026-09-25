#!/usr/bin/env node
'use strict';

// dist 产物哈希护栏 CLI（build.js 机械拆分前后的产物等价验证）：
//   node scripts/dist-hash-guard.js snapshot <dir> <manifest.json>  生成基准清单
//   node scripts/dist-hash-guard.js diff <dir> <manifest.json>     比较现状与基准
// 退出码：0 = 等价；1 = 存在差异；2 = 参数/文件错误（中文报错）。
const fs = require('node:fs');
const path = require('node:path');
const { hashDist, diffManifests, DEFAULT_IGNORES } = require('./lib/dist-hash');

// 差异列表最多打印条数，超出部分仅显示省略提示
const PREVIEW_LIMIT = 20;

const USAGE_SNAPSHOT = 'node scripts/dist-hash-guard.js snapshot <dir> <manifest.json>';
const USAGE_DIFF = 'node scripts/dist-hash-guard.js diff <dir> <manifest.json>';

function fail(message) {
  console.error('错误：' + message);
  process.exitCode = 2;
}

function printUsage() {
  console.error('用法：\n  ' + USAGE_SNAPSHOT + '\n  ' + USAGE_DIFF);
}

function isDirectory(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

function printPreview(label, items) {
  if (items.length === 0) return;
  console.log(label + '（' + items.length + '）：');
  for (const item of items.slice(0, PREVIEW_LIMIT)) {
    console.log('  ' + item);
  }
  if (items.length > PREVIEW_LIMIT) {
    console.log('  …（其余 ' + (items.length - PREVIEW_LIMIT) + ' 条省略）');
  }
}

function cmdSnapshot(dir, manifestPath) {
  let result;
  try {
    result = hashDist(dir, DEFAULT_IGNORES);
  } catch (err) {
    fail('产物读取失败：' + dir + '（' + err.message + '）');
    return;
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    root: path.resolve(dir),
    total: result.total,
    files: result.files
  };
  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  } catch (err) {
    fail('清单写入失败：' + manifestPath + '（' + err.message + '）');
    return;
  }
  console.log('已生成清单：' + manifestPath + '（共 ' + result.total + ' 个文件；忽略：' + DEFAULT_IGNORES.join('、') + '）');
}

function cmdDiff(dir, manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    fail('清单解析失败：' + manifestPath + '（' + err.message + '）');
    return;
  }
  let current;
  try {
    current = hashDist(dir, DEFAULT_IGNORES);
  } catch (err) {
    fail('产物读取失败：' + dir + '（' + err.message + '）');
    return;
  }
  let diff;
  try {
    diff = diffManifests(manifest, current);
  } catch (err) {
    fail(err.message);
    return;
  }
  const totalDiff = diff.added.length + diff.removed.length + diff.changed.length;
  if (totalDiff === 0) {
    console.log('等价：产物与基准清单一致（共 ' + current.total + ' 个文件）');
    return;
  }
  console.log('存在差异：新增 ' + diff.added.length + ' / 删除 ' + diff.removed.length + ' / 变更 ' + diff.changed.length);
  printPreview('[新增]', diff.added);
  printPreview('[删除]', diff.removed);
  printPreview('[变更]', diff.changed);
  process.exitCode = 1;
}

function main(argv) {
  const command = argv[0];
  const dir = argv[1];
  const manifestPath = argv[2];
  if (command !== 'snapshot' && command !== 'diff') {
    fail('未知命令：' + (command || '(空)') + '；支持 snapshot / diff');
    printUsage();
    return;
  }
  if (!dir || !manifestPath) {
    fail('缺少参数');
    printUsage();
    return;
  }
  if (!isDirectory(dir)) {
    fail('目录不存在或不是目录：' + dir);
    return;
  }
  if (command === 'snapshot') {
    cmdSnapshot(dir, manifestPath);
    return;
  }
  if (!fs.existsSync(manifestPath)) {
    fail('清单文件不存在：' + manifestPath);
    return;
  }
  cmdDiff(dir, manifestPath);
}

if (require.main === module) {
  main(process.argv.slice(2));
}
