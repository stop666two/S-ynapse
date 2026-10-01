'use strict';
// OG 封面源选择（scripts/lib/og-cover.js）纯逻辑单测：
// 损坏媒体清单读取、被拦截/损坏封面跳过（与页面回退同语义）、缓存键淘汰封面 stat。
// 运行：node --test scripts/og-cover.test.js（由 npm test 统一收集）。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  BROKEN_MEDIA_FILENAME,
  defaultBrokenMediaPath,
  readBrokenMediaManifest,
  selectCoverSource,
  buildArticleOgKey
} = require('./lib/og-cover');
const { createBrokenMediaMatcher } = require('./lib/content-validate');

describe('readBrokenMediaManifest', () => {
  it('文件缺失 / JSON 非法 / 非数组一律返回空清单', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-og-cover-'));
    assert.deepEqual(readBrokenMediaManifest(path.join(dir, 'missing.json')), []);
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{oops', 'utf-8');
    assert.deepEqual(readBrokenMediaManifest(bad), []);
    const obj = path.join(dir, 'obj.json');
    fs.writeFileSync(obj, '{"files":["/media/x.png"]}', 'utf-8');
    assert.deepEqual(readBrokenMediaManifest(obj), []);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('读取字符串数组并过滤非字符串项', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-og-cover-'));
    const file = path.join(dir, BROKEN_MEDIA_FILENAME);
    fs.writeFileSync(file, JSON.stringify(['/media/a.png', 42, null, '/media/b.svg']), 'utf-8');
    assert.deepEqual(readBrokenMediaManifest(file), ['/media/a.png', '/media/b.svg']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('selectCoverSource', () => {
  const isBroken = createBrokenMediaMatcher(new Set(['/media/blocked.html']));

  it('被拦截封面跳过；健康封面保留（cover 优先于 featuredImage）', () => {
    assert.deepEqual(selectCoverSource({ featuredImage: '/media/blocked.html' }, isBroken), { cover: '', skipped: true });
    assert.deepEqual(selectCoverSource({ cover: '/media/ok.jpg', featuredImage: '/media/blocked.html' }, isBroken), { cover: '/media/ok.jpg', skipped: false });
  });

  it('外部 URL 与空值不参与损坏判定', () => {
    assert.deepEqual(selectCoverSource({ featuredImage: 'https://cdn.example.com/a.png' }, isBroken), { cover: 'https://cdn.example.com/a.png', skipped: false });
    assert.deepEqual(selectCoverSource({}, isBroken), { cover: '', skipped: false });
    assert.deepEqual(selectCoverSource(null, isBroken), { cover: '', skipped: false });
  });
});

describe('buildArticleOgKey', () => {
  it('封面 stat 参与键：有/无 stat 互异，无 stat 退化为基准指纹', () => {
    const base = 'fp-base';
    const withStats = buildArticleOgKey(base, { mtimeMs: 111, size: 222 });
    assert.notStrictEqual(withStats, base);
    assert.strictEqual(buildArticleOgKey(base, null), base);
    assert.strictEqual(buildArticleOgKey(base, { mtimeMs: 111, size: 222 }), withStats);
  });
});

describe('defaultBrokenMediaPath', () => {
  it('按站点根与缓存目录解析，文件名固定', () => {
    const p = defaultBrokenMediaPath('site-root', '.cache');
    assert.ok(p.endsWith(path.join('.cache', BROKEN_MEDIA_FILENAME)));
    assert.ok(path.isAbsolute(p));
  });
});
