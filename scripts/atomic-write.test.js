'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeFileAtomicSync, atomicTempPath, commitAtomicTemp, discardAtomicTemp } = require('./lib/atomic-write');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-atomic-'));
}

describe('atomic-write', () => {
  test('写入新文件内容', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'a.txt');
    writeFileAtomicSync(file, 'hello');
    assert.strictEqual(fs.readFileSync(file, 'utf-8'), 'hello');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('覆盖已有文件内容', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'a.txt');
    fs.writeFileSync(file, 'old');
    writeFileAtomicSync(file, 'new');
    assert.strictEqual(fs.readFileSync(file, 'utf-8'), 'new');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('成功写入后不留临时文件', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'a.txt');
    writeFileAtomicSync(file, Buffer.from('bin'));
    const leftovers = fs.readdirSync(dir).filter((n) => n.includes('.tmp-'));
    assert.deepStrictEqual(leftovers, []);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('目标目录不存在时抛出且不留临时文件', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'missing-sub', 'a.txt');
    assert.throws(() => writeFileAtomicSync(file, 'x'));
    const leftovers = fs.readdirSync(dir).filter((n) => n.includes('.tmp-'));
    assert.deepStrictEqual(leftovers, []);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('atomicTempPath 以最终路径为前缀且包含 .tmp- 标记', () => {
    const final = path.join('D:', 'x', 'dist', 'a.html');
    const tmp = atomicTempPath(final);
    assert.ok(tmp.startsWith(final));
    assert.ok(tmp.includes('.tmp-'));
    assert.notStrictEqual(tmp, final);
  });

  test('commitAtomicTemp 将临时文件重命名为最终文件', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'a.bin');
    const tmp = atomicTempPath(file);
    fs.writeFileSync(tmp, 'data');
    commitAtomicTemp(tmp, file);
    assert.strictEqual(fs.readFileSync(file, 'utf-8'), 'data');
    assert.ok(!fs.existsSync(tmp));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('commitAtomicTemp 失败时清理临时文件并抛出', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'no-such-dir', 'a.bin');
    const tmp = path.join(dir, 'a.bin.tmp-1');
    fs.writeFileSync(tmp, 'data');
    assert.throws(() => commitAtomicTemp(tmp, file));
    assert.ok(!fs.existsSync(tmp));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('discardAtomicTemp 清理临时文件且不存在时不报错', () => {
    const dir = tmpDir();
    const tmp = path.join(dir, 'a.txt.tmp-9');
    fs.writeFileSync(tmp, 'x');
    discardAtomicTemp(tmp);
    assert.ok(!fs.existsSync(tmp));
    discardAtomicTemp(tmp);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
