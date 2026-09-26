'use strict';
// 本地开发服务器压缩（T5）单测：验证按 Accept-Encoding 的 gzip 行为与二进制透传，
// 并保持既有缓存语义（ETag 304）。无网络依赖，使用随机端口与临时 dist 目录。
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { createServeModule } = require('./build/serve.js');

const MOCK_CONFIG = {
  site: { language: 'zh-CN' },
  theme: { colors: { background: '#ffffff', text: '#111111', textSecondary: '#555555' } }
};

function makeDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-serve-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body>' + '<p>重复文本，用于验证压缩收益。</p>'.repeat(200) + '</body></html>', 'utf8');
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log("' + 'x'.repeat(5000) + '");\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'assets', 'pic.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]), 'binary');
  fs.writeFileSync(path.join(dir, '404.html'), '<!doctype html><html><body>404</body></html>', 'utf8');
  return dir;
}

function request(port, urlPath, headers, options) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, headers: headers || {}, agent: false, method: (options && options.method) || 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
  });
}

async function startTestServer(distDir) {
  const mod = createServeModule({ distDir });
  const server = mod.startServer(MOCK_CONFIG, { port: 0 });
  await new Promise((resolve) => { server.listening ? resolve() : server.once('listening', resolve); });
  return server;
}

test('gzip：声明 Accept-Encoding 的文本资源返回 gzip 且可解压还原', async (t) => {
  const distDir = makeDist();
  const server = await startTestServer(distDir);
  t.after(() => { server.close(); fs.rmSync(distDir, { recursive: true, force: true }); });
  const port = server.address().port;

  const gz = await request(port, '/', { 'Accept-Encoding': 'gzip, deflate, br' });
  assert.strictEqual(gz.status, 200);
  assert.strictEqual(gz.headers['content-encoding'], 'gzip');
  assert.strictEqual(gz.headers.vary, 'Accept-Encoding');
  const html = fs.readFileSync(path.join(distDir, 'index.html'));
  assert.ok(gz.body.length < html.length, 'gzip 后体积应小于原始 HTML');
  assert.strictEqual(zlib.gunzipSync(gz.body).toString('utf8'), html.toString('utf8'));

  const js = await request(port, '/assets/app.js', { 'Accept-Encoding': 'gzip' });
  assert.strictEqual(js.headers['content-encoding'], 'gzip');
  assert.ok(zlib.gunzipSync(js.body).toString('utf8').startsWith('console.log('));
});

test('无 Accept-Encoding 或 q=0 时原样返回（不改变行为语义）', async (t) => {
  const distDir = makeDist();
  const server = await startTestServer(distDir);
  t.after(() => { server.close(); fs.rmSync(distDir, { recursive: true, force: true }); });
  const port = server.address().port;

  const plain = await request(port, '/');
  assert.strictEqual(plain.status, 200);
  assert.strictEqual(plain.headers['content-encoding'], undefined);
  assert.strictEqual(plain.headers.vary, 'Accept-Encoding');
  assert.strictEqual(plain.body.length, fs.statSync(path.join(distDir, 'index.html')).size);

  const refused = await request(port, '/', { 'Accept-Encoding': 'gzip;q=0' });
  assert.strictEqual(refused.headers['content-encoding'], undefined);
});

test('二进制资源即使声明 gzip 也不压缩（MIME 白名单）', async (t) => {
  const distDir = makeDist();
  const server = await startTestServer(distDir);
  t.after(() => { server.close(); fs.rmSync(distDir, { recursive: true, force: true }); });
  const port = server.address().port;

  const png = await request(port, '/assets/pic.png', { 'Accept-Encoding': 'gzip' });
  assert.strictEqual(png.status, 200);
  assert.strictEqual(png.headers['content-encoding'], undefined);
  assert.deepStrictEqual(png.body, fs.readFileSync(path.join(distDir, 'assets', 'pic.png')));
});

test('缓存语义与 404 回退在压缩路径下保持', async (t) => {
  const distDir = makeDist();
  const server = await startTestServer(distDir);
  t.after(() => { server.close(); fs.rmSync(distDir, { recursive: true, force: true }); });
  const port = server.address().port;

  const first = await request(port, '/', { 'Accept-Encoding': 'gzip' });
  const cached = await request(port, '/', { 'Accept-Encoding': 'gzip', 'If-None-Match': first.headers.etag });
  assert.strictEqual(cached.status, 304);
  assert.strictEqual(cached.body.length, 0);

  const missing = await request(port, '/no-such-page/', { 'Accept-Encoding': 'gzip' });
  assert.strictEqual(missing.status, 404);
  assert.strictEqual(zlib.gunzipSync(missing.body).toString('utf8'), fs.readFileSync(path.join(distDir, '404.html'), 'utf8'));
});
