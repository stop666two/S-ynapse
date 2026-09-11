const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatDate, safeSlug, escapeAttr, escapeHtml, stripHtml, insertCjkSpacing, applyCjkSpacingToHtml, extractToc, sanitizeHtml, escapeJsonForScript } = require('./lib/utils');
const { extractWorkerSecurity, renderWorkerConfig } = require('./generate-security-config');
const { validateFeatures, DEFAULT_FEATURES, FEATURE_MODULES } = require('./lib/features-schema');
const { formatConfigError } = require('./lib/config-error');
const { PRESETS: THEME_PRESETS, resolveTheme: resolveThemePreset, validatePreset: validateThemePreset, contrastRatio } = require('./lib/theme-presets');

describe('formatConfigError', () => {
  it('reports filename, line, column and caret context', () => {
    const fileText = '{\n  enabled: true,\n  title: "x" \n}';
    const err = new Error("JSON5: invalid character '\\n' at 3:16");
    const out = formatConfigError('site.json', err, { fileText, filePath: '/proj/site.json' });
    assert.ok(out.includes('[FATAL] 配置文件解析失败: site.json'));
    assert.ok(out.includes('/proj/site.json 第 3 行'));
    assert.ok(out.includes('JSON5: invalid character'));
    assert.ok(out.includes('^'));
    assert.ok(out.includes('常见原因'));
  });
  it('falls back when no position is known and file is unavailable', () => {
    const err = new Error('Unexpected end of input');
    const out = formatConfigError('theme.json', err, {});
    assert.ok(out.includes('theme.json'));
    assert.ok(out.includes('Unexpected end'));
  });
});

describe('features-schema validateFeatures', () => {
  it('accepts a clean features config (defaults)', () => {
    const r = validateFeatures(JSON.parse(JSON.stringify(DEFAULT_FEATURES)), 'features');
    assert.strictEqual(r.errors.length, 0);
    assert.strictEqual(r.warnings.length, 0);
  });
  it('rejects non-boolean enabled flags', () => {
    const r = validateFeatures({ lightbox: { enabled: 'yes' } }, 'features');
    assert.ok(r.errors.some(e => e.includes('features.lightbox.enabled must be a boolean')));
  });
  it('rejects unknown share platforms in order', () => {
    const r = validateFeatures({ share: { order: ['weibo', 'nope'] } }, 'features');
    assert.ok(r.errors.some(e => e.includes('unknown platform "nope"')));
  });
  it('warns on unknown feature modules (typo protection)', () => {
    const r = validateFeatures({ lightboxp: { enabled: true } }, 'features');
    assert.ok(r.warnings.some(w => w.includes('not a known feature module')));
  });
  it('rejects invalid enum values', () => {
    const r = validateFeatures({ heatmap: { scaling: 'banana' } }, 'features');
    assert.ok(r.errors.some(e => e.includes('features.heatmap.scaling must be one of')));
  });
  it('rejects non-object modules', () => {
    const r = validateFeatures({ lightbox: 42 }, 'features');
    assert.ok(r.errors.some(e => e.includes('must be an object')));
  });
  it('exposes 75 feature modules for configuration', () => {
    assert.strictEqual(FEATURE_MODULES.length, 75);
  });
});

describe('formatDate', () => {
  it('formats date with default format', () => {
    assert.strictEqual(formatDate('2026-07-19', 'YYYY-MM-DD'), '2026-07-19');
  });
  it('formats date with custom format', () => {
    assert.strictEqual(formatDate('2026-07-19', 'YYYY/MM/DD HH:mm'), '2026/07/19');
  });
  it('formats datetime with time', () => {
    assert.strictEqual(formatDate('2026-07-19 14:30', 'YYYY-MM-DD HH:mm'), '2026-07-19 14:30');
  });
  it('returns empty string for null/undefined', () => {
    assert.strictEqual(formatDate(null, 'YYYY-MM-DD'), '');
    assert.strictEqual(formatDate(undefined, 'YYYY-MM-DD'), '');
  });
  it('returns original string for invalid date', () => {
    assert.strictEqual(formatDate('not-a-date', 'YYYY-MM-DD'), 'not-a-date');
  });
});

describe('safeSlug', () => {
  it('converts simple text to slug', () => {
    assert.strictEqual(safeSlug('Hello World'), 'hello-world');
  });
  it('handles Chinese characters', () => {
    assert.ok(safeSlug('你好世界').length > 0);
  });
  it('handles mixed content', () => {
    assert.strictEqual(safeSlug('My Blog Post 2024'), 'my-blog-post-2024');
  });
  it('returns empty string for empty input', () => {
    assert.strictEqual(safeSlug(''), '');
  });
});

describe('escapeAttr', () => {
  it('escapes special characters', () => {
    assert.strictEqual(escapeAttr('<test>"quoted"'), '&lt;test&gt;&quot;quoted&quot;');
  });
  it('returns empty string for non-string input', () => {
    assert.strictEqual(escapeAttr(null), '');
    assert.strictEqual(escapeAttr(undefined), '');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special chars', () => {
    assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert("xss")&lt;/script&gt;');
  });
  it('returns empty string for non-string input', () => {
    assert.strictEqual(escapeHtml(null), '');
  });
});

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    assert.strictEqual(stripHtml('<p>Hello <b>World</b></p>'), 'Hello World');
  });
  it('decodes common entities but not angle brackets', () => {
    const result = stripHtml('<code>&lt;script&gt;alert(1)&lt;/script&gt;</code>');
    assert.ok(result.includes('&lt;'), 'should keep &lt; intact');
    assert.ok(!result.includes('<script>'), 'should not contain raw script tags');
  });
  it('returns empty string for non-string input', () => {
    assert.strictEqual(stripHtml(null), '');
  });
});

describe('insertCjkSpacing', () => {
  it('inserts thin space between Chinese and English', () => {
    const result = insertCjkSpacing('你好World');
    assert.ok(result.includes('\u2009'), 'should contain thin space');
  });
  it('inserts thin space between Chinese and numbers', () => {
    const result = insertCjkSpacing('版本3');
    assert.ok(result.includes('\u2009'), 'should contain thin space');
  });
  it('does not modify pure Chinese', () => {
    assert.strictEqual(insertCjkSpacing('你好世界'), '你好世界');
  });
  it('does not modify pure English', () => {
    assert.strictEqual(insertCjkSpacing('Hello World'), 'Hello World');
  });
});

describe('applyCjkSpacingToHtml', () => {
  it('skips HTML tags while processing text', () => {
    const result = applyCjkSpacingToHtml('<p>你好World</p>');
    assert.ok(result.includes('\u2009'), 'should have thin space between Chinese and English');
    assert.ok(result.includes('<p>'), 'should preserve opening tag');
    assert.ok(result.includes('</p>'), 'should preserve closing tag');
  });
});

describe('extractToc', () => {
  it('extracts h2-h4 headings with anchors', () => {
    const html = '<h2 id="section-1"><a href="#section-1" class="heading-anchor">#</a>Section 1</h2><h3 id="sub-1"><a href="#sub-1" class="heading-anchor">#</a>Sub 1</h3>';
    const toc = extractToc(html);
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[0].level, 2);
    assert.strictEqual(toc[0].id, 'section-1');
    assert.strictEqual(toc[0].text, 'Section 1');
    assert.strictEqual(toc[1].level, 3);
  });
  it('returns empty array for no headings', () => {
    assert.deepStrictEqual(extractToc('<p>No headings</p>'), []);
  });
});

describe('sanitizeHtml', () => {
  it('preserves aria-label attributes (a11y)', () => {
    const out = sanitizeHtml('<input type="checkbox" checked disabled aria-label="任务">');
    assert.ok(out.includes('aria-label="任务"'), 'aria-label must survive sanitization');
    assert.ok(out.includes('checked'), 'checked must survive');
  });
  it('removes script blocks entirely', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    assert.ok(!out.includes('<script'), 'script tag must be gone');
    assert.ok(!out.includes('alert(1)'), 'script body must be gone');
    assert.ok(out.includes('<p>ok</p>'));
  });
  it('removes iframe/object/embed active content', () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe><object data="x"></object><embed src="y">');
    assert.ok(!out.includes('iframe'));
    assert.ok(!out.includes('object'));
    assert.ok(!out.includes('<embed'));
  });
  it('strips event handler attributes', () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)" onload="f()">');
    assert.ok(!out.includes('onerror'));
    assert.ok(!out.includes('onload'));
    assert.ok(out.includes('src="x"'));
  });
  it('strips style attributes', () => {
    const out = sanitizeHtml('<div style="position:fixed;top:0">x</div>');
    assert.ok(!out.includes('style='));
  });
  it('drops javascript: and data: URIs on href/src', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)" onclick="f()">x</a><img src="data:text/html,x">');
    assert.ok(!out.includes('javascript:'));
    assert.ok(!out.includes('data:'));
    assert.ok(out.includes('<a>x</a>'));
  });
  it('keeps whitelisted tags (dl/table/div/span)', () => {
    const out = sanitizeHtml('<dl><dt>术语</dt><dd>说明</dd></dl><table><tr><td>a</td></tr></table><div class="box">d</div>');
    assert.ok(out.includes('<dl>'));
    assert.ok(out.includes('<dt>术语</dt>'));
    assert.ok(out.includes('<dd>说明</dd>'));
    assert.ok(out.includes('<table>'));
    assert.ok(out.includes('<td>a</td>'));
    assert.ok(out.includes('<div class="box">'));
  });
  it('escapes unknown tags to text', () => {
    const out = sanitizeHtml('<x-widget>t</x-widget>');
    assert.ok(!out.includes('<x-widget>'), 'must not keep raw unknown tag');
    assert.ok(out.includes('&lt;x-widget>t&lt;/x-widget>') || out.includes('&lt;x-widget&gt;'));
  });
  it('return empty string for non-string input', () => {
    assert.strictEqual(sanitizeHtml(null), '');
  });
});

describe('escapeJsonForScript', () => {
  it('escapes < to \\u003c so script tags cannot break out', () => {
    const out = escapeJsonForScript({ title: '</script><script>alert(1)</script>' });
    assert.ok(!out.includes('</script>'), 'must not contain raw closing script tag');
    assert.ok(out.includes('\\u003c/script>'));
  });
  it('keeps normal JSON intact', () => {
    assert.strictEqual(escapeJsonForScript({ a: 1, b: '中文' }), '{"a":1,"b":"中文"}');
  });
});

describe('sanitizeHtml media elements', () => {
  it('keeps video with controls and site-local src', () => {
    const out = sanitizeHtml('<video controls preload="metadata" src="/videos/sample.mp4" width="640"></video>');
    assert.ok(out.includes('<video'), 'video tag must survive');
    assert.ok(out.includes('src="/videos/sample.mp4"'), 'site-local src preserved');
    assert.ok(out.includes('controls'), 'controls attribute preserved');
  });
  it('drops absolute/protocol-relative media sources', () => {
    const out = sanitizeHtml('<video src="https://evil.example/v.mp4"></video><audio src="//cdn.example.com/a.mp3"></audio>');
    assert.ok(!out.includes('https://'), 'absolute media src must be dropped');
    assert.ok(!out.includes('//cdn'), 'protocol-relative media src must be dropped');
    assert.ok(!out.includes('src='), 'media without valid src has no src attr');
  });
  it('keeps video tag but strips missing src when dropped and allows local audio', () => {
    const out = sanitizeHtml('<audio controls src="/assets/song.mp3"></audio>');
    assert.ok(out.includes('<audio'));
    assert.ok(out.includes('src="/assets/song.mp3"'));
    assert.ok(out.includes('controls'));
  });
  it('still removes script/iframe/noscript after media support', () => {
    const out = sanitizeHtml('<video src="/v/s.mp4"></video><script>alert(1)</script><iframe src="x"></iframe><noscript>n</noscript>');
    assert.ok(!out.includes('<script'));
    assert.ok(!out.includes('<iframe'));
    assert.ok(!out.includes('<noscript'));
    assert.ok(out.includes('<video'));
  });
});

describe('content-policy classifyFile', () => {
  const { classifyFile, sanitizeSvg } = require('./lib/content-policy');

  it('rejects executables in every directory', () => {
    assert.strictEqual(classifyFile('evil.exe', 'videos', null).reason, 'blocked-executable');
    assert.strictEqual(classifyFile('evil.py', 'assets', null).reason, 'blocked-executable');
    assert.strictEqual(classifyFile('setup.js', 'media', null).reason, 'blocked-executable');
  });
  it('media: whitelist only, svg allowed', () => {
    assert.strictEqual(classifyFile('photo.jpg', 'media', null).category, 'media-optimized');
    assert.strictEqual(classifyFile('logo.svg', 'media', null).category, 'media-raw');
    assert.strictEqual(classifyFile('archive.tar.gz', 'media', null).reason, 'not-in-media-whitelist');
  });
  it('videos: deny-list (avi/mkv allowed, html rejected)', () => {
    assert.strictEqual(classifyFile('movie.avi', 'videos', null).category, 'video');
    assert.strictEqual(classifyFile('movie.mkv', 'videos', null).category, 'video');
    assert.strictEqual(classifyFile('page.html', 'videos', null).reason, 'active-document');
  });
  it('assets: whitelist, blocked beats matches', () => {
    assert.strictEqual(classifyFile('user-guide.pdf', 'assets', null).category, 'asset');
    assert.strictEqual(classifyFile('data.json', 'assets', null).category, 'asset');
    assert.strictEqual(classifyFile('x.docx', 'assets', null).category, 'asset');
    assert.strictEqual(classifyFile('list.tar.gz', 'assets', null).category, 'asset');
    // blocked-wins: .mjs is in assetExts? no — must be blocked regardless
    assert.strictEqual(classifyFile('app.js', 'assets', null).reason, 'blocked-executable');
    assert.strictEqual(classifyFile('doc.xml', 'assets', null).reason, 'active-document');
  });
  it('rejects known system filenames', () => {
    assert.strictEqual(classifyFile('Thumbs.db', 'assets', null).reason, 'blocked-filename');
  });
});

describe('sanitizeSvg', () => {
  const { sanitizeSvg } = require('./lib/content-policy');

  it('flags svg containing script or event handlers', () => {
    assert.strictEqual(sanitizeSvg('<svg onload="alert(1)"><rect/></svg>').safe, false);
    assert.strictEqual(sanitizeSvg('<svg><script>alert(1)</script></svg>').safe, false);
  });
  it('flags svg with external references', () => {
    assert.strictEqual(sanitizeSvg('<svg><image href="https://evil.com/x.png"/></svg>').safe, false);
  });
  it('passes clean inline svg', () => {
    const r = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="10"><rect width="10"/></svg>');
    assert.strictEqual(r.safe, true);
    assert.ok(r.content.includes('<svg'));
  });
});


describe('generate-security-config', () => {
  it('extracts rate limiting fields from security.json shape', () => {
    const out = extractWorkerSecurity({ rateLimiting: { enabled: true, maxRequests: 50, windowMs: 60000, blockDuration: 300000, whitelist: ['10.0.0.1'], blacklist: ['1.2.3.4'] } });
    assert.strictEqual(out.rateLimiting.maxRequests, 50);
    assert.deepStrictEqual(out.rateLimiting.whitelist, ['10.0.0.1']);
    assert.deepStrictEqual(out.rateLimiting.blacklist, ['1.2.3.4']);
    assert.strictEqual(out.forceHttps, false);
  });
  it('falls back to safe defaults for missing/invalid fields', () => {
    const out = extractWorkerSecurity({ rateLimiting: { maxRequests: 'unlimited' } });
    assert.strictEqual(out.rateLimiting.maxRequests, 100);
    assert.strictEqual(out.rateLimiting.windowMs, 60000);
    assert.deepStrictEqual(out.rateLimiting.whitelist, []);
    assert.strictEqual(out.csp.reportOnly, false);
    assert.deepStrictEqual(out.pathRestrictions, ['/admin']);
  });
  it('normalizes path restrictions and drops malformed entries', () => {
    const out = extractWorkerSecurity({ pathRestrictions: [{ path: '/admin/*' }, { noPath: true }, null] });
    assert.deepStrictEqual(out.pathRestrictions, ['/admin/*']);
  });
  it('preserves csp directives and report fields', () => {
    const out = extractWorkerSecurity({ csp: { directives: { 'default-src': ['\'self\''], 'frame-src': ['\'none\''] }, reportOnly: true, reportUri: '/csp-rpt' } });
    assert.deepStrictEqual(out.csp.directives['frame-src'], ['\'none\'']);
    assert.strictEqual(out.csp.reportOnly, true);
    assert.strictEqual(out.csp.reportUri, '/csp-rpt');
  });
  it('renders valid ESM text with export default', () => {
    const src = renderWorkerConfig({ rateLimiting: { maxRequests: 99 }, csp: { directives: {} }, pathRestrictions: ['/admin'], forceHttps: false, headers: {} });
    assert.ok(src.startsWith('// AUTO-GENERATED'));
    assert.ok(src.includes('export default'));
    assert.ok(src.includes('99'));
  });
  it('renders empty-security input without crashing', () => {
    const src = renderWorkerConfig(extractWorkerSecurity(null));
    assert.ok(src.includes('export default'));
    assert.ok(src.includes('blockDuration'));
  });
});

describe('theme-presets', () => {
  it('provides six presets with full light+dark palettes', () => {
    assert.strictEqual(Object.keys(THEME_PRESETS).length, 6);
    for (const key of Object.keys(THEME_PRESETS)) {
      const p = THEME_PRESETS[key];
      assert.ok(p.label, key + ' has label');
      assert.ok(p.light && p.dark, key + ' has both modes');
      for (const k of ['secondary', 'accent', 'background', 'surface', 'text', 'textSecondary', 'textLight', 'border', 'hover', 'primary']) {
        assert.ok(p.light[k], key + '.light.' + k);
        assert.ok(p.dark[k], key + '.dark.' + k);
      }
    }
  });
  it('keeps WCAG AA contrast for secondary and light text on backgrounds', () => {
    for (const key of Object.keys(THEME_PRESETS)) {
      const p = THEME_PRESETS[key];
      assert.ok(contrastRatio(p.light.secondary, p.light.surface) >= 4.5, key + ' light secondary on surface');
      assert.ok(contrastRatio(p.light.textLight, p.light.background) >= 4.5, key + ' light textLight on background');
      assert.ok(contrastRatio(p.light.text, p.light.background) >= 4.5, key + ' light text on background');
      assert.ok(contrastRatio(p.dark.secondary, p.dark.surface) >= 4.5, key + ' dark secondary on surface');
      assert.ok(contrastRatio(p.dark.textLight, p.dark.surface) >= 4.5, key + ' dark textLight on surface');
      assert.ok(contrastRatio(p.dark.text, p.dark.background) >= 4.5, key + ' dark text on background');
    }
  });
  it('resolveTheme applies preset and lets presetOverrides win', () => {
    const r = resolveThemePreset({ preset: 'sakura-pink', presetOverrides: { colors: { secondary: '#000000' } } });
    assert.strictEqual(r.colors.secondary, '#000000');
    assert.strictEqual(r.colors.primary, THEME_PRESETS['sakura-pink'].light.primary);
    assert.strictEqual(r.appliedPreset, '樱花粉(sakura-pink)');
    assert.ok(r.darkMode.colors.primary, 'dark primary resolved');
  });
  it('resolveTheme falls back to classic-blue with warning on unknown preset', () => {
    const r = resolveThemePreset({ preset: 'no-such-preset' });
    assert.strictEqual(r.appliedPreset, '经典蓝(classic-blue)');
    assert.ok(r.warnings.length > 0 && r.warnings[0].includes('classic-blue'));
    assert.strictEqual(r.colors.secondary, THEME_PRESETS['classic-blue'].light.secondary);
  });
  it('resolveTheme honors hand-written colors when preset is null', () => {
    const r = resolveThemePreset({ preset: null, colors: { primary: '#123456' } });
    assert.strictEqual(r.appliedPreset, null);
    assert.strictEqual(r.colors.primary, '#123456');
  });
  it('validatePreset reports unknown preset names', () => {
    const errs = validateThemePreset({ preset: 'typo-blue' });
    assert.ok(errs.some(e => e.includes('typo-blue') && e.includes('classic-blue')));
    assert.strictEqual(validateThemePreset({ preset: 'night-jet' }).length, 0);
    assert.ok(validateThemePreset({ presetOverrides: 42 }).length > 0);
  });
});
