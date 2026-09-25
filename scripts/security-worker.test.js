'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WORKERS_DIR = path.join(__dirname, '..', 'workers');
const CONFIG_PATH = path.join(WORKERS_DIR, 'security-config.js');
const FIXTURE = {
  rateLimiting: {
    enabled: true,
    maxRequests: 3,
    windowMs: 60000,
    blockDuration: 300000,
    whitelist: ['192.168.1.1'],
    blacklist: ['10.9.9.0/24'],
    skipPaths: ['/assets/']
  },
  csp: {
    directives: { 'default-src': ["'self'"], 'script-src': ["'self'"] },
    reportOnly: false,
    reportUri: '/csp-report'
  },
  pathRestrictions: [{ path: '/admin/*', requireAuth: true, allowedIPs: ['192.168.1.0/24'] }],
  forceHttps: true,
  headers: {
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  }
};

let worker = null;
let originalConfig = null;
let originalExisted = false;

function makeEnv(overrides) {
  return Object.assign({
    ENVIRONMENT: 'production',
    ASSETS: {
      fetch: async () => new Response('<html>ok</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
    }
  }, overrides || {});
}

function req(url, init, ip) {
  const headers = Object.assign({}, (init && init.headers) || {});
  if (ip) headers['CF-Connecting-IP'] = ip;
  return new Request(url, Object.assign({}, init, { headers }));
}

describe('workers/lib ip-utils', () => {
  let ipUtils;
  before(async () => { ipUtils = await import('../workers/lib/ip-utils.mjs'); });

  it('matches IPv4 CIDR and single addresses', () => {
    assert.strictEqual(ipUtils.ipMatchesCidr('10.0.0.5', '10.0.0.0/8'), true);
    assert.strictEqual(ipUtils.ipMatchesCidr('11.0.0.5', '10.0.0.0/8'), false);
    assert.strictEqual(ipUtils.ipMatchesCidr('1.2.3.4', '1.2.3.4'), true);
    assert.strictEqual(ipUtils.ipMatchesCidr('1.2.3.5', '1.2.3.4'), false);
  });
  it('matches IPv6 including compression and IPv4-mapped forms', () => {
    assert.strictEqual(ipUtils.ipMatchesCidr('2001:db8::1', '2001:db8::/32'), true);
    assert.strictEqual(ipUtils.ipMatchesCidr('2001:db9::1', '2001:db8::/32'), false);
    assert.strictEqual(ipUtils.ipMatchesCidr('::ffff:10.1.2.3', '10.0.0.0/8'), true);
    assert.strictEqual(ipUtils.ipMatchesCidr('[2001:db8::1]', '2001:db8::/32'), true);
  });
  it('returns false for invalid entries and IPs', () => {
    assert.strictEqual(ipUtils.ipMatchesCidr('not-an-ip', '10.0.0.0/8'), false);
    assert.strictEqual(ipUtils.ipMatchesCidr('10.0.0.1', '10.0.0.0/99'), false);
    assert.strictEqual(ipUtils.ipMatchesAny('10.0.0.1', null), false);
  });
  it('matches blocked paths case-insensitively and decodes percent-encoding', () => {
    const rules = [{ path: '/admin/*' }];
    assert.ok(ipUtils.isPathBlocked('/admin/panel', rules));
    assert.ok(ipUtils.isPathBlocked('/ADMIN/Panel', rules));
    assert.ok(ipUtils.isPathBlocked('/%61dmin/panel', rules));
    assert.strictEqual(ipUtils.isPathBlocked('/administrator', rules), null);
    assert.strictEqual(ipUtils.isPathBlocked('/', rules), null);
  });
});

describe('workers/lib rate-limit', () => {
  let rlLib;
  before(async () => { rlLib = await import('../workers/lib/rate-limit.mjs'); });

  it('limits after maxRequests and keeps block through eviction', () => {
    const limiter = new rlLib.RateLimiter(3);
    const opts = { maxRequests: 2, windowMs: 1000, blockDuration: 5000 };
    assert.strictEqual(limiter.check('a', opts, 0), 'ok');
    assert.strictEqual(limiter.check('a', opts, 1), 'ok');
    assert.strictEqual(limiter.check('a', opts, 2), 'limited');
    assert.strictEqual(limiter.check('a', opts, 3), 'blocked');
    limiter.check('b', opts, 4);
    limiter.check('c', opts, 4);
    limiter.check('d', opts, 4);
    assert.strictEqual(limiter.size, 4);
    limiter.evict(6000, 1000);
    assert.strictEqual(limiter.check('a', opts, 6001), 'ok');
  });
  it('static asset prefixes match case-insensitively', () => {
    assert.strictEqual(rlLib.isStaticAsset('/assets/js/main.js', ['/assets/']), true);
    assert.strictEqual(rlLib.isStaticAsset('/Assets/x.css', ['/assets/']), true);
    assert.strictEqual(rlLib.isStaticAsset('/posts/', ['/assets/']), false);
    assert.strictEqual(rlLib.isStaticAsset('/x', []), false);
  });
});

describe('security-worker integration (fixture config)', () => {
  before(async () => {
    originalExisted = fs.existsSync(CONFIG_PATH);
    if (originalExisted) originalConfig = fs.readFileSync(CONFIG_PATH);
    fs.writeFileSync(CONFIG_PATH, 'export default ' + JSON.stringify(FIXTURE, null, 2) + ';\n', 'utf-8');
    const mod = await import('../workers/security-worker.js');
    worker = mod.default;
  });
  after(() => {
    if (originalExisted && originalConfig) fs.writeFileSync(CONFIG_PATH, originalConfig);
    else fs.rmSync(CONFIG_PATH, { force: true });
  });

  it('redirects http→https only in production', async () => {
    const prod = await worker.fetch(req('http://example.com/zh/', {}, '203.0.113.10'), makeEnv());
    assert.strictEqual(prod.status, 301);
    assert.strictEqual(prod.headers.get('Location'), 'https://example.com/zh/');
    const dev = await worker.fetch(req('http://example.com/zh/', {}, '203.0.113.11'), makeEnv({ ENVIRONMENT: undefined }));
    assert.strictEqual(dev.status, 200);
  });

  it('blocks blacklisted CIDR ranges', async () => {
    const res = await worker.fetch(req('https://example.com/zh/', {}, '10.9.9.7'), makeEnv());
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.headers.get('X-Frame-Options'), 'DENY');
  });

  it('rate limits after maxRequests, returns 429 + Retry-After, and keeps the block', async () => {
    const ip = '203.0.113.20';
    for (let i = 0; i < 3; i++) {
      const ok = await worker.fetch(req('https://example.com/zh/', {}, ip), makeEnv());
      assert.strictEqual(ok.status, 200, 'request ' + (i + 1));
    }
    const limited = await worker.fetch(req('https://example.com/zh/', {}, ip), makeEnv());
    assert.strictEqual(limited.status, 429);
    assert.ok(Number(limited.headers.get('Retry-After')) > 0);
    assert.strictEqual(limited.headers.get('X-Frame-Options'), 'DENY');
    const after = await worker.fetch(req('https://example.com/zh/', {}, ip), makeEnv());
    assert.strictEqual(after.status, 429);
  });

  it('whitelisted IPs bypass rate limiting', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await worker.fetch(req('https://example.com/zh/', {}, '192.168.1.1'), makeEnv());
      assert.strictEqual(res.status, 200, 'whitelist request ' + (i + 1));
    }
  });

  it('skips rate limiting for static asset prefixes', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await worker.fetch(req('https://example.com/assets/js/main.js', {}, '203.0.113.30'), makeEnv());
      assert.strictEqual(res.status, 200, 'asset request ' + (i + 1));
    }
  });

  it('blocks restricted paths, allows matching allowedIPs, decodes case/encoding', async () => {
    const blocked = await worker.fetch(req('https://example.com/admin/panel', {}, '203.0.113.40'), makeEnv());
    assert.strictEqual(blocked.status, 403);
    const encoded = await worker.fetch(req('https://example.com/%61dmin/panel', {}, '203.0.113.41'), makeEnv());
    assert.strictEqual(encoded.status, 403);
    const wrongRange = await worker.fetch(req('https://example.com/admin/panel', {}, '10.9.9.7'), makeEnv());
    assert.strictEqual(wrongRange.status, 403);
    const allowed = await worker.fetch(req('https://example.com/admin/panel', {}, '192.168.1.5'), makeEnv());
    assert.strictEqual(allowed.status, 200);
  });

  it('normalizes %2F and duplicated slashes in blocked paths', async () => {
    const encodedSlash = await worker.fetch(req('https://example.com/%2Fadmin/panel', {}, '203.0.113.90'), makeEnv());
    assert.strictEqual(encodedSlash.status, 403);
    const doubleSlash = await worker.fetch(req('https://example.com//admin/panel', {}, '203.0.113.91'), makeEnv());
    assert.strictEqual(doubleSlash.status, 403);
  });

  it('does not skip rate limiting for non-GET static-asset paths', async () => {
    const ip = '203.0.113.92';
    for (let i = 0; i < 3; i++) {
      await worker.fetch(req('https://example.com/assets/x.js', { method: 'POST' }, ip), makeEnv());
    }
    const fourth = await worker.fetch(req('https://example.com/assets/x.js', { method: 'POST' }, ip), makeEnv());
    assert.strictEqual(fourth.status, 429);
  });

  it('accepts CSP reports after rate limit, rejects oversized payloads', async () => {
    const ok = await worker.fetch(req('https://example.com/csp-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'csp-report': { 'document-uri': 'https://example.com/x', 'violated-directive': 'img-src', 'blocked-uri': 'https://evil.example/i.png' } })
    }, '203.0.113.50'), makeEnv());
    assert.strictEqual(ok.status, 200);
    const big = await worker.fetch(req('https://example.com/csp-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'x'.repeat(20000)
    }, '203.0.113.51'), makeEnv());
    assert.strictEqual(big.status, 413);
  });

  it('maintenance mode escapes the custom message and sets security headers', async () => {
    const res = await worker.fetch(req('https://example.com/zh/', {}, '203.0.113.60'), makeEnv({
      MAINTENANCE: '1',
      MAINTENANCE_MESSAGE: '<img src=x onerror=alert(1)>'
    }));
    assert.strictEqual(res.status, 503);
    const body = await res.text();
    assert.ok(body.includes('&lt;img src=x onerror=alert(1)&gt;'), 'message must be escaped');
    assert.ok(!body.includes('<img src=x'), 'raw payload must not appear');
    assert.strictEqual(res.headers.get('X-Frame-Options'), 'DENY');
    assert.ok((res.headers.get('Content-Security-Policy') || '').includes('report-uri /csp-report'));
  });

  it('adds CSP + security headers on normal responses', async () => {
    const res = await worker.fetch(req('https://example.com/zh/', {}, '203.0.113.70'), makeEnv());
    assert.strictEqual(res.status, 200);
    assert.ok((res.headers.get('Content-Security-Policy') || '').includes("default-src 'self'"));
    assert.ok((res.headers.get('Content-Security-Policy') || '').includes('report-uri /csp-report'));
    assert.strictEqual(res.headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains; preload');
  });

  it('returns 502 with security headers when ASSETS fetch fails', async () => {
    const res = await worker.fetch(req('https://example.com/zh/', {}, '203.0.113.80'), makeEnv({
      ASSETS: { fetch: async () => { throw new Error('boom'); } }
    }));
    assert.strictEqual(res.status, 502);
    assert.strictEqual(res.headers.get('X-Frame-Options'), 'DENY');
  });

  it('returns X-Request-Id (CF-Ray passthrough or generated UUID) on every response path', async () => {
    const viaRay = await worker.fetch(req('https://example.com/zh/', { headers: { 'CF-Ray': 'ray-probe-1' } }, '203.0.113.101'), makeEnv());
    assert.strictEqual(viaRay.headers.get('X-Request-Id'), 'ray-probe-1');
    const generated = await worker.fetch(req('https://example.com/zh/', {}, '203.0.113.102'), makeEnv());
    assert.match(String(generated.headers.get('X-Request-Id')), /^[0-9a-f-]{36}$/);
    const blocked = await worker.fetch(req('https://example.com/admin/panel', {}, '203.0.113.103'), makeEnv());
    assert.strictEqual(blocked.status, 403);
    assert.ok(blocked.headers.get('X-Request-Id'), '403 也应携带 X-Request-Id');
    const maint = await worker.fetch(req('https://example.com/zh/', {}, '203.0.113.104'), makeEnv({ MAINTENANCE: '1' }));
    assert.strictEqual(maint.status, 503);
    assert.ok(maint.headers.get('X-Request-Id'), '维护模式也应携带 X-Request-Id');
  });

  it('emits structured JSON logs with requestId and hashed ip (never raw ip)', async () => {
    const origWarn = console.warn;
    const lines = [];
    console.warn = (s) => { lines.push(String(s)); };
    try {
      for (let i = 0; i < 4; i++) {
        await worker.fetch(req('https://example.com/zh/', {}, '198.51.100.77'), makeEnv());
      }
    } finally {
      console.warn = origWarn;
    }
    const parsed = lines.map((l) => { try { return JSON.parse(l); } catch (e) { return null; } });
    const evt = parsed.find((o) => o && o.event === 'rate_limited');
    assert.ok(evt, '应输出 rate_limited 结构化日志');
    assert.strictEqual(evt.level, 'warn');
    assert.strictEqual(evt.module, 'security-worker');
    assert.ok(evt.requestId, '日志应含 requestId');
    assert.strictEqual(evt.ipHash.length, 12, 'IP 应为 12 位短哈希');
    assert.ok(!lines.some((l) => l.includes('198.51.100.77')), '不得出现明文 IP');
  });
});

describe('security-worker config resolution (empty arrays vs missing fields)', () => {
  let resolveWorkerConfig = null;
  before(async () => {
    const mod = await import('../workers/security-worker.js');
    resolveWorkerConfig = mod.resolveWorkerConfig;
  });

  it('exposes resolveWorkerConfig for semantic testing', () => {
    assert.strictEqual(typeof resolveWorkerConfig, 'function');
  });

  it('keeps explicitly empty pathRestrictions and skipPaths (no fallback)', () => {
    const r = resolveWorkerConfig({ pathRestrictions: [], rateLimiting: { enabled: true, skipPaths: [] } });
    assert.deepStrictEqual(r.blockedRules, []);
    assert.deepStrictEqual(r.skipPaths, []);
  });

  it('falls back to fail-closed defaults only when fields are missing', () => {
    const r = resolveWorkerConfig({});
    assert.deepStrictEqual(r.blockedRules, ['/admin/*']);
    assert.ok(r.skipPaths.length > 0, 'missing skipPaths must keep the built-in static-asset skip list');
  });
});
