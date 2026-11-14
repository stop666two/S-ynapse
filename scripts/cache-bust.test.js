'use strict';
// cacheBust 幂等回归测试：增量构建不清理 dist，已内容寻址的文件再次进入扫描时
// 不得重复追加哈希或改写 HTML 引用；内容变化时只生成一层新哈希并更新引用。
// 运行：node --test scripts/cache-bust.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createMinifyModule } = require('./build/minify.js');
const { getAllFiles } = require('./build/fs-utils.js');

const PATTERN = '.*\\.(css|js|png|jpg|svg)$';
const CONFIG = { site: { build: { enableCacheBusting: true, cacheBustingPattern: PATTERN } } };
const HASHED = /^[a-z0-9-]+\.[0-9a-f]{10}\.(jpg|svg)$/;

function makeDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-cachebust-'));
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'media', 'pic.jpg'), 'binary-pic-1');
  fs.writeFileSync(path.join(dir, 'icons', 'favicon.svg'), '<svg>1</svg>');
  fs.writeFileSync(path.join(dir, 'index.html'), '<link rel=icon href=/icons/favicon.svg><img src="/media/pic.jpg">');
  return dir;
}

function makeModule(distDir) {
  return createMinifyModule({
    distDir,
    cacheBustManifestPath: path.join(distDir, 'cache-bust-manifest.json'),
    bundleActive: true,
    getAllFiles,
    recordBuildFailure: () => {},
    minifyHtmlNode: null,
    CleanCSS: null,
    terser: null
  });
}

function names(dir) { return fs.readdirSync(dir).sort(); }

test('cacheBust：首轮重命名并改写 HTML 引用', async () => {
  const dir = makeDist();
  try {
    const mod = makeModule(dir);
    await mod.cacheBust(CONFIG);
    const media = names(path.join(dir, 'media'));
    const icons = names(path.join(dir, 'icons'));
    assert.strictEqual(media.length, 1);
    assert.match(media[0], HASHED, '媒体应变为内容寻址名：' + media[0]);
    assert.match(icons[0], HASHED, '图标应变为内容寻址名：' + icons[0]);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('/media/' + media[0]), 'HTML 引用应指向新哈希');
    assert.ok(html.includes('/icons/' + icons[0]), 'HTML 图标引用应指向新哈希');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cacheBust：二次运行幂等（不双哈希、不改写 HTML）', async () => {
  const dir = makeDist();
  try {
    const mod = makeModule(dir);
    await mod.cacheBust(CONFIG);
    const media1 = names(path.join(dir, 'media'));
    const icons1 = names(path.join(dir, 'icons'));
    const html1 = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    await mod.cacheBust(CONFIG);
    assert.deepStrictEqual(names(path.join(dir, 'media')), media1, '不得重复追加哈希');
    assert.deepStrictEqual(names(path.join(dir, 'icons')), icons1, '图标同样幂等');
    assert.strictEqual(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), html1, 'HTML 引用不得被再次改写');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cacheBust：增量复用页保留旧哈希引用时重定向到本轮哈希', async () => {
  const dir = makeDist();
  try {
    const mod = makeModule(dir);
    await mod.cacheBust(CONFIG);
    const oldName = names(path.join(dir, 'media'))[0];
    assert.match(oldName, HASHED);
    // 增量构建复用页面：pages.js 命中缓存跳过重渲染，HTML 里仍是上一轮 cacheBust 写入的旧哈希名；
    // 媒体阶段按稳定名重新产出（内容变化、尺寸不变 → 页面指纹不变）。
    fs.writeFileSync(path.join(dir, 'media', 'pic.jpg'), 'binary-pic-2');
    await mod.cacheBust(CONFIG);
    const all = names(path.join(dir, 'media'));
    const freshName = all.find((n) => fs.readFileSync(path.join(dir, 'media', n), 'utf8') === 'binary-pic-2');
    assert.ok(freshName, '应生成新哈希产物');
    assert.match(freshName, HASHED);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('/media/' + freshName), '复用页应重定向到本轮哈希，实际：' + html);
    assert.ok(!html.includes('/media/' + oldName), '不得残留旧哈希引用（会永远显示旧图）：' + html);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cacheBust：内容变化生成单层新哈希并更新引用', async () => {
  const dir = makeDist();
  try {
    const mod = makeModule(dir);
    await mod.cacheBust(CONFIG);
    const oldName = names(path.join(dir, 'media'))[0];
    // 模拟新渲染页面：media 源重新产出未哈希文件，HTML 引用未哈希路径（映射键即未哈希路径）。
    fs.writeFileSync(path.join(dir, 'media', 'pic.jpg'), 'binary-pic-2');
    fs.writeFileSync(path.join(dir, 'index.html'), '<img src="/media/pic.jpg">');
    await mod.cacheBust(CONFIG);
    const all = names(path.join(dir, 'media'));
    const freshName = all.find((n) => fs.readFileSync(path.join(dir, 'media', n), 'utf8') === 'binary-pic-2');
    assert.ok(freshName, '应生成新哈希产物');
    assert.match(freshName, HASHED, '新产物为单层哈希名：' + freshName);
    assert.ok(!/^pic\.[0-9a-f]{10}\.[0-9a-f]{10}\.jpg$/.test(freshName), '不得双哈希');
    assert.ok(all.includes(oldName), '旧产物在增量模式保留（--full 清理）');
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('/media/' + freshName), 'HTML 应更新到新哈希');
    assert.ok(!html.includes('src="/media/pic.jpg"'), 'HTML 不应再引用未哈希路径');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 搜索索引的 featuredImage 最终路径预计算（lib/search-index.js）与真实重命名
// （本模块 cacheBust）必须用同一套排除集（lib/cache-bust-exclusions.js）。漂移时索引会写入
// 「本轮从未被重命名」的哈希路径，搜索结果缩略图 404。断言方式：预计算结果必须指向真实存在的文件。
test('cacheBust 与搜索索引预计算共用排除集', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-cachebust-excl-'));
  try {
    const site = {
      build: { enableCacheBusting: true, cacheBustingPattern: PATTERN },
      pwa: { serviceWorker: '/sw.js', manifest: { icons: [{ src: '/icons/logo.png' }] } }
    };
    const write = (rel, body) => {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
    };
    write('media/pic.jpg', 'binary-pic-1');
    write('media/logo.png', 'pwa-icon');
    write('media/og/x.jpg', 'og-card');
    write('assets/app.css', 'body{}');
    write('sw.js', 'self.__SW');

    const { resolveFinalAssetUrl } = require('./lib/search-index');
    const { cacheBustExclusionOptions } = require('./lib/cache-bust-exclusions');
    const opts = Object.assign(
      { cacheBusting: true, pattern: new RegExp(PATTERN, 'i') },
      cacheBustExclusionOptions(site)
    );
    const urls = ['/media/pic.jpg', '/media/logo.png', '/media/og/x.jpg', '/assets/app.css', '/sw.js'];
    // 预计算必须在重命名前完成（prepareSearchIndex 早于 cacheBust），这里先取结果再执行重命名。
    const resolved = urls.map((u) => [u, resolveFinalAssetUrl(dir, u, opts)]);

    const mod = makeModule(dir);
    await mod.cacheBust({ site });

    for (const [url, finalUrl] of resolved) {
      assert.ok(
        fs.existsSync(path.join(dir, finalUrl.replace(/^\/+/, '').split('/').join(path.sep))),
        '预计算路径不存在（排除集漂移）：' + url + ' → ' + finalUrl
      );
    }
    assert.ok(!resolved.some(([url, finalUrl]) => url === finalUrl && url === '/media/pic.jpg'), '参与重命名的媒体必须预计算哈希');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 别名规则不得误伤：作者自带的「名字里就有 10 位十六进制」的同名兄弟文件。它本轮同样会被重命名，
// 因此别名规则必须优先采用它自己的映射目标（mapping[m]），而不是把它当成稳定名的旧哈希残留。
test('cacheBust：同名十六进制兄弟文件不被别名规则改写（反例）', async () => {
  const dir = makeDist();
  try {
    fs.writeFileSync(path.join(dir, 'media', 'pic.0123456789.jpg'), 'sibling-bytes');
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<img src="/media/pic.jpg"><img src="/media/pic.0123456789.jpg">'
    );
    const mod = makeModule(dir);
    await mod.cacheBust(CONFIG);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    for (const rel of html.match(/\/media\/[^"']+/g) || []) {
      assert.ok(
        fs.existsSync(path.join(dir, rel.replace(/^\/+/, '').split('/').join(path.sep))),
        '改写后的引用必须存在：' + rel
      );
    }
    assert.strictEqual((html.match(/\/media\/[^"']+/g) || []).length, 2, '两个引用都必须保留');
    assert.ok(html.includes('/media/pic.0123456789.') || html.includes('pic.0123456789'), '兄弟文件引用按自身哈希改写');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
