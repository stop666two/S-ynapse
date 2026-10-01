#!/usr/bin/env node
'use strict';

// CI 聚合检查器（deploy.yml / nightly.yml 单步调用）：
//   顺序执行既有质量门禁（lint / typecheck / 单元与属性测试 / 恶意场景 / 配置家族 /
//   安全验证 / 压缩验证 / 构建 / 无障碍审计 / SBOM / 依赖审计），不提前中断；
//   每项捕获退出码、耗时与输出摘要，写入 artifactsDir/ci-report.{json,txt}；
//   末尾任一失败则整体 exit 1，否则 0。Chrome 依赖项在未探测到浏览器时跳过并标注。
//   internals.ci.aggregate=false 时退化为 fail-fast（首个失败即停）。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadInternals } = require('./lib/internals');
const { resolveChromePath } = require('./lib/chrome-path');

const ROOT = path.resolve(__dirname, '..');
const internals = loadInternals();
const AGGREGATE = process.argv.includes('--fail-fast') ? false : internals.ci.aggregate;
const ARTIFACTS_DIR = path.resolve(ROOT, internals.paths.artifactsDir);
const OUTPUT_TAIL_LINES = 40;
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function hasChrome() {
  if (resolveChromePath('')) return true;
  const probe = process.platform === 'win32' ? 'where' : 'which';
  for (const name of ['google-chrome', 'chromium']) {
    const res = spawnSync(probe, [name], { stdio: 'ignore' });
    if (res.status === 0) return true;
  }
  return false;
}

const CHROME_AVAILABLE = hasChrome();

// 检查矩阵：名称、命令、环境要求与跳过条件。
const CHECKS = [
  { name: 'lint', args: ['run', 'lint'] },
  { name: 'typecheck', args: ['run', 'typecheck'] },
  { name: 'test', args: ['test'] },
  { name: 'test:coverage', args: ['run', 'test:coverage'] },
  { name: 'test:build', args: ['run', 'test:build'] },
  { name: 'test:fuzz', args: ['run', 'test:fuzz'] },
  { name: 'test:malicious', args: ['run', 'test:malicious'] },
  { name: 'verify:config', args: ['run', 'verify:config'] },
  { name: 'verify:config-refs', args: ['run', 'verify:config-refs'] },
  { name: 'verify:config-dupes', args: ['run', 'verify:config-dupes'] },
  { name: 'verify:config-comments', args: ['run', 'verify:config-comments'] },
  { name: 'verify:config-docs', args: ['run', 'verify:config-docs'] },
  { name: 'verify:internals', args: ['run', 'verify:internals'] },
  { name: 'verify:security', args: ['run', 'verify:security'] },
  // audit 为建议项（advisory）：既有 wrangler/miniflare 链漏洞需依赖升级专项处理
  // （按 CVSS 单独跟踪），结果写入报告但不阻断本聚合器。
  { name: 'audit', args: ['run', 'audit'], advisory: true },
  { name: 'test:smoke', args: ['run', 'test:smoke'], needsChrome: true },
  { name: 'test:cov-web', args: ['run', 'test:cov-web'], needsChrome: true },
  { name: 'verify:compression', args: ['run', 'verify:compression'], needsChrome: true },
  { name: 'build', args: ['run', 'build'] },
  // audit:a11y 为建议项（advisory）：既有页面存在 WCAG 2.2 target-size/对比度告警，
  // 结果写入报告但不阻断整体门禁（CI 此前也未将其列为阻断步骤）。
  { name: 'audit:a11y', args: ['run', 'audit:a11y'], needsChrome: true, advisory: true },
  { name: 'sbom', args: ['run', 'sbom'] }
];

function commandLine(args) {
  return 'npm ' + args.join(' ');
}

function tail(text) {
  const lines = String(text || '').replace(/\s+$/, '').split(/\r?\n/);
  return lines.slice(-OUTPUT_TAIL_LINES).join('\n');
}

function runCheck(check) {
  const started = Date.now();
  const result = spawnSync(NPM, check.args, {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
    env: process.env
  });
  const durationMs = Date.now() - started;
  const exitCode = result.status === null ? 1 : result.status;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (result.error) {
    console.error('[ci-checks] ' + check.name + ' 执行失败：' + result.error.message);
  }
  // 实时回显摘要（stdout 尾部 + stderr 尾部），完整输出保存在报告中。
  if (stdout.trim()) console.log(stdout.replace(/\s+$/, ''));
  if (stderr.trim()) console.error(stderr.replace(/\s+$/, ''));
  return {
    name: check.name,
    command: commandLine(check.args),
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    durationMs,
    advisory: check.advisory === true,
    summary: tail(stdout + (stderr ? '\n' + stderr : ''))
  };
}

function writeReport(report) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const jsonPath = path.join(ARTIFACTS_DIR, 'ci-report.json');
  const txtPath = path.join(ARTIFACTS_DIR, 'ci-report.txt');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  const lines = [
    'CI 聚合检查报告（node scripts/ci-checks.js）',
    '开始: ' + report.startedAt,
    '结束: ' + report.finishedAt,
    '模式: ' + (report.aggregate ? '跑完整套后统一失败' : 'fail-fast（首个失败即停）'),
    '',
    '状态     耗时      检查',
    '-------- ---------- ----------------------------------------'
  ];
  for (const item of report.checks) {
    lines.push(
      item.status.padEnd(8) + ' ' +
      String((item.durationMs / 1000).toFixed(1) + 's').padEnd(10) + ' ' +
      item.name + (item.status === 'skipped' ? '（' + (item.skipReason || '跳过') + '）' : '')
        + (item.advisory && item.status === 'failed' ? '（建议项，不阻断）' : '')
    );
  }
  lines.push('');
  lines.push('失败: ' + (report.failed.length ? report.failed.join(', ') : '无'));
  lines.push('建议项未通过: ' + (report.advisoryFailed && report.advisoryFailed.length ? report.advisoryFailed.join(', ') : '无'));
  lines.push('跳过: ' + (report.skipped.length ? report.skipped.join(', ') : '无'));
  for (const item of report.checks) {
    lines.push('');
    lines.push('===== ' + item.name + ' (' + item.status + ', ' + item.durationMs + 'ms) =====');
    lines.push(item.summary || '（无输出）');
  }
  fs.writeFileSync(txtPath, lines.join('\n') + '\n', 'utf-8');
  console.log('[ci-checks] 报告已写入: ' + path.relative(ROOT, jsonPath) + ' / ' + path.relative(ROOT, txtPath));
}

function main() {
  const startedAt = new Date().toISOString();
  const results = [];
  const failed = [];
  const advisoryFailed = [];
  const skipped = [];
  for (const check of CHECKS) {
    if (check.needsChrome && !CHROME_AVAILABLE) {
      const reason = '未检测到 Chrome（CHROME_PATH/internals.chrome.path/平台默认均未命中）';
      console.log('[ci-checks] SKIP ' + check.name + '：' + reason);
      results.push({ name: check.name, command: commandLine(check.args), status: 'skipped', exitCode: null, durationMs: 0, skipReason: reason, summary: reason });
      skipped.push(check.name);
      continue;
    }
    console.log('\n[ci-checks] ===== ' + check.name + ' =====');
    const result = runCheck(check);
    results.push(result);
    console.log('[ci-checks] ' + (result.status === 'passed' ? 'PASS' : 'FAIL') + ' ' + check.name + ' (' + (result.durationMs / 1000).toFixed(1) + 's)' + (check.advisory ? ' [advisory]' : ''));
    if (result.status === 'failed') {
      if (check.advisory) {
        advisoryFailed.push(check.name);
      } else {
        failed.push(check.name);
        if (!AGGREGATE) {
          console.error('[ci-checks] fail-fast 模式：' + check.name + ' 失败，停止后续检查');
          break;
        }
      }
    }
  }
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    aggregate: AGGREGATE,
    chromeAvailable: CHROME_AVAILABLE,
    checks: results,
    failed,
    advisoryFailed,
    skipped
  };
  writeReport(report);
  if (failed.length) {
    console.error('[ci-checks] FAIL：' + failed.length + ' 项未通过 → ' + failed.join(', '));
    process.exit(1);
  }
  console.log('[ci-checks] PASS：' + results.filter((r) => r.status === 'passed').length + ' 项通过'
    + (advisoryFailed.length ? '，建议项未通过 ' + advisoryFailed.length + ' 项（' + advisoryFailed.join(', ') + '，不阻断）' : '')
    + (skipped.length ? '，' + skipped.length + ' 项跳过（' + skipped.join(', ') + '）' : ''));
}

main();
