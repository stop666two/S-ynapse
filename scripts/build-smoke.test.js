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
const { execFileSync } = require('node:child_process');
const { resolveChromePath } = require('./lib/mermaid-render');

const ROOT = path.resolve(__dirname, '..');
const BAD_SLUG = 'zz-smoke-bad-' + process.pid;
const BAD_ARTICLE = path.join(ROOT, 'articles', 'zh', BAD_SLUG + '.md');
const SKIP_IN_UNIT_SUITE = process.env.npm_lifecycle_event === 'test';

let tmpDir = null;

function runBuild() {
  return execFileSync(process.execPath, ['scripts/build.js', '--out', tmpDir], {
    cwd: ROOT,
    env: { ...process.env, SYNAPSE_OUT_DIR: tmpDir, NODE_ENV: 'production' },
    stdio: 'pipe',
    timeout: 240000
  });
}

// 失败时把子进程输出尾部带给断言消息，避免只看到 "Command failed"。
function outputTail(err) {
  const text = String(err.stdout || '') + String(err.stderr || '');
  return text.length > 4000 ? '...(truncated)\n' + text.slice(-4000) : text;
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
      runBuild();
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
    const styleNonce = /'nonce-([^']+)'/.exec(styleSrc);
    assert.ok(styleNonce && styleNonce[1] === (/'nonce-([^']+)'/.exec(scriptSrc) || [])[1], 'script-src and style-src must share one nonce');
    const html = fs.readFileSync(path.join(tmpDir, 'zh', 'index.html'), 'utf-8');
    const styleTags = html.match(/<style\b[^>]*>/gi) || [];
    assert.ok(styleTags.length > 0, 'index.html must contain the customCSS <style> block');
    for (const tag of styleTags) {
      assert.ok(tag.includes('nonce="' + styleNonce[1] + '"'), 'inline <style> must carry the build-time nonce: ' + tag);
    }
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
      runBuild();
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
