#!/usr/bin/env node
'use strict';
// 压缩无头对比验证的独立入口（npm run verify:compression）。
// 以子进程执行一次完整构建（构建内联验证复用 scripts/lib/compression-verify.js，与构建期同一实现），
// 构建结束后读取验证结果 JSON 判定退出码：
//   passed  → 0；
//   failed  → 1（即使构建已按 verify.fallbackOnFailure 回退未压缩产物，显式门禁仍报失败供人工介入）；
//   skipped → 0 + 提示（Chrome 缺失等环境原因不阻断；构建退出码非零时仍按原码退出）。
// 选项：
//   --out <dir>      构建输出目录（缺省 dist/，语义同 node scripts/build.js --out）
//   --chrome <path>  显式 Chrome 路径（注入子进程 CHROME_PATH）
//   --keep-baseline  保留 .cache/compression-baseline 基线快照供人工逐字节比对
//   --json           额外打印完整验证结果 JSON
// 其余参数原样透传给 scripts/build.js（如 --features-override / --compression-override）。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { summarizeFailures } = require('./lib/compression-verify');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { outDir: '', chrome: '', keepBaseline: false, json: false, passthrough: [] };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1]) out.outDir = argv[++i];
    else if (arg === '--chrome' && argv[i + 1]) out.chrome = argv[++i];
    else if (arg === '--keep-baseline') out.keepBaseline = true;
    else if (arg === '--json') out.json = true;
    else out.passthrough.push(arg);
  }
  return out;
}

function readReport(reportPath) {
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  } catch (err) {
    return null;
  }
}

function main() {
  const opts = parseArgs(process.argv);
  const reportPath = path.join(ROOT, '.cache', 'compression-verify', 'cli-last.json');
  try { fs.rmSync(reportPath, { force: true }); } catch (err) { /* 旧结果不可删不影响本次判定 */ }
  const env = Object.assign({}, process.env, {
    SYNAPSE_COMPRESSION_VERIFY: 'on',
    SYNAPSE_COMPRESSION_VERIFY_REPORT: reportPath
  });
  if (opts.chrome) env.CHROME_PATH = opts.chrome;
  if (opts.keepBaseline) env.SYNAPSE_COMPRESSION_BASELINE_KEEP = '1';
  const args = [path.join(ROOT, 'scripts', 'build.js')];
  if (opts.outDir) args.push('--out', opts.outDir);
  for (const extra of opts.passthrough) args.push(extra);

  console.log('[verify:compression] 执行构建并内联验证（无 Chrome 时自动跳过）...');
  const result = spawnSync(process.execPath, args, { cwd: ROOT, env, stdio: 'inherit', timeout: 900000 });
  const report = readReport(reportPath);
  if (opts.json && report) console.log(JSON.stringify(report, null, 2));

  if (result.error) {
    console.error('[verify:compression] 构建进程启动失败：' + result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('[verify:compression] 构建退出码 ' + result.status
      + (report ? '；验证状态 ' + report.status : '；未产出验证结果'));
    process.exit(result.status === null ? 1 : result.status);
  }
  if (!report) {
    console.error('[verify:compression] 未找到验证结果（' + reportPath + '）；请确认 compression.verify.headless=true 且增强步骤已执行');
    process.exit(1);
  }
  if (report.status === 'passed') {
    const ports = (report.servers || []).map((server) => server.port).join('/');
    console.log('[verify:compression] PASS：' + (report.pages || []).length + ' 页断言通过（'
      + report.durationsMs + 'ms，端口 ' + ports + '，释放 ' + (report.portsReleased === false ? '异常' : '正常') + '）');
    process.exit(0);
  }
  if (report.status === 'skipped') {
    console.warn('[verify:compression] 跳过：' + (report.reason || '未知原因') + '（不阻断门禁）');
    process.exit(0);
  }
  console.error('[verify:compression] FAIL：' + summarizeFailures(report.failures)
    + '；回退=' + JSON.stringify(report.fallback || null));
  process.exit(1);
}

main();
