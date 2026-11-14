'use strict';
// / 回归：协议相对外链（//host、/\host）必须走外链策略；警告弹窗文案按纯文本渲染。
// js/domains/core/external-link.js 为浏览器 ESM 且无相对导入，经 data URL 动态导入（无副本）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'external-link.js'), 'utf-8');
const load = () => import('data:text/javascript;base64,' + Buffer.from(SRC, 'utf-8').toString('base64'));

function el(extra) {
  const node = {
    tagName: '',
    className: '',
    hidden: true,
    textContent: '',
    childNodes: [],
    _html: null,
    appendChild(n) { this.childNodes.push(n); return n; },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; }
  };
  return Object.assign(node, extra || {});
}

// 最小 DOM：仅覆盖 external-link.init() 读取的接口（getElementById / createElement / click 监听）。
function installDom(message) {
  const state = {
    clicks: [],
    overlay: el(),
    body: el(),
    confirm: el(),
    cancel: el(),
    copy: el(),
    prevented: 0
  };
  // external-link.js 直接引用裸全局 __T（运行时注入），测试里同时挂到 global 与 window。
  global.__T = (k, d) => d || k;
  global.window = {
    location: { href: 'https://site.example/zh/post/', origin: 'https://site.example' },
    __FEATURES__: { externalLink: { enabled: true, mode: 'warn', message: message } },
    __LINK_WARNING__: { enabled: true },
    __T: global.__T,
    langOf: () => 'zh',
    open() { state.opened = true; }
  };
  global.document = {
    addEventListener(type, fn) { if (type === 'click') state.clicks.push(fn); },
    getElementById(id) {
      if (id === 'linkWarningOverlay') return state.overlay;
      if (id === 'linkWarningBody') return state.body;
      if (id === 'linkWarningConfirm') return state.confirm;
      if (id === 'linkWarningCancel') return state.cancel;
      if (id === 'linkWarningCopy') return state.copy;
      return null;
    },
    createElement: (tag) => el({ tagName: tag }),
    createTextNode: (t) => ({ nodeType: 3, textContent: t })
  };
  return state;
}

function click(href, state) {
  const anchor = { getAttribute: (n) => (n === 'href' ? href : null) };
  assert.ok(state.clicks.length > 0, '外链拦截必须注册点击监听');
  state.clicks.forEach((fn) => fn({ target: { closest: () => anchor }, preventDefault() { state.prevented += 1; } }));
}

test('协议相对外链 //host 不得被当作站内链接放行', async () => {
  const state = installDom('');
  const { init } = await load();
  init();
  click('//evil.example/x', state);
  assert.strictEqual(state.overlay.hidden, false, '协议相对外链必须触发外链警告');
  assert.strictEqual(state.prevented, 1, '警告模式必须阻止默认跳转');
});

test('反斜杠变体 /\\host 同样按外链处理（浏览器把 \\ 解析为 /）', async () => {
  const state = installDom('');
  const { init } = await load();
  init();
  click('/\\evil.example/x', state);
  assert.strictEqual(state.overlay.hidden, false, '反斜杠协议相对地址必须触发外链警告');
  assert.strictEqual(state.prevented, 1);
});

test('站内根相对路径保持快路径（不弹窗、不拦截）', async () => {
  const state = installDom('');
  const { init } = await load();
  init();
  click('/zh/another-post/', state);
  assert.strictEqual(state.overlay.hidden, true, '站内链接不得弹外链警告');
  assert.strictEqual(state.prevented, 0);
});

test('警告文案按纯文本渲染：HTML 不被解析，{url} 占位符被移除', async () => {
  const state = installDom('<img src=x onerror=alert(1)>{url}');
  const { init } = await load();
  init();
  click('https://other.example/a', state);
  assert.strictEqual(state.overlay.hidden, false);
  assert.strictEqual(state.body.innerHTML, null, '弹窗正文不得经 innerHTML 拼接');
  const text = state.body.childNodes.map((n) => n.textContent).join('');
  assert.ok(text.indexOf('<img') > -1, '配置文案应作为文本原样输出');
  assert.ok(text.indexOf('{url}') === -1, '{url} 占位符应被移除');
  assert.ok(text.indexOf('https://other.example/a') > -1, 'URL 应出现在受控 .link-url 节点中');
});
