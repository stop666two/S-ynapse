'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePopupNotice } = require('./lib/popup-notice-config');

test('null 配置直接通过', () => {
  const r = validatePopupNotice(null);
  assert.deepEqual(r.errors, []);
});

test('默认配置无错误', () => {
  const r = validatePopupNotice({
    enabled: false, delayMs: 1500, frequency: 'day', reshowOnChange: true,
    storageKey: 's-popupNotice', width: '440px',
    qr: { enabled: false, src: '', caption: '', captionEn: '' },
    buttons: [],
    closeButton: { enabled: true, label: '知道了', labelEn: 'Got it', style: 'primary' },
    closeIcon: true, closeOnBackdrop: true, escToClose: true,
    colors: { overlay: '', background: '', text: '', textSecondary: '', border: '', primary: '', primaryText: '', ghost: '' }
  });
  assert.deepEqual(r.errors, []);
});

test('frequency 非法值报错', () => {
  assert.equal(validatePopupNotice({ frequency: 'weekly' }).errors.length, 1);
});

test('delayMs 负数报错', () => {
  assert.equal(validatePopupNotice({ delayMs: -1 }).errors.length, 1);
  assert.equal(validatePopupNotice({ delayMs: 0 }).errors.length, 0);
});

test('按钮必须提供 label 或 labelEn', () => {
  const r = validatePopupNotice({ buttons: [{ url: '/about/' }] });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /buttons\[0\]/);
});

test('按钮 style 白名单', () => {
  assert.equal(validatePopupNotice({ buttons: [{ label: '好', style: 'danger' }] }).errors.length, 1);
  assert.equal(validatePopupNotice({ buttons: [{ label: '好', style: 'ghost' }] }).errors.length, 0);
});

test('qr.enabled 为 true 时必须提供 src', () => {
  assert.equal(validatePopupNotice({ qr: { enabled: true } }).errors.length, 1);
  assert.equal(validatePopupNotice({ qr: { enabled: true, src: '/media/qr.png' } }).errors.length, 0);
});

test('colors 值必须为字符串且未知键告警', () => {
  const r1 = validatePopupNotice({ colors: { primary: 123 } });
  assert.equal(r1.errors.length, 1);
  const r2 = validatePopupNotice({ colors: { shadow: '#000' } });
  assert.equal(r2.errors.length, 0);
  assert.equal(r2.warnings.length, 1);
});

test('启用且所有关闭方式禁用时报错', () => {
  const r = validatePopupNotice({
    enabled: true, body: '内容',
    closeButton: { enabled: false }, closeIcon: false, closeOnBackdrop: false, escToClose: false
  });
  assert.equal(r.errors.length, 1);
});

test('启用但内容为空时告警', () => {
  const r = validatePopupNotice({ enabled: true });
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.length, 1);
});
