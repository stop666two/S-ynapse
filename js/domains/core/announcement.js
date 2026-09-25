function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return String(h); }
function collapseAnnH() { try { document.documentElement.setAttribute('data-ann-dismissed', '1'); } catch (e) { /* 忽略：属性写入失败不影响公告展示 */ } }
export function langFromHtml(htmlLang) { return /^en/i.test(String(htmlLang || '')) ? 'en' : 'zh'; }
export function readDismissStore(raw, hash, lang) {
  var st;
  try { st = JSON.parse(raw); } catch (e) { st = null; }
  if (!st || typeof st !== 'object') {
    st = {};
    if (raw && hash && raw === hash) { st[lang] = raw; }
  }
  return st;
}
export function writeDismissStore(store, hash, lang) {
  var next = {};
  for (var k in store) { if (Object.prototype.hasOwnProperty.call(store, k)) { next[k] = store[k]; } }
  next[lang] = hash;
  return next;
}
function run() {
  var bar = document.getElementById('announceBar');
  if (!bar) return;
  var items;
  try { items = JSON.parse(bar.getAttribute('data-items') || '[]'); } catch (e) { items = []; }
  var A = (window.__FEATURES__ || {}).announcement || {};
  var key = A.storageKey || 's-announce-dismissed';
  var lang = langFromHtml(document.documentElement.lang);
  var h = hashStr(JSON.stringify(items));
  var dismissed = false;
  try {
    var rawStore = localStorage.getItem(key);
    var store = readDismissStore(rawStore, h, lang);
    if (rawStore && rawStore.charAt(0) !== '{' && store[lang]) { localStorage.setItem(key, JSON.stringify(store)); }
    dismissed = !!bar.getAttribute('data-dismiss-hash') && store[lang] === h;
  } catch (e) { /* 忽略：存储不可用时视为未关闭 */ }
  if (dismissed) { bar.remove(); collapseAnnH(); return; }
  try { document.documentElement.classList.add('ann-on'); } catch (e) { /* 忽略：classList 为同步操作，防御性保护 */ }
  try { document.documentElement.classList.add('ann-anim'); } catch (e) { /* 忽略：classList 为同步操作，防御性保护 */ }
  var close = document.getElementById('announceClose');
  if (close) close.addEventListener('click', function () {
    try { localStorage.setItem(key, JSON.stringify(writeDismissStore(readDismissStore(localStorage.getItem(key), h, lang), h, lang))); } catch (e) { /* 忽略：存储不可用时关闭状态仅在当次会话有效 */ }
    try { document.documentElement.classList.remove('ann-on'); } catch (e) { /* 忽略：classList 为同步操作，防御性保护 */ }
    if (rotTimer) { clearInterval(rotTimer); rotTimer = null; }
    bar.classList.add('closing');
    collapseAnnH();
    setTimeout(function () { bar.remove(); }, +A.removeDelayMs);
  });
  var rot = parseInt(bar.getAttribute('data-rotate'), 10) || 0;
  var spans = Array.prototype.slice.call(bar.querySelectorAll('.announce-item'));
  var progI = bar.querySelector('.announce-progress i');
  var rotTimer = null;
  function kickProgress() {
    if (!progI) return;
    progI.style.animation = 'none';
    void progI.offsetWidth;
    progI.style.animation = '';
    progI.style.animationPlayState = '';
  }
  var rm = false;
  try { rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* 忽略：无法查询动效偏好时按允许轮播处理 */ }
  if (rot > 0 && spans.length > 1 && !rm) {
    var i = 0, paused = false;
    rotTimer = setInterval(function () {
      if (paused || document.hidden) return;
      spans[i].classList.remove('on');
      i = (i + 1) % spans.length;
      spans[i].classList.add('on');
      kickProgress();
    }, rot);
    if (A.pauseOnHover !== false) {
      bar.addEventListener('pointerenter', function () { paused = true; if (progI) progI.style.animationPlayState = 'paused'; });
      bar.addEventListener('pointerleave', function () { paused = false; if (progI) progI.style.animationPlayState = ''; });
    }
  }
}
export function init() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
}
