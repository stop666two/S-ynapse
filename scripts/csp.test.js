// csp.test.js —— CSP 指令构建期裁剪单元测试（TDD：先红后绿）
// 覆盖：按 giscus/Web Analytics/一言 API 开关与 externalAssets 引用关系自动移除未使用域名、
// 空指令剔除、不修改原对象；并直接断言 buildCspTrimContext 的二态推导（构建层接线）。
const { test } = require('node:test');
const assert = require('node:assert');
const { trimCspDirectives } = require('./lib/csp');
const { createSecurityFilesModule } = require('./build/security-files');

const GISCUS = 'https://giscus.app';
const JSDELIVR = 'https://cdn.jsdelivr.net';
const GFONTS = 'https://fonts.googleapis.com';
const GSTATIC = 'https://fonts.gstatic.com';
const HITOKOTO = 'https://v1.hitokoto.cn';

function baseDirectives() {
  return {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'inline-speculation-rules'", JSDELIVR, 'https://static.cloudflareinsights.com', GISCUS],
    'style-src': ["'self'", "'unsafe-inline'", GFONTS, JSDELIVR],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", GSTATIC, JSDELIVR],
    'connect-src': ["'self'", 'https://cloudflareinsights.com'],
    'object-src': ["'none'"],
    'frame-src': [GISCUS]
  };
}

const OFF_CTX = { giscusNeeded: false, externalAssets: {} };

test('关闭 giscus 且无外链资源时移除全部可选域名并删除空指令', () => {
  const out = trimCspDirectives(baseDirectives(), OFF_CTX);
  const all = JSON.stringify(out);
  assert.ok(!all.includes(GISCUS), 'giscus 应被移除');
  assert.ok(!all.includes(JSDELIVR), 'jsdelivr 应被移除');
  assert.ok(!all.includes(GFONTS), 'googleapis 应被移除');
  assert.ok(!all.includes(GSTATIC), 'gstatic 应被移除');
  assert.ok(!('frame-src' in out), '空的 frame-src 应整条删除');
  assert.ok(!all.includes('cloudflareinsights'), 'Cloudflare 统计域名默认应被移除（未启用/未配置 token）');
  assert.deepStrictEqual(out['connect-src'], ["'self'"], 'connect-src 移除统计域名后仅余自身');
  assert.deepStrictEqual(out['default-src'], ["'self'"], '基础指令不受影响');
});

test('启用 giscus 时保留 giscus.app（script-src 与 frame-src）', () => {
  const out = trimCspDirectives(baseDirectives(), { giscusNeeded: true, externalAssets: {} });
  assert.ok(out['script-src'].includes(GISCUS));
  assert.deepStrictEqual(out['frame-src'], [GISCUS]);
});

test('启用 Web Analytics（analyticsNeeded）时保留 Cloudflare 统计域名', () => {
  const out = trimCspDirectives(baseDirectives(), { giscusNeeded: false, externalAssets: {}, analyticsNeeded: true });
  assert.ok(out['script-src'].includes('https://static.cloudflareinsights.com'), 'script-src 保留静态统计域名');
  assert.ok(out['connect-src'].includes('https://cloudflareinsights.com'), 'connect-src 保留上报域名');
});

test('externalAssets.styles 引用 Google Fonts 时保留两个字体域名', () => {
  const ctx = { giscusNeeded: false, externalAssets: { styles: ['https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap'] } };
  const out = trimCspDirectives(baseDirectives(), ctx);
  assert.ok(out['style-src'].includes(GFONTS), 'style-src 保留 googleapis');
  assert.ok(out['font-src'].includes(GSTATIC), 'font-src 保留 gstatic');
});

test('仅 fontPreloads 引用 gstatic 时保留 gstatic、移除 googleapis', () => {
  const ctx = { giscusNeeded: false, externalAssets: { fontPreloads: ['https://fonts.gstatic.com/s/notosanssc/x.woff2'] } };
  const out = trimCspDirectives(baseDirectives(), ctx);
  assert.ok(out['font-src'].includes(GSTATIC));
  assert.ok(!out['style-src'].includes(GFONTS));
});

test('externalAssets.scripts 引用 jsdelivr 时保留 jsdelivr（含子路径）', () => {
  const ctx = { giscusNeeded: false, externalAssets: { scripts: ['https://cdn.jsdelivr.net/npm/foo@1/dist/foo.js'] } };
  const out = trimCspDirectives(baseDirectives(), ctx);
  assert.ok(out['script-src'].includes(JSDELIVR));
  assert.ok(out['style-src'].includes(JSDELIVR));
  assert.ok(out['font-src'].includes(JSDELIVR));
});

test('externalAssets 对象形式（SRI）同样参与域名保留判定', () => {
  const ctx = { giscusNeeded: false, externalAssets: {
    styles: [{ href: 'https://cdn.jsdelivr.net/npm/x.css', integrity: 'sha384-x', crossorigin: 'anonymous' }],
    scripts: [{ src: 'https://fonts.googleapis.com/x.js' }]
  } };
  const out = trimCspDirectives(baseDirectives(), ctx);
  assert.ok(out['style-src'].includes(JSDELIVR), '对象形式 styles 应保留 jsdelivr');
  assert.ok(out['style-src'].includes(GFONTS), '对象形式 scripts 应保留 googleapis');
  assert.ok(out['font-src'].includes(GSTATIC), 'googleapis 隐含保留 gstatic');
});

test('不修改传入的原始对象（纯函数）', () => {
  const input = baseDirectives();
  const snapshot = JSON.stringify(input);
  trimCspDirectives(input, OFF_CTX);
  assert.strictEqual(JSON.stringify(input), snapshot, '原对象必须保持不变');
});

test('缺失 context 视为全部关闭（最严格）', () => {
  const out = trimCspDirectives(baseDirectives(), undefined);
  const all = JSON.stringify(out);
  assert.ok(!all.includes(GISCUS) && !all.includes(JSDELIVR) && !all.includes(GFONTS) && !all.includes(GSTATIC));
});

test('启用一言（hitokotoNeeded）时保留 v1.hitokoto.cn，关闭时移除', () => {
  const withDomain = baseDirectives();
  withDomain['connect-src'] = ["'self'", 'https://cloudflareinsights.com', HITOKOTO];
  const on = trimCspDirectives(withDomain, { giscusNeeded: false, externalAssets: {}, hitokotoNeeded: true });
  assert.ok(on['connect-src'].includes(HITOKOTO), '开启时 connect-src 必须保留一言域名');
  const off = trimCspDirectives(withDomain, { giscusNeeded: false, externalAssets: {} });
  assert.ok(!off['connect-src'].includes(HITOKOTO), '关闭时 connect-src 必须移除一言域名');
  assert.deepStrictEqual(off['connect-src'], ["'self'"], '移除后仅余自身（统计域名亦未启用）');
  assert.ok(JSON.stringify(trimCspDirectives(withDomain, undefined)).includes(HITOKOTO) === false, '缺省 context 视为关闭');
});

test('buildCspTrimContext：一言开关二态推导（总开关与 api 子开关）', () => {
  const mod = createSecurityFilesModule({});
  const enabled = mod.buildCspTrimContext({ site: {}, features: { dailyQuote: { enabled: true, api: { enabled: true } } }, theme: {} });
  assert.strictEqual(enabled.hitokotoNeeded, true, '总开关与 api 均开 → 保留域名');
  const quoteOff = mod.buildCspTrimContext({ site: {}, features: { dailyQuote: { enabled: false, api: { enabled: true } } }, theme: {} });
  assert.strictEqual(quoteOff.hitokotoNeeded, false, 'dailyQuote 总开关关闭 → 裁剪');
  const apiOff = mod.buildCspTrimContext({ site: {}, features: { dailyQuote: { enabled: true, api: { enabled: false } } }, theme: {} });
  assert.strictEqual(apiOff.hitokotoNeeded, false, 'api.enabled=false → 裁剪');
  const missing = mod.buildCspTrimContext({ site: {}, features: {}, theme: {} });
  assert.strictEqual(missing.hitokotoNeeded, true, '未显式关闭时默认保留（与 features 默认开启一致）');
});
