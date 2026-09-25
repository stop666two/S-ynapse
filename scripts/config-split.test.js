const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildRuntimeConfig, configUrlName, CRITICAL_MAX_BYTES } = require('./lib/config-split');

function makeSources(overrides) {
  const base = {
    features: { guards: { enabled: true, preset: 'soft' }, codeBlock: { enabled: true } },
    tuning: { motion: { durationMs: 200 } },
    guard: { core: { preset: 'soft' } },
    morphIcons: { enabled: true, vendorPath: '/assets/vendor/morphicons' },
    presets: [{ id: 'default', label: '默认' }],
    quotes: [{ text: '认识你自己。', author: '苏格拉底' }],
    uiStrings: { common: { loading: '加载中…' } },
    linkWarning: { enabled: true, message: '即将离开本站' },
    pwa: { enabled: true, serviceWorker: '/sw.js' },
    siteTitle: 'S-ynapse'
  };
  return Object.assign({}, base, overrides || {});
}

describe('config-split buildRuntimeConfig', () => {
  it('external 承载全部外置运行时键且与来源一致', () => {
    const src = makeSources();
    const { external } = buildRuntimeConfig(src);
    assert.deepStrictEqual(Object.keys(external).sort(), [
      'features', 'guard', 'i18n', 'linkWarning', 'morphIcons', 'presets', 'pwa', 'quotes', 'tuning'
    ]);
    assert.strictEqual(external.features, src.features);
    assert.strictEqual(external.tuning, src.tuning);
    assert.strictEqual(external.guard, src.guard);
    assert.strictEqual(external.morphIcons, src.morphIcons);
    assert.strictEqual(external.presets, src.presets);
    assert.strictEqual(external.quotes, src.quotes);
    assert.strictEqual(external.i18n, src.uiStrings);
    assert.strictEqual(external.linkWarning, src.linkWarning);
    assert.strictEqual(external.pwa, src.pwa);
  });

  it('external 不包含逐页内联键（siteTitle/searchProvider/artTitle）', () => {
    const { external } = buildRuntimeConfig(makeSources({ artTitle: '文章标题', searchProvider: 'local' }));
    assert.ok(!Object.prototype.hasOwnProperty.call(external, 'siteTitle'), 'siteTitle 必须继续内联');
    assert.ok(!Object.prototype.hasOwnProperty.call(external, 'artTitle'), 'artTitle 必须继续内联');
    assert.ok(!Object.prototype.hasOwnProperty.call(external, 'searchProvider'), 'searchProvider 必须继续内联');
  });

  it('guard 缺省行为：未提供或未启用时 external 不含 guard 键', () => {
    const noGuard = buildRuntimeConfig(makeSources({ guard: undefined })).external;
    assert.ok(!Object.prototype.hasOwnProperty.call(noGuard, 'guard'));

    const disabled = buildRuntimeConfig(makeSources({
      features: { guards: { enabled: false, preset: 'off' } }
    })).external;
    assert.ok(!Object.prototype.hasOwnProperty.call(disabled, 'guard'));

    const noFlags = buildRuntimeConfig(makeSources({ features: {} })).external;
    assert.ok(!Object.prototype.hasOwnProperty.call(noFlags, 'guard'));
  });

  it('guard 启用且提供配置时才外置 guard', () => {
    const src = makeSources();
    const { external } = buildRuntimeConfig(src);
    assert.strictEqual(external.guard, src.guard);
    const enabledNoGuard = buildRuntimeConfig(makeSources({ guard: undefined })).external;
    assert.ok(!Object.prototype.hasOwnProperty.call(enabledNoGuard, 'guard'));
  });

  it('critical 仅含降级最小子集且 ≤2048 字节', () => {
    const { critical } = buildRuntimeConfig(makeSources());
    assert.deepStrictEqual(Object.keys(critical).sort(), ['features', 'pwa']);
    assert.deepStrictEqual(Object.keys(critical.features), ['guards']);
    assert.deepStrictEqual(critical.features.guards, { enabled: true, preset: 'soft' });
    assert.deepStrictEqual(critical.pwa, { enabled: true, serviceWorker: '/sw.js' });
    assert.ok(Buffer.byteLength(JSON.stringify(critical), 'utf8') <= CRITICAL_MAX_BYTES);
    assert.strictEqual(CRITICAL_MAX_BYTES, 2048);
  });

  it('critical 不携带任何大配置载荷（features/tuning/presets/quotes/i18n）', () => {
    const src = makeSources({
      features: {
        guards: { enabled: true },
        codeBlock: { payload: 'FEATURE-PAYLOAD-MARKER'.repeat(2000) }
      },
      tuning: { payload: 'TUNING-PAYLOAD-MARKER'.repeat(2000) },
      presets: [{ payload: 'PRESET-PAYLOAD-MARKER'.repeat(2000) }],
      quotes: [{ text: 'QUOTE-PAYLOAD-MARKER'.repeat(2000) }],
      uiStrings: { payload: 'I18N-PAYLOAD-MARKER'.repeat(2000) }
    });
    const { critical } = buildRuntimeConfig(src);
    const serialized = JSON.stringify(critical);
    for (const marker of ['FEATURE-PAYLOAD-MARKER', 'TUNING-PAYLOAD-MARKER', 'PRESET-PAYLOAD-MARKER', 'QUOTE-PAYLOAD-MARKER', 'I18N-PAYLOAD-MARKER']) {
      assert.ok(!serialized.includes(marker), 'critical 不应包含 ' + marker);
    }
    assert.ok(Buffer.byteLength(serialized, 'utf8') <= CRITICAL_MAX_BYTES);
  });

  it('critical 超出 2048 字节时抛错（阻断构建）', () => {
    assert.throws(
      () => buildRuntimeConfig(makeSources({ features: { guards: { preset: 'x'.repeat(3000) } } })),
      /2048/
    );
  });

  it('缺省来源（undefined）也能产出结构完整的 external/critical', () => {
    const { critical, external } = buildRuntimeConfig();
    assert.deepStrictEqual(external.features, undefined);
    assert.deepStrictEqual(critical.features.guards, {});
    assert.deepStrictEqual(critical.pwa, { enabled: false, serviceWorker: '' });
  });
});

describe('config-split configUrlName', () => {
  it('对相同内容稳定且格式为 /assets/config.<10位十六进制>.json', () => {
    const text = JSON.stringify({ a: 1, b: '中文' });
    const name = configUrlName(text);
    assert.match(name, /^\/assets\/config\.[0-9a-f]{10}\.json$/);
    assert.strictEqual(configUrlName(text), name);
  });

  it('内容变化时文件名随之变化（内容寻址）', () => {
    const a = configUrlName(JSON.stringify({ a: 1 }));
    const b = configUrlName(JSON.stringify({ a: 2 }));
    assert.notStrictEqual(a, b);
  });

  it('非法输入抛 TypeError', () => {
    assert.throws(() => configUrlName(null), TypeError);
    assert.throws(() => configUrlName({}), TypeError);
  });
});
