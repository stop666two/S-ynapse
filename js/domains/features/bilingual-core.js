// 双语对照纯函数核心：配置归一化、对照 URL 判定、宽屏断点判定、右栏提取净化决策。
// 被 js/domains/features/bilingual.js（运行时）与 scripts/bilingual-core.test.js（单测）共用；
// 净化决策只描述「移除什么/剥离什么」，真实 DOM 操作由运行时执行，保持与 DOM 无关可断言。

export const PANE_SOURCE_SELECTOR = '.post-content';
export const BILINGUAL_BREAKPOINT_MIN = 480;
export const BILINGUAL_BREAKPOINT_MAX = 3840;
export const BILINGUAL_BREAKPOINT_DEFAULT = 1280;

// 配置归一化：enabled/switch/sideBySide 默认 true；breakpointPx 夹取到 480–3840 的整数
// （非法/缺失回退 1280）；fetchTimeoutMs（>0，非法回退 10000）；resizeDebounceMs（非负，
// 非法回退 120）；paneTitle/paneTitleEn 空串回退内置 '中文'/'English'。
// 与 scripts/lib/feature-wiring.js 的 bilingualConfig 同语义。
export function resolveBilingualConfig(raw) {
  const B = raw || {};
  const n = parseFloat(B.breakpointPx);
  const bp = isNaN(n)
    ? BILINGUAL_BREAKPOINT_DEFAULT
    : Math.min(BILINGUAL_BREAKPOINT_MAX, Math.max(BILINGUAL_BREAKPOINT_MIN, Math.round(n)));
  const to = parseFloat(B.fetchTimeoutMs);
  const debounce = parseFloat(B.resizeDebounceMs);
  const pickTitle = function (v, dflt) { const s = v == null ? '' : String(v).trim(); return s || dflt; };
  return {
    enabled: B.enabled !== false,
    switch: B.switch !== false,
    sideBySide: B.sideBySide !== false,
    breakpointPx: bp,
    fetchTimeoutMs: isNaN(to) || to <= 0 ? 10000 : to,
    resizeDebounceMs: isNaN(debounce) || debounce < 0 ? 120 : debounce,
    paneTitle: pickTitle(B.paneTitle, '中文'),
    paneTitleEn: pickTitle(B.paneTitleEn, 'English')
  };
}

// 对照目标 URL 判定：仅接受站内绝对路径且带目标语言段（/en/… 或 /en），
// 拒绝协议相对（//）、双斜杠、反斜杠/查询/锚点与目录穿越等非预期形态。
export function isAlternateHref(href, lang) {
  const h = String(href == null ? '' : href);
  const l = String(lang == null ? '' : lang);
  if (!/^[a-z]{2,3}$/.test(l)) return false;
  if (h.charAt(0) !== '/' || h.indexOf('//') !== -1) return false;
  if (/[\\?#]/.test(h) || h.indexOf('..') !== -1) return false;
  return h === '/' + l || h.indexOf('/' + l + '/') === 0;
}

// 宽屏并排显示判定：sideBySide 未关闭、存在对照、视口宽度 ≥ breakpointPx（含等于）。
export function shouldShowSideBySide(cfg, hasAlt, viewportWidth) {
  const c = cfg || {};
  if (c.sideBySide === false) return false;
  if (!hasAlt) return false;
  const w = Number(viewportWidth);
  if (!isFinite(w)) return false;
  const bp = isFinite(Number(c.breakpointPx)) ? Number(c.breakpointPx) : BILINGUAL_BREAKPOINT_DEFAULT;
  return w >= bp;
}

// 右栏移除选择器清单：脚本/样式/表单与页面级标题/工具条/评论/系列导航等，
// 只保留对方文章正文（重复标题与工具不进入右栏）。
export function paneCleanupSelectors() {
  return [
    'script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed', 'form',
    '.post-header', '.post-meta', '.post-featured-image', '.cover-strip', '.translation-notice',
    '.bilingual-bar', '.post-actions', '.share-row', '.related-posts', '.comments-section',
    '.series-nav', '.reward-bar', '.fav-btn', '.post-nav', '.post-navigation', '.post-comments',
    '.reading-panel', '.reader-gear', '.post-source-url',
    '.post-content>h1:first-child'
  ];
}

// 需剥离的属性：id（左右栏重复 id 破坏锚点与 aria 关联）、data-vt（View Transition
// 命名冲突）、on*（内联事件防御性剥离；正常构建产物不出现）。
export function paneStripAttribute(name) {
  const n = String(name == null ? '' : name).toLowerCase();
  return n === 'id' || n === 'data-vt' || n.indexOf('data-vt-') === 0 || n.indexOf('on') === 0;
}

// 右栏语言标头：展示对方语言的自称（语言名不翻译，遵循 BCP 47 显示惯例）。
export function paneLanguageLabel(lang) {
  return String(lang) === 'en' ? 'English' : '中文';
}
