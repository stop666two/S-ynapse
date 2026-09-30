'use strict';
// slug/路径/URL 编码与安全属性测试：
// 覆盖 safeSlug/validateSlug 的路径安全与编码往返、encodeLoc 的 RFC 3986 规范化、
// buildSitemapUrls/toSitemapLastmod 的 URL 与日期不变量、nav-match 的任意路径判定、
// createMediaResolver 的引用解析容错。运行：npm run test:fuzz。

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fc = require('fast-check');
const { safeSlug, validateSlug } = require('./utils');
const { navPath, isNavActive, findNavActiveHref } = require('./nav-match');
const { buildSitemapUrls, encodeLoc, toSitemapLastmod } = require('./robots');
const { createMediaResolver } = require('./content-validate');
const { checkProperty } = require('./test-random');

const anyUnit = fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code));
const anyText = fc.string({ unit: anyUnit, maxLength: 40 });

// 有效码点的路径段字符：ASCII 字母数字、CJK 与部分组合字符/emoji（不含保留字符）。
const segChar = fc.oneof(
  fc.integer({ min: 0x61, max: 0x7a }).map((c) => String.fromCharCode(c)),
  fc.integer({ min: 0x4e00, max: 0x9fa5 }).map((c) => String.fromCharCode(c)),
  fc.constantFrom('é', 'ü', '中', '😀', '🎉')
);
const pathSegment = fc.string({ unit: segChar, minLength: 1, maxLength: 6 });
const documentPath = fc.array(pathSegment, { minLength: 1, maxLength: 4 }).map((segs) => segs.join('/'));

const DOC_SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-\u4e00\u9fa5';
const docSlug = fc.string({
  unit: fc.integer({ min: 0, max: DOC_SLUG_CHARS.length - 1 }).map((i) => DOC_SLUG_CHARS[i]),
  minLength: 1,
  maxLength: 60
});

describe('safeSlug / validateSlug 路径安全', () => {
  it('输出字符集封闭且可无损编码往返', () => {
    checkProperty('safeSlug-字符集与编码往返', fc, fc.property(anyText, (text) => {
      const slug = safeSlug(text);
      assert.doesNotMatch(slug, /[^a-z0-9\u4e00-\u9fa5-]/, '非法字符：' + JSON.stringify(slug));
      assert.strictEqual(decodeURIComponent(encodeURIComponent(slug)), slug, '编码往返必须无损');
      return true;
    }));
  });

  it('safeSlug 输出 join 到根目录后绝不逃逸', () => {
    const base = path.resolve('content-root');
    checkProperty('safeSlug-路径不逃逸', fc, fc.property(anyText, (text) => {
      const slug = safeSlug(text) || 'empty';
      const resolved = path.resolve(base, slug);
      assert.ok(resolved === base || resolved.startsWith(base + path.sep), '必须位于根目录内：' + resolved);
      assert.strictEqual(resolved, path.join(base, slug));
      return true;
    }));
  });

  it('合法 slug 接受域原样通过并可安全 join', () => {
    const base = path.resolve('content-root');
    checkProperty('validateSlug-接受域', fc, fc.property(docSlug, (raw) => {
      const result = validateSlug(raw);
      assert.strictEqual(result.ok, true, '合法 slug 必须接受：' + JSON.stringify(raw));
      assert.strictEqual(result.slug, raw);
      const resolved = path.resolve(base, result.slug);
      assert.ok(resolved.startsWith(base + path.sep));
      return true;
    }));
  });

  it('注入分隔符/遍历/非法字符的 slug 必被拒绝', () => {
    // 基准串至少 2 字符，注入位置限制在 1..len-1（前后都有字符）：
    // validateSlug 会先 trim 首尾空白，边界位置的 ' ' 属归一化路径而非注入路径。
    const injectBase = fc.string({
      unit: fc.integer({ min: 0, max: DOC_SLUG_CHARS.length - 1 }).map((i) => DOC_SLUG_CHARS[i]),
      minLength: 2,
      maxLength: 60
    });
    const inject = fc.tuple(injectBase, fc.constantFrom('/', '\\', '..', '<', '%2e', ' ', '\u0000'), fc.nat())
      .map(([base, bad, n]) => {
        const at = 1 + (n % (base.length - 1));
        return base.slice(0, at) + bad + base.slice(at);
      });
    checkProperty('validateSlug-拒绝注入', fc, fc.property(inject, (raw) => {
      assert.strictEqual(validateSlug(raw).ok, false, '注入串必须拒绝：' + JSON.stringify(raw));
      return true;
    }));
  });
});

describe('encodeLoc 与 sitemap URL 属性', () => {
  it('任意字符串不抛；合法 URL 输出已规范化且幂等', () => {
    checkProperty('encodeLoc-容错与幂等', fc, fc.property(anyText, (text) => {
      const encoded = encodeLoc(text);
      assert.strictEqual(typeof encoded, 'string');
      let parsed;
      try {
        parsed = new URL(text);
      } catch (err) {
        return true;
      }
      const once = encodeLoc(text);
      assert.strictEqual(once, parsed.toString(), '可解析 URL 必须规范化为 WHATWG 形式');
      assert.strictEqual(encodeLoc(once), once, '编码必须幂等');
      return true;
    }));
  });

  it('Unicode 路径经 percent-encoding 后可解码回原值', () => {
    const prefix = 'https://example.test/';
    const url = documentPath.map((p) => prefix + p);
    checkProperty('encodeLoc-往返', fc, fc.property(url, (full) => {
      const segments = full.slice(prefix.length);
      const encoded = encodeLoc(full);
      const parsed = new URL(encoded);
      assert.strictEqual(parsed.toString(), encoded);
      assert.strictEqual(decodeURIComponent(parsed.pathname.replace(/^\//, '')), segments);
      return true;
    }));
  });

  it('buildSitemapUrls：绝对、无重复、语言数决定份数', () => {
    const spec = fc.record({
      baseUrl: fc.constantFrom('https://example.test', 'https://a.example.test/sub'),
      sitemapPath: fc.constantFrom('sitemap.xml', '/sitemap.xml', 'zh/sitemap.xml'),
      languages: fc.uniqueArray(fc.stringMatching(/^[a-z]{2}$/), { maxLength: 4 })
    });
    checkProperty('buildSitemapUrls-结构', fc, fc.property(spec, ({ baseUrl, sitemapPath, languages }) => {
      const urls = buildSitemapUrls({ baseUrl, sitemapPath, languages });
      const normPath = '/' + sitemapPath.replace(/^\/+/, '');
      assert.strictEqual(urls.length, languages.length <= 1 ? 1 : languages.length);
      assert.strictEqual(new Set(urls).size, urls.length, '不得重复：' + JSON.stringify(urls));
      for (const url of urls) {
        assert.ok(url.startsWith(baseUrl.replace(/\/+$/, '')), '必须以 baseUrl 开头：' + url);
        const parsed = new URL(url);
        assert.ok(parsed.href.endsWith(normPath) || normPath.endsWith(parsed.pathname));
      }
      return true;
    }));
  });

  it('toSitemapLastmod：合法日期 UTC 往返，垃圾输入省略', () => {
    const valid = fc.date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2099-12-31T23:59:59Z'), noInvalidDate: true });
    checkProperty('toSitemapLastmod-合法日期', fc, fc.property(valid, (date) => {
      const iso = toSitemapLastmod(date);
      assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      assert.strictEqual(new Date(iso).getTime(), date.getTime());
      return true;
    }));
    const garbage = fc.string({ unit: fc.constantFrom('q', 'w', 'x', 'z', 'Q', 'Z'), maxLength: 8 });
    checkProperty('toSitemapLastmod-垃圾输入', fc, fc.property(garbage, (text) => {
      assert.strictEqual(toSitemapLastmod(text), null);
      return true;
    }));
  });
});

describe('nav-match 任意路径判定', () => {
  const hrefArb = fc.oneof(
    anyText,
    fc.constantFrom('/', '/zh/', '/en/', '/zh/tags/', '/zh/tags/foo/', '#section', 'https://other.test/', ''),
    documentPath.map((p) => '/' + p + '/')
  );
  const pathnameArb = fc.oneof(
    fc.constantFrom('/', '/zh/', '/en/', '/zh/posts/a/', '/zh/tags/foo/'),
    documentPath.map((p) => '/' + p)
  );

  it('任意输入不抛且返回类型正确', () => {
    checkProperty('nav-match-容错', fc, fc.property(pathnameArb, hrefArb, (current, href) => {
      assert.strictEqual(typeof navPath(current), 'string');
      assert.strictEqual(typeof isNavActive(current, href), 'boolean');
      assert.strictEqual(typeof findNavActiveHref(current, [{ url: href }]), 'string');
      return true;
    }));
  });

  it('首页 href 只允许精确匹配', () => {
    checkProperty('nav-match-首页精确', fc, fc.property(pathnameArb, fc.constantFrom('/', '/zh/', '/en/'), (current, home) => {
      assert.strictEqual(isNavActive(current, home), navPath(current) === home,
        '首页不变量失败：' + current + ' vs ' + home);
      return true;
    }));
  });

  it('派生自当前路径的父级目标必命中；跨语言目标不命中', () => {
    const seg = fc.stringMatching(/^[a-z]{1,8}$/);
    checkProperty('nav-match-前缀语义', fc, fc.property(seg, seg, (parentSeg, childSeg) => {
      const target = '/zh/' + parentSeg + '/';
      const child = target + childSeg + '/';
      assert.strictEqual(isNavActive(child, target), true, '子路径必须命中父级：' + child + ' vs ' + target);
      const crossLang = '/en/' + parentSeg + '/';
      assert.strictEqual(isNavActive(crossLang, target), false, '跨语言不得命中：' + crossLang + ' vs ' + target);
      return true;
    }));
  });

  it('findNavActiveHref 返回菜单内命中项，无命中返回空串', () => {
    const menuItem = fc.record({ url: hrefArb, label: anyText.map((s) => s.slice(0, 10)) });
    const menu = fc.array(menuItem, { maxLength: 5 });
    checkProperty('nav-match-菜单扫描', fc, fc.property(pathnameArb, menu, (current, items) => {
      const active = findNavActiveHref(current, items);
      if (active === '') {
        assert.ok(items.every((item) => !isNavActive(current, item.url)), '有命中项时不得返回空串');
      } else {
        assert.ok(items.some((item) => item.url === active), '返回的 href 必须来自菜单');
      }
      return true;
    }));
  });
});

describe('createMediaResolver 引用解析', () => {
  const stem = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/);
  const file = fc.tuple(stem, fc.constantFrom('.png', '.jpg', '.webp')).map(([s, ext]) => s + ext);

  it('已声明源文件精确命中，未声明引用不抛且拒绝', () => {
    const files = fc.uniqueArray(file, { maxLength: 5 });
    checkProperty('mediaResolver-精确与容错', fc, fc.property(files, anyText, (list, raw) => {
      const exists = createMediaResolver(list);
      for (const name of list) assert.strictEqual(exists('/media/' + name), true, '应命中：' + name);
      assert.strictEqual(typeof exists(raw), 'boolean');
      if (!raw.startsWith('/media/')) assert.strictEqual(exists(raw), false);
      return true;
    }));
  });

  it('生成变体路径按源文件基名命中', () => {
    const spec = fc.tuple(stem, fc.constantFrom('.png', '.jpg'), fc.integer({ min: 1, max: 4096 }));
    checkProperty('mediaResolver-变体', fc, fc.property(spec, ([base, ext, width]) => {
      const exists = createMediaResolver([base + ext]);
      assert.strictEqual(exists('/media/variants/' + base + '-' + width + '.webp'), true);
      assert.strictEqual(exists('/media/variants/' + base + '-' + width + '.avif'), true);
      assert.strictEqual(exists('/media/variants/other-' + width + '.webp'), false);
      return true;
    }));
  });
});
