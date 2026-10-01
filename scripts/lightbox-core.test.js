'use strict';
// 灯箱核心纯函数单测（js/domains/features/lightbox-core.js）：
// 缩放/幻灯片配置归一化、缩放数学、平移边界、手势判定、键盘动作、幻灯片状态机。
// 运行：node --test scripts/lightbox-core.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const CORE_PATH = path.join(__dirname, '..', 'js', 'domains', 'features', 'lightbox-core.js');
let core = null;
async function loadCore() {
  if (!core) core = await import(pathToFileURL(CORE_PATH).href);
  return core;
}

test('resolveZoomConfig：默认开启、maxScale 4；旧平铺键回退；新分组键优先', async () => {
  // switch: features.lightbox.zoom.enabled, features.lightbox.zoom.maxScale
  const c = await loadCore();
  assert.deepStrictEqual(c.resolveZoomConfig({}), { enabled: true, maxScale: 4 });
  assert.deepStrictEqual(c.resolveZoomConfig(null), { enabled: true, maxScale: 4 });
  assert.deepStrictEqual(
    c.resolveZoomConfig({ zoomEnabled: false, zoomMax: 2 }),
    { enabled: false, maxScale: 2 }
  );
  assert.deepStrictEqual(
    c.resolveZoomConfig({ zoomEnabled: false, zoomMax: 2, zoom: { enabled: true, maxScale: 6 } }),
    { enabled: true, maxScale: 6 }
  );
});

test('resolveZoomConfig：非法值回退、maxScale 下限 1、zoom 非对象容错', async () => {
  const c = await loadCore();
  assert.strictEqual(c.resolveZoomConfig({ zoom: { maxScale: 0 } }).maxScale, 1);
  assert.strictEqual(c.resolveZoomConfig({ zoom: { maxScale: -3 } }).maxScale, 1);
  assert.strictEqual(c.resolveZoomConfig({ zoom: { maxScale: 'x' }, zoomMax: 'y' }).maxScale, 4);
  assert.strictEqual(c.resolveZoomConfig({ zoom: { maxScale: '2.5' } }).maxScale, 2.5);
  assert.deepStrictEqual(c.resolveZoomConfig({ zoom: 'bad' }), { enabled: true, maxScale: 4 });
});

test('resolveSlideshowConfig：默认开启 4000ms；覆盖生效；4000 非法回退；钳制 1000–60000', async () => {
  // switch: features.lightbox.slideshow.enabled, features.lightbox.slideshow.intervalMs
  const c = await loadCore();
  assert.deepStrictEqual(c.resolveSlideshowConfig({}), { enabled: true, intervalMs: 4000 });
  assert.deepStrictEqual(c.resolveSlideshowConfig(null), { enabled: true, intervalMs: 4000 });
  assert.deepStrictEqual(
    c.resolveSlideshowConfig({ slideshow: { enabled: false, intervalMs: 2500 } }),
    { enabled: false, intervalMs: 2500 }
  );
  assert.strictEqual(c.resolveSlideshowConfig({ slideshow: { intervalMs: 200 } }).intervalMs, 1000);
  assert.strictEqual(c.resolveSlideshowConfig({ slideshow: { intervalMs: 999999 } }).intervalMs, 60000);
  assert.strictEqual(c.resolveSlideshowConfig({ slideshow: { intervalMs: 'x' } }).intervalMs, 4000);
  assert.deepStrictEqual(c.resolveSlideshowConfig({ slideshow: 'bad' }), { enabled: true, intervalMs: 4000 });
});

test('clampZoom：区间钳制与非法输入回退下限', async () => {
  const c = await loadCore();
  assert.strictEqual(c.clampZoom(5, 1, 4), 4);
  assert.strictEqual(c.clampZoom(0.5, 1, 4), 1);
  assert.strictEqual(c.clampZoom(2, 1, 4), 2);
  assert.strictEqual(c.clampZoom(NaN, 1, 4), 1);
  assert.strictEqual(c.clampZoom('x', 1, 4), 1);
  assert.strictEqual(c.clampZoom(3, 2, 2), 2);
});

const BIG = { width: 2000, height: 1500 };
const VIEW = { width: 1000, height: 800 };

test('computeZoomAt：锚点缩放保持指针下的图像点不动', async () => {
  const c = await loadCore();
  const out = c.computeZoomAt(
    { scale: 1, px: 0, py: 0 },
    2,
    { min: 1, max: 4, rotation: 0, anchor: { x: 750, y: 400 }, viewport: VIEW, content: BIG }
  );
  assert.deepStrictEqual(out, { scale: 2, px: -250, py: 0 });
});

test('computeZoomAt：缩回 1x 平移归零；超上限被钳制', async () => {
  const c = await loadCore();
  const back = c.computeZoomAt(
    { scale: 2, px: -250, py: 120 },
    0.5,
    { min: 1, max: 4, rotation: 0, anchor: { x: 750, y: 400 }, viewport: VIEW, content: BIG }
  );
  assert.deepStrictEqual(back, { scale: 1, px: 0, py: 0 });
  const capped = c.computeZoomAt(
    { scale: 1, px: 0, py: 0 },
    10,
    { min: 1, max: 4, rotation: 0, anchor: null, viewport: VIEW, content: BIG }
  );
  assert.strictEqual(capped.scale, 4);
});

test('computeZoomAt：旋转态不调整锚点只钳制；小内容放大后仍居中', async () => {
  const c = await loadCore();
  const rotated = c.computeZoomAt(
    { scale: 1, px: 0, py: 0 },
    2,
    { min: 1, max: 4, rotation: 90, anchor: { x: 750, y: 400 }, viewport: VIEW, content: BIG }
  );
  assert.deepStrictEqual(rotated, { scale: 2, px: 0, py: 0 });
  const small = c.computeZoomAt(
    { scale: 1, px: 0, py: 0 },
    2,
    { min: 1, max: 4, rotation: 0, anchor: { x: 750, y: 400 }, viewport: VIEW, content: { width: 400, height: 300 } }
  );
  assert.deepStrictEqual(small, { scale: 2, px: 0, py: 0 });
});

test('clampPan：内容大于视口时限幅到边缘贴齐；小于视口时归零', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(
    c.clampPan(99999, -99999, { scale: 2, rotation: 0, viewport: VIEW, content: BIG }),
    { px: 1500, py: -1100 }
  );
  assert.deepStrictEqual(
    c.clampPan(300, 300, { scale: 2, rotation: 0, viewport: VIEW, content: { width: 400, height: 300 } }),
    { px: 0, py: 0 }
  );
});

test('clampPan：旋转 90° 交换有效宽高；非法缩放视作不可移动', async () => {
  const c = await loadCore();
  assert.deepStrictEqual(
    c.clampPan(-300, 700, { scale: 1, rotation: 90, viewport: VIEW, content: BIG }),
    { px: -250, py: 600 }
  );
  assert.deepStrictEqual(
    c.clampPan(50, 50, { scale: 0, rotation: 0, viewport: VIEW, content: BIG }),
    { px: 0, py: 0 }
  );
});

const TOUCH_BASE = { swipePx: 50, closePx: 80, swipeEnabled: true, closeEnabled: true };

test('classifyTouchSwipe：缩放态禁用切图与下拉关闭', async () => {
  const c = await loadCore();
  assert.strictEqual(
    c.classifyTouchSwipe(Object.assign({}, TOUCH_BASE, { dx: -200, dy: 0, zoomed: true })),
    null
  );
  assert.strictEqual(
    c.classifyTouchSwipe(Object.assign({}, TOUCH_BASE, { dx: 0, dy: 200, zoomed: true })),
    null
  );
});

test('classifyTouchSwipe：下拉关闭优先于横滑；上滑不关闭', async () => {
  const c = await loadCore();
  assert.strictEqual(
    c.classifyTouchSwipe(Object.assign({}, TOUCH_BASE, { dx: 10, dy: 100, zoomed: false })),
    'close'
  );
  assert.strictEqual(
    c.classifyTouchSwipe(Object.assign({}, TOUCH_BASE, { dx: 0, dy: -100, zoomed: false })),
    null
  );
  assert.strictEqual(
    c.classifyTouchSwipe(Object.assign({}, TOUCH_BASE, { dx: 10, dy: 100, zoomed: false, closeEnabled: false })),
    null
  );
});

test('classifyTouchSwipe：横滑切图方向与阈值、对角不判定', async () => {
  const c = await loadCore();
  const at = (dx, dy) => c.classifyTouchSwipe(Object.assign({}, TOUCH_BASE, { dx, dy, zoomed: false }));
  assert.strictEqual(at(-60, 5), 'next');
  assert.strictEqual(at(60, 5), 'prev');
  assert.strictEqual(at(40, 5), null);
  assert.strictEqual(at(100, 100), null);
  assert.strictEqual(
    c.classifyTouchSwipe(Object.assign({}, TOUCH_BASE, { dx: 60, dy: 0, zoomed: false, swipeEnabled: false })),
    null
  );
});

test('classifyMouseSwipe：缩放/旋转态禁用、方向与阈值', async () => {
  const c = await loadCore();
  const at = (info) => c.classifyMouseSwipe(Object.assign({ dx: 0, zoomed: false, rotated: false, threshold: 80 }, info));
  assert.strictEqual(at({ dx: -100 }), 'next');
  assert.strictEqual(at({ dx: 100 }), 'prev');
  assert.strictEqual(at({ dx: 80 }), null);
  assert.strictEqual(at({ dx: -100, zoomed: true }), null);
  assert.strictEqual(at({ dx: -100, rotated: true }), null);
});

test('keyboardAction：Esc 两段退出；方向键缩放态禁用、关闭时禁用', async () => {
  const c = await loadCore();
  const esc = { esc: true, navigate: true };
  assert.strictEqual(c.keyboardAction('Escape', { zoomed: true }, esc), 'reset-view');
  assert.strictEqual(c.keyboardAction('Escape', { zoomed: false }, esc), 'close');
  assert.strictEqual(c.keyboardAction('Escape', { zoomed: false }, { esc: false, navigate: true }), null);
  assert.strictEqual(c.keyboardAction('ArrowLeft', { zoomed: false }, esc), 'prev');
  assert.strictEqual(c.keyboardAction('ArrowRight', { zoomed: false }, esc), 'next');
  assert.strictEqual(c.keyboardAction('ArrowLeft', { zoomed: true }, esc), null);
  assert.strictEqual(c.keyboardAction('ArrowRight', { zoomed: true }, esc), null);
  assert.strictEqual(c.keyboardAction('ArrowLeft', { zoomed: false }, { esc: true, navigate: false }), null);
  assert.strictEqual(c.keyboardAction('a', { zoomed: false }, esc), null);
});

test('shouldAutoPlay：开启且非减少动效时自动播放', async () => {
  const c = await loadCore();
  assert.strictEqual(c.shouldAutoPlay({ enabled: true }, false), true);
  assert.strictEqual(c.shouldAutoPlay({ enabled: true }, true), false);
  assert.strictEqual(c.shouldAutoPlay({ enabled: false }, false), false);
  assert.strictEqual(c.shouldAutoPlay(null, false), false);
});

test('slideshowReduce：打开自动播放、按钮切换、关闭停止', async () => {
  const c = await loadCore();
  const initial = { playing: false, autoSuspended: false };
  const opened = c.slideshowReduce(initial, { type: 'open', autoPlay: true });
  assert.deepStrictEqual(opened.state, { playing: true, autoSuspended: false });
  const noAuto = c.slideshowReduce(initial, { type: 'open', autoPlay: false });
  assert.deepStrictEqual(noAuto.state, { playing: false, autoSuspended: false });
  const paused = c.slideshowReduce(opened.state, { type: 'toggle' });
  assert.deepStrictEqual(paused.state, { playing: false, autoSuspended: false });
  const resumed = c.slideshowReduce(paused.state, { type: 'toggle' });
  assert.deepStrictEqual(resumed.state, { playing: true, autoSuspended: false });
  const closed = c.slideshowReduce(resumed.state, { type: 'close' });
  assert.deepStrictEqual(closed.state, { playing: false, autoSuspended: false });
});

test('slideshowReduce：页面隐藏挂起、恢复可见续播', async () => {
  const c = await loadCore();
  const playing = { playing: true, autoSuspended: false };
  const hidden = c.slideshowReduce(playing, { type: 'hidden' });
  assert.deepStrictEqual(hidden.state, { playing: false, autoSuspended: true });
  const hiddenAgain = c.slideshowReduce(hidden.state, { type: 'hidden' });
  assert.deepStrictEqual(hiddenAgain.state, { playing: false, autoSuspended: true });
  const visible = c.slideshowReduce(hidden.state, { type: 'visible' });
  assert.deepStrictEqual(visible.state, { playing: true, autoSuspended: false });
  const idleHidden = c.slideshowReduce({ playing: false, autoSuspended: false }, { type: 'hidden' });
  assert.deepStrictEqual(idleHidden.state, { playing: false, autoSuspended: false });
  const idleVisible = c.slideshowReduce(idleHidden.state, { type: 'visible' });
  assert.deepStrictEqual(idleVisible.state, { playing: false, autoSuspended: false });
});

test('slideshowReduce：tick 推进条件（播放中、未缩放、多图）', async () => {
  const c = await loadCore();
  const playing = { playing: true, autoSuspended: false };
  assert.strictEqual(c.slideshowReduce(playing, { type: 'tick', zoomed: false, count: 3 }).advance, true);
  assert.strictEqual(c.slideshowReduce(playing, { type: 'tick', zoomed: true, count: 3 }).advance, false);
  assert.strictEqual(c.slideshowReduce(playing, { type: 'tick', zoomed: false, count: 1 }).advance, false);
  assert.strictEqual(c.slideshowReduce(playing, { type: 'tick', zoomed: false, count: 0 }).advance, false);
  assert.strictEqual(c.slideshowReduce({ playing: false, autoSuspended: false }, { type: 'tick', zoomed: false, count: 3 }).advance, false);
});

test('slideshowReduce：纯函数不修改入参，未知事件保持状态', async () => {
  const c = await loadCore();
  const state = Object.freeze({ playing: true, autoSuspended: false });
  const out = c.slideshowReduce(state, { type: 'bogus' });
  assert.deepStrictEqual(out.state, { playing: true, autoSuspended: false });
  assert.deepStrictEqual(state, { playing: true, autoSuspended: false });
  const missing = c.slideshowReduce(undefined, undefined);
  assert.deepStrictEqual(missing.state, { playing: false, autoSuspended: false });
});
