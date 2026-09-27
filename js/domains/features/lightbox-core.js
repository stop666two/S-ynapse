// 灯箱纯函数核心：缩放/幻灯片配置归一化、缩放数学、平移边界、手势判定与幻灯片状态机。
// 被 js/domains/features/lightbox.js（运行时）与 scripts/lightbox-core.test.js（单测）共用，
// 保持与 DOM 无关，便于直接断言边界行为。

// 非负数值解析：null/undefined/空串/非法回退 fallback（0 合法）。
function num(raw, fallback) {
  const n = parseFloat(raw);
  return isNaN(n) ? fallback : n;
}

// 缩放配置归一化：
//   enabled：features.lightbox.zoom.enabled（新分组键）> features.lightbox.zoomEnabled（旧平铺键）> true；
//   maxScale：features.lightbox.zoom.maxScale > features.lightbox.zoomMax > 4，下限 1。
// 保留旧平铺键保证既有配置零改动可用。
export function resolveZoomConfig(lightboxCfg) {
  const L = lightboxCfg || {};
  const Z = (L.zoom && typeof L.zoom === 'object') ? L.zoom : {};
  const enabled = typeof Z.enabled === 'boolean' ? Z.enabled : L.zoomEnabled !== false;
  let maxScale = num(Z.maxScale, NaN);
  if (isNaN(maxScale)) maxScale = num(L.zoomMax, NaN);
  if (isNaN(maxScale)) maxScale = 4;
  if (maxScale < 1) maxScale = 1;
  return { enabled, maxScale };
}

// 幻灯片配置归一化：
//   enabled 默认 true（显式 false 关闭）；
//   intervalMs 默认 4000，非法回退 4000，范围钳制 1000–60000（防高频切图与长挂）。
export function resolveSlideshowConfig(lightboxCfg) {
  const L = lightboxCfg || {};
  const S = (L.slideshow && typeof L.slideshow === 'object') ? L.slideshow : {};
  const enabled = S.enabled !== false;
  let intervalMs = num(S.intervalMs, 4000);
  if (!isFinite(intervalMs)) intervalMs = 4000;
  if (intervalMs < 1000) intervalMs = 1000;
  if (intervalMs > 60000) intervalMs = 60000;
  return { enabled, intervalMs };
}

// 缩放倍数钳制：非法/越界值落在 [min, max] 内（min 非法时按 1）。
export function clampZoom(value, min, max) {
  const lo = isFinite(min) ? min : 1;
  const hi = isFinite(max) ? max : lo;
  const v = num(value, lo);
  return Math.min(hi, Math.max(lo, v));
}

// 视口尺寸归一化（非法/负值按 0）。
function sizeOf(v) {
  const s = v || {};
  return {
    width: Math.max(0, num(s.width, 0)),
    height: Math.max(0, num(s.height, 0))
  };
}

// 平移边界钳制：内容（按缩放与 90° 旋转交换宽高后的有效尺寸）大于视口时，
// 位移限制在「内容边缘与视口边缘贴齐」的范围内；小于视口时不允许移动（保持居中），
// 从而任何拖拽都不会把图片拖出视口。
export function clampPan(px, py, opts) {
  const o = opts || {};
  const view = sizeOf(o.viewport);
  const content = sizeOf(o.content);
  const scale = num(o.scale, 1) > 0 ? num(o.scale, 1) : 0;
  const swapped = Math.abs(Math.round(num(o.rotation, 0) / 90)) % 2 === 1;
  const width = (swapped ? content.height : content.width) * scale;
  const height = (swapped ? content.width : content.height) * scale;
  const limX = Math.max(0, (width - view.width) / 2);
  const limY = Math.max(0, (height - view.height) / 2);
  const zeroed = function (v) { return v === 0 ? 0 : v; };
  return {
    px: zeroed(Math.min(limX, Math.max(-limX, num(px, 0)))),
    py: zeroed(Math.min(limY, Math.max(-limY, num(py, 0))))
  };
}

// 缩放数学（屏幕坐标，中心为原点）：
//   - 目标倍数经 [min, max] 钳制；
//   - 缩回 <=1 时平移归零（与既有复位行为一致）；
//   - 未旋转且提供锚点时，按缩放比 k = next/old 调整平移，使锚点下的图像点保持不动；
//   - 旋转态保持既有平移不变；
//   - 最后统一做平移边界钳制（不得拖出视口）。
export function computeZoomAt(state, targetScale, opts) {
  const st = state || {};
  const o = opts || {};
  const min = num(o.min, 1);
  const max = num(o.max, 4);
  const oldScale = num(st.scale, 1) > 0 ? num(st.scale, 1) : 1;
  const next = clampZoom(targetScale, min, max);
  let px = num(st.px, 0);
  let py = num(st.py, 0);
  if (next <= 1) {
    px = 0;
    py = 0;
  } else if (o.anchor && num(o.rotation, 0) % 360 === 0) {
    const view = sizeOf(o.viewport);
    const k = next / oldScale;
    const ax = num(o.anchor.x, 0) - view.width / 2;
    const ay = num(o.anchor.y, 0) - view.height / 2;
    px = ax - k * (ax - px);
    py = ay - k * (ay - py);
  }
  const clamped = clampPan(px, py, {
    scale: next,
    rotation: o.rotation,
    viewport: o.viewport,
    content: o.content
  });
  return { scale: next, px: clamped.px, py: clamped.py };
}

// 触屏滑动手势判定（touchend 时调用）：
//   - 缩放态（zoomed）一律禁用切图与下拉关闭（缩放后拖拽用于平移，不触发翻页）；
//   - 未缩放时下拉关闭优先（向前下拖过 closePx 且纵向位移占优）；
//   - 再判定横滑切图（过 swipePx 且横向位移占优）；上滑不关闭。
// 返回 'close' | 'prev' | 'next' | null。
export function classifyTouchSwipe(info) {
  const i = info || {};
  if (i.zoomed) return null;
  const dx = num(i.dx, 0);
  const dy = num(i.dy, 0);
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (i.closeEnabled !== false && dy > num(i.closePx, 80) && ady > adx) return 'close';
  if (i.swipeEnabled === false) return null;
  if (adx > num(i.swipePx, 50) && adx > ady) return dx > 0 ? 'prev' : 'next';
  return null;
}

// 桌面鼠标横向拖拽判定：缩放或旋转态禁用；位移过阈值才切图（方向与触屏一致）。
export function classifyMouseSwipe(info) {
  const i = info || {};
  if (i.zoomed || i.rotated) return null;
  const dx = num(i.dx, 0);
  if (Math.abs(dx) <= num(i.threshold, 80)) return null;
  return dx < 0 ? 'next' : 'prev';
}

// 键盘动作判定：
//   Escape：缩放态先复位视图（两段退出），未缩放时关闭；escToClose=false 时禁用；
//   ←/→：缩放态禁用（避免缩放视图被切走），keyboardNavigate=false 时禁用。
// 返回 'close' | 'reset-view' | 'prev' | 'next' | null。
export function keyboardAction(key, state, cfg) {
  const st = state || {};
  const c = cfg || {};
  if (key === 'Escape') {
    if (c.esc === false) return null;
    return st.zoomed ? 'reset-view' : 'close';
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    if (c.navigate === false || st.zoomed) return null;
    return key === 'ArrowLeft' ? 'prev' : 'next';
  }
  return null;
}

// 幻灯片是否自动播放：配置开启且系统未要求减少动效（reduced-motion 下降级为不自动播放，
// 用户仍可通过按钮手动启停）。
export function shouldAutoPlay(slideshowCfg, reducedMotion) {
  return !!(slideshowCfg && slideshowCfg.enabled) && !reducedMotion;
}

// 幻灯片状态机（纯函数，不改入参）：
//   state = { playing, autoSuspended }；autoSuspended 记录因页面隐藏而挂起的播放态；
//   open(autoPlay)：自动播放开关打开时开始（reduced-motion 时调用方传 autoPlay=false）；
//   close：停止并清除挂起；toggle：手动播放/暂停；
//   hidden/visible：页面隐藏挂起、恢复可见续播；
//   tick：播放中、未缩放且多于一张图时 advance=true（由调用方切下一张）。
// 返回 { state, advance }。
export function slideshowReduce(state, event) {
  const s = state || {};
  const next = {
    playing: s.playing === true,
    autoSuspended: s.autoSuspended === true
  };
  const e = event || {};
  let advance = false;
  switch (e.type) {
    case 'open':
      if (e.autoPlay) {
        next.playing = true;
        next.autoSuspended = false;
      }
      break;
    case 'close':
      next.playing = false;
      next.autoSuspended = false;
      break;
    case 'toggle':
      next.playing = !next.playing;
      next.autoSuspended = false;
      break;
    case 'hidden':
      if (next.playing) {
        next.playing = false;
        next.autoSuspended = true;
      }
      break;
    case 'visible':
      if (next.autoSuspended) {
        next.playing = true;
        next.autoSuspended = false;
      }
      break;
    case 'tick':
      advance = next.playing && !e.zoomed && num(e.count, 0) > 1;
      break;
    default:
      break;
  }
  return { state: next, advance };
}
