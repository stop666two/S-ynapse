function readCfg() {
  var F = window.__FEATURES__ || {};
  return (F && F.sidebarDrag) || {};
}

function save(SB, aside) {
  if (SB.persistOrder === false) return;
  var arr = [];
  Array.prototype.forEach.call(aside.querySelectorAll('.sidebar-widget-slot'), function (sl) { arr.push(sl.getAttribute('data-widget-type')); });
  try { localStorage.setItem(SB.storageKey, JSON.stringify(arr)); } catch (e) { /* 忽略：存储不可用时顺序仅当次会话有效 */ }
}

function restore(SB, aside) {
  if (SB.persistOrder === false) return;
  var arr, fail = false;
  try {
    var raw = localStorage.getItem(SB.storageKey);
    arr = raw == null ? null : JSON.parse(raw);
    if (arr != null && !Array.isArray(arr)) { arr = null; fail = true; }
  } catch (e) { arr = null; fail = true; }
  if (fail) {
    if (SB.resetOnLoadFail !== false) { try { localStorage.removeItem(SB.storageKey); } catch (e) { /* 忽略：存储不可用时无需重置 */ } }
    return;
  }
  if (!arr || !arr.length) return;
  Array.prototype.forEach.call(arr, function (t) {
    if (!t || !/^[A-Za-z0-9_-]+$/.test(t)) return;
    var src = aside.querySelector('.sidebar-widget-slot[data-widget-type="' + t + '"]');
    if (src) { aside.removeChild(src); aside.appendChild(src); }
  });
}

function bindDrag(SB, aside, slot, w) {
  w.setAttribute('draggable', 'true');
  w.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', '1'); slot.classList.add('dragging'); });
  w.addEventListener('dragend', function () { slot.classList.remove('dragging'); save(SB, aside); });
  w.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); slot.classList.add('drag-over'); });
  w.addEventListener('dragleave', function () { slot.classList.remove('drag-over'); });
  w.addEventListener('drop', function (e) {
    e.preventDefault();
    var from = document.querySelector('.sidebar-widget-slot.dragging');
    if (!from || from === slot) return;
    from.parentNode.removeChild(from);
    if (slot.nextSibling) aside.insertBefore(from, slot.nextSibling);
    else aside.appendChild(from);
    slot.classList.remove('drag-over');
    save(SB, aside);
  });
}

function bindTouch(SB, aside, w, slot, lpDelay) {
  var touchTimer = null, touchSlot = null;
  w.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    touchSlot = slot;
    touchTimer = setTimeout(function () {
      touchSlot.classList.add('dragging');
      if (navigator.vibrate) navigator.vibrate(10);
    }, lpDelay);
  }, { passive: true });
  w.addEventListener('touchmove', function (e) {
    if (!touchSlot || !touchSlot.classList.contains('dragging')) return;
    e.preventDefault();
    var touch = e.touches[0];
    var el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    var target = el.closest ? el.closest('.sidebar-widget-slot') : null;
    if (target && target !== touchSlot) {
      var y = touch.clientY;
      var rect = target.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) aside.insertBefore(touchSlot, target);
      else aside.insertBefore(touchSlot, target.nextSibling);
    }
  }, { passive: false });
  w.addEventListener('touchend', function () {
    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
    if (touchSlot) { touchSlot.classList.remove('dragging'); touchSlot = null; save(SB, aside); }
  });
  w.addEventListener('touchcancel', function () {
    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
    if (touchSlot) { touchSlot.classList.remove('dragging'); touchSlot = null; }
  });
}

function rebind() {
  var SB = readCfg();
  if (SB.enabled === false) return;
  var aside = document.querySelector('.sidebar');
  if (!aside) return;
  var widgets = aside.querySelectorAll('.sidebar-widget');
  if (widgets.length < 2) return;
  // 长按判定：兼容历史数字写法（touchLongPress=数字）与新键 touchLongPressMs；
  // 兜底值与 features-schema.js → DEFAULT_FEATURES.sidebarDrag 同值，仅在配置缺失/非法时生效。
  var lpDelay = typeof SB.touchLongPress === 'number' && SB.touchLongPress > 0
    ? +SB.touchLongPress
    : (isNaN(+SB.touchLongPressMs) ? 500 : Math.max(0, +SB.touchLongPressMs));
  Array.prototype.forEach.call(widgets, function (w) {
    if (w.getAttribute('data-sb-drag-bound') === '1') return;
    w.setAttribute('data-sb-drag-bound', '1');
    var slot = w.parentNode && w.parentNode.classList && w.parentNode.classList.contains('sidebar-widget-slot') ? w.parentNode : null;
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'sidebar-widget-slot';
      slot.setAttribute('data-widget-type', (w.className.match(/widget-(\w+)/) || [])[1] || 'x');
      w.parentNode.insertBefore(slot, w);
    }
    if (!slot.querySelector('.drag-handle')) {
      var handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.innerHTML = '&equiv;';
      handle.title = __T('toolbar.dragSort', '拖动以排序');
      handle.setAttribute('aria-label', __T('toolbar.dragSort', '拖动排序'));
      if (SB.showHandleOnHover === false) handle.style.opacity = '1';
      slot.appendChild(handle);
    }
    slot.appendChild(w);
    bindDrag(SB, aside, slot, w);
    if (SB.touchLongPress !== false) bindTouch(SB, aside, w, slot, lpDelay);
  });
  restore(SB, aside);
}

export function init() {
  var SB = readCfg();
  if (SB.enabled === false) return;
  rebind();
  window.__SOFTNAV_HOOKS__.push(rebind);
}
