// robots.test.js — sitemap/robots 纯函数单测（node:test）
// 覆盖：逐语言 sitemap URL 生成、路径 percent-encoding、lastmod ISO 化。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildSitemapUrls, encodeLoc, toSitemapLastmod } = require('./lib/robots');

describe('buildSitemapUrls', () => {
  it('多语言时逐语言生成带前缀的 sitemap URL', () => {
    const urls = buildSitemapUrls({
      baseUrl: 'https://x.dev',
      sitemapPath: '/sitemap.xml',
      languages: ['zh', 'en']
    });
    assert.deepStrictEqual(urls, ['https://x.dev/zh/sitemap.xml', 'https://x.dev/en/sitemap.xml']);
  });

  it('单语言回退根路径并规范首尾斜杠', () => {
    const urls = buildSitemapUrls({
      baseUrl: 'https://x.dev/',
      sitemapPath: 'sitemap.xml',
      languages: ['zh']
    });
    assert.deepStrictEqual(urls, ['https://x.dev/sitemap.xml']);
  });

  it('语言列表为空且未给默认语言时回退根路径', () => {
    const urls = buildSitemapUrls({ baseUrl: 'https://x.dev', sitemapPath: '/sitemap.xml', languages: [] });
    assert.deepStrictEqual(urls, ['https://x.dev/sitemap.xml']);
  });

  it('缺少语言列表时使用 defaultLanguage', () => {
    const urls = buildSitemapUrls({
      baseUrl: 'https://x.dev',
      sitemapPath: '/sitemap.xml',
      languages: [],
      defaultLanguage: 'zh'
    });
    assert.deepStrictEqual(urls, ['https://x.dev/sitemap.xml']);
  });

  it('重复语言去重且保持出现顺序', () => {
    const urls = buildSitemapUrls({
      baseUrl: 'https://x.dev',
      sitemapPath: '/sitemap.xml',
      languages: ['zh', 'en', 'zh']
    });
    assert.deepStrictEqual(urls, ['https://x.dev/zh/sitemap.xml', 'https://x.dev/en/sitemap.xml']);
  });

  it('baseUrl 为空时返回空列表（调用方负责告警）', () => {
    const urls = buildSitemapUrls({ baseUrl: '', sitemapPath: '/sitemap.xml', languages: ['zh'] });
    assert.deepStrictEqual(urls, []);
  });
});

describe('encodeLoc', () => {
  it('对中文路径分段做 percent-encoding 并保留斜杠', () => {
    assert.strictEqual(
      encodeLoc('https://x.dev/zh/tags/测试/'),
      'https://x.dev/zh/tags/%E6%B5%8B%E8%AF%95/'
    );
  });

  it('纯 ASCII 路径保持原样', () => {
    assert.strictEqual(
      encodeLoc('https://x.dev/zh/hello-world/'),
      'https://x.dev/zh/hello-world/'
    );
  });

  it('非法 URL 原样返回（不抛错）', () => {
    assert.strictEqual(encodeLoc('not a url'), 'not a url');
    assert.strictEqual(encodeLoc(''), '');
  });
});

describe('toSitemapLastmod', () => {
  it('日期字符串转 ISO 8601 UTC', () => {
    assert.strictEqual(toSitemapLastmod('2026-09-10'), '2026-09-10T00:00:00.000Z');
  });

  it('Date 对象转 ISO', () => {
    assert.strictEqual(toSitemapLastmod(new Date('2026-09-10T08:30:00Z')), '2026-09-10T08:30:00.000Z');
  });

  it('非法值与空值返回 null（调用方应省略 lastmod 行）', () => {
    assert.strictEqual(toSitemapLastmod('不是日期'), null);
    assert.strictEqual(toSitemapLastmod(''), null);
    assert.strictEqual(toSitemapLastmod(null), null);
    assert.strictEqual(toSitemapLastmod(undefined), null);
  });
});
