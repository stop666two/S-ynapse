'use strict';
// 页面内联 <style> 合并与 CSS 保守去重单测（scripts/lib/css-merge.js）。
// 重点证明「只做可证明安全的变换」：样式源顺序不可跨越、非相邻重复必须保留、
// !important 语义不可破坏、SVG/noscript 内样式绝不外提。
// 运行：node --test scripts/css-merge.test.js（由 npm test 统一收集）。
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeStyleBlocks, dedupeStyleBlocks, dedupeCss } = require('./lib/css-merge');

describe('mergeStyleBlocks（页面内联 style 合并）', () => {
  test('同 nonce 的相邻块按原顺序合并为一块，nonce 保留', () => {
    const html = '<head><style nonce="N1">.a{color:red}</style><style nonce="N1">.b{color:blue}</style></head>';
    const result = mergeStyleBlocks(html, {});
    assert.equal(result.changed, true);
    assert.equal(result.html, '<head><style nonce="N1">.a{color:red}.b{color:blue}</style></head>');
    assert.equal(result.stats.blocksMerged, 1);
    assert.ok(result.stats.bytesSaved > 0);
  });

  test('三块同 nonce 合并为一块且内容顺序保持', () => {
    const html = '<style nonce="N">.x{}</style><style nonce="N">.y{}</style><style nonce="N">.z{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.equal(result.html, '<style nonce="N">.x{}.y{}.z{}</style>');
    assert.equal(result.stats.blocksMerged, 2);
  });

  test('nonce 不同不合并（保守）', () => {
    const html = '<style nonce="A">.a{}</style><style nonce="B">.b{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.equal(result.changed, false);
    assert.equal(result.html, html);
  });

  test('无 nonce 块使用 options.nonce 作为合并块缺省 nonce', () => {
    const html = '<style>.a{}</style><style>.b{}</style>';
    const result = mergeStyleBlocks(html, { nonce: 'FALLBACK' });
    assert.equal(result.html, '<style nonce="FALLBACK">.a{}.b{}</style>');
  });

  test('media 属性块按 media 值分组各自合并，media 保留', () => {
    const html = '<style nonce="N">.a{}</style>'
      + '<style nonce="N" media="print">.b{}</style><style nonce="N" media="print">.c{}</style>'
      + '<style nonce="N">.d{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.equal(result.html, '<style nonce="N">.a{}</style>'
      + '<style nonce="N" media="print">.b{}.c{}</style>'
      + '<style nonce="N">.d{}</style>');
    assert.equal(result.stats.blocksMerged, 1);
    assert.equal((result.html.match(/<style/g) || []).length, 3);
  });

  test('外链 link 截断合并（跨 link 会改变层叠顺序）', () => {
    const html = '<style nonce="N">.a{}</style><link rel="stylesheet" href="/x.css"><style nonce="N">.b{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.equal(result.changed, false);
    assert.equal(result.html, html);
  });

  test('rel 多值 stylesheet 同样视为截断源', () => {
    const html = '<style nonce="N">.a{}</style><link rel="preload stylesheet" href="/x.css"><style nonce="N">.b{}</style>';
    assert.equal(mergeStyleBlocks(html, {}).changed, false);
  });

  test('SVG 内 style 不参与合并且作为截断源（前后块不跨越）', () => {
    const html = '<style nonce="N">.a{}</style><svg><style>.s{fill:red}</style></svg><style nonce="N">.b{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.equal(result.changed, false);
    assert.equal(result.html, html);
  });

  test('noscript 内 style 不参与合并', () => {
    const html = '<noscript><style>.n{}</style></noscript><style nonce="N">.a{}</style><style nonce="N">.b{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.ok(result.html.includes('<noscript><style>.n{}</style></noscript>'), 'noscript 内容原样保留');
    assert.ok(result.html.includes('<style nonce="N">.a{}.b{}</style>'), 'noscript 之外的块照常合并');
  });

  test('script 内字符串中的伪 style 不参与扫描', () => {
    const html = '<script>var s = "<style>.fake{}</style>";</script><style nonce="N">.a{}</style><style nonce="N">.b{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.ok(result.html.includes('"<style>.fake{}</style>"'), '脚本字符串保持原样');
    assert.ok(result.html.endsWith('<style nonce="N">.a{}.b{}</style>'));
  });

  test('无 style 页面为 no-op（stats 全 0）', () => {
    const html = '<html><head></head><body>hi</body></html>';
    const result = mergeStyleBlocks(html, { nonce: 'N' });
    assert.equal(result.changed, false);
    assert.equal(result.html, html);
    assert.deepEqual(result.stats, { blocksMerged: 0, rulesCollapsed: 0, declsDropped: 0, bytesSaved: 0 });
  });

  test('无引号属性（minify-html 形态）解析正确，id 在合并时丢弃', () => {
    const html = '<style nonce="N">.a{}</style><style nonce="N" id=customCSS>.b{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.equal(result.html, '<style nonce="N">.a{}.b{}</style>');
  });

  test('单块页面不受影响', () => {
    const html = '<style nonce="N" id=customCSS>.only{}</style>';
    const result = mergeStyleBlocks(html, {});
    assert.equal(result.changed, false);
  });

  test('HTML 标签不配平抛出（调用方跳过该文件）', () => {
    assert.throws(() => mergeStyleBlocks('<style nonce="N">.a{}</style><style nonce="N">.b{}', {}), /配平/);
  });

  test('CSS 括号不配平抛出', () => {
    assert.throws(() => mergeStyleBlocks('<style nonce="N">.a{color:red</style><style nonce="N">.b{}</style>', {}), /配平/);
  });

  test('属性引号未闭合抛出', () => {
    assert.throws(() => mergeStyleBlocks('<style nonce="N>.a{}</style>', {}), /引号未闭合/);
  });

  test('非字符串入参抛 TypeError', () => {
    assert.throws(() => mergeStyleBlocks(null, {}), TypeError);
  });
});

describe('dedupeStyleBlocks（页面内 style 块去重接线）', () => {
  test('对合并前后的块统一去重，SVG 内不动', () => {
    const html = '<style nonce="N">.a{color:red;color:blue}</style><svg><style>.s{opacity:0;opacity:0}</style></svg>';
    const result = dedupeStyleBlocks(html);
    assert.equal(result.html, '<style nonce="N">.a{color:blue}</style><svg><style>.s{opacity:0;opacity:0}</style></svg>');
    assert.equal(result.stats.declsDropped, 1);
  });
});

describe('dedupeCss（保守 CSS 去重）', () => {
  test('规则内同属性重复声明保留最后一条', () => {
    const result = dedupeCss('.a{color:red;color:blue;background:white}');
    assert.equal(result.css, '.a{color:blue;background:white}');
    assert.equal(result.stats.declsDropped, 1);
    assert.ok(result.stats.bytesSaved > 0);
  });

  test('!important 与普通声明混合时不动（层叠语义可能改变）', () => {
    const input = '.a{color:red!important;color:blue}';
    const result = dedupeCss(input);
    assert.equal(result.css, input);
    assert.equal(result.stats.declsDropped, 0);
  });

  test('同 !important 状态的重复声明保留最后一条，!important 保留', () => {
    const result = dedupeCss('.a{color:red!important;color:blue!important}');
    assert.equal(result.css, '.a{color:blue!important}');
  });

  test('相邻且完全相同的规则折叠为一条（保留前一条）', () => {
    const result = dedupeCss('.a{color:red}.a{color:red}');
    assert.equal(result.css, '.a{color:red}');
    assert.equal(result.stats.rulesCollapsed, 1);
  });

  test('空白差异不影响相邻重复判定', () => {
    const result = dedupeCss('.a { color:red }\n  .a{color:red}');
    assert.equal(result.css, '.a { color:red }');
  });

  test('非相邻重复不折叠（A;B;A 保留两个 A）', () => {
    const input = '.a{color:red}.b{color:blue}.a{color:red}';
    const result = dedupeCss(input);
    assert.equal(result.css, input);
    assert.equal(result.stats.rulesCollapsed, 0);
    assert.equal((result.css.match(/\.a\{/g) || []).length, 2);
  });

  test('注释分隔的重复规则不折叠（仅空白分隔才安全）', () => {
    const input = '.a{color:red}/*keep*/.a{color:red}';
    const result = dedupeCss(input);
    assert.equal(result.css, input);
  });

  test('@media 内部不跨块合并，同层相邻重复在块内折叠', () => {
    const cross = '@media(min-width:1px){.a{color:red}}.a{color:red}';
    assert.equal(dedupeCss(cross).css, cross);
    const inner = '@media(min-width:1px){.a{color:red}.a{color:red}}';
    assert.equal(dedupeCss(inner).css, '@media(min-width:1px){.a{color:red}}');
  });

  test('@keyframes 内部结构整体不动', () => {
    const input = '@keyframes x{0%{opacity:0;opacity:0}0%{opacity:0}100%{opacity:1}}';
    const result = dedupeCss(input);
    assert.equal(result.css, input);
    assert.equal(result.stats.declsDropped, 0);
    assert.equal(result.stats.rulesCollapsed, 0);
  });

  test('@font-face 声明去重（同描述符后者胜）', () => {
    const result = dedupeCss('@font-face{font-family:x;src:url(a.woff2);src:url(b.woff2)}');
    assert.equal(result.css, '@font-face{font-family:x;src:url(b.woff2)}');
    assert.equal(result.stats.declsDropped, 1);
  });

  test('@supports 内部同层折叠', () => {
    assert.equal(dedupeCss('@supports(display:grid){.a{color:red}.a{color:red}}').css,
      '@supports(display:grid){.a{color:red}}');
  });

  test('声明值内的分号与字符串不影响切分', () => {
    const input = '.a{font-family:"a;b";color:red;color:blue}';
    assert.equal(dedupeCss(input).css, '.a{font-family:"a;b";color:blue}');
  });

  test('自定义属性值内的花括号整体保留（不递归、不去重）', () => {
    const input = '.a{--x:{color:red};color:blue}';
    const result = dedupeCss(input);
    assert.equal(result.css, input);
  });

  test('含注释前缀的声明不参与去重（保守）', () => {
    const input = '.a{/*c*/color:red;color:blue}';
    assert.equal(dedupeCss(input).css, input);
  });

  test('清理多余声明后幂等', () => {
    const once = dedupeCss('.a{color:red;color:blue}.a{color:blue}').css;
    const twice = dedupeCss(once);
    assert.equal(twice.changed, false);
    assert.equal(twice.css, once);
  });

  test('空 CSS 与纯声明序列为 no-op', () => {
    for (const input of ['', '.a{}', 'a{color:red}']) {
      const result = dedupeCss(input);
      assert.equal(result.changed, false, input);
      assert.equal(result.css, input);
    }
  });

  test('解析异常抛出（括号未配平 / 声明列表出现花括号）', () => {
    assert.throws(() => dedupeCss('.a{color:red'), /配平|未闭合/);
    assert.throws(() => dedupeCss('.a{color:red}}'), /配平|顺序/);
  });

  test('非字符串入参抛 TypeError', () => {
    assert.throws(() => dedupeCss(undefined), TypeError);
  });
});
