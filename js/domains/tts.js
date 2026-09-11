export function init() {
  (function () {
    var b = document.getElementById('ttsBtn');
    if (!b || !window.speechSynthesis) return;
    var F = window.__FEATURES__ || {}, TS = (F && F.tts) || {};
    var u = null, parts = [];
    function text() {
      var c = document.querySelector(TS.readSelector || '.post-content');
      if (!c) return '';
      var skip = TS.skipSelectors || 'pre,.katex,.mermaid';
      var nodes = c.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th');
      parts = [];
      var full = '';
      nodes.forEach(function (n) {
        if (n.closest(skip)) return;
        var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t) return;
        parts.push({ el: n, txt: t });
        full += (full ? ' ' : '') + t;
      });
      return full;
    }
    function clearHL() {
      if (TS.highlightReading === false) return;
      var cls = TS.highlightClass || 'tts-highlight';
      document.querySelectorAll('.' + cls).forEach(function (x) { x.classList.remove(cls); });
    }
    function hlAt(pos) {
      if (TS.highlightReading === false) return;
      var cls = TS.highlightClass || 'tts-highlight';
      var acc = 0;
      clearHL();
      for (var i = 0; i < parts.length; i++) {
        acc += parts[i].txt.length + 1;
        if (pos < acc) { parts[i].el.classList.add(cls); return; }
      }
    }
    function set(on) { b.classList.toggle('speaking', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    b.onclick = function () {
      if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); u = null; clearHL(); set(false); return; }
      var t = text();
      if (!t) return;
      u = new SpeechSynthesisUtterance(t);
      u.lang = document.documentElement.lang || 'zh-CN';
      u.rate = parseFloat(b.getAttribute('data-rate')) || 1;
      u.onboundary = function (e) { if (e && typeof e.charIndex === 'number') hlAt(e.charIndex); };
      u.onend = function () { clearHL(); set(false); };
      u.onerror = function () { clearHL(); set(false); };
      speechSynthesis.speak(u);
      set(true);
    };
  })();
}
