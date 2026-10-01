'use strict';

// 进程守卫巡检：扫描仓库内可能长期占用或派出子进程的入口脚本，
// 要求其显式载入进程守卫（process-guard.js）或声明豁免理由；
// 同时校验守卫与受控运行器本身存在，防止“无兜底脚本”回归。

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join('scripts', 'lib', 'process-guard.js');
const SPAWNER = path.join('scripts', 'spawn.js');

const RISK = /createServer\s*\(|spawn\s*\(|execFileSync\s*\(|puppeteer|setInterval\s*\(|--serve|--watch|waitForTimeout/;
const GUARD_USE = /process-guard/;
const EXEMPT = /process-guard:\s*exempt\s+\S+/;

const ENTRIES = [
  'scripts/build.js',
  'scripts/build/serve.js',
  'scripts/run-tests.js',
  'scripts/a11y-audit.js',
  'scripts/perf-audit.js',
  'scripts/security-verify.js',
  'scripts/generate-og.js',
  'scripts/ci-checks.js',
  'scripts/release-mark.js',
  'scripts/export.js',
  'scripts/import.js',
];

function check() {
  const failures = [];
  if (!fs.existsSync(path.join(ROOT, GUARD))) failures.push(`缺少进程守卫模块: ${GUARD}`);
  if (!fs.existsSync(path.join(ROOT, SPAWNER))) failures.push(`缺少受控运行器: ${SPAWNER}`);
  for (const rel of ENTRIES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { failures.push(`入口脚本不存在: ${rel}`); continue; }
    const text = fs.readFileSync(abs, 'utf8');
    if (!RISK.test(text)) continue;
    if (GUARD_USE.test(text) || EXEMPT.test(text)) continue;
    failures.push(`高风险入口未接入进程守卫: ${rel}（在文件顶部 require scripts/lib/process-guard.js，或标注 “process-guard: exempt <理由>”）`);
  }
  return failures;
}

function main() {
  const failures = check();
  if (failures.length) {
    console.error('[check-process-guards] FAIL');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`[check-process-guards] PASS：${ENTRIES.length} 个入口与守卫/运行器均已就位`);
}

if (require.main === module) main();
module.exports = { check, ENTRIES };
