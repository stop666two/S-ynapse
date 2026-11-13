'use strict';
// R-20 回归：软导航换到另一语言段后，<html lang> 必须随目标页同步，并重跑 i18n 的翻译通道
// （内容区之外的 aria/title/placeholder 文案与 TTS 选音都以它为语言依据）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const dataUrl = (code) => 'data:text/javascript;base64,' + Buffer.from(code, 'utf-8').toString('base64');

function mkEl(tag) {
  const node = {
    tagName: tag,
    className: '',
    textContent: '',
    value: '',
    attrs: {},
    _children: [],
    innerHTML: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(n) { this._children.push(n); return n; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    focus() {},
    scrollIntoView() {}
  };
  return node;
}

function installGlobals() {
  const html = mkEl('html');
  const body = mkEl('body');
  body.classList = [];
  const navToggle = mkEl('button');
  navToggle.setAttribute('data-i18n-aria', 'nav.menu');
  const curWrap = { innerHTML: '', querySelectorAll: () => [] };
  const nextWrap = { innerHTML: '<p>english body</p>' };
  const newDoc = {
    title: 'EN',
    documentElement: { getAttribute: (n) => (n === 'lang' ? 'en-US' : null) },
    head: { querySelectorAll: () => [] },
    body: { classList: [], getAttribute: () => null },
    querySelector: (sel) => (sel === '.content-wrapper' ? nextWrap : null),
    querySelectorAll: () => []
  };
  const location = { href: 'https://site.example/zh/post/', origin: 'https://site.example', pathname: '/zh/post/', search: '', hash: '' };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.history = {
    pushState(state, title, url) {
      const u = new URL(url, location.href);
      location.pathname = u.pathname;
      location.search = u.search;
      location.hash = u.hash;
      location.href = u.href;
    },
    replaceState() {}
  };
  global.window = {
    location,
    __LANGS__: ['zh', 'en'],
    __LANG_SEG_TEST__: true,
    __langSeg: (p) => (String(p).indexOf('/en/') === 0 ? 'en' : String(p).indexOf('/zh/') === 0 ? 'zh' : ''),
    __I18N__: { nav: { menu: '菜单' }, en: { nav: { menu: 'Menu' } } },
    __SOFTNAV_HOOKS__: [],
    __SOFTNAV_DEFAULTS__: {},
    __FEATURES__: { softNavigation: { enabled: true }, i18n: { enabled: true } },
    __ART_TITLE__: '',
    __T: (k, d) => d || k,
    langOf: () => html.getAttribute('data-lang') || 'zh',
    matchMedia: () => ({ matches: false }),
    scrollTo() {},
    addEventListener() {},
    requestIdleCallback: (cb) => cb()
  };
  global.__T = global.window.__T;
  global.document = {
    documentElement: html,
    body,
    head: { querySelectorAll: () => [] },
    title: 'ZH',
    readyState: 'complete',
    hidden: false,
    querySelector(sel) {
      if (sel === '.content-wrapper') return curWrap;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-i18n-aria]') return [navToggle];
      return [];
    },
    getElementById() { return null; },
    createElement: mkEl,
    addEventListener() {}
  };
  global.DOMParser = function () { this.parseFromString = () => newDoc; };
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/html' },
    text: async () => '<html lang="en-US"></html>'
  });
  return { html, navToggle };
}

test('R-20 软导航切换语言段后同步 <html lang> 并重跑翻译通道', async () => {
  const dom = installGlobals();
  const i18n = await import(dataUrl(src('js/domains/core/i18n.js')));
  const softNav = await import(dataUrl(src('js/core/soft-nav.js')));
  i18n.init();
  softNav.init();
  assert.strictEqual(global.document.documentElement.getAttribute('data-lang'), 'zh');

  global.window.__softNav.navigate('/en/post/');
  await new Promise((r) => setTimeout(r, 30));

  assert.strictEqual(global.document.documentElement.getAttribute('lang'), 'en-US', '<html lang> 必须随目标页更新');
  assert.strictEqual(global.document.documentElement.getAttribute('data-lang'), 'en', '语言状态必须更新');
  assert.strictEqual(dom.navToggle.getAttribute('aria-label'), 'Menu', '内容区之外的 aria 文案必须重新翻译');
});
