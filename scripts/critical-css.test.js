'use strict';
// 关键 CSS 提取（scripts/lib/critical-css.js）单元测试：
// 覆盖选择器白名单、同规则选择器子集、容器递归、keyframes 引用判定、变量闭包裁剪与解析异常。
const test = require('node:test');
const assert = require('node:assert');
const { extractCriticalCss, isCriticalSelector, pickCriticalSelectors } = require('./lib/critical-css');

test('isCriticalSelector：首屏区域命中、交互态与未知组件不命中', () => {
  assert.strictEqual(isCriticalSelector(':root'), true);
  assert.strictEqual(isCriticalSelector('[data-theme=dark]'), true);
  assert.strictEqual(isCriticalSelector('body'), true);
  assert.strictEqual(isCriticalSelector('html.save-data'), true);
  assert.strictEqual(isCriticalSelector('.site-header'), true);
  assert.strictEqual(isCriticalSelector('.post-card-image'), true);
  assert.strictEqual(isCriticalSelector('.hero h1'), true);
  assert.strictEqual(isCriticalSelector('.post-content p'), true);
  assert.strictEqual(isCriticalSelector('.unknown-component'), false);
  // 侧栏挂件位于首屏列内，必须内联以避免全量样式到达时的可见重排（CLS）。
  assert.strictEqual(isCriticalSelector('.widget-title'), true);
  assert.strictEqual(isCriticalSelector('.sidebar-widget'), true);
  // 首卡媒体包装与叠层的绘制属性决定 LCP 图是否在样式切换后重绘。
  assert.strictEqual(isCriticalSelector('.card-media'), true);
  assert.strictEqual(isCriticalSelector('.card-overlay'), true);
  assert.strictEqual(isCriticalSelector('.post-content pre'), false);
  assert.strictEqual(isCriticalSelector('.post-card:hover'), false);
  assert.strictEqual(isCriticalSelector('.nav-boost-panel'), false);
  // 无 hidden 属性、依赖 CSS 隐藏的覆盖层必须保留，否则未样式化内容暴露在首屏。
  assert.strictEqual(isCriticalSelector('.main-nav'), true);
  assert.strictEqual(isCriticalSelector('.search-overlay'), true);
  assert.strictEqual(isCriticalSelector('.preset-pop'), true);
});

test('pickCriticalSelectors：同一规则只保留关键选择器子集', () => {
  const kept = pickCriticalSelectors('.unknown-a,.post-card,.unknown-b,.hero h1');
  assert.deepStrictEqual(kept, ['.post-card', '.hero h1']);
});

test('extractCriticalCss：保留首屏规则、丢弃未知组件与重型块', () => {
  const css = ':root{--x:1}.site-header{color:red}.widget-title{font-size:20px}'
    + '.post-content pre{padding:1rem}.post-content p{margin:1em 0}.mystery{color:blue}';
  const result = extractCriticalCss(css);
  assert.ok(result.css.includes('.site-header{color:red}'));
  assert.ok(result.css.includes('.widget-title{font-size:20px}'));
  assert.ok(result.css.includes('.post-content p{margin:1em 0}'));
  assert.ok(!result.css.includes('.post-content pre'));
  assert.ok(!result.css.includes('.mystery'));
  assert.strictEqual(result.stats.rulesKept, 3);
});

test('extractCriticalCss：@media 递归保留命中规则、空容器整体丢弃、print 容器丢弃', () => {
  const css = '@media(max-width:768px){.nav-link{display:block}.mystery-x{font-size:2rem}}'
    + '@media(max-width:480px){.mystery-y{font-size:1rem}}'
    + '@media print{.site-header{display:none}}';
  const result = extractCriticalCss(css);
  assert.ok(result.css.includes('@media(max-width:768px){.nav-link{display:block}}'));
  assert.ok(!result.css.includes('@media(max-width:480px)'));
  assert.ok(!result.css.includes('print'));
});

test('extractCriticalCss：@keyframes 仅在名称被保留规则引用时保留', () => {
  const css = '.page-enter{animation:fadeIn .2s}@keyframes fadeIn{from{opacity:0}to{opacity:1}}'
    + '@keyframes ghost{from{opacity:0}to{opacity:.5}}';
  const result = extractCriticalCss(css);
  assert.ok(result.css.includes('@keyframes fadeIn'));
  assert.ok(!result.css.includes('@keyframes ghost'));
});

test('extractCriticalCss：变量按关键规则闭包裁剪，强制前缀始终保留', () => {
  const css = ':root{--color-s:#369;--card-radius:8px;--unused-tuning:12px;--ff-num:var(--ff-mono);--ff-mono:monospace}'
    + '.post-card{border-radius:var(--card-radius);font:var(--ff-num)}';
  const result = extractCriticalCss(css);
  assert.ok(result.css.includes('--color-s:#369'));
  assert.ok(result.css.includes('--card-radius:8px'));
  assert.ok(result.css.includes('--ff-num:var(--ff-mono)'));
  assert.ok(result.css.includes('--ff-mono:monospace'));
  assert.ok(!result.css.includes('--unused-tuning'));
});

test('extractCriticalCss：[data-theme] 变量块同样参与裁剪', () => {
  const css = '[data-theme=dark]{--color-bg:#000;--unused-x:9px;--color-t:#fff}body{color:var(--color-t)}';
  const result = extractCriticalCss(css);
  assert.ok(result.css.includes('--color-t:#fff'));
  assert.ok(result.css.includes('--color-bg:#000'));
  assert.ok(!result.css.includes('--unused-x'));
});

test('extractCriticalCss：@font-face/@property 保留、无块语句丢弃', () => {
  const css = '@charset "utf-8";@import url(x.css);@property --p{syntax:"<color>";inherits:false}'
    + '@font-face{font-family:X;src:url(x.woff2)}@page{margin:1cm}.random{color:red}';
  const result = extractCriticalCss(css);
  assert.ok(result.css.includes('@font-face'));
  assert.ok(result.css.includes('@property --p'));
  assert.ok(!result.css.includes('@charset'));
  assert.ok(!result.css.includes('@import'));
  assert.ok(!result.css.includes('@page'));
});

test('extractCriticalCss：解析异常抛出（注释/引号/括号不配对）', () => {
  assert.throws(() => extractCriticalCss('.a{content:"x}'), /未闭合|括号/);
  assert.throws(() => extractCriticalCss('.a{color:red'), /大括号/);
  assert.throws(() => extractCriticalCss('.a{color:red}/*'), /未闭合/);
  assert.throws(() => extractCriticalCss(null), TypeError);
});

test('extractCriticalCss：输出可被再次解析且顺序保持', () => {
  const css = '.site-logo{a:1}.unknown{b:2}.site-logo{z:3}.hero{c:4}';
  const result = extractCriticalCss(css);
  const idx = result.css.indexOf('.site-logo{a:1}');
  const idx2 = result.css.indexOf('.site-logo{z:3}');
  assert.ok(idx >= 0 && idx2 > idx, '同名选择器的规则顺序必须保持');
});
