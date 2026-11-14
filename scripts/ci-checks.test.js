'use strict';
// CI 聚合器的结构性契约：
//   1. 每个 `verify:*` / `test:*` 脚本都必须出现在 CHECKS 里 —— 新增门禁忘记接线（或名字写错）
//      会让它永远不在 CI 跑，而聚合器仍报 PASS。这是本仓最常见的一类「门禁漂移」。
//   2. 每个 CHECKS 条目的命令必须指向 package.json 里真实存在的脚本（防拼写漂移）。
//   3. build 必须先于 test：perf-contract 一类断言依赖 dist/，顺序错了它们会静默 skip。
//   4. advisory（不阻断）集合必须显式登记：新增 advisory 等于悄悄降级门禁，必须过审。
//   5. blockingSkips：CI 下阻断项被跳过必须算失败，本地跳过不追究。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { CHECKS, blockingSkips } = require('./ci-checks.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const scripts = pkg.scripts;

// 有意不接入聚合器的脚本 → 必须写明理由，新增项不加说明会直接红。
// 只登记 `verify:*` / `test:*` 前缀（其余脚本不参与本断言）。
const EXEMPT = {
  'test:all': '本地同强度入口，本身就是本聚合器（不能作为检查项自嵌套）'
};

// advisory（结果写报告但不阻断）的显式清单：既有 wrangler/miniflare 链漏洞与
// WCAG target-size/对比度告警按专项跟踪。新增 advisory 必须改这里并说明原因。
const ADVISORY = ['audit:a11y'];

describe('ci-checks 聚合器契约', () => {
  it('所有 verify:/test: 脚本要么已接线，要么在 EXEMPT 里写明理由', () => {
    const wired = new Set(CHECKS.map((check) => check.name));
    const gated = Object.keys(scripts).filter((name) => /^(?:verify|test):/.test(name));
    const missing = gated.filter((name) => !wired.has(name) && !(name in EXEMPT));
    assert.deepStrictEqual(
      missing,
      [],
      '以下门禁脚本没有接入 CI 聚合器（不会在 CI 执行），请接线或在 EXEMPT 写明理由：' + missing.join(', ')
    );
  });

  it('EXEMPT 里不得残留已经从 package.json 删除的脚本', () => {
    const stale = Object.keys(EXEMPT).filter((name) => !(name in scripts));
    assert.deepStrictEqual(stale, [], 'EXEMPT 含已不存在的脚本：' + stale.join(', '));
  });

  it('每个检查项的命令都指向 package.json 里真实存在的脚本', () => {
    for (const check of CHECKS) {
      const [head, sub] = check.args;
      const target = head === 'run' ? sub : head;
      assert.ok(
        Object.prototype.hasOwnProperty.call(scripts, target),
        '检查 ' + check.name + ' 的命令指向不存在的脚本：' + check.args.join(' ')
      );
    }
  });

  it('检查名唯一', () => {
    const names = CHECKS.map((check) => check.name);
    assert.deepStrictEqual(names.filter((n, i) => names.indexOf(n) !== i), [], '检查名重复');
  });

  it('build 必须先于 test（否则依赖 dist/ 的契约会静默跳过）', () => {
    const buildAt = CHECKS.findIndex((check) => check.name === 'build');
    const testAt = CHECKS.findIndex((check) => check.name === 'test');
    assert.ok(buildAt !== -1 && testAt !== -1, 'build 与 test 都必须存在');
    assert.ok(buildAt < testAt, 'build（位置 ' + buildAt + '）必须先于 test（位置 ' + testAt + '）');
  });

  it('advisory 集合与登记一致（新增不阻断项必须同步改这里）', () => {
    const actual = CHECKS.filter((check) => check.advisory).map((check) => check.name).sort();
    assert.deepStrictEqual(actual, ADVISORY.slice().sort());
  });

  it('CI 下阻断项被跳过算失败，advisory 跳过不算', () => {
    const results = [
      { name: 'test', status: 'passed' },
      { name: 'test:smoke', status: 'skipped' },
      { name: 'audit:a11y', status: 'skipped' }
    ];
    assert.deepStrictEqual(blockingSkips(results, true), ['test:smoke'], '只有 advisory 跳过不算失败');
    assert.deepStrictEqual(blockingSkips(results, false), [], '本地跳过不追究');
  });
});
