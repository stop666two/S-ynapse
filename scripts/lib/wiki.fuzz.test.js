'use strict';
// wiki 双链/双语配对/导出属性测试：
// 覆盖 resolveWikiLinks 的未知目标三态与后缀/大小写/自定义标签组合、已知标题与 slug 解析、
// link 模式 URL 编码合法性（任意 BMP 文本不崩溃、无裸空格/控制字符）；bilingual-core 的
// 配置夹取/对照 URL 判定/断点判定/属性剥离；findAlternateArticle 配对不误配；
// mdExportRelPath 路径白名单与 writeArticleMarkdown 源字节一致。
// 运行：npm run test:fuzz；复现：TEST_SEED=<种子> FC_NUM_RUNS=<次数> npm run test:fuzz。

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fc = require('fast-check');
const { resolveWikiLinks } = require('./utils');
const { findAlternateArticle } = require('./bilingual-pair');
const { mdExportRelPath, writeArticleMarkdown } = require('./md-export');
const { checkProperty, stressEnabled } = require('./test-random');

const STRESS = stressEnabled();
const CORE_PATH = path.join(__dirname, '..', '..', 'js', 'domains', 'features', 'bilingual-core.js');
let core = null;
async function loadCore() {
  if (!core) core = await import(pathToFileURL(CORE_PATH).href);
  return core;
}

const anyUnit = fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code));
const anyText = fc.string({ unit: anyUnit, maxLength: 40 });
const nonBracketUnit = anyUnit.filter((ch) => ch !== '[' && ch !== ']' && ch !== '|');
const anyTarget = fc.string({ unit: nonBracketUnit, minLength: 1, maxLength: 30 });
const alphaCjkUnit = fc.oneof(
  fc.integer({ min: 0x61, max: 0x7a }).map((code) => String.fromCharCode(code)),
  fc.integer({ min: 0x41, max: 0x5a }).map((code) => String.fromCharCode(code)),
  fc.integer({ min: 0x4e00, max: 0x9fa5 }).map((code) => String.fromCharCode(code))
);
const titleArb = fc.string({ unit: alphaCjkUnit, minLength: 1, maxLength: 12 });
const slugArb = fc.stringMatching(/^[a-z0-9-]{1,12}$/);
const langArb = fc.oneof(fc.constantFrom('zh', 'en', 'zh-Hant'), fc.constantFrom('z', 'zhh', '中', ''));

// 与构建期 articles.js 的 wikiLookup 同构：titles 键小写、titlesExact 保留原文大小写、slugs 原样。
function buildLookup(entries) {
  const titles = new Map();
  const titlesExact = new Map();
  const slugs = new Map();
  for (const entry of entries) {
    const info = { title: entry.title, url: entry.url };
    titles.set(entry.title.toLowerCase(), info);
    if (!titlesExact.has(entry.title)) titlesExact.set(entry.title, info);
    slugs.set(entry.slug, info);
  }
  return { titles, titlesExact, slugs };
}

function hasBlankOrControl(value) {
  for (const ch of String(value)) {
    if (ch.codePointAt(0) <= 0x20) return true;
  }
  return false;
}

function toWellFormed(value) {
  return String(value)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}

function markdownUrl(output) {
  const match = /\]\(([^)]*)\)$/.exec(output);
  assert.ok(match, '必须是 Markdown 链接形态：' + JSON.stringify(output));
  return match[1];
}

// 大小写变体：优先小写、其次大写；两者都不改变（纯 CJK/数字）时返回空串表示不存在变体。
function caseVariant(title) {
  if (title.toLowerCase() !== title) return title.toLowerCase();
  if (title.toUpperCase() !== title) return title.toUpperCase();
  return '';
}

const entryArb = fc.record({
  title: titleArb,
  slug: slugArb
}).map((entry) => Object.assign({}, entry, { url: '/zh/' + entry.slug + '/' }));
const entriesArb = fc.uniqueArray(entryArb, {
  maxLength: STRESS ? 12 : 5,
  selector: (entry) => entry.title.toLowerCase() + '\u0000' + entry.slug
});

describe('resolveWikiLinks 属性', () => {
  it('任意内容与任意选项不崩溃，输出仍为字符串', () => {
    const optionArb = fc.record({
      unknownMode: fc.oneof(fc.constantFrom('text', 'link', 'hide', 'bogus'), fc.constant(undefined)),
      unknownSuffix: fc.oneof(anyText, fc.constant(undefined)),
      caseInsensitive: fc.boolean(),
      allowCustomLabel: fc.boolean(),
      lang: fc.oneof(anyText, fc.constant(undefined))
    });
    checkProperty('resolveWikiLinks-容错', fc, fc.property(anyText, optionArb, (content, options) => {
      const output = resolveWikiLinks(content, buildLookup([]), options);
      assert.strictEqual(typeof output, 'string');
      return true;
    }));
  });

  it('未知目标三态：text 降级原文+后缀、link 生成合法搜索链接、hide 整体移除', () => {
    const caseArb = fc.tuple(anyTarget, anyText, fc.constantFrom('text', 'link', 'hide', 'bogus', undefined));
    checkProperty('resolveWikiLinks-未知三态', fc, fc.property(caseArb, ([rawTarget, suffix, mode]) => {
      // 产品契约先 trim 目标；空/纯空白目标按空串处理。
      const target = rawTarget.trim();
      const output = resolveWikiLinks('[[' + rawTarget + ']]', buildLookup([]), { unknownMode: mode, unknownSuffix: suffix });
      if (mode === 'hide') {
        assert.strictEqual(output, '');
      } else if (mode === 'link') {
        const url = markdownUrl(output);
        assert.strictEqual(output, '[' + target + suffix + '](/zh/search/?q=' + encodeURIComponent(toWellFormed(target)) + ')');
        assert.ok(!hasBlankOrControl(url), '链接不得含裸空白/控制字符：' + JSON.stringify(url));
        assert.strictEqual(new URL(url, 'https://example.test').searchParams.get('q'), toWellFormed(target), '查询词必须可无损解码');
      } else {
        assert.strictEqual(output, target + suffix, '未知目标必须降级为显示文本');
      }
      return true;
    }));
  });

  it('已知标题：默认忽略大小写解析，自定义标签可控', () => {
    checkProperty('resolveWikiLinks-标题解析', fc, fc.property(entriesArb, fc.nat(), fc.constantFrom('', 'Label'), fc.boolean(), (entries, pick, label, allowLabel) => {
      fc.pre(entries.length > 0);
      const entry = entries[pick % entries.length];
      const lookup = buildLookup(entries);
      const target = caseVariant(entry.title);
      if (!target) return true;
      const inner = target + (label ? '|' + label : '');
      const output = resolveWikiLinks('[[' + inner + ']]', lookup, { allowCustomLabel: allowLabel });
      const expectedHit = lookup.titles.get(target.toLowerCase());
      assert.ok(expectedHit, '测试前提：忽略大小写标题必须命中');
      const expectedLabel = allowLabel && label ? label : expectedHit.title;
      assert.strictEqual(output, '[' + expectedLabel + '](' + expectedHit.url + ')');
      return true;
    }));
  });

  it('已知 slug：首尾斜杠被归一化后解析', () => {
    checkProperty('resolveWikiLinks-slug 解析', fc, fc.property(entriesArb, fc.nat(), (entries, pick) => {
      fc.pre(entries.length > 0);
      const entry = entries[pick % entries.length];
      const output = resolveWikiLinks('[[/' + entry.slug + '/]]', buildLookup(entries), {});
      const hit = buildLookup(entries).slugs.get(entry.slug);
      assert.ok(hit, '测试前提：slug 必须存在');
      assert.strictEqual(output, '[' + hit.title + '](' + hit.url + ')');
      return true;
    }));
  });

  it('大小写敏感模式：仅精确标题命中，大小写变体按未命中策略处理', () => {
    checkProperty('resolveWikiLinks-大小写敏感', fc, fc.property(entriesArb, fc.nat(), (entries, pick) => {
      fc.pre(entries.length > 0);
      const entry = entries[pick % entries.length];
      const lookup = buildLookup(entries);
      const exactHit = lookup.titlesExact.get(entry.title);
      const exact = resolveWikiLinks('[[' + entry.title + ']]', lookup, { caseInsensitive: false });
      assert.ok(exactHit, '测试前提：精确标题必须存在');
      assert.strictEqual(exact, '[' + exactHit.title + '](' + exactHit.url + ')');
      const variant = caseVariant(entry.title);
      if (!variant) return true;
      const variantHit = lookup.titlesExact.get(variant) || lookup.slugs.get(variant.replace(/^\/+|\/+$/g, ''));
      const fallback = resolveWikiLinks('[[' + variant + ']]', lookup, { caseInsensitive: false, unknownMode: 'text' });
      const expected = variantHit ? '[' + variantHit.title + '](' + variantHit.url + ')' : variant;
      assert.strictEqual(fallback, expected, '敏感模式必须只按精确键解析');
      return true;
    }));
  });

  it('未知后缀与 hide 组合：后缀只作用于降级文本，hide 不受后缀影响', () => {
    checkProperty('resolveWikiLinks-后缀组合', fc, fc.property(anyTarget, anyText, (rawTarget, suffix) => {
      const lookup = buildLookup([]);
      const target = rawTarget.trim();
      assert.strictEqual(resolveWikiLinks('[[' + rawTarget + ']]', lookup, { unknownSuffix: suffix }), target + suffix);
      assert.strictEqual(resolveWikiLinks('[[' + rawTarget + ']]', lookup, { unknownMode: 'hide', unknownSuffix: suffix }), '');
      return true;
    }));
  });

  it('站外链接：http/https 原样输出，自定义标签生效', () => {
    const externalArb = fc.tuple(slugArb, fc.constantFrom('http://', 'https://'));
    checkProperty('resolveWikiLinks-外链', fc, fc.property(externalArb, fc.constantFrom('', 'Label'), ([slug, scheme], label) => {
      const url = scheme + 'example.test/' + slug;
      const inner = label ? url + '|' + label : url;
      assert.strictEqual(resolveWikiLinks('[[' + inner + ']]', buildLookup([]), {}), '[' + (label || url) + '](' + url + ')');
      return true;
    }));
  });

  it('链接 token 全部消费：合法 token 输入解析后不再残留 [[', () => {
    const tokenArb = anyTarget.map((target) => '[[' + target + ']]');
    checkProperty('resolveWikiLinks-token 消费', fc, fc.property(fc.array(tokenArb, { minLength: 1, maxLength: 6 }), (tokens) => {
      const content = tokens.join(' ');
      const output = resolveWikiLinks(content, buildLookup([]), { unknownMode: 'text' });
      assert.ok(!output.includes('[['), '解析后不得残留开始定界符');
      assert.ok(!output.includes(']]'), '解析后不得残留结束定界符');
      return true;
    }));
  });

  it('孤立代理目标：link 模式不抛错且代理替换为 U+FFFD 后可解码', () => {
    const surrogateArb = fc.constantFrom('\uD800', '\uDFFF', 'a\uD800b', '\uD83D\uDE00');
    checkProperty('resolveWikiLinks-孤立代理', fc, fc.property(surrogateArb, (target) => {
      const output = resolveWikiLinks('[[' + target + ']]', buildLookup([]), { unknownMode: 'link' });
      const url = markdownUrl(output);
      assert.strictEqual(new URL(url, 'https://example.test').searchParams.get('q'), toWellFormed(target));
      return true;
    }));
  });
});

describe('bilingual-core 属性', () => {
  it('resolveBilingualConfig：断点必须夹取到 480–3840 的整数', async () => {
    const c = await loadCore();
    const rawArb = fc.record({
      breakpointPx: fc.oneof(fc.double({ min: -10000, max: 10000, noNaN: false }), fc.string({ maxLength: 8 }), fc.constant(undefined)),
      enabled: fc.boolean(),
      switch: fc.boolean(),
      sideBySide: fc.boolean()
    });
    checkProperty('bilingual-配置夹取', fc, fc.property(rawArb, (raw) => {
      const result = c.resolveBilingualConfig(raw);
      assert.ok(Number.isInteger(result.breakpointPx));
      assert.ok(result.breakpointPx >= 480 && result.breakpointPx <= 3840);
      assert.strictEqual(result.enabled, raw.enabled !== false);
      assert.strictEqual(result.switch, raw.switch !== false);
      assert.strictEqual(result.sideBySide, raw.sideBySide !== false);
      return true;
    }));
  });

  it('isAlternateHref：仅接受站内 /<lang> 或 /<lang>/… 且无 //、反斜杠、?、#、.. 的路径', async () => {
    const c = await loadCore();
    checkProperty('bilingual-对照 URL 判定', fc, fc.property(anyText, langArb, (href, lang) => {
      const expected = /^[a-z]{2,3}$/.test(lang)
        && href.charAt(0) === '/' && href.indexOf('//') === -1
        && !/[\\?#]/.test(href) && href.indexOf('..') === -1
        && (href === '/' + lang || href.indexOf('/' + lang + '/') === 0);
      assert.strictEqual(c.isAlternateHref(href, lang), expected, JSON.stringify({ href, lang }));
      return true;
    }));
  });

  it('shouldShowSideBySide：断点边界（含等于）与非法宽度语义确定', async () => {
    const c = await loadCore();
    const cfgArb = fc.record({ sideBySide: fc.boolean(), breakpointPx: fc.integer({ min: 0, max: 4000 }) });
    checkProperty('bilingual-断点判定', fc, fc.property(cfgArb, fc.boolean(), fc.integer({ min: 0, max: 5000 }), (cfg, hasAlt, width) => {
      const expected = cfg.sideBySide !== false && hasAlt && width >= cfg.breakpointPx;
      assert.strictEqual(c.shouldShowSideBySide(cfg, hasAlt, width), expected);
      assert.strictEqual(c.shouldShowSideBySide(cfg, hasAlt, NaN), false);
      return true;
    }));
  });

  it('paneStripAttribute：id/data-vt/on* 必剥离且大小写不敏感，普通属性保留', async () => {
    const c = await loadCore();
    const nameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]{0,12}$/);
    checkProperty('bilingual-属性剥离', fc, fc.property(nameArb, (name) => {
      const lower = name.toLowerCase();
      const expected = lower === 'id' || lower === 'data-vt' || lower.startsWith('data-vt-') || lower.startsWith('on');
      assert.strictEqual(c.paneStripAttribute(name), expected, name);
      return true;
    }));
  });
});

describe('findAlternateArticle 属性', () => {
  const articleArb = fc.record({
    lang: fc.constantFrom('zh', 'en'),
    slug: fc.stringMatching(/^[a-z0-9-]{1,8}$/),
    draft: fc.boolean(),
    url: fc.stringMatching(/^\/[a-z]{2}\/[a-z0-9/-]{1,10}\/$/)
  });

  it('配对不误配：与「另一语言 + 同 slug + 非草稿」的首个候选严格一致', () => {
    checkProperty('bilingual-pair-不误配', fc, fc.property(fc.array(articleArb, { maxLength: STRESS ? 40 : 12 }), fc.nat(), (list, pick) => {
      if (!list.length) return true;
      const article = list[pick % list.length];
      const result = findAlternateArticle(list, article);
      const expected = list.find((candidate) => candidate.lang !== article.lang && candidate.slug === article.slug && !candidate.draft) || null;
      assert.strictEqual(result, expected, '必须返回模型定义的首个合格候选');
      if (result) {
        assert.notStrictEqual(result.lang, article.lang);
        assert.strictEqual(result.slug, article.slug);
        assert.strictEqual(result.draft, false);
      }
      return true;
    }));
  });

  it('确定性边界：同语言/草稿/缺失文章与非法集合不产生配对', () => {
    const zh = { lang: 'zh', slug: 'same', draft: false, url: '/zh/same/' };
    const zhDraft = { lang: 'zh', slug: 'same', draft: true, url: '/zh/same/' };
    const en = { lang: 'en', slug: 'same', draft: false, url: '/en/same/' };
    const enDraft = { lang: 'en', slug: 'same', draft: true, url: '/en/same/' };
    assert.strictEqual(findAlternateArticle([zh, zhDraft], zh), null, '同语言/草稿不得配对');
    assert.strictEqual(findAlternateArticle([zhDraft, en], zhDraft), en, '对方非草稿可配对');
    assert.strictEqual(findAlternateArticle([zh, enDraft], zh), null, '对方草稿不得配对');
    assert.strictEqual(findAlternateArticle([zh, en, { lang: 'en', slug: 'same', draft: false, url: '/en/same-2/' }], zh), en, '必须取首个候选');
    assert.strictEqual(findAlternateArticle(undefined, zh), null);
    assert.strictEqual(findAlternateArticle('not-an-array', zh), null);
    assert.strictEqual(findAlternateArticle([zh], null), null);
  });
});

describe('Markdown 导出属性', () => {
  const validLangArb = fc.stringMatching(/^[A-Za-z0-9-]{1,20}$/);
  const validSlugArb = fc.stringMatching(/^[A-Za-z0-9_\u4e00-\u9fa5-]{1,60}$/);

  it('mdExportRelPath：合法 lang/slug 组装固定路径且不逃逸，非法输入返回 null', () => {
    checkProperty('md-export-路径白名单', fc, fc.property(validLangArb, validSlugArb, (lang, slug) => {
      const rel = mdExportRelPath(lang, slug);
      assert.strictEqual(rel, 'md/' + lang + '/' + slug + '.md');
      assert.doesNotMatch(rel, /[\\]/);
      assert.ok(!rel.split('/').includes('..'));
      const base = path.resolve('dist-root');
      const resolved = path.resolve(base, rel.split('/').join(path.sep));
      assert.ok(resolved.startsWith(base + path.sep), '导出路径必须位于产物根内');
      return true;
    }));
    const badLang = fc.constantFrom('', '.', '..', 'a'.repeat(21), 'z h', '../x', 'zh/sub', '中文');
    checkProperty('md-export-非法 lang', fc, fc.property(badLang, (lang) => {
      assert.strictEqual(mdExportRelPath(lang, 'ok-slug'), null, '非法 lang 必须拒绝：' + JSON.stringify(lang));
      return true;
    }));
    const badSlug = fc.constantFrom('', '.', '..', '../evil', 'a/b', 'a\\b', 'a b', 'a<b>', '%2e%2e', 'x\u0000y');
    checkProperty('md-export-非法 slug', fc, fc.property(badSlug, (slug) => {
      assert.strictEqual(mdExportRelPath('zh', slug), null, '非法 slug 必须拒绝：' + JSON.stringify(slug));
      return true;
    }));
  });

  it('writeArticleMarkdown：产物字节与源文件逐字节一致（含孤立代理写盘替换语义）', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-wiki-fuzz-'));
    try {
      checkProperty('md-export-字节一致', fc, fc.property(
        validLangArb, validSlugArb, anyText, anyText,
        (lang, slug, frontmatterTitle, body) => {
          const source = '---\ntitle: ' + frontmatterTitle + '\n---\n\n' + body + '\n';
          const src = path.join(root, 'source.md');
          fs.writeFileSync(src, source, 'utf-8');
          const distDir = path.join(root, 'dist');
          const rel = writeArticleMarkdown({ lang: lang, slug: slug, sourceFile: src, distDir: distDir });
          assert.strictEqual(rel, mdExportRelPath(lang, slug));
          const dest = path.join(distDir, rel.split('/').join(path.sep));
          assert.deepStrictEqual(fs.readFileSync(dest), fs.readFileSync(src), '导出内容必须与源文件字节一致');
          return true;
        }
      ));
    } finally {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });
});
