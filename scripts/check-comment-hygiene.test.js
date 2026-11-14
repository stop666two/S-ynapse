'use strict';
// 注释卫生门禁（规则 333/334）的单元测试。
//
// 覆盖三类误判风险：
//   1) 必须抓到：审查/评审流程标记、裸 R-xx、issue/PR 编号、U+FFFD、GBK 误读乱码；
//   2) 不能误伤：「审计」「复核」作为功能名（无障碍审计/媒体审计）是正常代码说明；
//   3) 范围：docs/ 与规则集豁免，源码/模板/配置/工作流在范围内；门禁自身与夹具豁免。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { findViolations, inScope } = require('./check-comment-hygiene.js');

describe('check-comment-hygiene.findViolations', () => {
  it('抓到流程标记与裸编号', () => {
    const text = [
      '// 默认值先合并，兜底因此不可达。',
      '// 审查 ' + 'R-11：默认值先合并。',
      "it('x', () => {}) // " + 'R-33',
      '// see issue #123'
    ].join('\n');
    const kinds = findViolations(text, 'a.js').map((v) => v.kind);
    assert.ok(kinds.includes('流程标记'), '应识别流程标记');
    assert.ok(kinds.filter((k) => k === '工单编号').length >= 2, '应识别裸编号与 issue 编号');
    assert.deepStrictEqual(findViolations(text, 'a.js').map((v) => v.line), [2, 2, 3, 4]);
  });

  it('不乱伤功能名：审计 / 复核 属正常说明', () => {
    const text = '// 全页无障碍审计（axe-core）；媒体审计结果写入报告；复核输入长度上限';
    assert.deepStrictEqual(findViolations(text, 'a.js'), []);
  });

  it('抓到乱码：替换字符与 GBK 误读特征串', () => {
    const replacement = '// ' + String.fromCharCode(0xfffd) + ' 坏字符';
    const mojibake = '// ' + ['\u951b', '\u935c', '\u5a34'].join('') + ' 乱码';
    assert.strictEqual(findViolations(replacement, 'a.js')[0].kind, '乱码');
    assert.strictEqual(findViolations(mojibake, 'a.js')[0].kind, '乱码');
  });

  it('干净注释零告警（代码说明 + 注意事项）', () => {
    const text = [
      '// 内容哈希命名：内容变则换名，可长期 immutable 缓存。',
      '// 注意：Cloudflare 会合并同请求命中的多条 Cache-Control，不能叠加 /*。',
      '/** @param {string} href 站内绝对路径 */'
    ].join('\n');
    assert.deepStrictEqual(findViolations(text, 'a.js'), []);
  });
});

describe('check-comment-hygiene.inScope', () => {
  it('源码/模板/配置/工作流在范围内', () => {
    for (const rel of ['js/a.js', 'scripts/a.js', 'templates/a.ejs', 'workers/a.mjs', '.github/workflows/a.yml', 'a.json5']) {
      assert.strictEqual(inScope(rel), true, rel);
    }
  });

  it('文档、规则集与产物不在范围内', () => {
    for (const rel of ['docs/a.md', 'README.md', 'CHANGELOG.md', '.opencode/skills/agents-rules/SKILL.md', 'dist/a.js', 'node_modules/x/a.js', 'build-artifacts/a.js']) {
      assert.strictEqual(inScope(rel), false, rel);
    }
  });

  it('门禁自身与夹具豁免（否则无法定义被禁模式）', () => {
    assert.strictEqual(inScope('scripts/check-comment-hygiene.js'), false);
    assert.strictEqual(inScope('scripts/check-comment-hygiene.test.js'), false);
  });
});
