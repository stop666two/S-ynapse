'use strict';
// report.js generateBuildReport 的自有属性语义与容错：输入携带自有 '__proto__' 键时，
// 生成过程不得改写原型，继承键不得渗入 build-report.html。写入临时 distDir，不触碰仓库产物。
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

function readReport(distDir) {
  return fs.readFileSync(path.join(distDir, 'build-report.html'), 'utf-8');
}

test('generateBuildReport：自有 __proto__ 键不渗入报告且原型不被改写', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-report-'));
  try {
    const report = createReportModule({ distDir: distDir });
    const input = { totalMs: 10 };
    Object.defineProperty(input, '__proto__', {
      value: { generatedAt: 'INHERITED', version: 'INHERITED', totalMs: 999999 },
      enumerable: true,
      writable: true,
      configurable: true
    });
    capture(function () { report.generateBuildReport(input); });
    const html = readReport(distDir);
    assert.ok(html.includes('生成时间(UTC)'), '报告必须包含元信息区块');
    assert.ok(!html.includes('INHERITED'), '继承键不得渗入报告');
    assert.ok(html.includes('总耗时'), '自有键照常渲染');
    assert.strictEqual(({}).polluted, undefined);
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('generateBuildReport：输入缺省时按容错路径写出唯一报告', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-report-'));
  try {
    const report = createReportModule({ distDir: distDir });
    capture(function () { report.generateBuildReport(); });
    const html = readReport(distDir);
    assert.ok(html.includes('构建报告'));
    assert.ok(html.includes('未记录'));
    assert.ok(!fs.existsSync(path.join(distDir, 'report.txt')), '不得再产出 report.txt');
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});
