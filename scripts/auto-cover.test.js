'use strict';

// auto-cover 纯函数单测（换行估算 / 配置归一 / 颜色解析 / hash 稳定性 / 文件命名 / SVG 渲染）。
// 运行：node --test scripts/auto-cover.test.js（npm test 亦收录）。
const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  STYLE_VERSION,
  resolveAutoCoverConfig,
  resolveAutoCoverColors,
  measureText,
  wrapTitleLines,
  autoCoverHash,
  autoCoverFileName,
  isAutoCoverFileName,
  buildAutoCoverSvg
} = require('./lib/auto-cover');

const HASH_RX = /^[0-9a-f]{8}$/;

describe('resolveAutoCoverConfig', () => {
  test('缺省时给出默认值（开启 / 1200x630 / webp / gradient / 站点名开 / 分类关）', () => {
    assert.deepStrictEqual(resolveAutoCoverConfig(undefined), {
      enabled: true,
      width: 1200,
      height: 630,
      format: 'webp',
      ext: 'webp',
      backgroundStyle: 'gradient',
      showSiteName: true,
      showCategory: false
    });
  });

  test('jpeg/jpg 归一为 jpeg + jpg 扩展名；非法格式回退 webp', () => {
    assert.strictEqual(resolveAutoCoverConfig({ format: 'JPEG' }).ext, 'jpg');
    assert.strictEqual(resolveAutoCoverConfig({ format: 'jpg' }).format, 'jpeg');
    assert.strictEqual(resolveAutoCoverConfig({ format: 'png' }).format, 'webp');
    assert.strictEqual(resolveAutoCoverConfig({ format: 7 }).format, 'webp');
  });

  test('enabled 仅显式 false 关闭；backgroundStyle 非法回退 gradient', () => {
    assert.strictEqual(resolveAutoCoverConfig({}).enabled, true);
    assert.strictEqual(resolveAutoCoverConfig({ enabled: false }).enabled, false);
    assert.strictEqual(resolveAutoCoverConfig({ backgroundStyle: 'solid' }).backgroundStyle, 'solid');
    assert.strictEqual(resolveAutoCoverConfig({ backgroundStyle: 'noise' }).backgroundStyle, 'gradient');
  });

  test('宽高非法回退默认、越界夹取到 [64, 4096]', () => {
    const bad = resolveAutoCoverConfig({ width: 0, height: -5 });
    assert.strictEqual(bad.width, 1200);
    assert.strictEqual(bad.height, 630);
    const clamped = resolveAutoCoverConfig({ width: 99999, height: 1 });
    assert.strictEqual(clamped.width, 4096);
    assert.strictEqual(clamped.height, 64);
  });

  test('showSiteName 默认开、显式 false 关；showCategory 默认关、显式 true 开', () => {
    assert.strictEqual(resolveAutoCoverConfig({}).showSiteName, true);
    assert.strictEqual(resolveAutoCoverConfig({ showSiteName: false }).showSiteName, false);
    assert.strictEqual(resolveAutoCoverConfig({}).showCategory, false);
    assert.strictEqual(resolveAutoCoverConfig({ showCategory: true }).showCategory, true);
  });
});

describe('resolveAutoCoverColors', () => {
  test('取主题 primary/secondary 与暗色 text（浅色标题字）', () => {
    const colors = resolveAutoCoverColors({
      colors: { primary: '#2d3748', secondary: '#2563eb' },
      darkMode: { colors: { text: '#f1f5f9' } }
    });
    assert.deepStrictEqual(colors, {
      primary: '#2d3748',
      secondary: '#2563eb',
      titleColor: '#f1f5f9',
      siteName: '#f1f5f9'
    });
  });

  test('primary 缺失或非法返回 null（构建侧跳过生成，不内置兜底配色）', () => {
    assert.strictEqual(resolveAutoCoverColors({ colors: { secondary: '#2563eb' } }), null);
    assert.strictEqual(resolveAutoCoverColors({ colors: { primary: 'red; url(x)' } }), null);
    assert.strictEqual(resolveAutoCoverColors({}), null);
  });

  test('secondary 缺失回退 primary；暗色 text 缺失回退白色', () => {
    const colors = resolveAutoCoverColors({ colors: { primary: '#334155' } });
    assert.strictEqual(colors.secondary, '#334155');
    assert.strictEqual(colors.titleColor, '#ffffff');
  });
});

describe('measureText / wrapTitleLines', () => {
  test('中文全角按 1 字宽、拉丁按字符类别估算', () => {
    assert.strictEqual(measureText('中文'), 2);
    assert.ok(Math.abs(measureText('hello') - 2.6) < 1e-9);
    assert.ok(measureText('中a') > measureText('aa'));
  });

  test('中文逐字换行，行宽不超过上限', () => {
    const lines = wrapTitleLines('一二三四五六七八九十', { maxWidthEm: 8, maxLines: 3 });
    assert.deepStrictEqual(lines, ['一二三四五六七八', '九十']);
  });

  test('英文按单词整体换行，不拆断单词', () => {
    const lines = wrapTitleLines('alpha beta gamma', { maxWidthEm: 6, maxLines: 4 });
    assert.deepStrictEqual(lines, ['alpha beta', 'gamma']);
  });

  test('空格不会出现在行首或行尾（换行处被丢弃）', () => {
    const lines = wrapTitleLines('one ' + 'two '.repeat(8), { maxWidthEm: 5, maxLines: 4 });
    for (const line of lines) {
      assert.ok(!line.startsWith(' ') && !line.endsWith(' '), JSON.stringify(line));
    }
  });

  test('超宽单词按字符硬切且每行不超上限', () => {
    const lines = wrapTitleLines('supercalifragilistic', { maxWidthEm: 3, maxLines: 4 });
    assert.ok(lines.length >= 2);
    for (const line of lines) assert.ok(measureText(line) <= 3 + 1e-9, line);
  });

  test('超出最大行数时末行补省略号且省略号不溢出', () => {
    const lines = wrapTitleLines('abcdefghijklmnopqrstuvwxyz', { maxWidthEm: 5, maxLines: 2 });
    assert.strictEqual(lines.length, 2);
    assert.ok(lines[1].endsWith('…'));
    assert.ok(measureText(lines[1]) <= 5 + 1e-9);
  });

  test('空标题返回空数组；单行放得下时只有一行', () => {
    assert.deepStrictEqual(wrapTitleLines('  ', { maxWidthEm: 10 }), []);
    assert.deepStrictEqual(wrapTitleLines('短标题', { maxWidthEm: 10 }), ['短标题']);
  });
});

describe('autoCoverHash', () => {
  const base = {
    title: '建站手记（一）',
    siteName: 'S-ynapse',
    primary: '#2d3748',
    secondary: '#2563eb',
    titleColor: '#f1f5f9',
    backgroundStyle: 'gradient',
    showSiteName: true,
    showCategory: false,
    width: 1200,
    height: 630,
    format: 'webp'
  };

  test('同输入稳定且为 8 位十六进制', () => {
    const a = autoCoverHash(base);
    const b = autoCoverHash({ ...base });
    assert.strictEqual(a, b);
    assert.match(a, HASH_RX);
  });

  test('标题/站点名/主题色任一变化都产生新 hash', () => {
    const h = autoCoverHash(base);
    assert.notStrictEqual(autoCoverHash({ ...base, title: '建站手记（二）' }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, siteName: 'Another' }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, primary: '#000000' }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, secondary: '#111111' }), h);
  });

  test('宽高/格式/样式开关变化都产生新 hash（缓存键必须随输出像素失效）', () => {
    const h = autoCoverHash(base);
    assert.notStrictEqual(autoCoverHash({ ...base, width: 1080 }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, height: 720 }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, format: 'jpeg' }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, backgroundStyle: 'solid' }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, showSiteName: false }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, showCategory: true }), h);
    assert.notStrictEqual(autoCoverHash({ ...base, titleColor: '#ffffff' }), h);
  });

  test('分类角标开启时角标文本参与 hash；关闭时不影响（避免同题不同分类互覆）', () => {
    const shown = { ...base, showCategory: true, category: '随笔' };
    assert.notStrictEqual(autoCoverHash(shown), autoCoverHash({ ...shown, category: '技术' }));
    const hidden = { ...base, showCategory: false, category: '随笔' };
    assert.strictEqual(autoCoverHash(hidden), autoCoverHash({ ...hidden, category: '技术' }));
  });

  test('样式版本参与 hash（STYLE_VERSION 存在且为数字）', () => {
    assert.strictEqual(typeof STYLE_VERSION, 'number');
    assert.ok(STYLE_VERSION >= 1);
  });
});

describe('autoCoverFileName / isAutoCoverFileName', () => {
  test('按 cover-<slug>.<hash8>.<ext> 拼接', () => {
    const name = autoCoverFileName('series-1', 'a1b2c3d4', 'webp');
    assert.strictEqual(name, 'cover-series-1.a1b2c3d4.webp');
  });

  test('只把符合命名模式的自动封面判为真（避免误删生成器与缓存）', () => {
    assert.strictEqual(isAutoCoverFileName('cover-series-1.a1b2c3d4.webp'), true);
    assert.strictEqual(isAutoCoverFileName('cover-hello.deadbeef.jpg'), true);
    assert.strictEqual(isAutoCoverFileName('series-1.png'), false);
    assert.strictEqual(isAutoCoverFileName('cover-series-1.webp'), false);
    assert.strictEqual(isAutoCoverFileName('cover-series-1.a1b2c3d4.txt'), false);
    assert.strictEqual(isAutoCoverFileName(''), false);
  });
});

describe('buildAutoCoverSvg', () => {
  const base = {
    title: '建站手记（一）：选题与结构',
    siteName: 'S-ynapse',
    category: '随笔',
    width: 1200,
    height: 630,
    primary: '#2d3748',
    secondary: '#2563eb',
    titleColor: '#f1f5f9',
    siteNameColor: '#f1f5f9',
    backgroundStyle: 'gradient',
    showSiteName: true,
    showCategory: false
  };

  test('输出含画布尺寸与渐变背景；solid 模式输出纯色矩形', () => {
    const gradient = buildAutoCoverSvg(base);
    assert.ok(gradient.includes('width="1200" height="630" viewBox="0 0 1200 630"'));
    assert.ok(gradient.includes('linearGradient'));
    const solid = buildAutoCoverSvg({ ...base, backgroundStyle: 'solid' });
    assert.ok(!solid.includes('linearGradient'));
    assert.ok(solid.includes('fill="#2d3748"'));
  });

  test('标题文本转义且按行拆分（≤3 行）', () => {
    const svg = buildAutoCoverSvg({ ...base, title: 'A & B <tag> "quote"' });
    assert.ok(svg.includes('A &amp; B &lt;tag&gt; &quot;quote&quot;'));
    const textCount = (svg.match(/<text /g) || []).length;
    assert.ok(textCount >= 1 && textCount <= 5);
  });

  test('showSiteName=false 不输出站点名；showCategory=true 且存在分类时输出角标', () => {
    const withoutSite = buildAutoCoverSvg({ ...base, showSiteName: false });
    assert.ok(!withoutSite.includes('S-ynapse'));
    const withChip = buildAutoCoverSvg({ ...base, showCategory: true });
    assert.ok(withChip.includes('随笔'));
    const noChip = buildAutoCoverSvg({ ...base, showCategory: true, category: '' });
    assert.ok(!noChip.includes('随笔'));
  });

  test('空标题仍产出可渲染 SVG（不含未定义文本）', () => {
    const svg = buildAutoCoverSvg({ ...base, title: '' });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(!svg.includes('undefined'));
    assert.ok(!svg.includes('null'));
  });
});
