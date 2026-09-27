// guard 绕过通道单测：纯函数判定矩阵 + URL 清洗 + 仓库三处默认值一致性。
// js/domains/guard/bypass.js 为浏览器 ESM 模块，经 data URL 动态导入以复用同一份源码
// （CommonJS 测试文件无法直接 require ESM；data URL 强制按 ESM 解析，无副本）。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const BYPASS_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'guard', 'bypass.js'), 'utf-8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(BYPASS_SOURCE, 'utf-8').toString('base64'));

let loaded = null;
async function load() {
  if (!loaded) loaded = await modulePromise;
  return loaded;
}

function env(overrides) {
  return Object.assign({ search: '', storageValue: '', hostname: 'example.com' }, overrides || {});
}

async function resolve(cfg, overrides) {
  const m = await load();
  return m.resolveGuardBypass(cfg, env(overrides));
}

async function strip(href, cfg) {
  const m = await load();
  return m.stripGuardParams(href, cfg);
}

describe('normalizeGuardBypass 默认与非法值回退', () => {
  it('缺省配置回退内置默认（配置缺失等于历史行为）', async () => {
    const m = await load();
    assert.deepStrictEqual(m.normalizeGuardBypass(undefined), { ...m.GUARD_BYPASS_DEFAULTS });
    assert.deepStrictEqual(m.normalizeGuardBypass(null), { ...m.GUARD_BYPASS_DEFAULTS });
    assert.deepStrictEqual(m.normalizeGuardBypass({}), { ...m.GUARD_BYPASS_DEFAULTS });
  });

  it('布尔开关：显式 false 才关闭、非法类型回退默认', async () => {
    const m = await load();
    const n = m.normalizeGuardBypass({
      enabled: 'no', urlParam: 0, localStorage: 'x', localhost: 1, cleanUrl: [], accessGateKey: 'false'
    });
    assert.strictEqual(n.enabled, true);
    assert.strictEqual(n.urlParam, true);
    assert.strictEqual(n.localStorage, true);
    assert.strictEqual(n.localhost, false);
    assert.strictEqual(n.cleanUrl, true);
    assert.strictEqual(n.accessGateKey, true);
  });

  it('字符串键：queryParam 空串回退默认，storageFlag 空串保留（通道关闭）', async () => {
    const m = await load();
    const n = m.normalizeGuardBypass({ queryParam: '', storageFlag: '', accessGateKey: false });
    assert.strictEqual(n.queryParam, 'guard');
    assert.strictEqual(n.storageFlag, '');
    assert.strictEqual(n.accessGateKey, false);
  });

  it('规范化幂等（重复 normalize 不改变结果）', async () => {
    const m = await load();
    const once = m.normalizeGuardBypass({ urlParam: false, localhost: true, storageFlag: '' });
    assert.deepStrictEqual(m.normalizeGuardBypass(once), once);
  });
});

describe('resolveGuardBypass 通道判定', () => {
  it('无任何信号时不绕过', async () => {
    assert.deepStrictEqual(await resolve(undefined), { bypassed: false, reason: 'none' });
  });

  it('?guard=off 强制绕过，?guard=on 强制开启', async () => {
    assert.deepStrictEqual(await resolve(undefined, { search: '?guard=off' }), { bypassed: true, reason: 'url-off' });
    assert.deepStrictEqual(await resolve(undefined, { search: '?guard=on' }), { bypassed: false, reason: 'url-on' });
  });

  it('参数值经 URL 解码后判定（%6Fff = off）', async () => {
    assert.strictEqual((await resolve(undefined, { search: '?guard=%6Fff' })).bypassed, true);
  });

  it('仅匹配完整参数名（xguard / guardx 不干扰）', async () => {
    assert.strictEqual((await resolve(undefined, { search: '?xguard=off&guardx=on' })).reason, 'none');
  });

  it('urlParam=false 时忽略 URL 参数', async () => {
    assert.deepStrictEqual(await resolve({ urlParam: false }, { search: '?guard=off' }), { bypassed: false, reason: 'none' });
  });

  it('localStorage 值为 1 时绕过，其它值不绕过', async () => {
    assert.deepStrictEqual(await resolve(undefined, { storageValue: '1' }), { bypassed: true, reason: 'storage' });
    assert.strictEqual((await resolve(undefined, { storageValue: '0' })).bypassed, false);
    assert.strictEqual((await resolve(undefined, { storageValue: 'true' })).bypassed, false);
  });

  it('localStorage=false 或 storageFlag 为空时忽略存储通道', async () => {
    assert.strictEqual((await resolve({ localStorage: false }, { storageValue: '1' })).bypassed, false);
    assert.strictEqual((await resolve({ storageFlag: '' }, { storageValue: '1' })).bypassed, false);
  });

  it('localhost=true 时 localhost/127.0.0.1/::1 均绕过', async () => {
    const cfg = { localhost: true };
    for (const hostname of ['localhost', '127.0.0.1', '::1']) {
      assert.deepStrictEqual(await resolve(cfg, { hostname }), { bypassed: true, reason: 'localhost' });
    }
  });

  it('localhost 开关两态：false 不绕过、true 对普通域名不生效', async () => {
    assert.strictEqual((await resolve({ localhost: false }, { hostname: 'localhost' })).bypassed, false);
    assert.strictEqual((await resolve({ localhost: true }, { hostname: 'example.com' })).bypassed, false);
  });
});

describe('resolveGuardBypass 通道优先级', () => {
  it('?guard=on 覆盖一切（storage + localhost 同时命中也不绕过）', async () => {
    assert.deepStrictEqual(
      await resolve({ localhost: true }, { search: '?guard=on', storageValue: '1', hostname: 'localhost' }),
      { bypassed: false, reason: 'url-on' }
    );
  });

  it('?guard=off 覆盖 localStorage 与 localhost（除 on 外）', async () => {
    assert.deepStrictEqual(
      await resolve({ localhost: true }, { search: '?guard=off', storageValue: '1', hostname: 'localhost' }),
      { bypassed: true, reason: 'url-off' }
    );
  });

  it('urlParam=false 时 on 也不生效（参数通道整体关闭）', async () => {
    assert.deepStrictEqual(await resolve({ urlParam: false }, { search: '?guard=on' }), { bypassed: false, reason: 'none' });
  });

  it('enabled=false 时三条通道全部无效', async () => {
    const cfg = { enabled: false, localhost: true };
    assert.deepStrictEqual(await resolve(cfg, { search: '?guard=off' }), { bypassed: false, reason: 'disabled' });
    assert.deepStrictEqual(await resolve(cfg, { storageValue: '1' }), { bypassed: false, reason: 'disabled' });
    assert.deepStrictEqual(await resolve(cfg, { hostname: 'localhost' }), { bypassed: false, reason: 'disabled' });
    assert.deepStrictEqual(await resolve(cfg, { search: '?guard=on', storageValue: '1' }), { bypassed: false, reason: 'disabled' });
  });
});

describe('isAccessGateKeyAllowed 解锁码通道', () => {
  it('默认允许；enabled=false 或 accessGateKey=false 时不允许', async () => {
    const m = await load();
    assert.strictEqual(m.isAccessGateKeyAllowed(undefined), true);
    assert.strictEqual(m.isAccessGateKeyAllowed({ accessGateKey: false }), false);
    assert.strictEqual(m.isAccessGateKeyAllowed({ enabled: false }), false);
    assert.strictEqual(m.isAccessGateKeyAllowed({ enabled: false, accessGateKey: false }), false);
  });
});

describe('stripGuardParams URL 清洗', () => {
  it('cleanUrl=true 删除 guard 参数，保留其它查询串与 hash', async () => {
    assert.deepStrictEqual(
      await strip('https://site.dev/zh/?guard=off&keep=1#top', undefined),
      { href: '/zh/?keep=1#top', changed: true }
    );
  });

  it('cleanUrl=true 同时删除 accessGate 的 key 参数', async () => {
    assert.deepStrictEqual(
      await strip('https://site.dev/zh/?key=secret&guard=on&keep=1', undefined),
      { href: '/zh/?keep=1', changed: true }
    );
  });

  it('cleanUrl=false 原样保留参数（判定结果不变）', async () => {
    assert.deepStrictEqual(
      await strip('https://site.dev/zh/?guard=off&keep=1#top', { cleanUrl: false }),
      { href: 'https://site.dev/zh/?guard=off&keep=1#top', changed: false }
    );
  });

  it('无目标参数或非法 URL 时原样返回', async () => {
    assert.deepStrictEqual(await strip('https://site.dev/zh/?keep=1', undefined), { href: 'https://site.dev/zh/?keep=1', changed: false });
    assert.deepStrictEqual(await strip('not a url', undefined), { href: 'not a url', changed: false });
  });

  it('自定义 queryParam 时清理跟随配置（guard 参数保留）', async () => {
    assert.deepStrictEqual(
      await strip('https://site.dev/zh/?x=off&guard=off', { queryParam: 'x' }),
      { href: '/zh/?guard=off', changed: true }
    );
  });
});

describe('仓库默认值单一事实源', () => {
  it('guard.json5 的 core.bypass 键集合与注册表/内置默认一致', async () => {
    const m = await load();
    const guardCfg = json5.parse(fs.readFileSync(path.join(ROOT, 'guard.json5'), 'utf-8'));
    const registryKeys = Object.keys(require('./lib/guard-defaults.js').DEFAULT_GUARD.core.bypass).sort();
    const configKeys = Object.keys(guardCfg.core.bypass).sort();
    const builtinKeys = Object.keys(m.GUARD_BYPASS_DEFAULTS).sort();
    assert.deepStrictEqual(configKeys, builtinKeys);
    assert.deepStrictEqual(registryKeys, builtinKeys);
  });

  it('guard.json5 的 core.bypass 值与内置默认（配置缺失兜底）逐键一致', async () => {
    const m = await load();
    const guardCfg = json5.parse(fs.readFileSync(path.join(ROOT, 'guard.json5'), 'utf-8'));
    assert.deepStrictEqual(m.normalizeGuardBypass(guardCfg.core.bypass), { ...m.GUARD_BYPASS_DEFAULTS });
  });
});
