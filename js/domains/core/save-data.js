// 省流模式运行时（features.saveDataMode，与 image-lazy/scrollBehavior 同处 core 横切层）：依据 navigator.connection.saveData 自动跟随
// （含 change 变化）与阅读设置面板手动开关（localStorage 持久）在 <html> 上维护 save-data 类。
// 类由 templates/layout.ejs 首屏早置脚本先行置入以避免闪烁（同一存储键与 '1'/'0' 取值，
// 决策语义与 save-data-core.js → decideSaveData 一致）；本模块负责首帧之后的所有变化：
//   - 系统 saveData 变化时按「显式手动偏好优先、否则自动跟随」重新决策；
//   - 手动开关切换即写 localStorage 并即时生效/还原（类移除、图片回补原 src）；
//   - 软导航替换正文后经 __SOFTNAV_HOOKS__ 重绑面板开关；
//   - 图片最小变体改写/还原委托 js/domains/core/image-lazy.js（window.__imageLazySaveData）；
//   - 粒子背景停止/恢复经 window 事件 'ss:save-data' 通知 js/domains/features/background.js；
//   - View Transition 由 js/core/soft-nav.js 与 js/domains/core/page-transition.js 检查类名跳过；
//   - 平滑滚动由 js/core/runtime.js → window.__SB 检查类名降级为 auto。
import { resolveSaveDataConfig, decideSaveData, parseManualPreference, serializeManualPreference } from './save-data-core.js';

var cfg = null;
var hooked = false;

function root() { return document.documentElement; }

function readConnectionSaveData() {
  try {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && c.saveData);
  } catch (e) { return false; }
}

function readPref() {
  try { return parseManualPreference(localStorage.getItem(cfg.storageKey)); } catch (e) { return null; }
}

function writePref(value) {
  try { localStorage.setItem(cfg.storageKey, serializeManualPreference(value)); } catch (e) { /* 存储不可用时偏好仅当次会话有效 */ }
}

function isActive() { return root().classList.contains('save-data'); }

function syncUI() {
  var el = document.getElementById('saveDataToggle');
  if (!el) return;
  var active = isActive();
  el.checked = active;
  el.setAttribute('aria-checked', active ? 'true' : 'false');
}

// 应用决策结果：类/来源属性、图片降级或还原、粒子事件通知、开关状态同步。
// 来源属性始终记录决策原因（auto/manual/default，便于面板与验收观察）；
// initial=true（首帧）且状态与早置脚本一致时不派发事件（背景模块初始化时自行检查类名）。
function apply(active, source, initial) {
  var changed = isActive() !== active;
  root().setAttribute('data-save-data-source', source);
  if (active) root().classList.add('save-data');
  else root().classList.remove('save-data');
  if (window.__imageLazySaveData) {
    if (active) window.__imageLazySaveData.apply();
    else window.__imageLazySaveData.restore();
  }
  if (!initial || changed) {
    try {
      window.dispatchEvent(new CustomEvent('ss:save-data', { detail: { active: active, source: source } }));
    } catch (e) { /* 忽略：环境不支持 CustomEvent 时降级为纯类名驱动 */ }
  }
  syncUI();
}

function refresh() {
  var d = decideSaveData(cfg, readConnectionSaveData(), readPref());
  apply(d.active, d.source, false);
}

function setManual(value) {
  writePref(!!value);
  refresh();
}

function clearManual() {
  try { localStorage.removeItem(cfg.storageKey); } catch (e) { /* 存储不可用时无操作可清 */ }
  refresh();
}

function watchConnection() {
  var c = null;
  try { c = navigator.connection || navigator.mozConnection || navigator.webkitConnection; } catch (e) { /* 忽略：连接信息不可用时无自动跟随 */ }
  if (!c) return;
  var handler = function () { refresh(); };
  if (typeof c.addEventListener === 'function') c.addEventListener('change', handler);
  else if ('onchange' in c) c.onchange = handler;
}

// 面板重绑：初始与软导航交换正文后各执行一次；onchange 赋值天然幂等（同 reading-panel）。
function bind() {
  var el = document.getElementById('saveDataToggle');
  if (!el) return;
  el.onchange = function () { setManual(el.checked); };
  syncUI();
}

export function init() {
  var F = window.__FEATURES__ || {};
  cfg = resolveSaveDataConfig(F.saveDataMode || {});
  if (!cfg.enabled) return;
  var initial = decideSaveData(cfg, readConnectionSaveData(), readPref());
  apply(initial.active, initial.source, true);
  watchConnection();
  bind();
  if (!hooked && Array.isArray(window.__SOFTNAV_HOOKS__)) {
    hooked = true;
    window.__SOFTNAV_HOOKS__.push(bind);
  }
  // 验收 runner / 调试只读入口（决策查询与手动切换；不参与业务逻辑）。
  window.__saveData = {
    isActive: isActive,
    getSource: function () { return root().getAttribute('data-save-data-source') || 'default'; },
    getConfig: function () { return JSON.parse(JSON.stringify(cfg)); },
    refresh: refresh,
    setManual: setManual,
    clearManual: clearManual
  };
}
