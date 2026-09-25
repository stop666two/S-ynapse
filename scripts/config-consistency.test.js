const test = require('node:test');
const assert = require('node:assert');
const { compareFeatures } = require('./lib/config-consistency');

test('compareFeatures: 值与默认不同 → 记为覆盖而非错误', () => {
  const { errors, overrides } = compareFeatures({ a: 1, b: 'x' }, { a: 2, b: 'x' });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(overrides.length, 1);
  assert.match(overrides[0], /features\.a/);
});

test('compareFeatures: 配置键在 schema 缺失 → 错误', () => {
  const { errors } = compareFeatures({ a: 1, ghost: true }, { a: 1 });
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /features\.ghost/);
});

test('compareFeatures: 数组类型不一致 → 错误', () => {
  const { errors } = compareFeatures({ a: [] }, { a: 'x' });
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /类型不一致/);
});

test('compareFeatures: 数组元素值覆盖不报错', () => {
  const { errors, overrides } = compareFeatures({ a: ['u1'] }, { a: ['d1'] });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(overrides.length, 1);
});

test('compareFeatures: 空数组默认跳过元素比较', () => {
  const { errors, overrides } = compareFeatures({ a: ['u1'] }, { a: [] });
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(overrides, []);
});

test('compareFeatures: 嵌套对象内缺失键 → 每键一条错误且不递归', () => {
  const { errors } = compareFeatures({ a: { ghost: 1 } }, { a: {} });
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /features\.a\.ghost/);
});

test('compareFeatures: 对象键缺失时对深层对象只报父键一次', () => {
  const { errors } = compareFeatures({ a: { b: { c: 1 } } }, {});
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /features\.a/);
});
