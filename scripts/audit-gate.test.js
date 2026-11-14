'use strict';
// 依赖漏洞门禁的判定逻辑单测（scripts/audit-gate.js）。
//
// 关键契约：
//   1) critical/high 必须阻断；moderate/low 只报告（deepmerge 一条 low 无前向修复，长期存在）；
//   2) 拿不到报告（离线/registry 故障/输出不可解析）必须 fail-open —— 不能把网络问题变成假红；
//   3) 判定是纯函数，输出结构稳定供 CI 打印。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { evaluateAuditReport, BLOCKING_SEVERITIES } = require('./audit-gate.js');

const report = (vulns) => ({
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
  vulnerabilities: vulns
});

describe('audit-gate.evaluateAuditReport', () => {
  it('阻断阈值只有 critical 与 high', () => {
    assert.deepStrictEqual(BLOCKING_SEVERITIES, ['critical', 'high']);
  });

  it('high/critical 计入 blocking，且带 advisory 标题', () => {
    const r = report({
      dompurify: { severity: 'critical', range: '<=3.4.16', via: [{ title: 'DOMPurify bypass' }] },
      sharp: { severity: 'high', range: '<0.35.5', via: [{ title: 'librsvg CVE' }] },
      deepmerge: { severity: 'low', range: '>=4.2.0', via: [{ title: 'prototype poisoning' }] }
    });
    const out = evaluateAuditReport(r);
    assert.strictEqual(out.error, '');
    assert.deepStrictEqual(out.blocking.map((b) => b.name).sort(), ['dompurify', 'sharp']);
    assert.ok(out.advisories.some((a) => a.indexOf('DOMPurify bypass') !== -1));
    assert.strictEqual(out.blocking.length, 2, 'low 不得进入 blocking');
  });

  it('只有 moderate/low 时不阻断（当前仓库的稳定状态）', () => {
    const out = evaluateAuditReport(report({
      deepmerge: { severity: 'low', range: '>=4.2.0', via: [{ title: 'prototype poisoning' }] }
    }));
    assert.deepStrictEqual(out.blocking, []);
    assert.strictEqual(out.counts.low, 0, 'counts 原样透传（此处未构造计数）');
  });

  it('报告缺失/无 metadata/含 error 时 fail-open', () => {
    for (const bad of [null, {}, { error: { summary: 'ENOTFOUND registry' } }, { metadata: {} }]) {
      const out = evaluateAuditReport(bad);
      assert.deepStrictEqual(out.blocking, [], '拿不到报告不得阻断');
      assert.ok(out.error, '应说明失败原因');
    }
  });

  it('空 vulnerabilities 视为干净', () => {
    const out = evaluateAuditReport(report({}));
    assert.deepStrictEqual(out.blocking, []);
    assert.strictEqual(out.error, '');
  });
});
