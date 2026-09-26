// 构建管线集成冒烟测试（审计 F-6）：用 `--out <临时目录>` 执行真实构建，
// 断言关键产物与 CSP nonce；再注入一篇坏文章，验证预校验阻断构建且不破坏上一轮产物。
// 运行：npm run test:build（CI 门禁）；也可直接 node --test scripts/build-smoke.test.js。
// 注意：`npm test` 的 glob（scripts/*.test.js）会匹配到本文件，此时按 npm 生命周期事件跳过，
// 避免拖慢单测套件，并与并发改写 workers/security-config.js 的 security-worker.test.js 互斥。

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { resolveChromePath } = require('./lib/mermaid-render');

const ROOT = path.resolve(__dirname, '..');
const BAD_SLUG = 'zz-smoke-bad-' + process.pid;
const BAD_ARTICLE = path.join(ROOT, 'articles', 'zh', BAD_SLUG + '.md');
const SKIP_IN_UNIT_SUITE = process.env.npm_lifecycle_event === 'test';

let tmpDir = null;

function runBuild(outDir, extraArgs) {
  const args = ['scripts/build.js', '--out', outDir].concat(extraArgs || []);
  return execFileSync(process.execPath, args, {
    cwd: ROOT,
    env: { ...process.env, SYNAPSE_OUT_DIR: outDir, NODE_ENV: 'production' },
    stdio: 'pipe',
    timeout: 240000
  });
}

// 失败时把子进程输出尾部带给断言消息，避免只看到 "Command failed"。
function outputTail(err) {
  const text = String(err.stdout || '') + String(err.stderr || '');
  return text.length > 4000 ? '...(truncated)\n' + text.slice(-4000) : text;
}

// 递归目录摘要：POSIX 相对路径 → sha1 内容哈希（跨状态比较用）。
function treeDigest(dir) {
  const out = {};
  (function walk(current, rel) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const key = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(abs, key);
      else out[key] = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex');
    }
  })(dir, '');
  return out;
}

// HTML 归一化：构建进程每次随机生成 CSP nonce，跨构建比较前必须替换为占位符。
function normalizeNonce(html) {
  return html
    .replace(/(nonce\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1"NONCE"')
    .replace(/'nonce-[^']*'/gi, "'nonce-NONCE'");
}

// 构建报告 HTML 归一化：时间戳 / 构建耗时 / 输出体积随构建变化，压缩处理方式不受其影响。
function normalizeReportHtml(html) {
  return normalizeNonce(html)
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, 'TIME')
    .replace(/(构建耗时<\/span><span class="stat-value">)[^<]*/, '$1ELAPSED')
    .replace(/(输出体积<\/span><span class="stat-value">)[^<]*/, '$1SIZE');
}

// 收集 HTML 相对路径 → 原文（排除构建报告：含时间与体积统计）。
function collectHtml(dir) {
  const out = {};
  (function walk(current, rel) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const key = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(abs, key);
      else if (/\.html?$/i.test(entry.name) && key !== 'build-report.html') out[key] = fs.readFileSync(abs, 'utf-8');
    }
  })(dir, '');
  return out;
}

// 未被基线压缩触及的 vendor 资产：构建产物必须与 node_modules 源逐字节一致。
// （katex.min.css 例外：基线 CleanCSS 会进一步压缩，属既有行为，用跨状态摘要一致性覆盖。）
const VENDOR_SOURCE_PAIRS = [
  ['assets/vendor/mermaid.min.js', 'node_modules/mermaid/dist/mermaid.min.js'],
  ['assets/vendor/katex/katex.min.js', 'node_modules/katex/dist/katex.min.js'],
  ['assets/vendor/katex/contrib/auto-render.min.js', 'node_modules/katex/dist/contrib/auto-render.min.js'],
  ['assets/vendor/morphicons/index.js', 'node_modules/morphicons/dist/index.js'],
  ['assets/vendor/morphicons/dom.js', 'node_modules/morphicons/dist/dom.js'],
  ['assets/vendor/fonts/inter-latin-wght-normal.woff2', 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2']
];

// SSR 导航高亮提取：返回页面中 header 导航 nav-active 链接的数量与 href（属性可能被 minify 重排/去引号）。
function navActiveInfo(html) {
  const tags = html.match(/<a[^>]*class="[^"]*\bnav-active\b[^"]*"[^>]*>/g) || [];
  const tag = tags[0] || '';
  const m = tag.match(/href=(?:"([^"]+)"|([^\s>]+))/);
  return { count: tags.length, href: m ? (m[1] || m[2]) : '' };
}

describe('build pipeline smoke', { skip: SKIP_IN_UNIT_SUITE ? 'run via npm run test:build (integration, not the unit suite)' : false }, () => {
  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-build-smoke-'));
    fs.rmSync(BAD_ARTICLE, { force: true });
  });

  after(() => {
    fs.rmSync(BAD_ARTICLE, { force: true });
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('clean build writes the expected artifacts and a nonce-based CSP', () => {
    try {
      runBuild(tmpDir);
    } catch (err) {
      assert.fail('build must exit 0, got status ' + err.status + ':\n' + outputTail(err));
    }
    const required = [
      path.join(tmpDir, 'zh', 'index.html'),
      path.join(tmpDir, 'en', 'index.html'),
      path.join(tmpDir, 'zh', 'search-index.json'),
      path.join(tmpDir, 'zh', 'sitemap.xml'),
      path.join(tmpDir, 'zh', 'feed.xml'),
      path.join(tmpDir, '404.html')
    ];
    for (const file of required) {
      assert.ok(fs.existsSync(file), 'missing artifact: ' + path.relative(tmpDir, file));
    }
    const root404 = fs.readFileSync(path.join(tmpDir, '404.html'), 'utf-8');
    assert.ok(root404.includes('S-LANG-REDIRECT-404'), 'root 404 must carry the language redirect hook');
    assert.ok(root404.includes('/en/404.html'), 'root 404 must route en visitors to the localized page');
    const redirects = fs.readFileSync(path.join(tmpDir, '_redirects'), 'utf-8');
    assert.ok(!/^\/404\.html\s/m.test(redirects), 'root 404 must not be server-redirected to the zh page');
    const headers = fs.readFileSync(path.join(tmpDir, '_headers'), 'utf-8');
    const jsRule = headers.split('\n\n').find((section) => section.startsWith('/assets/js/*'));
    assert.ok(jsRule && jsRule.includes('max-age=31536000'), 'hashed JS bundle path must be immutable in bundle mode (single merged Cache-Control)');
    const cspLine = headers.split('\n').find((line) => line.includes('Content-Security-Policy')) || '';
    const cspParts = cspLine.split(';').map((part) => part.trim());
    const scriptSrc = cspParts.find((part) => part.startsWith('script-src ')) || '';
    const styleSrc = cspParts.find((part) => part.startsWith('style-src ')) || '';
    const styleAttr = cspParts.find((part) => part.startsWith('style-src-attr ')) || '';
    assert.ok(scriptSrc.includes('nonce-'), 'script-src must carry the build-time nonce');
    assert.ok(!scriptSrc.includes("'unsafe-inline'"), "script-src must not allow 'unsafe-inline'");
    assert.ok(styleSrc.includes('nonce-'), 'style-src must carry the build-time nonce');
    assert.ok(!styleSrc.includes("'unsafe-inline'"), "style-src must not allow 'unsafe-inline' (element context)");
    assert.ok(!styleAttr || !styleAttr.includes("'unsafe-inline'"), "style-src-attr must not allow 'unsafe-inline' (inline style attributes eliminated)");
    assert.ok(cspLine.includes("frame-ancestors 'none'"), "frame-ancestors 'none' must be present");
    // nonce 同源回归（线上事故根因）：_headers 的 nonce 必须能解析，且根 404 重定向脚本必须携带同一枚。
    const headerNonce = (/'nonce-([^']+)'/.exec(scriptSrc) || [])[1];
    assert.ok(headerNonce, 'script-src nonce must be parseable from _headers');
    const redirectTag = (root404.match(/<script\b[^>]*>\s*\/\*S-LANG-REDIRECT-404\*\//) || [''])[0];
    assert.ok(redirectTag, 'root 404 redirect script tag must exist');
    assert.ok(redirectTag.includes('nonce="' + headerNonce + '"'), 'root 404 redirect script must carry the build nonce (CSP)');
    // 内联 style 属性回归：模板/构建产物一律不得再出现元素 style 属性（CSP 属性语境无 nonce）。
    // 正则兼容压缩后的 style=x 形式，且 [\s"'] 前缀不会误伤 <style> 标签与 --style / font-style 字样。
    const htmlFiles = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.html')) htmlFiles.push(p);
      }
    })(tmpDir);
    assert.ok(htmlFiles.length > 0, 'build must emit HTML pages');
    for (const file of htmlFiles) {
      const text = fs.readFileSync(file, 'utf-8');
      assert.ok(!/[\s"']style\s*=/.test(text), 'no inline style attributes in ' + path.relative(tmpDir, file));
      assert.ok(!text.includes('font-style='), 'no font-style presentation attributes in ' + path.relative(tmpDir, file));
    }
    // nonce 全站一致性：每个 HTML 里出现的每个 nonce 都必须与 _headers 同源；
    // 跨构建污染（例如 --out 测试构建写回部署用 Worker 配置）会造成线上内联脚本/样式被整批拦截。
    const noncePat = /nonce\s*=\s*(?:"([^"]+)"|([^\s>]+))/gi;
    let nonceCount = 0;
    for (const file of htmlFiles) {
      const text = fs.readFileSync(file, 'utf-8');
      for (const m of text.matchAll(noncePat)) {
        nonceCount++;
        const value = m[1] || m[2];
        assert.strictEqual(value, headerNonce, 'page nonce must match _headers nonce in ' + path.relative(tmpDir, file));
      }
    }
    assert.ok(nonceCount > 0, 'built pages must carry CSP nonces');
    // SSR 导航高亮（R1）：构建期输出 nav-active + aria-current="page"，JS 不可用或 features.motion
    // 关闭时仍正确；每页至多 1 项，文章页不误高亮；判定与运行时 nav-state.js 同源（scripts/lib/nav-match.js）。
    const navCases = [
      ['zh/index.html', '/zh/'],
      ['zh/archive/index.html', '/zh/archive'],
      ['zh/tags/index.html', '/zh/tags'],
      ['en/index.html', '/en/']
    ];
    for (const [rel, want] of navCases) {
      const info = navActiveInfo(fs.readFileSync(path.join(tmpDir, rel), 'utf-8'));
      assert.strictEqual(info.count, 1, rel + ' must have exactly one SSR nav-active link');
      assert.strictEqual(info.href, want, rel + ' SSR nav-active href must be ' + want);
    }
    const ssrPostPage = path.join(tmpDir, 'zh', 'series-1', 'index.html');
    if (fs.existsSync(ssrPostPage)) {
      assert.strictEqual((fs.readFileSync(ssrPostPage, 'utf-8').match(/nav-active/g) || []).length, 0,
        'article page must not SSR-highlight any nav item');
    }
    const styleNonce = /'nonce-([^']+)'/.exec(styleSrc);
    assert.ok(styleNonce && styleNonce[1] === (/'nonce-([^']+)'/.exec(scriptSrc) || [])[1], 'script-src and style-src must share one nonce');
    const html = fs.readFileSync(path.join(tmpDir, 'zh', 'index.html'), 'utf-8');
    const styleTags = html.match(/<style\b[^>]*>/gi) || [];
    assert.ok(styleTags.length > 0, 'index.html must contain inline <style> blocks');
    for (const tag of styleTags) {
      assert.ok(tag.includes('nonce="' + styleNonce[1] + '"'), 'inline <style> must carry the build-time nonce: ' + tag);
    }
    // C3 同页合并（增强默认开启）：首页无跨 stylesheet 截断，presets 与 customCSS 合并且保留原首尾片段。
    const pageStyleBlocks = html.match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || [];
    assert.strictEqual(pageStyleBlocks.length, 1, 'C3 merge must collapse page inline styles into one block');
    assert.match(pageStyleBlocks[0], /\[data-preset=/, 'merged block must keep the first original rule (presets)');
    assert.match(pageStyleBlocks[0], /border-left-color:\s*var\(--color-accent\)/, 'merged block must keep the last original rule (customCSS)');
    assert.ok(!/id="?customCSS"?/.test(html), 'merged block drops the per-block id attribute (documented behavior)');
    const appMatch = html.match(/\/assets\/js\/app\.[0-9A-Za-z]+\.js/);
    const deferredMatch = html.match(/__DEFERRED_URL__=[`"'](\/assets\/js\/deferred\.[0-9A-Za-z]+\.js)[`"']/);
    assert.ok(appMatch, 'index.html must reference the hashed app chunk');
    assert.ok(deferredMatch, 'index.html must expose the hashed deferred chunk URL');
    const toAbs = (url) => path.join(tmpDir, url.replace(/^\//, '').split('/').join(path.sep));
    assert.ok(fs.existsSync(toAbs(appMatch[0])), 'app chunk must exist on disk');
    assert.ok(fs.existsSync(toAbs(deferredMatch[1])), 'deferred chunk must exist on disk');
    const runtimeMatch = html.match(/\/assets\/js\/runtime\.[0-9A-Za-z]+\.js/);
    assert.ok(runtimeMatch, 'index.html must reference the hashed runtime bootstrap');
    assert.ok(fs.existsSync(toAbs(runtimeMatch[0])), 'runtime bootstrap must exist on disk');
    assert.ok(!html.includes('/assets/vendor/prism.js'), 'home (no code blocks) must not load the Prism vendor');
    assert.ok(!html.includes('/assets/vendor/mermaid.min.js') && !html.includes('data-mm-src'), 'home (no diagrams) must not load the mermaid vendor');
    const codeShowcase = path.join(tmpDir, 'zh', 'code-showcase', 'index.html');
    if (fs.existsSync(codeShowcase)) {
      const codeHtml = fs.readFileSync(codeShowcase, 'utf-8');
      assert.ok(codeHtml.includes('/assets/vendor/prism.js'), 'code article must load the Prism vendor');
    }
    // Mermaid 构建期渲染：有 Chrome 的环境断言全量内联、页面零 vendor 请求；
    // 无 Chrome 环境断言自动回退客户端（data-mm-src 保留，行为等同改造前）。
    const mermaidPage = path.join(tmpDir, 'zh', 'diagrams-math', 'index.html');
    if (fs.existsSync(mermaidPage)) {
      const mmHtml = fs.readFileSync(mermaidPage, 'utf-8');
      if (resolveChromePath('')) {
        assert.ok(mmHtml.includes('class="mermaid mermaid-ssr"'), 'mermaid article must inline SSR diagrams');
        assert.ok(/<svg[^>]*class="mm-svg mm-light"/.test(mmHtml), 'mermaid SSR must embed an inline light <svg>');
        assert.ok(/<svg[^>]*class="mm-svg mm-dark"/.test(mmHtml), 'mermaid SSR must embed an inline dark <svg> (dual theme)');
        assert.ok(!mmHtml.includes('/assets/vendor/mermaid.min.js') && !mmHtml.includes('data-mm-src'), 'SSR page must not request the mermaid vendor');
        assert.ok(!mmHtml.includes('data-mm-pending'), 'all diagrams must render server-side in a Chrome-enabled environment');
      } else {
        assert.ok(mmHtml.includes('data-mm-src="/assets/vendor/mermaid.min.js"'), 'no-Chrome env must fall back to the lazy client vendor');
        assert.ok(mmHtml.includes('data-mm-pending'), 'no-Chrome env must mark blocks pending for client rendering');
      }
    }
    assert.ok(!fs.existsSync(path.join(tmpDir, 'assets', 'js', 'core', 'main.js')), 'raw ESM sources must not be copied when bundling');
    const katexFonts = path.join(tmpDir, 'assets', 'vendor', 'katex', 'fonts');
    if (fs.existsSync(katexFonts)) {
      const badFonts = fs.readdirSync(katexFonts).filter((f) => !/\.woff2$/.test(f));
      assert.deepStrictEqual(badFonts, [], 'KaTeX fonts must be woff2-only: ' + badFonts.join(','));
    }
    const fontRule = headers.split('\n\n').find((section) => section.startsWith('/assets/fonts/*'));
    assert.ok(fontRule && fontRule.includes('max-age=31536000'), 'CJK subset font chunks must be immutable-cacheable');
    // CJK 字体子集化双态（两态都绿）：有网络（或热缓存）时 CSS 与分片存在且 zh 页面引用；
    // 断网且无缓存时构建成功、不产出 CSS，且 HTML 中的引用已被剥离（不会出现 404 外链）。
    const cjkCss = path.join(tmpDir, 'assets', 'css', 'cjk-fonts.css');
    const zhHome = fs.readFileSync(path.join(tmpDir, 'zh', 'index.html'), 'utf-8');
    if (fs.existsSync(cjkCss)) {
      assert.match(zhHome, /\/assets\/css\/cjk-fonts\.css/);
      const cjkFontDir = path.join(tmpDir, 'assets', 'fonts', 'noto-sans-sc');
      const cjkChunks = fs.existsSync(cjkFontDir) ? fs.readdirSync(cjkFontDir).filter((f) => /\.woff2$/.test(f)) : [];
      assert.ok(cjkChunks.length >= 1, 'CJK subset must ship at least one woff2 chunk');
      assert.match(fs.readFileSync(cjkCss, 'utf-8'), /@font-face[\s\S]*unicode-range:/, 'CJK subset CSS must keep @font-face unicode-range rules');
    } else {
      assert.ok(!zhHome.includes('cjk-fonts.css'), 'degraded build must not leave a dangling CJK stylesheet reference');
    }
    const cssDir = path.join(tmpDir, 'assets', 'css');
    const siteCssFile = fs.readdirSync(cssDir).find((f) => /^site\..+\.css$/.test(f));
    assert.ok(siteCssFile, 'hashed site css bundle must exist');
    const siteCss = fs.readFileSync(path.join(cssDir, siteCssFile), 'utf-8');
    assert.ok(/--ff-d:[^;]*(Georgia|Songti)/.test(siteCss), 'display font stack must resolve to the editorial serif stack');
    // 构建期图片定尺寸（CLS 修复）：manifest 图片（data-iw 标记，含 <picture> 内 img）必须带
    // width/height，供浏览器解码前预留宽高比；头图/卡片图/画廊图同源断言在各自页面。
    const articlePage = ['long-stress', 'code-showcase'].map((s) => path.join(tmpDir, 'zh', s, 'index.html')).find((f) => fs.existsSync(f));
    if (articlePage) {
      const articleHtml = fs.readFileSync(articlePage, 'utf-8');
      const bodyImgs = (articleHtml.match(/<img\b[^>]*>/g) || []).filter((t) => t.includes('data-iw='));
      assert.ok(bodyImgs.length >= 1, 'article page must render at least one manifest image');
      for (const tag of bodyImgs) {
        assert.ok(/\bwidth="?\d+/.test(tag) && /\bheight="?\d+/.test(tag),
          'manifest image must carry build-time width/height (CLS fix): ' + tag.slice(0, 160));
      }
      const featuredImg = articleHtml.match(/<img[^>]*post-featured-image[^>]*>/);
      assert.ok(featuredImg, 'article page must render the featured image');
      assert.ok(/\bwidth="?\d+/.test(featuredImg[0]) && /\bheight="?\d+/.test(featuredImg[0]),
        'featured image must carry build-time width/height (CLS fix): ' + featuredImg[0].slice(0, 160));
    }
    const cardHtml = fs.readFileSync(path.join(tmpDir, 'zh', 'index.html'), 'utf-8');
    const cardImg = cardHtml.match(/<img[^>]*post-card-image[^>]*>/);
    if (cardImg) {
      assert.ok(/\bwidth="?\d+/.test(cardImg[0]) && /\bheight="?\d+/.test(cardImg[0]),
        'card image must carry build-time width/height (CLS fix): ' + cardImg[0].slice(0, 160));
    }
    const galleryPage = path.join(tmpDir, 'zh', 'gallery', 'index.html');
    if (fs.existsSync(galleryPage)) {
      const galleryHtml = fs.readFileSync(galleryPage, 'utf-8');
      const galleryBlock = (galleryHtml.match(/<figure class="gallery-item">[\s\S]*?<\/figure>/g) || [])[0];
      const galleryImg = galleryBlock ? (galleryBlock.match(/<img\b[^>]*>/) || [])[0] : null;
      if (galleryImg) {
        assert.ok(/\bwidth="?\d+/.test(galleryImg) && /\bheight="?\d+/.test(galleryImg),
          'gallery image must carry build-time width/height (CLS fix): ' + galleryImg.slice(0, 160));
      }
    }
  });

  it('compression-off second state keeps non-enhanced artifacts byte-identical', () => {
    const offDir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-build-smoke-off-'));
    const overrideFile = path.join(offDir, 'compression-off.json5');
    fs.writeFileSync(overrideFile, '{ enabled: false }\n', 'utf-8');
    try {
      try {
        runBuild(offDir, ['--compression-override', overrideFile]);
      } catch (err) {
        assert.fail('compression-off build must exit 0, got status ' + err.status + ':\n' + outputTail(err));
      }
      // ① vendor 未被增强步骤触碰：JS / 字体与 node_modules 源逐字节一致。
      for (const [rel, src] of VENDOR_SOURCE_PAIRS) {
        const built = path.join(tmpDir, rel.split('/').join(path.sep));
        const source = path.join(ROOT, src.split('/').join(path.sep));
        assert.ok(fs.existsSync(built), 'vendor asset must exist: ' + rel);
        assert.deepStrictEqual(fs.readFileSync(built), fs.readFileSync(source),
          'vendor asset must stay byte-identical to its node_modules source: ' + rel);
      }
      // vendor 全树跨状态一致（含基线 CleanCSS 会触碰的 katex.min.css：两态基线行为相同）。
      assert.deepStrictEqual(
        treeDigest(path.join(offDir, 'assets', 'vendor')),
        treeDigest(path.join(tmpDir, 'assets', 'vendor')),
        'vendor tree must be identical between default and compression-off builds'
      );
      // ② 增强步骤只改内联 <style>：移除 style 块后，HTML 跨态逐字节一致；
      // 且开启态 style 块数不得多于关闭态（C3 合并真实生效）。
      const defaultHtml = collectHtml(tmpDir);
      const offHtml = collectHtml(offDir);
      assert.ok(Object.keys(defaultHtml).length > 0, 'build must emit HTML pages');
      assert.deepStrictEqual(Object.keys(offHtml).sort(), Object.keys(defaultHtml).sort(),
        'both states must emit the same HTML page set');
      const stripStyleBlocks = (text) => text.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
      for (const rel of Object.keys(defaultHtml)) {
        assert.strictEqual(
          stripStyleBlocks(normalizeNonce(offHtml[rel])),
          stripStyleBlocks(normalizeNonce(defaultHtml[rel])),
          'non-style HTML must be identical across states: ' + rel
        );
        const onCount = (defaultHtml[rel].match(/<style\b/gi) || []).length;
        const offCount = (offHtml[rel].match(/<style\b/gi) || []).length;
        assert.ok(onCount <= offCount, 'compression-on must not add style blocks: ' + rel + ' (' + onCount + ' vs ' + offCount + ')');
      }
      // 混淆默认关：两态 bundle 文件名一致（未发生混淆重命名）。
      const bundleNames = (dir) => fs.readdirSync(path.join(dir, 'assets', 'js')).filter((f) => /^(app|deferred)\./.test(f)).sort();
      assert.deepStrictEqual(bundleNames(offDir), bundleNames(tmpDir), 'obfuscation-off default must keep bundle names across states');
      // 已紧凑的单行 JSON（search-index）不因压缩步骤变化。
      assert.deepStrictEqual(
        fs.readFileSync(path.join(offDir, 'zh', 'search-index.json')),
        fs.readFileSync(path.join(tmpDir, 'zh', 'search-index.json')),
        'compact JSON must stay untouched by the JSON enhancement'
      );
      // feed.json 是 JSON 增强目标：默认态单行化；关闭态保留换行（证明开关真实生效）。
      const defaultFeed = fs.readFileSync(path.join(tmpDir, 'zh', 'feed.json'), 'utf-8');
      const offFeed = fs.readFileSync(path.join(offDir, 'zh', 'feed.json'), 'utf-8');
      assert.ok(!/[\r\n]/.test(defaultFeed), 'default state must compact feed.json to a single line');
      assert.ok(/[\r\n]/.test(offFeed), 'compression-off state must keep feed.json multi-line');
      assert.deepStrictEqual(JSON.parse(defaultFeed), JSON.parse(offFeed), 'JSON compaction must preserve semantics');
      // 报告文件两态均保持人类可读；内容除时间/体积统计外一致（豁免名单生效）。
      const reportA = fs.readFileSync(path.join(tmpDir, 'build-report.html'), 'utf-8');
      const reportB = fs.readFileSync(path.join(offDir, 'build-report.html'), 'utf-8');
      assert.ok(reportA.includes('\n') && reportB.includes('\n'), 'build-report.html must stay human-readable');
      assert.strictEqual(normalizeReportHtml(reportB), normalizeReportHtml(reportA),
        'build report must be identical across states apart from timing/size stats');
    } finally {
      fs.rmSync(offDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });

  it('bad content blocks the build and leaves previous output untouched', () => {
    const indexHtml = path.join(tmpDir, 'zh', 'index.html');
    const beforeHash = fs.readFileSync(indexHtml);
    fs.writeFileSync(BAD_ARTICLE, [
      '---',
      'title: Smoke Bad Article',
      'slug: ' + BAD_SLUG,
      'date: 2026-01-01',
      'tags: [""]',
      '---',
      '# Smoke bad',
      'Body.'
    ].join('\n'), 'utf-8');
    let failed = false;
    let output = '';
    try {
      runBuild(tmpDir);
    } catch (err) {
      failed = true;
      output = outputTail(err);
    } finally {
      fs.rmSync(BAD_ARTICLE, { force: true });
    }
    assert.ok(failed, 'build must fail on an empty taxonomy entry');
    assert.match(output, /PREFLIGHT|taxonomy/);
    assert.deepStrictEqual(fs.readFileSync(indexHtml), beforeHash, 'preflight abort must not rewrite previous output');
  });
});
