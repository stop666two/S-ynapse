'use strict';
const { DEFAULTS: INTERNAL_DEFAULTS } = require('./internals-defaults');

// CI 连击跳过判定（纯函数，供 scripts/ci-skip.js 使用）：
//   - error：运行结论为 failure/timed_out/startup_failure；
//   - clean：结论为 success 且提交状态（context=ci/aggregate）的描述显示零告警；
//   - warn：结论为 success 但存在告警（或无法判定告警数）；
//   - neutral：cancelled/skipped/null 等不参与计数的运行。
// 计数语义（internals.ci.skip）：
//   error 使 cleanStreak 归零并累加 errorStreak；
//   clean 使 errorStreak 归零并累加 cleanStreak；
//   warn  仅使 errorStreak 归零，不影响 cleanStreak（ignoreWarnings=true 时）；
//   neutral 不改变任何计数，也不中断链。
// 达到 consecutiveErrors 或 consecutiveClean 即建议跳过（skip=true）。

const ERROR_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure']);
const NEUTRAL_CONCLUSIONS = new Set(['cancelled', 'skipped', 'stale', 'action_required']);

const AGGREGATE_CONTEXT = 'ci/aggregate';

/**
 * 从提交状态描述解析告警数量（格式：errors:N warnings:M timeouts:K）。
 * @param {string|null|undefined} description 提交状态描述。
 * @returns {{errors:number, warnings:number, timeouts:number}|null} 无法解析时返回 null。
 */
function parseAggregateDescription(description) {
  if (!description || typeof description !== 'string') return null;
  const match = /errors:(\d+)\s+warnings:(\d+)\s+timeouts:(\d+)/.exec(description);
  if (!match) return null;
  return { errors: Number(match[1]), warnings: Number(match[2]), timeouts: Number(match[3]) };
}

/**
 * 分类单次运行。
 * @param {{conclusion?:string|null, aggregate?:{warnings?:number,timeouts?:number}|null}} run 运行信息。
 * @returns {'error'|'warn'|'clean'|'neutral'} 分类结果。
 */
function classifyRun(run) {
  const conclusion = run && run.conclusion;
  if (!conclusion || NEUTRAL_CONCLUSIONS.has(conclusion)) return 'neutral';
  if (ERROR_CONCLUSIONS.has(conclusion)) return 'error';
  if (conclusion === 'success') {
    const aggregate = run.aggregate;
    if (!aggregate) return 'warn';
    if (aggregate.warnings > 0 || aggregate.timeouts > 0) return 'warn';
    return 'clean';
  }
  return 'warn';
}

/**
 * 判定是否跳过本次运行。
 * @param {Array<{headSha?:string, classification?:string, conclusion?:string|null, aggregate?:{warnings?:number,timeouts?:number}|null}>} runs 由新到旧排列的运行记录。
 * @param {string} currentHead 当前 HEAD SHA。
 * @param {{requireSameHead?:boolean, consecutiveErrors?:number, consecutiveClean?:number}} config 跳过配置。
 * @returns {{skip:boolean, reason:string, errorStreak:number, cleanStreak:number, considered:number}}
 */
function decideSkip(runs, currentHead, config) {
  const requireSameHead = config.requireSameHead !== false;
  const consecutiveErrors = Number(config.consecutiveErrors) || 2;
  const consecutiveClean = Number(config.consecutiveClean) || 5;
  let errorStreak = 0;
  let cleanStreak = 0;
  let considered = 0;
  for (const run of Array.isArray(runs) ? runs : []) {
    if (requireSameHead && run.headSha !== currentHead) break;
    const classification = run.classification || classifyRun(run);
    considered += 1;
    if (classification === 'error') {
      errorStreak += 1;
      cleanStreak = 0;
    } else if (classification === 'clean') {
      cleanStreak += 1;
      errorStreak = 0;
    } else if (classification === 'warn') {
      errorStreak = 0;
    }
    if (errorStreak >= consecutiveErrors) {
      return {
        skip: true,
        reason: '连续 ' + errorStreak + ' 次存在阻断失败（阈值 ' + consecutiveErrors + '），暂停无变化重复运行',
        errorStreak,
        cleanStreak,
        considered
      };
    }
    if (cleanStreak >= consecutiveClean) {
      return {
        skip: true,
        reason: '连续 ' + cleanStreak + ' 次完全无错无警告（阈值 ' + consecutiveClean + '），暂停无变化重复运行',
        errorStreak,
        cleanStreak,
        considered
      };
    }
  }
  return {
    skip: false,
    reason: considered === 0
      ? '没有与当前 HEAD 相同的历史运行，正常执行'
      : '连击未达阈值（错误 ' + errorStreak + ' 次 / 干净 ' + cleanStreak + ' 次），正常执行',
    errorStreak,
    cleanStreak,
    considered
  };
}

/**
 * 判定是否请求强制运行（跳过规则失效）。
 * @param {{event?:string, env?:Object, commitMessage?:string}} input 事件、环境变量与提交信息。
 * @param {{forceEnv?:string, forceToken?:string}} config 强制配置。
 * @returns {{forced:boolean, reason:string}}
 */
function decideForce(input, config) {
  const event = input && input.event;
  const env = (input && input.env) || {};
  const message = (input && input.commitMessage) || '';
  const forceEnv = (config && config.forceEnv) || INTERNAL_DEFAULTS.ci.skip.forceEnv;
  const forceToken = (config && config.forceToken) || '[ci force]';
  if (event === 'workflow_dispatch') return { forced: true, reason: '手动触发（workflow_dispatch）始终执行' };
  const envValue = String(env[forceEnv] || '').toLowerCase();
  if (envValue === '1' || envValue === 'true' || envValue === 'yes') {
    return { forced: true, reason: '环境变量 ' + forceEnv + ' 强制运行' };
  }
  if (message && message.includes(forceToken)) {
    return { forced: true, reason: '提交信息包含 ' + forceToken + ' 强制运行' };
  }
  return { forced: false, reason: '' };
}

module.exports = {
  AGGREGATE_CONTEXT,
  classifyRun,
  decideSkip,
  decideForce,
  parseAggregateDescription
};
