const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { collectKeys, keyAppears, checkDocs, buildDocModel, keyCovered, FILE_POLICIES, DATA_FILE_POLICIES } = require('./check-config-docs');

// docs/ 不进发布包（白名单排除），发布包解压环境中跳过「真实仓库文档」集成检查；
// 源码仓库与 CI gates（有 docs）仍全量执行。
const DOCS_REFERENCE = path.join(__dirname, '..', 'docs', 'config-reference.md');

describe('check-config-docs collectKeys', () => {
  it('depth=1 仅返回顶层键', () => {
    const keys = collectKeys({ a: 1, b: { c: 2, d: 3 } }, 1);
    assert.deepStrictEqual(keys, ['a', 'b']);
  });

  it('depth=2 追加对象模块的直接子键，数组不入子键', () => {
    const keys = collectKeys({ a: 1, b: { c: 2, d: { e: 3 } }, f: [1, 2] }, 2);
    assert.deepStrictEqual(keys, ['a', 'b', 'f', 'b.c', 'b.d']);
  });
});

describe('check-config-docs keyCovered（审查 R-33：按模块作用域判定）', () => {
  const DOC = [
    '## 1. a.json5 — A 配置',
    '### alpha — 甲',
    '| `enabled` | bool | true | 甲开关 |',
    '### beta — 乙',
    '| `mode` | string | x | 乙模式 |',
    '## 2. b.json5 — B 配置',
    '| `enabled` | bool | false | 顶层表 |',
  ].join('\n');

  it('叶名同一小节内出现即覆盖（模块小节作用域）', () => {
    const model = buildDocModel(DOC);
    const leafCounts = new Map([['enabled', 2], ['mode', 1]]);
    assert.strictEqual(keyCovered(model, 'a', 'alpha.enabled', leafCounts), true);
    assert.strictEqual(keyCovered(model, 'a', 'beta.mode', leafCounts), true);
  });

  it('叶名只出现在别的模块小节里不算覆盖（旧实现靠全文叶名匹配会放行）', () => {
    const model = buildDocModel(DOC);
    // 两个叶名在全站都不唯一（现实中 enabled/mode 会在多个配置里重复），
    // 因此必须靠「所属模块小节」作证——别的模块小节里出现不算。
    const ambiguous = new Map([['enabled', 2], ['mode', 2]]);
    assert.strictEqual(keyCovered(model, 'a', 'beta.enabled', ambiguous), false);
    assert.strictEqual(keyCovered(model, 'a', 'alpha.mode', ambiguous), false);
  });

  it('全站唯一叶名与完整键路径都算无歧义覆盖', () => {
    const model = buildDocModel(DOC);
    const unique = new Map([['mode', 1]]);
    assert.strictEqual(keyCovered(model, 'a', 'alpha.mode', unique), true);
    const dup = new Map([['enabled', 3]]);
    assert.strictEqual(keyCovered(buildDocModel(DOC + '\n| `beta.enabled` | bool | true | 全路径 |'), 'a', 'beta.enabled', dup), true);
  });

  it('无模块小节的文件小节要求模块名与叶名同行出现', () => {
    const doc = ['## 3. c.json5 — C', '| `moduleA.x` | bool | true | — |', '| `moduleB.y` | bool | true | — |'].join('\n');
    const model = buildDocModel(doc);
    const leafCounts = new Map([['x', 5], ['y', 5]]);
    assert.strictEqual(keyCovered(model, 'c', 'moduleA.x', leafCounts), true);
    assert.strictEqual(keyCovered(model, 'c', 'moduleA.y', leafCounts), false);
  });
});

describe('check-config-docs keyAppears', () => {
  it('标识符按词边界匹配，不误命中更长标识符', () => {
    assert.strictEqual(keyAppears('`bodySize` 正文字号', 'bodySize'), true);
    assert.strictEqual(keyAppears('--typography-bodySize 变量', 'bodySize'), true);
    assert.strictEqual(keyAppears('bodySizeX', 'bodySize'), false);
    assert.strictEqual(keyAppears('mybodySize', 'bodySize'), false);
  });

  it('含特殊字符的键按字面量匹配', () => {
    assert.strictEqual(keyAppears('头 X-Frame-Options: DENY', 'X-Frame-Options'), true);
    assert.strictEqual(keyAppears('无此头', 'X-Frame-Options'), false);
  });
});

describe('check-config-docs 策略表', () => {
  it('覆盖全部 15 个 JSON5（14 站点配置 + internals）且数据文件 depth=1', () => {
    assert.strictEqual(FILE_POLICIES.length, 15);
    const depth1 = FILE_POLICIES.filter(p => p.depth === 1).map(p => p.file).sort();
    assert.deepStrictEqual(depth1, ['content-policy', 'friends', 'tag-aliases', 'ui-strings']);
  });

  it('data 数据文件策略：登记 data/quotes.json5 章节存在性（键级由文件头注释承担）', () => {
    assert.deepStrictEqual(DATA_FILE_POLICIES.map(p => p.file), ['data/quotes.json5']);
  });
});

describe('check-config-docs 真实仓库', () => {
  it('15 个配置文件键均被 config-reference 覆盖（集成）', function (t) {
    if (!fs.existsSync(DOCS_REFERENCE)) {
      t.skip('发布包不含 docs/config-reference.md（文档不进包），文档覆盖集成检查在源码仓库执行');
      return;
    }
    const result = checkDocs({ root: path.resolve(__dirname, '..') });
    assert.deepStrictEqual(result.missing, []);
    assert.deepStrictEqual(result.missingSections, []);
    assert.deepStrictEqual(result.staleModules, []);
    assert.ok(result.checked > 1000, '校验键数应大于 1000，实际 ' + result.checked);
  });

  it('CLI 退出码为 0', function (t) {
    if (!fs.existsSync(DOCS_REFERENCE)) {
      t.skip('发布包不含 docs/config-reference.md（文档不进包），CLI 检查在源码仓库执行');
      return;
    }
    const result = spawnSync(process.execPath, [path.join(__dirname, 'check-config-docs.js')], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  });
});
