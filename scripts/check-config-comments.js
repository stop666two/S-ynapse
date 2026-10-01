#!/usr/bin/env node
'use strict';

// 配置注释守卫（verify:config-comments）：检查 15 个 JSON5 配置（14 个站点配置 + internals.json5 工程内部参数）的注释覆盖。
//
// 规则见 scripts/lib/config-comment-audit.js 顶部说明，摘要：
//   - 每个文件须有文件头块注释（首个键之前 ≥2 行连续注释）；
//   - 每个对象键须有同行行尾注释、紧邻前置注释，或同缩进分组注释；
//   - 数组元素键按数据行处理（说明由数组宿主键注释承担），不参与逐键判定；
//   - ui-strings.json5 / tag-aliases.json5 采用模块/区块级口径，仅检查根级键。
//
// 输出违规清单（文件:行:键），零违规时退出码 0，否则 1。

const fs = require('fs');
const path = require('path');
const { auditConfigText, BLOCK_POLICY_FILES } = require('./lib/config-comment-audit');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILES = [
  'compression.json5', 'content-policy.json5', 'features.json5', 'footer.json5',
  'friends.json5', 'guard.json5', 'navigation.json5', 'security.json5', 'sidebar.json5',
  'site.json5', 'tag-aliases.json5', 'theme.json5', 'tuning.json5', 'ui-strings.json5',
  'internals.json5',
];

function readText(file) {
  let raw = fs.readFileSync(file, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return raw;
}

let fileCount = 0;
let keyCount = 0;
let violationCount = 0;
let missingFile = false;

for (const file of CONFIG_FILES) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    console.error(`[verify:config-comments] 缺少配置文件：${file}`);
    missingFile = true;
    continue;
  }
  const { violations, keyCount: keys } = auditConfigText(readText(abs), {
    blockPolicy: BLOCK_POLICY_FILES.includes(file),
  });
  fileCount++;
  keyCount += keys;
  for (const v of violations) {
    violationCount++;
    console.error(`  ${file}:${v.line}: ${v.key}（${v.reason}）`);
  }
}

if (missingFile || violationCount > 0) {
  console.error(
    `[verify:config-comments] 失败：${fileCount} 个文件 / ${keyCount} 个对象键，${violationCount} 处违规` +
    (missingFile ? '（存在缺失文件）' : '')
  );
  process.exitCode = 1;
} else {
  console.log(
    `[verify:config-comments] 通过：${fileCount} 个文件 / ${keyCount} 个对象键注释覆盖完整（0 违规）`
  );
}
