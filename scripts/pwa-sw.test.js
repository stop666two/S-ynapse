'use strict';
// PWA 单测：
//   1. 构建期纯函数（scripts/lib/pwa-sw.js）：缓存清单过滤/去重/排序、策略选择矩阵、
//      版本化缓存名、旧缓存判定、SW 源码契约（预缓存/策略开关/更新握手/版本化清理）；
//   2. 运行时纯函数（js/domains/features/pwa.js 经 data URL 导入，与浏览器同源）：
//      更新提示触发条件（仅更新场景 + 未提示过）；
//   3. 配置契约：features.json5 ↔ schema、site.json5/site-defaults 默认开启、
//      ui-strings 双语、构建与运行时的接线断言；
//   4. 壳预缓存瘦身与页面 SWR（2G 性能）：最小预缓存集、gzip 预算、离线回退链路。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { DEFAULT_CONFIG } = require('./lib/site-defaults.js');
const { createAssetsModule } = require('./build/assets.js');
const {
  sanitizeToken, versionedCacheName, cacheNames, isOwnedCache, isStaleCache,
  buildPrecacheList, selectStrategy, renderServiceWorker
} = require('./lib/pwa-sw.js');

const MODULE_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'pwa.js'), 'utf-8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(MODULE_SOURCE, 'utf-8').toString('base64'));

test('versionedCacheName/cacheNames：版本后缀、非法字符净化与空基名拒绝', () => {
  assert.strictEqual(versionedCacheName('s-ynapse-v1', 'ab12cd34'), 's-ynapse-v1-ab12cd34');
  assert.strictEqual(versionedCacheName(' S-Ynapse V1! ', 'AbC'), 's-ynapse-v1-abc', '非法字符净化并小写');
  assert.throws(() => versionedCacheName('', ''), /cacheName 为空/, '空基名必须抛错（不得回退固定站名）');
  assert.throws(() => versionedCacheName(null, null), /cacheName 为空/);
  assert.strictEqual(sanitizeToken('a/b\\c', 'x'), 'a-b-c');
  assert.deepStrictEqual(cacheNames('s-ynapse-v1', 'v9'), {
    shell: 's-ynapse-v1-v9-shell',
    pages: 's-ynapse-v1-v9-pages',
    assets: 's-ynapse-v1-v9-assets'
  });
});

test('buildPrecacheList：仅站内绝对路径、去重排序、排除根路径与 SW 自身', () => {
  const list = buildPrecacheList([
    '/assets/css/site.abc.css',
    'offline.html',
    '/offline.html',
    '/',
    '/sw.js',
    'https://cdn.example.com/x.css',
    '//cdn.example.com/y.css',
    '/assets/js/app.1.js?v=2',
    '/assets/js/app.1.js#hash',
    '',
    null,
    42,
    '/assets/vendor/fonts/inter.woff2'
  ], { exclude: ['/sw.js'] });
  assert.deepStrictEqual(list, [
    '/assets/css/site.abc.css',
    '/assets/js/app.1.js',
    '/assets/vendor/fonts/inter.woff2',
    '/offline.html'
  ]);
  assert.deepStrictEqual(buildPrecacheList(null), [], '非数组安全');
  assert.deepStrictEqual(buildPrecacheList(['/sw.js']), [], '默认排除 SW 自身');
});

test('selectStrategy：页面 network-first、资产 cache-first、反转为可配置、旁路', () => {
  // switch: features.pwa.pageNetworkFirst, features.pwa.assetCacheFirst
  const on = { swPath: '/sw.js' };
  assert.strictEqual(selectStrategy({ method: 'POST', url: 'https://a/zh/x/' }, on), 'bypass');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://cdn/x.css', origin: 'https://cdn', scopeOrigin: 'https://a' }, on), 'bypass');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/sw.js' }, on), 'bypass');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/zh/post/', mode: 'navigate' }, on), 'page-network-first');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/zh/post/', softNav: true }, on), 'page-network-first', '软导航请求按页面处理');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/zh/search/', accept: 'text/html,application/xhtml+xml' }, on), 'page-network-first');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/assets/css/site.abc.css' }, on), 'asset-cache-first');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/zh/feed.xml' }, on), 'asset-cache-first');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/zh/post/', mode: 'navigate' }, { pageNetworkFirst: false }), 'page-cache-first');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/assets/x.js' }, { assetCacheFirst: false }), 'asset-network-first');
  assert.strictEqual(selectStrategy({ method: 'GET', url: 'https://a/zh/feed.xml', accept: 'text/html' }, on), 'page-network-first', '页面判定优先于资产判定');
});

test('isOwnedCache/isStaleCache：只清理本站管理的旧缓存', () => {
  const current = cacheNames('s-ynapse-v1', 'newver');
  const currentNames = [current.shell, current.pages, current.assets];
  assert.strictEqual(isOwnedCache('s-ynapse-v1', 's-ynapse-v1'), true, '历史无版本缓存名也归本站');
  assert.strictEqual(isOwnedCache('s-ynapse-v1-old-shell', 's-ynapse-v1'), true);
  assert.strictEqual(isOwnedCache('s-ynapse-v10-shell', 's-ynapse-v1'), false, '前缀必须带分隔符，避免误伤同前缀他站缓存');
  assert.strictEqual(isOwnedCache('other-app-cache', 's-ynapse-v1'), false);
  assert.strictEqual(isStaleCache('s-ynapse-v1-oldver-shell', 's-ynapse-v1', currentNames), true);
  assert.strictEqual(isStaleCache(current.shell, 's-ynapse-v1', currentNames), false, '当前版本缓存不清理');
  assert.strictEqual(isStaleCache('other-app', 's-ynapse-v1', currentNames), false);
});

test('renderServiceWorker：预缓存/三类缓存名/策略开关/更新握手/版本化清理', () => {
  // switch: features.pwa.precache, features.pwa.pageCacheLimit, features.pwa.pageNetworkFirst, features.pwa.assetCacheFirst
  const sw = renderServiceWorker({
    cacheName: 's-ynapse-v1',
    version: 'abc123',
    precache: ['/offline.html', '/assets/css/site.x.css'],
    offlineUrl: '/offline.html',
    swPath: '/sw.js',
    pageNetworkFirst: true,
    assetCacheFirst: true,
    pageCacheLimit: 24
  });
  assert.ok(sw.includes('const SHELL_CACHE = "s-ynapse-v1-abc123-shell"'), '壳缓存名版本化');
  assert.ok(sw.includes('const PAGES_CACHE = "s-ynapse-v1-abc123-pages"'), '页面缓存名版本化');
  assert.ok(sw.includes('const ASSETS_CACHE = "s-ynapse-v1-abc123-assets"'), '资产缓存名版本化');
  assert.ok(sw.includes('const PRECACHE_URLS = ["/offline.html","/assets/css/site.x.css"];'), '预缓存清单内联');
  assert.ok(sw.includes('cache.addAll(PRECACHE_URLS)'), 'install 预缓存');
  const installBody = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"));
  assert.ok(!installBody.includes('skipWaiting'), 'install 不得立即跳过等待');
  assert.ok(sw.includes("event.data.type === 'SKIP_WAITING'"), '更新握手：页面消息触发 skipWaiting');
  assert.ok(sw.includes('PAGE_NETWORK_FIRST = true'), '页面策略开关内联');
  assert.ok(sw.includes('ASSET_CACHE_FIRST = true'), '资产策略开关内联');
  assert.ok(sw.includes('PAGE_CACHE_LIMIT = 24'), '页面缓存上限内联');
  assert.ok(sw.includes('networkFirstPage(event, request)'), '页面 network-first 分支');
  assert.ok(sw.includes('cacheFirstAsset(event, request)'), '资产 cache-first 分支');
  assert.ok(sw.includes('ignoreSearch: true'), '查询串差异兼容（CJK 字体样式等）');
  assert.ok(sw.includes('OFFLINE_URL ? [OFFLINE_URL] : []'), '断网回退离线页');
  assert.ok(sw.includes("key.indexOf(OWNED_PREFIX) === 0"), 'activate 按前缀判定本站缓存');
  assert.ok(sw.includes('caches.delete(key)'), '旧缓存清理');

  const reversed = renderServiceWorker({
    cacheName: 's-ynapse-v1', version: 'v2', precache: [], offlineUrl: '',
    pageNetworkFirst: false, assetCacheFirst: false, pageCacheLimit: 0
  });
  assert.ok(reversed.includes('PAGE_NETWORK_FIRST = false') && reversed.includes('cacheFirstPage(event, request)'), '页面策略可反转');
  assert.ok(reversed.includes('ASSET_CACHE_FIRST = false') && reversed.includes('networkFirstAsset(event, request)'), '资产策略可反转');
  assert.ok(reversed.includes('PAGE_CACHE_LIMIT = 0'), '0=不限制');
  assert.ok(reversed.includes('if (!PRECACHE_URLS.length) return;'), '空清单跳过预缓存');
});

test('运行时 shouldPromptUpdate：仅更新场景且未提示过', async () => {
  const m = await modulePromise;
  assert.strictEqual(typeof m.shouldPromptUpdate, 'function');
  assert.strictEqual(m.shouldPromptUpdate({ hasController: true, hasWaiting: true, prompted: false }), true);
  assert.strictEqual(m.shouldPromptUpdate({ hasController: false, hasWaiting: true, prompted: false }), false, '首次安装不提示');
  assert.strictEqual(m.shouldPromptUpdate({ hasController: true, hasWaiting: false, prompted: false }), false, '无等待版本不提示');
  assert.strictEqual(m.shouldPromptUpdate({ hasController: true, hasWaiting: true, prompted: true }), false, '已提示不重复打扰');
  assert.strictEqual(m.shouldPromptUpdate(null), false, '空值安全');
});

test('运行时接线：提示条挂 body（软导航安全）、沿用 ui-strings、周期检查可关', () => {
  assert.match(MODULE_SOURCE, /document\.body\.appendChild\(bar\)/, '提示条追加到 body（软导航只交换内容区）');
  assert.ok(!/querySelector\(['"]\.content-wrapper/.test(MODULE_SOURCE), '不依赖被软导航替换的容器');
  assert.match(MODULE_SOURCE, /__T\('pwa\.updateReady'/, '更新文案走 ui-strings');
  assert.match(MODULE_SOURCE, /__T\('pwa\.refresh'/, '刷新按钮文案走 ui-strings');
  assert.match(MODULE_SOURCE, /SKIP_WAITING/, '刷新发送 SKIP_WAITING');
  assert.match(MODULE_SOURCE, /updateCheckIntervalMs/, '周期检查间隔接线');
  assert.match(MODULE_SOURCE, /controllerchange/, 'controllerchange 后整页刷新');
});

test('配置契约：features/schema/site/ui-strings 默认值与接线', () => {
  const features = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
  const expected = {
    enabled: true, registerSW: true, updatePrompt: true, offlineNotice: true, offlinePage: true,
    precache: true, pageNetworkFirst: false, assetCacheFirst: true, pageCacheLimit: 24,
    updateCheckIntervalMs: 1800000, installPrompt: true, installDismissKey: 's-a2hs-dismissed',
    updateToastMs: 0
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.ok(Object.prototype.hasOwnProperty.call(features.pwa, key), 'features.json5 pwa.' + key + ' 存在');
    // 派生副本（real-site）允许对默认值做真实覆盖；规范仓库保持严格一致。
    if (process.env.SYNAPSE_DERIVED_COPY !== '1') {
      assert.strictEqual(features.pwa[key], value, 'features.json5 pwa.' + key);
    }
    assert.strictEqual(DEFAULT_FEATURES.pwa[key], value, 'schema pwa.' + key);
  }
  const site = json5.parse(fs.readFileSync(path.join(ROOT, 'site.json5'), 'utf-8'));
  assert.strictEqual(site.pwa.enabled, true, 'site.json5 pwa.enabled 默认开启');
  assert.strictEqual(DEFAULT_CONFIG.site.pwa.enabled, true, 'site-defaults pwa.enabled 默认开启');

  const ui = json5.parse(fs.readFileSync(path.join(ROOT, 'ui-strings.json5'), 'utf-8'));
  for (const lang of ['zh', 'en']) {
    const dict = lang === 'zh' ? ui : ui.en;
    assert.ok(dict.pwa.updateReady, lang + ' pwa.updateReady 缺失');
    assert.ok(dict.pwa.refresh, lang + ' pwa.refresh 缺失');
    assert.ok(dict.common.close, lang + ' common.close 缺失（关闭按钮 aria-label）');
  }
  assert.notStrictEqual(ui.pwa.updateReady, ui.en.pwa.updateReady, '更新文案中英不得相同');
  assert.notStrictEqual(ui.pwa.refresh, ui.en.pwa.refresh, '刷新按钮中英不得相同');

  const assetsSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'assets.js'), 'utf-8');
  assert.match(assetsSrc, /renderServiceWorker\(/, '构建期调用 SW 生成器');
  assert.match(assetsSrc, /featPwa\.precache !== false/, 'precache 开关接线');
  assert.match(assetsSrc, /featPwa\.pageNetworkFirst !== false/, 'pageNetworkFirst 开关接线');
  assert.match(assetsSrc, /featPwa\.assetCacheFirst !== false/, 'assetCacheFirst 开关接线');
  assert.match(assetsSrc, /featPwa\.pageCacheLimit/, 'pageCacheLimit 接线');
  assert.match(assetsSrc, /shellPrecacheCandidates\(/, '壳预缓存候选集由 shellPrecacheCandidates 收集');
  assert.ok(!/listFilesRecursive\(path\.join\(distDir, 'assets', 'vendor', 'fonts'\)/.test(assetsSrc),
    'vendor 拉丁字体不得进入预缓存候选（2G 带宽由 assetCacheFirst 按需缓存）');
  const securitySrc = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'security-files.js'), 'utf-8');
  assert.match(securitySrc, /'\/sw\.js\\n {2}Cache-Control: no-cache'/, '/sw.js 输出 no-cache');
  const deferredSrc = fs.readFileSync(path.join(ROOT, 'js', 'core', 'deferred.js'), 'utf-8');
  assert.match(deferredSrc, /import \{ init as pwaInit \} from '\.\.\/domains\/features\/pwa\.js'/, 'PWA 模块进按需加载路径');
});

// ---------------------------------------------------------------------------
// 壳预缓存瘦身 + 页面 SWR（2G 性能）
// ---------------------------------------------------------------------------

// 预算常量来源：本任务实测（真实产物，冷缓存首页）。改前 29 项：raw 643 KiB / 其中
// CJK 子集字体 877 KiB 是总量大头（17 个子集 × 45–63 KiB），2G(250kbps) 需约 30s；
// 改后 6 项：raw ≈ 303 KiB、gzip 合计 ≈ 82.6 KiB（≈2.7s）。阈值留约 30% 余量。
const PRECACHE_MAX_ENTRIES = 10;
const PRECACHE_MAX_GZIP_BYTES = 110 * 1024;

// 造一个最小 dist 树；返回目录并登记清理（Windows 下 rm 可能偶发占用，忽略失败）。
function makeTempDist(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-sw-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 忽略 */ } });
  for (const rel of Object.keys(files || {})) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files[rel]);
  }
  return dir;
}

// 直接驱动产物生成器（scripts/build/assets.js），读回内联的 PRECACHE_URLS。
function generateSw(distDir, config) {
  createAssetsModule({ root: ROOT, distDir, staticDir: distDir, cspNonce: 'test-nonce' })
    .generateServiceWorker(config);
  const text = fs.readFileSync(path.join(distDir, 'sw.js'), 'utf-8');
  const m = /const PRECACHE_URLS = (\[[^\]]*\]);/.exec(text);
  assert.ok(m, 'sw.js 必须内联 PRECACHE_URLS');
  return { text, precache: JSON.parse(m[1]) };
}

function swConfig(featureOverrides) {
  return {
    site: {
      pwa: Object.assign({}, DEFAULT_CONFIG.site.pwa),
      build: Object.assign({}, DEFAULT_CONFIG.site.build)
    },
    features: { pwa: Object.assign({}, DEFAULT_FEATURES.pwa, featureOverrides || {}) }
  };
}

// 覆盖真实产物形态：预缓存候选里可能出现的每一类文件都放一份。
const FULL_DIST_FILES = {
  'offline.html': '<!DOCTYPE html><title>offline</title>',
  'manifest.json': '{"name":"x"}',
  'assets/config.abcdef0123.json': '{"features":{}}',
  'assets/css/site.9a0feeb839.css': 'body{color:red}',
  'assets/css/cjk-fonts.css': '@font-face{src:url(chunk.woff2)}',
  'assets/js/runtime.53b78c047b.js': 'var __T=function(){};',
  'assets/js/app.R6NMK2XE.js': 'import"./shared.3HQOCGMR.js";',
  'assets/js/deferred.HXQEQB4R.js': 'import"./shared.3HQOCGMR.js";',
  'assets/js/shared.3HQOCGMR.js': 'export var a=1;',
  'assets/vendor/fonts/inter.css': '@font-face{src:url(inter.woff2)}',
  'assets/vendor/fonts/inter-latin-wght-normal.woff2': 'wOF2fakelatin'
};

test('壳预缓存最小集：只收离线壳 6 项，不含 shared./deferred./cjk-fonts/vendor 字体', (t) => {
  const distDir = makeTempDist(t, FULL_DIST_FILES);
  const { precache, text } = generateSw(distDir, swConfig());
  assert.deepStrictEqual(precache, [
    '/assets/config.abcdef0123.json',
    '/assets/css/site.9a0feeb839.css',
    '/assets/js/app.R6NMK2XE.js',
    '/assets/js/runtime.53b78c047b.js',
    '/manifest.json',
    '/offline.html'
  ], '预缓存清单必须恰为离线壳最小集');
  for (const url of precache) {
    assert.ok(!/\/assets\/js\/(?:shared|deferred)\./.test(url), '分包不得预缓存: ' + url);
    assert.ok(!/\/assets\/css\/cjk-fonts\./.test(url), 'CJK 字体样式不得预缓存: ' + url);
    assert.ok(url.indexOf('/assets/vendor/') !== 0, 'vendor 字体不得预缓存: ' + url);
  }
  // 离线路径仍可用：offline.html 在清单里，且 OFFLINE_URL 指向它（install 失败回退链路完整）
  assert.ok(precache.indexOf('/offline.html') !== -1, '离线页必须仍在预缓存清单内');
  assert.match(text, /const OFFLINE_URL = "\/offline\.html";/, '断网回退页仍内联');
  assert.match(text, /OFFLINE_URL \? \[OFFLINE_URL\] : \[\]/, 'offlineFallback 仍走 OFFLINE_URL');
});

test('壳预缓存开关：precache=false 清空清单；offlinePage=false 去掉离线页', (t) => {
  const offDir = makeTempDist(t, FULL_DIST_FILES);
  assert.deepStrictEqual(generateSw(offDir, swConfig({ precache: false })).precache, [], 'precache=false 不预缓存');

  const noOfflineDir = makeTempDist(t, FULL_DIST_FILES);
  const res = generateSw(noOfflineDir, swConfig({ offlinePage: false }));
  assert.ok(res.precache.indexOf('/offline.html') === -1, 'offlinePage=false 不预缓存离线页');
  assert.match(res.text, /const OFFLINE_URL = "";/, 'offlinePage=false 时 OFFLINE_URL 为空');
  assert.ok(res.precache.length >= 4, '其余壳资源仍预缓存');
});

test('// switch: features.pwa.pageNetworkFirst —— 两种取值的渲染差异', (t) => {
  const distDir = makeTempDist(t, FULL_DIST_FILES);
  // 默认（features.json5 / schema 均为 false）= stale-while-revalidate
  const swr = generateSw(distDir, swConfig());
  assert.match(swr.text, /const PAGE_NETWORK_FIRST = false;/, '默认 false = 先返回缓存 + 后台更新');
  assert.match(swr.text, /PAGE_NETWORK_FIRST \? networkFirstPage\(event, request\) : cacheFirstPage\(event, request\)/,
    'false 走 cacheFirstPage（命中即返回 + 后台 revalidate）');
  assert.match(swr.text, /const PAGE_CACHE_LIMIT = 24;/, '页面缓存仍受 PAGE_CACHE_LIMIT 约束（不会无限增长）');
  assert.match(swr.text, /var excess = keys\.length - PAGE_CACHE_LIMIT;/, '超出上限按最早写入淘汰');
  assert.strictEqual(DEFAULT_FEATURES.pwa.pageNetworkFirst, false, 'schema 默认 SWR');
  assert.strictEqual(DEFAULT_CONFIG.site.pwa.enabled, true, 'site.pwa 默认开启（壳与 SW 才会生成）');

  // 显式 true 仍是 network-first，缓存名（版本哈希随开关变化）也随之不同
  const netFirst = generateSw(distDir, swConfig({ pageNetworkFirst: true }));
  assert.match(netFirst.text, /const PAGE_NETWORK_FIRST = true;/, 'true = network-first');
  const shellOf = (text) => /const SHELL_CACHE = "([^"]+)";/.exec(text)[1];
  assert.notStrictEqual(shellOf(netFirst.text), shellOf(swr.text), '策略开关变化必须使缓存名版本化（旧缓存被清理）');
});

test('壳预缓存预算：真实产物 ≤10 项且 gzip 合计 ≤110 KiB（2G 性能门禁）', (t) => {
  const srcDist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(srcDist, 'assets', 'js'))) {
    t.skip('无 dist 产物；先执行构建再跑本预算断言');
    return;
  }
  // 只搬预缓存策略相关的子树（连同应当被排除的 shared./deferred./cjk-fonts/vendor，
  // 以此证明排除是策略而非「文件不存在」）。
  const rels = ['assets/css', 'assets/js', 'assets/vendor/fonts', 'offline.html', 'manifest.json'];
  const files = {};
  const collect = (rel) => {
    const abs = path.join(srcDist, rel);
    if (!fs.existsSync(abs)) return;
    const stat = fs.statSync(abs);
    if (stat.isFile()) { files[rel] = fs.readFileSync(abs); return; }
    for (const name of fs.readdirSync(abs)) collect(path.join(rel, name));
  };
  rels.forEach(collect);
  try {
    for (const f of fs.readdirSync(path.join(srcDist, 'assets'))) {
      if (/^config\.[0-9A-Za-z]+\.json$/.test(f)) collect(path.join('assets', f));
    }
  } catch (e) { /* 无 assets 目录 */ }
  assert.ok(Object.keys(files).length > 0, 'dist 产物至少应含 CSS/JS');

  const distDir = makeTempDist(t, files);
  const { precache } = generateSw(distDir, swConfig());
  let raw = 0;
  let gz = 0;
  for (const url of precache) {
    const buf = fs.readFileSync(path.join(distDir, url.replace(/^\//, '')));
    raw += buf.length;
    gz += zlib.gzipSync(buf, { level: 9 }).length;
  }
  assert.ok(precache.length <= PRECACHE_MAX_ENTRIES,
    '预缓存条目 ' + precache.length + ' 超出上限 ' + PRECACHE_MAX_ENTRIES + '：' + precache.join(', '));
  assert.ok(gz <= PRECACHE_MAX_GZIP_BYTES,
    '预缓存 gzip 合计 ' + gz + 'B 超预算 ' + PRECACHE_MAX_GZIP_BYTES + 'B（raw ' + raw + 'B）');
  assert.ok(precache.some((u) => /\/assets\/js\/runtime\.[^/]+\.js$/.test(u)), '必须预缓存最终 runtime 入口');
  assert.ok(precache.some((u) => /\/assets\/js\/app\.[^/]+\.js$/.test(u)), '必须预缓存 app 入口');
  assert.ok(precache.some((u) => /\/assets\/css\/site\.[^/]+\.css$/.test(u)), '必须预缓存站点 CSS');
});
