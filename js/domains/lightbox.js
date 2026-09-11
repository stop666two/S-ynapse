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
    var canNav = L.prevNextButtons !== false, cntShow = L.showCounter !== false, kbNav = L.keyboardNavigate !== false, esc = L.escToClose !== false, bdClose = L.closeOnBackdrop !== false, swipe = L.swipeToNavigate !== false;
    var prev = document.getElementById('lbPrev'), next = document.getElementById('lbNext'), close = document.getElementById('lbClose');
    var zIn = document.getElementById('lbZoomIn'), zOut = document.getElementById('lbZoomOut'), rotB = document.getElementById('lbRotate'), rst = document.getElementById('lbReset');
    if (!canNav) { if (prev) prev.style.display = 'none'; if (next) next.style.display = 'none'; }
    if (!cntShow) cnt.style.display = 'none';
    if (!showBtns || !zoomE) { if (zIn) zIn.style.display = 'none'; if (zOut) zOut.style.display = 'none'; }
    if (!rotE && !zoomE) { if (rst) rst.style.display = 'none'; }
    if (!rotE && rotB) rotB.style.display = 'none';
    var list = [], idx = 0, tx0 = null, sc = 1, rot = 0, px = 0, py = 0, panning = false, sx = 0, sy = 0, spin = 0;
    function apply() { var tr = 'translate(' + px + 'px,' + py + 'px) rotate(' + rot + 'deg)'; if (sc > 1) tr += ' scale(' + sc + ')'; img.style.transform = tr; img.style.cursor = (sc > 1 && panE) ? 'grab' : 'default'; }
    function reset() { sc = 1; rot = 0; px = 0; py = 0; apply(); }
    function zoomTo(z, cx, cy) { if (!zoomE) return; sc = Math.min(zmax, Math.max(zmin, z)); if (sc <= 1) { px = 0; py = 0; } else if (cx !== undefined) { px -= (cx - 1) * sc * img.offsetWidth / 2; py -= (cy - 1) * sc * img.offsetHeight / 2; } apply(); }
    function collect() { list = []; document.querySelectorAll(sel).forEach(function (im) { if (!im.closest('a')) list.push(im); }); }
    function preload() { for (var i = 1; i <= 1; i++) { var a = (idx + i) % list.length, b = (idx - i + list.length) % list.length; if (list[a]) { var im = new Image(); im.src = list[a].currentSrc || list[a].src; } if (list[b]) { var im2 = new Image(); im2.src = list[b].currentSrc || list[b].src; } } }
    function load(i) { img.classList.add('lb-moving'); img.onload = function () { img.classList.remove('lb-moving'); }; img.src = list[idx].currentSrc || list[idx].src; img.alt = list[idx].alt || ''; var cap = document.getElementById('lbCaption'); if (cap) cap.textContent = (L.showCaption === false) ? '' : (list[idx].alt || ''); }
    function show(i) { if (!list.length) return; idx = (i + list.length) % list.length; reset(); load(i); cnt.textContent = (idx + 1) + ' / ' + list.length; lb.classList.add('open'); document.body.style.overflow = 'hidden'; preload(); }
    function hide() { lb.classList.remove('open'); document.body.style.overflow = ''; reset(); }
    document.addEventListener('click', function (e) { var im = e.target.closest(sel); if (!im || im.closest('a')) return; e.preventDefault(); collect(); var j = list.indexOf(im); if (j > -1) show(j); });
    if (canNav) { prev.onclick = function () { show(idx - 1); }; next.onclick = function () { show(idx + 1); }; }
    close.onclick = hide;
    if (bdClose) lb.addEventListener('click', function (e) { if (e.target === lb) hide(); });
    document.addEventListener('keydown', function (e) { if (!lb.classList.contains('open')) return; var k = e.key; if (k === 'Escape' && esc) { hide(); } else if (k === 'ArrowLeft' && kbNav) { e.preventDefault(); show(idx - 1); } else if (k === 'ArrowRight' && kbNav) { e.preventDefault(); show(idx + 1); } });
    if (swipe) { lb.addEventListener('touchstart', function (e) { tx0 = e.touches[0].clientX; }, { passive: true }); lb.addEventListener('touchend', function (e) { if (tx0 === null) return; var dx = e.changedTouches[0].clientX - tx0; if (Math.abs(dx) > 50) { if (dx > 50) show(idx - 1); if (dx < -50) show(idx + 1); } tx0 = null; }, { passive: true }); }
    /* zoom & pan & rotate */
    if (zIn) zIn.onclick = function () { zoomTo(sc + step); }; if (zOut) zOut.onclick = function () { zoomTo(sc - step); }; if (rotB) rotB.onclick = function () { rot = (rot + 90) % 360; apply(); }; if (rst) rst.onclick = reset;
    if (dbl) stage.addEventListener('dblclick', function (e) { if (sc > 1) { reset(); } else { var r = stage.getBoundingClientRect(); zoomTo(2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); } });
    if (wheel) stage.addEventListener('wheel', function (e) { e.preventDefault(); zoomTo(sc + (e.deltaY < 0 ? step : -step)); }, { passive: false });
    if (panE) stage.addEventListener('pointerdown', function (e) { if (sc <= 1 && rot === 0) return; panning = true; sx = e.clientX - px; sy = e.clientY - py; img.style.cursor = 'grabbing'; stage.setPointerCapture(e.pointerId); });
    if (panE) stage.addEventListener('pointermove', function (e) { if (!panning) return; px = e.clientX - sx; py = e.clientY - sy; apply(); });
    if (panE) {
      let d0 = 0;
      stage.addEventListener('pointerdown', function (e) { if (!pinchE || e.pointerType !== 'touch') return; var t = [e.clientX, e.clientY]; window.__lbTouch = [t]; });
      stage.addEventListener('pointermove', function (e) { if (!pinchE || e.pointerType !== 'touch') return; var arr = window.__lbTouch; if (!arr) return; if (arr.length === 1) { arr[0] = [e.clientX, e.clientY]; } });
      stage.addEventListener('pointerup', function () { if (pinchE) { window.__lbTouch = []; } });
      stage.addEventListener('wheel', function (e) { e.preventDefault(); if (e.ctrlKey || e.metaKey) { zoomTo(sc + (e.deltaY < 0 ? step : -step) * 2); } }, { passive: false });
    }
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
