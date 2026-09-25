// 朗读（TTS）：软导航交换 DOM 后由 bind() 重新指向新按钮，并终止上一页的朗读状态。
var STATE = null, unloadBound = false;

function bind() {
  if (STATE) { try { STATE.stop(); } catch (e) { /* 忽略：旧状态清理失败不影响新绑定 */ } STATE = null; }
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
  var hb = null, resumeTries = 0;
  function stopHB() { if (hb) { clearInterval(hb); hb = null; } }
  function finish() { stopHB(); clearHL(); set(false); }
  b.onclick = function () {
    if (speechSynthesis.speaking || speechSynthesis.pending) { stopHB(); speechSynthesis.cancel(); u = null; clearHL(); set(false); return; }
    var t = text();
    if (!t) return;
    u = new SpeechSynthesisUtterance(t);
    resumeTries = 0;
    u.lang = document.documentElement.lang || 'zh-CN';
    var TNR = (window.__TUNING__ || {}).reading || {};
    u.rate = isNaN(+TNR.ttsRate) ? (parseFloat(b.getAttribute('data-rate')) || 1) : +TNR.ttsRate;
    u.pitch = isNaN(+TNR.ttsPitch) ? 1 : +TNR.ttsPitch;
    u.onboundary = function (e) { if (e && typeof e.charIndex === 'number') hlAt(e.charIndex); };
    /* Chromium 长文本会自动暂停卡死状态：短暂停心跳 resume，恢复或结束即清理 */
    u.onpause = function () {
      if (hb || !speechSynthesis.paused) return;
      hb = setInterval(function () {
        if (!speechSynthesis.paused) { stopHB(); return; }
        if (++resumeTries > 3) { finish(); speechSynthesis.cancel(); u = null; return; }
        speechSynthesis.resume();
      }, 500);
    };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
    set(true);
  };
  STATE = { stop: function () { stopHB(); try { speechSynthesis.cancel(); } catch (e) { /* 忽略 */ } u = null; set(false); } };
}

export function init() {
  bind();
  if (!unloadBound) {
    unloadBound = true;
    window.addEventListener('beforeunload', function () { if (STATE) STATE.stop(); });
  }
  window.__SOFTNAV_HOOKS__.push(bind);
}
