'use strict';

// PWA Service Worker 生成器与缓存策略纯函数（构建期）。
// 职责：
//   1) 生成版本化缓存名（壳 / 页面 / 资产三类，同版本前缀）；
//   2) 过滤并归一化壳预缓存清单（只允许站内绝对路径，去重排序）；
//   3) 根据请求上下文选择缓存策略（页面 network-first / 资产 cache-first，可配置反转）；
//   4) 输出完整 SW 源码（策略实现内联在产物中，运行时零外部依赖）。
// 纯函数无 IO，直接供 Node 单测与 scripts/build/assets.js 复用。

const CACHE_KIND_SUFFIX = { shell: '-shell', pages: '-pages', assets: '-assets' };

// 缓存名片段净化：只保留小写字母/数字/点/下划线/连字符，空值回退。
function sanitizeToken(value, fallback) {
  const token = String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return token || fallback;
}

// 版本化缓存名前缀：基础名 + 版本（版本变化即换前缀，旧缓存由 SW activate 阶段清理）。
function versionedCacheName(base, version) {
  return sanitizeToken(base, 's-ynapse') + '-' + sanitizeToken(version, 'v1');
}

// 三类缓存名（壳预缓存 / 页面导航缓存 / 静态资产缓存）。
function cacheNames(base, version) {
  const prefix = versionedCacheName(base, version);
  return {
    shell: prefix + CACHE_KIND_SUFFIX.shell,
    pages: prefix + CACHE_KIND_SUFFIX.pages,
    assets: prefix + CACHE_KIND_SUFFIX.assets
  };
}

// 是否属于本站 SW 管理的缓存（用于 activate 清理时避免误删同源其他应用的缓存）。
function isOwnedCache(key, base) {
  const owner = sanitizeToken(base, 's-ynapse');
  return key === owner || key.indexOf(owner + '-') === 0;
}

// 旧缓存判定：属于本站管理、且不在当前版本的缓存名清单中。
function isStaleCache(key, base, currentNames) {
  if (!isOwnedCache(key, base)) return false;
  return (Array.isArray(currentNames) ? currentNames : []).indexOf(key) === -1;
}

// 路径归一化：接受完整 URL 或站内路径，输出 pathname（无法解析时按原串去查询串处理）。
function pathnameOf(raw) {
  const value = String(raw == null ? '' : raw);
  if (!value) return '';
  try {
    return new URL(value, 'http://localhost').pathname;
  } catch (e) {
    return value.split('?')[0].split('#')[0];
  }
}

// 壳预缓存清单：仅站内绝对路径；去查询串/哈希；去重、排序；
// 排除外链、空值、根路径（根路径可能被 302 到语言前缀）与 SW 自身路径。
function buildPrecacheList(entries, options) {
  const opts = options || {};
  const excluded = {};
  const excludeList = Array.isArray(opts.exclude) ? opts.exclude : ['/sw.js'];
  for (const item of excludeList) {
    if (typeof item === 'string' && item) excluded[pathnameOf(item)] = true;
  }
  const out = [];
  const seen = Object.create(null);
  for (const raw of Array.isArray(entries) ? entries : []) {
    if (typeof raw !== 'string') continue;
    let value = raw.trim();
    if (!value) continue;
    if (value.indexOf('//') === 0 || /^[a-z][a-z0-9+.-]*:/i.test(value)) continue;
    if (value.charAt(0) !== '/') value = '/' + value;
    const clean = value.split('#')[0].split('?')[0];
    if (!clean || clean === '/' || excluded[clean] || seen[clean]) continue;
    seen[clean] = true;
    out.push(clean);
  }
  return out.sort();
}

// 请求策略选择（纯函数）：
//   bypass            —— 非 GET / 跨源 / SW 自身；
//   page-network-first / page-cache-first   —— 页面导航（硬导航、软导航请求、Accept: text/html）；
//   asset-cache-first / asset-network-first —— 静态资产与其余 GET。
// 页面判定优先于资产判定（防止 /zh/feed.xml 之类被当资产处理）。
function selectStrategy(request, options) {
  const req = request || {};
  const opts = options || {};
  if ((req.method || 'GET') !== 'GET') return 'bypass';
  if (req.origin && req.scopeOrigin && req.origin !== req.scopeOrigin) return 'bypass';
  const pathname = pathnameOf(req.url);
  const swPath = opts.swPath ? pathnameOf(opts.swPath) : '/sw.js';
  if (pathname === swPath) return 'bypass';
  const accept = String(req.accept == null ? '' : req.accept).toLowerCase();
  const isPage = req.mode === 'navigate' || req.softNav === true || accept.indexOf('text/html') !== -1;
  if (isPage) return opts.pageNetworkFirst === false ? 'page-cache-first' : 'page-network-first';
  return opts.assetCacheFirst === false ? 'asset-network-first' : 'asset-cache-first';
}

// 生成 SW 源码：常量（缓存名/清单/开关）内联，策略实现与 selectStrategy 语义一致。
function renderServiceWorker(options) {
  const opts = options || {};
  const names = cacheNames(opts.cacheName, opts.version);
  const base = sanitizeToken(opts.cacheName, 's-ynapse');
  const precache = Array.isArray(opts.precache) ? opts.precache : [];
  const offlineUrl = typeof opts.offlineUrl === 'string' ? opts.offlineUrl : '';
  const swPath = pathnameOf(opts.swPath || '/sw.js') || '/sw.js';
  const pageNetworkFirst = opts.pageNetworkFirst !== false;
  const assetCacheFirst = opts.assetCacheFirst !== false;
  const pageCacheLimit = Number.isFinite(Number(opts.pageCacheLimit)) && Number(opts.pageCacheLimit) >= 0
    ? Math.floor(Number(opts.pageCacheLimit))
    : 0;
  return `'use strict';
// 由 scripts/lib/pwa-sw.js 构建期生成，请勿手改。
const SHELL_CACHE = ${JSON.stringify(names.shell)};
const PAGES_CACHE = ${JSON.stringify(names.pages)};
const ASSETS_CACHE = ${JSON.stringify(names.assets)};
const OWNED_BASE = ${JSON.stringify(base)};
const OWNED_PREFIX = ${JSON.stringify(base + '-')};
const PRECACHE_URLS = ${JSON.stringify(precache)};
const OFFLINE_URL = ${JSON.stringify(offlineUrl)};
const SW_PATH = ${JSON.stringify(swPath)};
const PAGE_NETWORK_FIRST = ${pageNetworkFirst ? 'true' : 'false'};
const ASSET_CACHE_FIRST = ${assetCacheFirst ? 'true' : 'false'};
const PAGE_CACHE_LIMIT = ${pageCacheLimit};

function isOwned(key) {
  return key === OWNED_BASE || key.indexOf(OWNED_PREFIX) === 0;
}
function isCurrent(key) {
  return key === SHELL_CACHE || key === PAGES_CACHE || key === ASSETS_CACHE;
}
function pathnameOf(raw) {
  try { return new URL(raw).pathname; } catch (e) { return ''; }
}
function isPageRequest(request) {
  if (request.mode === 'navigate' || request.destination === 'document') return true;
  var headers = request.headers;
  var accept = (headers && headers.get && headers.get('Accept')) || '';
  if (accept.indexOf('text/html') !== -1) return true;
  return (headers && headers.get && headers.get('X-Requested-With')) === 'soft-navigation';
}
function offlineFallback() {
  var candidates = OFFLINE_URL ? [OFFLINE_URL] : [];
  function next(i) {
    if (i >= candidates.length) {
      return new Response('', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return caches.match(candidates[i]).then(function (hit) { return hit || next(i + 1); });
  }
  return next(0);
}
function cachePage(request, response) {
  return caches.open(PAGES_CACHE).then(function (cache) {
    return cache.put(request, response);
  }).then(function () {
    if (!(PAGE_CACHE_LIMIT > 0)) return null;
    return caches.open(PAGES_CACHE).then(function (cache) {
      return cache.keys().then(function (keys) {
        var excess = keys.length - PAGE_CACHE_LIMIT;
        if (excess <= 0) return null;
        return Promise.all(keys.slice(0, excess).map(function (key) { return cache.delete(key); }));
      });
    });
  });
}
function matchCachedPage(request) {
  return caches.open(PAGES_CACHE).then(function (cache) {
    return cache.match(request);
  }).then(function (hit) {
    if (hit) return hit;
    return caches.match(request);
  });
}
function cacheAsset(request, response) {
  return caches.open(ASSETS_CACHE).then(function (cache) {
    return cache.put(request, response);
  });
}
function matchCachedAsset(request) {
  return caches.open(ASSETS_CACHE).then(function (cache) {
    return cache.match(request);
  }).then(function (hit) {
    if (hit) return hit;
    return caches.match(request);
  }).then(function (hit) {
    if (hit) return hit;
    return caches.match(request, { ignoreSearch: true });
  });
}
function networkFirstPage(event, request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) event.waitUntil(cachePage(request, response.clone()));
    return response;
  }).catch(function () {
    return matchCachedPage(request).then(function (hit) { return hit || offlineFallback(); });
  });
}
function cacheFirstPage(event, request) {
  return matchCachedPage(request).then(function (hit) {
    var network = fetch(request).then(function (response) {
      if (response && response.ok) event.waitUntil(cachePage(request, response.clone()));
      return response;
    });
    if (hit) {
      event.waitUntil(network.catch(function () {}));
      return hit;
    }
    return network.catch(function () { return offlineFallback(); });
  });
}
function cacheFirstAsset(event, request) {
  return matchCachedAsset(request).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (response) {
      if (response && response.ok) event.waitUntil(cacheAsset(request, response.clone()));
      return response;
    }).catch(function () {
      return caches.match(request).then(function (fallbackHit) { return fallbackHit || offlineFallback(); });
    });
  });
}
function networkFirstAsset(event, request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) event.waitUntil(cacheAsset(request, response.clone()));
    return response;
  }).catch(function () {
    return matchCachedAsset(request);
  });
}

self.addEventListener('install', function (event) {
  if (!PRECACHE_URLS.length) return;
  event.waitUntil(caches.open(SHELL_CACHE).then(function (cache) {
    return cache.addAll(PRECACHE_URLS);
  }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (!isOwned(key) || isCurrent(key)) return null;
        return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 新版本就绪后等待页面确认（用户点击刷新）再接管，避免旧页面混用新缓存。
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname === SW_PATH) return;
  if (isPageRequest(request)) {
    event.respondWith(PAGE_NETWORK_FIRST ? networkFirstPage(event, request) : cacheFirstPage(event, request));
    return;
  }
  event.respondWith(ASSET_CACHE_FIRST ? cacheFirstAsset(event, request) : networkFirstAsset(event, request));
});
`;
}

module.exports = {
  sanitizeToken,
  versionedCacheName,
  cacheNames,
  isOwnedCache,
  isStaleCache,
  buildPrecacheList,
  selectStrategy,
  renderServiceWorker
};
