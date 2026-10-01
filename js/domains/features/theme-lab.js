// 主题调色板编辑器（features.themeLab）：阅读设置面板「主题」页——关键 token 白名单取色，
// 实时预览写 document.documentElement.style（CSSOM 内联变量，所见即所得）；支持载入内置预设、
// 单项/全部重置、「保存到本地」（localStorage，首屏早置脚本读同一结构，刷新不闪烁）与导出
// theme.json5 → presetOverrides 的 JSON5 片段（复制/下载）。
// 明/暗切换后按当前模式重放覆盖（内联变量对两种模式通用，必须按模式复位以避免串色）；
// 软导航替换正文后经 __SOFTNAV_HOOKS__ 重绑面板（同 reading-panel 模式）。
import {
  resolveThemeLabConfig, sanitizeOverrides, mergeOverrides, serializeThemeLabExport,
  tokenSpec, tokenLabel, normalizeColor, isValidColor
} from './theme-lab-core.js';

var cfg = null;
var state = { light: {}, dark: {} };
var savedSerialized = '';
var bodyEl = null;
var statusEl = null;
var saveBtn = null;
var presetEl = null;
var observer = null;
var hooked = false;
var lastDownload = null;

function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function activeMode() { return isDark() ? 'dark' : 'light'; }
function lang() {
  return window.langOf ? window.langOf() : 'zh';
}
function en() { return lang() === 'en'; }
function t(zh, enText) { return en() ? enText : zh; }

function readStored() {
  try {
    var raw = localStorage.getItem(cfg.storageKey);
    if (!raw) return { light: {}, dark: {} };
    return sanitizeOverrides(JSON.parse(raw), cfg.tokens);
  } catch (e) {
    return { light: {}, dark: {} };
  }
}

function isDirty() { return JSON.stringify(state) !== savedSerialized; }

// 按当前模式重放覆盖：先清空全部白名单变量再写入本模式覆盖项，
// 保证切到另一模式时不会残留上一模式的编辑值（基础配色回退构建期 CSS 变量）。
function applyActive() {
  var mode = activeMode();
  var set = state[mode] || {};
  var style = document.documentElement.style;
  for (var i = 0; i < cfg.tokens.length; i++) style.removeProperty(cfg.tokens[i]);
  for (var j = 0; j < cfg.tokens.length; j++) {
    if (set[cfg.tokens[j]]) style.setProperty(cfg.tokens[j], set[cfg.tokens[j]]);
  }
}

function effectiveValue(id) {
  var mode = activeMode();
  if (state[mode] && state[mode][id]) return state[mode][id];
  return window.getComputedStyle(document.documentElement).getPropertyValue(id).trim();
}

// <input type=color> 只接受 #rrggbb：宽展 #rgb/#rgba、截断 #rrggbbaa；非法值回退黑色。
function colorInputValue(raw) {
  var v = normalizeColor(raw);
  if (!v) return '#000000';
  if (v.length === 4) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  if (v.length === 5) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] + v[4] + v[4];
  if (v.length === 9) return v.slice(0, 7);
  return v;
}

function resetIcon() {
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  var path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M3 12a9 9 0 1 0 3-6.7L3 8');
  var corner = document.createElementNS(NS, 'polyline');
  corner.setAttribute('points', '3 3 3 8 8 8');
  svg.appendChild(path);
  svg.appendChild(corner);
  return svg;
}

function refreshStatus(message) {
  if (saveBtn) {
    if (isDirty()) saveBtn.setAttribute('data-dirty', '1');
    else saveBtn.removeAttribute('data-dirty');
  }
  if (!statusEl) return;
  if (message) statusEl.textContent = message;
  else statusEl.textContent = isDirty() ? t('有未保存的修改', 'Unsaved changes') : '';
}

function onColorInput(e) {
  var input = e.target;
  var id = input.getAttribute('data-token');
  var color = normalizeColor(input.value);
  if (!id || !color) return;
  state[activeMode()][id] = color;
  document.documentElement.style.setProperty(id, color);
  var out = input.parentNode ? input.parentNode.querySelector('output') : null;
  if (out) out.textContent = color;
  refreshStatus(t('有未保存的修改', 'Unsaved changes'));
}

function onItemReset(e) {
  var id = e.currentTarget ? e.currentTarget.getAttribute('data-token') : '';
  if (!id) return;
  delete state[activeMode()][id];
  document.documentElement.style.removeProperty(id);
  var input = bodyEl ? bodyEl.querySelector('input[type="color"][data-token="' + id + '"]') : null;
  if (input) {
    var eff = effectiveValue(id);
    input.value = colorInputValue(eff);
    var out = input.parentNode ? input.parentNode.querySelector('output') : null;
    if (out) out.textContent = eff || input.value;
  }
  refreshStatus(t('已重置该项', 'Item reset'));
}

function buildRows() {
  if (!bodyEl) return;
  bodyEl.textContent = '';
  for (var i = 0; i < cfg.tokens.length; i++) {
    var id = cfg.tokens[i];
    var inputId = 'tl' + id.replace(/^--/, '-');
    var eff = effectiveValue(id);
    var row = document.createElement('div');
    row.className = 'theme-lab-row';
    var label = document.createElement('label');
    label.setAttribute('for', inputId);
    label.textContent = tokenLabel(id, lang());
    var controls = document.createElement('span');
    controls.className = 'theme-lab-controls';
    var input = document.createElement('input');
    input.type = 'color';
    input.id = inputId;
    input.className = 'theme-lab-color';
    input.setAttribute('data-token', id);
    input.value = colorInputValue(eff);
    var out = document.createElement('output');
    out.className = 'theme-lab-value';
    out.setAttribute('for', inputId);
    out.textContent = eff || input.value;
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'theme-lab-item-reset';
    reset.setAttribute('data-token', id);
    var resetLabel = t('重置 ', 'Reset ') + tokenLabel(id, lang());
    reset.setAttribute('aria-label', resetLabel);
    reset.title = resetLabel;
    reset.appendChild(resetIcon());
    input.addEventListener('input', onColorInput);
    reset.addEventListener('click', onItemReset);
    controls.appendChild(input);
    controls.appendChild(out);
    controls.appendChild(reset);
    row.appendChild(label);
    row.appendChild(controls);
    bodyEl.appendChild(row);
  }
}

function buildPresets() {
  if (!presetEl) return;
  presetEl.textContent = '';
  var placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('载入预设…', 'Load preset…');
  presetEl.appendChild(placeholder);
  var list = Array.isArray(window.__PRESETS__) ? window.__PRESETS__ : [];
  for (var i = 0; i < list.length; i++) {
    var option = document.createElement('option');
    option.value = list[i].id;
    option.textContent = (en() && list[i].labelEn) ? list[i].labelEn : list[i].label;
    presetEl.appendChild(option);
  }
  presetEl.disabled = list.length === 0;
}

function onPresetChange() {
  if (!presetEl) return;
  var id = presetEl.value;
  presetEl.value = '';
  if (!id) return;
  var list = Array.isArray(window.__PRESETS__) ? window.__PRESETS__ : [];
  var preset = null;
  for (var i = 0; i < list.length; i++) { if (list[i].id === id) { preset = list[i]; break; } }
  if (!preset) return;
  var mode = activeMode();
  var source = preset[mode] || {};
  var patch = {};
  for (var j = 0; j < cfg.tokens.length; j++) {
    var spec = tokenSpec(cfg.tokens[j]);
    if (spec && isValidColor(source[spec.key])) patch[cfg.tokens[j]] = source[spec.key];
  }
  state[mode] = mergeOverrides(state[mode], patch, cfg.tokens);
  applyActive();
  sync();
  refreshStatus(t('已载入预设（未保存）', 'Preset loaded (unsaved)'));
}

function save() {
  try {
    localStorage.setItem(cfg.storageKey, JSON.stringify(state));
    savedSerialized = JSON.stringify(state);
    refreshStatus(t('已保存到本地', 'Saved locally'));
  } catch (e) {
    refreshStatus(t('保存失败（本地存储不可用）', 'Save failed (storage unavailable)'));
  }
}

function resetAll() {
  state = { light: {}, dark: {} };
  try { localStorage.removeItem(cfg.storageKey); } catch (e) { /* 存储不可用时仅内存状态被清空 */ }
  savedSerialized = JSON.stringify(state);
  applyActive();
  sync();
  refreshStatus(t('已全部重置', 'All reset'));
}

function exportText() {
  return serializeThemeLabExport(state, cfg.tokens);
}

function copyExport() {
  var text = exportText();
  var done = function (ok) { refreshStatus(ok ? t('片段已复制到剪贴板', 'Fragment copied') : t('复制失败', 'Copy failed')); };
  var legacy = function () {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* 忽略：回退失败由 ok 标志上报 */ }
    document.body.removeChild(ta);
    done(ok);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
  } else {
    legacy();
  }
}

function downloadExport() {
  var text = exportText();
  try {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = cfg.exportName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
    lastDownload = { name: cfg.exportName, size: text.length };
    refreshStatus(t('已开始下载 ', 'Downloading ') + cfg.exportName);
    return true;
  } catch (e) {
    refreshStatus(t('导出失败', 'Export failed'));
    return false;
  }
}

function sync() {
  if (!bodyEl || !bodyEl.isConnected) return;
  var inputs = bodyEl.querySelectorAll('input[type="color"][data-token]');
  if (!inputs.length) {
    buildRows();
    refreshStatus();
    return;
  }
  for (var i = 0; i < inputs.length; i++) {
    var id = inputs[i].getAttribute('data-token');
    var eff = effectiveValue(id);
    inputs[i].value = colorInputValue(eff);
    var out = inputs[i].parentNode ? inputs[i].parentNode.querySelector('output') : null;
    if (out) out.textContent = eff || inputs[i].value;
  }
  refreshStatus();
}

function watchTheme() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(function () {
    applyActive();
    sync();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// 面板重绑：初始与软导航交换正文后各执行一次；onclick/oninput 赋值天然幂等（同 reading-panel）。
function bind() {
  var panel = document.getElementById('readerPanel');
  if (!panel) return;
  bodyEl = document.getElementById('themeLabBody');
  if (!bodyEl) return;
  statusEl = document.getElementById('themeLabStatus');
  saveBtn = document.getElementById('themeLabSave');
  presetEl = document.getElementById('themeLabPreset');
  var resetAllBtn = document.getElementById('themeLabResetAll');
  var copyBtn = document.getElementById('themeLabCopy');
  var downloadBtn = document.getElementById('themeLabDownload');
  if (saveBtn) saveBtn.onclick = save;
  if (resetAllBtn) resetAllBtn.onclick = resetAll;
  if (copyBtn) copyBtn.onclick = copyExport;
  if (downloadBtn) downloadBtn.onclick = downloadExport;
  if (presetEl) {
    presetEl.onchange = onPresetChange;
    buildPresets();
  }
  buildRows();
  refreshStatus();
}

export function init() {
  var F = window.__FEATURES__ || {};
  cfg = resolveThemeLabConfig(F.themeLab || {});
  if (!cfg.enabled) return;
  state = readStored();
  savedSerialized = JSON.stringify(state);
  applyActive();
  watchTheme();
  bind();
  window.__themeLabSync = sync;
  // 验收 runner / 调试只读入口（复制与下载的导出载荷、状态快照；不参与任何业务判定）。
  window.__themeLab = {
    exportText: exportText,
    download: downloadExport,
    save: save,
    resetAll: resetAll,
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    getLastDownload: function () { return lastDownload; }
  };
  if (!hooked && Array.isArray(window.__SOFTNAV_HOOKS__)) {
    hooked = true;
    window.__SOFTNAV_HOOKS__.push(bind);
  }
}
