const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { collectKeys, keyAppears, moduleNameOf, checkDocs, FILE_POLICIES, DATA_FILE_POLICIES } = require('./check-config-docs');

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

  it('moduleNameOf 取路径最后一段', () => {
    assert.strictEqual(moduleNameOf('lightbox.zoomStep'), 'zoomStep');
    assert.strictEqual(moduleNameOf('enabled'), 'enabled');
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
