#!/usr/bin/env node
'use strict';
require('./lib/process-guard.js');

// 依赖漏洞门禁（npm run audit → CI 聚合的 audit 项）。
//
// 为什么单独成脚本，而不是直接 `npm audit`：
//   1) 阈值要对齐「有修复路径的高危」而非全部告警。仓库有 1 条 low（deepmerge 的
//      原型污染 advisory **无前向修复**，官方建议降级），直接用 `npm audit` 会长期红。
//   2) 网络不可达时（离线开发、镜像故障）`npm audit` 退出码 1 会把聚合门禁打成假红。
//      这里对「拿不到报告」fail-open（打印原因），对「拿到报告且有 high/critical」fail-closed。
//   3) 判定逻辑（evaluateAuditReport）是纯函数，可单测；不依赖 npm 的输出格式细节散落在 CI 里。
//
// 退出码：存在 high/critical → 1；否则 0（含网络不可用）。
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BLOCKING_SEVERITIES = ['critical', 'high'];

// 纯函数：输入 `npm audit --json` 的报告对象，返回 { blocking, counts, advisories, error }。
// - 报告缺失 / 解析失败 / 含 error 字段 → error 非空、blocking 为空（交由调用方 fail-open）。
// - 否则按严重度汇总，blocking 列出 critical/high 的包与 advisory 标题。
function evaluateAuditReport(report) {
  if (!report || typeof report !== 'object') {
    return { blocking: [], counts: null, advisories: [], error: '报告缺失或不是对象' };
  }
  if (report.error) {
    const detail = report.error.summary || report.error.detail || 'registry 请求失败';
    return { blocking: [], counts: null, advisories: [], error: String(detail) };
  }
  const counts = (report.metadata && report.metadata.vulnerabilities) || null;
  if (!counts || typeof counts !== 'object') {
    return { blocking: [], counts: null, advisories: [], error: '报告缺少 metadata.vulnerabilities' };
  }
  const blocking = [];
  const advisories = [];
  for (const [name, info] of Object.entries(report.vulnerabilities || {})) {
    const sev = String((info && info.severity) || '').toLowerCase();
    if (BLOCKING_SEVERITIES.indexOf(sev) === -1) continue;
    const via = (info && info.via) || [];
    const titles = via.filter((v) => v && typeof v === 'object').map((v) => v.title || v.name || '').filter(Boolean);
    blocking.push({ name, severity: sev, range: (info && info.range) || '', fix: info && info.fixAvailable });
    advisories.push(name + '（' + sev + '）：' + (titles[0] || '见 npm audit 输出'));
  }
  return { blocking, counts, advisories, error: '' };
}

function runAudit() {
  // 统一走 shell + 单条命令字符串：
  //   - Windows 上 npm 是 .cmd，无 shell 的 spawnSync 直接失败（status=null、stdout 为空）；
  //   - Node 对「shell:true + args 数组」有 DEP0190 弃用告警（参数未转义），单字符串无此问题；
  //   - 命令里没有用户输入，参数固定。
  // 关键：本脚本通常由 `npm run audit` 启动，父 npm 会把自身配置注入成 npm_config_* 环境变量
  // （实测 npm_config_allow_scripts=NaN）。子 npm 把这些变量当命令行参数解析，直接报错退出。
  // 因此给子进程一份剥离 npm_config_* 的环境：注册表等配置仍会从 .npmrc/默认值读取。
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^npm_config_/i.test(k)) continue;
    env[k] = v;
  }
  const res = spawnSync('npm audit --json --audit-level=high', {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 120000,
    shell: true,
    windowsHide: true,
    env: env
  });
  const raw = String(res.stdout || '');
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { error: { summary: 'npm audit 输出不可解析（' + String((res.stderr || err.message) || '').slice(0, 200) + '）' } };
  }
}

function main() {
  const result = evaluateAuditReport(runAudit());
  if (result.error) {
    console.warn('[audit] 无法获取依赖审计报告，按 fail-open 处理：' + result.error);
    return;
  }
  const c = result.counts;
  console.log('[audit] 依赖审计：critical ' + (c.critical || 0) + ' / high ' + (c.high || 0) +
    ' / moderate ' + (c.moderate || 0) + ' / low ' + (c.low || 0) +
    '（阻断阈值：critical、high；moderate/low 仅报告）');
  if (!result.blocking.length) return;
  console.error('[audit] FAIL：存在 ' + result.blocking.length + ' 个 high/critical 依赖漏洞');
  for (const line of result.advisories) console.error('  - ' + line);
  console.error('  处理：升级直接依赖，或用 package.json 的 overrides 锁到已知修复版本；确认无前向修复时在 CHANGELOG 记录理由。');
  process.exitCode = 1;
}

module.exports = { evaluateAuditReport, BLOCKING_SEVERITIES };

if (require.main === module) main();
