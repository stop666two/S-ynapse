'use strict';
// 2G 性能：引语载荷外置回归。
//   1) 构建期：buildRuntimeConfig 不再把 quotes 放进启动配置，改为 /assets/quotes.<hash>.json
//      + external.quotesUrl；文件内容与归一化结果逐条一致；载荷独立落盘。
//   2) 体积：主配置 raw/gzip 都减少约等于引语本身的序列化字节。
//   3) 运行时：js/domains/features/daily-quote.js 首次 init 只请求一次 quotesUrl、
//      重复 init 复用 Promise、fetch 失败/缺地址时回退内置最小集且不抛错。
const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const { buildRuntimeConfig, quoteUrlName, writeQuotePayload } = require('./lib/config-split');
const { normalizeQuoteList } = require('./lib/daily-quotes');

const normalizedQuotes = normalizeQuoteList(json5.parse(fs.readFileSync(path.join(ROOT, 'data', 'quotes.json5'), 'utf-8')));
const gzipBytes = (text) => zlib.gzipSync(Buffer.from(String(text), 'utf-8')).length;

function makeSources(overrides) {
  const base = {
    features: { guards: { enabled: true, preset: 'soft' }, codeBlock: { enabled: true }, motion: { revealMs: 320 } },
    tuning: { motion: { durationMs: 200 }, dailyQuote: { showAuthor: 'true' } },
    guard: { core: { preset: 'soft' } },
    morphIcons: { enabled: true, vendorPath: '/assets/vendor/morphicons' },
    presets: [{ id: 'default', label: '默认' }, { id: 'classic-blue', label: '经典蓝' }],
    quotes: normalizedQuotes,
    uiStrings: { common: { loading: '加载中…' } },
    linkWarning: { enabled: true, message: '即将离开本站' },
    pwa: { enabled: true, serviceWorker: '/sw.js' },
    theme: { darkMode: { default: 'auto' } }
  };
  return Object.assign({}, base, overrides || {});
}

describe('引语载荷外置（构建期）', () => {
  it('quotes 不在 external 中；quotesUrl 为内容寻址地址且文件内容与归一化结果逐条一致', () => {
    const { external, quoteFile } = buildRuntimeConfig(makeSources());
    assert.ok(!Object.prototype.hasOwnProperty.call(external, 'quotes'), 'quotes 必须移出启动配置');
    assert.match(external.quotesUrl, /^\/assets\/quotes\.[0-9a-f]{10}\.json$/, 'quotesUrl 必须内容寻址且落在 /assets/');
    assert.strictEqual(quoteFile.url, external.quotesUrl, 'URL 与返回值一致');
    assert.strictEqual(quoteFile.url, quoteUrlName(quoteFile.json), '文件名哈希取自内容');
    assert.deepStrictEqual(JSON.parse(quoteFile.json), normalizedQuotes, '引语文件内容与构建期归一化结果逐条相等');
    assert.strictEqual(normalizedQuotes.length, 100, '默认数据源 100 条');

    // 内容寻址：引语内容变化 → 文件名变化（浏览器可长期缓存旧文件不串味）。
    const changed = buildRuntimeConfig(makeSources({ quotes: normalizedQuotes.slice(0, 99) }));
    assert.notStrictEqual(changed.external.quotesUrl, external.quotesUrl, '引语内容变化必须换名');
  });

  it('其它配置键原样保留；无引语时不产生 quotesUrl', () => {
    const src = makeSources();
    const { external } = buildRuntimeConfig(src);
    for (const key of ['features', 'tuning', 'guard', 'morphIcons', 'presets', 'i18n', 'linkWarning', 'pwa', 'theme']) {
      assert.ok(Object.prototype.hasOwnProperty.call(external, key), '缺少配置键 ' + key);
    }
    assert.strictEqual(external.features, src.features);
    assert.strictEqual(external.tuning, src.tuning);

    const empty = buildRuntimeConfig(makeSources({ quotes: [] }));
    assert.strictEqual(empty.quoteFile, null);
    assert.ok(!Object.prototype.hasOwnProperty.call(empty.external, 'quotesUrl'));
    // 无 quotes 时主配置仍是合法 JSON（可直接被 runtime.js 解析）。
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(empty.external)));
  });

  it('引语文件独立落盘在 <dist>/assets/ 下（cacheBust 排除、SW assetCacheFirst 覆盖）', () => {
    const { quoteFile } = buildRuntimeConfig(makeSources());
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-quotes-'));
    try {
      const written = writeQuotePayload(dir, quoteFile);
      assert.ok(written, '应返回写入路径');
      assert.ok(fs.existsSync(written), '引语文件必须独立存在');
      assert.strictEqual(fs.readFileSync(written, 'utf-8'), quoteFile.json, '写入字节与内容寻址哈希一致');
      const rel = path.relative(dir, written).replace(/\\/g, '/');
      assert.match(rel, /^assets\/quotes\.[0-9a-f]{10}\.json$/, '落在 /assets/ 前缀，运行时由 assetCacheFirst 缓存');
      // 与 config.<hash>.json 同等待遇：内容寻址文件不得被 JSON 去空白步骤重写（会破坏引用一致性）。
      const { jsonSkipReason } = require('./lib/compression-steps');
      assert.strictEqual(jsonSkipReason(rel, []), 'content-addressed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('引语载荷外置（体积）', () => {
  it('拆分后主配置 raw/gzip 减少量≈引语序列化体积，且内容中不含任何引语文本', () => {
    const { external, quoteFile } = buildRuntimeConfig(makeSources());
    const afterJson = JSON.stringify(external);
    const beforeJson = JSON.stringify(Object.assign({}, external, { quotes: normalizedQuotes }));
    const quotesRaw = Buffer.byteLength(quoteFile.json, 'utf-8');

    assert.ok(Buffer.byteLength(afterJson) < Buffer.byteLength(beforeJson), '主配置 raw 必须变小');
    assert.ok(Buffer.byteLength(beforeJson) - Buffer.byteLength(afterJson) >= quotesRaw * 0.9,
      '减少的字节量应约等于引语载荷（含 quotesUrl 少量开销）');
    assert.ok(gzipBytes(afterJson) < gzipBytes(beforeJson), '主配置 gzip 必须变小');
    assert.ok(gzipBytes(beforeJson) - gzipBytes(afterJson) >= gzipBytes(quoteFile.json) * 0.9,
      'gzip 减少量应约等于引语 gzip 体积');
    assert.ok(!afterJson.includes(normalizedQuotes[0].text), '主配置不得残留引语文本');
    assert.ok(gzipBytes(quoteFile.json) > 1024, '引语文件本身是有实际体积的独立载荷');
  });
});

// ---- 运行时：data URL 导入同一份源码，用假 window/document/fetch 驱动 init ----

const QUOTE_MODULE_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'daily-quote.js'), 'utf-8');
const QUOTE_MODULE_URL = 'data:text/javascript;base64,' + Buffer.from(QUOTE_MODULE_SOURCE, 'utf-8').toString('base64');
let moduleSeq = 0;
// 每个场景用独立 fragment 导入，避免模块级 quotesPromise/state 跨用例串味。
function loadQuoteModule() {
  moduleSeq += 1;
  return import(QUOTE_MODULE_URL + '#case-' + moduleSeq);
}

const savedGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  fetch: globalThis.fetch,
  AbortSignal: globalThis.AbortSignal
};

function restoreGlobals() {
  for (const key of Object.keys(savedGlobals)) {
    if (savedGlobals[key] === undefined) delete globalThis[key];
    else globalThis[key] = savedGlobals[key];
  }
}

// 最小 DOM：只需 render() 走通（无侧栏容器 → closest 返回 null，跳过按钮/署名）。
function installDom() {
  const quoteText = {
    textContent: '',
    style: {},
    hidden: false,
    parentNode: null,
    closest: function () { return null; },
    querySelector: function () { return null; },
    setAttribute: function () {},
    removeAttribute: function () {},
    addEventListener: function () {}
  };
  globalThis.document = {
    documentElement: { lang: 'zh', getAttribute: function () { return 'zh'; } },
    getElementById: function (id) { return id === 'quoteText' ? quoteText : null; },
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, remove: function () {}, select: function () {} }; },
    body: { appendChild: function () {} }
  };
  return quoteText;
}

function installWindow(extra) {
  globalThis.window = Object.assign({
    __DEFAULT_LANG__: 'zh',
    __FEATURES__: { dailyQuote: { enabled: true } },
    __TUNING__: { dailyQuote: { refreshDaily: 'false' } },
    __SOFTNAV_HOOKS__: []
  }, extra || {});
  return globalThis.window;
}

function fakeFetch(handler) {
  const calls = [];
  globalThis.fetch = function (url, options) {
    calls.push({ url: url, options: options });
    return handler(url, options, calls.length);
  };
  return calls;
}

const settle = () => new Promise(function (resolve) { setTimeout(resolve, 0); });

// init 必须同步返回 undefined（2G 性能回归防线）：boot.js 的 idle 队列逐个 await init，
// 若把引语网络请求的 Promise 返回出去，后续交互模块会排队等网络。
// 数据在其后自行应用，因此用一次宏任务让 fetch 链（微任务）与 applyPool 全部完成。
async function initAndSettle(mod) {
  const ret = mod.init();
  assert.strictEqual(ret, undefined, 'init 不得返回 Promise（否则阻塞 boot idle 队列）');
  await settle();
}

after(restoreGlobals);

describe('引语载荷外置（运行时按需加载）', () => {
  it('首次 init 只请求 1 次 quotesUrl；二次 init 不重复请求；成功后写入兼容全局', async () => {
    installDom();
    // 去掉 AbortSignal.timeout 的超时计时器，避免测试进程被挂起的定时器拖住。
    globalThis.AbortSignal = undefined;
    const win = installWindow({ __QUOTES_URL__: '/assets/quotes.244b600f8b.json' });
    const payload = normalizedQuotes.slice(0, 3);
    const calls = fakeFetch(function () {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(payload); } });
    });

    const mod = await loadQuoteModule();
    await initAndSettle(mod);
    assert.strictEqual(calls.length, 1, '首次 init 应请求一次 quotesUrl');
    assert.strictEqual(calls[0].url, '/assets/quotes.244b600f8b.json');
    assert.deepStrictEqual(win.__QUOTES__, payload, 'fetch 完成后写入稳定读取入口 window.__QUOTES__');
    assert.strictEqual(win.__SOFTNAV_HOOKS__.length, 1, '软导航 hook 只注册一次');

    await initAndSettle(mod);
    assert.strictEqual(calls.length, 1, '二次 init 必须复用已加载数据，不再发请求');
    assert.strictEqual(win.__SOFTNAV_HOOKS__.length, 1, 'hook 不得重复注册');
  });

  it('fetch 失败时回退内置最小集且不抛错（页面不报错、不卡住）', async () => {
    installDom();
    globalThis.AbortSignal = undefined;
    const win = installWindow({ __QUOTES_URL__: '/assets/quotes.deadbeef00.json' });
    const calls = fakeFetch(function () { return Promise.reject(new Error('2G 断网')); });

    const mod = await loadQuoteModule();
    await initAndSettle(mod);
    assert.strictEqual(calls.length, 1);
    const shown = globalThis.document.getElementById('quoteText').textContent;
    assert.ok(typeof shown === 'string' && shown.length > 0 && shown !== '…', '失败时应显示内置文案，实际：' + shown);
    assert.strictEqual(win.__QUOTES__, undefined, '失败时不得污染兼容全局');

    await initAndSettle(mod);
    assert.strictEqual(calls.length, 1, '失败结果同样缓存，不重复请求');
  });

  it('非 2xx / 空数组同样回退内置文案', async () => {
    installDom();
    globalThis.AbortSignal = undefined;
    installWindow({ __QUOTES_URL__: '/assets/quotes.deadbeef01.json' });
    fakeFetch(function () { return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve([]); } }); });

    const mod = await loadQuoteModule();
    await initAndSettle(mod);
    assert.ok(globalThis.document.getElementById('quoteText').textContent.length > 0);
  });

  it('配置降级（无 quotesUrl）时不发请求，直接显示内置文案', async () => {
    installDom();
    globalThis.AbortSignal = undefined;
    installWindow({});
    const calls = fakeFetch(function () { return Promise.reject(new Error('不应被调用')); });

    const mod = await loadQuoteModule();
    await initAndSettle(mod);
    assert.strictEqual(calls.length, 0, '无 quotesUrl 时不得发出请求');
    assert.ok(globalThis.document.getElementById('quoteText').textContent.length > 0);
  });

  it('兼容：window.__QUOTES__ 已注入时不请求且直接使用（旧内联路径）', async () => {
    installDom();
    globalThis.AbortSignal = undefined;
    const preset = normalizedQuotes.slice(0, 2);
    installWindow({ __QUOTES__: preset, __QUOTES_URL__: '/assets/quotes.ignoreme00.json' });
    const calls = fakeFetch(function () { return Promise.reject(new Error('不应被调用')); });

    const mod = await loadQuoteModule();
    await initAndSettle(mod);
    assert.strictEqual(calls.length, 0);
    assert.ok(globalThis.document.getElementById('quoteText').textContent.length > 0);
  });
});
