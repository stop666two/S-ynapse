const { test } = require('node:test');
const assert = require('node:assert');
const { resolveOgSize, DEFAULT_OG_SIZE, MAX_OG_DIMENSION } = require('./lib/og-size');

test('无封面无显式配置时回退默认 1200x630', () => {
  const r = resolveOgSize({ covers: [] });
  assert.deepStrictEqual(r, { width: 1200, height: 630, source: 'default', scaled: false });
  assert.strictEqual(DEFAULT_OG_SIZE.width, 1200);
  assert.strictEqual(DEFAULT_OG_SIZE.height, 630);
});

test('显式 width/height 始终优先且不设上限', () => {
  const r = resolveOgSize({ explicitWidth: 4000, explicitHeight: 8000, covers: [{ width: 800, height: 400 }] });
  assert.deepStrictEqual(r, { width: 4000, height: 8000, source: 'explicit', scaled: false });
});

test('仅提供单边显式值时忽略并回退自动检测', () => {
  const r = resolveOgSize({ explicitWidth: 1000, explicitHeight: null, covers: [{ width: 800, height: 400 }] });
  assert.deepStrictEqual(r, { width: 800, height: 400, source: 'single', scaled: false });
});

test('唯一封面时采用该封面尺寸', () => {
  const r = resolveOgSize({ covers: [{ width: 1024, height: 512 }] });
  assert.deepStrictEqual(r, { width: 1024, height: 512, source: 'single', scaled: false });
});

test('多张封面取面积最大者', () => {
  const r = resolveOgSize({ covers: [{ width: 800, height: 600 }, { width: 1920, height: 1080 }, { width: 1000, height: 1000 }] });
  assert.deepStrictEqual(r, { width: 1920, height: 1080, source: 'largest', scaled: false });
});

test('面积相同时以更宽者优先，再平局取更高者', () => {
  const wide = resolveOgSize({ covers: [{ width: 1000, height: 500 }, { width: 500, height: 1000 }] });
  assert.strictEqual(wide.width, 1000);
  assert.strictEqual(wide.height, 500);
});

test('非法封面条目被过滤', () => {
  const r = resolveOgSize({ covers: [null, { width: 0, height: 100 }, { width: -5, height: 10 }, { width: NaN, height: 10 }, { width: 640, height: 360 }] });
  assert.deepStrictEqual(r, { width: 640, height: 360, source: 'single', scaled: false });
});

test('长边超上限时等比缩小（宽图）', () => {
  const r = resolveOgSize({ covers: [{ width: 3000, height: 1500 }] });
  assert.deepStrictEqual(r, { width: 2560, height: 1280, source: 'single', scaled: true });
  assert.strictEqual(MAX_OG_DIMENSION, 2560);
});

test('长边超上限时等比缩小（高图，取整不小于 1）', () => {
  const r = resolveOgSize({ covers: [{ width: 1000, height: 3000 }] });
  assert.deepStrictEqual(r, { width: 853, height: 2560, source: 'single', scaled: true });
});

test('autoSize 关闭时忽略封面并回退默认（显式仍优先）', () => {
  const r = resolveOgSize({ covers: [{ width: 1920, height: 1080 }], autoSize: false });
  assert.deepStrictEqual(r, { width: 1200, height: 630, source: 'default', scaled: false });
  const e = resolveOgSize({ covers: [{ width: 1920, height: 1080 }], autoSize: false, explicitWidth: 900, explicitHeight: 300 });
  assert.deepStrictEqual(e, { width: 900, height: 300, source: 'explicit', scaled: false });
});

test('maxDimension 可配置且非法值回退 2560', () => {
  const r = resolveOgSize({ covers: [{ width: 3000, height: 1500 }], maxDimension: 2000 });
  assert.deepStrictEqual(r, { width: 2000, height: 1000, source: 'single', scaled: true });
  const bad = resolveOgSize({ covers: [{ width: 3000, height: 1500 }], maxDimension: -1 });
  assert.strictEqual(bad.width, 2560);
});
