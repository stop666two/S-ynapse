'use strict';

// 导航高亮判定（构建期 SSR 与运行时共用的同一套规则）。
// 同源实现：js/domains/core/nav-state.js 的 navPath/isNavActive —— 两边算法必须逐字等价，
// 任何一侧改动都要同步另一侧与 scripts/nav-match.test.js（跨端不共享构建复杂度，靠测试锁定）。
// 规则（自 motion.js syncNav 抽取，行为不变）：
//   1. 路径归一：去掉结尾 /index.html → /，非根路径补尾斜杠；
//   2. 跳过空 href、锚点（# 开头）、外链（http 开头）；
//   3. 首页（'/' 或 /^\/[a-z]{2}\/$/）只允许精确匹配，避免任何子页被高亮成首页；
//   4. 非首页目标允许「精确匹配」或「前缀匹配」（子路径，如 /zh/tags/foo/ 命中 /zh/tags/）；
//   5. 多个候选命中时最后一个生效（与运行时循环写法一致）。

function navPath(url) {
  let p = String(url || '').replace(/\/index\.html$/, '/');
  if (p.length > 1 && p.charAt(p.length - 1) !== '/') p += '/';
  return p;
}

function isNavActive(pathname, href) {
  const h = String(href || '');
  if (!h || h.indexOf('#') === 0 || h.indexOf('http') === 0) return false;
  const it = navPath(pathname);
  const target = navPath(h);
  const isHome = target === '/' || /^\/[a-z]{2}\/$/.test(target);
  const exact = it === target;
  const sub = !isHome && target.length > 1 && it.indexOf(target) === 0;
  return exact || sub;
}

// 从导航菜单（[{url,...}]）里找出当前路径应高亮的 href；无命中返回空串。
function findNavActiveHref(currentUrl, menu) {
  let active = '';
  (Array.isArray(menu) ? menu : []).forEach(function (m) {
    const href = m && m.url ? String(m.url) : '';
    if (isNavActive(currentUrl, href)) active = href;
  });
  return active;
}

module.exports = { navPath, isNavActive, findNavActiveHref };
