'use strict';

// nav-match 纯函数单测：锁定构建期 SSR 导航高亮与运行时 nav-state.js 的同一套判定规则。
// 运行：node --test scripts/nav-match.test.js（npm test 亦收录）。
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { navPath, isNavActive, findNavActiveHref } = require('./lib/nav-match');

describe('navPath', () => {
  test('去掉 /index.html 结尾并归一到目录形式', () => {
    assert.strictEqual(navPath('/zh/index.html'), '/zh/');
    assert.strictEqual(navPath('/index.html'), '/');
    assert.strictEqual(navPath('/zh/archive'), '/zh/archive/');
    assert.strictEqual(navPath('/zh/archive/'), '/zh/archive/');
    assert.strictEqual(navPath('/'), '/');
    assert.strictEqual(navPath(''), '');
    assert.strictEqual(navPath(null), '');
  });
});

describe('isNavActive', () => {
  test('精确匹配（含尾斜杠归一）', () => {
    assert.strictEqual(isNavActive('/zh/archive', '/zh/archive/'), true);
    assert.strictEqual(isNavActive('/zh/archive/', '/zh/archive'), true);
    assert.strictEqual(isNavActive('/zh/', '/zh/'), true);
  });

  test('首页只允许精确匹配，子页不高亮首页', () => {
    assert.strictEqual(isNavActive('/zh/archive/', '/zh/'), false);
    assert.strictEqual(isNavActive('/en/some-post/', '/en/'), false);
    assert.strictEqual(isNavActive('/zh/', '/'), false);
    assert.strictEqual(isNavActive('/', '/'), true);
  });

  test('非首页允许前缀匹配（子路径命中上级栏目）', () => {
    assert.strictEqual(isNavActive('/zh/tags/%E6%B5%8B%E8%AF%95/', '/zh/tags/'), true);
    assert.strictEqual(isNavActive('/zh/categories/web/', '/zh/categories/'), true);
    assert.strictEqual(isNavActive('/zh/archive-2024/', '/zh/archive/'), false);
  });

  test('跳过空 href、锚点与外链', () => {
    assert.strictEqual(isNavActive('/zh/', ''), false);
    assert.strictEqual(isNavActive('/zh/', '#top'), false);
    assert.strictEqual(isNavActive('/zh/', 'https://github.com/x'), false);
    assert.strictEqual(isNavActive('/zh/', 'http://example.com/'), false);
    assert.strictEqual(isNavActive('/zh/', 'mailto:a@b.c'), false);
  });

  test('index.html 形式与目录形式等价', () => {
    assert.strictEqual(isNavActive('/zh/index.html', '/zh/'), true);
    assert.strictEqual(isNavActive('/zh/', '/zh/index.html'), true);
  });
});

describe('findNavActiveHref', () => {
  const menu = [
    { url: '/zh/' },
    { url: '/zh/archive/' },
    { url: '/zh/tags/' },
    { url: '/zh/links/' },
    { url: 'https://github.com/repo' }
  ];

  test('按菜单顺序返回命中的 href（首页精确、栏目精确、子路径前缀）', () => {
    assert.strictEqual(findNavActiveHref('/zh/', menu), '/zh/');
    assert.strictEqual(findNavActiveHref('/zh/archive', menu), '/zh/archive/');
    assert.strictEqual(findNavActiveHref('/zh/tags/foo/', menu), '/zh/tags/');
    assert.strictEqual(findNavActiveHref('/zh/links/', menu), '/zh/links/');
  });

  test('外链永不命中；无命中返回空串', () => {
    assert.strictEqual(findNavActiveHref('/zh/other/', menu), '');
    assert.strictEqual(findNavActiveHref('/en/archive/', menu), '');
    assert.strictEqual(findNavActiveHref('/zh/', []), '');
    assert.strictEqual(findNavActiveHref('/zh/', null), '');
  });

  test('多候选命中时最后一个生效（与运行时循环一致）', () => {
    const dup = [{ url: '/zh/' }, { url: '/zh/archive/' }, { url: '/zh/archive/' }];
    assert.strictEqual(findNavActiveHref('/zh/archive/', dup), '/zh/archive/');
  });
});
