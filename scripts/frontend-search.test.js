'use strict';
// / 回归：搜索结果点击必须关闭搜索浮层（软导航不再整页刷新）；搜索历史非数组值不得让搜索失效。
// js/domains/features/search.js 有相对导入（./search-core.js），按 file URL 动态导入，复用同一份源码。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const load = () => import(pathToFileURL(path.join(ROOT, 'js', 'domains', 'features', 'search.js')).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function classList(initial) {
  const set = new Set(initial || []);
  return { add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c) };
}

// 最小 DOM：覆盖 search.init() 读取的节点与监听注册；querySelector 一律 null（无 .search-close 等）。
function installDom(opts) {
  const o = opts || {};
  const state = {
    store: o.store || {},
    docClicks: [],
    overlay: { classList: classList(o.overlayOpen ? ['open'] : []), addEventListener() {} },
    input: { value: '', hidden: false, addEventListener() {} },
    results: { classList: classList(), innerHTML: '', childNodes: [], appendChild(n) { this.childNodes.push(n); } }
  };
  global.localStorage = {
    getItem: (k) => (k in state.store ? state.store[k] : null),
    setItem: (k, v) => { state.store[k] = String(v); },
    removeItem: (k) => { delete state.store[k]; }
  };
  global.window = {
    __TUNING__: { search: { debounceMs: 0, minQueryLength: 1 } },
    __FEATURES__: {
      search: { showHistoryOnFocus: false },
      hotSearches: { enabled: true, storageKey: 's-history' },
      pagefind: { indexPath: '/pagefind' }
    },
    __SEARCH_PROVIDER__: 'local',
    __I18N__: {},
    __T: (k, d) => d || k,
    langOf: () => 'zh',
    localStorage: global.localStorage,
    addEventListener() {}
  };
  global.__T = global.window.__T;
  global.document = {
    addEventListener(type, fn) { if (type === 'click') state.docClicks.push(fn); },
    getElementById(id) {
      if (id === 'searchOverlay') return state.overlay;
      if (id === 'searchInput') return state.input;
      if (id === 'searchResults') return state.results;
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) {
      return {
        tagName: tag, className: '', textContent: '', innerHTML: '',
        appendChild() {}, setAttribute() {}, addEventListener() {}
      };
    }
  };
  return state;
}

test('点击搜索结果必须关闭搜索浮层', async () => {
  const state = installDom({ overlayOpen: true });
  const { init } = await load();
  init();
  assert.ok(state.docClicks.length > 0, '必须注册文档级委托：软导航不会整页刷新，浮层需在该路径关闭');
  const item = { closest: (sel) => (sel === '.search-result-item' ? item : null) };
  state.docClicks.forEach((fn) => fn({ target: item }));
  assert.strictEqual(state.overlay.classList.contains('open'), false, '点击结果后浮层必须关闭');
});

test('历史存储为非数组 JSON 时搜索仍可用且历史被规范化', async () => {
  const state = installDom({ store: { 's-history': '{"a":1}' } });
  const { init } = await load();
  init();
  global.window.doSearch('x');
  await sleep(30);
  const stored = JSON.parse(state.store['s-history']);
  assert.ok(Array.isArray(stored), '历史必须被规范化为数组（旧实现 .filter 抛 TypeError 使搜索静默失效）');
  assert.deepStrictEqual(stored, ['x']);
});
