'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { resolveOgFormat } = require('./lib/og-format');

describe('og-format resolveOgFormat', () => {
  test('默认 png 且不产生质量值', () => {
    assert.deepStrictEqual(resolveOgFormat({}), { format: 'png', ext: 'png', quality: null });
  });
  test('jpeg 使用默认质量 82', () => {
    assert.deepStrictEqual(resolveOgFormat({ format: 'jpeg' }), { format: 'jpeg', ext: 'jpg', quality: 82 });
  });
  test('jpg 别名大小写不敏感归一为 jpeg', () => {
    assert.strictEqual(resolveOgFormat({ format: 'JPG' }).format, 'jpeg');
    assert.strictEqual(resolveOgFormat({ format: 'Jpeg' }).ext, 'jpg');
  });
  test('未知格式回退 png', () => {
    assert.strictEqual(resolveOgFormat({ format: 'webp' }).format, 'png');
    assert.strictEqual(resolveOgFormat({ format: 123 }).format, 'png');
  });
  test('质量值越界/非法回退默认 82', () => {
    assert.strictEqual(resolveOgFormat({ format: 'jpeg', jpegQuality: 0 }).quality, 82);
    assert.strictEqual(resolveOgFormat({ format: 'jpeg', jpegQuality: 101 }).quality, 82);
    assert.strictEqual(resolveOgFormat({ format: 'jpeg', jpegQuality: 'abc' }).quality, 82);
    assert.strictEqual(resolveOgFormat({ format: 'jpeg', jpegQuality: NaN }).quality, 82);
  });
  test('合法质量值四舍五入生效', () => {
    assert.strictEqual(resolveOgFormat({ format: 'jpeg', jpegQuality: 55.6 }).quality, 56);
    assert.strictEqual(resolveOgFormat({ format: 'jpeg', jpegQuality: 60 }).quality, 60);
  });
  test('png 模式下质量值无意义（返回 null）', () => {
    assert.strictEqual(resolveOgFormat({ format: 'png', jpegQuality: 40 }).quality, null);
  });
});
