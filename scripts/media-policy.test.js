const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMediaModule } = require('./build/media');

function writeFile(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function makeFixture(root) {
  writeFile(root, 'assets/data.csv', 'a,b\n');
  writeFile(root, 'assets/payload.exe', 'MZ');
  writeFile(root, 'assets/.gitkeep', '');
  writeFile(root, 'videos/clip.mp4', 'video-bytes');
  writeFile(root, 'media/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  writeFile(root, 'media/anim.gif', 'gif-bytes');
  writeFile(root, 'media/sub/photo.jpg', 'jpg-bytes');
}

function createModule(srcRoot, distRoot, cacheRoot) {
  return createMediaModule({
    distDir: distRoot,
    staticDir: path.join(srcRoot, 'static'),
    assetsDir: path.join(srcRoot, 'assets'),
    videosDir: path.join(srcRoot, 'videos'),
    mediaDir: path.join(srcRoot, 'media'),
    mediaCacheDir: cacheRoot
  });
}

describe('copyProtectedAssets', () => {
  // 审查 R-29：content-policy.json5 承诺 enabled:false 时三目录「内容照常复制」，
  // 旧实现直接 return { copied: 0 }，导致 assets/、videos/ 与 media/ 下非 sharp
  // 文件（svg/gif/avif/bmp/ico/heic…）全部 404。
  it('copies assets/, videos/ and media/ verbatim when the policy is disabled', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-policy-off-'));
    try {
      const src = path.join(root, 'src');
      const dist = path.join(root, 'dist');
      makeFixture(src);
      const mod = createModule(src, dist, path.join(root, 'cache'));
      const r = mod.copyProtectedAssets({ contentPolicy: { enabled: false } });
      assert.deepStrictEqual(r.blocked, []);
      assert.strictEqual(r.copied, 6, '六个非占位文件都必须复制（含被策略关闭后不再拦截的 exe）');
      assert.strictEqual(fs.readFileSync(path.join(dist, 'assets/data.csv'), 'utf8'), 'a,b\n');
      assert.ok(fs.existsSync(path.join(dist, 'assets/payload.exe')), '关闭策略时不判定扩展名，原样复制');
      assert.strictEqual(fs.readFileSync(path.join(dist, 'videos/clip.mp4'), 'utf8'), 'video-bytes');
      assert.strictEqual(fs.readFileSync(path.join(dist, 'media/logo.svg'), 'utf8'),
        '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', '关闭策略时不消毒，原样复制');
      assert.strictEqual(fs.readFileSync(path.join(dist, 'media/anim.gif'), 'utf8'), 'gif-bytes');
      assert.strictEqual(fs.readFileSync(path.join(dist, 'media/sub/photo.jpg'), 'utf8'), 'jpg-bytes');
      assert.ok(!fs.existsSync(path.join(dist, 'assets/.gitkeep')), '.gitkeep 仍不发布');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('still blocks disallowed files when the policy is enabled', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-policy-on-'));
    try {
      const src = path.join(root, 'src');
      const dist = path.join(root, 'dist');
      makeFixture(src);
      const mod = createModule(src, dist, path.join(root, 'cache'));
      const r = mod.copyProtectedAssets({ contentPolicy: { enabled: true } });
      assert.ok(r.blocked.some((b) => b.path === 'assets/payload.exe'), '可执行扩展名必须被拦截');
      assert.ok(!fs.existsSync(path.join(dist, 'assets/payload.exe')));
      assert.ok(fs.existsSync(path.join(dist, 'assets/data.csv')));
      assert.ok(fs.existsSync(path.join(dist, 'media/anim.gif')));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
