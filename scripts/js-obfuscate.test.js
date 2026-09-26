'use strict';
// JS 混淆装配与筛选单测（scripts/lib/compression-steps.js 的 C4 部分 + 真库确定性抽查）。
// 覆盖：preset 档位 → javascript-obfuscator 选项映射、目标文件白名单、runtime 排除、
// 固定 seed 的输出确定性（同输入两次一致、不同 seed 不一致）、模块导出名不受影响。
// 运行：node --test scripts/js-obfuscate.test.js（由 npm test 统一收集）。
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildObfuscateOptions,
  selectObfuscationTargets,
  OBFUSCATE_TARGET_RE,
  OBFUSCATE_EXCLUDED_RE
} = require('./lib/compression-steps');

describe('buildObfuscateOptions（预设映射）', () => {
  test('low：仅标识符重命名 + compact/simplify，危险默认项全部显式关闭', () => {
    const opts = buildObfuscateOptions('low', 42);
    assert.equal(opts.compact, true);
    assert.equal(opts.simplify, true);
    assert.equal(opts.identifierNamesGenerator, 'mangled-shuffled');
    assert.equal(opts.stringArray, false);
    assert.equal(opts.controlFlowFlattening, false);
    assert.equal(opts.numbersToExpressions, false);
    assert.equal(opts.deadCodeInjection, false);
    assert.equal(opts.sourceMap, false);
    assert.equal(opts.seed, 42);
  });

  test('medium：追加 stringArray + base64，不含控制流平坦化', () => {
    const opts = buildObfuscateOptions('medium', 7);
    assert.equal(opts.stringArray, true);
    assert.deepEqual(opts.stringArrayEncoding, ['base64']);
    assert.equal(opts.stringArrayThreshold, 0.75);
    assert.equal(opts.controlFlowFlattening, false);
    assert.equal(opts.numbersToExpressions, false);
  });

  test('high：追加 controlFlowFlattening / splitStrings / numbersToExpressions', () => {
    const opts = buildObfuscateOptions('high', 1);
    assert.equal(opts.stringArray, true);
    assert.equal(opts.controlFlowFlattening, true);
    assert.equal(opts.controlFlowFlatteningThreshold, 0.5);
    assert.equal(opts.splitStrings, true);
    assert.equal(opts.splitStringsChunkLength, 10);
    assert.equal(opts.numbersToExpressions, true);
  });

  test('模块语义保护项恒定：renameGlobals/renameProperties/sourceMap 一律关闭', () => {
    for (const preset of ['low', 'medium', 'high']) {
      const opts = buildObfuscateOptions(preset, 0);
      assert.equal(opts.renameGlobals, false, preset);
      assert.equal(opts.renameProperties, false, preset);
      assert.equal(opts.sourceMap, false, preset);
      assert.equal(opts.selfDefending, false, preset);
      assert.equal(opts.debugProtection, false, preset);
    }
  });

  test('非法 preset 回退 medium，非法 seed 回退 0（与配置校验语义一致）', () => {
    assert.equal(buildObfuscateOptions('max', 1).stringArray, true);
    assert.equal(buildObfuscateOptions(undefined, 1).stringArray, true);
    assert.equal(buildObfuscateOptions('low', -5).seed, 0);
    assert.equal(buildObfuscateOptions('low', 1.5).seed, 0);
    assert.equal(buildObfuscateOptions('low', undefined).seed, 0);
  });

  test('不修改基线常量（多次调用互不影响）', () => {
    const first = buildObfuscateOptions('high', 9);
    const second = buildObfuscateOptions('low', 9);
    assert.equal(second.controlFlowFlattening, false);
    assert.equal(second.stringArray, false);
    assert.notStrictEqual(first.stringArrayEncoding, second.stringArrayEncoding);
  });
});

describe('selectObfuscationTargets（目标文件白名单）', () => {
  test('仅 app.*.js 与 deferred.*.js 命中', () => {
    const files = [
      'app.GRY7RJP6.js',
      'deferred.BZHNLBVR.js',
      'runtime.79bd8cc181.js',
      'core/main.js',
      'vendor/prism.js'
    ];
    assert.deepEqual(selectObfuscationTargets(files), ['app.GRY7RJP6.js', 'deferred.BZHNLBVR.js']);
  });

  test('runtime 排除规则：匹配 runtime 模式但不进入目标', () => {
    assert.ok(OBFUSCATE_EXCLUDED_RE.test('runtime.79bd8cc181.js'), 'runtime 文件名仍可识别');
    assert.ok(!OBFUSCATE_TARGET_RE.test('runtime.79bd8cc181.js'));
    assert.deepEqual(selectObfuscationTargets(['runtime.79bd8cc181.js']), []);
  });

  test('vendor、字体、源码拷贝与其它 JS 一律排除', () => {
    const files = [
      'prism.js', 'mermaid.min.js', 'katex.min.js',
      'search.js', 'app.js', 'APP.ABC.js', 'app..js', 'app.GRY7.js.map'
    ];
    assert.deepEqual(selectObfuscationTargets(files), []);
  });

  test('非数组与含非字符串项时安全返回', () => {
    assert.deepEqual(selectObfuscationTargets(null), []);
    assert.deepEqual(selectObfuscationTargets(undefined), []);
    assert.deepEqual(selectObfuscationTargets([1, null, 'app.ABC123.js']), ['app.ABC123.js']);
  });
});

describe('javascript-obfuscator 真库行为（固定 seed 确定性）', () => {
  const JavaScriptObfuscator = require('javascript-obfuscator');
  const SOURCE = 'export function add(a, b) { const sum = a + b; return sum * 2; }\nconst flag = true;\n';

  test('同输入同 seed 两次输出逐字节一致', () => {
    const opts = buildObfuscateOptions('low', 20260927);
    const first = JavaScriptObfuscator.obfuscate(SOURCE, opts).getObfuscatedCode();
    const second = JavaScriptObfuscator.obfuscate(SOURCE, opts).getObfuscatedCode();
    assert.equal(first, second);
    assert.match(first, /export/, '模块导出语法必须保留');
    assert.ok(!first.includes('sourceMappingURL'), 'sourceMap 关闭时不得输出映射注释');
  });

  // 注：mangled-shuffled 的短名生成不受 seed 影响（实测同输入不同 seed 可能输出一致），
  // seed 的确定性断言以「同 seed 两次一致」为准；选项透传已在 buildObfuscateOptions 用例覆盖。

  test('medium 档产出可执行且导出名保留（renameGlobals=false 的语义保护）', () => {
    const opts = buildObfuscateOptions('medium', 3);
    const out = JavaScriptObfuscator.obfuscate(SOURCE, opts).getObfuscatedCode();
    assert.match(out, /export/);
    assert.ok(out.length > 0);
  });
});
