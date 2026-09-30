'use strict';
/* global DOMParser */
// XML/Feed/sitemap 转义属性测试：
// 随机标题/描述/作者/URL（含 & < > " '、CDATA 边缘、控制字符、emoji/RTL）走真实
// feeds 模块生成 RSS/JSON Feed/sitemap，断言 XML 非法字符被清洗、元素数量与输入一致；
// 无头 Chrome 以 DOMParser 解析产物样例，要求 parsererror 为空且文本往返一致。
// 运行：npm run test:fuzz；复现：TEST_SEED=<种子> FC_NUM_RUNS=<次数> npm run test:fuzz。

const { before, after, describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const fc = require('fast-check');
const { createFeedsModule } = require('../build/feeds');
const { escapeHtml, stripInvalidXmlChars } = require('./utils');
const { encodeLoc } = require('./robots');
const { checkProperty, checkPropertyAsync, stressEnabled } = require('./test-random');
const { resolveChrome, launchChrome, closeChrome } = require('./web-harness');

const STRESS = stressEnabled();
const SAMPLE_LIMIT = STRESS ? 40 : 12;
const ARTICLE_LIMIT = STRESS ? 40 : 8;

// 独立的 XML 1.0 非法字符判定（与被测实现的清洗规则同源但独立书写，避免断言自证）。
function hasForbiddenXmlChar(text) {
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    if ((cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) || cp === 0xfffe || cp === 0xffff) return true;
    if (cp >= 0xd800 && cp <= 0xdfff) return true;
  }
  return false;
}

// 文本单元：正常字符 + XML 特殊字符 + 控制字符 + 孤立代理 + 双向/零宽字符 + emoji。
const SAFE_UNITS = ['a', 'Z', '0', '中', '文', '😀', '&', '<', '>', '"', "'", ' ', '\t', '\n', 'é'];
const RISK_UNITS = SAFE_UNITS.concat([
  ']]>', '<![CDATA[', '\r',
  '\u0000', '\u0001', '\u0007', '\u000B', '\u001F', '\uFFFE', '\uFFFF',
  '\uD800', '\uDFFF', '\u200B', '\u202E'
]);
const safeText = fc.array(fc.constantFrom(...SAFE_UNITS), { minLength: 0, maxLength: STRESS ? 80 : 16 }).map((units) => units.join(''));
const riskText = fc.array(fc.constantFrom(...RISK_UNITS), { minLength: 0, maxLength: STRESS ? 80 : 16 }).map((units) => units.join(''));

const siteTextArb = fc.record({
  title: riskText.map((text) => 'S' + text),
  description: riskText,
  author: riskText,
  copyright: riskText,
  url: fc.array(
    fc.constantFrom('/', '&', '<', '"', "'", '中', '😀', '\u0001', '\u0007', '\uD800'),
    { maxLength: STRESS ? 12 : 6 }
  ).map((parts) => 'https://example.test' + parts.join(''))
});

const articleArb = fc.record({
  lang: fc.constant('zh'),
  title: riskText.map((text) => 'T' + text),
  excerpt: riskText.map((text) => 'E' + text),
  content: riskText,
  tags: fc.array(riskText, { maxLength: 3 }),
  date: fc.date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2099-12-31T23:59:59Z'), noInvalidDate: true })
    .map((date) => date.toISOString().slice(0, 10)),
  url: fc.stringMatching(/^\/zh\/[a-z0-9-]{1,16}\/$/)
});

function makeConfig(site) {
  return {
    site: {
      url: site.url,
      title: site.title,
      description: site.description,
      language: 'zh-CN',
      languages: ['zh'],
      author: site.author,
      email: 'feed@example.test',
      copyright: site.copyright,
      rss: {
        enabled: true,
        path: 'feed.xml',
        maxItems: 50,
        fullContent: false,
        jsonFeed: { enabled: true, path: 'feed.json' }
      },
      sitemap: { enabled: true, path: 'sitemap.xml' },
      build: { generateIndex: true, generateArchive: true, generateGallery: true, generateTags: true, generateCategories: true },
      postsPerPage: 10
    },
    features: { sitemap: { split: false } }
  };
}

function makeCtx(distDir) {
  return {
    distDir,
    getFeed: () => require('feed').Feed,
    getPublished: (articles) => articles.filter((article) => !article.draft),
    recordBuildFailure: () => {},
    collectTags: () => [],
    collectCategories: () => [],
    collectSeries: () => []
  };
}

function countMatches(text, re) {
  return (text.match(re) || []).length;
}

// XML 解析器会把 \r\n / \r 归一化为 \n（XML 1.0 5.2.2），文本断言按此归一。
function normalizedXmlText(value) {
  return stripInvalidXmlChars(value).replace(/\r\n?/g, '\n');
}

function isSubsequence(candidate, source) {
  let cursor = 0;
  for (const ch of candidate) {
    cursor = source.indexOf(ch, cursor);
    if (cursor === -1) return false;
    cursor += ch.length;
  }
  return true;
}

// feeds 模块用 console.log 汇报产物路径；批量属性运行期间静音，避免输出淹没测试结果。
async function quietAsync(fn) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}
async function parseXmlBatch(page, samples) {
  return page.evaluate((list) => list.map((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const error = doc.querySelector('parsererror');
    if (error) return { parsererror: error.textContent.slice(0, 200) };
    return {
      parsererror: '',
      channelTitles: Array.from(doc.querySelectorAll('channel > title')).map((el) => el.textContent),
      itemTitles: Array.from(doc.querySelectorAll('item > title')).map((el) => el.textContent),
      itemDescriptions: Array.from(doc.querySelectorAll('item > description')).map((el) => el.textContent),
      locs: Array.from(doc.querySelectorAll('loc')).map((el) => el.textContent)
    };
  }), samples);
}

describe('XML/Feed/sitemap 属性', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-feeds-fuzz-'));
  const feeds = createFeedsModule(makeCtx(distDir));
  const chromePath = resolveChrome();
  const rssSamples = [];
  const sitemapSamples = [];
  let browser = null;
  let page = null;

  before(async () => {
    if (!chromePath) return;
    browser = await launchChrome(chromePath);
    page = await browser.newPage();
  });

  after(async () => {
    if (page) await page.close().catch(() => {});
    if (browser) await closeChrome(browser);
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('stripInvalidXmlChars：输出无非法字符、幂等、结果为输入子序列', () => {
    checkProperty('stripInvalidXmlChars-清洗不变量', fc, fc.property(riskText, (text) => {
      const stripped = stripInvalidXmlChars(text);
      assert.ok(!hasForbiddenXmlChar(stripped), '清洗后不得残留 XML 非法字符');
      assert.strictEqual(stripInvalidXmlChars(stripped), stripped, '清洗必须幂等');
      assert.ok(isSubsequence(stripped, text), '清洗只能删除字符，不得改写顺序');
      return true;
    }));
  });

  it('escapeHtml(stripInvalidXmlChars(x))：无裸 < / >，& 只以实体形式出现', () => {
    checkProperty('feeds-转义组合不变量', fc, fc.property(riskText, (text) => {
      const escaped = escapeHtml(stripInvalidXmlChars(text));
      assert.doesNotMatch(escaped, /[<>]/, '转义后不得出现裸尖括号');
      assert.ok(!hasForbiddenXmlChar(escaped), '转义后不得残留非法字符');
      assert.strictEqual(escaped.replace(/&(amp|lt|gt);/g, '').indexOf('&'), -1, '& 只能作为实体前缀出现');
      return true;
    }));
  });

  it('安全字符集文本：不含非法字符的输入清洗为恒等变换', () => {
    checkProperty('feeds-合法输入恒等', fc, fc.property(safeText, (text) => {
      assert.strictEqual(stripInvalidXmlChars(text), text);
      return true;
    }));
  });

  it('RSS：真实模块写出，item 数量一致且产物不含 XML 非法字符', async () => {
    await checkPropertyAsync('generateRSS-转义与结构', fc, fc.asyncProperty(
      siteTextArb, fc.array(articleArb, { maxLength: ARTICLE_LIMIT }),
      async (site, articles) => {
        const config = makeConfig(site);
        await quietAsync(() => feeds.generateRSS(config, articles));
        const xml = fs.readFileSync(path.join(distDir, 'zh', 'feed.xml'), 'utf-8');
        assert.ok(!hasForbiddenXmlChar(xml), 'RSS 产物不得含 XML 非法字符');
        assert.strictEqual(countMatches(xml, /<item>/g), articles.length, 'item 数量必须与输入一致');
        assert.strictEqual(countMatches(xml, /<channel>/g), 1);
        if (rssSamples.length < SAMPLE_LIMIT) {
          rssSamples.push({
            xml,
            channelTitle: normalizedXmlText(site.title),
            itemTitles: articles.map((article) => normalizedXmlText(article.title)),
            itemDescriptions: articles.map((article) => normalizedXmlText(article.excerpt))
          });
        }
        return true;
      }
    ));
  });

  it('JSON Feed：合法 JSON、item 数量与标题逐项一致（JSON 转义保留原文）', async () => {
    await checkPropertyAsync('generateJSONFeed-往返', fc, fc.asyncProperty(
      siteTextArb, fc.array(articleArb, { maxLength: ARTICLE_LIMIT }),
      async (site, articles) => {
        await quietAsync(() => feeds.generateJSONFeed(makeConfig(site), articles));
        const text = fs.readFileSync(path.join(distDir, 'zh', 'feed.json'), 'utf-8');
        const parsed = JSON.parse(text);
        assert.strictEqual(parsed.items.length, articles.length);
        assert.deepStrictEqual(parsed.items.map((item) => item.title), articles.map((article) => article.title));
        return true;
      }
    ));
  });

  it('sitemap：真实模块写出，url 数量与预期一致且产物不含 XML 非法字符', async () => {
    const sitemapTextArb = fc.record({
      postFrequency: riskText.map((text) => 'weekly' + text),
      pageFrequency: riskText.map((text) => 'monthly' + text),
      tagFrequency: riskText.map((text) => 'monthly' + text),
      postPriority: fc.double({ min: 0, max: 1, noNaN: true }),
      pagePriority: fc.double({ min: 0, max: 1, noNaN: true }),
      tagPriority: fc.double({ min: 0, max: 1, noNaN: true })
    });
    await checkPropertyAsync('generateSitemap-转义与结构', fc, fc.asyncProperty(
      siteTextArb, sitemapTextArb, fc.array(articleArb, { maxLength: ARTICLE_LIMIT }),
      async (site, sitemapText, articles) => {
        const config = makeConfig(site);
        config.features.sitemap = Object.assign({ split: false }, sitemapText);
        await quietAsync(() => feeds.generateSitemap(config, articles, [], [], []));
        const xml = fs.readFileSync(path.join(distDir, 'zh', 'sitemap.xml'), 'utf-8');
        assert.ok(!hasForbiddenXmlChar(xml), 'sitemap 产物不得含 XML 非法字符');
        const pagination = Math.max(0, Math.ceil(articles.length / 10) - 1);
        const expected = 5 + pagination + articles.length;
        assert.strictEqual(countMatches(xml, /<url>/g), expected, 'url 数量必须与页面集合一致');
        assert.strictEqual(countMatches(xml, /<loc>/g), expected);
        if (sitemapSamples.length < SAMPLE_LIMIT) {
          const base = site.url.replace(/\/+$/, '');
          const locations = ['/zh/'];
          for (let pageNo = 2; pageNo <= 1 + pagination; pageNo++) locations.push('/zh/page/' + pageNo + '/');
          for (const article of articles) locations.push(article.url);
          locations.push('/zh/archive/', '/zh/gallery/', '/zh/tags/', '/zh/categories/');
          sitemapSamples.push({
            xml,
            locs: locations.map((loc) => stripInvalidXmlChars(encodeLoc(base + loc)))
          });
        }
        return true;
      }
    ));
  });

  it('控制字符最小反例：RSS 与 sitemap 清洗后仍可解析且文本正确', async () => {
    const site = { url: 'https://example.test/\u0001', title: 'T\u0001T', description: 'D\u0007D', author: 'A\u0000A', copyright: '' };
    const articles = [{
      lang: 'zh',
      title: 'A\u0001B\u0007C]]>D]]>E',
      excerpt: 'x<y&z"q\']]>p]]>q',
      content: 'c',
      tags: ['t\u0001ag'],
      date: '2026-01-01',
      url: '/zh/ctrl/'
    }];
    await quietAsync(() => feeds.generateRSS(makeConfig(site), articles));
    await quietAsync(() => feeds.generateSitemap(makeConfig(site), articles, [], [], []));
    const rss = fs.readFileSync(path.join(distDir, 'zh', 'feed.xml'), 'utf-8');
    const sitemap = fs.readFileSync(path.join(distDir, 'zh', 'sitemap.xml'), 'utf-8');
    assert.ok(!hasForbiddenXmlChar(rss));
    assert.ok(!hasForbiddenXmlChar(sitemap));
    if (chromePath) {
      const [rssParsed, sitemapParsed] = await parseXmlBatch(page, [rss, sitemap]);
      assert.strictEqual(rssParsed.parsererror, '', 'RSS 必须无 parsererror');
      assert.strictEqual(sitemapParsed.parsererror, '', 'sitemap 必须无 parsererror');
      assert.deepStrictEqual(rssParsed.itemTitles, ['ABC]]>D]]>E'], '连续 CDATA 结束符必须完整往返');
      assert.deepStrictEqual(rssParsed.itemDescriptions, ['x<y&z"q\']]>p]]>q']);
      assert.strictEqual(rssParsed.channelTitles[0], 'TT');
      assert.ok(sitemapParsed.locs.some((loc) => loc.includes('https://example.test/')), 'loc 必须保留清洗后的站点 URL');
    }
  });

  it('DOMParser 批量解析：全部样例 parsererror 为空且标题/描述/loc 往返一致', { skip: !chromePath }, async () => {
    assert.ok(rssSamples.length > 0, '必须采集到 RSS 样例');
    assert.ok(sitemapSamples.length > 0, '必须采集到 sitemap 样例');
    const rssParsed = await parseXmlBatch(page, rssSamples.map((sample) => sample.xml));
    for (let i = 0; i < rssParsed.length; i++) {
      const parsed = rssParsed[i];
      const sample = rssSamples[i];
      assert.strictEqual(parsed.parsererror, '', 'RSS 样例必须无 parsererror：' + parsed.parsererror);
      assert.strictEqual(parsed.channelTitles[0], sample.channelTitle, 'channel 标题必须往返一致');
      assert.deepStrictEqual(parsed.itemTitles, sample.itemTitles, 'item 标题必须往返一致');
      assert.deepStrictEqual(parsed.itemDescriptions, sample.itemDescriptions, 'item 描述必须往返一致');
    }
    const sitemapParsed = await parseXmlBatch(page, sitemapSamples.map((sample) => sample.xml));
    for (let i = 0; i < sitemapParsed.length; i++) {
      const parsed = sitemapParsed[i];
      const sample = sitemapSamples[i];
      assert.strictEqual(parsed.parsererror, '', 'sitemap 样例必须无 parsererror：' + parsed.parsererror);
      assert.deepStrictEqual(parsed.locs, sample.locs, 'loc 必须与编码清洗后的输入一致');
    }
  });
});
