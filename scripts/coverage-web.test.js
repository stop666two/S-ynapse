'use strict';
// 灯箱覆盖场景的选页契约（coverage-web.pickLightboxSource）。
//
// 为什么需要：test:cov-web 之前固定用首页前两篇文章，而那两篇可能一张正文图都没有——
// 于是「点击图片打开灯箱」必然失败，随后 6 个灯箱按钮连锁点不到，日志刷一串
// 「（optional，忽略）」，而灯箱整条路径实际上从未被执行过（覆盖率虚低且无断言）。
// 这里把选页规则固定下来：多图文章 > 单图文章 > 图库页 > null。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pickLightboxSource } = require('./coverage-web.js');

function writePage(root, url, html) {
  const dir = path.join(root, ...url.split('/').filter(Boolean));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
}

// 构建产物里属性可能带引号也可能不带（模板压缩后 class=post-content），两种都要认。
const article = (imgs, opts) => {
  const quoted = !!(opts && opts.quoted);
  const head = quoted ? '<div class="post-content">' : '<div class=post-content>';
  const tag = quoted ? '<img src="/media/a.jpg">' : '<img src=/media/a.jpg>';
  return '<html><head><meta property="article:published_time" content="2026-01-01"></head><body>' +
    head + tag.repeat(imgs) + '</div></article></body></html>';
};

function makeTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-web-pick-'));
  writePage(root, '/zh/plain/', article(0));
  writePage(root, '/zh/single/', article(1, { quoted: true }));
  writePage(root, '/zh/rich/', article(3));
  writePage(root, '/zh/gallery/', '<div class=gallery-grid><figure class=gallery-item><img src=/media/g.jpg></figure></div>');
  return root;
}

describe('coverage-web.pickLightboxSource', () => {
  it('优先多图文章，且能扫描首页未暴露的文章', () => {
    const root = makeTree();
    const got = pickLightboxSource(root, ['/zh/plain/']);
    assert.deepStrictEqual(got, { url: '/zh/rich/', selector: '.post-content img:not(a img)' });
  });

  it('只有单图文章时退回单图（带引号属性也必须识别）', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-web-pick-'));
    writePage(root, '/zh/single/', article(1, { quoted: true }));
    const got = pickLightboxSource(root, []);
    assert.deepStrictEqual(got, { url: '/zh/single/', selector: '.post-content img:not(a img)' });
  });

  it('没有任何正文图时退回图库页（灯箱选择器含 .gallery-item img）', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-web-pick-'));
    writePage(root, '/zh/plain/', article(0));
    writePage(root, '/zh/gallery/', '<figure class=gallery-item><img src=/media/g.jpg></figure>');
    const got = pickLightboxSource(root, ['/zh/plain/']);
    assert.deepStrictEqual(got, { url: '/zh/gallery/', selector: '.gallery-item img' });
  });

  it('既无正文图也无图库时返回 null（调用方据此跳过该场景，而不是刷一串忽略）', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-web-pick-'));
    writePage(root, '/zh/plain/', article(0));
    assert.strictEqual(pickLightboxSource(root, ['/zh/plain/']), null);
  });

  it('产物目录缺失时不抛错（返回 null）', () => {
    assert.strictEqual(pickLightboxSource(path.join(os.tmpdir(), 'definitely-missing-' + Date.now()), []), null);
  });
});
