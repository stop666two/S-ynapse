'use strict';
// 压缩流水线（C2）纯函数与装配单测：JSON 去空白、豁免与内容寻址跳过、HTML 激进选项装配、
// 增强计划（compressionEnhancementPlan）与 --compression-override 深合并校验；
// 以及 CSS 合并/去重解析异常的跳过降级路径（不进入失败账本）。
// 运行：node --test scripts/compression-pipeline.test.js（由 npm test 统一收集）。
const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  HTML_MINIFY_BASELINE_OPTIONS,
  buildHtmlMinifyOptions,
  compactJsonText,
  compressionEnhancementPlan,
  enhancementWorkActive,
  jsonSkipReason,
  needsJsonCompaction
} = require('./lib/compression-steps');
const {
  DEFAULT_COMPRESSION,
  mergeCompressionOverride
} = require('./lib/compression-config');
const { createMinifyModule } = require('./build/minify.js');
const { getAllFiles } = require('./build/fs-utils.js');
const { renderBuildReportHtml } = require('./lib/build-report-html.js');

describe('JSON 去空白（compactJsonText / needsJsonCompaction）', () => {
  test('含换行的嵌套结构压缩为单行且语义等价', () => {
    const input = '{\n  "a": {\n    "b": [1, 2, {"c": true}]\n  },\n  "d": null\n}\n';
    const { text, changed } = compactJsonText(input);
    assert.equal(changed, true);
    assert.equal(text, '{"a":{"b":[1,2,{"c":true}]},"d":null}');
    assert.deepEqual(JSON.parse(text), JSON.parse(input));
  });

  test('Unicode 内容原样保留（中文与 emoji 不转义）', () => {
    const input = '{\n  "标题": "值 é 😀",\n  "列表": ["中文"]\n}';
    const { text } = compactJsonText(input);
    assert.ok(text.includes('"标题":"值 é 😀"'), '中文与 emoji 必须原样输出：' + text);
    assert.ok(text.includes('"列表":["中文"]'), '中文数组必须原样输出：' + text);
    assert.deepEqual(JSON.parse(text), JSON.parse(input));
  });

  test('`<` 统一转义为 \\u003c：压缩不得还原上游防注入转义（解析后值不变）', () => {
    const input = '{\n  "title": "<script>alert(1)</script>",\n  "nested": {"x": "a<b>c"}\n}';
    const { text } = compactJsonText(input);
    assert.ok(!text.includes('<'), '压缩输出不得含裸 "<"：' + text);
    assert.ok(text.includes('\\u003cscript'), '必须保留 JSON 等价转义');
    assert.deepEqual(JSON.parse(text), JSON.parse(input), '解析后值必须一致');
    assert.deepEqual(compactJsonText(text), { text, changed: false }, '转义后必须幂等');
  });

  test('键序保持（非数值键按插入顺序）', () => {
    const { text } = compactJsonText('{\n  "b": 1,\n  "a": 2,\n  "c": 3\n}');
    assert.equal(text, '{"b":1,"a":2,"c":3}');
  });

  test('已是紧凑单行：不解析、原样返回', () => {
    const input = '{"a":1}';
    const result = compactJsonText(input);
    assert.deepEqual(result, { text: input, changed: false });
    assert.equal(needsJsonCompaction(input), false);
  });

  test('幂等：压缩结果再次压缩无变化', () => {
    const { text } = compactJsonText('{\n  "a": 1\n}');
    assert.deepEqual(compactJsonText(text), { text, changed: false });
  });

  test('含换行但非法 JSON：抛 SyntaxError（调用方保留原文件）', () => {
    assert.throws(() => compactJsonText('{\n  "a":\n}'), SyntaxError);
  });

  test('非字符串入参抛 TypeError', () => {
    assert.throws(() => compactJsonText(null), TypeError);
    assert.throws(() => compactJsonText(undefined), TypeError);
  });
});

describe('jsonSkipReason（豁免与内容寻址跳过）', () => {
  const exclude = DEFAULT_COMPRESSION.exclude;

  test('内容寻址的 assets/config.<hash>.json 跳过（又名由内容派生，重写会破坏引用）', () => {
    assert.equal(jsonSkipReason('assets/config.1943491422.json', exclude), 'content-addressed');
    assert.equal(jsonSkipReason('assets/config.a1b2c3d4e5.json', exclude), 'content-addressed');
  });

  test('豁免名单命中返回 excluded（vendor / 报告 / 二进制目录）', () => {
    assert.equal(jsonSkipReason('assets/vendor/x.json', exclude), 'excluded');
    assert.equal(jsonSkipReason('build-report.html', exclude), 'excluded');
    assert.equal(jsonSkipReason('media/data.json', exclude), 'excluded');
  });

  test('普通产物 JSON 是压缩候选（search-index / feed.json）', () => {
    assert.equal(jsonSkipReason('zh/search-index.json', exclude), '');
    assert.equal(jsonSkipReason('zh/feed.json', exclude), '');
    assert.equal(jsonSkipReason('manifest.json', exclude), '');
  });

  test('Windows 路径分隔符与前导斜杠归一化后同一判定', () => {
    assert.equal(jsonSkipReason('assets\\config.1943491422.json', exclude), 'content-addressed');
    assert.equal(jsonSkipReason('/zh/feed.json', exclude), '');
  });

  test('自定义豁免名单整体替换并生效', () => {
    assert.equal(jsonSkipReason('zh/search-index.json', ['zh/**']), 'excluded');
    assert.equal(jsonSkipReason('zh/search-index.json', ['en/**']), '');
  });
});

describe('buildHtmlMinifyOptions（选项装配）', () => {
  test('默认（非激进）与既有基线硬编码选项逐字段一致', () => {
    assert.deepEqual(buildHtmlMinifyOptions(), {
      keep_comments: false,
      minify_js: true,
      minify_css: true,
      minify_doctype: false,
      keep_html_and_head_opening_tags: true,
      keep_closing_tags: true,
      preserve_brace_template_syntax: true
    });
    assert.deepEqual(buildHtmlMinifyOptions({ aggressive: false }), buildHtmlMinifyOptions());
  });

  test('removeComments=false 保留注释（默认 true 与基线 keep_comments=false 一致）', () => {
    assert.equal(buildHtmlMinifyOptions({ removeComments: true }).keep_comments, false);
    assert.equal(buildHtmlMinifyOptions({ removeComments: false }).keep_comments, true);
  });

  test('aggressive=true 叠加库真实支持的实验选项，且不污染基线常量', () => {
    const opts = buildHtmlMinifyOptions({ aggressive: true });
    assert.equal(opts.keep_closing_tags, false, '省略可选闭合标签');
    assert.equal(opts.keep_html_and_head_opening_tags, false, '省略无属性 html/head 开标签');
    assert.equal(opts.minify_doctype, true);
    assert.equal(opts.allow_optimal_entities, true);
    assert.equal(opts.allow_noncompliant_unquoted_attribute_values, true, '属性值去引号折叠');
    assert.equal(opts.allow_removing_spaces_between_attributes, true, '属性间空格折叠');
    assert.equal(opts.remove_bangs, true);
    assert.equal(opts.remove_processing_instructions, true);
    assert.equal(opts.keep_comments, false, '基线字段保持');
    assert.equal(opts.minify_js, true, '基线字段保持');
    assert.equal(opts.preserve_brace_template_syntax, true, '基线字段保持');
    assert.equal(HTML_MINIFY_BASELINE_OPTIONS.keep_closing_tags, true, '基线常量不得被修改');
    assert.equal(HTML_MINIFY_BASELINE_OPTIONS.minify_doctype, false, '基线常量不得被修改');
  });
});

describe('compressionEnhancementPlan（增强计划装配）', () => {
  test('默认配置 + 压缩启用：JSON/HTML 默认关激进、CSS 待接入、混淆默认关', () => {
    const plan = compressionEnhancementPlan(DEFAULT_COMPRESSION, true);
    assert.equal(plan.active, true);
    assert.equal(plan.htmlAggressive, false);
    assert.equal(plan.htmlRemoveComments, true);
    assert.equal(plan.cssMergeInlineStyles, true);
    assert.equal(plan.cssDedupe, true);
    assert.equal(plan.jsObfuscate, false);
    assert.equal(plan.jsObfuscatePreset, 'medium');
    assert.equal(plan.jsObfuscateSeed, 0);
    assert.equal(plan.jsonCompact, true);
    assert.equal(plan.verifyHeadless, true);
    assert.equal(plan.fallbackOnFailure, true);
    assert.deepEqual(plan.exclude, DEFAULT_COMPRESSION.exclude);
  });

  test('serve/watch（active=false）或总开关关闭：全部步骤为 false', () => {
    const off = compressionEnhancementPlan(DEFAULT_COMPRESSION, false);
    assert.equal(off.active, false);
    for (const key of ['htmlAggressive', 'cssMergeInlineStyles', 'cssDedupe', 'jsObfuscate', 'jsonCompact']) {
      assert.equal(off[key], false, key + ' 必须为 false');
    }
    const disabled = compressionEnhancementPlan({ enabled: false }, true);
    assert.equal(disabled.active, false);
    assert.equal(disabled.jsonCompact, false);
  });

  test('显式开启项透传：aggressive / removeComments / 混淆预设与种子', () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_COMPRESSION));
    cfg.html.aggressive = true;
    cfg.html.removeComments = false;
    cfg.js.obfuscate.enabled = true;
    cfg.js.obfuscate.preset = 'high';
    cfg.js.obfuscate.seed = 42;
    const plan = compressionEnhancementPlan(cfg, true);
    assert.equal(plan.htmlAggressive, true);
    assert.equal(plan.htmlRemoveComments, false);
    assert.equal(plan.jsObfuscate, true);
    assert.equal(plan.jsObfuscatePreset, 'high');
    assert.equal(plan.jsObfuscateSeed, 42);
  });

  test('压缩开关级联：html.enabled=false 关闭激进但保留注释基线；json.enabled=false 关闭 JSON 步骤', () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULT_COMPRESSION));
    cfg.html.enabled = false;
    cfg.html.aggressive = true;
    cfg.html.removeComments = false;
    cfg.json.enabled = false;
    cfg.js.enabled = false;
    const plan = compressionEnhancementPlan(cfg, true);
    assert.equal(plan.htmlAggressive, false);
    assert.equal(plan.htmlRemoveComments, true, 'html.enabled=false 时不应用 HTML 增强选项');
    assert.equal(plan.jsonCompact, false);
    assert.equal(plan.jsObfuscate, false);
  });
});

describe('enhancementWorkActive（无头对比触发条件）', () => {
  test('默认配置：存在会改变产物的增强步骤', () => {
    assert.equal(enhancementWorkActive(compressionEnhancementPlan(DEFAULT_COMPRESSION, true)), true);
  });

  test('serve/watch 或总开关关闭：无增强工作', () => {
    assert.equal(enhancementWorkActive(compressionEnhancementPlan(DEFAULT_COMPRESSION, false)), false);
    assert.equal(enhancementWorkActive(compressionEnhancementPlan({ enabled: false }, true)), false);
    assert.equal(enhancementWorkActive(null), false);
  });

  test('全部增强步骤关闭：无工作；仅 removeComments=false 也算改变产物', () => {
    const off = JSON.parse(JSON.stringify(DEFAULT_COMPRESSION));
    off.html.enabled = false;
    off.css.enabled = false;
    off.js.enabled = false;
    off.json.enabled = false;
    assert.equal(enhancementWorkActive(compressionEnhancementPlan(off, true)), false);
    const keepComments = JSON.parse(JSON.stringify(DEFAULT_COMPRESSION));
    keepComments.html.removeComments = false;
    assert.equal(enhancementWorkActive(compressionEnhancementPlan(keepComments, true)), true);
  });
});

describe('mergeCompressionOverride（--compression-override 深合并）', () => {
  test('深合并：仅覆盖显式字段，其余保留基础配置', () => {
    const merged = mergeCompressionOverride(DEFAULT_COMPRESSION, { enabled: false, html: { aggressive: true } });
    assert.deepStrictEqual(merged.errors, []);
    assert.equal(merged.config.enabled, false);
    assert.equal(merged.config.html.aggressive, true);
    assert.equal(merged.config.html.removeComments, true, '未覆盖键保留');
    assert.equal(merged.config.json.enabled, true, '未覆盖键保留');
    assert.deepStrictEqual(merged.config.exclude, DEFAULT_COMPRESSION.exclude, '未覆盖数组保留');
  });

  test('exclude 数组整体替换（不与基础名单拼接）', () => {
    const merged = mergeCompressionOverride(DEFAULT_COMPRESSION, { exclude: ['keep/**'] });
    assert.deepStrictEqual(merged.errors, []);
    assert.deepStrictEqual(merged.config.exclude, ['keep/**']);
  });

  test('非法覆盖值由 validateCompression 拦截并带 compression-override 前缀', () => {
    const bad = mergeCompressionOverride(DEFAULT_COMPRESSION, { enabled: 'yes', js: { obfuscate: { seed: -1 } } });
    assert.equal(bad.errors.length, 2);
    assert.ok(bad.errors.some(e => /compression-override\.enabled/.test(e)));
    assert.ok(bad.errors.some(e => /compression-override\.js\.obfuscate\.seed/.test(e)));
  });

  test('覆盖对象非普通对象：报错并返回基础配置', () => {
    const bad = mergeCompressionOverride(DEFAULT_COMPRESSION, [1, 2]);
    assert.equal(bad.errors.length, 1);
    assert.match(bad.errors[0], /顶层必须是对象/);
    assert.equal(bad.config.enabled, DEFAULT_COMPRESSION.enabled);
  });

  test('不修改传入的基础配置对象（默认值注册表不被污染）', () => {
    const before = JSON.stringify(DEFAULT_COMPRESSION);
    mergeCompressionOverride(DEFAULT_COMPRESSION, { enabled: false, html: { aggressive: true } });
    assert.equal(JSON.stringify(DEFAULT_COMPRESSION), before);
  });
});

describe('CSS 合并/去重跳过降级（不进入失败账本）', () => {
  const BUILD_CONFIG = { site: { build: { minifyHTML: false, minifyCSS: false, minifyJS: false, enableCacheBusting: false } } };
  const savedVerify = process.env.SYNAPSE_COMPRESSION_VERIFY;

  afterEach(() => {
    if (savedVerify === undefined) delete process.env.SYNAPSE_COMPRESSION_VERIFY;
    else process.env.SYNAPSE_COMPRESSION_VERIFY = savedVerify;
  });

  function makeDist() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-css-skip-'));
    fs.mkdirSync(path.join(dir, 'assets', 'css'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'),
      '<style nonce="N">.a{color:red}</style><style nonce="N">.b{color:blue}', 'utf-8');
    fs.writeFileSync(path.join(dir, 'assets', 'css', 'bad.css'), '.c{color:red', 'utf-8');
    return dir;
  }

  test('解析异常页面/CSS 只计入 skipped 统计，不调用 recordBuildFailure 且保留原文件', async () => {
    process.env.SYNAPSE_COMPRESSION_VERIFY = 'off';
    const dir = makeDist();
    const failures = [];
    try {
      const mod = createMinifyModule({
        distDir: dir,
        cacheBustManifestPath: path.join(dir, 'cache-bust-manifest.json'),
        bundleActive: true,
        getCompression: () => ({ config: DEFAULT_COMPRESSION, active: true, errors: [], warnings: [], override: '' }),
        getAllFiles,
        recordBuildFailure: (stage, message, options) => failures.push({ stage, message, options }),
        minifyHtmlNode: null,
        CleanCSS: null,
        terser: null,
        getBundleFiles: () => [],
        compressionBaselineDir: path.join(dir, '.baseline'),
        compressionVerifyReportPath: path.join(dir, '.verify.json'),
        compressionVerifyProfileDir: path.join(dir, '.profile')
      });
      const stats = await mod.minifyAll(BUILD_CONFIG);
      assert.equal(failures.length, 0, '跳过不得进入失败账本：' + JSON.stringify(failures));
      assert.equal(stats.cssSkips.count, 2, '两个解析异常文件都必须计入跳过统计');
      assert.deepEqual(stats.cssSkips.details.map((d) => d.file).sort(), ['assets/css/bad.css', 'index.html']);
      for (const detail of stats.cssSkips.details) {
        assert.match(detail.reason, /配平|未闭合/, '跳过明细必须携带原因：' + JSON.stringify(detail));
      }
      assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf-8'),
        '<style nonce="N">.a{color:red}</style><style nonce="N">.b{color:blue}', '解析异常页面必须保留原文件');
      assert.equal(fs.readFileSync(path.join(dir, 'assets', 'css', 'bad.css'), 'utf-8'), '.c{color:red',
        '解析异常 CSS 必须保留原文件');
      assert.equal(stats.enhancements.css.skipped, 2, '增强统计必须携带跳过计数');
      const html = renderBuildReportHtml({ compression: stats, failures });
      assert.ok(html.includes('CSS 合并/去重跳过: 2 项（保留原文件；不计入失败账本）'));
      assert.ok(html.includes('<code>index.html</code>: '));
      assert.ok(html.includes('<code>assets/css/bad.css</code>: '));
      assert.ok(html.includes('id="failures"'), '报告必须包含失败清单区块');
      assert.ok(html.includes('（无）'), '跳过不得渲染为压缩失败');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
