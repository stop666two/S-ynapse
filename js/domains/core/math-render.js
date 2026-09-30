// 数学占位渲染（features.math）：构建期输出的 .math-inline/.math-block[data-tex]
// 在客户端用 KaTeX 渲染（占位产物不含裸 $ / $$）。
// 设计约束：
//   - 直接加载：layout.ejs 已按 article.hasMath 预载 vendor（CSS + katex + auto-render），
//     本模块渲染占位并保留 renderMathInElement 兜底（缩进块等构建期未捕获的裸定界符）；
//   - 软导航：文档头脚本不随内容交换执行，本模块经 __SOFTNAV_HOOKS__ 在交换后重渲染，
//     目标页含数学且当前页未预载 vendor 时按需注入（CSP 允许同源 script/style）；
//   - 幂等：占位元素以 data-math-done 标记，重复调用不重复渲染。
const KATEX_CSS = '/assets/vendor/katex/katex.min.css';
const KATEX_JS = '/assets/vendor/katex/katex.min.js';
const KATEX_AUTO = '/assets/vendor/katex/contrib/auto-render.min.js';

function cfg() {
  return (window.__FEATURES__ || {}).math || {};
}

function vendorLoaded() {
  return !!(window.katex && window.renderMathInElement);
}

function injectScript(src) {
  var el = document.createElement('script');
  el.src = src;
  el.defer = true;
  document.head.appendChild(el);
  return el;
}

// vendor 按需加载：window.katex / renderMathInElement 就绪后回调（已加载则同步回调）。
// 已存在但尚未执行的 script 标签直接监听 load（软导航场景不会重复注入）。
function ensureVendor(cb) {
  if (vendorLoaded()) { cb(); return; }
  if (!document.querySelector('link[href*="/vendor/katex/katex.min.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = KATEX_CSS;
    document.head.appendChild(link);
  }
  var scripts = [];
  if (!window.katex) {
    scripts.push(document.querySelector('script[src*="/vendor/katex/katex.min.js"]') || injectScript(KATEX_JS));
  }
  if (!window.renderMathInElement) {
    scripts.push(document.querySelector('script[src*="/vendor/katex/contrib/auto-render.min.js"]') || injectScript(KATEX_AUTO));
  }
  if (!scripts.length) { cb(); return; }
  var left = scripts.length;
  var onDone = function () { if (--left === 0 && vendorLoaded()) cb(); };
  for (var i = 0; i < scripts.length; i++) scripts[i].addEventListener('load', onDone, { once: true });
}

function mathOptions() {
  var M = cfg();
  return {
    throwOnError: M.throwOnError === true,
    strict: (M.strict === false || M.strict == null) ? false : M.strict,
    output: M.mathml === false ? 'html' : 'htmlAndMathml'
  };
}

// 兼容兜底：渲染残留的裸定界符（构建期未转占位的场景，如缩进块），定界符集合同 layout 历史行为。
function renderRawDelimiters(root) {
  if (!window.renderMathInElement) return;
  var M = cfg();
  if (M.autoDetect === false) return;
  var dl = [];
  var bls = (M.blockDelimiters && M.blockDelimiters.length) ? M.blockDelimiters : ['$$'];
  var ins = (M.inlineDelimiters && M.inlineDelimiters.length) ? M.inlineDelimiters : ['$'];
  for (var i = 0; i < bls.length; i++) dl.push({ left: bls[i], right: bls[i], display: true });
  for (var j = 0; j < ins.length; j++) dl.push({ left: ins[j], right: ins[j], display: false });
  if (M.renderRoundParens !== false) dl.push({ left: '\\(', right: '\\)', display: false });
  if (M.renderSquareBrackets !== false) dl.push({ left: '\\[', right: '\\]', display: true });
  var o = mathOptions();
  try {
    window.renderMathInElement(root, {
      delimiters: dl,
      throwOnError: o.throwOnError,
      strict: o.strict,
      output: o.output
    });
  } catch (e) { /* 兜底失败不影响占位渲染结果 */ }
}

// 渲染 root 内的数学占位（幂等）：displayMode 由 .math-block 类决定。
export function render(root) {
  var M = cfg();
  if (M.enabled === false || !window.katex) return false;
  var base = root || document.querySelector(M.selector || '.post-content');
  if (!base) return false;
  var els = base.querySelectorAll('.math-inline[data-tex], .math-block[data-tex]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (el.getAttribute('data-math-done') === '1') continue;
    el.setAttribute('data-math-done', '1');
    var o = mathOptions();
    try {
      window.katex.render(el.getAttribute('data-tex') || '', el, {
        displayMode: el.classList.contains('math-block'),
        throwOnError: o.throwOnError,
        strict: o.strict,
        output: o.output
      });
    } catch (e) { /* throwOnError=false 时 KaTeX 自行输出错误样式；意外异常保留回退文本 */ }
  }
  renderRawDelimiters(base);
  return true;
}

// 内容是否含数学：占位元素，或裸定界符（构建期未捕获的兜底路径）。
function hasMathContent(root) {
  if (root.querySelector('.math-inline[data-tex], .math-block[data-tex]')) return true;
  var text = root.textContent || '';
  return /(\$\$|\\\(|\\\[|\$[^$\n]{1,80}\$)/.test(text);
}

export function init() {
  var M = cfg();
  if (M.enabled === false) return;
  window.__mathRender = render;
  function apply() {
    var root = document.querySelector(M.selector || '.post-content');
    if (!root || !hasMathContent(root)) return;
    ensureVendor(function () { render(root); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  if (Array.isArray(window.__SOFTNAV_HOOKS__)) window.__SOFTNAV_HOOKS__.push(apply);
}
