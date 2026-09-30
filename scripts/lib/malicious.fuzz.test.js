'use strict';
// 图谋/畸形载荷 × 失败策略的属性测试（不启动真实构建，快速执行）：
//   hard-fail 类：validateSlug 拒绝遍历、保留设备名；JSON5 语法抛错；重复键检出；
//                 schema 拒绝类型漂移/越界枚举；未来日期按发布窗口排除；
//   degrade 类：随机 XSS 组合经 marked+sanitize 无可执行构造；Unicode 截断不产生孤立代理；
//               随机字节生成器确定性有界；原子写临时路径不越出目标目录。
// 运行：npm run test:fuzz；复现：TEST_SEED=<种子> FC_NUM_RUNS=<次数> npm run test:fuzz。

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fc = require('fast-check');
const json5 = require('json5');
const { marked } = require('marked');
const { checkProperty, makeRng, stressEnabled } = require('./test-random');
const {
  BAD_JSON5_PAYLOADS, DATES_SLUGS_PAYLOADS, TRAVERSAL_PAYLOADS, UNICODE_PAYLOADS,
  allPayloads, byCategory,
  generateTraversalSlug, generateXssPayload, generateRandomBytes, generateLongText
} = require('./test-payloads');
const {
  safeSlug, validateSlug, isReservedOsName, hasUnsafeLinkScheme, sanitizeHtml,
  escapeAttr, escapeHtml, escapeJsonForScript, truncateCodePoints, stripInvalidXmlChars
} = require('./utils');
const { findDuplicateKeys } = require('./config-duplicates');
const { validateFeatures } = require('./features-schema');
const { isScheduled } = require('./publish-window');
const { atomicTempPath } = require('./atomic-write');

const STRESS = stressEnabled();
const SYNTAX_BAD_JSON5 = Object.freeze([
  'json5-bare-value', 'json5-unterminated-string', 'json5-unclosed-object',
  'json5-missing-comma', 'json5-bad-number', 'json5-mismatched-bracket'
]);

function renderMarkdown(md) {
  return /** @type {string} */ (marked.parse(md));
}

// 净化结果的可执行构造断言（与 markdown.fuzz.test.js 同一口径，此处覆盖随机组合载荷）。
function assertNoExecutableHtml(html, label) {
  assert.doesNotMatch(html, /<\s*(script|iframe|object|embed|svg|math|template|noscript|form)[\s>/]/i, label + ' 危险标签必须被移除：' + html.slice(0, 300));
  assert.doesNotMatch(html, /<[^>]*\son[a-z]+\s*=/i, label + ' 事件属性必须被移除：' + html.slice(0, 300));
  for (const match of html.matchAll(/(?:href|src|poster)\s*=\s*"([^"]*)"/gi)) {
    assert.doesNotMatch(match[1], /^\s*(?:javascript|vbscript|data):/i, label + ' 危险协议必须被移除：' + match[1]);
  }
}

// 孤立代理判定必须按码点遍历：U+10000+ 的合法代理对是两个代理码元，正则字符类会误报。
function hasLoneSurrogate(text) {
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xd800 && cp <= 0xdfff) return true;
  }
  return false;
}

describe('恶意载荷策略属性', () => {
  it('路径遍历生成器：validateSlug 全拒绝且 safeSlug 不逃逸', () => {
    checkProperty('malicious-遍历拒绝', fc, fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
      const payload = generateTraversalSlug(makeRng(seed));
      const check = validateSlug(payload);
      if (check.ok) {
        // 允许的情形仅限 trim 归一化后不含危险结构的输入；归一化结果必须仍受字符集约束。
        assert.doesNotMatch(check.slug, /[/\\]/);
        assert.ok(!check.slug.includes('..'));
      }
      const slug = safeSlug(payload) || 'empty';
      assert.ok(!slug.includes('/') && !slug.includes('\\') && !slug.includes('..'), 'safeSlug 不得引入路径结构：' + JSON.stringify(slug));
      assert.ok(!path.isAbsolute(slug));
      return true;
    }));
  });

  it('静态遍历载荷：除尾随空白归一化外全部拒绝', () => {
    for (const payload of TRAVERSAL_PAYLOADS) {
      const result = validateSlug(payload.value);
      if (payload.id === 'path-trailing-space') {
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.slug, 'name');
      } else {
        assert.strictEqual(result.ok, false, payload.id + ' 必须被拒绝：' + payload.value);
      }
    }
  });

  it('Windows 保留设备名（含大小写与扩展名）必须拒绝或被 preflight 拦截', () => {
    checkProperty('malicious-设备名', fc, fc.property(
      fc.tuple(fc.constantFrom('con', 'prn', 'aux', 'nul', 'com1', 'com9', 'lpt1', 'lpt9'), fc.constantFrom('', '.txt', '.png'), fc.boolean()),
      ([name, ext, upper]) => {
        const candidate = (upper ? name.toUpperCase() : name) + ext;
        assert.strictEqual(isReservedOsName(candidate), true, candidate + ' 必须识别为保留名');
        assert.strictEqual(validateSlug(candidate).ok, false, candidate + ' 必须被 validateSlug 拒绝');
        return true;
      }
    ));
  });

  it('随机 XSS 组合载荷经 marked + sanitize 后无可执行构造', () => {
    checkProperty('malicious-XSS净化', fc, fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
      const payload = generateXssPayload(makeRng(seed));
      assertNoExecutableHtml(sanitizeHtml(renderMarkdown(payload)), 'seed=' + seed);
      return true;
    }));
  });

  it('转义出口：escapeAttr/escapeHtml/escapeJsonForScript 不保留可执行构造', () => {
    const payloadArb = fc.integer({ min: 0, max: 0xffffffff }).map((seed) => generateXssPayload(makeRng(seed)));
    checkProperty('malicious-转义出口', fc, fc.property(payloadArb, (payload) => {
      assert.doesNotMatch(escapeAttr(payload), /["'<>]/, 'escapeAttr 必须消除引号与尖括号');
      assert.doesNotMatch(escapeHtml(payload), /[<>]/, 'escapeHtml 必须消除尖括号');
      assert.ok(!escapeJsonForScript(payload).includes('<'), '内联脚本 JSON 不得含 "<"');
      assert.strictEqual(JSON.parse(escapeJsonForScript(payload)), payload, '内联脚本转义必须可逆');
      return true;
    }));
  });

  it('坏 JSON5：语法类必抛，重复键必报，类型漂移/越界枚举必被 schema 拒绝', () => {
    for (const payload of BAD_JSON5_PAYLOADS) {
      if (SYNTAX_BAD_JSON5.includes(payload.id)) {
        assert.throws(() => json5.parse(payload.value), undefined, payload.id + ' 必须抛解析错误');
      }
    }
    assert.ok(findDuplicateKeys(BAD_JSON5_PAYLOADS.find((p) => p.id === 'json5-duplicate-key').value).findings.length > 0, '重复键必须被检出');
    const drift = validateFeatures({ search: { enabled: 'yes' } }, 'features');
    assert.ok(drift.errors.some((e) => e.includes('features.search.enabled')), '类型漂移必须报键路径');
    const enumBad = validateFeatures({ ogImageStyle: { enabled: true, template: 'neon' } }, 'features');
    assert.ok(enumBad.errors.some((e) => e.includes('features.ogImageStyle.template')), '越界枚举必须报键路径');
  });

  it('日期：未来日期按发布窗口排除，非法日期不可通过 Date 解析', () => {
    const future = DATES_SLUGS_PAYLOADS.find((p) => p.id === 'date-future');
    const invalid = DATES_SLUGS_PAYLOADS.find((p) => p.id === 'date-invalid-month');
    const garbage = DATES_SLUGS_PAYLOADS.find((p) => p.id === 'date-garbage');
    assert.strictEqual(isScheduled({ date: future.value }, new Date()), true);
    assert.strictEqual(isScheduled({ date: '2020-01-01' }, new Date()), false);
    assert.ok(isNaN(new Date(invalid.value).getTime()), '越界月份/日必须无法解析');
    assert.ok(isNaN(new Date(garbage.value).getTime()), '非日期字符串必须无法解析');
  });

  it('Unicode：截断按码点且 XML 清洗只删不改、非法链接协议可检出', () => {
    const max = STRESS ? 200 : 30;
    const anyUnit = fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code));
    checkProperty('malicious-码点截断', fc, fc.property(fc.string({ unit: anyUnit, maxLength: STRESS ? 400 : 60 }), (text) => {
      const cut = truncateCodePoints(text, max);
      const inputUnits = Array.from(text);
      assert.deepStrictEqual(Array.from(cut), inputUnits.slice(0, Math.min(max, inputUnits.length)), '截断结果必须是输入的码点前缀（不切断代理对）');
      assert.strictEqual(truncateCodePoints(cut, max), cut, '截断必须幂等');
      const cleaned = stripInvalidXmlChars(text);
      assert.ok(!hasLoneSurrogate(cleaned), 'XML 清洗必须移除孤立代理');
      assert.ok(Array.from(cleaned).length <= Array.from(text).length, '清洗只删不改');
      return true;
    }));
    for (const payload of UNICODE_PAYLOADS) {
      assert.strictEqual(typeof payload.value, 'string');
    }
    assert.strictEqual(hasUnsafeLinkScheme('java\nscript:alert(1)'), true);
    assert.strictEqual(hasUnsafeLinkScheme('  JaVaScRiPt:alert(1)'), true);
    assert.strictEqual(hasUnsafeLinkScheme('vbscript:msgbox'), true);
    assert.strictEqual(hasUnsafeLinkScheme('data:text/html,<script>'), true);
    assert.strictEqual(hasUnsafeLinkScheme('https://example.test/a?b=javascript:'), false);
    assert.strictEqual(hasUnsafeLinkScheme('/relative/path'), false);
  });

  it('超长文本：safeSlug 有界、确定性；随机字节生成器确定性有界', () => {
    const length = STRESS ? 200000 : 5000;
    const text = generateLongText(makeRng(42), length);
    assert.strictEqual(text, generateLongText(makeRng(42), length), '同一 rng 必须产生同一文本');
    assert.strictEqual(text.length, length);
    const slug = safeSlug(text);
    assert.ok(slug.length <= 120, 'safeSlug 输出必须有界：' + slug.length);
    assert.strictEqual(safeSlug(slug), slug, 'safeSlug 必须幂等');
    assert.strictEqual(safeSlug(text), slug, 'safeSlug 必须确定');
    const bytes = generateRandomBytes(makeRng(7), STRESS ? 512 : 64);
    assert.deepStrictEqual(bytes, generateRandomBytes(makeRng(7), STRESS ? 512 : 64));
    assert.ok(bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255));
  });

  it('原子写临时路径：与目标同目录、不引入分隔符、唯一', () => {
    checkProperty('malicious-原子写路径', fc, fc.property(fc.stringMatching(/^[A-Za-z0-9._-]{1,40}$/), (name) => {
      const target = path.join('/root', 'dist', name + '.html');
      const tmp = atomicTempPath(target);
      assert.strictEqual(path.dirname(tmp), path.dirname(target), '临时文件必须与目标同目录');
      assert.ok(tmp.startsWith(target), '临时路径必须以目标路径为前缀');
      assert.ok(tmp.includes('.tmp-'), '临时路径必须带 .tmp- 标记');
      return true;
    }));
  });

  it('载荷语料策略元数据完整：类别/策略/形态齐备', () => {
    const policies = new Set(allPayloads().map((p) => p.policy));
    assert.deepStrictEqual([...policies].sort(), ['degrade', 'hard-fail']);
    for (const payload of allPayloads()) {
      assert.ok(payload.id && payload.note, '载荷必须携带 id 与说明');
      assert.ok(['text', 'bytes', 'json5', 'scenario'].includes(payload.kind || 'text'), payload.id + ' 形态合法');
    }
    for (const scenario of allPayloads().filter((p) => p.category === 'io-failure')) assert.strictEqual(scenario.policy, 'degrade');
    assert.ok(byCategory('xss').every((p) => p.policy === 'hard-fail'));
    assert.ok(byCategory('traversal').every((p) => p.policy === 'hard-fail'));
    assert.ok(byCategory('encoding').every((p) => p.policy === 'degrade'));
    assert.ok(byCategory('media').every((p) => p.policy === 'degrade'));
  });
});
