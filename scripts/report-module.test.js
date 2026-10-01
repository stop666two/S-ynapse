'use strict';
// report.js writeBuildReportText 的自有属性语义：输入携带自有 '__proto__' 键时，
// 数据拷贝不得改写原型，继承键不得渗入 report.txt。写入临时 distDir，不触碰仓库产物。
// 运行：node --test scripts/report-module.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createReportModule } = require('./build/report.js');

function capture(fn) {
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = function () {};
  console.warn = function () {};
  console.error = function () {};
  try {
    return fn();
  } finally {
    Object.assign(console, orig);
  }
}

test('writeBuildReportText：自有 __proto__ 键不渗入报告且原型不被改写', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-report-'));
  try {
    const report = createReportModule({ distDir });
    const input = { totalMs: 10 };
    Object.defineProperty(input, '__proto__', {
      value: { generatedAt: 'INHERITED', totalMs: 999999 },
      enumerable: true,
      writable: true,
      configurable: true
    });
    capture(function () { report.writeBuildReportText(input); });
    const text = fs.readFileSync(path.join(distDir, 'report.txt'), 'utf-8');
    assert.ok(text.includes('生成时间(UTC): 未记录'), '缺失的自有键不得从被改写原型继承：\n' + text);
    assert.ok(!text.includes('INHERITED'), '继承键不得渗入报告');
    assert.ok(text.includes('总耗时: 10ms'), '自有键照常渲染');
    assert.strictEqual(({}).polluted, undefined);
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('writeBuildReportText：输入缺省时按容错路径写出报告', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-report-'));
  try {
    const report = createReportModule({ distDir });
    capture(function () { report.writeBuildReportText(); });
    const text = fs.readFileSync(path.join(distDir, 'report.txt'), 'utf-8');
    assert.ok(text.includes('生成时间(UTC): 未记录'));
    assert.ok(text.includes('[告警]'));
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});
