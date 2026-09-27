const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { collectKeys, keyAppears, moduleNameOf, checkDocs, FILE_POLICIES } = require('./check-config-docs');

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
  it('覆盖全部 14 个 JSON5 且数据文件 depth=1', () => {
    assert.strictEqual(FILE_POLICIES.length, 14);
    const depth1 = FILE_POLICIES.filter(p => p.depth === 1).map(p => p.file).sort();
    assert.deepStrictEqual(depth1, ['content-policy', 'friends', 'tag-aliases', 'ui-strings']);
  });
});

describe('check-config-docs 真实仓库', () => {
  it('14 个配置文件键均被 config-reference 覆盖（集成）', () => {
    const result = checkDocs({ root: path.resolve(__dirname, '..') });
    assert.deepStrictEqual(result.missing, []);
    assert.deepStrictEqual(result.missingSections, []);
    assert.deepStrictEqual(result.staleModules, []);
    assert.ok(result.checked > 1000, '校验键数应大于 1000，实际 ' + result.checked);
  });

  it('CLI 退出码为 0', () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'check-config-docs.js')], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  });
});
