// 朗读（TTS）：软导航交换 DOM 后由 bind() 重新指向新按钮，并终止上一页的朗读状态。
// W4 接线：preferDefaultVoice（命中语音按 localService/default 评分）、voiceBy（lang|name 匹配策略）、
// highlightParagraph（逐段朗读并高亮当前段落，停止/切段清理；接管后不再叠加字级高亮）。
var STATE = null, unloadBound = false;

function bind() {
  if (STATE) { try { STATE.stop(); } catch (e) { /* 忽略：旧状态清理失败不影响新绑定 */ } STATE = null; }
  var b = document.getElementById('ttsBtn');
  if (!b || !window.speechSynthesis) return;
  var F = window.__FEATURES__ || {}, TS = (F && F.tts) || {};
  /* 兜底值与 scripts/lib/feature-wiring.js → ttsConfig 同源；仅配置缺失/非法时生效。 */
  var hlReading = TS.highlightReading !== false;
  var hlPara = TS.highlightParagraph === true;
  var cls = TS.highlightClass || 'tts-highlight';
  var lang = document.documentElement.lang || 'zh-CN';
  var parts = [], fullText = '', hb = null, resumeTries = 0, runId = 0;
  function text() {
    var c = document.querySelector(TS.readSelector || '.post-content');
    if (!c) return '';
    var skip = TS.skipSelectors || 'pre,.katex,.mermaid';
    var nodes = c.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th');
    parts = [];
    fullText = '';
    nodes.forEach(function (n) {
      if (n.closest(skip)) return;
      var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      parts.push({ el: n, txt: t });
      fullText += (fullText ? ' ' : '') + t;
    });
    return fullText;
  }
  function clearHL() {
    var found = document.querySelectorAll('.' + cls);
    if (!found.length) return;
    found.forEach(function (x) { x.classList.remove(cls); });
  }
  function hlAt(pos) {
    if (!hlReading || hlPara) return;
    var acc = 0;
    clearHL();
    for (var i = 0; i < parts.length; i++) {
      acc += parts[i].txt.length + 1;
      if (pos < acc) { parts[i].el.classList.add(cls); return; }
    }
  }
  function set(on) { b.classList.toggle('speaking', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function stopHB() { if (hb) { clearInterval(hb); hb = null; } }
  // 语音选择：与 scripts/lib/feature-wiring.js → pickTtsVoice 同源（该纯函数由单测覆盖）。
  function langNames(base) {
    var out = [];
    ['en', base].forEach(function (loc) {
      try {
        var dn = new Intl.DisplayNames([loc], { type: 'language' });
        var n = dn.of(base);
        if (n && out.indexOf(String(n).toLowerCase()) === -1) out.push(String(n).toLowerCase());
      } catch (e) { /* 忽略：环境无 Intl.DisplayNames 时该语言名不参与匹配 */ }
    });
    return out;
  }
  function pickVoice() {
    var list = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    if (!list || !list.length) return null;
    var exact = String(lang).toLowerCase(), base = exact.split(/[-_]/)[0], matched = [];
    if (TS.voiceBy === 'name') {
      var names = langNames(base);
      if (names.length) matched = list.filter(function (v) { var n = String(v.name || '').toLowerCase(); return names.some(function (x) { return n.indexOf(x) > -1; }); });
    }
    if (!matched.length) {
      matched = list.filter(function (v) { return String(v.lang || '').toLowerCase() === exact; });
      if (!matched.length && base) matched = list.filter(function (v) { var vl = String(v.lang || '').toLowerCase(); return vl === base || vl.indexOf(base + '-') === 0; });
    }
    if (!matched.length) return null;
    if (TS.preferDefaultVoice === false) return matched[0];
    var best = matched[0], score = -1;
    matched.forEach(function (v) { var s = (v.localService === true ? 2 : 0) + (v.default === true ? 1 : 0); if (s > score) { score = s; best = v; } });
    return best;
  }
  function utter(t) {
    var x = new SpeechSynthesisUtterance(t);
    var TNR = (window.__TUNING__ || {}).reading || {};
    x.rate = isNaN(+TNR.ttsRate) ? (parseFloat(b.getAttribute('data-rate')) || 1) : +TNR.ttsRate;
    x.pitch = isNaN(+TNR.ttsPitch) ? 1 : +TNR.ttsPitch;
    x.volume = isNaN(+TS.volume) ? 1 : Math.min(1, Math.max(0, +TS.volume));
    x.lang = lang;
    var v = pickVoice();
    if (v) x.voice = v;
    return x;
  }
  // Chromium 长文本会自动暂停卡死状态：短暂停心跳 resume，恢复或结束即清理（逐段模式每段独立心跳）。
  function heartbeat(x) {
    // 兜底值与 features-schema.js → DEFAULT_FEATURES.tts 同值；仅在配置缺失/非法时生效。
    var hbMs = +TS.resumeIntervalMs || 500, hbMax = +TS.resumeMaxTries || 3;
    x.onpause = function () {
      if (hb || !speechSynthesis.paused) return;
      hb = setInterval(function () {
        if (!speechSynthesis.paused) { stopHB(); return; }
        if (++resumeTries > hbMax) { finish(); speechSynthesis.cancel(); return; }
        speechSynthesis.resume();
      }, hbMs);
    };
  }
  function finish() { runId = 0; stopHB(); clearHL(); set(false); }
  // 整段模式（highlightParagraph=false，历史行为）：单 utterance + boundary 字级高亮。
  function speakAll() {
    var x = utter(fullText);
    heartbeat(x);
    x.onboundary = function (e) { if (e && typeof e.charIndex === 'number') hlAt(e.charIndex); };
    x.onend = finish;
    x.onerror = finish;
    speechSynthesis.speak(x);
  }
  // 段落模式（highlightParagraph=true）：逐段 utterance，当前段落加高亮类；onend 递进下一段，末段结束清理。
  function speakPart(k) {
    if (!runId) return;
    if (k >= parts.length) { finish(); return; }
    if (hlPara) { clearHL(); parts[k].el.classList.add(cls); }
    var x = utter(parts[k].txt);
    heartbeat(x);
    x.onend = function () { if (!runId) return; stopHB(); if (k + 1 < parts.length) { resumeTries = 0; speakPart(k + 1); } else finish(); };
    x.onerror = function (e) { if (!runId) return; if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; finish(); };
    speechSynthesis.speak(x);
  }
  b.onclick = function () {
    if (speechSynthesis.speaking || speechSynthesis.pending) { STATE.stop(); return; }
    if (!text()) return;
    resumeTries = 0;
    runId++;
    if (hlPara) speakPart(0); else speakAll();
    set(true);
  };
  STATE = {
    stop: function () {
      runId = 0;
      stopHB();
      try { speechSynthesis.cancel(); } catch (e) { /* 忽略：取消失败不影响状态清理 */ }
      clearHL();
      set(false);
    }
  };
}

export function init() {
  bind();
  if (!unloadBound) {
    unloadBound = true;
    window.addEventListener('beforeunload', function () { if (STATE) STATE.stop(); });
  }
  window.__SOFTNAV_HOOKS__.push(bind);
}
