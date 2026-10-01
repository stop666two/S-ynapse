// 图片懒加载与省流降级（features.imageLazy + features.saveDataMode）：
// 常规路径：首 N 张标记 eager、其余淡入 + LQIP 背景 + 失败回退。
// 省流路径（html.save-data 且对应 degrade 开启）：
//   lowResImages    — <img>/<picture> 重写到最小分辨率变体（原值存 data-sd-* 供即时还原）；
//   lazyAggressive — 取消首屏 eager 预载、全部 loading=lazy + fetchpriority=low（更激进懒加载）。
// 软导航替换正文后经 __SOFTNAV_HOOKS__ 重扫；降级/还原入口暴露为 window.__imageLazySaveData
// 供 js/domains/core/save-data.js 在开关切换时调用（本模块同时监听 ss:save-data 事件兜底）。
import { smallestImageUrl, smallestSrcsetUrl } from './save-data-core.js';

export function init() {
  function saveDataState() {
    var F = window.__FEATURES__ || {}, SD = (F && F.saveDataMode) || {}, D = (SD.degrade || {});
    var on = SD.enabled !== false && document.documentElement.classList.contains('save-data');
    var maxW = Number(D.lowResMaxWidthPx);
    return {
      on: on,
      lowRes: on && D.lowResImages !== false,
      lazy: on && D.lazyAggressive !== false,
      lowResMaxWidthPx: isNaN(maxW) || maxW < 0 ? 0 : Math.floor(maxW)
    };
  }

  function naturalWidthOf(img) {
    var iw = parseInt(img.getAttribute('data-iw'), 10);
    if (iw > 0) return iw;
    var w = parseInt(img.getAttribute('width'), 10);
    return w > 0 ? w : 0;
  }

  // <img> 重写：srcset 存在时选最小候选写回 src 并移除 srcset；<picture> 内兜底图
  // 从 source 中选最小候选（优先无 type 的原始格式，其次 webp——兜底图服务于不支持
  // <picture> 的老浏览器，尽量保持构建期「原格式兜底」语义）。幂等（data-sd-img 标记）。
  function rewriteImg(img, maxWidth) {
    if (img.getAttribute('data-sd-img') === '1') return;
    var src = img.getAttribute('src') || '';
    var srcset = img.getAttribute('srcset') || '';
    var nat = naturalWidthOf(img);
    var next = smallestImageUrl(src, srcset, nat, maxWidth);
    var picture = img.closest ? img.closest('picture') : null;
    if (picture && !srcset) {
      var primary = [], fallback = [];
      picture.querySelectorAll('source[srcset]').forEach(function (s) {
        var raw = s.getAttribute('srcset') || '';
        var pick = smallestSrcsetUrl(raw, nat, maxWidth);
        if (!pick) return;
        var t = String(s.getAttribute('type') || '').toLowerCase();
        if (!t) primary.push(pick);
        else if (t === 'image/webp') fallback.push(pick);
      });
      var candidates = primary.length ? primary : fallback;
      if (candidates.length) next = smallestImageUrl(src, candidates.join(', '), nat, maxWidth);
    }
    if (next === src && !srcset) return;
    img.setAttribute('data-sd-img', '1');
    if (src) img.setAttribute('data-sd-src', src);
    if (srcset) { img.setAttribute('data-sd-srcset', srcset); img.removeAttribute('srcset'); }
    if (next && next !== src) img.setAttribute('src', next);
  }

  function restoreImg(img) {
    if (img.getAttribute('data-sd-img') !== '1') return;
    var src = img.getAttribute('data-sd-src');
    var srcset = img.getAttribute('data-sd-srcset');
    if (src) img.setAttribute('src', src);
    if (srcset) img.setAttribute('srcset', srcset);
    img.removeAttribute('data-sd-img');
    img.removeAttribute('data-sd-src');
    img.removeAttribute('data-sd-srcset');
  }

  // <picture> 各 <source> 重写为本格式内的最小候选（保留格式协商，仅降分辨率）。
  function rewritePicture(picture, maxWidth) {
    if (picture.getAttribute('data-sd-picture') === '1') return;
    var sources = picture.querySelectorAll('source[srcset]');
    if (!sources.length) return;
    picture.setAttribute('data-sd-picture', '1');
    sources.forEach(function (s) {
      var raw = s.getAttribute('srcset') || '';
      var pick = smallestSrcsetUrl(raw, 0, maxWidth);
      if (pick && pick !== raw) {
        s.setAttribute('data-sd-srcset', raw);
        s.setAttribute('srcset', pick);
      }
    });
  }

  function restorePicture(picture) {
    if (picture.getAttribute('data-sd-picture') !== '1') return;
    picture.querySelectorAll('source[data-sd-srcset]').forEach(function (s) {
      s.setAttribute('srcset', s.getAttribute('data-sd-srcset'));
      s.removeAttribute('data-sd-srcset');
    });
    picture.removeAttribute('data-sd-picture');
  }

  // 更激进懒加载：所有未标记图片强制 native lazy + 低优先级（原值可还原）。
  function applyAggressiveLazy() {
    document.querySelectorAll('img:not([data-sd-lazy])').forEach(function (i) {
      i.setAttribute('data-sd-lazy', '1');
      i.setAttribute('data-sd-loading', i.getAttribute('loading') || '');
      i.setAttribute('data-sd-fetchpriority', i.getAttribute('fetchpriority') || '');
      i.setAttribute('loading', 'lazy');
      i.setAttribute('fetchpriority', 'low');
    });
  }

  function restoreAggressiveLazy() {
    document.querySelectorAll('img[data-sd-lazy]').forEach(function (i) {
      var loading = i.getAttribute('data-sd-loading');
      var fp = i.getAttribute('data-sd-fetchpriority');
      if (loading) i.setAttribute('loading', loading); else i.removeAttribute('loading');
      if (fp) i.setAttribute('fetchpriority', fp); else i.removeAttribute('fetchpriority');
      i.removeAttribute('data-sd-lazy');
      i.removeAttribute('data-sd-loading');
      i.removeAttribute('data-sd-fetchpriority');
    });
  }

  function applyLowRes() {
    var maxW = saveDataState().lowResMaxWidthPx;
    document.querySelectorAll('picture').forEach(function (p) { rewritePicture(p, maxW); });
    document.querySelectorAll('img').forEach(function (i) { rewriteImg(i, maxW); });
  }

  function restoreLowRes() {
    document.querySelectorAll('picture[data-sd-picture]').forEach(restorePicture);
    document.querySelectorAll('img[data-sd-img]').forEach(restoreImg);
  }

  function scan() {
    var F = window.__FEATURES__ || {}, IL = (F && F.imageLazy) || {};
    var st = saveDataState();
    if (st.lazy) applyAggressiveLazy();
    if (st.lowRes) applyLowRes();
    if (IL.enabled === false) return;
    var fade = IL.fadeIn !== false;
    var FB = (F && F.imageFallback) || {}, fbimg = FB.fallbackImage || IL.placeholderColor || '';
    var lc = IL.loadingClass || 'js-img', ec = IL.errorClass || '', ef = Math.max(0, parseInt(IL.eagerFirst) || 0);
    // 省流：取消首屏 eager 预载（更激进懒加载的另一半：全部 native lazy + 低优先级）。
    if (st.lazy) ef = 0;
    if (IL.lqip !== false) {
      document.querySelectorAll('img[data-lqip]').forEach(function (i) {
        if (i.getAttribute('data-lqip-applied') === '1') return;
        i.setAttribute('data-lqip-applied', '1');
        i.style.backgroundSize = 'cover';
        i.style.backgroundPosition = '50% 50%';
        i.style.backgroundImage = 'url("' + i.getAttribute('data-lqip') + '")';
      });
    }
    // 与构建期模板合流：模板已标记的 eager 计入总数，运行时只补足到前 ef 张（合计恰好 ef）。
    var eagerHave = document.querySelectorAll('img[loading=eager]').length;
    var efNeed = Math.max(0, ef - eagerHave);
    var imgs = Array.prototype.slice.call(document.querySelectorAll('img:not([loading=eager])')).filter(function (i) {
      return i.getAttribute('data-lazy-bound') !== '1';
    });
    for (var j = 0; j < Math.min(efNeed, imgs.length); j++) {
      imgs[j].setAttribute('loading', 'eager');
      imgs[j].setAttribute('data-lazy-bound', '1');
    }
    imgs.slice(efNeed).forEach(function (i) {
      i.setAttribute('data-lazy-bound', '1');
      if (fbimg && !i.getAttribute('data-fb')) i.setAttribute('data-fb', fbimg);
      if (!fade) return;
      i.classList.add(lc);
      if (i.complete) i.classList.add('loaded');
      else i.addEventListener('load', function () { i.classList.add('loaded'); });
      i.addEventListener('error', function () {
        i.classList.add('loaded');
        if (ec) i.classList.add(ec);
        if (FB.enabled !== false && FB.fallbackImage && !i.dataset.fbdone) {
          var alt = i.getAttribute('alt') || '';
          if (FB.showAlt && alt) { i.alt = alt; i.classList.add('img-fallback-alt'); }
          else { i.src = FB.fallbackImage; i.classList.add('img-fallback'); i.dataset.fbdone = '1'; }
        }
      });
    });
    if (st.lowRes) applyLowRes();
  }

  function applySaveData() {
    if (!saveDataState().on) return;
    scan();
  }

  function restoreSaveData() {
    restoreLowRes();
    restoreAggressiveLazy();
  }

  window.__imageLazySaveData = { apply: applySaveData, restore: restoreSaveData, state: saveDataState };
  window.addEventListener('ss:save-data', function (e) {
    var d = e && e.detail ? e.detail : {};
    if (d.active) applySaveData(); else restoreSaveData();
  });
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', scan); } else { scan(); }
  window.__SOFTNAV_HOOKS__.push(scan);
}
