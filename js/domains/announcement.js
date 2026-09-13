function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return String(h); }
function collapseAnnH() { try { document.documentElement.setAttribute('data-ann-dismissed', '1'); } catch (e) {} }
function run() {
  var bar = document.getElementById('announceBar');
  if (!bar) return;
  var items = [];
  try { items = JSON.parse(bar.getAttribute('data-items') || '[]'); } catch (e) { items = []; }
  var key = 's-announce-dismissed';
  var h = hashStr(JSON.stringify(items));
  var dismissed = false;
  try { if (bar.getAttribute('data-dismiss-hash') && localStorage.getItem(key) === h) dismissed = true; } catch (e) {}
  if (dismissed) { bar.remove(); collapseAnnH(); return; }
  try { document.documentElement.classList.add('ann-on'); } catch (e) {}
  try { document.documentElement.classList.add('ann-anim'); } catch (e) {}
  var close = document.getElementById('announceClose');
  if (close) close.addEventListener('click', function () {
    try { localStorage.setItem(key, h); } catch (e) {}
    try { document.documentElement.classList.remove('ann-on'); } catch (e) {}
    if (rotTimer) { clearInterval(rotTimer); rotTimer = null; }
    bar.classList.add('closing');
    collapseAnnH();
    setTimeout(function () { bar.remove(); }, 340);
  });
  var A = (window.__FEATURES__ || {}).announcement || {};
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
  if (rot > 0 && spans.length > 1) {
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
