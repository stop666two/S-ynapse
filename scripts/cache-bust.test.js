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
