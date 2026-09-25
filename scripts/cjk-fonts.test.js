'use strict';
// CJK 字体子集化（Noto Sans SC）纯逻辑与管线降级单测。
// 全部用例不联网：网络路径经注入 fetch 假实现覆盖（含超时、HTTP 错误、离线降级、缓存复用）。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseUnicodeRange,
  intersects,
  collectUsedCodepoints,
  extractHtmlTexts,
  parseFontFaceCss,
  fetchChunkList,
  chunkFileName,
  buildSubsetPlan,
  buildFontCss,
  googleFontsCssUrl,
  fontFamilySlug,
  downloadFontChunk,
  CJK_CSS_HREF
} = require('./lib/cjk-fonts');
const { createCjkFontsModule } = require('./build/cjk-fonts');

const SILENT = { log() {}, warn() {}, error() {} };
const WOFF2_MAGIC = Buffer.from('wOF2');
const CHUNK_BYTES = Buffer.concat([WOFF2_MAGIC, Buffer.alloc(64, 7)]);

const CHUNK_CSS = `/* [1] */
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/notosanssc/v40/han-a.woff2) format('woff2');
  unicode-range: U+4e00-4e0f, U+3000-3001;
}
/* [2] */
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/notosanssc/v40/latin-a.woff2) format('woff2');
  unicode-range: U+0000-00ff;
}
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/notosanssc/v40/han-b.woff2) format('woff2');
  unicode-range: U+4e00-9fff;
}`;

const HTML_FIXTURE = '<!DOCTYPE html><html lang="zh"><head><title>测试站点</title>'
  + '<meta name="description" content="中文描述">'
  + '<link rel="stylesheet" href="/assets/css/cjk-fonts.css"></head><body><h1>你好，世界</h1>'
  + '<p>一二三构建期子集化</p><script type="application/json">{"title":"配置标题"}</script></body></html>';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeFakeFetch(options) {
  const opts = options || {};
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    if (opts.offline) throw new Error('offline-simulated');
    if (opts.failChunk && String(url).indexOf('han-') > -1) throw new Error('chunk-download-failed');
    if (String(url).indexOf('fonts.googleapis.com') > -1) {
      return { ok: true, status: 200, text: async () => opts.css || CHUNK_CSS };
    }
    return { ok: true, status: 200, arrayBuffer: async () => CHUNK_BYTES.buffer.slice(CHUNK_BYTES.byteOffset, CHUNK_BYTES.byteOffset + CHUNK_BYTES.byteLength) };
  };
  return { fetchImpl, calls };
}

function writeDistHtml(distDir, name, html) {
  const file = path.join(distDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf-8');
}

function baseConfig(overrides) {
  return {
    site: {
      build: {
        cjkFonts: Object.assign({ enabled: true, family: 'Noto Sans SC', weights: [400, 700], fetchTimeoutMs: 2000 }, overrides || {})
      },
      performance: { fontDisplay: 'swap' }
    }
  };
}

describe('parseUnicodeRange', () => {
  it('解析单点、区间与多个字段（大小写与空格容错）', () => {
    assert.deepStrictEqual(parseUnicodeRange('U+4E00-9FFF, U+3000'), [[0x4e00, 0x9fff], [0x3000, 0x3000]]);
    assert.deepStrictEqual(parseUnicodeRange('u+ff00-ffef'), [[0xff00, 0xffef]]);
  });
  it('解析通配写法并忽略非法片段', () => {
    assert.deepStrictEqual(parseUnicodeRange('U+4??'), [[0x400, 0x4ff]]);
    assert.deepStrictEqual(parseUnicodeRange('nonsense, U+4e00'), [[0x4e00, 0x4e00]]);
    assert.deepStrictEqual(parseUnicodeRange(''), []);
    assert.deepStrictEqual(parseUnicodeRange(null), []);
  });
});

describe('intersects', () => {
  it('命中/未命中/多区间/空区间', () => {
    const range = [[0x4e00, 0x4e0f], [0x3000, 0x3001]];
    assert.strictEqual(intersects(range, [0x4e00]), true);
    assert.strictEqual(intersects(range, [0x4e0f, 0x20]), true);
    assert.strictEqual(intersects(range, [0x41, 0x20]), false);
    assert.strictEqual(intersects([], [0x4e00]), false);
    assert.strictEqual(intersects(range, new Set([0x3001])), true);
  });
});

describe('collectUsedCodepoints', () => {
  it('收集 CJK 与全角标点、忽略 ASCII、去重并升序', () => {
    const cps = collectUsedCodepoints(['中文 abc 测试！', '中文']);
    assert.deepStrictEqual(cps, [0x4e2d, 0x6587, 0x6d4b, 0x8bd5, 0xff01]);
  });
  it('容忍空输入', () => {
    assert.deepStrictEqual(collectUsedCodepoints([]), []);
    assert.deepStrictEqual(collectUsedCodepoints(null), []);
  });
});

describe('extractHtmlTexts', () => {
  it('收集正文、标题/属性与内联 JSON 配置中的中文，解码实体', () => {
    const texts = extractHtmlTexts('<title>标题字</title><meta content="描述字"><p>正文&#x5b57; &amp; 更多</p><script>{"k":"配置字"}</script>');
    const cps = collectUsedCodepoints(texts);
    for (const ch of ['标', '题', '字', '描', '述', '正', '文', '更', '多', '配', '置']) {
      assert.ok(cps.includes(ch.codePointAt(0)), 'missing codepoint for ' + ch);
    }
    assert.ok(!cps.includes(0x26), 'entity & must be decoded to ASCII and ignored');
  });
});

describe('parseFontFaceCss', () => {
  it('解析 @font-face 的 family/weight/url/unicode-range', () => {
    const chunks = parseFontFaceCss(CHUNK_CSS);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0].family, 'Noto Sans SC');
    assert.strictEqual(chunks[0].weight, 400);
    assert.strictEqual(chunks[0].url, 'https://fonts.gstatic.com/s/notosanssc/v40/han-a.woff2');
    assert.deepStrictEqual(chunks[0].unicodeRange, [[0x4e00, 0x4e0f], [0x3000, 0x3001]]);
    assert.strictEqual(chunks[2].weight, 700);
  });
});

describe('fetchChunkList', () => {
  it('注入 fetch：解析 CSS 并携带 woff2 UA', async () => {
    const { fetchImpl, calls } = makeFakeFetch();
    const chunks = await fetchChunkList({ cssUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC', timeoutMs: 1000, fetchImpl });
    assert.strictEqual(chunks.length, 3);
    assert.match(calls[0].init.headers['User-Agent'], /Chrome/);
  });
  it('HTTP 错误与解析失败均抛出', async () => {
    await assert.rejects(
      fetchChunkList({ cssUrl: 'https://x', timeoutMs: 1000, fetchImpl: async () => ({ ok: false, status: 500, text: async () => '' }) }),
      /http 500/
    );
    await assert.rejects(
      fetchChunkList({ cssUrl: 'https://x', timeoutMs: 1000, fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'body{}' }) }),
      /@font-face/
    );
  });
  it('超时经 AbortController 中止', async () => {
    const hanging = (url, init) => new Promise((resolve, reject) => {
      if (init && init.signal) init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    await assert.rejects(fetchChunkList({ cssUrl: 'https://x', timeoutMs: 30, fetchImpl: hanging }), /timeout/);
  });
});

describe('chunkFileName / buildSubsetPlan / buildFontCss', () => {
  it('缓存文件名按 URL 哈希且稳定', () => {
    const name = chunkFileName('https://fonts.gstatic.com/s/notosanssc/v40/han-a.woff2');
    assert.match(name, /^[0-9a-f]{16}\.woff2$/);
    assert.strictEqual(name, chunkFileName('https://fonts.gstatic.com/s/notosanssc/v40/han-a.woff2'));
  });
  it('仅保留与用字有交集的 chunk（按权重区分）', () => {
    const chunks = parseFontFaceCss(CHUNK_CSS);
    const plan = buildSubsetPlan(chunks, [0x4e00, 0xff01]);
    assert.strictEqual(plan.length, 2);
    assert.deepStrictEqual(plan.map((p) => p.weight), [400, 700]);
    assert.ok(plan.every((p) => /han-[ab]\.woff2$/.test(p.url)));
    assert.strictEqual(plan[0].file, chunkFileName(plan[0].url));
    assert.strictEqual(plan[0].unicodeRangeText, 'U+4e00-4e0f, U+3000-3001');
  });
  it('生成 @font-face：保留 unicode-range、swap、权重与本地前缀', () => {
    const plan = buildSubsetPlan(parseFontFaceCss(CHUNK_CSS), [0x4e00]);
    const css = buildFontCss(plan, { fontFamily: 'Noto Sans SC', urlPrefix: '/assets/fonts/noto-sans-sc/', fontDisplay: 'swap' });
    assert.strictEqual((css.match(/@font-face/g) || []).length, 2);
    assert.match(css, /font-family:'Noto Sans SC'/);
    assert.match(css, /font-weight:400/);
    assert.match(css, /font-weight:700/);
    assert.match(css, /font-display:swap/);
    assert.match(css, /unicode-range:U\+4e00-4e0f, U\+3000-3001/);
    assert.match(css, /url\('\/assets\/fonts\/noto-sans-sc\/[0-9a-f]{16}\.woff2'\) format\('woff2'\)/);
    const only700 = buildFontCss(plan, { fontFamily: 'Noto Sans SC', weight: 700, urlPrefix: '/x/' });
    assert.strictEqual((only700.match(/@font-face/g) || []).length, 1);
    assert.match(only700, /font-weight:700/);
  });
});

describe('googleFontsCssUrl / fontFamilySlug', () => {
  it('拼装 Google Fonts CSS2 URL', () => {
    const url = googleFontsCssUrl({ family: 'Noto Sans SC', weights: [700, 400, 400] });
    assert.match(url, /family=Noto\+Sans\+SC/);
    assert.match(url, /wght@400;700/);
    assert.match(url, /display=swap/);
  });
  it('字体族名转目录 slug', () => {
    assert.strictEqual(fontFamilySlug('Noto Sans SC'), 'noto-sans-sc');
    assert.strictEqual(fontFamilySlug('  Noto Sans SC  '), 'noto-sans-sc');
  });
});

describe('downloadFontChunk', () => {
  it('返回 woff2 Buffer，非 woff2 载荷拒绝', async () => {
    const buf = await downloadFontChunk('https://fonts.gstatic.com/x.woff2', { timeoutMs: 1000, fetchImpl: makeFakeFetch().fetchImpl });
    assert.strictEqual(buf.slice(0, 4).toString('ascii'), 'wOF2');
    await assert.rejects(
      downloadFontChunk('https://fonts.gstatic.com/x.woff2', {
        timeoutMs: 1000,
        fetchImpl: async () => {
          const bad = Buffer.from('not-a-font');
          return { ok: true, status: 200, arrayBuffer: async () => bad.buffer.slice(bad.byteOffset, bad.byteOffset + bad.byteLength) };
        }
      }),
      /woff2/
    );
  });
});

describe('buildCjkFonts 管线', () => {
  it('成功：写子集字体+CSS，HTML 引用带内容哈希，缓存落盘', async () => {
    const dist = tmpDir('cjk-dist-');
    const cache = tmpDir('cjk-cache-');
    writeDistHtml(dist, 'zh/index.html', HTML_FIXTURE);
    writeDistHtml(dist, 'en/index.html', '<html><body>hello</body></html>');
    const { fetchImpl, calls } = makeFakeFetch();
    const mod = createCjkFontsModule({ distDir: dist, cacheDir: cache, logger: SILENT, fetchImpl });
    const res = await mod.buildCjkFonts(baseConfig());
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.kept, 2);
    assert.strictEqual(res.downloaded, 2);
    assert.strictEqual(res.bytes, CHUNK_BYTES.length * 2);
    const css = fs.readFileSync(path.join(dist, CJK_CSS_HREF.replace(/^\//, '')), 'utf-8');
    assert.match(css, /unicode-range:U\+4e00-4e0f, U\+3000-3001/);
    const fontDir = path.join(dist, 'assets', 'fonts', 'noto-sans-sc');
    assert.deepStrictEqual(fs.readdirSync(fontDir).sort().length, 2);
    assert.match(fs.readFileSync(path.join(dist, 'zh', 'index.html'), 'utf-8'), /\/assets\/css\/cjk-fonts\.css\?v=[0-9a-f]{10}/);
    assert.ok(!fs.readFileSync(path.join(dist, 'en', 'index.html'), 'utf-8').includes('cjk-fonts.css'));
    assert.ok(fs.existsSync(path.join(cache, 'chunk-list.json')));
    assert.strictEqual(calls.filter((c) => c.url.includes('fonts.googleapis.com')).length, 1);
  });

  it('离线且无缓存：跳过并告警，不抛错、清理产物、剥离 HTML 引用', async () => {
    const dist = tmpDir('cjk-dist-');
    const cache = tmpDir('cjk-cache-');
    writeDistHtml(dist, 'zh/index.html', HTML_FIXTURE);
    const { fetchImpl } = makeFakeFetch({ offline: true });
    const warns = [];
    const mod = createCjkFontsModule({ distDir: dist, cacheDir: cache, logger: { log() {}, warn: (m) => warns.push(m), error() {} }, fetchImpl });
    const res = await mod.buildCjkFonts(baseConfig());
    assert.strictEqual(res.ok, false);
    assert.match(res.reason, /offline-simulated/);
    assert.ok(!fs.existsSync(path.join(dist, 'assets', 'css', 'cjk-fonts.css')));
    assert.ok(!fs.existsSync(path.join(dist, 'assets', 'fonts', 'noto-sans-sc')));
    assert.ok(!fs.readFileSync(path.join(dist, 'zh', 'index.html'), 'utf-8').includes('cjk-fonts.css'));
    assert.strictEqual(warns.length, 1);
    assert.match(warns[0], /\[cjk-fonts\]/);
  });

  it('下载中断：跳过并剥离引用（不产生半套产物）', async () => {
    const dist = tmpDir('cjk-dist-');
    const cache = tmpDir('cjk-cache-');
    writeDistHtml(dist, 'zh/index.html', HTML_FIXTURE);
    const { fetchImpl } = makeFakeFetch({ failChunk: true });
    const mod = createCjkFontsModule({ distDir: dist, cacheDir: cache, logger: SILENT, fetchImpl });
    const res = await mod.buildCjkFonts(baseConfig());
    assert.strictEqual(res.ok, false);
    assert.match(res.reason, /chunk-download-failed/);
    assert.ok(!fs.existsSync(path.join(dist, 'assets', 'css', 'cjk-fonts.css')));
    assert.ok(!fs.existsSync(path.join(dist, 'assets', 'fonts', 'noto-sans-sc')));
    assert.ok(!fs.readFileSync(path.join(dist, 'zh', 'index.html'), 'utf-8').includes('cjk-fonts.css'));
  });

  it('热缓存离线复用：零网络请求仍产出全部子集', async () => {
    const cache = tmpDir('cjk-cache-');
    const dist1 = tmpDir('cjk-dist-');
    writeDistHtml(dist1, 'zh/index.html', HTML_FIXTURE);
    const warm = createCjkFontsModule({ distDir: dist1, cacheDir: cache, logger: SILENT, fetchImpl: makeFakeFetch().fetchImpl });
    assert.strictEqual((await warm.buildCjkFonts(baseConfig())).ok, true);

    const dist2 = tmpDir('cjk-dist-');
    writeDistHtml(dist2, 'zh/index.html', HTML_FIXTURE);
    const offline = createCjkFontsModule({
      distDir: dist2,
      cacheDir: cache,
      logger: SILENT,
      fetchImpl: async () => { throw new Error('network must not be called'); }
    });
    const res = await offline.buildCjkFonts(baseConfig());
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.downloaded, 0);
    assert.strictEqual(res.reused, 2);
    assert.ok(fs.existsSync(path.join(dist2, 'assets', 'css', 'cjk-fonts.css')));
  });

  it('无中文用字：跳过并剥离引用', async () => {
    const dist = tmpDir('cjk-dist-');
    const cache = tmpDir('cjk-cache-');
    writeDistHtml(dist, 'zh/index.html', '<html><body>ascii only</body></html>');
    const mod = createCjkFontsModule({ distDir: dist, cacheDir: cache, logger: SILENT, fetchImpl: makeFakeFetch().fetchImpl });
    const res = await mod.buildCjkFonts(baseConfig());
    assert.strictEqual(res.ok, false);
    assert.match(res.reason, /CJK/);
  });

  it('外部化 JSON 配置中的中文纳入用字（仅 JSON 含中文也能产出）', async () => {
    const dist = tmpDir('cjk-dist-');
    const cache = tmpDir('cjk-cache-');
    writeDistHtml(dist, 'zh/index.html', '<html><body>ascii only</body></html>');
    fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'assets', 'config.abc.json'), JSON.stringify({ quote: '一二三' }), 'utf-8');
    const mod = createCjkFontsModule({ distDir: dist, cacheDir: cache, logger: SILENT, fetchImpl: makeFakeFetch().fetchImpl });
    const res = await mod.buildCjkFonts(baseConfig());
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.codepoints, 3);
    assert.strictEqual(res.kept, 2);
    assert.ok(fs.existsSync(path.join(dist, 'assets', 'css', 'cjk-fonts.css')));
  });

  it('enabled=false 时完全跳过', async () => {
    const dist = tmpDir('cjk-dist-');
    const cache = tmpDir('cjk-cache-');
    writeDistHtml(dist, 'zh/index.html', HTML_FIXTURE);
    const mod = createCjkFontsModule({ distDir: dist, cacheDir: cache, logger: SILENT, fetchImpl: makeFakeFetch().fetchImpl });
    const res = await mod.buildCjkFonts(baseConfig({ enabled: false }));
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.skipped, true);
    assert.ok(!fs.existsSync(path.join(dist, 'assets', 'css', 'cjk-fonts.css')));
  });
});
