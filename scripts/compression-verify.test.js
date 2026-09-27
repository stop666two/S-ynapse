'use strict';
// 压缩无头对比验证（scripts/lib/compression-verify.js）纯逻辑单测：
// 快照目标枚举 / 基线快照建立与恢复（覆写、孤儿清理、缺文件重建、逐字节复核）、
// 断言白名单归一化（nonce、bundle 哈希）、环境开关、端口解析与互异性、页面发现、
// 端口释放探测与静态服务解析（scripts/lib/static-server.js 共享能力）。
// 运行：node --test scripts/compression-verify.test.js（由 npm test 统一收集）。
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const {
  BASELINE_MANIFEST,
  collectSnapshotTargets,
  createBaselineSnapshot,
  restoreBaselineSnapshot,
  compareSnapshotBytes,
  normalizeWhitelistText,
  verifyModeFromEnv,
  parseServerPort,
  assertDistinctPorts,
  discoverArticlePath,
  discoverVerifyPages,
  waitForPortRelease
} = require('./lib/compression-verify');
const {
  MIME_TYPES,
  acceptsGzip,
  isCompressibleType,
  resolveStaticFile
} = require('./lib/static-server');

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(root, rel, content) {
  const file = path.join(root, rel.split('/').join(path.sep));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}

// 构造一个最小 dist：4 种文本产物 + 二进制（不应进入快照）。
function makeDist() {
  const dir = makeTmpDir('synapse-verify-dist-');
  writeFile(dir, 'zh/index.html', '<html><body>首页</body></html>');
  writeFile(dir, 'assets/css/site.css', 'body{color:red}');
  writeFile(dir, 'assets/js/app.1234567890.js', 'console.log(1)');
  writeFile(dir, 'zh/feed.json', '{\n  "a": 1\n}');
  writeFile(dir, 'assets/vendor/pic.png', Buffer.from([1, 2, 3]).toString('binary'));
  writeFile(dir, 'report.txt', 'human readable');
  return dir;
}

describe('collectSnapshotTargets（快照目标枚举）', () => {
  test('仅收集 .html/.css/.js/.json，忽略二进制与文本报告', () => {
    const dist = makeDist();
    const targets = collectSnapshotTargets(dist);
    assert.deepEqual(targets, [
      'assets/css/site.css',
      'assets/js/app.1234567890.js',
      'zh/feed.json',
      'zh/index.html'
    ]);
    fs.rmSync(dist, { recursive: true, force: true });
  });

  test('大小写不敏感（.HTML/.JSON 同样纳入）', () => {
    const dist = makeTmpDir('synapse-verify-case-');
    writeFile(dist, 'zh/upper.HTML', '<html></html>');
    writeFile(dist, 'zh/data.JSON', '{}');
    assert.deepEqual(collectSnapshotTargets(dist), ['zh/data.JSON', 'zh/upper.HTML']);
    fs.rmSync(dist, { recursive: true, force: true });
  });
});

describe('createBaselineSnapshot / restoreBaselineSnapshot（快照与恢复）', () => {
  test('快照复制全部目标文件并写清单；重复建立会清除上一轮残留', () => {
    const dist = makeDist();
    const baseline = path.join(makeTmpDir('synapse-verify-base-'), 'snapshot');
    const snapshot = createBaselineSnapshot(dist, baseline);
    assert.equal(snapshot.fileCount, 4);
    assert.equal(fs.readFileSync(path.join(baseline, 'zh', 'index.html'), 'utf-8'), '<html><body>首页</body></html>');
    const manifest = JSON.parse(fs.readFileSync(path.join(baseline, BASELINE_MANIFEST), 'utf-8'));
    assert.deepEqual(manifest.files, snapshot.files);

    writeFile(baseline, 'stale/old.html', 'stale');
    const again = createBaselineSnapshot(dist, baseline);
    assert.equal(again.fileCount, 4);
    assert.ok(!fs.existsSync(path.join(baseline, 'stale', 'old.html')), '重建必须清除陈旧快照文件');
    fs.rmSync(dist, { recursive: true, force: true });
    fs.rmSync(path.dirname(baseline), { recursive: true, force: true });
  });

  test('恢复：覆写被修改文件、删除增强新增文件、重建被删除文件，二进制不受影响', () => {
    const dist = makeDist();
    const baseline = path.join(makeTmpDir('synapse-verify-base-'), 'snapshot');
    createBaselineSnapshot(dist, baseline);
    const binaryPath = path.join(dist, 'assets', 'vendor', 'pic.png');

    // 模拟增强：改写 HTML/CSS/JS、删除 feed.json、新增混淆产物；另动一个二进制（不应被恢复触碰）。
    writeFile(dist, 'zh/index.html', '<html><body>增强后</body></html>');
    writeFile(dist, 'assets/css/site.css', 'body{color:blue}');
    writeFile(dist, 'assets/js/app.aaaaaaaaaa.js', 'obfuscated()');
    fs.rmSync(path.join(dist, 'zh', 'feed.json'));
    fs.writeFileSync(binaryPath, Buffer.from([9, 9]));

    const result = restoreBaselineSnapshot(baseline, dist);
    assert.equal(result.restored, 4);
    assert.deepEqual(result.removedFiles, ['assets/js/app.aaaaaaaaaa.js']);
    assert.equal(result.missingBaseline.length, 0);
    assert.equal(fs.readFileSync(path.join(dist, 'zh', 'index.html'), 'utf-8'), '<html><body>首页</body></html>');
    assert.equal(fs.readFileSync(path.join(dist, 'assets', 'css', 'site.css'), 'utf-8'), 'body{color:red}');
    assert.ok(fs.existsSync(path.join(dist, 'zh', 'feed.json')), '被删除的基线文件必须重建');
    assert.ok(!fs.existsSync(path.join(dist, 'assets', 'js', 'app.aaaaaaaaaa.js')), '增强新增的文本产物必须删除');
    assert.deepEqual(fs.readFileSync(binaryPath), Buffer.from([9, 9]), '二进制不属快照范围，恢复不得触碰');
    assert.deepEqual(compareSnapshotBytes(baseline, dist), { files: 4, match: true, mismatches: [] });
    fs.rmSync(dist, { recursive: true, force: true });
    fs.rmSync(path.dirname(baseline), { recursive: true, force: true });
  });

  test('compareSnapshotBytes：任一文件字节不一致即 match=false 并列出路径', () => {
    const dist = makeDist();
    const baseline = path.join(makeTmpDir('synapse-verify-base-'), 'snapshot');
    createBaselineSnapshot(dist, baseline);
    writeFile(dist, 'zh/index.html', '<html><body>变了</body></html>');
    const result = compareSnapshotBytes(baseline, dist);
    assert.equal(result.match, false);
    assert.deepEqual(result.mismatches, ['zh/index.html']);
    fs.rmSync(dist, { recursive: true, force: true });
    fs.rmSync(path.dirname(baseline), { recursive: true, force: true });
  });
});

describe('normalizeWhitelistText（断言白名单归一化）', () => {
  test('nonce 属性值与 CSP 串归一化', () => {
    const input = '<script nonce="abc+/=" src="x.js">\'nonce-abc123\'</script>';
    const out = normalizeWhitelistText(input);
    assert.ok(out.includes('nonce="NONCE"'), out);
    assert.ok(out.includes("'nonce-NONCE'"), out);
  });

  test('app/deferred bundle 与 runtime 文件名哈希归一化', () => {
    const input = 'src="/assets/js/app.ab12cd34ef.js" url="/assets/js/deferred.0011aabbcc.js" runtime="/assets/js/runtime.ffeedd.js"';
    const out = normalizeWhitelistText(input);
    assert.ok(out.includes('/assets/js/app.HASH.js'), out);
    assert.ok(out.includes('/assets/js/deferred.HASH.js'), out);
    assert.ok(out.includes('/assets/js/runtime.HASH.js'), 'runtime 压缩改名后同样归一化');
  });

  test('幂等且不误伤相似串', () => {
    const once = normalizeWhitelistText('app.ab12cd34ef.js myapp.abcdef12.js app.min.js');
    assert.equal(normalizeWhitelistText(once), once);
    assert.ok(once.includes('myapp.abcdef12.js'), '前缀非词边界的相似串不得匹配');
    assert.ok(once.includes('app.min.js'), '短段（<6 字符）不得匹配');
  });
});

describe('verifyModeFromEnv（内联验证开关）', () => {
  test('off/0/false 归一化为 off，其余为 on', () => {
    assert.equal(verifyModeFromEnv({ SYNAPSE_COMPRESSION_VERIFY: 'off' }), 'off');
    assert.equal(verifyModeFromEnv({ SYNAPSE_COMPRESSION_VERIFY: ' FALSE ' }), 'off');
    assert.equal(verifyModeFromEnv({ SYNAPSE_COMPRESSION_VERIFY: '0' }), 'off');
    assert.equal(verifyModeFromEnv({ SYNAPSE_COMPRESSION_VERIFY: 'on' }), 'on');
    assert.equal(verifyModeFromEnv({}), 'on');
    assert.equal(verifyModeFromEnv(undefined), 'on');
  });
});

describe('端口解析与互异性', () => {
  test('parseServerPort 解析 stdout 行，非法输入返回 0', () => {
    assert.equal(parseServerPort('booting\nSYNAPSE_SERVE_PORT=41123\n'), 41123);
    assert.equal(parseServerPort('SYNAPSE_SERVE_PORT=1'), 1);
    assert.equal(parseServerPort('no port here'), 0);
    assert.equal(parseServerPort(''), 0);
  });

  test('assertDistinctPorts：正整数且互异才算通过', () => {
    assert.equal(assertDistinctPorts([40001, 40002]), true);
    assert.equal(assertDistinctPorts([40001, 40001]), false);
    assert.equal(assertDistinctPorts([40001, 0]), false);
    assert.equal(assertDistinctPorts([40001, 40001.5]), false);
  });
});

describe('页面发现', () => {
  test('discoverVerifyPages：首页卡片链接优先，缺失时回退标签页，始终含 6 页', () => {
    const dist = makeTmpDir('synapse-verify-pages-');
    writeFile(dist, 'zh/index.html', '<a class="post-card" href="/zh/hello-world/">标题</a><a href="/zh/archive/">归档</a>');
    writeFile(dist, 'en/index.html', '<html lang="en"></html>');
    writeFile(dist, 'zh/hello-world/index.html', '<html></html>');
    writeFile(dist, 'zh/search/index.html', '<html></html>');
    writeFile(dist, 'zh/archive/index.html', '<html></html>');
    writeFile(dist, 'zh/404.html', '<html>404</html>');
    assert.equal(discoverArticlePath(dist), '/zh/hello-world/');
    assert.deepEqual(discoverVerifyPages(dist), ['/zh/', '/en/', '/zh/hello-world/', '/zh/search/', '/zh/archive/', '/zh/404.html']);
    fs.rmSync(dist, { recursive: true, force: true });
  });

  test('首页无文章链接：目录扫描回退并在页数不足时补标签页', () => {
    const dist = makeTmpDir('synapse-verify-pages2-');
    writeFile(dist, 'zh/index.html', '<html></html>');
    writeFile(dist, 'en/index.html', '<html></html>');
    writeFile(dist, 'zh/tags/index.html', '<html></html>');
    writeFile(dist, 'zh/search/index.html', '<html></html>');
    writeFile(dist, 'zh/archive/index.html', '<html></html>');
    writeFile(dist, 'zh/404.html', '<html>404</html>');
    const pages = discoverVerifyPages(dist);
    assert.equal(pages.length, 6);
    assert.ok(pages.includes('/zh/tags/'), '文章缺失时用标签页补齐第六页');
    fs.rmSync(dist, { recursive: true, force: true });
  });
});

describe('waitForPortRelease（端口释放探测）', () => {
  test('已释放端口返回 true；占用中端口在超时后返回 false', async () => {
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    assert.equal(await waitForPortRelease(port, 300), false, '占用中端口不得判定为已释放');
    await new Promise((resolve) => probe.close(resolve));
    assert.equal(await waitForPortRelease(port, 2000), true, '关闭后端口应可重新绑定');
  });
});

describe('static-server（共享静态服务解析）', () => {
  test('resolveStaticFile：clean URL、目录 index、缺省 .html、缺失回退 404、越界防护', () => {
    const root = makeTmpDir('synapse-static-root-');
    writeFile(root, 'index.html', 'home');
    writeFile(root, 'zh/index.html', 'zh home');
    writeFile(root, 'zh/page.html', 'page');
    writeFile(root, '404.html', 'not found');
    assert.equal(resolveStaticFile(root, '/').filePath, path.join(root, 'index.html'));
    assert.equal(resolveStaticFile(root, '/zh/').filePath, path.join(root, 'zh', 'index.html'));
    assert.equal(resolveStaticFile(root, '/zh/page').filePath, path.join(root, 'zh', 'page.html'));
    const missing = resolveStaticFile(root, '/nope/');
    assert.equal(missing.isNotFound, true);
    assert.equal(missing.filePath, path.join(root, '404.html'));
    const escape = resolveStaticFile(root, '/../../etc/passwd');
    assert.equal(escape.isNotFound, true);
    assert.equal(escape.filePath, path.join(root, '404.html'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('acceptsGzip / isCompressibleType：q=0 拒绝、二进制与文本严格区分', () => {
    assert.equal(acceptsGzip('gzip, deflate, br'), true);
    assert.equal(acceptsGzip('gzip;q=0'), false);
    assert.equal(acceptsGzip('br'), false);
    assert.equal(isCompressibleType('text/html; charset=utf-8'), true);
    assert.equal(isCompressibleType('application/javascript'), true);
    assert.equal(isCompressibleType('image/png'), false);
    assert.equal(isCompressibleType('font/woff2'), false);
    assert.equal(MIME_TYPES['.html'], 'text/html');
  });
});
