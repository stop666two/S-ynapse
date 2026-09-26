// 锚点落点稳定：整页加载带 hash 直达时，浏览器可能在字体分片/图片/动态块完成布局前就完成锚定，
// 晚到的布局增长会把目标标题推走（实测长文页最后一段增长约 460px，发生在 load 后）。
// 本模块在 load 后校正落点，并用 ResizeObserver 跟踪文档高度变化，直到布局静默 settleMs
// 或超过 maxTrackMs 为止；用户一旦产生输入（wheel/touch/pointer/key）即停止。
// 两个必须注意的点：
//  1) 不能以「scroll 位置变化」作为用户滚动判据——布局变化时浏览器滚动锚定会自动调整
//     scrollY（属于我们需要继续校正的信号，而非用户行为），据其中止会漏掉最后一次漂移。
//  2) 跟踪窗口内必须禁用滚动锚定（html.anchor-stabilizing）：锚定以「保持视口内容不动」
//     优先于「保持目标元素位置」，上方内容变化时会反向推走落点（实测偏差可达 −430px）。
//     仅在带 hash 的整页加载且用户尚未输入时生效，abort/清理/超时即恢复。
// TOC 点击、返回顶部、软导航均不触发 load 且各自处理滚动，软导航切换时本模块自动退出。
export function init() {
  const F = window.__FEATURES__ || {}, AS = (F && F.anchorStabilize) || {};
  if (AS.enabled === false) return;
  if (!location.hash || location.hash.length < 2) return;
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return; }
  if (!id) return;
  const settleMs = Math.max(50, parseInt(AS.settleMs, 10) || 300);
  const rawMax = parseInt(AS.maxTrackMs, 10);
  const maxTrackMs = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 8000;
  let aborted = false;
  let loaded = false;
  let deadline = 0;
  let timer = 0;
  let cleanupTimer = 0;
  let ro = null;
  function cleanup() {
    if (ro) { try { ro.disconnect(); } catch (e) { /* 忽略：断开失败不影响清理语义 */ } ro = null; }
    if (timer) { clearTimeout(timer); timer = 0; }
    if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = 0; }
    try { document.documentElement.classList.remove('anchor-stabilizing'); } catch (e) { /* 忽略：类清理失败不影响功能 */ }
  }
  function abort() { if (aborted) return; aborted = true; cleanup(); }
  // 跟踪时限自 load 起算：load 前 RO 回调照常校正（不设限期），load 后才开始倒计时，
  // 避免「弱网下 load 很晚、期限在 init 时刻起算」导致校正窗口被吃掉。
  // 窗口关闭前再做一次最终校正（不经过 expired 短路），兜底「不影响文档高度的局部布局变化」
  // （ResizeObserver 观察不到，但会移动目标元素）。
  function arm() {
    if (!loaded || deadline) return;
    deadline = performance.now() + maxTrackMs;
    if (maxTrackMs > 0) {
      cleanupTimer = setTimeout(function () {
        if (!aborted) {
          const target = document.getElementById(id);
          if (target) {
            try { target.scrollIntoView({ behavior: 'instant', block: 'start' }); }
            catch (e) { target.scrollIntoView(); }
          }
        }
        cleanup();
      }, maxTrackMs + settleMs + 50);
    }
  }
  function expired() { return loaded && maxTrackMs > 0 && performance.now() > deadline; }
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, abort, { passive: true, once: true });
  });
  function stabilize() {
    timer = 0;
    arm();
    if (aborted || expired()) { cleanup(); return; }
    const target = document.getElementById(id);
    if (!target) { if (loaded) cleanup(); return; }
    try { target.scrollIntoView({ behavior: 'instant', block: 'start' }); }
    catch (e) { target.scrollIntoView(); }
  }
  function schedule() {
    if (aborted || expired()) { cleanup(); return; }
    if (timer) clearTimeout(timer);
    timer = setTimeout(stabilize, settleMs);
  }
  try { document.documentElement.classList.add('anchor-stabilizing'); } catch (e) { /* 忽略：类添加失败时仍执行校正 */ }
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
  }
  function onLoad() {
    loaded = true;
    arm();
    requestAnimationFrame(stabilize);
  }
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
  const hooks = window.__SOFTNAV_HOOKS__ || (window.__SOFTNAV_HOOKS__ = []);
  hooks.push(cleanup);
}
