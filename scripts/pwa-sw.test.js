'use strict';
// PWA 单测：
//   1. 构建期纯函数（scripts/lib/pwa-sw.js）：缓存清单过滤/去重/排序、策略选择矩阵、
//      版本化缓存名、旧缓存判定、SW 源码契约（预缓存/策略开关/更新握手/版本化清理）；
//   2. 运行时纯函数（js/domains/features/pwa.js 经 data URL 导入，与浏览器同源）：
//      更新提示触发条件（仅更新场景 + 未提示过）；
//   3. 配置契约：features.json5 ↔ schema、site.json5/site-defaults 默认开启、
//      ui-strings 双语、构建与运行时的接线断言。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const { DEFAULT_CONFIG } = require('./lib/site-defaults.js');
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
    precache: true, pageNetworkFirst: true, assetCacheFirst: true, pageCacheLimit: 24,
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
  assert.match(assetsSrc, /listFilesRecursive\(path\.join\(distDir, 'assets', 'vendor', 'fonts'\)/, '核心字体进入预缓存候选');
  const securitySrc = fs.readFileSync(path.join(ROOT, 'scripts', 'build', 'security-files.js'), 'utf-8');
  assert.match(securitySrc, /'\/sw\.js\\n {2}Cache-Control: no-cache'/, '/sw.js 输出 no-cache');
  const deferredSrc = fs.readFileSync(path.join(ROOT, 'js', 'core', 'deferred.js'), 'utf-8');
  assert.match(deferredSrc, /import \{ init as pwaInit \} from '\.\.\/domains\/features\/pwa\.js'/, 'PWA 模块进按需加载路径');
});
