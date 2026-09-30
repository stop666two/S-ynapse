'use strict';
// markdown/frontmatter 纯函数属性测试：
// 覆盖 frontMatter 解析、marked 渲染管线（围栏保护/确定性）、sanitizeHtml 净化不变量
// 与 extractMediaRefs 的提取完整性。运行：npm run test:fuzz。

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const frontMatter = /** @type {<T = Record<string, unknown>>(file: string, options?: { allowUnsafe?: boolean }) => { attributes: T, body: string }} */ (/** @type {unknown} */ (require('front-matter')));
const { marked } = require('marked');

// marked.parse 的类型签名允许 async 模式；本项目始终同步消费，收窄为 string。
/** @param {string} md @returns {string} */
function renderMarkdown(md) {
  return /** @type {string} */ (marked.parse(md));
}
const { createMarkdownModule } = require('../build/markdown');
const { extractMediaRefs } = require('./content-validate');
const { sanitizeHtml, escapeHtml } = require('./utils');
const { checkProperty } = require('./test-random');
const { XSS_PAYLOADS } = require('./test-payloads');

// 固定的最小站点配置：features 走内置默认（math/supSub 打开），媒体 manifest 为空。
const RENDER_CONFIG = {
  site: {
    url: 'https://example.test',
    build: { usePictureTag: false, externalLinksTarget: '_blank', externalLinksRel: 'noopener noreferrer' },
    performance: {}
  },
  features: {}
};
createMarkdownModule().setupMarkedRenderer(RENDER_CONFIG, null);

const anyUnit = fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code));
const anyText = fc.string({ unit: anyUnit, maxLength: 40 });
// 过滤 U+2028/U+2029：行分隔符会破坏 YAML 双引号标量的行长边界。
const yamlText = fc.string({ unit: anyUnit, maxLength: 16 }).filter((s) => !/[\u2028\u2029]/.test(s));

function yamlScalar(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

describe('frontmatter 解析属性', () => {
  it('任意文本解析不崩溃；抛错必须携带行列定位', () => {
    checkProperty('frontmatter-解析容错', fc, fc.property(anyText, (text) => {
      let result;
      try {
        result = frontMatter(text);
      } catch (err) {
        assert.ok(err instanceof Error, '抛出的必须是 Error');
        assert.match(String(err.message), /line\s+\d+|column\s+\d+/i, '解析错误必须携带位置：' + err.message);
        return true;
      }
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual(typeof result.body, 'string');
      // front-matter 允许 YAML 根为标量（attributes 可能是 string/number），
      // 产品侧一律以 `fm.attributes || {}` 消费，故只断言字段存在。
      assert.ok(result.attributes !== undefined);
      return true;
    }));
  });

  it('带 --- 分隔符的随机文档：成功时结构完整，失败时消息含定位', () => {
    const doc = fc.tuple(anyText, anyText).map(([head, body]) => '---\n' + head + '\n---\n' + body);
    checkProperty('frontmatter-随机文档', fc, fc.property(doc, (text) => {
      try {
        const fm = frontMatter(text);
        assert.strictEqual(typeof fm.body, 'string');
        assert.ok(fm.attributes !== undefined);
      } catch (err) {
        assert.match(String(err.message), /line\s+\d+|column\s+\d+/i);
      }
      return true;
    }));
  });

  it('JSON 风格合法 frontmatter 往返保值（标题/数字/布尔/数组）', () => {
    const spec = fc.record({
      title: yamlText,
      count: fc.integer({ min: -1000000, max: 1000000 }),
      draft: fc.boolean(),
      tags: fc.array(yamlText, { maxLength: 4 })
    });
    checkProperty('frontmatter-往返保值', fc, fc.property(spec, (data) => {
      const text = [
        '---',
        'title: ' + yamlScalar(data.title),
        'count: ' + yamlScalar(data.count),
        'draft: ' + yamlScalar(data.draft),
        'tags: ' + JSON.stringify(data.tags),
        '---',
        '',
        '正文',
        ''
      ].join('\n');
      const fm = frontMatter(text);
      assert.strictEqual(fm.attributes.title, data.title);
      assert.strictEqual(fm.attributes.count, data.count);
      assert.strictEqual(fm.attributes.draft, data.draft);
      assert.deepStrictEqual(fm.attributes.tags, data.tags);
      assert.strictEqual(fm.body.trim(), '正文');
      return true;
    }));
  });

  it('同一对象内的重复键必被拒绝（YAML 语义）', () => {
    const spec = fc.record({
      key: fc.stringMatching(/^[a-z][a-z0-9_]{0,12}$/),
      first: fc.integer(),
      second: fc.integer()
    });
    checkProperty('frontmatter-重复键拒绝', fc, fc.property(spec, ({ key, first, second }) => {
      const text = ['---', key + ': ' + first, key + ': ' + second, '---', 'body', ''].join('\n');
      assert.throws(() => frontMatter(text), /duplicated mapping key/i);
      return true;
    }));
  });
});

describe('markdown 渲染属性', () => {
  const at = (char) => fc.constant(char);
  const piece = fc.oneof(
    anyText,
    at('# 标题'), at('## 小节'), at('**粗体**'), at('*斜体*'), at('> 引用'), at('- 列表项'),
    at('1. 有序项'), at('| a | b |'), at('|---|'),
    at('[链接](https://other.test/x)'), at('![图](/media/probe.png)'),
    at('<b>内联</b>'), at('$x^2$'), at('$$\\int_0^1 x\\,dx$$'), at('`行内代码`'),
    at('~~删除~~'), at('^上^'), at('~下~'), at('<script>alert(1)</script>')
  );
  const document = fc.array(piece, { maxLength: 8 }).map((parts) => parts.join('\n\n'));

  it('任意片段文档渲染不崩溃且返回字符串', () => {
    checkProperty('markdown-渲染容错', fc, fc.property(document, (md) => {
      const html = renderMarkdown(md);
      assert.strictEqual(typeof html, 'string');
      return true;
    }));
  });

  it('确定性：同一输入两次渲染字节一致', () => {
    checkProperty('markdown-确定性', fc, fc.property(document, (md) => {
      assert.strictEqual(renderMarkdown(md), renderMarkdown(md));
      return true;
    }));
  });

  it('围栏代码内容不被二次渲染', () => {
    const fenceChar = fc.constantFrom(...'ab cXYZ019#*-_<>&$/[]():;中'.split(''));
    const content = fc.string({ unit: fenceChar, minLength: 1, maxLength: 30 })
      .filter((s) => s.trim().length > 0 && !s.includes('`'))
      .map((s) => s + '<fence-probe>**fence-bold**');
    const lang = fc.constantFrom('js', 'html', 'text');
    checkProperty('markdown-围栏保护', fc, fc.property(content, lang, (body, fenceLang) => {
      const html = renderMarkdown('```' + fenceLang + '\n' + body + '\n```');
      assert.ok(html.includes('&lt;fence-probe&gt;'), '围栏内标签必须被转义：' + html.slice(0, 200));
      assert.ok(html.includes('**fence-bold**'), '围栏内标记必须保持字面：' + html.slice(0, 200));
      assert.ok(!html.includes('<fence-probe>'), '围栏内不得出现未转义标签');
      assert.ok(!html.includes('<strong>fence-bold</strong>'), '围栏内不得被二次渲染为强调');
      return true;
    }));
  });

  it('未知标签被转义为实体（净化不变量）', () => {
    const attrValue = fc.string({ unit: anyUnit, maxLength: 12 }).map((v) => v.replace(/"/g, ''));
    checkProperty('markdown-未知标签转义', fc, fc.property(attrValue, (value) => {
      const out = sanitizeHtml('<x-probe data-v="' + value + '">x</x-probe>');
      assert.ok(!out.includes('<x-probe'), '未知标签不得以原始形态出现：' + out);
      assert.ok(out.includes('&lt;x-probe'), '未知标签必须被转义保留：' + out);
      return true;
    }));
  });

  it('XSS 载荷经 marked + sanitize 后无可执行形态', () => {
    const inject = fc.tuple(anyText, fc.constantFrom(...XSS_PAYLOADS.map((p) => p.value)), anyText)
      .map(([before, payload, after]) => before + '\n\n' + payload + '\n\n' + after);
    checkProperty('markdown-XSS净化', fc, fc.property(inject, (md) => {
      const out = sanitizeHtml(renderMarkdown(md));
      assert.doesNotMatch(out, /<\s*(script|iframe|object|embed|svg|math|template|noscript|form)[\s>/]/i,
        '危险标签必须被移除：' + out.slice(0, 300));
      assert.doesNotMatch(out, /<[^>]*\son[a-z]+\s*=/i, '事件属性必须被移除：' + out.slice(0, 300));
      for (const match of out.matchAll(/(?:href|src)\s*=\s*"([^"]*)"/gi)) {
        assert.doesNotMatch(match[1], /^\s*(?:javascript|vbscript|data):/i, '危险协议必须被移除：' + match[1]);
      }
      return true;
    }));
  });
});

describe('extractMediaRefs 属性', () => {
  const mediaName = fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/).filter((s) => s.length > 0);
  const mediaExt = fc.constantFrom('.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif');
  const mediaRef = fc.tuple(mediaName, mediaExt).map(([name, ext]) => '/media/' + name + ext);

  it('本地媒体引用必被提取（不漏报）', () => {
    const doc = fc.tuple(anyText, mediaRef, anyText).map(([before, ref, after]) => before + ' ' + ref + ' ' + after);
    checkProperty('extractMediaRefs-不漏报', fc, fc.property(doc, (text) => {
      const refs = extractMediaRefs(text);
      const expected = text.match(/\/media\/[^\s"'()<>[\]{}]+/)[0];
      assert.ok(refs.includes(expected), '必须提取 ' + expected + '，实得 ' + JSON.stringify(refs));
      return true;
    }));
  });

  it('外链 URL 内的 /media/ 子串不被误报', () => {
    const url = fc.tuple(
      fc.constantFrom('https://cdn.test', 'http://assets.example.org', 'https://a.b.c.test'),
      mediaRef
    ).map(([host, ref]) => 'see ' + host + ref + ' end');
    checkProperty('extractMediaRefs-不误报外链', fc, fc.property(url, (text) => {
      assert.deepStrictEqual(extractMediaRefs(text), [], '外链不得被当作本地媒体：' + text);
      return true;
    }));
  });

  it('结果结构：均以 /media/ 开头、去除查询串、去重', () => {
    checkProperty('extractMediaRefs-结构', fc, fc.property(anyText, (text) => {
      const refs = extractMediaRefs(text);
      assert.ok(Array.isArray(refs));
      const seen = new Set();
      for (const ref of refs) {
        assert.ok(ref.startsWith('/media/'), '非法前缀：' + ref);
        assert.doesNotMatch(ref, /[?#]/, '必须去除查询串与散列：' + ref);
        assert.ok(!seen.has(ref), '不得重复：' + ref);
        seen.add(ref);
      }
      return true;
    }));
  });

  it('围栏与行内代码中的引用不参与提取（避免示例误报）', () => {
    checkProperty('extractMediaRefs-跳过代码', fc, fc.property(mediaRef, fc.constantFrom('```', '`'), (ref, tick) => {
      const doc = tick + (tick === '```' ? '\n' + ref + '\n' : ref) + tick;
      assert.deepStrictEqual(extractMediaRefs(doc), [], '代码中的引用不得提取：' + doc);
      return true;
    }));
  });
});

describe('空输入语义稳定', () => {
  it('marked/sanitize/extractMediaRefs 对空值的稳定输出', () => {
    assert.strictEqual(renderMarkdown(''), '');
    assert.strictEqual(sanitizeHtml(''), '');
    assert.strictEqual(sanitizeHtml(null), '');
    assert.deepStrictEqual(extractMediaRefs(''), []);
    assert.deepStrictEqual(extractMediaRefs(null), []);
    assert.deepStrictEqual(extractMediaRefs(undefined), []);
    assert.strictEqual(escapeHtml(''), '');
  });
});
