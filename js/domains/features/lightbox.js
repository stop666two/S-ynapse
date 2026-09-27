import {
  resolveZoomConfig, resolveSlideshowConfig, computeZoomAt, clampPan,
  classifyTouchSwipe, classifyMouseSwipe, keyboardAction,
  shouldAutoPlay, slideshowReduce
} from './lightbox-core.js';

export function init() {
  (function () {
    var lb = document.getElementById('lightbox'), img = document.getElementById('lbImg'), cnt = document.getElementById('lbCount'), stage = document.getElementById('lbStage');
    if (!lb || !img) return;
    var F = window.__FEATURES__ || {}, L = (F && F.lightbox) || {};
    if (L.enabled === false) return;
    /* openDurationMs/switchDurationMs 为专键（0=瞬时），未设回退通用 transitionDurationMs（再回退 220）；
       系统减少动效时跳过动画（瞬时）；与 scripts/lib/feature-wiring.js → lightboxConfig 同源。 */
    var numOr = function (v, d) { var n = parseFloat(v); return isNaN(n) || n < 0 ? d : n; };
    var transMs = numOr(L.transitionDurationMs, 220);
    var openMs = numOr(L.openDurationMs, transMs);
    var switchMs = numOr(L.switchDurationMs, transMs);
    var reduceMotion = function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    function play(el, ms) { if (!el || ms <= 0 || !el.animate || reduceMotion()) return; try { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease-out' }); } catch (e) { /* 忽略：WAAPI 不可用时瞬时显示（保持功能可用） */ } }
    var sel = L.selectors || '.post-content img,.gallery-item img';
    /* 缩放与幻灯片归一化：新分组键 zoom/slideshow 优先，未设回退既有平铺键（zoomEnabled/zoomMax），保持旧配置行为。
       纯函数实现见 js/domains/features/lightbox-core.js（单测覆盖钳制/边界/手势/状态机语义）。 */
    var zoomCfg = resolveZoomConfig(L), ssCfg = resolveSlideshowConfig(L);
    var zoomE = zoomCfg.enabled, panE = L.panEnabled !== false, rotE = L.rotateEnabled !== false, pinchE = L.pinchEnabled !== false;
    var step = +L.zoomStep || .25, zmin = +L.zoomMin || 1, zmax = zoomCfg.maxScale;
    /* 手势阈值缺省/非法回退 50 / 80 / 80 / 2 / 6，均保持历史行为。 */
    var rawSwipe = +L.swipeThresholdPx, rawSwipeClose = +L.swipeCloseThresholdPx, rawMouseSwipe = +L.mouseSwipeThresholdPx;
    var swipePx = isNaN(rawSwipe) ? 50 : Math.max(0, rawSwipe);
    var swipeClosePx = isNaN(rawSwipeClose) ? 80 : Math.max(0, rawSwipeClose);
    var mouseSwipePx = isNaN(rawMouseSwipe) ? 80 : Math.max(0, rawMouseSwipe);
    var dblLevel = isNaN(+L.dblClickZoomLevel) ? 2 : Math.max(1, +L.dblClickZoomLevel);
    var clickTol = isNaN(+L.clickTolerancePx) ? 6 : Math.max(0, +L.clickTolerancePx);
    var dbl = L.dblClickZoom !== false, wheel = L.wheelZoom !== false, showBtns = L.showZoomButtons !== false;
    var canNav = L.prevNextButtons !== false, cntShow = L.showCounter !== false, kbNav = L.keyboardNavigate !== false, esc = L.escToClose !== false, bdClose = L.closeOnBackdrop !== false, swipe = L.swipeToNavigate !== false, swipeClose = L.swipeClose !== false;
    var prev = document.getElementById('lbPrev'), next = document.getElementById('lbNext'), close = document.getElementById('lbClose');
    var zIn = document.getElementById('lbZoomIn'), zOut = document.getElementById('lbZoomOut'), rotL = document.getElementById('lbRotateL'), rotR = document.getElementById('lbRotateR'), rst = document.getElementById('lbReset');
    var ssBtn = document.getElementById('lbSlideshow'), dlBtn = document.getElementById('lbDownload');
    if (!canNav) { if (prev) prev.style.display = 'none'; if (next) next.style.display = 'none'; }
    if (!cntShow) cnt.style.display = 'none';
    if (!showBtns || !zoomE) { if (zIn) zIn.style.display = 'none'; if (zOut) zOut.style.display = 'none'; }
    if (!rotE && !zoomE) { if (rst) rst.style.display = 'none'; }
    if (!rotE) { if (rotL) rotL.style.display = 'none'; if (rotR) rotR.style.display = 'none'; }
    if (L.closeButton === false && close) close.style.display = 'none';
    if (!ssCfg.enabled && ssBtn) ssBtn.style.display = 'none';
    if (L.downloadButton === false && dlBtn) dlBtn.style.display = 'none';
    var list = [], idx = 0, tx0 = null, ty0 = null, mdx = null, sc = 1, rot = 0, px = 0, py = 0, panning = false, sx = 0, sy = 0;
    /* 幻灯片状态（playing/autoSuspended）与定时器；状态迁移由 lightbox-core.slideshowReduce 纯函数决定。 */
    var ssState = { playing: false, autoSuspended: false }, ssTimer = null;
    /* 位置记忆键前缀：features.lightbox.positionStorageKey（空/非法回退历史前缀 's-lb-pos'）；
       实际键 = 前缀 + ':' + location.pathname，改键等同清空一次旧记忆。 */
    var posPrefix = L.positionStorageKey == null ? '' : String(L.positionStorageKey).trim();
    var RKEY = (posPrefix || 's-lb-pos') + ':' + location.pathname, remember = L.rememberPosition === true;
    function viewport() { return { width: stage.clientWidth, height: stage.clientHeight }; }
    function content() { return { width: img.offsetWidth, height: img.offsetHeight }; }
    function apply() { var tr = 'translate(' + px + 'px,' + py + 'px) rotate(' + rot + 'deg)'; if (sc > 1) tr += ' scale(' + sc + ')'; img.style.transform = tr; img.style.cursor = (sc > 1 && panE) ? 'grab' : 'default'; }
    function reset() { sc = 1; rot = 0; px = 0; py = 0; apply(); }
    /* 缩放：目标倍数经 [zoomMin, maxScale] 钳制；锚点（stage 归一化 0–1 坐标）下的图像点保持不动；
       旋转态不调锚点；平移结果统一做边界钳制（不得拖出视口）。 */
    function zoomTo(z, cx, cy) {
      if (!zoomE || !img) return;
      var anchor = (cx !== undefined && cy !== undefined) ? { x: cx * stage.clientWidth, y: cy * stage.clientHeight } : null;
      var out = computeZoomAt({ scale: sc, px: px, py: py }, z, { min: zmin, max: zmax, rotation: rot, anchor: anchor, viewport: viewport(), content: content() });
      sc = out.scale; px = out.px; py = out.py; apply();
    }
    var ms = +L.minSize || 0;
    function collect() { list = []; document.querySelectorAll(sel).forEach(function (im) { if (im.closest('a')) return; if (ms > 0 && (im.offsetWidth < ms || im.offsetHeight < ms)) return; list.push(im); }); }
    function preload() { if (L.preloadAdjacent === false) return; for (var i = 1; i <= 1; i++) { var a = (idx + i) % list.length, b = (idx - i + list.length) % list.length; if (list[a]) { var im = new Image(); im.src = list[a].currentSrc || list[a].src; } if (list[b]) { var im2 = new Image(); im2.src = list[b].currentSrc || list[b].src; } } }
    function load() { img.classList.add('lb-moving'); img.onload = function () { img.classList.remove('lb-moving'); }; img.src = list[idx].currentSrc || list[idx].src; img.alt = list[idx].alt || ''; var cap = document.getElementById('lbCaption'); if (cap) cap.textContent = (L.showCaption === false) ? '' : (list[idx].alt || ''); }
    /* 原图下载：取收集图片的 src 属性（构建期写入的原始分辨率路径；惰性替换场景回退 currentSrc）；
       无可用路径或内联 data URI 时隐藏按钮，文件名取路径末段。 */
    function updateDownload() {
      if (!dlBtn || L.downloadButton === false) return;
      var el = list[idx], src = el ? (el.getAttribute('src') || el.currentSrc || el.src || '') : '';
      if (!src || /^data:/i.test(src)) { dlBtn.hidden = true; return; }
      dlBtn.href = src;
      var name = '';
      try { name = decodeURIComponent((src.split('?')[0].split('#')[0].split('/').pop()) || ''); } catch (e) { /* 忽略：非法转义按无文件名处理（name 保持空串） */ }
      if (name) dlBtn.setAttribute('download', name); else dlBtn.removeAttribute('download');
      dlBtn.hidden = false;
    }
    function slideshowLabel(playing) {
      var d = playing ? '暂停幻灯片' : '播放幻灯片';
      return (typeof __T === 'function') ? __T(playing ? 'toolbar.slideshowPause' : 'toolbar.slideshowPlay', d) : d;
    }
    function updateSlideshowUI() {
      if (!ssBtn) return;
      var label = slideshowLabel(ssState.playing);
      ssBtn.setAttribute('aria-label', label);
      ssBtn.setAttribute('title', label);
      var pi = ssBtn.querySelector('.lb-ss-play'), pa = ssBtn.querySelector('.lb-ss-pause');
      if (pi) pi.hidden = ssState.playing;
      if (pa) pa.hidden = !ssState.playing;
    }
    function resetSlideshowTimer() {
      if (ssTimer) { clearTimeout(ssTimer); ssTimer = null; }
      if (ssState.playing) ssTimer = setTimeout(slideshowTick, ssCfg.intervalMs);
    }
    /* 轮播计时到：缩放态本次跳过（缩放视图不被切走），列表不足两张不推进。 */
    function slideshowTick() {
      ssTimer = null;
      var r = slideshowReduce(ssState, { type: 'tick', zoomed: sc > 1, count: list.length });
      ssState = r.state;
      if (r.advance) show(idx + 1); else resetSlideshowTimer();
      /* show() 正常路径已重排计时器；列表为空等提前返回场景兜底重排，避免轮播静默停止。 */
      if (!ssTimer && ssState.playing) resetSlideshowTimer();
    }
    function show(i) {
      if (!list.length) return; var wasOpen = lb.classList.contains('open'); idx = (i + list.length) % list.length;
      if (remember) { try { sessionStorage.setItem(RKEY, String(idx)); } catch (e) { /* 忽略：存储不可用（隐私模式） */ } }
      reset(); load(); if (cnt) { var cf = typeof L.counterFormat === 'string' ? L.counterFormat : ''; cnt.textContent = cf ? cf.replace(/\{current\}/g, String(idx + 1)).replace(/\{total\}/g, String(list.length)) : (idx + 1) + ' / ' + list.length; } lb.classList.add('open'); if (wasOpen) play(img, switchMs); else play(lb, openMs); document.body.style.overflow = 'hidden'; preload();
      /* 首次打开：非减少动效时自动开始轮播；切图/手动状态保持不变。 */
      if (!wasOpen) ssState = slideshowReduce(ssState, { type: 'open', autoPlay: shouldAutoPlay(ssCfg, reduceMotion()) }).state;
      updateDownload(); updateSlideshowUI(); resetSlideshowTimer();
      if (close) { try { close.focus({ preventScroll: true }); } catch (e) { try { close.focus(); } catch (e2) { /* 忽略：二次聚焦兜底失败（元素已被移除） */ } } }
    }
    function hide() { lb.classList.remove('open'); document.body.style.overflow = ''; reset(); ssState = slideshowReduce(ssState, { type: 'close' }).state; resetSlideshowTimer(); updateSlideshowUI(); }
    document.addEventListener('click', function (e) { var im = e.target.closest(sel); if (!im || im.closest('a')) return; collect(); var j = list.indexOf(im); if (j > -1 && remember) { var saved = NaN; try { saved = parseInt(sessionStorage.getItem(RKEY), 10); } catch (e2) { /* 忽略：存储不可用 */ } if (saved >= 0 && saved < list.length) j = saved; } if (j > -1) { e.preventDefault(); show(j); } });
    if (canNav && prev && next) { prev.onclick = function () { show(idx - 1); }; next.onclick = function () { show(idx + 1); }; }
    if (close) close.onclick = hide;
    var downX = null, downY = null;
    lb.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; });
    if (bdClose) lb.addEventListener('click', function (e) {
      if (downX === null) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > clickTol) return;
      if (e.target === lb) { hide(); return; }
      if (e.target === stage && img) {
        var r = img.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) hide();
      }
    });
    /* 键盘：Esc 两段退出（缩放态先复位视图、未缩放时关闭）；←/→ 缩放态禁用避免切走视图。 */
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      var action = keyboardAction(e.key, { zoomed: sc > 1 }, { esc: esc, navigate: kbNav });
      if (action === 'close') { hide(); }
      else if (action === 'reset-view') { reset(); }
      else if (action === 'prev') { e.preventDefault(); show(idx - 1); }
      else if (action === 'next') { e.preventDefault(); show(idx + 1); }
    });
    if (swipe) { lb.addEventListener('touchstart', function (e) { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; }, { passive: true }); lb.addEventListener('touchend', function (e) { if (tx0 === null) return; var dx = e.changedTouches[0].clientX - tx0, dy = e.changedTouches[0].clientY - ty0; var action = classifyTouchSwipe({ dx: dx, dy: dy, zoomed: sc > 1, swipeEnabled: true, closeEnabled: swipeClose, swipePx: swipePx, closePx: swipeClosePx }); if (action === 'close') hide(); else if (action === 'prev') show(idx - 1); else if (action === 'next') show(idx + 1); tx0 = null; ty0 = null; }, { passive: true }); }
    if (swipe) { stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || sc > 1 || rot !== 0 || !lb.classList.contains('open')) return; mdx = e.clientX; }); stage.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse' || mdx === null) return; var d = e.clientX - mdx; mdx = null; var action = classifyMouseSwipe({ dx: d, zoomed: sc > 1, rotated: rot !== 0, threshold: mouseSwipePx }); if (action === 'prev') show(idx - 1); else if (action === 'next') show(idx + 1); }); }
    /* zoom & pan & rotate */
    if (zIn) zIn.onclick = function () { zoomTo(sc + step); }; if (zOut) zOut.onclick = function () { zoomTo(sc - step); }; if (rotL) rotL.onclick = function () { rot = (rot + 270) % 360; apply(); }; if (rotR) rotR.onclick = function () { rot = (rot + 90) % 360; apply(); }; if (rst) rst.onclick = reset;
    if (dbl) stage.addEventListener('dblclick', function (e) { if (!lb.classList.contains('open')) return; if (sc > 1) { reset(); } else { var r = stage.getBoundingClientRect(); zoomTo(dblLevel, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); } });
    if (wheel) stage.addEventListener('wheel', function (e) { if (!lb.classList.contains('open')) return; e.preventDefault(); var mul = (e.ctrlKey || e.metaKey) ? 2 : 1; zoomTo(sc + (e.deltaY < 0 ? step : -step) * mul); }, { passive: false });
    if (panE) stage.addEventListener('pointerdown', function (e) { if (sc <= 1 && rot === 0) return; panning = true; sx = e.clientX - px; sy = e.clientY - py; img.style.cursor = 'grabbing'; stage.setPointerCapture(e.pointerId); });
    /* 拖拽平移：每帧都做边界钳制（内容大于视口时才允许移动到边缘贴齐，小于视口时保持居中）。 */
    if (panE) stage.addEventListener('pointermove', function (e) { if (!panning) return; var c = clampPan(e.clientX - sx, e.clientY - sy, { scale: sc, rotation: rot, viewport: viewport(), content: content() }); px = c.px; py = c.py; apply(); });
    stage.addEventListener('pointerup', function () { panning = false; if (img) img.style.cursor = (sc > 1 && panE) ? 'grab' : 'default'; });
    stage.addEventListener('pointercancel', function () { panning = false; });
    /* classic touch pinch via two pointers */
    if (pinchE) {
      var t0 = null, d0 = 0, f0 = 0;
      stage.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { t0 = Date.now(); d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); f0 = sc; } }, { passive: true });
      stage.addEventListener('touchmove', function (e) { if (e.touches.length === 2 && t0) { var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoomTo(f0 * d / d0); } }, { passive: true });
      stage.addEventListener('touchend', function () { t0 = null; d0 = 0; f0 = 0; });
    }
    /* 幻灯片：按钮启停；页面隐藏暂停、恢复可见续播；打开自动播放受 reduced-motion 降级。 */
    if (ssBtn) ssBtn.onclick = function () { ssState = slideshowReduce(ssState, { type: 'toggle' }).state; updateSlideshowUI(); resetSlideshowTimer(); };
    document.addEventListener('visibilitychange', function () { ssState = slideshowReduce(ssState, { type: document.hidden ? 'hidden' : 'visible' }).state; updateSlideshowUI(); resetSlideshowTimer(); });
    /* 软导航交换内容后：灯箱若仍打开（前进/后退等场景）直接关闭，停止计时器并复位状态。 */
    if (Array.isArray(window.__SOFTNAV_HOOKS__)) window.__SOFTNAV_HOOKS__.push(function () { if (lb.classList.contains('open')) hide(); });
  })();
}
