'use strict';

// dist 产物归一化哈希护栏单测：
//   - normalizeContent：nonce（HTML 属性 / CSP 令牌两种形态）与 CRLF 归一化；
//   - listDistFiles：递归、POSIX 路径、排序、忽略项（文件与目录子树）；
//   - hashDist：nonce/CRLF 不敏感、内容变更敏感、二进制按原始字节哈希；
//   - diffManifests：新增/删除/变更三分类与排序。
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeContent, listDistFiles, hashDist, diffManifests, DEFAULT_IGNORES } = require('./lib/dist-hash');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-dist-hash-'));
}

function writeFixture(dir, rel, content) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('dist-hash normalizeContent', () => {
  test('HTML 的 nonce 属性归一化为 NONCE', () => {
    const html = '<script nonce="AbC+/==">console.log(1)</script>';
    assert.strictEqual(normalizeContent('index.html', html), '<script nonce="NONCE">console.log(1)</script>');
  });

  test('_headers 的引号 nonce 令牌归一化且保留引号', () => {
    const headers = "script-src 'self' 'nonce-AbC+/=='; style-src 'self'";
    assert.strictEqual(normalizeContent('_headers', headers), "script-src 'self' 'nonce-NONCE'; style-src 'self'");
  });

  test('裸 nonce 令牌（无引号）同样归一化', () => {
    assert.strictEqual(normalizeContent('_headers', 'nonce-AbC+/== rest'), 'nonce-NONCE rest');
  });

  test('CRLF 归一化为 LF 且不影响其他字符', () => {
    const out = normalizeContent('index.html', '<p>a</p>\r\n<p>b</p>\r\n');
    assert.strictEqual(out, '<p>a</p>\n<p>b</p>\n');
    assert.ok(!out.includes('\r'));
  });

  test('同一内容不同 nonce 归一化结果一致', () => {
    const a = normalizeContent('index.html', '<script nonce="AAA+/==">x</script>');
    const b = normalizeContent('index.html', '<script nonce="BBB+/==">x</script>');
    assert.strictEqual(a, b);
  });
});

describe('dist-hash listDistFiles', () => {
  test('递归列出 POSIX 相对路径且排序', () => {
    const dir = tmpDir();
    writeFixture(dir, path.join('zh', 'index.html'), 'a');
    writeFixture(dir, 'index.html', 'b');
    writeFixture(dir, path.join('assets', 'css', 'main.css'), 'c');
    assert.deepStrictEqual(listDistFiles(dir, []), ['assets/css/main.css', 'index.html', 'zh/index.html']);
    cleanup(dir);
  });

  test('默认忽略 build-report.html 与 og/ 子树', () => {
    const dir = tmpDir();
    writeFixture(dir, 'index.html', 'a');
    writeFixture(dir, path.join('og', 'zh', 'cover.png'), 'b');
    writeFixture(dir, 'build-report.html', 'c');
    assert.deepStrictEqual(DEFAULT_IGNORES, ['build-report.html', 'og/']);
    assert.deepStrictEqual(listDistFiles(dir), ['index.html']);
    cleanup(dir);
  });

  test('自定义忽略项同时匹配文件与目录前缀子树', () => {
    const dir = tmpDir();
    writeFixture(dir, 'keep.txt', 'a');
    writeFixture(dir, 'skip.txt', 'b');
    writeFixture(dir, path.join('tmp', 'x', 'y.txt'), 'c');
    assert.deepStrictEqual(listDistFiles(dir, ['skip.txt', 'tmp/']), ['keep.txt']);
    cleanup(dir);
  });
});

describe('dist-hash hashDist', () => {
  test('nonce 变化不影响哈希（HTML 与 _headers）', () => {
    const dir = tmpDir();
    const html = (n) => '<!DOCTYPE html><script nonce="' + n + '">x()</script>';
    const headers = (n) => "Content-Security-Policy: script-src 'self' 'nonce-" + n + "'\n";
    writeFixture(dir, 'index.html', html('AAA+/=='));
    writeFixture(dir, '_headers', headers('AAA+/=='));
    const first = hashDist(dir);
    writeFixture(dir, 'index.html', html('BBB+/=='));
    writeFixture(dir, '_headers', headers('BBB+/=='));
    const second = hashDist(dir);
    assert.strictEqual(first.total, 2);
    assert.deepStrictEqual(second.files, first.files);
    cleanup(dir);
  });

  test('CRLF 与 LF 内容哈希一致', () => {
    const dir = tmpDir();
    writeFixture(dir, 'a.txt', 'line1\nline2\n');
    const lf = hashDist(dir);
    writeFixture(dir, 'a.txt', 'line1\r\nline2\r\n');
    const crlf = hashDist(dir);
    assert.strictEqual(crlf.files['a.txt'], lf.files['a.txt']);
    cleanup(dir);
  });

  test('内容变更产生不同哈希', () => {
    const dir = tmpDir();
    writeFixture(dir, 'a.txt', 'v1');
    const before = hashDist(dir);
    writeFixture(dir, 'a.txt', 'v2');
    const after = hashDist(dir);
    assert.notStrictEqual(after.files['a.txt'], before.files['a.txt']);
    cleanup(dir);
  });

  test('不同无效 UTF-8 二进制内容不产生等价假象', () => {
    const dir = tmpDir();
    writeFixture(dir, 'a.bin', Buffer.from([0xff, 0x00, 0x01]));
    const before = hashDist(dir);
    writeFixture(dir, 'a.bin', Buffer.from([0xfe, 0x00, 0x01]));
    const after = hashDist(dir);
    assert.notStrictEqual(after.files['a.bin'], before.files['a.bin']);
    cleanup(dir);
  });

  test('哈希忽略默认忽略项', () => {
    const dir = tmpDir();
    writeFixture(dir, 'index.html', 'a');
    writeFixture(dir, 'build-report.html', 'b');
    writeFixture(dir, path.join('og', 'en', 'x.png'), 'c');
    const result = hashDist(dir);
    assert.strictEqual(result.total, 1);
    assert.deepStrictEqual(Object.keys(result.files), ['index.html']);
    cleanup(dir);
  });
});

describe('dist-hash diffManifests', () => {
  test('检测新增/删除/变更并排序', () => {
    const a = { files: { b: '1', c: '2', a: '3' } };
    const b = { files: { a: '3', c: '9', d: '4' } };
    assert.deepStrictEqual(diffManifests(a, b), { added: ['d'], removed: ['b'], changed: ['c'] });
  });

  test('完全一致时三类差异均为空', () => {
    const manifest = { files: { 'a.txt': 'x', 'b/c.txt': 'y' } };
    assert.deepStrictEqual(
      diffManifests(manifest, { files: { 'a.txt': 'x', 'b/c.txt': 'y' } }),
      { added: [], removed: [], changed: [] }
    );
  });

  test('清单缺少 files 字段时抛出中文错误', () => {
    assert.throws(() => diffManifests({}, { files: {} }), /清单格式无效/);
  });
});
