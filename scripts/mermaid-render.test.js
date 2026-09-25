'use strict';
// mermaid 构建期渲染（SSR）纯逻辑与降级路径单测：
// - mermaidCacheKey / extractMermaidBlocks / replaceMermaidBlocks / resolveChromePath
// - createMermaidRenderer 无 Chrome 降级与缓存命中（不启动真实浏览器）
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  mermaidCacheKey,
  extractMermaidBlocks,
  replaceMermaidBlocks,
  resolveChromePath,
  createMermaidRenderer
} = require('./lib/mermaid-render');

const SILENT = { log() {}, warn() {}, error() {} };

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-render-'));
}

describe('mermaidCacheKey', () => {
  it('返回 16 位十六进制且对同一输入稳定', () => {
    const a = mermaidCacheKey('graph TD;A-->B', 'default', '11.17.2');
    assert.match(a, /^[0-9a-f]{16}$/);
    assert.strictEqual(a, mermaidCacheKey('graph TD;A-->B', 'default', '11.17.2'));
  });
  it('主题、源码、版本任一不同即换键', () => {
    const base = mermaidCacheKey('graph TD', 'default', '11.17.2');
    assert.notStrictEqual(base, mermaidCacheKey('graph TD', 'dark', '11.17.2'));
    assert.notStrictEqual(base, mermaidCacheKey('graph LR', 'default', '11.17.2'));
    assert.notStrictEqual(base, mermaidCacheKey('graph TD', 'default', '11.4.1'));
  });
});

describe('extractMermaidBlocks', () => {
  it('提取 pre>code.language-mermaid，解码实体并读取 w/h', () => {
    const html = '<p>前</p><pre class="line-numbers" data-language="mermaid" data-w="900px" data-h="520px"><code class="language-mermaid">graph TD\n  A &amp; B --&gt; C</code></pre><p>后</p>';
    const blocks = extractMermaidBlocks(html);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].form, 'pre');
    assert.strictEqual(blocks[0].code, 'graph TD\n  A & B --> C');
    assert.strictEqual(blocks[0].w, '900px');
    assert.strictEqual(blocks[0].h, '520px');
  });
  it('按出现顺序提取多个块，忽略非 mermaid 代码块', () => {
    const html = '<pre><code class="language-js">x</code></pre>'
      + '<pre data-language="mermaid"><code class="language-mermaid">graph TD;A-->B</code></pre>'
      + '<pre data-language="mermaid"><code class="language-mermaid">pie title P</code></pre>';
    const blocks = extractMermaidBlocks(html);
    assert.deepStrictEqual(blocks.map((b) => b.code), ['graph TD;A-->B', 'pie title P']);
  });
  it('识别既有客户端渲染形态 div.mermaid[data-src] 并跳过 SSR 产物', () => {
    const html = '<div class="mermaid" data-src="graph LR;X--&gt;Y"></div>'
      + '<div class="mermaid mermaid-ssr" data-theme-pair="light|dark"><svg></svg></div>';
    const blocks = extractMermaidBlocks(html);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].form, 'div');
    assert.strictEqual(blocks[0].code, 'graph LR;X-->Y');
  });
  it('没有 mermaid 块时返回空数组', () => {
    assert.deepStrictEqual(extractMermaidBlocks('<p>plain</p>'), []);
  });
});

describe('replaceMermaidBlocks', () => {
  const SIZE = { width: '', height: '', minWidth: '320px', minHeight: '200px', maxWidth: 'none', maxHeight: 'none', fit: 'scroll' };
  const LIGHT = '<svg id="m1" width="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>#m1 .n{fill:#333}</style><g class="n">A</g></svg>';
  const DARK = '<svg id="m2" width="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g class="node">A</g></svg>';

  it('成功块替换为双主题内联 SVG 容器，并移除原 pre', () => {
    const html = '<p>x</p><pre data-language="mermaid" data-w="900px"><code class="language-mermaid">graph TD</code></pre><p>y</p>';
    const out = replaceMermaidBlocks(html, [{ svg: LIGHT, svgDark: DARK }], { size: SIZE, nonce: 'N0NCE' });
    assert.ok(!out.includes('<pre'), '原 pre 必须被移除');
    assert.ok(out.includes('<div class="mermaid mermaid-ssr" data-theme-pair="light|dark"'), '缺少 SSR 容器');
    assert.ok(out.includes('class="mm-svg mm-light"'), '缺少 light SVG');
    assert.ok(out.includes('class="mm-svg mm-dark"'), '缺少 dark SVG');
    assert.ok(out.includes('<style nonce="N0NCE">'), 'SVG 内 style 必须携带 CSP nonce');
    assert.ok(out.includes('data-w="900px"'), '单图宽度需保留');
    assert.ok(out.startsWith('<p>x</p>') && out.endsWith('<p>y</p>'), '前后内容保持');
  });

  it('失败块保留客户端可渲染的 pre 并标记 data-mm-pending', () => {
    const html = '<pre data-language="mermaid"><code class="language-mermaid">graph TD</code></pre>';
    const out = replaceMermaidBlocks(html, [{ error: 'boom' }], { size: SIZE });
    assert.ok(out.includes('data-mm-pending="1"'), '失败必须标记 pending');
    assert.ok(out.includes('<code class="language-mermaid">graph TD</code>'), '源码保留给客户端回退');
    assert.ok(!out.includes('mermaid-ssr'));
  });

  it('不安全 SVG（script/foreignObject）退回 pending，不注入页面', () => {
    const html = '<pre data-language="mermaid"><code class="language-mermaid">graph TD</code></pre>';
    const unsafe = [
      { svg: '<svg><script>alert(1)</script></svg>', svgDark: DARK },
      { svg: '<svg><foreignObject><div>x</div></foreignObject></svg>' }
    ];
    for (const item of unsafe) {
      const out = replaceMermaidBlocks(html, [item], { size: SIZE });
      assert.ok(out.includes('data-mm-pending="1"'), '不安全 SVG 必须退回 pending');
      assert.ok(!out.includes('<script>alert(1)</script>'));
      assert.ok(!out.includes('foreignObject'));
    }
  });

  it('darkMode=false 或缺失 dark 时只输出 light 单主题', () => {
    const html = '<pre data-language="mermaid"><code class="language-mermaid">pie title P</code></pre>';
    const out = replaceMermaidBlocks(html, [{ svg: LIGHT }], { size: SIZE, darkMode: false });
    assert.ok(out.includes('data-theme-pair="light"'));
    assert.ok(!out.includes('mm-dark'));
  });

  it('div[data-src] 形态成功替换，失败则还原为 pre 以便客户端接管', () => {
    const src = '<div class="mermaid" data-src="graph LR;X--&gt;Y"></div>';
    const ok = replaceMermaidBlocks(src, [{ svg: LIGHT, svgDark: DARK }], { size: SIZE });
    assert.ok(ok.includes('mermaid-ssr') && !ok.includes('data-src='), 'div 形态应被替换');
    const fail = replaceMermaidBlocks(src, [{ error: 'x' }], { size: SIZE });
    assert.ok(fail.includes('data-mm-pending="1"'));
    assert.ok(fail.includes('<code class="language-mermaid">graph LR;X--&gt;Y</code>'), '失败 div 还原为预转义 pre');
  });

  it('results 与块数量不等时多出的块按失败处理', () => {
    const html = '<pre data-language="mermaid"><code class="language-mermaid">graph TD</code></pre>';
    const out = replaceMermaidBlocks(html, [], { size: SIZE });
    assert.ok(out.includes('data-mm-pending="1"'));
  });

  it('已 SSR 的内容再次替换保持幂等', () => {
    const html = '<pre data-language="mermaid"><code class="language-mermaid">graph TD</code></pre>';
    const once = replaceMermaidBlocks(html, [{ svg: LIGHT, svgDark: DARK }], { size: SIZE });
    const twice = replaceMermaidBlocks(once, [], { size: SIZE });
    assert.strictEqual(twice, once);
  });

  it('同页重复图表的 SVG id/style 引用按块去重，避免重复 id 冲突', () => {
    const html = '<pre data-language="mermaid"><code class="language-mermaid">graph TD</code></pre>'
      + '<pre data-language="mermaid"><code class="language-mermaid">graph TD</code></pre>';
    const out = replaceMermaidBlocks(html, [{ svg: LIGHT, svgDark: DARK }, { svg: LIGHT, svgDark: DARK }], { size: SIZE });
    const ids = Array.from(out.matchAll(/<svg[^>]*\bid="([^"]+)"/g)).map((m) => m[1]);
    assert.strictEqual(ids.length, 4);
    assert.strictEqual(new Set(ids).size, 4, 'SVG id 必须唯一: ' + ids.join(','));
    assert.ok(out.includes('#m1-0') && out.includes('#m1-1'), 'style 选择器须跟随 id 重写');
    assert.ok(!out.includes('id="m1"'), '不得残留未重写的裸 id');
  });
});

describe('resolveChromePath', () => {
  const deps = (existing) => ({
    env: {},
    platform: 'win32',
    exists: (p) => existing.includes(p),
    which: () => null
  });
  it('显式配置存在时优先', () => {
    const got = resolveChromePath('C:/custom/chrome.exe', deps(['C:/custom/chrome.exe']));
    assert.strictEqual(got, 'C:/custom/chrome.exe');
  });
  it('CHROME_PATH 次之', () => {
    const env = { CHROME_PATH: 'C:/env/chrome.exe' };
    const got = resolveChromePath('', Object.assign(deps(['C:/env/chrome.exe']), { env }));
    assert.strictEqual(got, 'C:/env/chrome.exe');
  });
  it('Windows 默认路径再次之', () => {
    const got = resolveChromePath('', deps(['C:/Program Files/Google/Chrome/Application/chrome.exe']));
    assert.strictEqual(got, 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  });
  it('全部缺失返回 null 且不抛出', () => {
    assert.strictEqual(resolveChromePath('', deps([])), null);
  });
  it('Linux/mac 通过 which 探测可执行名', () => {
    const got = resolveChromePath('', {
      env: {},
      platform: 'linux',
      exists: () => false,
      which: (name) => (name === 'google-chrome' ? '/usr/bin/google-chrome' : null)
    });
    assert.strictEqual(got, '/usr/bin/google-chrome');
  });
});

describe('createMermaidRenderer 降级与缓存', () => {
  it('无 Chrome 时 renderBatch 逐条返回 error，不抛出', async () => {
    const dir = tmpDir();
    const renderer = createMermaidRenderer({
      cacheDir: dir,
      logger: SILENT,
      resolveChrome: () => null
    });
    const res = await renderer.renderBatch([
      { code: 'graph TD;A-->B', theme: 'default' },
      { code: 'pie title P', theme: 'dark' }
    ]);
    assert.strictEqual(res.length, 2);
    assert.ok(res[0].error && res[1].error, '两条都应为 error');
    assert.ok(!res[0].svg && !res[1].svg);
  });

  it('缓存命中直接返回 SVG（即使无 Chrome），未命中才报错', async () => {
    const dir = tmpDir();
    const code = 'graph TD;A-->B';
    const key = mermaidCacheKey(code, 'default', '9.9.9');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, key + '.svg'), '<svg id="cached"></svg>', 'utf-8');
    const renderer = createMermaidRenderer({
      cacheDir: dir,
      logger: SILENT,
      version: '9.9.9',
      resolveChrome: () => null
    });
    const res = await renderer.renderBatch([
      { code, theme: 'default' },
      { code: 'graph LR;X-->Y', theme: 'default' }
    ]);
    assert.strictEqual(res[0].svg, '<svg id="cached"></svg>');
    assert.strictEqual(res[0].cached, true);
    assert.ok(res[1].error);
  });

  it('空批次不启动浏览器且返回空数组', async () => {
    let launched = false;
    const renderer = createMermaidRenderer({
      cacheDir: tmpDir(),
      logger: SILENT,
      resolveChrome: () => { launched = true; return null; }
    });
    assert.deepStrictEqual(await renderer.renderBatch([]), []);
    assert.strictEqual(launched, false);
  });
});
