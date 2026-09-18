export function init() {
  (function () {
    var lb = document.getElementById('lightbox'), img = document.getElementById('lbImg'), cnt = document.getElementById('lbCount'), stage = document.getElementById('lbStage');
    if (!lb || !img) return;
    var F = window.__FEATURES__ || {}, L = (F && F.lightbox) || {};
    if (L.enabled === false) return;
    var sel = L.selectors || '.post-content img,.gallery-item img';
    var zoomE = L.zoomEnabled !== false, panE = L.panEnabled !== false, rotE = L.rotateEnabled !== false, pinchE = L.pinchEnabled !== false;
    var step = +L.zoomStep || .25, zmin = +L.zoomMin || 1, zmax = +L.zoomMax || 4;
    var dbl = L.dblClickZoom !== false, wheel = L.wheelZoom !== false, showBtns = L.showZoomButtons !== false;
    var canNav = L.prevNextButtons !== false, cntShow = L.showCounter !== false, kbNav = L.keyboardNavigate !== false, esc = L.escToClose !== false, bdClose = L.closeOnBackdrop !== false, swipe = L.swipeToNavigate !== false, swipeClose = L.swipeClose !== false;
    var prev = document.getElementById('lbPrev'), next = document.getElementById('lbNext'), close = document.getElementById('lbClose');
    var zIn = document.getElementById('lbZoomIn'), zOut = document.getElementById('lbZoomOut'), rotL = document.getElementById('lbRotateL'), rotR = document.getElementById('lbRotateR'), rst = document.getElementById('lbReset');
    if (!canNav) { if (prev) prev.style.display = 'none'; if (next) next.style.display = 'none'; }
    if (!cntShow) cnt.style.display = 'none';
    if (!showBtns || !zoomE) { if (zIn) zIn.style.display = 'none'; if (zOut) zOut.style.display = 'none'; }
    if (!rotE && !zoomE) { if (rst) rst.style.display = 'none'; }
    if (!rotE) { if (rotL) rotL.style.display = 'none'; if (rotR) rotR.style.display = 'none'; }
    var list = [], idx = 0, tx0 = null, ty0 = null, mdx = null, sc = 1, rot = 0, px = 0, py = 0, panning = false, sx = 0, sy = 0, spin = 0;
    function apply() { var tr = 'translate(' + px + 'px,' + py + 'px) rotate(' + rot + 'deg)'; if (sc > 1) tr += ' scale(' + sc + ')'; img.style.transform = tr; img.style.cursor = (sc > 1 && panE) ? 'grab' : 'default'; }
    function reset() { sc = 1; rot = 0; px = 0; py = 0; apply(); }
    function zoomTo(z, cx, cy) { if (!zoomE || !img) return; var old = sc; sc = Math.min(zmax, Math.max(zmin, z)); if (sc <= 1) { px = 0; py = 0; } else if (cx !== undefined && rot === 0) { px += (old - sc) * (cx - .5) * img.offsetWidth; py += (old - sc) * (cy - .5) * img.offsetHeight; } apply(); }
    function collect() { list = []; document.querySelectorAll(sel).forEach(function (im) { if (!im.closest('a')) list.push(im); }); }
    function preload() { for (var i = 1; i <= 1; i++) { var a = (idx + i) % list.length, b = (idx - i + list.length) % list.length; if (list[a]) { var im = new Image(); im.src = list[a].currentSrc || list[a].src; } if (list[b]) { var im2 = new Image(); im2.src = list[b].currentSrc || list[b].src; } } }
    function load(i) { img.classList.add('lb-moving'); img.onload = function () { img.classList.remove('lb-moving'); }; img.src = list[idx].currentSrc || list[idx].src; img.alt = list[idx].alt || ''; var cap = document.getElementById('lbCaption'); if (cap) cap.textContent = (L.showCaption === false) ? '' : (list[idx].alt || ''); }
    function show(i) { if (!list.length) return; idx = (i + list.length) % list.length; reset(); load(i); if (cnt) cnt.textContent = (idx + 1) + ' / ' + list.length; lb.classList.add('open'); document.body.style.overflow = 'hidden'; preload(); if (close) { try { close.focus({ preventScroll: true }); } catch (e) { try { close.focus(); } catch (e2) {} } } }
    function hide() { lb.classList.remove('open'); document.body.style.overflow = ''; reset(); }
    document.addEventListener('click', function (e) { var im = e.target.closest(sel); if (!im || im.closest('a')) return; e.preventDefault(); collect(); var j = list.indexOf(im); if (j > -1) show(j); });
    if (canNav && prev && next) { prev.onclick = function () { show(idx - 1); }; next.onclick = function () { show(idx + 1); }; }
    if (close) close.onclick = hide;
    var downX = null, downY = null;
    lb.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; });
    if (bdClose) lb.addEventListener('click', function (e) {
      if (downX === null) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      if (e.target === lb) { hide(); return; }
      if (e.target === stage && img) {
        var r = img.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) hide();
      }
    });
    document.addEventListener('keydown', function (e) { if (!lb.classList.contains('open')) return; var k = e.key; if (k === 'Escape' && esc) { hide(); } else if (k === 'ArrowLeft' && kbNav) { e.preventDefault(); show(idx - 1); } else if (k === 'ArrowRight' && kbNav) { e.preventDefault(); show(idx + 1); } });
    if (swipe) { lb.addEventListener('touchstart', function (e) { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; }, { passive: true }); lb.addEventListener('touchend', function (e) { if (tx0 === null) return; var dx = e.changedTouches[0].clientX - tx0, dy = e.changedTouches[0].clientY - ty0; if (swipeClose && sc <= 1 && dy > 80 && Math.abs(dy) > Math.abs(dx)) { hide(); tx0 = null; ty0 = null; return; } if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx > 50) show(idx - 1); if (dx < -50) show(idx + 1); } tx0 = null; ty0 = null; }, { passive: true }); }
    if (swipe) { stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || sc > 1 || rot !== 0 || !lb.classList.contains('open')) return; mdx = e.clientX; }); stage.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse' || mdx === null) return; var d = e.clientX - mdx; mdx = null; if (Math.abs(d) > 80) { show(d < 0 ? idx + 1 : idx - 1); } }); }
    /* zoom & pan & rotate */
    if (zIn) zIn.onclick = function () { zoomTo(sc + step); }; if (zOut) zOut.onclick = function () { zoomTo(sc - step); }; if (rotL) rotL.onclick = function () { rot = (rot + 270) % 360; apply(); }; if (rotR) rotR.onclick = function () { rot = (rot + 90) % 360; apply(); }; if (rst) rst.onclick = reset;
    if (dbl) stage.addEventListener('dblclick', function (e) { if (!lb.classList.contains('open')) return; if (sc > 1) { reset(); } else { var r = stage.getBoundingClientRect(); zoomTo(2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); } });
    if (wheel) stage.addEventListener('wheel', function (e) { if (!lb.classList.contains('open')) return; e.preventDefault(); var mul = (e.ctrlKey || e.metaKey) ? 2 : 1; zoomTo(sc + (e.deltaY < 0 ? step : -step) * mul); }, { passive: false });
    if (panE) stage.addEventListener('pointerdown', function (e) { if (sc <= 1 && rot === 0) return; panning = true; sx = e.clientX - px; sy = e.clientY - py; img.style.cursor = 'grabbing'; stage.setPointerCapture(e.pointerId); });
    if (panE) stage.addEventListener('pointermove', function (e) { if (!panning) return; px = e.clientX - sx; py = e.clientY - sy; apply(); });
    stage.addEventListener('pointerup', function () { panning = false; if (img) img.style.cursor = (sc > 1 && panE) ? 'grab' : 'default'; });
    stage.addEventListener('pointercancel', function () { panning = false; });
    /* classic touch pinch via two pointers */
    if (pinchE) {
      var t0 = null, d0 = 0, f0 = 0;
      stage.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { t0 = Date.now(); d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); f0 = sc; } }, { passive: true });
      stage.addEventListener('touchmove', function (e) { if (e.touches.length === 2 && t0) { var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); zoomTo(f0 * d / d0); } }, { passive: true });
      stage.addEventListener('touchend', function () { t0 = null; d0 = 0; f0 = 0; });
    }
  })();
}
