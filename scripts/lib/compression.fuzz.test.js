'use strict';
// 压缩/混淆装配与 CSS 合并去重属性测试：
// 覆盖 css-merge 的保守去重不变量（只删相邻完全重复规则与同规则同属性同 important 的
// 后续声明、A;B;A 反例保留、幂等、字节不增）、mergeStyleBlocks 的保序合并与 nonce/media
// 分组语义，以及 compression-steps/config 的选项装配确定性与开关联动。
// 运行：npm run test:fuzz；复现：TEST_SEED=<种子> FC_NUM_RUNS=<次数> npm run test:fuzz。

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { dedupeCss, mergeStyleBlocks, dedupeStyleBlocks } = require('./css-merge');
const {
  HTML_MINIFY_BASELINE_OPTIONS,
  HTML_MINIFY_AGGRESSIVE_OPTIONS,
  buildHtmlMinifyOptions,
  compactJsonText,
  buildObfuscateOptions,
  compressionEnhancementPlan,
  enhancementWorkActive
} = require('./compression-steps');
const { checkProperty, stressEnabled } = require('./test-random');

const STRESS = stressEnabled();
const MAX_UNITS = STRESS ? 24 : 6;

const propArb = fc.constantFrom('color', 'margin', 'padding', 'background', 'border', '--x', '--accent');
const valueArb = fc.constantFrom('red', '0 auto', '1px solid #333', 'calc(100% - 2px)', 'var(--x)', 'url("a.png")', '"str;{}"');
const declArb = fc.tuple(propArb, valueArb, fc.boolean())
  .map(([name, value, important]) => name + ':' + value + (important ? '!important' : ''));
const bodyArb = fc.array(declArb, { minLength: 1, maxLength: 3 }).map((decls) => decls.join(';'));
const selectorArb = fc.constantFrom('.a', '.b', '#id', '.a:hover', '[data-x]', 'p > span', '.a,.b');
const ruleArb = fc.tuple(selectorArb, bodyArb).map(([selector, body]) => selector + '{' + body + '}');
const containerArb = fc.oneof(
  bodyArb.map((body) => '@font-face{' + body + '}'),
  ruleArb.map((rule) => '@media (min-width:600px){' + rule + '}'),
  ruleArb.map((rule) => '@supports (display:grid){' + rule + '}'),
  bodyArb.map((body) => '@keyframes spin{from{' + body + '}to{' + body + '}}')
);
const unitArb = fc.oneof(ruleArb, containerArb);
const cssArb = fc.tuple(
  fc.array(unitArb, { minLength: 1, maxLength: MAX_UNITS }),
  fc.constantFrom('', '\n', ' ', '/*x*/')
).map(([units, sep]) => units.join(sep));

const simpleCssArb = ruleArb.map((rule) => rule);
const cleanBodyArb = fc.uniqueArray(propArb, { minLength: 1, maxLength: 3 })
  .chain((names) => fc.tuple(...names.map((name) => valueArb.map((value) => name + ':' + value))))
  .map((decls) => decls.join(';'));
const cleanRuleArb = fc.tuple(selectorArb, cleanBodyArb).map(([selector, body]) => selector + '{' + body + '}');
const styleBlockArb = fc.tuple(
  fc.constantFrom('', 'n1', 'n2'),
  fc.constantFrom('', 'print'),
  simpleCssArb
).map(([nonce, media, css]) => {
  const attrs = (nonce ? ' nonce="' + nonce + '"' : '') + (media ? ' media="' + media + '"' : '');
  return '<style' + attrs + '>' + css + '</style>';
});
const separatorArb = fc.constantFrom(
  '<div>x</div>',
  '<link rel="stylesheet" href="/a.css">',
  '<svg><style>.s{fill:red}</style></svg>',
  '<noscript><style>.n{color:red}</style></noscript>',
  ''
);
const htmlArb = fc.array(fc.oneof(styleBlockArb, separatorArb), { minLength: 1, maxLength: STRESS ? 20 : 8 })
  .map((parts) => parts.join(''));

function styleBodies(html) {
  const out = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = re.exec(html))) out.push(match[1]);
  return out;
}

describe('dedupeCss 属性', () => {
  it('幂等：二次去重字节不变且 changed=false', () => {
    checkProperty('dedupeCss-幂等', fc, fc.property(cssArb, (css) => {
      const first = dedupeCss(css);
      const second = dedupeCss(first.css);
      assert.strictEqual(second.css, first.css, '去重必须是不动点');
      assert.strictEqual(second.changed, false);
      return true;
    }));
  });

  it('字节不增：bytesSaved 等于长度差且非负', () => {
    checkProperty('dedupeCss-字节不增', fc, fc.property(cssArb, (css) => {
      const result = dedupeCss(css);
      assert.strictEqual(result.stats.bytesSaved, css.length - result.css.length);
      assert.ok(result.stats.bytesSaved >= 0);
      return true;
    }));
  });

  it('无冗余 CSS 原样保留：唯一选择器 + 规则内属性不重复时 changed=false', () => {
    const cleanCssArb = fc.array(cleanBodyArb, { minLength: 1, maxLength: MAX_UNITS })
      .map((bodies) => bodies.map((body, index) => '.s' + index + '{' + body + '}').join('\n'));
    checkProperty('dedupeCss-无冗余不改写', fc, fc.property(cleanCssArb, (css) => {
      const result = dedupeCss(css);
      assert.strictEqual(result.changed, false, '无冗余输入不得被改写');
      assert.strictEqual(result.css, css);
      return true;
    }));
  });

  it('同规则同属性同 important：仅保留最后一条声明', () => {
    const caseArb = fc.tuple(propArb, valueArb, valueArb).filter(([, first, last]) => first !== last);
    checkProperty('dedupeCss-同属性保留最后', fc, fc.property(caseArb, ([name, first, last]) => {
      const result = dedupeCss('.x{' + name + ':' + first + ';' + name + ':' + last + '}');
      assert.strictEqual(result.stats.declsDropped, 1);
      assert.ok(result.css.includes(name + ':' + last), '必须保留最后一条声明');
      assert.ok(!result.css.includes(name + ':' + first), '必须移除被覆盖的声明');
      return true;
    }));
  });

  it('!important 状态不同：同名声明全部保留（层叠语义不可假定）', () => {
    const caseArb = fc.tuple(propArb, valueArb, valueArb).filter(([, first, last]) => first !== last);
    checkProperty('dedupeCss-important 不混淆', fc, fc.property(caseArb, ([name, first, last]) => {
      const result = dedupeCss('.x{' + name + ':' + first + '!important;' + name + ':' + last + '}');
      assert.strictEqual(result.stats.declsDropped, 0);
      assert.ok(result.css.includes(name + ':' + first + '!important'));
      assert.ok(result.css.includes(name + ':' + last));
      return true;
    }));
  });

  it('A;B;A 反例：非相邻重复规则必须保留', () => {
    checkProperty('dedupeCss-非相邻保留', fc, fc.property(cleanRuleArb, cleanRuleArb, (ruleA, ruleB) => {
      fc.pre(ruleA !== ruleB);
      const result = dedupeCss(ruleA + ruleB + ruleA);
      assert.strictEqual(result.css.split(ruleA).length - 1, 2, '非相邻的 A 必须保留两处');
      assert.ok(result.css.includes(ruleB), '中间规则不得丢失');
      return true;
    }));
  });

  it('相邻完全重复规则折叠：仅保留前一条', () => {
    checkProperty('dedupeCss-相邻折叠', fc, fc.property(cleanRuleArb, (rule) => {
      const result = dedupeCss(rule + rule);
      assert.strictEqual(result.css.split(rule).length - 1, 1);
      assert.strictEqual(result.stats.rulesCollapsed, 1);
      return true;
    }));
  });

  it('@keyframes 内部不参与去重（动画帧语义不可丢）', () => {
    const frameArb = fc.tuple(bodyArb, bodyArb);
    checkProperty('dedupeCss-keyframes 保护', fc, fc.property(frameArb, ([fromBody, toBody]) => {
      const css = '@keyframes k{from{' + fromBody + '}to{' + toBody + '}}';
      const result = dedupeCss(css);
      assert.strictEqual(result.css, css);
      assert.strictEqual(result.changed, false);
      return true;
    }));
  });

  it('解析异常必抛：截断最后一个大括号后拒绝处理', () => {
    checkProperty('dedupeCss-不配平必抛', fc, fc.property(cssArb, (css) => {
      const balanced = dedupeCss(css).css.trimEnd();
      assert.strictEqual(balanced.charAt(balanced.length - 1), '}');
      assert.throws(() => dedupeCss(balanced.slice(0, -1)), Error);
      assert.throws(() => dedupeCss(null), TypeError);
      return true;
    }));
  });
});

describe('mergeStyleBlocks / dedupeStyleBlocks 属性', () => {
  it('保序：合并前后全部 style 内容按文档顺序拼接后一致', () => {
    checkProperty('mergeStyleBlocks-内容守恒', fc, fc.property(htmlArb, (html) => {
      const result = mergeStyleBlocks(html);
      assert.strictEqual(styleBodies(result.html).join(''), styleBodies(html).join(''));
      return true;
    }));
  });

  it('幂等且字节不增：二次合并无变化，bytesSaved 等于长度差', () => {
    checkProperty('mergeStyleBlocks-幂等', fc, fc.property(htmlArb, (html) => {
      const first = mergeStyleBlocks(html);
      const second = mergeStyleBlocks(first.html);
      assert.strictEqual(second.html, first.html);
      assert.strictEqual(second.changed, false);
      assert.strictEqual(first.stats.bytesSaved, html.length - first.html.length);
      assert.ok(first.stats.bytesSaved >= 0);
      return true;
    }));
  });

  it('同组相邻合并：nonce/media 一致才合并，非相邻不合并', () => {
    const bodiesArb = fc.tuple(bodyArb);
    checkProperty('mergeStyleBlocks-分组语义', fc, fc.property(bodiesArb, ([body]) => {
      const block = (nonce, media) => {
        const attrs = (nonce ? ' nonce="' + nonce + '"' : '') + (media ? ' media="' + media + '"' : '');
        return '<style' + attrs + '>' + body + '</style>';
      };
      const sameGroup = mergeStyleBlocks(block('n1', '') + block('n1', ''));
      assert.strictEqual(sameGroup.stats.blocksMerged, 1);
      assert.strictEqual(styleBodies(sameGroup.html).length, 1);
      const differentNonce = mergeStyleBlocks(block('n1', '') + block('n2', ''));
      assert.strictEqual(differentNonce.stats.blocksMerged, 0);
      const differentMedia = mergeStyleBlocks(block('', 'print') + block('', 'screen'));
      assert.strictEqual(differentMedia.stats.blocksMerged, 0);
      const linkBroken = mergeStyleBlocks(block('n1', '') + '<link rel="stylesheet" href="/x.css">' + block('n1', ''));
      assert.strictEqual(linkBroken.stats.blocksMerged, 0, '外链样式表必须截断合并');
      const svgBroken = mergeStyleBlocks(block('n1', '') + '<svg><style>.s{fill:red}</style></svg>' + block('n1', ''));
      assert.strictEqual(svgBroken.stats.blocksMerged, 0, 'SVG 内联样式必须截断合并');
      return true;
    }));
  });

  it('nonce 保留：合并块继承首块 nonce，缺省时由 options.nonce 补齐', () => {
    checkProperty('mergeStyleBlocks-nonce', fc, fc.property(bodyArb, bodyArb, (first, second) => {
      const withNonce = mergeStyleBlocks(
        '<style nonce="keep">' + first + '</style><style nonce="keep">' + second + '</style>'
      );
      assert.ok(withNonce.html.includes('nonce="keep"'), '首块 nonce 必须保留');
      const withoutNonce = mergeStyleBlocks(
        '<style>' + first + '</style><style>' + second + '</style>',
        { nonce: 'opt' }
      );
      assert.ok(withoutNonce.html.includes('nonce="opt"'), 'options.nonce 必须补齐');
      const stillWithout = mergeStyleBlocks('<style>' + first + '</style><style>' + second + '</style>');
      assert.ok(!stillWithout.html.includes('nonce='), '无 nonce 输入不得凭空生成 nonce');
      return true;
    }));
  });

  it('dedupeStyleBlocks：幂等且仅重写 style 块内容', () => {
    const dupHtmlArb = fc.tuple(simpleCssArb, fc.constantFrom('', 'n1'), fc.constantFrom('', 'print'))
      .map(([css, nonce, media]) => {
        const attrs = (nonce ? ' nonce="' + nonce + '"' : '') + (media ? ' media="' + media + '"' : '');
        return '<div>keep</div><style' + attrs + '>' + css + css + '</style>';
      });
    checkProperty('dedupeStyleBlocks-幂等', fc, fc.property(dupHtmlArb, (html) => {
      const first = dedupeStyleBlocks(html);
      const second = dedupeStyleBlocks(first.html);
      assert.strictEqual(second.html, first.html);
      assert.strictEqual(second.changed, false);
      assert.ok(first.html.includes('<div>keep</div>'), 'style 块之外的内容不得被改写');
      return true;
    }));
  });
});

describe('压缩选项装配属性', () => {
  it('buildHtmlMinifyOptions：默认字段逐项等于基线，激进选项仅在 aggressive 时叠加', () => {
    const optionsArb = fc.record({ aggressive: fc.boolean(), removeComments: fc.boolean() });
    const baseline = JSON.stringify(HTML_MINIFY_BASELINE_OPTIONS);
    const overridden = new Set(Object.keys(HTML_MINIFY_AGGRESSIVE_OPTIONS));
    checkProperty('buildHtmlMinifyOptions-装配', fc, fc.property(optionsArb, (options) => {
      const result = buildHtmlMinifyOptions(options);
      assert.strictEqual(result.keep_comments, !options.removeComments);
      for (const key of Object.keys(HTML_MINIFY_BASELINE_OPTIONS)) {
        if (key === 'keep_comments') continue;
        if (options.aggressive && overridden.has(key)) continue;
        assert.strictEqual(result[key], HTML_MINIFY_BASELINE_OPTIONS[key], '基线字段不得漂移：' + key);
      }
      if (options.aggressive) {
        for (const [key, value] of Object.entries(HTML_MINIFY_AGGRESSIVE_OPTIONS)) {
          assert.strictEqual(result[key], value, '激进选项必须生效：' + key);
        }
      }
      assert.strictEqual(JSON.stringify(HTML_MINIFY_BASELINE_OPTIONS), baseline, '基线常量不得被原地修改');
      return true;
    }));
  });

  it('buildObfuscateOptions：预设回退、种子规范化、危险项恒关闭且装配确定', () => {
    const presetArb = fc.oneof(fc.constantFrom('low', 'medium', 'high'), fc.string({ maxLength: 6 }));
    const seedArb = fc.oneof(
      fc.integer({ min: 0, max: 1000000 }),
      fc.integer({ min: -100, max: -1 }),
      fc.constantFrom(1.5, 'x', null, undefined)
    );
    checkProperty('buildObfuscateOptions-装配', fc, fc.property(presetArb, seedArb, (preset, seed) => {
      const result = buildObfuscateOptions(preset, seed);
      const level = ['low', 'medium', 'high'].includes(preset) ? preset : 'medium';
      assert.strictEqual(result.renameGlobals, false);
      assert.strictEqual(result.renameProperties, false);
      assert.strictEqual(result.selfDefending, false);
      assert.strictEqual(result.controlFlowFlattening, level === 'high');
      assert.strictEqual(result.stringArray, level === 'medium' || level === 'high');
      assert.ok(Number.isInteger(result.seed) && result.seed >= 0, '种子必须规范化为非负整数');
      assert.deepStrictEqual(buildObfuscateOptions(preset, seed), result, '装配必须确定');
      return true;
    }));
  });

  it('compactJsonText：合法 JSON 往返保值且二次压缩不再变化', () => {
    checkProperty('compactJsonText-往返幂等', fc, fc.property(fc.jsonValue({ maxDepth: 5 }), (value) => {
      const pretty = JSON.stringify(value, null, 2);
      const result = compactJsonText(pretty);
      assert.deepStrictEqual(JSON.parse(result.text), value);
      assert.strictEqual(compactJsonText(result.text).changed, false);
      return true;
    }));
  });

  it('compressionEnhancementPlan：总开关/active 联动与字段语义确定', () => {
    const configArb = fc.record({
      enabled: fc.boolean(),
      html: fc.record({ enabled: fc.boolean(), aggressive: fc.boolean(), removeComments: fc.boolean() }),
      css: fc.record({ enabled: fc.boolean(), mergeInlineStyles: fc.boolean(), dedupe: fc.boolean() }),
      js: fc.record({
        enabled: fc.boolean(),
        minify: fc.boolean(),
        obfuscate: fc.record({ enabled: fc.boolean(), preset: fc.oneof(fc.constantFrom('low', 'medium', 'high'), fc.string({ maxLength: 4 })), seed: fc.integer({ min: -5, max: 1000 }) })
      }),
      json: fc.record({ enabled: fc.boolean() }),
      exclude: fc.array(fc.string({ maxLength: 8 }), { maxLength: 3 })
    });
    checkProperty('compressionEnhancementPlan-开关语义', fc, fc.property(configArb, fc.boolean(), (config, active) => {
      const plan = compressionEnhancementPlan(config, active);
      assert.deepStrictEqual(compressionEnhancementPlan(config, active), plan, '计划必须确定');
      const on = active === true && config.enabled !== false;
      assert.strictEqual(plan.active, on);
      if (!on) {
        for (const key of ['htmlAggressive', 'cssMergeInlineStyles', 'cssDedupe', 'jsMinify', 'jsObfuscate', 'jsonCompact']) {
          assert.strictEqual(plan[key], false, '未激活时步骤必须全部关闭：' + key);
        }
      } else {
        assert.strictEqual(plan.cssMergeInlineStyles, config.css.enabled !== false && config.css.mergeInlineStyles !== false);
        assert.strictEqual(plan.cssDedupe, config.css.enabled !== false && config.css.dedupe !== false);
        assert.strictEqual(plan.jsMinify, config.js.enabled !== false && config.js.minify !== false);
        assert.strictEqual(plan.jsObfuscate, plan.jsMinify && config.js.obfuscate.enabled === true);
        assert.strictEqual(plan.jsonCompact, config.json.enabled !== false);
      }
      assert.ok(['low', 'medium', 'high'].includes(plan.jsObfuscatePreset));
      assert.ok(Number.isInteger(plan.jsObfuscateSeed) && plan.jsObfuscateSeed >= 0);
      assert.strictEqual(enhancementWorkActive(plan), plan.active === true && (
        plan.htmlAggressive || plan.htmlRemoveComments === false || plan.cssMergeInlineStyles
        || plan.cssDedupe || plan.jsMinify || plan.jsObfuscate || plan.jsonCompact
      ));
      return true;
    }));
  });
});
