export function init() {
  (function () {
    var g = document.getElementById('readerGear'), p = document.getElementById('readerPanel');
    if (!g) return;
    var F = window.__FEATURES__ || {}, RP = (F && F.readingPanel) || {}, PK = RP.persistKey;
    var fs = document.getElementById('rFont'), lh = document.getElementById('rLine'), wd = document.getElementById('rWidth');
    var prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(PK) || '{}'); } catch (e) {}
    function apply() { var s = ''; if (prefs.fs) s = prefs.fs + 'px'; document.documentElement.style.setProperty('--post-fs', s); s = ''; if (prefs.lh) s = prefs.lh; document.documentElement.style.setProperty('--post-lh', s); s = ''; if (prefs.wd) s = prefs.wd + 'px'; document.documentElement.style.setProperty('--post-w', s); }
    function syncUI() { var dv = function (el, fb) { return (el && el.getAttribute && el.getAttribute('value')) || fb; }; fs.value = prefs.fs || dv(fs, 16); lh.value = prefs.lh || dv(lh, 1.8); wd.value = prefs.wd || dv(wd, ''); }
    g.onclick = function () { var open = p.classList.toggle('open'); g.setAttribute('aria-expanded', open ? 'true' : 'false'); if (open) syncUI(); };
    fs.oninput = function () { prefs.fs = +fs.value; save(); apply(); };
    lh.oninput = function () { prefs.lh = +lh.value; save(); apply(); };
    wd.oninput = function () { prefs.wd = +wd.value; save(); apply(); };
    function save() { try { localStorage.setItem(PK, JSON.stringify(prefs)); } catch (e) {} }
    var rset = document.getElementById('rReset');
    if (rset) rset.onclick = function () { prefs = {}; try { localStorage.removeItem(PK); } catch (e) {} apply(); syncUI(); };
    apply();
  })();
}
