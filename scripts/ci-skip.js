#!/usr/bin/env node
'use strict';

// CI 连击跳过预检（workflow 的 preflight 步骤调用）：
//   读取 internals.ci.skip 配置，经 GitHub API 查询本工作流历史运行与状态，
//   判定「无变化重复运行」是否应跳过（连续失败/连续全净达到阈值）。
//   失败开放（fail-open）：缺少 token、API 异常等一律按「执行」处理，绝不影响主流程。
// 输出：stdout 打印结论；存在 $GITHUB_OUTPUT 时写入 skip/reason 供后续 job 使用。

const fs = require('fs');
const { loadInternals } = require('./lib/internals');
const { classifyRun, decideSkip, decideForce, parseAggregateDescription, AGGREGATE_CONTEXT } = require('./lib/ci-skip');

const API_BASE = process.env.GITHUB_API_URL || 'https://api.github.com';
const MAX_RUNS = 30;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

async function apiGet(url, token) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + token,
      'user-agent': 's-ynapse-ci-skip',
      'x-github-api-version': '2022-11-28'
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' ' + url);
  }
  return response.json();
}

async function fetchCommitMessage(repo, sha, token) {
  try {
    const payload = await apiGet(API_BASE + '/repos/' + repo + '/commits/' + sha, token);
    return payload && payload.commit ? payload.commit.message : '';
  } catch (err) {
    return '';
  }
}

async function fetchRuns(repo, workflow, branch, token) {
  const query = branch ? '&branch=' + encodeURIComponent(branch) : '';
  const payload = await apiGet(
    API_BASE + '/repos/' + repo + '/actions/workflows/' + encodeURIComponent(workflow) + '/runs?per_page=' + MAX_RUNS + query,
    token
  );
  return (payload && payload.workflow_runs) || [];
}

async function fetchAggregateBySha(repo, token, cache, sha) {
  if (!sha) return null;
  if (cache.has(sha)) return cache.get(sha);
  let aggregate;
  try {
    const statuses = await apiGet(API_BASE + '/repos/' + repo + '/commits/' + sha + '/statuses?per_page=100', token);
    const hit = (statuses || []).find((item) => item && item.context === AGGREGATE_CONTEXT);
    aggregate = hit ? parseAggregateDescription(hit.description) : null;
  } catch (err) {
    aggregate = null;
  }
  cache.set(sha, aggregate);
  return aggregate;
}

function emitOutput(result) {
  console.log('[ci-skip] ' + (result.skip ? 'SKIP' : 'RUN') + '：' + result.reason
    + '（错误连击 ' + result.errorStreak + ' / 干净连击 ' + result.cleanStreak + ' / 计入 ' + result.considered + '）');
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, 'skip=' + (result.skip ? 'true' : 'false') + '\n', 'utf-8');
    fs.appendFileSync(outputFile, 'reason=' + result.reason.replace(/\r?\n/g, ' ') + '\n', 'utf-8');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        '## CI 预检\n\n' + (result.skip ? '⏭️ 跳过：' : '▶️ 执行：') + result.reason + '\n\n', 'utf-8');
    } catch (err) { /* 摘要写入失败不影响判定 */ }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const internals = loadInternals();
  const config = internals.ci.skip;
  const base = { skip: false, reason: '未启用连击跳过（internals.ci.skip.enabled=false）', errorStreak: 0, cleanStreak: 0, considered: 0 };

  if (config.enabled !== true) {
    emitOutput(base);
    return;
  }

  const event = args.event || '';
  let commitMessage = args['commit-message'] || '';
  const token = process.env.GITHUB_TOKEN || '';
  const repo = process.env.GITHUB_REPOSITORY || '';
  const head = args.head || process.env.GITHUB_SHA || '';
  const branch = args.branch || '';
  const workflow = args.workflow || '';

  const force = decideForce({ event, env: process.env, commitMessage }, config);
  if (force.forced) {
    emitOutput({ ...base, reason: force.reason });
    return;
  }
  if (!token || !repo || !head || !workflow) {
    emitOutput({ ...base, reason: '缺少 GITHUB_TOKEN/GITHUB_REPOSITORY/GITHUB_SHA/--workflow，按执行处理（fail-open）' });
    return;
  }

  if (!commitMessage) {
    commitMessage = await fetchCommitMessage(repo, head, token);
    const forcedByCommit = decideForce({ event, env: {}, commitMessage }, config);
    if (forcedByCommit.forced) {
      emitOutput({ ...base, reason: forcedByCommit.reason });
      return;
    }
  }

  try {
    const runs = await fetchRuns(repo, workflow, branch, token);
    const aggregateCache = new Map();
    const enriched = [];
    for (const run of runs) {
      if (!run || !run.head_sha) continue;
      const aggregate = run.conclusion === 'success'
        ? await fetchAggregateBySha(repo, token, aggregateCache, run.head_sha)
        : null;
      enriched.push({
        headSha: run.head_sha,
        classification: classifyRun({ conclusion: run.conclusion, aggregate })
      });
    }
    const decision = decideSkip(enriched, head, config);
    emitOutput(decision);
  } catch (err) {
    console.warn('[ci-skip] 查询失败，按执行处理（fail-open）：' + err.message);
    emitOutput({ ...base, reason: '查询失败，按执行处理（fail-open）' });
  }
}

main().catch((err) => {
  console.warn('[ci-skip] 预检异常，按执行处理（fail-open）：' + (err && err.message ? err.message : err));
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    try { fs.appendFileSync(outputFile, 'skip=false\n', 'utf-8'); } catch (writeErr) { /* 忽略 */ }
  }
});
