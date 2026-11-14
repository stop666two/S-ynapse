'use strict';
// 接线：features.maintenance.enabled 此前零消费 —— 用户写 enabled 对 Worker 与本地
// serve 都没有任何效果（只有 serve --maintenance 参数与 Worker 环境变量 MAINTENANCE=1 生效）。
// 本文件验证三件事：
//   1) 构建期投影：features.maintenance.enabled 经 maintenanceWorkerConfig 进入 Worker 配置；
//   2) Worker 运行时：enabled=true 等价于 MAINTENANCE=1（取或），env 仍可单独开启，
//      且 false/缺键 + 无 env 时照常服务；
//   3) 本地 serve：enabled=true 与 --maintenance 等价。
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const WORKERS_DIR = path.join(__dirname, '..', 'workers');

// ---- 共用夹具 -------------------------------------------------------------

function baseFixture(maintenance) {
  return {
    // 限流关闭：本文件只测维护态，避免多次请求被 429 干扰。
    rateLimiting: { enabled: false },
    csp: { directives: { 'default-src': ["'self'"] }, reportOnly: false, reportUri: '/csp-report' },
    pathRestrictions: [],
    forceHttps: false,
    headers: { 'X-Frame-Options': 'DENY' },
    maintenance: maintenance
  };
}

function makeEnv(overrides) {
  return Object.assign({
    ASSETS: {
      fetch: async () => new Response('<html>ok</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
    }
  }, overrides || {});
}

function req(url, init) {
  return new Request(url, init || {});
}

// 与 scripts/security-worker.test.js 相同做法：把整个 workers/ 复制进临时目录后 import，
// worker 的 import("./security-config.js") 相对模块自身解析，因此既不碰仓库里的真实
// workers/security-config.js，两份不同 fixture 也因路径不同而在 ESM 缓存中互不干扰。
async function loadWorkerWith(maintenance) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-maint-'));
  const tmpWorkers = path.join(tmpRoot, 'workers');
  try {
    fs.cpSync(WORKERS_DIR, tmpWorkers, { recursive: true });
    fs.writeFileSync(
      path.join(tmpWorkers, 'security-config.js'),
      'export default ' + JSON.stringify(baseFixture(maintenance), null, 2) + ';\n',
      'utf-8'
    );
    const mod = await import(pathToFileURL(path.join(tmpWorkers, 'security-worker.js')).href);
    return { worker: mod.default, cleanup: () => fs.rmSync(tmpRoot, { recursive: true, force: true }) };
  } catch (err) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    throw err;
  }
}

// ---- 1. 构建期投影 ---------------------------------------------------------

describe('features.maintenance.enabled → Worker 配置投影', () => {
  const { maintenanceWorkerConfig, extractWorkerSecurity } = require('./generate-security-config.js');

  it('缺键时投影为 enabled:false（兜底不得把站点推进维护态）', () => {
    // switch: features.maintenance.enabled
    const projected = maintenanceWorkerConfig({});
    assert.strictEqual(projected.enabled, false, '缺键默认必须是 false');
    // 同源兜底：与 workers/lib/security-fallbacks.js 的 MAINTENANCE_FALLBACKS 一致。
    assert.strictEqual(projected.setRetryAfter, true);
    assert.strictEqual(projected.retryAfter, 3600);
  });

  it('enabled:true / enabled:false 产生不同投影（双态）', () => {
    // switch: features.maintenance.enabled
    const on = maintenanceWorkerConfig({ maintenance: { enabled: true, retryAfter: 77 } });
    const off = maintenanceWorkerConfig({ maintenance: { enabled: false, retryAfter: 77 } });
    assert.strictEqual(on.enabled, true);
    assert.strictEqual(off.enabled, false);
    assert.notDeepStrictEqual(on, off, '两种取值必须产生可区分的 Worker 配置');
    assert.strictEqual(on.retryAfter, 77, 'enabled 接线不得影响 retryAfter 归一化');
  });

  it('只认严格 true：字符串/数字等模糊值按关闭处理', () => {
    // switch: features.maintenance.enabled
    for (const value of ['true', 1, 'yes', null, 0]) {
      assert.strictEqual(
        maintenanceWorkerConfig({ maintenance: { enabled: value } }).enabled,
        false,
        JSON.stringify(value) + ' 不得开启维护模式'
      );
    }
  });

  it('extractWorkerSecurity 把 enabled 一并写入 Worker 配置（同一条数据通路）', () => {
    // switch: features.maintenance.enabled
    const on = extractWorkerSecurity({ headers: {} }, null, { maintenance: { enabled: true } });
    const off = extractWorkerSecurity({ headers: {} }, null, { maintenance: { enabled: false } });
    assert.deepStrictEqual(on.maintenance, { enabled: true, message: '', messageEn: '', status: 503, setRetryAfter: true, retryAfter: 3600 });
    assert.deepStrictEqual(off.maintenance, { enabled: false, message: '', messageEn: '', status: 503, setRetryAfter: true, retryAfter: 3600 });
  });

  it('message 缺键投影为空串（运行时回退内置文案）；配置值原样透传', () => {
    // switch: features.maintenance.message
    assert.strictEqual(maintenanceWorkerConfig({}).message, '', '缺键必须是空串，才能让运行时用内置文案');
    assert.strictEqual(maintenanceWorkerConfig({ maintenance: { message: '' } }).message, '', '显式空串与缺键等价');
    const configured = maintenanceWorkerConfig({ maintenance: { message: '系统升级，凌晨 2 点恢复。' } });
    assert.strictEqual(configured.message, '系统升级，凌晨 2 点恢复。');
    assert.strictEqual(configured.messageEn, '', '只配 message 时英文仍为空串');
  });

  it('messageEn 缺键投影为空串；双态产生不同配置', () => {
    // switch: features.maintenance.messageEn
    const off = maintenanceWorkerConfig({ maintenance: { message: '中文文案' } });
    const on = maintenanceWorkerConfig({ maintenance: { message: '中文文案', messageEn: 'Back at 2am UTC.' } });
    assert.strictEqual(off.messageEn, '');
    assert.strictEqual(on.messageEn, 'Back at 2am UTC.');
    assert.notDeepStrictEqual(on, off, '两种取值必须产生可区分的 Worker 配置');
  });

  it('message/messageEn 的非字符串值按未配置处理（不得把对象拼进 HTML）', () => {
    // switch: features.maintenance.message, features.maintenance.messageEn
    const bad = maintenanceWorkerConfig({ maintenance: { message: 123, messageEn: { text: 'x' } } });
    assert.strictEqual(bad.message, '');
    assert.strictEqual(bad.messageEn, '');
  });

  it('status 只接受 400–599 整数，其余回退 503（含「300/200 会让维护页看起来正常」）', () => {
    // switch: features.maintenance.status
    assert.strictEqual(maintenanceWorkerConfig({}).status, 503, '缺键回退 503');
    for (const ok of [502, 500, 400, 599]) {
      assert.strictEqual(maintenanceWorkerConfig({ maintenance: { status: ok } }).status, ok, ok + ' 应原样透传');
    }
    assert.notStrictEqual(
      maintenanceWorkerConfig({ maintenance: { status: 502 } }).status,
      maintenanceWorkerConfig({ maintenance: { status: 503 } }).status,
      '双态必须产生不同状态码'
    );
    for (const bad of [200, 301, 399, 600, 503.5, 'abc', null, undefined, true]) {
      assert.strictEqual(
        maintenanceWorkerConfig({ maintenance: { status: bad } }).status,
        503,
        JSON.stringify(bad) + ' 必须回退 503'
      );
    }
    // 数字字符串与 Worker 侧归一化规则一致（Number() 后校验），不制造两侧行为差异。
    assert.strictEqual(maintenanceWorkerConfig({ maintenance: { status: '502' } }).status, 502);
  });
});

// ---- 2. Worker 运行时 ------------------------------------------------------

describe('security-worker 维护态：features.maintenance.enabled 与环境变量取或', () => {
  let onWorker = null;
  let offWorker = null;
  let cleanups = [];

  before(async () => {
    const on = await loadWorkerWith({ enabled: true, setRetryAfter: true, retryAfter: 77 });
    const off = await loadWorkerWith({ enabled: false, setRetryAfter: true, retryAfter: 77 });
    onWorker = on.worker;
    offWorker = off.worker;
    cleanups = [on.cleanup, off.cleanup];
  });

  after(() => {
    for (const fn of cleanups) { try { fn(); } catch (e) { /* 忽略清理失败 */ } }
    cleanups = [];
  });

  it('enabled=true 且无 MAINTENANCE 环境变量 → 503 维护页（含配置的 Retry-After）', async () => {
    // switch: features.maintenance.enabled
    const res = await onWorker.fetch(req('https://example.com/zh/'), makeEnv());
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.headers.get('Retry-After'), '77', '维护响应的秒数仍来自 features.maintenance.retryAfter');
    assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');
    const body = await res.text();
    assert.ok(body.includes('本站正在维护中，请稍后再来。'), '默认中文文案保持');
    assert.ok(body.includes('<h1>维护中</h1>'), '默认中文标题保持');
  });

  it('enabled=false 且无环境变量 → 正常服务（既有行为不变）', async () => {
    // switch: features.maintenance.enabled
    const res = await offWorker.fetch(req('https://example.com/zh/'), makeEnv());
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('X-Frame-Options'), 'DENY', '正常响应仍应带上安全头');
    assert.strictEqual(await res.text(), '<html>ok</html>');
  });

  it('enabled=false 但 MAINTENANCE=1 → 仍进入维护态（环境变量可单独开启）', async () => {
    // switch: features.maintenance.enabled
    const res = await offWorker.fetch(req('https://example.com/zh/'), makeEnv({ MAINTENANCE: '1' }));
    assert.strictEqual(res.status, 503);
    assert.ok((await res.text()).includes('本站正在维护中，请稍后再来。'));
  });

  it('enabled=true 时 Accept-Language 与 MAINTENANCE_MESSAGE 行为不变', async () => {
    // switch: features.maintenance.enabled
    const en = await onWorker.fetch(
      req('https://example.com/zh/', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }),
      makeEnv()
    );
    const enBody = await en.text();
    assert.strictEqual(en.status, 503);
    assert.ok(enBody.includes('<h1>Maintenance</h1>'), 'en-US 应返回英文标题');
    assert.ok(enBody.includes('The site is under maintenance. Please check back later.'));

    const custom = await onWorker.fetch(
      req('https://example.com/zh/'),
      makeEnv({ MAINTENANCE_MESSAGE: '<img src=x onerror=alert(1)>' })
    );
    const customBody = await custom.text();
    assert.ok(customBody.includes('&lt;img src=x onerror=alert(1)&gt;'), '自定义文案必须转义');
    assert.ok(!customBody.includes('<img src=x'), '不得原样注入标签');
  });

  it('enabled=true 且 setRetryAfter=false → 不输出 Retry-After（既有开关不被破坏）', async () => {
    // switch: features.maintenance.enabled
    const res = await loadWorkerWith({ enabled: true, setRetryAfter: false, retryAfter: 77 });
    try {
      const r = await res.worker.fetch(req('https://example.com/zh/'), makeEnv());
      assert.strictEqual(r.status, 503);
      assert.strictEqual(r.headers.get('Retry-After'), null);
    } finally {
      res.cleanup();
    }
  });

  it('无环境变量时使用配置 message（内置文案被取代，且 HTML 转义）', async () => {
    // switch: features.maintenance.message, features.maintenance.messageEn
    // messageEn 留空：按 features.json5 语义「空 = 回退中文」，故 en* 请求也得到该中文文案。
    const res = await loadWorkerWith({ enabled: true, message: '系统升级中 <b>30 分钟</b> 后恢复。' });
    try {
      const zh = await res.worker.fetch(req('https://example.com/zh/'), makeEnv());
      const zhBody = await zh.text();
      assert.strictEqual(zh.status, 503);
      assert.ok(zhBody.includes('系统升级中 &lt;b&gt;30 分钟&lt;/b&gt; 后恢复。'), '配置文案必须转义后输出');
      assert.ok(!zhBody.includes('<b>30 分钟</b>'), '配置文案不得注入原始标签');
      assert.ok(!zhBody.includes('本站正在维护中，请稍后再来。'), '配置文案应取代内置中文文案');

      const en = await res.worker.fetch(
        req('https://example.com/zh/', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }),
        makeEnv()
      );
      const enBody = await en.text();
      assert.ok(enBody.includes('系统升级中'), 'messageEn 为空时应回退 message（features.json5 语义）');
      assert.ok(!enBody.includes('The site is under maintenance. Please check back later.'), '内置英文文案不得出现');
    } finally {
      res.cleanup();
    }
  });

  it('messageEn 在 en* 请求下生效；MAINTENANCE_MESSAGE 对两种语言都优先', async () => {
    // switch: features.maintenance.message, features.maintenance.messageEn
    const res = await loadWorkerWith({ enabled: true, message: '中文配置文案', messageEn: 'English config notice' });
    try {
      const zh = await res.worker.fetch(req('https://example.com/zh/'), makeEnv());
      const zhBody = await zh.text();
      assert.ok(zhBody.includes('中文配置文案'));
      assert.ok(!zhBody.includes('English config notice'), '非 en 请求不得使用 messageEn');

      const en = await res.worker.fetch(
        req('https://example.com/zh/', { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }),
        makeEnv()
      );
      const enBody = await en.text();
      assert.ok(enBody.includes('English config notice'), 'en* 请求应选 messageEn');
      assert.ok(!enBody.includes('中文配置文案'), 'en* 请求不得退用中文 message');
      assert.ok(enBody.includes('<h1>Maintenance</h1>'), '标题仍按 Accept-Language 选择');

      const envWin = await res.worker.fetch(
        req('https://example.com/zh/', { headers: { 'Accept-Language': 'en-US' } }),
        makeEnv({ MAINTENANCE_MESSAGE: '运维临时通知' })
      );
      const envWinBody = await envWin.text();
      assert.ok(envWinBody.includes('运维临时通知'), '环境变量优先级最高');
      assert.ok(!envWinBody.includes('English config notice'));
    } finally {
      res.cleanup();
    }
  });

  it('配置 status 生效（502）；运行时对非法状态码回退 503', async () => {
    // switch: features.maintenance.status
    const ok = await loadWorkerWith({ enabled: true, status: 502 });
    try {
      const res = await ok.worker.fetch(req('https://example.com/zh/'), makeEnv());
      assert.strictEqual(res.status, 502);
      assert.ok((await res.text()).includes('本站正在维护中，请稍后再来。'), '状态码变化不得影响文案');
    } finally {
      ok.cleanup();
    }
    // 手写的 security-config.js 若把 status 写成 200/301，维护页不得变成「正常」或跳转。
    for (const bad of [200, 301, 600, 'abc']) {
      const badWorker = await loadWorkerWith({ enabled: true, status: bad });
      try {
        const res = await badWorker.worker.fetch(req('https://example.com/zh/'), makeEnv());
        assert.strictEqual(res.status, 503, String(bad) + ' 必须回退 503');
      } finally {
        badWorker.cleanup();
      }
    }
  });
});

// ---- 3. 本地 serve --------------------------------------------------------

describe('serve --maintenance 等价：features.maintenance.enabled 也能进维护页', () => {
  const { createServeModule } = require('./build/serve.js');

  function makeDist() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-maint-serve-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body>home</body></html>', 'utf8');
    return dir;
  }

  function request(port, urlPath) {
    return new Promise((resolve, reject) => {
      const r = http.get({ host: '127.0.0.1', port, path: urlPath, agent: false }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      });
      r.on('error', reject);
    });
  }

  async function startWith(maintenance, siteLanguage) {
    const distDir = makeDist();
    const config = {
      site: { language: siteLanguage || 'zh-CN' },
      theme: { colors: { background: '#ffffff', text: '#111111', textSecondary: '#555555' } },
      features: { maintenance: maintenance }
    };
    const server = createServeModule({ distDir }).startServer(config, { port: 0 });
    await new Promise((resolve) => { server.listening ? resolve() : server.once('listening', resolve); });
    return { server, distDir, port: server.address().port };
  }

  const savedMaint = process.env.MAINTENANCE;
  before(() => { delete process.env.MAINTENANCE; });
  after(() => {
    if (savedMaint === undefined) delete process.env.MAINTENANCE;
    else process.env.MAINTENANCE = savedMaint;
  });

  it('enabled=true 且无参数/环境变量 → 503 维护页', async (t) => {
    // switch: features.maintenance.enabled
    const s = await startWith({ enabled: true, setRetryAfter: true, retryAfter: 45 });
    t.after(() => { s.server.close(); fs.rmSync(s.distDir, { recursive: true, force: true }); });
    const res = await request(s.port, '/');
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.headers['retry-after'], '45');
    assert.ok(res.body.includes('维护中'), '应返回维护页而不是首页');
    assert.ok(!res.body.includes('home'));
  });

  it('enabled=false 且无参数/环境变量 → 正常响应（默认不进入维护态）', async (t) => {
    // switch: features.maintenance.enabled
    const s = await startWith({ enabled: false });
    t.after(() => { s.server.close(); fs.rmSync(s.distDir, { recursive: true, force: true }); });
    const res = await request(s.port, '/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('home'));
  });

  it('enabled=false 但 MAINTENANCE=1 → 仍进入维护态（环境变量保留独立开关）', async (t) => {
    // switch: features.maintenance.enabled
    // serve 在 startServer() 时读一次环境变量，故必须在启动前设置。
    process.env.MAINTENANCE = '1';
    let s;
    try {
      s = await startWith({ enabled: false });
    } finally {
      delete process.env.MAINTENANCE;
    }
    t.after(() => { s.server.close(); fs.rmSync(s.distDir, { recursive: true, force: true }); });
    const res = await request(s.port, '/');
    assert.strictEqual(res.status, 503);
    assert.ok(res.body.includes('维护中'));
  });

  it('无环境变量时使用配置 message（内置中文文案被取代，且转义）', async (t) => {
    // switch: features.maintenance.message
    const s = await startWith({ enabled: true, message: '计划维护 <b>凌晨 2 点</b> 恢复' });
    t.after(() => { s.server.close(); fs.rmSync(s.distDir, { recursive: true, force: true }); });
    const res = await request(s.port, '/');
    assert.strictEqual(res.status, 503);
    assert.ok(res.body.includes('计划维护 &lt;b&gt;凌晨 2 点&lt;/b&gt; 恢复'), '配置文案必须转义');
    assert.ok(!res.body.includes('<b>凌晨 2 点</b>'), '不得原样注入标签');
    assert.ok(!res.body.includes('本站正在维护中，请稍后再来。'), '配置文案应取代内置文案');
  });

  it('站点语言为 en 时优先 messageEn；messageEn 为空回退 message', async (t) => {
    // switch: features.maintenance.message, features.maintenance.messageEn
    const enSite = await startWith({ enabled: true, message: '中文配置文案', messageEn: 'English config notice' }, 'en-US');
    t.after(() => { enSite.server.close(); fs.rmSync(enSite.distDir, { recursive: true, force: true }); });
    const enRes = await request(enSite.port, '/');
    assert.ok(enRes.body.includes('English config notice'), 'en 站点应选 messageEn');
    assert.ok(!enRes.body.includes('中文配置文案'));

    const emptyEn = await startWith({ enabled: true, message: '中文配置文案', messageEn: '' }, 'en-US');
    t.after(() => { emptyEn.server.close(); fs.rmSync(emptyEn.distDir, { recursive: true, force: true }); });
    const fallbackRes = await request(emptyEn.port, '/');
    assert.ok(fallbackRes.body.includes('中文配置文案'), 'messageEn 为空时回退 message');

    const zhSite = await startWith({ enabled: true, message: '中文配置文案', messageEn: 'English config notice' }, 'zh-CN');
    t.after(() => { zhSite.server.close(); fs.rmSync(zhSite.distDir, { recursive: true, force: true }); });
    const zhRes = await request(zhSite.port, '/');
    assert.ok(zhRes.body.includes('中文配置文案'));
    assert.ok(!zhRes.body.includes('English config notice'), 'zh 站点不得使用 messageEn');
  });

  it('MAINTENANCE_MESSAGE 环境变量优先于配置文案', async (t) => {
    // switch: features.maintenance.message
    process.env.MAINTENANCE_MESSAGE = '运维临时通知';
    let s;
    try {
      s = await startWith({ enabled: true, message: '中文配置文案' });
    } finally {
      delete process.env.MAINTENANCE_MESSAGE;
    }
    t.after(() => { s.server.close(); fs.rmSync(s.distDir, { recursive: true, force: true }); });
    const res = await request(s.port, '/');
    assert.ok(res.body.includes('运维临时通知'), '环境变量优先级最高');
    assert.ok(!res.body.includes('中文配置文案'));
  });

  it('配置 status 生效（502）；非法状态码回退 503', async (t) => {
    // switch: features.maintenance.status
    const s502 = await startWith({ enabled: true, status: 502 });
    t.after(() => { s502.server.close(); fs.rmSync(s502.distDir, { recursive: true, force: true }); });
    assert.strictEqual((await request(s502.port, '/')).status, 502);

    const s200 = await startWith({ enabled: true, status: 200 });
    t.after(() => { s200.server.close(); fs.rmSync(s200.distDir, { recursive: true, force: true }); });
    assert.strictEqual((await request(s200.port, '/')).status, 503, '200 不得让维护页变成「正常」');

    const sBad = await startWith({ enabled: true, status: 'abc' });
    t.after(() => { sBad.server.close(); fs.rmSync(sBad.distDir, { recursive: true, force: true }); });
    assert.strictEqual((await request(sBad.port, '/')).status, 503);
  });
});
