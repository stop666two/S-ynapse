'use strict';
// 配置合并与校验属性测试：
// 覆盖 compression-config 的深合并/校验（单位元、覆盖优先、数组替换、错误聚合）、
// features-schema 的校验链、config-split 的运行时拆分、config-duplicates 的重复键
// 交叉验证，以及 check-config-refs 的叶子扫描容错。运行：npm run test:fuzz。

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const json5 = require('json5');
const { DEFAULT_COMPRESSION, validateCompression, mergeCompressionOverride } = require('./compression-config');
const { validateFeatures, FEATURE_MODULES } = require('./features-schema');
const { buildRuntimeConfig, configUrlName, CRITICAL_MAX_BYTES } = require('./config-split');
const { findDuplicateKeys, filterAllowlisted, matchesAllowlistFile } = require('./config-duplicates');
const { collectLeaves, isAllowed } = require('../check-config-refs');
const { checkProperty } = require('./test-random');

const anyUnit = fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code));
const anyText = fc.string({ unit: anyUnit, maxLength: 40 });
const keyArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,10}$/);
const valueArb = fc.oneof(
  fc.integer({ min: -1000, max: 1000 }),
  fc.string({ maxLength: 8 }),
  fc.boolean()
);

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_COMPRESSION));
}

function randomTree() {
  const leaf = fc.oneof(fc.integer(), fc.string({ maxLength: 8 }), fc.boolean(), fc.constant(null));
  return fc.letrec((tie) => ({
    node: fc.oneof(
      { maxDepth: 4 },
      leaf,
      fc.array(tie('node'), { maxLength: 3 }),
      fc.dictionary(keyArb, tie('node'), { maxKeys: 4 })
    )
  })).node;
}

describe('compression-config 深合并属性', () => {
  it('单位元：与空对象合并不改变配置且无校验错误', () => {
    checkProperty('deepMerge-单位元', fc, fc.property(fc.constant(null), () => {
      const base = cloneDefaults();
      const result = mergeCompressionOverride(base, {});
      assert.deepStrictEqual(result.config, base);
      assert.deepStrictEqual(result.errors, []);
      return true;
    }));
  });

  it('覆盖优先：标量/嵌套叶子覆盖生效，未覆盖叶子保持默认', () => {
    const override = fc.record({
      enabled: fc.boolean(),
      html: fc.record({ removeComments: fc.boolean() }),
      js: fc.record({ obfuscate: fc.record({ seed: fc.integer({ min: 0, max: 1000000 }) }) })
    });
    checkProperty('deepMerge-覆盖优先', fc, fc.property(override, (patch) => {
      const base = cloneDefaults();
      const result = mergeCompressionOverride(base, patch);
      assert.strictEqual(result.config.enabled, patch.enabled);
      assert.strictEqual(result.config.html.removeComments, patch.html.removeComments);
      assert.strictEqual(result.config.html.collapseWhitespace, base.html.collapseWhitespace);
      assert.strictEqual(result.config.js.obfuscate.seed, patch.js.obfuscate.seed);
      assert.strictEqual(result.config.js.obfuscate.preset, 'medium');
      assert.deepStrictEqual(result.errors, []);
      return true;
    }));
  });

  it('数组整体替换而非拼接', () => {
    const patterns = fc.uniqueArray(fc.stringMatching(/^[a-z*][a-z0-9*/.-]{1,20}$/), { minLength: 1, maxLength: 5 });
    checkProperty('deepMerge-数组替换', fc, fc.property(patterns, (exclude) => {
      const result = mergeCompressionOverride(cloneDefaults(), { exclude });
      assert.deepStrictEqual(result.config.exclude, exclude);
      assert.ok(!result.config.exclude.includes('build-report.html'), '不得残留默认豁免项');
      assert.deepStrictEqual(result.errors, []);
      return true;
    }));
  });

  it('多字段非法时聚合报错且每条含字段路径', () => {
    const bad = fc.record({
      enabled: fc.constantFrom('yes', 0, null, [], {}),
      html: fc.record({ aggressive: fc.constantFrom('true', 1) })
    });
    checkProperty('mergeCompressionOverride-错误聚合', fc, fc.property(bad, (patch) => {
      const result = mergeCompressionOverride(cloneDefaults(), patch);
      assert.ok(result.errors.some((e) => e.includes('compression-override.enabled')),
        '缺少 enabled 路径：' + JSON.stringify(result.errors));
      assert.ok(result.errors.some((e) => e.includes('compression-override.html.aggressive')),
        '缺少 html.aggressive 路径：' + JSON.stringify(result.errors));
      return true;
    }));
  });

  it('合法覆盖不产生校验错误（假阳性防线）', () => {
    const override = fc.record({
      enabled: fc.boolean(),
      html: fc.record({ enabled: fc.boolean(), removeComments: fc.boolean(), aggressive: fc.boolean() }),
      js: fc.record({ obfuscate: fc.record({ preset: fc.constantFrom('low', 'medium', 'high'), seed: fc.integer({ min: 0, max: 1000000 }) }) }),
      exclude: fc.uniqueArray(fc.stringMatching(/^[a-z*][a-z0-9*/.-]{1,20}$/), { minLength: 1, maxLength: 4 })
    });
    checkProperty('validateCompression-无假阳性', fc, fc.property(override, (patch) => {
      const base = cloneDefaults();
      const result = mergeCompressionOverride(base, patch);
      assert.deepStrictEqual(result.errors, []);
      const direct = validateCompression(base, 'compression');
      assert.deepStrictEqual(direct.errors, []);
      return true;
    }));
  });

  it('非对象覆盖与超限 critical 的确定性错误信息', () => {
    const result = mergeCompressionOverride(cloneDefaults(), 42);
    assert.ok(result.errors.some((e) => e.includes('--compression-override')));
    const huge = { enabled: true, blob: 'x'.repeat(CRITICAL_MAX_BYTES + 512) };
    assert.throws(
      () => buildRuntimeConfig({ features: { guards: huge }, guard: {} }),
      /critical 内联配置 \d+ 字节/
    );
  });
});

describe('validateFeatures 校验链属性', () => {
  it('任意输入不崩溃且返回结构完整', () => {
    checkProperty('validateFeatures-容错', fc, fc.property(fc.anything(), (value) => {
      const result = validateFeatures(value, 'features');
      assert.ok(Array.isArray(result.errors));
      assert.ok(Array.isArray(result.warnings));
      for (const msg of result.errors.concat(result.warnings)) assert.strictEqual(typeof msg, 'string');
      return true;
    }));
  });

  it('enabled 非布尔必报错且消息含模块路径', () => {
    const bad = fc.record({
      mod: fc.constantFrom(...FEATURE_MODULES),
      enabled: fc.oneof(fc.integer(), fc.string(), fc.constant(null), fc.array(fc.integer()))
    });
    checkProperty('validateFeatures-enabled 类型', fc, fc.property(bad, ({ mod, enabled }) => {
      const result = validateFeatures({ [mod]: { enabled } }, 'features');
      assert.ok(result.errors.some((e) => e.includes(mod + '.enabled must be a boolean')),
        '缺少路径 ' + mod + '.enabled：' + JSON.stringify(result.errors));
      return true;
    }));
  });

  it('未知模块键产生警告而非错误', () => {
    const unknownKey = fc.stringMatching(/^[a-z][a-z0-9]{3,10}$/).filter((k) => !FEATURE_MODULES.includes(k));
    checkProperty('validateFeatures-未知模块', fc, fc.property(unknownKey, (key) => {
      const result = validateFeatures({ [key]: { enabled: true } }, 'features');
      assert.ok(result.warnings.some((w) => w.includes('not a known feature module') && w.includes(key)),
        '缺少未知模块警告：' + JSON.stringify(result.warnings));
      return true;
    }));
  });

  it('枚举越界必报错且合法值通过', () => {
    const allowed = ['hover', 'always', 'never'];
    const illegal = fc.stringMatching(/^[a-z]{1,10}$/).filter((v) => !allowed.includes(v));
    checkProperty('validateFeatures-枚举', fc, fc.property(illegal, (value) => {
      const bad = validateFeatures({ codeBlock: { copyButtonVisibility: value } }, 'features');
      assert.ok(bad.errors.some((e) => e.includes('codeBlock.copyButtonVisibility must be one of')),
        '缺少枚举错误：' + JSON.stringify(bad.errors));
      const good = validateFeatures({ codeBlock: { copyButtonVisibility: 'hover' } }, 'features');
      assert.ok(!good.errors.some((e) => e.includes('copyButtonVisibility')), '合法枚举不得报错');
      return true;
    }));
  });
});

describe('config-split 运行时拆分属性', () => {
  it('任意来源不抛（或抛出超限错误），成功时结构完整且在字节上限内', () => {
    const sources = fc.record({
      features: fc.anything(),
      tuning: fc.anything(),
      guard: fc.anything(),
      pwa: fc.anything(),
      presets: fc.anything(),
      quotes: fc.anything()
    }, { requiredKeys: [] });
    checkProperty('buildRuntimeConfig-容错', fc, fc.property(sources, (input) => {
      let result;
      try {
        result = buildRuntimeConfig(input);
      } catch (err) {
        assert.match(String(err.message), /critical 内联配置 \d+ 字节/);
        return true;
      }
      const bytes = Buffer.byteLength(JSON.stringify(result.critical), 'utf8');
      assert.ok(bytes <= CRITICAL_MAX_BYTES, 'critical 超限：' + bytes);
      assert.strictEqual(result.external.features, input.features);
      assert.strictEqual(typeof result.critical.pwa.enabled, 'boolean');
      assert.strictEqual(typeof result.critical.pwa.serviceWorker, 'string');
      assert.ok(Array.isArray(result.external.presets));
      assert.ok(Array.isArray(result.external.quotes));
      return true;
    }));
  });

  it('guard 仅在启用且提供时外置，critical 始终携带 guards', () => {
    const spec = fc.record({ enabled: fc.boolean(), provideGuard: fc.boolean() });
    checkProperty('buildRuntimeConfig-guard 条件', fc, fc.property(spec, ({ enabled, provideGuard }) => {
      const features = { guards: { enabled } };
      const result = buildRuntimeConfig({ features, guard: provideGuard ? { probe: 1 } : undefined });
      const shouldExternal = enabled !== false && provideGuard;
      assert.strictEqual('guard' in result.external, shouldExternal);
      assert.strictEqual(result.critical.features.guards, features.guards);
      return true;
    }));
  });

  it('configUrlName：确定性、内容寻址格式、非法输入 TypeError', () => {
    checkProperty('configUrlName-格式与确定性', fc, fc.property(anyText, (text) => {
      const name = configUrlName(text);
      assert.match(name, /^\/assets\/config\.[0-9a-f]{10}\.json$/);
      assert.strictEqual(configUrlName(text), name);
      return true;
    }));
    checkProperty('configUrlName-非字符串拒绝', fc, fc.property(
      fc.oneof(fc.integer(), fc.constant(null), fc.constant(undefined), fc.array(fc.integer())),
      (value) => {
        assert.throws(() => configUrlName(value), TypeError);
        return true;
      }
    ));
  });
});

describe('config-duplicates 交叉验证属性', () => {
  it('同键重复精确报出行号且与 json5 最后值语义一致', () => {
    const spec = fc.record({
      key: keyArb,
      first: valueArb,
      second: valueArb,
      filler: fc.integer({ min: 0, max: 3 })
    });
    checkProperty('findDuplicateKeys-交叉验证', fc, fc.property(spec, ({ key, first, second, filler }) => {
      const lines = ['{'];
      for (let i = 0; i < filler; i++) lines.push('  // filler ' + i);
      lines.push('  ' + key + ': ' + JSON.stringify(first) + ',');
      lines.push('  ' + JSON.stringify(key) + ': ' + JSON.stringify(second));
      lines.push('}');
      const text = lines.join('\n');
      const expectedFirst = 2 + filler;
      const expectedDuplicate = expectedFirst + 1;
      const { findings, keyCount } = findDuplicateKeys(text);
      assert.strictEqual(findings.length, 1, JSON.stringify(findings));
      assert.strictEqual(findings[0].key, key);
      assert.strictEqual(findings[0].firstLine, expectedFirst);
      assert.strictEqual(findings[0].duplicateLine, expectedDuplicate);
      assert.strictEqual(keyCount, 2);
      assert.deepStrictEqual(json5.parse(text)[key], second, '最后定义必须生效');
      return true;
    }));
  });

  it('跨对象作用域的同名键不误报', () => {
    checkProperty('findDuplicateKeys-无跨作用域误报', fc, fc.property(randomTree(), (tree) => {
      const text = JSON.stringify(tree);
      const { findings } = findDuplicateKeys(text);
      assert.deepStrictEqual(findings, [], '误报：' + JSON.stringify(findings) + ' 输入：' + text);
      return true;
    }));
  });

  it('同一对象内 n 次重复必报出 n-1 条', () => {
    const spec = fc.record({
      key: keyArb,
      values: fc.array(valueArb, { minLength: 2, maxLength: 5 })
    });
    checkProperty('findDuplicateKeys-无漏报', fc, fc.property(spec, ({ key, values }) => {
      const text = '{\n' + values.map((v) => '  ' + key + ': ' + JSON.stringify(v)).join(',\n') + '\n}';
      const { findings, keyCount } = findDuplicateKeys(text);
      assert.strictEqual(findings.length, values.length - 1);
      assert.strictEqual(keyCount, values.length);
      for (const finding of findings) {
        assert.strictEqual(finding.key, key);
        assert.ok(finding.duplicateLine >= finding.firstLine);
      }
      return true;
    }));
  });

  it('任意文本与坏 JSON5 扫描不崩溃且结构完整', () => {
    const text = fc.oneof(anyText, fc.string({ unit: anyUnit, maxLength: 60 }));
    checkProperty('findDuplicateKeys-任意文本', fc, fc.property(text, (raw) => {
      const { findings, keyCount } = findDuplicateKeys(raw);
      assert.ok(Array.isArray(findings));
      assert.ok(Number.isInteger(keyCount) && keyCount >= 0);
      for (const finding of findings) {
        assert.strictEqual(typeof finding.key, 'string');
        assert.ok(Number.isInteger(finding.firstLine) && finding.firstLine >= 1);
        assert.ok(Number.isInteger(finding.duplicateLine) && finding.duplicateLine >= 1);
      }
      return true;
    }));
  });

  it('同一行内重复也能报出（firstLine 与 duplicateLine 相同）', () => {
    const { findings } = findDuplicateKeys('{ a: 1, a: 2 }');
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].firstLine, 1);
    assert.strictEqual(findings[0].duplicateLine, 1);
  });

  it('豁免匹配与过滤对任意输入容错', () => {
    const spec = fc.record({
      findings: fc.array(fc.record({
        key: keyArb,
        firstLine: fc.integer({ min: 1, max: 100 }),
        duplicateLine: fc.integer({ min: 1, max: 100 })
      }), { maxLength: 4 }),
      entries: fc.array(fc.record({ file: anyText, key: anyText, reason: anyText }), { maxLength: 4 }),
      relPath: anyText
    });
    checkProperty('filterAllowlisted-容错', fc, fc.property(spec, ({ findings, entries, relPath }) => {
      const { kept, suppressed } = filterAllowlisted(findings, entries, relPath);
      assert.strictEqual(kept.length + suppressed.length, findings.length);
      for (const item of suppressed) assert.ok(Boolean(item.reason));
      assert.strictEqual(typeof matchesAllowlistFile(relPath, 'site.json5'), 'boolean');
      return true;
    }));
  });
});

describe('check-config-refs 纯函数属性', () => {
  it('任意 JSON 树收集出的叶子路径非空且无重复', () => {
    checkProperty('collectLeaves-结构', fc, fc.property(randomTree(), (tree) => {
      const leaves = [];
      collectLeaves(tree, 'root', leaves);
      const seen = new Set();
      for (const leaf of leaves) {
        assert.strictEqual(typeof leaf, 'string');
        assert.ok(leaf.length > 0, '叶子路径不得为空');
        assert.ok(leaf.startsWith('root'), '叶子路径必须带前缀：' + leaf);
        assert.ok(!leaf.includes('..'), '不得出现空路径段：' + leaf);
        assert.ok(!seen.has(leaf), '叶子路径不得重复：' + leaf);
        seen.add(leaf);
      }
      return true;
    }));
  });

  it('数组按叶子收集、空对象不产生叶子', () => {
    const leaves = [];
    collectLeaves({ a: [1, 2], b: {}, c: { d: null } }, 'root', leaves);
    assert.deepStrictEqual(leaves.sort(), ['root.a', 'root.c.d']);
  });

  it('任意 JSON5 文本的解析与扫描链不崩溃', () => {
    const text = fc.oneof(
      fc.string({ unit: anyUnit, maxLength: 60 }),
      randomTree().map((tree) => JSON.stringify(tree))
    );
    checkProperty('check-config-refs-扫描容错', fc, fc.property(text, (raw) => {
      let parsed;
      try {
        parsed = json5.parse(raw);
      } catch (err) {
        assert.ok(err instanceof Error, '解析失败必须是 Error');
        return true;
      }
      const leaves = [];
      collectLeaves(parsed, 'root', leaves);
      for (const leaf of leaves) assert.strictEqual(typeof leaf, 'string');
      return true;
    }));
  });

  it('isAllowed 的精确/前缀/无关判定', () => {
    const leafArb = fc.stringMatching(/^[a-z][a-z0-9.]{2,12}$/);
    checkProperty('isAllowed-判定', fc, fc.property(leafArb, leafArb, (leaf, prefix) => {
      assert.strictEqual(isAllowed(leaf, { exact: new Set([leaf]), prefixes: [] }), true);
      assert.strictEqual(isAllowed(leaf + '.child', { exact: new Set([leaf]), prefixes: [] }), false);
      assert.strictEqual(isAllowed(prefix, { exact: new Set(), prefixes: [prefix] }), true);
      assert.strictEqual(isAllowed(prefix + '.child', { exact: new Set(), prefixes: [prefix] }), true);
      assert.strictEqual(isAllowed(prefix + 'x', { exact: new Set(), prefixes: [prefix] }), false);
      return true;
    }));
  });
});
