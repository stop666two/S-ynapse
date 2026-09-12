function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return String(h); }
function run() {
  var bar = document.getElementById('announceBar');
  if (!bar) return;
  var key = 's-announce-dismissed';
  var txt = (bar.textContent || '').replace(/×\s*$/, '').trim();
  var h = hash(txt);
  try { if (localStorage.getItem(key) === h) { bar.remove(); return; } } catch (e) {}
  var c = document.getElementById('announceClose');
  if (c) c.addEventListener('click', function () { try { localStorage.setItem(key, h); } catch (e) {} bar.remove(); });
}
export function init() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); } else { run(); }
}
