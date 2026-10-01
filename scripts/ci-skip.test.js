'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyRun,
  decideSkip,
  decideForce,
  parseAggregateDescription
} = require('./lib/ci-skip');

test('classifyRun：失败类结论归为 error', () => {
  assert.equal(classifyRun({ conclusion: 'failure' }), 'error');
  assert.equal(classifyRun({ conclusion: 'timed_out' }), 'error');
  assert.equal(classifyRun({ conclusion: 'startup_failure' }), 'error');
});

test('classifyRun：取消/跳过归为 neutral 且不参与计数', () => {
  assert.equal(classifyRun({ conclusion: 'cancelled' }), 'neutral');
  assert.equal(classifyRun({ conclusion: 'skipped' }), 'neutral');
  assert.equal(classifyRun({ conclusion: null }), 'neutral');
});

test('classifyRun：成功且零告警为 clean，有告警为 warn', () => {
  assert.equal(classifyRun({ conclusion: 'success', aggregate: { warnings: 0, timeouts: 0 } }), 'clean');
  assert.equal(classifyRun({ conclusion: 'success', aggregate: { warnings: 3, timeouts: 0 } }), 'warn');
  assert.equal(classifyRun({ conclusion: 'success', aggregate: { warnings: 0, timeouts: 1 } }), 'warn');
});

test('classifyRun：成功但无法判定告警时保守归为 warn', () => {
  assert.equal(classifyRun({ conclusion: 'success', aggregate: null }), 'warn');
});

test('parseAggregateDescription：解析聚合状态描述', () => {
  assert.deepEqual(parseAggregateDescription('errors:0 warnings:2 timeouts:1'), { errors: 0, warnings: 2, timeouts: 1 });
  assert.equal(parseAggregateDescription(''), null);
  assert.equal(parseAggregateDescription('随便一段文字'), null);
  assert.equal(parseAggregateDescription(null), null);
});

test('decideSkip：同一 HEAD 连续错误达阈值 → 跳过', () => {
  const runs = [
    { headSha: 'abc', classification: 'error' },
    { headSha: 'abc', classification: 'error' },
    { headSha: 'abc', classification: 'clean' }
  ];
  const result = decideSkip(runs, 'abc', { requireSameHead: true, consecutiveErrors: 2, consecutiveClean: 5 });
  assert.equal(result.skip, true);
  assert.match(result.reason, /连续 2 次存在阻断失败/);
  assert.equal(result.errorStreak, 2);
});

test('decideSkip：连续干净达阈值 → 跳过', () => {
  const runs = Array.from({ length: 5 }, () => ({ headSha: 'abc', classification: 'clean' }));
  const result = decideSkip(runs, 'abc', { requireSameHead: true, consecutiveErrors: 2, consecutiveClean: 5 });
  assert.equal(result.skip, true);
  assert.match(result.reason, /连续 5 次完全无错无警告/);
});

test('decideSkip：告警重置错误连击', () => {
  const runs = [
    { headSha: 'abc', classification: 'error' },
    { headSha: 'abc', classification: 'warn' },
    { headSha: 'abc', classification: 'error' },
    { headSha: 'abc', classification: 'error' }
  ];
  const result = decideSkip(runs, 'abc', { requireSameHead: true, consecutiveErrors: 2, consecutiveClean: 5 });
  assert.equal(result.errorStreak, 2);
  assert.equal(result.skip, true);
});

test('decideSkip：告警不中断干净连击', () => {
  const runs = [
    { headSha: 'abc', classification: 'clean' },
    { headSha: 'abc', classification: 'warn' },
    { headSha: 'abc', classification: 'clean' },
    { headSha: 'abc', classification: 'warn' },
    { headSha: 'abc', classification: 'clean' }
  ];
  const result = decideSkip(runs, 'abc', { requireSameHead: true, consecutiveErrors: 2, consecutiveClean: 3 });
  assert.equal(result.cleanStreak, 3);
  assert.equal(result.errorStreak, 0);
  assert.equal(result.skip, true);
});

test('decideSkip：错误打断干净连击', () => {
  const runs = [
    { headSha: 'abc', classification: 'error' },
    { headSha: 'abc', classification: 'clean' },
    { headSha: 'abc', classification: 'clean' }
  ];
  const result = decideSkip(runs, 'abc', { requireSameHead: true, consecutiveErrors: 2, consecutiveClean: 3 });
  assert.equal(result.errorStreak, 0);
  assert.equal(result.cleanStreak, 2);
  assert.equal(result.skip, false);
});

test('decideSkip：HEAD 变化即中断链（有新提交必然执行）', () => {
  const runs = [
    { headSha: 'def', classification: 'error' },
    { headSha: 'abc', classification: 'error' }
  ];
  const result = decideSkip(runs, 'abc', { requireSameHead: true, consecutiveErrors: 2, consecutiveClean: 5 });
  assert.equal(result.skip, false);
  assert.equal(result.considered, 0);
  assert.match(result.reason, /没有与当前 HEAD 相同的历史运行/);
});

test('decideSkip：neutral 运行被忽略且不中断链', () => {
  const runs = [
    { headSha: 'abc', classification: 'error' },
    { headSha: 'abc', classification: 'neutral' },
    { headSha: 'abc', classification: 'error' }
  ];
  const result = decideSkip(runs, 'abc', { requireSameHead: true, consecutiveErrors: 2, consecutiveClean: 5 });
  assert.equal(result.skip, true);
  assert.equal(result.errorStreak, 2);
  assert.equal(result.considered, 3);
});

test('decideForce：手动触发、环境变量与提交标记', () => {
  assert.equal(decideForce({ event: 'workflow_dispatch', env: {}, commitMessage: '' }, {}).forced, true);
  assert.equal(decideForce({ event: 'schedule', env: { CI_FORCE: '1' }, commitMessage: '' }, {}).forced, true);
  assert.equal(decideForce({ event: 'schedule', env: {}, commitMessage: 'fix: x [ci force]' }, {}).forced, true);
  assert.equal(decideForce({ event: 'schedule', env: {}, commitMessage: 'chore: 常规' }, {}).forced, false);
});
