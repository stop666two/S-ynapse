function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return String(h); }
function collapseAnnH() { try { document.documentElement.style.setProperty('--annH', '0px'); } catch (e) {} }
function run() {
  var bar = document.getElementById('announceBar');
  if (!bar) return;
  var items = [];
  try { items = JSON.parse(bar.getAttribute('data-items') || '[]'); } catch (e) { items = []; }
  var key = 's-announce-dismissed';
  var h = hashStr(JSON.stringify(items));
  try { if (localStorage.getItem(key) === h) { bar.remove(); collapseAnnH(); return; } } catch (e) {}
  var close = document.getElementById('announceClose');
  if (close) close.addEventListener('click', function () {
    try { localStorage.setItem(key, h); } catch (e) {}
    bar.remove();
    collapseAnnH();
  });
  var rot = parseInt(bar.getAttribute('data-rotate'), 10) || 0;
  var spans = Array.prototype.slice.call(bar.querySelectorAll('.announce-item'));
  if (rot > 0 && spans.length > 1) {
    var i = 0, paused = false;
    setInterval(function () {
      if (paused || document.hidden) return;
      spans[i].classList.remove('on');
      i = (i + 1) % spans.length;
      spans[i].classList.add('on');
    }, rot);
    bar.addEventListener('pointerenter', function () { paused = true; });
    bar.addEventListener('pointerleave', function () { paused = false; });
  }
}
export function init() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
}
