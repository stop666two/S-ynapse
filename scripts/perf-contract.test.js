'use strict';

// 性能与缓存契约测试（2G 专项）。
//
// 为什么单独成文件：既有测试多为「计数快照 + 源码子串」，一改实现就红，而真正决定
// 弱网体验的契约（首屏字节预算、请求数、字体是否真的不请求、预缓存上限、缓存头、
// 加载顺序）反而没有断言。这里全部按**可测量契约**写：断言的是预算与行为，
// 不是某行代码的写法，因此重排实现不会误报，但预算被撑破一定会红。
//
// 数值来源：2026-11 build 实测（见各断言注释）。阈值留 ~10% 余量。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HOME = path.join(DIST, 'zh', 'index.html');
const HAS_DIST = fs.existsSync(HOME);
const SKIP_NO_DIST = '需要先 npm run build 产出 dist/';

const gz = (rel) => zlib.gzipSync(fs.readFileSync(path.join(DIST, rel))).length;
const raw = (rel) => fs.statSync(path.join(DIST, rel)).size;
const strip = (u) => u.replace(/^\//, '').split('?')[0];
const firstMatch = (html, re) => {
  const m = html.match(re);
  assert.ok(m, '首页缺少预期标记：' + re);
  return m[1];
};

// 2G 慢网路径的预算（gzip 字节）。实测 111.2 KiB → 阈值 120 KiB；
// 250 kbps 下约 3.9s 纯下载，是「2G 可接受」的上界。
const SLOW_PATH_BUDGET_KB = 120;
// 慢网路径的 head 级静态资源数上界（stylesheet + preload + modulepreload + script[src]）。
// 实测 11（zh/en 一致）；内容图片不计入——它随文章数变化，属内容驱动，不是布局预算。
// 这条守的是「别往 head 里再堆阻塞/半阻塞资源」：2G 下每个请求多一次 350ms RTT。
const MAX_HEAD_RESOURCES = 12;
// SW 预缓存上界：只允许「离线壳最小集」。实测 6 项 / 82.6 KiB gzip。
const PRECACHE_MAX_ENTRIES = 10;
const PRECACHE_MAX_GZIP_KB = 110;

describe('performance contract (2G)', () => {
  it('首屏慢网路径（不含 webfont）gzip 总量在预算内', (t) => {
    if (!HAS_DIST) return t.skip(SKIP_NO_DIST);
    const html = fs.readFileSync(HOME, 'utf8');
    const parts = {
      html: zlib.gzipSync(Buffer.from(html)).length,
      app: gz(strip(firstMatch(html, /src=([^ >]*app\.[^ >]*\.js)/))),
      runtime: gz(strip(firstMatch(html, /src=([^ >]*runtime\.[^ >]*\.js)/))),
      siteCss: gz(strip(firstMatch(html, /href=([^ >]*site\.[0-9a-f]+\.css)/))),
      config: gz('assets/' + fs.readdirSync(path.join(DIST, 'assets')).find((n) => /^config\..*\.json$/.test(n))),
      firstImage: raw(strip(firstMatch(html, /imagesrcset="([^"]+)"/).split(',')[0].trim().split(/\s+/)[0]))
    };
    const totalKb = Object.values(parts).reduce((s, n) => s + n, 0) / 1024;
    assert.ok(
      totalKb <= SLOW_PATH_BUDGET_KB,
      `慢网首屏 gzip ${totalKb.toFixed(1)} KiB 超出预算 ${SLOW_PATH_BUDGET_KB} KiB：` + JSON.stringify(parts)
    );
  });

  it('慢网策略下字体零请求：cjk 样式无 href、无 font preload、翻转脚本带网况判定', (t) => {
    if (!HAS_DIST) return t.skip(SKIP_NO_DIST);
    const html = fs.readFileSync(HOME, 'utf8');
    const cjkLink = html.match(/<link[^>]*data-cjk-css[^>]*>/);
    assert.ok(cjkLink, '首页应存在 data-cjk-css 链接（字体样式入口）');
    assert.ok(
      !/\shref=/.test(cjkLink[0]),
      '默认 skip 策略下 cjk-fonts.css 不得带 href（无 href 才不发请求）：' + cjkLink[0].slice(0, 160)
    );
    assert.ok(/data-cjk-href=/.test(cjkLink[0]), '应保留 data-cjk-href 供脚本按网况启用');
    assert.ok(
      /navigator\.connection/.test(html) && /saveData/.test(html) && /\(\?:\?slow-\)\?2g|slow-\)\?2g/.test(html),
      '翻转脚本必须包含 saveData / effectiveType 慢网判定'
    );
    assert.ok(
      !/rel="?preload"?[^>]*as="?font/.test(html) && !/as="?font"?[^>]*rel="?preload/.test(html),
      '慢网策略下不得输出 rel=preload as=font（会绕过 CSS 的 media 门控直接拉 woff2）'
    );
  });

  it('加载顺序：runtime/app 在 head 预声明，且与 body 的 script 同源同哈希', (t) => {
    if (!HAS_DIST) return t.skip(SKIP_NO_DIST);
    const html = fs.readFileSync(HOME, 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    const appSrc = firstMatch(html, /src=([^ >]*app\.[^ >]*\.js)/).replace(/"/g, '');
    const runSrc = firstMatch(html, /src=([^ >]*runtime\.[^ >]*\.js)/).replace(/"/g, '');
    assert.ok(head.includes(appSrc), 'head 必须预声明 app.js（modulepreload），否则要下完 HTML 才发现 JS');
    assert.ok(head.includes(runSrc), 'head 必须预声明 runtime.js（preload as=script）');
    assert.ok(/rel="?modulepreload"?/.test(head), 'head 应包含 modulepreload 提示');
    assert.ok(/as="?script"?/.test(head), 'head 应包含 preload as=script 提示');
  });

  it('缓存头契约：内容寻址资源 immutable，HTML 可复用且带 SWR', (t) => {
    if (!HAS_DIST) return t.skip(SKIP_NO_DIST);
    const headers = fs.readFileSync(path.join(DIST, '_headers'), 'utf8');
    for (const rule of ['/assets/js/*', '/assets/css/*', '/assets/fonts/*', '/assets/config.*.json', '/assets/quotes.*.json']) {
      const block = headers.split('\n\n').find((b) => b.startsWith(rule));
      assert.ok(block, '_headers 缺少规则 ' + rule);
      assert.ok(/immutable/.test(block), rule + ' 应使用 immutable（文件名内容寻址）');
    }
    assert.ok(/\n\/sw\.js\n\s+Cache-Control: no-cache/.test(headers), 'sw.js 必须 no-cache，否则新版本不生效');
    // HTML 的缓存策略由 Worker 下发（_headers 的 Cache-Control 会被 Cloudflare 合并，不能再用 /* 叠加）
    const worker = fs.readFileSync(path.join(ROOT, 'workers', 'security-worker.js'), 'utf8');
    assert.ok(/stale-while-revalidate=86400/.test(worker), 'Worker 需为 HTML 下发 stale-while-revalidate');
    assert.ok(/text\/html/.test(worker), 'Worker 的 HTML 缓存分支应显式判定 content-type');
    // 404 页同样是 text/html：SWR 必须只在 200 上贴，否则「已上线」的页面会被缓存里的 404 顶掉。
    assert.ok(
      /text\/html"\) !== -1 && response\.status === 200/.test(worker),
      'Worker 的 SWR 必须限定 200（404/500 不得可复用）'
    );
  });

  it('本地 serve 的缓存语义与生产一致（避免本地测不出缓存命中）', () => {
    const { cacheControlFor } = require('./build/serve.js');
    assert.ok(typeof cacheControlFor === 'function', 'serve.js 应导出 cacheControlFor 供契约测试');
    assert.match(cacheControlFor('/zh/'), /stale-while-revalidate/);
    assert.match(cacheControlFor('/zh/slug/'), /max-age=0/);
    assert.match(cacheControlFor('/assets/js/app.ABC123.js'), /immutable/);
    assert.match(cacheControlFor('/assets/css/site.9a0f.css'), /immutable/);
    assert.match(cacheControlFor('/assets/config.02b50682e5.json'), /immutable/);
    // 引语与启动配置同为内容寻址 JSON：本地不覆盖会让「拆分后是否仍命中缓存」无法复测。
    assert.match(cacheControlFor('/assets/quotes.244b600f8b.json'), /immutable/);
    assert.match(cacheControlFor('/media/a.webp'), /max-age=604800/);
    // 404 页同样以「/」结尾，不能被贴 SWR（与 Worker 的 200 守卫对齐）。
    assert.strictEqual(cacheControlFor('/zh/does-not-exist/', 404), 'no-cache');
    assert.strictEqual(cacheControlFor('/robots.txt'), 'no-cache');
  });

  it('SW 预缓存只保留离线壳最小集，且不超过字节预算', (t) => {
    if (!HAS_DIST) return t.skip(SKIP_NO_DIST);
    const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
    const m = sw.match(/PRECACHE_URLS = (\[[^\]]*\])/);
    assert.ok(m, 'sw.js 应内联 PRECACHE_URLS');
    const urls = JSON.parse(m[1]);
    assert.ok(urls.length > 0 && urls.length <= PRECACHE_MAX_ENTRIES, `预缓存条目 ${urls.length} 超出上界 ${PRECACHE_MAX_ENTRIES}`);
    for (const bad of ['/assets/js/shared.', '/assets/js/deferred.', '/assets/css/cjk-fonts.css', '/assets/vendor/fonts/']) {
      assert.ok(!urls.some((u) => u.includes(bad)), '预缓存不得包含 ' + bad + '（首次访问安装期抢带宽）');
    }
    assert.ok(urls.includes('/offline.html'), '离线回退页必须在预缓存里');
    const totalGz = urls.reduce((s, u) => {
      const f = path.join(DIST, u.replace(/^\//, ''));
      return s + (fs.existsSync(f) ? zlib.gzipSync(fs.readFileSync(f)).length : 0);
    }, 0);
    assert.ok(
      totalGz / 1024 <= PRECACHE_MAX_GZIP_KB,
      `预缓存 gzip ${(totalGz / 1024).toFixed(1)} KiB 超出预算 ${PRECACHE_MAX_GZIP_KB} KiB`
    );
  });

  it('导航策略为 stale-while-revalidate（弱网重复访问不等网络）', (t) => {
    if (!HAS_DIST) return t.skip(SKIP_NO_DIST);
    const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
    assert.ok(/PAGE_NETWORK_FIRST = false/.test(sw), '默认应为 SWR（PAGE_NETWORK_FIRST=false），否则每次导航都要等一次网络往返');
  });

  it('预加载不重复下载：同一资源不得同时出现 preload 与不同哈希的引用', (t) => {
    if (!HAS_DIST) return t.skip(SKIP_NO_DIST);
    const html = fs.readFileSync(HOME, 'utf8');
    const appRefs = [...html.matchAll(/(?:src|href)=["']?([^"'\s>]*\/assets\/js\/app\.[^"'\s>]*)/g)].map((m) => m[1]);
    assert.ok(appRefs.length >= 2, 'app.js 应至少被 head 预载与 body script 各引用一次');
    assert.strictEqual(new Set(appRefs).size, 1, '两次引用必须是完全相同的 URL（否则会下两份）：' + appRefs.join(', '));
  });

  it('head 级静态资源数不超过预算（2G 下每个请求 = 一次 RTT）', (t) => {
    if (!HAS_DIST) return t.skip(SKIP_NO_DIST);
    // 只数真正发请求的 head 资源；`data-cjk-href` 这类数据属性必须排除，
    // 否则无 href 的 cjk 样式会被误算成请求（`\bhref=` 会匹配 `data-cjk-href=`）。
    const countHeadResources = (html) => {
      const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
      const relOf = (tag) => ((tag.match(/rel=["']?([a-z\- ]+)/i) || [, ''])[1] || '').trim();
      const hasHref = (tag) => /(?<![-\w])href=/.test(tag);
      const headLinks = links.filter((tag) => hasHref(tag) && /^(stylesheet|preload|modulepreload)$/.test(relOf(tag)));
      const scripts = [...html.matchAll(/<script\b[^>]*\ssrc=/g)].length;
      return headLinks.length + scripts;
    };
    for (const rel of ['zh/index.html', 'en/index.html']) {
      const html = fs.readFileSync(path.join(DIST, rel), 'utf8');
      const n = countHeadResources(html);
      assert.ok(
        n <= MAX_HEAD_RESOURCES,
        `${rel} 的 head 级静态资源 ${n} 个，超出预算 ${MAX_HEAD_RESOURCES}（2G 下每个多一次 RTT）`
      );
    }
  });
});
