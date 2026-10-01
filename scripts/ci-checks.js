#!/usr/bin/env node
'use strict';
require('./lib/process-guard.js');

// CI 聚合检查器（deploy.yml / nightly.yml 单步调用）：
//   顺序执行既有质量门禁（lint / typecheck / 单元与属性测试 / 恶意场景 / 配置家族 /
//   安全验证 / 压缩验证 / 构建 / 无障碍审计 / SBOM / 依赖审计），不提前中断；
//   每项捕获退出码、耗时与输出摘要，写入 artifactsDir/ci-checks.{json,txt}；
//   末尾任一失败则整体 exit 1，否则 0。Chrome 依赖项在未探测到浏览器时跳过并标注。
//   internals.ci.aggregate=false 时退化为 fail-fast（首个失败即停）。

const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const { loadInternals } = require('./lib/internals');
const { resolveChromePath } = require('./lib/chrome-path');

const ROOT = path.resolve(__dirname, '..');
const internals = loadInternals();
const ARGV = process.argv.slice(2);
function argList(flag) {
  const index = ARGV.indexOf(flag);
  if (index === -1 || index + 1 >= ARGV.length) return null;
  return ARGV[index + 1].split(',').map((value) => value.trim()).filter(Boolean);
}
const ONLY = argList('--only');
const SKIP = argList('--skip') || [];
const AGGREGATE = ARGV.includes('--fail-fast') ? false : internals.ci.aggregate;
const CHECK_TIMEOUT_MS = Number(internals.ci.checkTimeoutMs) > 0 ? Number(internals.ci.checkTimeoutMs) : 600000;
const CHECK_TIMEOUTS = internals.ci.checkTimeouts && typeof internals.ci.checkTimeouts === 'object' ? internals.ci.checkTimeouts : {};
const ARTIFACTS_DIR = path.resolve(ROOT, internals.paths.artifactsDir);
const OUTPUT_TAIL_LINES = 40;
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// 超时后清理整棵子进程树：spawnSync 只杀直接子进程，npm 脚本的孙进程（浏览器/服务器）会残留。
function killTree(pid) {
  if (!pid || pid <= 0) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (groupErr) {
    try { process.kill(pid, 'SIGKILL'); } catch (selfErr) { /* 进程已退出 */ }
  }
}

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
  { name: 'verify:process-guards', args: ['run', 'verify:process-guards'] },
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

function resolveTimeout(name) {
  const override = Number(CHECK_TIMEOUTS[name]);
  return override > 0 ? override : CHECK_TIMEOUT_MS;
}

function runCheck(check) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timeoutMs = resolveTimeout(check.name);
    const child = spawn(NPM, check.args, {
      cwd: ROOT,
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env
    });
    const MAX_CAPTURE = 32 * 1024 * 1024;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const append = (target, chunk) => (target.length >= MAX_CAPTURE ? target : target + chunk.toString('utf-8'));
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    // 超时触发时子进程仍然存活，taskkill /T 才能枚举并清理整棵进程树。
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
      try { child.kill('SIGKILL'); } catch (err) { /* 进程已退出 */ }
    }, timeoutMs);
    // close 事件缺失兜底：超时后仍未关闭则强制结算，避免聚合器悬挂。
    const failsafe = setTimeout(() => finish(null, null), timeoutMs + 5000);
    function finish(code, signal) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(failsafe);
      const durationMs = Date.now() - started;
      if (timedOut) {
        console.error('[ci-checks] ' + check.name + ' 超时（' + timeoutMs + 'ms），已清理进程树');
      } else if (code !== 0) {
        console.error('[ci-checks] ' + check.name + ' 退出码 ' + code);
      }
      // 实时回显摘要（stdout 尾部 + stderr 尾部），完整输出保存在报告中。
      if (stdout.trim()) console.log(stdout.replace(/\s+$/, ''));
      if (stderr.trim()) console.error(stderr.replace(/\s+$/, ''));
      resolve({
        name: check.name,
        command: commandLine(check.args),
        status: !timedOut && code === 0 ? 'passed' : 'failed',
        exitCode: code,
        signal: signal || null,
        durationMs,
        timeoutMs,
        timedOut,
        advisory: check.advisory === true,
        summary: tail(stdout + (stderr ? '\n' + stderr : ''))
      });
    }
    child.on('error', (err) => {
      console.error('[ci-checks] ' + check.name + ' 启动失败：' + err.message);
      finish(null, null);
    });
    child.on('close', (code, signal) => finish(code, signal));
  });
}

function writeReport(report) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const jsonPath = path.join(ARTIFACTS_DIR, 'ci-checks.json');
  const txtPath = path.join(ARTIFACTS_DIR, 'ci-checks.txt');
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
  lines.push('超时: ' + (report.timeouts && report.timeouts.length ? report.timeouts.join(', ') : '无'));
  for (const item of report.checks) {
    lines.push('');
    lines.push('===== ' + item.name + ' (' + item.status + ', ' + item.durationMs + 'ms) =====');
    lines.push(item.summary || '（无输出）');
  }
  fs.writeFileSync(txtPath, lines.join('\n') + '\n', 'utf-8');
  console.log('[ci-checks] 报告已写入: ' + path.relative(ROOT, jsonPath) + ' / ' + path.relative(ROOT, txtPath));
}

function selectChecks() {
  if (ARGV.includes('--list')) {
    for (const check of CHECKS) {
      console.log((check.advisory ? '[advisory] ' : '') + check.name + ' → ' + commandLine(check.args)
        + (check.needsChrome ? '（需 Chrome）' : ''));
    }
    return null;
  }
  const unknown = (ONLY || []).filter((name) => !CHECKS.some((check) => check.name === name));
  if (unknown.length) {
    console.error('[ci-checks] --only 含未知检查名：' + unknown.join(', ') + '（用 --list 查看可用项）');
    process.exit(2);
  }
  return CHECKS.filter((check) => (!ONLY || ONLY.includes(check.name)) && !SKIP.includes(check.name));
}

// 将聚合结论写入提交状态（context=ci/aggregate），供 ci-skip 预检读取告警数；
// 缺少 GITHUB_TOKEN/GITHUB_REPOSITORY/GITHUB_SHA（本地运行）时静默跳过，写入失败不影响门禁。
async function postCommitStatus(report) {
  const token = process.env.GITHUB_TOKEN || '';
  const repo = process.env.GITHUB_REPOSITORY || '';
  const sha = process.env.GITHUB_SHA || '';
  if (!token || !repo || !sha) return;
  const warnings = report.advisoryFailed ? report.advisoryFailed.length : 0;
  const timeouts = report.timeouts ? report.timeouts.length : 0;
  const description = 'errors:' + report.failed.length + ' warnings:' + warnings + ' timeouts:' + timeouts;
  try {
    const response = await fetch('https://api.github.com/repos/' + repo + '/statuses/' + sha, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: 'Bearer ' + token,
        'content-type': 'application/json',
        'user-agent': 's-ynapse-ci-checks',
        'x-github-api-version': '2022-11-28'
      },
      body: JSON.stringify({
        state: report.failed.length ? 'failure' : 'success',
        context: 'ci/aggregate',
        description: description.slice(0, 140)
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) console.warn('[ci-checks] 写入提交状态失败：HTTP ' + response.status);
  } catch (err) {
    console.warn('[ci-checks] 写入提交状态失败（忽略）：' + err.message);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = [];
  const failed = [];
  const advisoryFailed = [];
  const skipped = [];
  const selected = selectChecks();
  if (!selected) return;
  for (const check of selected) {
    if (check.needsChrome && !CHROME_AVAILABLE) {
      const reason = '未检测到 Chrome（CHROME_PATH/internals.chrome.path/平台默认均未命中）';
      console.log('[ci-checks] SKIP ' + check.name + '：' + reason);
      results.push({ name: check.name, command: commandLine(check.args), status: 'skipped', exitCode: null, durationMs: 0, skipReason: reason, summary: reason });
      skipped.push(check.name);
      continue;
    }
    console.log('\n[ci-checks] ===== ' + check.name + ' =====');
    const result = await runCheck(check);
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
  const timeouts = results.filter((item) => item.timedOut).map((item) => item.name);
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    aggregate: AGGREGATE,
    chromeAvailable: CHROME_AVAILABLE,
    checks: results,
    failed,
    advisoryFailed,
    skipped,
    timeouts
  };
  writeReport(report);
  await postCommitStatus(report);
  if (failed.length) {
    console.error('[ci-checks] FAIL：' + failed.length + ' 项未通过 → ' + failed.join(', '));
    process.exit(1);
  }
  console.log('[ci-checks] PASS：' + results.filter((r) => r.status === 'passed').length + ' 项通过'
    + (advisoryFailed.length ? '，建议项未通过 ' + advisoryFailed.length + ' 项（' + advisoryFailed.join(', ') + '，不阻断）' : '')
    + (skipped.length ? '，' + skipped.length + ' 项跳过（' + skipped.join(', ') + '）' : ''));
}

main().catch((err) => {
  console.error('[ci-checks] 运行异常：' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
