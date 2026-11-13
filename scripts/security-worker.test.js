'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WORKERS_DIR = path.join(__dirname, '..', 'workers');
const CONFIG_PATH = path.join(WORKERS_DIR, 'security-config.js');
// 审查 R-12：workers/security-config.js 被 .gitignore 忽略且是生产 Worker 的配置。
// 此前的 fixture 直接覆写它、只在 after 恢复 —— 测试被 SIGINT/超时打断就会把夹具留在工作区，
// 随后 `npm run deploy:worker` 会把夹具推上生产。因此这里在模块加载时记录原始字节，
// 由末尾的隔离断言证明整个测试套件对它只读。
const CONFIG_SNAPSHOT = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH) : null;
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
    directives: { 'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'", "'nonce-test-style'"] },
    reportOnly: false,
    reportUri: '/csp-report'
  },
  pathRestrictions: [{ path: '/admin/*', requireAuth: true, allowedIPs: ['192.168.1.0/24'] }],
  // features.maintenance 经构建期写入：false 时维护响应不输出 Retry-After（本 fixture 验证关闭态）。
  maintenance: { setRetryAfter: false, retryAfter: 120 },
  forceHttps: true,
  headers: {
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  }
};

let worker = null;
// 审查 R-12：fixture 配置写进 workers/ 的临时副本，仓库文件完全不被触碰。
// 临时目录在 after 清理；before 内部抛错时也立即清理，避免遗留。
let tmpRoot = null;

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
  it('folds dot segments and repeated encoding so traversal cannot bypass rules', () => {
    const rules = [{ path: '/admin/*' }];
    assert.ok(ipUtils.isPathBlocked('/media/../admin/panel', rules));
    assert.ok(ipUtils.isPathBlocked('/media/%2e%2e/admin/panel', rules));
    assert.ok(ipUtils.isPathBlocked('/media/%252e%252e/admin/panel', rules));
    assert.ok(ipUtils.isPathBlocked('/./admin/panel', rules));
    assert.strictEqual(ipUtils.isPathBlocked('/media/../photos/x', rules), null);
  });
  // 审查 R-09：`/*` 折成 '/' 后被 continue 掉、`/admin*` 与 `/admin/**` 一条都匹配不上，
  // 等于运维按通配语义写的规则线上零拦截且无任何提示。
  it('honours whole-site and alternate wildcard rule forms (R-09)', () => {
    for (const pattern of ['/*', '/**']) {
      const rules = [{ path: pattern }];
      assert.ok(ipUtils.isPathBlocked('/zh/', rules), pattern + ' 必须拦截任意路径');
      assert.ok(ipUtils.isPathBlocked('/', rules), pattern + ' 必须拦截根路径');
      assert.ok(ipUtils.isPathBlocked('/a/b/c', rules));
    }
    for (const pattern of ['/admin*', '/admin/**', '/admin/*']) {
      const rules = [{ path: pattern }];
      assert.ok(ipUtils.isPathBlocked('/admin', rules), pattern + ' 必须拦截基路径本身');
      assert.ok(ipUtils.isPathBlocked('/admin/x/y', rules), pattern + ' 必须拦截子路径');
      assert.strictEqual(ipUtils.isPathBlocked('/administrator', rules), null, pattern + ' 不得越界到相邻目录名');
    }
    assert.strictEqual(ipUtils.ruleBasePath('/a/*/b'), '/a/*/b', '中段通配不做折叠，交由构建期告警');
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
    // 审查 R-08：maxEntries 是硬上限。此前该断言写 4（超过上限 3 而条目仍在），
    // 等于把「上限不生效」固化为预期；正确不变量是超限必须淘汰到上限以内。
    assert.ok(limiter.size <= 3, 'map 不得超过 maxEntries，实际 ' + limiter.size);
    assert.strictEqual(limiter.check('a', opts, 4), 'blocked', '在效封禁不得被淘汰');
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
    // 整个 workers/ 复制到临时目录后再 import：worker 用相对路径 import("./security-config.js")，
    // 该解析相对模块自身位置，因此副本里的 fixture 配置只会被副本用上，
    // 且临时路径的模块在 ESM 缓存中与仓库路径互不干扰。
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-worker-'));
    const tmpWorkers = path.join(tmpRoot, 'workers');
    try {
      fs.cpSync(WORKERS_DIR, tmpWorkers, { recursive: true });
      fs.writeFileSync(path.join(tmpWorkers, 'security-config.js'), 'export default ' + JSON.stringify(FIXTURE, null, 2) + ';\n', 'utf-8');
      const mod = await import(pathToFileURL(path.join(tmpWorkers, 'security-worker.js')).href);
      worker = mod.default;
    } catch (err) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      tmpRoot = null;
      throw err;
    }
  });
  after(() => {
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
    tmpRoot = null;
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

  it('rate limits requests without CF-Connecting-IP instead of skipping (fail-closed)', async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await worker.fetch(req('https://example.com/zh/'), makeEnv());
      assert.strictEqual(ok.status, 200, 'anonymous request ' + (i + 1));
    }
    const limited = await worker.fetch(req('https://example.com/zh/'), makeEnv());
    assert.strictEqual(limited.status, 429);
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
    const res = await worker.fetch(req('https://example.com/zh/', { headers: { 'Accept-Language': 'en-US' } }, '203.0.113.60'), makeEnv({
      MAINTENANCE: '1',
      MAINTENANCE_MESSAGE: '<img src=x onerror=alert(1)>'
    }));
    assert.strictEqual(res.status, 503);
    const body = await res.text();
    assert.ok(body.includes('&lt;img src=x onerror=alert(1)&gt;'), 'message must be escaped');
    assert.ok(!body.includes('<img src=x'), 'raw payload must not appear');
    assert.ok(!body.includes('The site is under maintenance.'), 'custom message must override the bilingual default');
    assert.ok(body.includes('<style nonce="test-style">'), 'CSP 带 nonce 时维护页内联样式应同 nonce');
    assert.strictEqual(res.headers.get('X-Frame-Options'), 'DENY');
    assert.ok((res.headers.get('Content-Security-Policy') || '').includes('report-uri /csp-report'));
  });

  it('maintenance default notice follows Accept-Language (en-US / zh-CN)', async () => {
    const en = await worker.fetch(req('https://example.com/zh/', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }, '203.0.113.61'), makeEnv({ MAINTENANCE: '1' }));
    assert.strictEqual(en.status, 503);
    const enBody = await en.text();
    assert.ok(enBody.includes('lang="en"'), 'en-US 维护页 lang 应为 en');
    assert.ok(enBody.includes('The site is under maintenance. Please check back later.'), 'en-US 应返回英文默认文案');
    assert.ok(enBody.includes('<h1>Maintenance</h1>'), 'en-US 标题应为英文');

    const zh = await worker.fetch(req('https://example.com/zh/', { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' } }, '203.0.113.62'), makeEnv({ MAINTENANCE: '1' }));
    assert.strictEqual(zh.status, 503);
    const zhBody = await zh.text();
    assert.ok(zhBody.includes('lang="zh-CN"'), 'zh-CN 维护页 lang 应为 zh-CN');
    assert.ok(zhBody.includes('本站正在维护中，请稍后再来。'), 'zh-CN 应返回中文默认文案');
    assert.ok(zhBody.includes('<h1>维护中</h1>'), 'zh-CN 标题应为中文');
  });

  it('maintenance setRetryAfter=false omits Retry-After (features.maintenance)', async () => {
    const res = await worker.fetch(req('https://example.com/zh/', {}, '203.0.113.63'), makeEnv({ MAINTENANCE: '1' }));
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.headers.get('Retry-After'), null, 'setRetryAfter=false 时不得输出 Retry-After');
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

  it('只给 200 的 HTML 贴 SWR；404 页不得可复用', async () => {
    const html = (status) => new Response('<html>page</html>', {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
    const ok = await worker.fetch(req('https://example.com/zh/', {}, '203.0.113.81'), makeEnv({
      ASSETS: { fetch: async () => html(200) }
    }));
    assert.strictEqual(ok.status, 200);
    assert.match(String(ok.headers.get('Cache-Control')), /stale-while-revalidate=86400/);
    assert.match(String(ok.headers.get('Vary')), /Accept-Encoding/i);

    const missing = await worker.fetch(req('https://example.com/zh/gone/', {}, '203.0.113.82'), makeEnv({
      ASSETS: { fetch: async () => html(404) }
    }));
    assert.strictEqual(missing.status, 404);
    assert.ok(
      !/stale-while-revalidate/.test(String(missing.headers.get('Cache-Control'))),
      '404 被贴 SWR 后，页面正式上线时访客仍会拿到缓存里的 404：' + missing.headers.get('Cache-Control')
    );

    // 非 HTML（例如图片）不应被这条规则影响
    const asset = await worker.fetch(req('https://example.com/media/a.webp', {}, '203.0.113.83'), makeEnv({
      ASSETS: { fetch: async () => new Response('bin', { status: 200, headers: { 'Content-Type': 'image/webp' } }) }
    }));
    assert.ok(!/stale-while-revalidate=86400/.test(String(asset.headers.get('Cache-Control') || '')));
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
    assert.strictEqual(r.rl.maxTrackedEntries, 5000, '缺失 maxTrackedEntries 回退兜底常量');
    assert.strictEqual(r.reportMaxBytes, 16384, '缺失 cspReportMaxBytes 回退兜底常量');
  });

  it('resolves maxTrackedEntries / cspReportMaxBytes from generated config (invalid falls back)', () => {
    const ok = resolveWorkerConfig({ rateLimiting: { maxTrackedEntries: 9000 }, cspReportMaxBytes: 4096 });
    assert.strictEqual(ok.rl.maxTrackedEntries, 9000);
    assert.strictEqual(ok.reportMaxBytes, 4096);
    const bad = resolveWorkerConfig({ rateLimiting: { maxTrackedEntries: -1 }, cspReportMaxBytes: 0 });
    assert.strictEqual(bad.rl.maxTrackedEntries, -1, 'resolveWorkerConfig 仅透传（实际使用点在 limiter 构造处钳制）');
    assert.strictEqual(bad.reportMaxBytes, 16384, '非法上报上限回退');
  });
});

describe('security-worker test isolation', () => {
  it('leaves workers/security-config.js byte-identical to its pre-suite content', () => {
    // 审查 R-12：这套测试唯一的回归护栏 —— 即使套件被中断，仓库里的生产配置也必须保持原样，
    // 因为它是被 gitignore 的、deploy:worker 会直接上线的文件。
    const current = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH) : null;
    if (CONFIG_SNAPSHOT === null && current === null) return; // 文件不存在：无从比较，跳过
    assert.ok(current !== null, 'workers/security-config.js 在测试期间被删除');
    assert.ok(CONFIG_SNAPSHOT !== null, 'workers/security-config.js 在测试期间被创建');
    assert.ok(CONFIG_SNAPSHOT.equals(current), 'workers/security-config.js 在测试期间被改写');
  });
});
