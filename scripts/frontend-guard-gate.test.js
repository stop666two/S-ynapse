'use strict';
// R-42 / R-43 回归：accessGate 的 ?key= 解锁码记忆时长独立于 password.rememberHours；
// bypass.localhost 必须识别 IPv6 回环（location.hostname 为 '[::1]'）。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const loadBypass = () => import(pathToFileURL(path.join(ROOT, 'js', 'domains', 'guard', 'bypass.js')).href);
const loadGate = () => import(pathToFileURL(path.join(ROOT, 'js', 'domains', 'guard', 'access-gate.js')).href);

test('R-43 bypass.localhost 对 IPv6 回环 hostname（"[::1]"）同样生效', async () => {
  const m = await loadBypass();
  const base = { search: '', storageValue: '' };
  assert.strictEqual(m.resolveGuardBypass({ localhost: true }, Object.assign({ hostname: '[::1]' }, base)).bypassed, true);
  assert.strictEqual(m.resolveGuardBypass({ localhost: true }, Object.assign({ hostname: '::1' }, base)).bypassed, true);
  assert.strictEqual(m.resolveGuardBypass({ localhost: true }, Object.assign({ hostname: 'localhost' }, base)).bypassed, true);
  assert.strictEqual(m.resolveGuardBypass({ localhost: true }, Object.assign({ hostname: 'example.com' }, base)).bypassed, false);
});

function installGateDom(search, store) {
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  global.location = { pathname: '/zh/private/', search: search, origin: 'https://site.example' };
  global.document = {
    prerendering: false,
    body: { children: [] },
    addEventListener() {},
    querySelector() { return null; },
    getElementById() { return null; },
    createElement() { return { setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} }, addEventListener() {}, remove() {} }; }
  };
  return {
    G: { accessGate: { enabled: true, password: { enabled: true, hash: 'deadbeef', rememberHours: 0 }, unlockCodes: ['secret'] } },
    core: { bypass: {} },
    log() {},
    t: (k, d) => d || k,
    toast() {}
  };
}

test('R-42 ?key= 解锁码默认永久记忆（不受 password.rememberHours=0 影响）', async () => {
  const store = {};
  const ctx = installGateDom('?key=secret', store);
  const gate = await loadGate();
  gate.init(ctx);
  const rec = JSON.parse(store['s-gate-pass']);
  assert.strictEqual(rec.permanent, true, 'rememberHours=0 不得让解锁码立即失效（unlockCodeTtlHours 默认 0 = 永久）');
  assert.strictEqual(rec.exp, undefined, '永久记忆不得写 exp（JSON 无法表达 Infinity）');
});

test('R-42 unlockCodeTtlHours>0 时解锁码按该小时数过期', async () => {
  const store = {};
  const ctx = installGateDom('?key=secret', store);
  ctx.G.accessGate.unlockCodeTtlHours = 2;
  const gate = await loadGate();
  const before = Date.now();
  gate.init(ctx);
  const rec = JSON.parse(store['s-gate-pass']);
  assert.strictEqual(rec.permanent, undefined);
  const delta = rec.exp - before;
  assert.ok(delta > 1.9 * 3600000 && delta <= 2.1 * 3600000, 'exp 应为当前时间 + 2 小时，实际 ' + delta);
});
