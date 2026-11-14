'use strict';
// 接线回归：四个「零消费」构建类开关的双态行为。
// 背景：features.gallery.enabled / features.autoSummary.enabled / features.mediaAudit.enabled /
// features.exportBackup.enabled 此前只有 features.json5 注释与 schema 默认值，生产代码从不读取，
// 用户写 false 毫无效果。接线后本套件锁定可观察差异：
//   1) 纯函数层：每个键单独一组断言（隔离其它键的影响）；
//   2) 真实构建 / 真实 CLI 子进程层：产物文件、页面 HTML、sitemap、退出码与 stdout 都要变化，
//      避免只断言「一个布尔变量」这种自证式测试。
// 全部四个键默认 true（键缺失 = 历史行为），只有显式 false 才关闭。
//
// 运行：node --test scripts/config-wiring-build-switches.test.js
// 注意：`npm test`（生命周期事件 test）会跳过两轮真实构建的子测试，理由与 build-smoke.test.js 相同
// （构建是集成级校验，由 npm run test:build 覆盖）。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  galleryPageEnabled,
  autoSummaryEnabled,
  mediaAuditEnabled,
  exportBackupEnabled,
  isGalleryUrl,
  pruneGalleryMenuItems,
  pruneGalleryFooterLinks
} = require('./lib/build-switch-gates');
const { createTestSite } = require('./lib/test-site-builder');

const ROOT = path.resolve(__dirname, '..');
const IN_UNIT_SUITE = process.env.npm_lifecycle_event === 'test';
const SKIP_HEAVY = IN_UNIT_SUITE ? 'run via node --test scripts/config-wiring-build-switches.test.js (integration)' : false;
const BUILD_TIMEOUT_MS = 240000;

// ---------------------------------------------------------------------------
// 夹具与进程辅助
// ---------------------------------------------------------------------------

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-' + prefix + '-'));
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function writeFile(dir, rel, content) {
  const target = path.join(dir, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

function runNode(argv, options) {
  const opts = options || {};
  const res = spawnSync(process.execPath, argv, {
    cwd: opts.cwd || ROOT,
    env: Object.assign({}, process.env, opts.env || {}),
    encoding: 'utf-8',
    timeout: opts.timeout || 120000
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// CLI 夹具：只放命令真正需要的文件（features.json5 + articles/ + media/）。
function createCliFixture(features) {
  const root = makeTempDir('gates-cli');
  writeFile(root, 'features.json5', JSON.stringify(features, null, 2) + '\n');
  writeFile(root, 'articles/zh/sample.md', [
    '---',
    'title: 夹具文章',
    'date: 2026-01-02',
    '---',
    '',
    '正文引用了 ![像素图](/media/pixel.png)。',
    ''
  ].join('\n'));
  // 1x1 PNG（与 test-site-builder 同源字节），供媒体审计真实遍历。
  writeFile(root, 'media/pixel.png', Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  ));
  return root;
}

// ---------------------------------------------------------------------------
// 1. 纯函数层：每个键单独隔离（不依赖其它三个键的取值）
// ---------------------------------------------------------------------------

test('features.gallery.enabled：显式 false 关闭图库页，缺省/true 保持历史行为', () => {
  // switch: features.gallery.enabled
  const site = { build: { generateGallery: true } };
  assert.strictEqual(galleryPageEnabled({ site, features: {} }), true, '键缺失 = 默认开（历史行为）');
  assert.strictEqual(galleryPageEnabled({ site, features: { gallery: {} } }), true, '段落缺失 enabled 也视为开');
  assert.strictEqual(galleryPageEnabled({ site, features: { gallery: { enabled: true } } }), true);
  assert.strictEqual(galleryPageEnabled({ site, features: { gallery: { enabled: false } } }), false, '显式 false 必须关闭');
  // 与既有构建期闸门是「与」关系：任一关闭即不产出。
  assert.strictEqual(
    galleryPageEnabled({ site: { build: { generateGallery: false } }, features: { gallery: { enabled: true } } }),
    false,
    'site.build.generateGallery=false 仍然关闭'
  );
  // 其它 features 键不得影响判定。
  assert.strictEqual(
    galleryPageEnabled({ site, features: { gallery: { enabled: false }, autoSummary: { enabled: true } } }),
    false
  );
});

test('图库入口裁剪：只删站内 /gallery 链接，外链与非图库菜单保持原样', () => {
  // switch: features.gallery.enabled
  assert.strictEqual(isGalleryUrl('/gallery'), true);
  assert.strictEqual(isGalleryUrl('/gallery/'), true);
  assert.strictEqual(isGalleryUrl('/zh/gallery/'), true);
  assert.strictEqual(isGalleryUrl('/en/gallery/?from=nav'), true);
  assert.strictEqual(isGalleryUrl('https://example.test/gallery/'), false, '外链不裁剪');
  assert.strictEqual(isGalleryUrl('//cdn.example/gallery'), false, '协议相对外链不裁剪');
  assert.strictEqual(isGalleryUrl('/gallery-2/'), false);
  assert.strictEqual(isGalleryUrl('/tags/'), false);

  const menu = [
    { label: '首页', url: '/' },
    { label: '图库', url: '/gallery' },
    { label: '外链图库', url: 'https://example.test/gallery/' }
  ];
  const kept = pruneGalleryMenuItems(menu);
  assert.deepStrictEqual(kept.map((m) => m.url), ['/', 'https://example.test/gallery/']);

  const footer = {
    bottomLinks: { items: [{ label: '图库', url: '/gallery/' }, { label: '关于', url: '/about' }] },
    columnItems: { items: [{ title: '站内', links: [{ label: '图库', url: '/zh/gallery/' }, { label: '归档', url: '/archive' }] }] }
  };
  const prunedFooter = pruneGalleryFooterLinks(footer);
  assert.deepStrictEqual(prunedFooter.bottomLinks.items.map((l) => l.url), ['/about']);
  assert.deepStrictEqual(prunedFooter.columnItems.items[0].links.map((l) => l.url), ['/archive']);
  assert.strictEqual(footer.bottomLinks.items.length, 2, '裁剪不得原地修改配置对象');
});

test('features.autoSummary.enabled：显式 false 关闭正文自动摘要，缺省/true 保持历史行为', () => {
  // switch: features.autoSummary.enabled
  assert.strictEqual(autoSummaryEnabled({}), true, '键缺失 = 默认开');
  assert.strictEqual(autoSummaryEnabled({ autoSummary: {} }), true);
  assert.strictEqual(autoSummaryEnabled({ autoSummary: { enabled: true } }), true);
  assert.strictEqual(autoSummaryEnabled({ autoSummary: { enabled: false } }), false, '显式 false 必须关闭');
  // 兄弟键（maxLength/stripMarkdown/ellipsis）不得影响总开关。
  assert.strictEqual(
    autoSummaryEnabled({ autoSummary: { enabled: false, maxLength: 90, stripMarkdown: true, ellipsis: '…' } }),
    false
  );
});

test('features.mediaAudit.enabled：显式 false 关闭媒体审计命令，缺省/true 保持历史行为', () => {
  // switch: features.mediaAudit.enabled
  assert.strictEqual(mediaAuditEnabled({}), true, '键缺失 = 默认开');
  assert.strictEqual(mediaAuditEnabled({ mediaAudit: {} }), true);
  assert.strictEqual(mediaAuditEnabled({ mediaAudit: { enabled: true } }), true);
  assert.strictEqual(mediaAuditEnabled({ mediaAudit: { enabled: false } }), false, '显式 false 必须关闭');
  assert.strictEqual(
    mediaAuditEnabled({ mediaAudit: { enabled: false, reportMissed: true, reportUnreferenced: true } }),
    false
  );
});

test('features.exportBackup.enabled：显式 false 关闭导出备份命令，缺省/true 保持历史行为', () => {
  // switch: features.exportBackup.enabled
  assert.strictEqual(exportBackupEnabled({}), true, '键缺失 = 默认开');
  assert.strictEqual(exportBackupEnabled({ exportBackup: {} }), true);
  assert.strictEqual(exportBackupEnabled({ exportBackup: { enabled: true } }), true);
  assert.strictEqual(exportBackupEnabled({ exportBackup: { enabled: false } }), false, '显式 false 必须关闭');
  assert.strictEqual(
    exportBackupEnabled({ exportBackup: { enabled: false, includeMedia: true, includeConfig: true } }),
    false
  );
});

// ---------------------------------------------------------------------------
// 2. 真实 CLI 子进程：audit:media 的禁用态必须 exit 0 且不产出审计结果
// ---------------------------------------------------------------------------

test('npm run audit:media：enabled=false 跳过（exit 0，无审计产物），true/缺省照常审计', () => {
  // switch: features.mediaAudit.enabled
  const off = createCliFixture({ mediaAudit: { enabled: false, output: 'json' } });
  const on = createCliFixture({ mediaAudit: { enabled: true, output: 'json' } });
  const omitted = createCliFixture({ mediaAudit: { output: 'json' } });
  try {
    const offRes = runNode([path.join(ROOT, 'scripts', 'audit-media.js')], { cwd: off, env: { SYNAPSE_ROOT: off } });
    assert.strictEqual(offRes.status, 0, '禁用态必须 exit 0：' + offRes.stderr);
    assert.match(offRes.stdout, /features\.mediaAudit\.enabled=false/, '禁用态必须输出一行说明');
    assert.ok(!fs.existsSync(path.join(off, 'media-audit.json')), '禁用态不得写出审计报告');
    assert.ok(!/审计汇总|缺失文件/.test(offRes.stdout), '禁用态不得执行审计（无审计输出）');

    for (const [label, root] of [['enabled=true', on], ['缺省', omitted]]) {
      const res = runNode([path.join(ROOT, 'scripts', 'audit-media.js')], { cwd: root, env: { SYNAPSE_ROOT: root } });
      assert.strictEqual(res.status, 0, label + ' 必须 exit 0：' + res.stderr);
      assert.match(res.stdout, /汇总: /, label + ' 必须真实执行审计');
      assert.ok(fs.existsSync(path.join(root, 'media-audit.json')), label + ' 必须写出审计报告');
      assert.ok(!/enabled=false/.test(res.stdout), label + ' 不得输出禁用提示');
    }
  } finally {
    rmDir(off);
    rmDir(on);
    rmDir(omitted);
  }
});

// ---------------------------------------------------------------------------
// 3. 真实 CLI 子进程：export 的禁用态必须拒绝执行（非零退出码 + 明确原因）
// ---------------------------------------------------------------------------

test('npm run export：enabled=false 拒绝执行（非零退出 + 原因），true/缺省照常导出', () => {
  // switch: features.exportBackup.enabled
  const off = createCliFixture({ exportBackup: { enabled: false } });
  const on = createCliFixture({ exportBackup: { enabled: true, fileNamePrefix: 'gates-backup' } });
  const omitted = createCliFixture({ exportBackup: { fileNamePrefix: 'gates-backup' } });
  try {
    const offRes = runNode([path.join(ROOT, 'scripts', 'export.js')], { cwd: off, env: { SYNAPSE_ROOT: off } });
    assert.notStrictEqual(offRes.status, 0, '禁用态必须非零退出');
    assert.match(offRes.stderr, /features\.exportBackup\.enabled=false/, '禁用态必须说明原因');
    assert.ok(!fs.existsSync(path.join(off, 'exports')), '禁用态不得生成备份目录');

    for (const [label, root] of [['enabled=true', on], ['缺省', omitted]]) {
      const res = runNode([path.join(ROOT, 'scripts', 'export.js')], { cwd: root, env: { SYNAPSE_ROOT: root } });
      assert.strictEqual(res.status, 0, label + ' 必须 exit 0：' + res.stderr);
      assert.match(res.stdout, /备份完成/, label + ' 必须真实导出');
      const backups = fs.readdirSync(path.join(root, 'exports'));
      assert.strictEqual(backups.length, 1, label + ' 必须生成一个备份目录');
      assert.ok(fs.existsSync(path.join(root, 'exports', backups[0], 'articles', 'zh', 'sample.md')),
        label + ' 备份必须包含文章');
    }
  } finally {
    rmDir(off);
    rmDir(on);
    rmDir(omitted);
  }
});

// ---------------------------------------------------------------------------
// 4. 真实构建两轮（默认开 / 显式关）：图库页、sitemap、导航入口与卡片摘要都要随开关变化
// ---------------------------------------------------------------------------

function runBuild(outDir, siteRoot) {
  return runNode(['scripts/build.js', '--out', outDir], {
    cwd: ROOT,
    env: {
      SYNAPSE_ROOT: siteRoot,
      SYNAPSE_OUT_DIR: outDir,
      NODE_ENV: 'production',
      SYNAPSE_COMPRESSION_VERIFY: 'off'
    },
    timeout: BUILD_TIMEOUT_MS
  });
}

function makeBuildSite(galleryEnabled, summaryEnabled, extraSiteOverrides) {
  // navigation.json5 覆盖为「带图库菜单项」，这样才能证明关闭态连入口一起消失。
  const nav = JSON.stringify({
    search: { enabled: true, provider: 'local' },
    menu: [
      { label: '首页', labelEn: 'Home', url: '/' },
      { label: '图库', labelEn: 'Gallery', url: '/gallery' }
    ]
  }, null, 2) + '\n';
  return createTestSite({
    articles: 2,
    pages: 0,
    langs: ['zh'],
    linkProject: true,
    siteOverrides: Object.assign(
      { url: 'https://example.test', sitemap: { enabled: true, path: 'sitemap.xml' } },
      extraSiteOverrides || {}
    ),
    featuresOverrides: {
      gallery: { enabled: galleryEnabled },
      autoSummary: { enabled: summaryEnabled }
    },
    extraFiles: { 'navigation.json5': nav }
  });
}

test('真实构建：features.gallery.enabled / features.autoSummary.enabled 的产物差异', { skip: SKIP_HEAVY }, () => {
  // switch: features.gallery.enabled, features.autoSummary.enabled
  const on = makeBuildSite(true, true);
  // 关闭态刻意 cleanDist=false：复现「复用上一轮 dist」场景，验证残留的旧 /gallery/ 会被清理。
  const off = makeBuildSite(false, false, { build: { cleanDist: false, cjkFonts: { enabled: false } } });
  const onOut = makeTempDir('gates-on');
  const offOut = makeTempDir('gates-off');
  try {
    // 先跑「关闭态」并预热旧产物：验证关闭态会清理上一轮残留的 /gallery/（cleanDist=false 的复现场景）。
    const staleGallery = writeFile(offOut, path.join('zh', 'gallery', 'index.html'), '<!doctype html><title>stale</title>');
    assert.ok(fs.existsSync(staleGallery), '前置：旧产物存在');

    const onRes = runBuild(onOut, on.root);
    assert.strictEqual(onRes.status, 0, '开启态构建必须成功：\n' + (onRes.stdout + onRes.stderr).slice(-3000));
    const offRes = runBuild(offOut, off.root);
    assert.strictEqual(offRes.status, 0, '关闭态构建必须成功：\n' + (offRes.stdout + offRes.stderr).slice(-3000));

    // --- features.gallery.enabled：页面 / sitemap / 导航入口 ---
    assert.ok(fs.existsSync(path.join(onOut, 'zh', 'gallery', 'index.html')), '开启态必须产出 /zh/gallery/');
    assert.ok(!fs.existsSync(path.join(offOut, 'zh', 'gallery', 'index.html')), '关闭态不得产出 /zh/gallery/');

    const onIndex = fs.readFileSync(path.join(onOut, 'zh', 'index.html'), 'utf-8');
    const offIndex = fs.readFileSync(path.join(offOut, 'zh', 'index.html'), 'utf-8');
    assert.ok(onIndex.includes('/zh/gallery'), '开启态导航必须含图库入口');
    assert.ok(!offIndex.includes('/zh/gallery'), '关闭态不得残留图库入口（导航/页脚）');
    assert.ok(onRes.stdout.includes('Created: zh/gallery/index.html'), '开启态必须写出图库页');
    assert.ok(!offRes.stdout.includes('zh/gallery/index.html'), '关闭态不得尝试写图库页');
    assert.ok(offRes.stdout.includes('Removed stale: zh/gallery/'), '关闭态必须清理上一轮残留的图库目录');

    // sitemap 按语言落盘（/{lang}/sitemap.xml）。
    const onSitemap = fs.readFileSync(path.join(onOut, 'zh', 'sitemap.xml'), 'utf-8');
    const offSitemap = fs.readFileSync(path.join(offOut, 'zh', 'sitemap.xml'), 'utf-8');
    assert.match(onSitemap, /\/zh\/gallery\//, '开启态 sitemap 必须含图库 URL');
    assert.ok(!offSitemap.includes('/zh/gallery/'), '关闭态 sitemap 不得声明图库 URL');

    // --- features.autoSummary.enabled：卡片摘要 text 的有无 ---
    // 夹具正文含「正文段落 1。」，无 frontmatter excerpt → 开启态由正文派生摘要，关闭态为空。
    assert.ok(onIndex.includes('正文段落 1'), '开启态卡片必须含自动摘要（正文派生）');
    assert.ok(!offIndex.includes('正文段落 1'), '关闭态不得生成自动摘要');
    // 关闭摘要不得连带破坏其它字段：标题与文章链接仍在。
    assert.ok(offIndex.includes('/zh/test-article-1/'), '关闭摘要后文章卡片链接必须保留');
    assert.ok(offIndex.includes('测试文章 1'), '关闭摘要后文章标题必须保留');
  } finally {
    on.cleanup();
    off.cleanup();
    rmDir(onOut);
    rmDir(offOut);
  }
});
