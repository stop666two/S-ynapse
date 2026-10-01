'use strict';
/* global DOMParser */
// T4 恶意/畸形场景套件：以真实构建 CLI（SYNAPSE_ROOT 指向 .tmp-test 临时站点）逐类验证
// 两类失败策略：
//   hard-fail：非零退出、错误信息定位到 file（或配置 file:line）、既有产物不被半成品污染；
//   degrade  ：构建成功、产物可用、告警与失败条目进入报告（report.txt）。
// 与 test:build 同约定：`npm test` 生命周期下跳过（集成构建不属于单测套件）。
// 运行：npm run test:malicious；STRESS=1 打开海量/超长档。

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { runBuild, resolveChrome, launchChrome, closeChrome } = require('./lib/web-harness');
const { createTestSite, BROKEN_PNG_HEAD } = require('./lib/test-site-builder');
const { stressEnabled, makeRng } = require('./lib/test-random');
const { generateOversizeSet, TRAVERSAL_PAYLOADS } = require('./lib/test-payloads');
const { safeSlug, validateSlug } = require('./lib/utils');

const SKIP_IN_UNIT_SUITE = process.env.npm_lifecycle_event === 'test';
const STRESS = stressEnabled();
const XSS_MARKERS = ['XSSPROBE7'];
const BUILD_TIMEOUT_MS = STRESS ? 480000 : 240000;

// ---------- 产物扫描（浏览器同语义的轻量 tokenizer，避免转义文本误报） ----------

const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href', 'data']);

/** 递归收集目录内全部文件（排序保证确定性）。 */
function collectFiles(dir) {
  const out = [];
  (function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (err) { return; }
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.push(abs);
    }
  })(dir);
  return out.sort();
}

function listRelative(dir) {
  return collectFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/'));
}

/** 目录内容快照（路径 → sha1），用于「预校验失败不污染既有产物」断言。 */
function snapshotDir(dir) {
  const crypto = require('node:crypto');
  const out = {};
  for (const rel of listRelative(dir)) {
    out[rel] = crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, rel))).digest('hex');
  }
  return out;
}

/** 解码常见 HTML 实体（属性值比对 URL 协议用）。 */
function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (m, hex) => {
      const cp = parseInt(hex, 16);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&#(\d+);?/g, (m, dec) => {
      const cp = parseInt(dec, 10);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** 引号感知的标签切分：返回 { name, tagText, attrs, content }。 */
function tokenizeTags(html) {
  const tags = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    let j = lt + 1;
    let quote = null;
    let gt = -1;
    while (j < html.length) {
      const ch = html[j];
      if (quote) { if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') { gt = j; break; }
      j++;
    }
    if (gt === -1) break;
    const tagText = html.slice(lt + 1, gt);
    const nameMatch = /^[ \t\r\n/]*([a-zA-Z][a-zA-Z0-9-]*)/.exec(tagText);
    const name = nameMatch ? nameMatch[1].toLowerCase() : '';
    const attrs = [];
    const attrSource = tagText.replace(/^[ \t\r\n/]*[a-zA-Z][a-zA-Z0-9-]*/, '');
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9:_.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(attrSource)) !== null) {
      const value = attrMatch[3] !== undefined ? attrMatch[3] : (attrMatch[4] !== undefined ? attrMatch[4] : attrMatch[5]);
      attrs.push([attrMatch[1].toLowerCase(), value]);
    }
    let content = null;
    if (name === 'script' || name === 'style' || name === 'title' || name === 'textarea') {
      const rest = html.slice(gt + 1);
      const closeRe = new RegExp('</' + name + '\\s*>', 'i');
      const close = closeRe.exec(rest);
      content = close ? rest.slice(0, close.index) : rest;
      i = gt + 1 + (close ? close.index + close[0].length : rest.length);
    } else {
      i = gt + 1;
    }
    tags.push({ name, tagText, attrs, content });
  }
  return tags;
}

/** 去掉 JS 字符串字面量（保留代码位置），用于判断 marker 是否处于可执行位置。 */
function stripJsStrings(code) {
  return String(code)
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

function hasLoneSurrogate(text) {
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xd800 && cp <= 0xdfff) return true;
  }
  return false;
}

/** HTML 执行性扫描：事件属性 / 危险 URL 协议 / srcdoc / 非 ld+json 脚本内的 marker 代码。 */
function scanHtmlForExecutable(html) {
  const findings = [];
  for (const tag of tokenizeTags(html)) {
    if (tag.name === 'script') {
      if (/application\/ld\+json/i.test(tag.tagText)) {
        try {
          JSON.parse(tag.content);
        } catch (err) {
          findings.push('ld+json-parse-error');
        }
      } else {
        const code = stripJsStrings(tag.content);
        for (const marker of XSS_MARKERS) {
          if (code.includes(marker)) findings.push('script-code:' + marker);
        }
      }
    }
    for (const [attrName, attrValue] of tag.attrs) {
      if (/^on/i.test(attrName) && String(attrValue).trim()) findings.push('event-attr:' + attrName);
      if (URL_ATTRS.has(attrName) && /^\s*(javascript|vbscript|data):/i.test(decodeEntities(attrValue).trim())) {
        findings.push('unsafe-url:' + attrName);
      }
      if (attrName === 'srcdoc') findings.push('srcdoc');
    }
  }
  return findings;
}

/** XML（RSS/sitemap）扫描：只认真实元素/属性，转义文本不误报。 */
function scanXmlForExecutable(xml) {
  const findings = [];
  if (/<\s*\/?\s*script\b/i.test(xml)) findings.push('raw-script-token');
  if (/<[^>]*\son[a-z]+\s*=/i.test(xml)) findings.push('event-attr');
  return findings;
}

/** JSON（搜索索引/JSON Feed）扫描：raw 层不得出现可执行标签起始串；URL 字段协议白名单。 */
function scanJsonDocument(text) {
  const findings = [];
  if (/<\s*\/?\s*script\b/i.test(text)) findings.push('raw-script-token');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    findings.push('invalid-json');
    return findings;
  }
  const URL_KEYS = /(^|\.)(url|link|href|featuredImage|home_page_url|feed_url|external_url|id)$/;
  (function walk(value, keyPath) {
    if (typeof value === 'string') {
      if (URL_KEYS.test(keyPath) && /^\s*(javascript|vbscript|data):/i.test(value)) findings.push('unsafe-json-url:' + keyPath);
      if (hasLoneSurrogate(value)) findings.push('lone-surrogate:' + keyPath);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, keyPath + '[' + index + ']'));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) walk(child, keyPath ? keyPath + '.' + key : key);
    }
  })(parsed, '');
  return findings;
}

// ---------- 夹具与构建 ----------

/** @type {ReturnType<typeof createTestSite>[]} */
const fixtures = [];

function makeSite(options) {
  const site = createTestSite(Object.assign({
    articles: 0,
    pages: 1,
    langs: ['zh', 'en'],
    linkProject: true
  }, options || {}));
  fixtures.push(site);
  return site;
}

function build(site, outDir, extraArgs) {
  return runBuild(outDir, {
    env: Object.assign({ SYNAPSE_ROOT: site.root }, process.env.STRESS ? { STRESS: process.env.STRESS } : {}),
    extraArgs: extraArgs || [],
    timeoutMs: BUILD_TIMEOUT_MS
  });
}

function readOut(result) {
  return String(result.stdout || '') + String(result.stderr || '');
}

// ---------- 载荷构造 ----------

function frontmatterArticle(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    lines.push(key + ': ' + JSON.stringify(value));
  }
  lines.push('---', '', '');
  return lines.join('\n');
}

function articleBody(title, body) {
  return '# ' + title + '\n\n' + body + '\n';
}

describe('T4 恶意/畸形场景', { skip: SKIP_IN_UNIT_SUITE ? 'run via npm run test:malicious (integration, not the unit suite)' : false }, () => {
  /** @type {any} */ let browser = null;
  /** @type {any} */ let page = null;
  const chromePath = resolveChrome();

  before(async () => {
    if (!chromePath) return;
    browser = await launchChrome(chromePath);
    page = await browser.newPage();
  });

  after(async () => {
    if (page) await page.close().catch(() => {});
    if (browser) await closeChrome(browser);
    for (const site of fixtures) site.cleanup();
  });

  // =====================================================================
  // 1 + 6 + 7 + 8 + 9：降级类合并为一次真实构建（减少构建次数）
  // =====================================================================
  describe('降级类场景（同一站点一次构建）', () => {
    let site = null;
    let outDir = '';
    let result = null;
    let elapsedMs = 0;
    const rng = makeRng(STRESS ? 0x5eed0001 : 0x5eed0002);

    before(() => {
      const oversize = generateOversizeSet(rng, STRESS);
      const tagLimit = STRESS ? 300 : 40;
      const tags = oversize[3].value.split(',').slice(0, tagLimit);
      const longTitle = oversize[0].value;
      const longBody = oversize[1].value;
      const encodingFiles = {
        // BOM / CRLF / 混合换行 / 孤立代理：写入时由 Node 归一化，构建必须成功且输出可解析。
        'articles/zh/enc-bom.md': '\uFEFF' + frontmatterArticle({ title: 'Enc BOM', slug: 'enc-bom', date: '2026-03-01' }) + articleBody('Enc BOM', 'BOM 正文'),
        'articles/zh/enc-crlf.md': frontmatterArticle({ title: 'Enc CRLF', slug: 'enc-crlf', date: '2026-03-02' }).replace(/\n/g, '\r\n') + articleBody('Enc CRLF', 'CRLF 正文').replace(/\n/g, '\r\n'),
        'articles/zh/enc-mixed.md': frontmatterArticle({ title: 'Enc Mixed', slug: 'enc-mixed', date: '2026-03-03' }) + '第一行\n第二行\r\n第三行\r第四行\n',
        'articles/zh/enc-lone.md': frontmatterArticle({ title: 'Enc Lone', slug: 'enc-lone', date: '2026-03-04' }) + articleBody('Enc Lone', '孤立代理 front\uD800matter 之后'),
        'articles/zh/enc-invalid.md': Buffer.concat([
          Buffer.from(frontmatterArticle({ title: 'Enc Invalid', slug: 'enc-invalid', date: '2026-03-05' }) + '# Enc Invalid\n\n', 'utf-8'),
          Buffer.from([0xc3, 0x28, 0xe2, 0x82, 0x80, 0x80, 0xff, 0xfe]),
          Buffer.from('\n', 'utf-8')
        ]),
        'articles/zh/enc-nul.md': Buffer.from(frontmatterArticle({ title: 'Enc Nul', slug: 'enc-nul', date: '2026-03-06' }) + '# Enc Nul\n\nA\u0000B\n', 'utf-8')
      };
      const mediaFiles = {
        'media/zero.png': Buffer.alloc(0),
        'media/not-image.png': Buffer.from('this is not an image', 'utf-8'),
        'media/truncated.png': BROKEN_PNG_HEAD,
        'media/oversize.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x7f, 0xff, 0xff, 0xff, 0x7f, 0xff, 0xff, 0xff])
      };
      site = makeSite({
        articles: 0,
        pages: 1,
        media: true,
        siteOverrides: {
          languages: ['zh', 'en'],
          rss: { enabled: true, path: 'feed.xml', jsonFeed: { enabled: true, path: 'feed.json' } },
          sitemap: { enabled: true, path: 'sitemap.xml' },
          build: { cleanDist: true, optimizeMedia: true, cjkFonts: { enabled: false } }
        },
        featuresOverrides: { autoSummary: { maxLength: 24, ellipsis: '…' } },
        extraFiles: Object.assign({
          // 类 1：超长标题（派生 slug 必须被长度上限约束）与 20 万字正文
          'articles/zh/oversize-title.md': frontmatterArticle({ title: longTitle, date: '2026-04-01' }) + articleBody('超长标题', '正文'),
          'articles/zh/oversize-body.md': frontmatterArticle({ title: 'Oversize Body', slug: 'oversize-body', date: '2026-04-02' }) + articleBody('超长正文', longBody),
          'articles/zh/oversize-tags.md': frontmatterArticle({ title: 'Oversize Tags', slug: 'oversize-tags', date: '2026-04-03', tags }) + articleBody('海量标签', '标签页压力样本'),
          // 类 5：空站元素（空正文/空 frontmatter）在非空站中的降级
          'articles/zh/empty-body.md': frontmatterArticle({ title: 'Empty Body', slug: 'empty-body', date: '2026-04-04' }) + '\n',
          // 类 8：未来日期过滤（排除）与斜杠日期兼容（保留）
          'articles/zh/future-date.md': frontmatterArticle({ title: 'Future Date', slug: 'future-date', date: '2999-01-01' }) + articleBody('未来日期', '不应发布'),
          'articles/zh/slash-date.md': frontmatterArticle({ title: 'Slash Date', slug: 'slash-date', date: '2026/01/01' }) + articleBody('斜杠日期', '兼容路径'),
          // 类 9：emoji / ZWJ / RTL / 组合字符 / CJK 扩展区 / 代理对截断
          'articles/zh/uni-emoji.md': frontmatterArticle({ title: '🎉 发布庆祝', slug: 'uni-emoji', date: '2026-05-01' }) + articleBody('🎉 发布庆祝', '表情标题'),
          'articles/zh/uni-zwj.md': frontmatterArticle({ title: '👨‍👩‍👧‍👦 全家福', slug: 'uni-zwj', date: '2026-05-02' }) + articleBody('👨‍👩‍👧‍👦 全家福', 'ZWJ 序列'),
          'articles/zh/uni-rtl.md': frontmatterArticle({ title: '\u202Egnp.exe\u202C', slug: 'uni-rtl', date: '2026-05-03' }) + articleBody('RTL', '双向覆盖字符'),
          'articles/zh/uni-combining.md': frontmatterArticle({ title: 'e\u0301\u0301\u0301 组合变音符', slug: 'uni-combining', date: '2026-05-04' }) + articleBody('组合字符', 'e\u0301\u0301\u0301'),
          'articles/zh/uni-cjk-ext.md': frontmatterArticle({ title: '𠀀𠀁𠀂 扩展区', date: '2026-05-05' }) + articleBody('𠀀𠀁𠀂 扩展区', 'CJK 扩展 B 区'),
          'articles/zh/uni-truncate.md': frontmatterArticle({ title: 'Uni Truncate', slug: 'uni-truncate', date: '2026-05-06' }) + articleBody('Unicode 截断', '👨‍👩‍👧‍👦'.repeat(40))
        }, encodingFiles, mediaFiles)
      });
      outDir = path.join(site.root, 'out');
      const startedAt = Date.now();
      result = build(site, outDir);
      elapsedMs = Date.now() - startedAt;
    });

    it('类 1 超长与海量：构建成功、派生 slug 受 120 上限约束、耗时受控', () => {
      assert.strictEqual(result.status, 0, 'degrade 站点必须构建成功：\n' + readOut(result).slice(-3000));
      const match = /Processed: oversize-title\.md -> (\/zh\/[^/\s]+)\//.exec(result.stdout);
      assert.ok(match, '构建日志必须包含超长标题文章的最终 URL');
      const slug = match[1].replace('/zh/', '');
      assert.ok(slug.length <= 120, '派生 slug 不得超过 120 字符，实际 ' + slug.length);
      assert.ok(fs.existsSync(path.join(outDir, 'zh', 'oversize-title', 'index.html')) || fs.existsSync(path.join(outDir, 'zh', slug, 'index.html')), '超长标题文章页必须生成');
      assert.ok(elapsedMs < BUILD_TIMEOUT_MS, '构建耗时必须受子进程超时约束');
      assert.ok(fs.existsSync(path.join(outDir, 'zh', 'oversize-body', 'index.html')), '超长正文文章页必须生成');
      assert.ok(fs.existsSync(path.join(outDir, 'zh', 'oversize-tags', 'index.html')), '海量标签文章页必须生成');
    });

    it('类 6 编码异常：BOM/CRLF/混合换行归一化，非法字节与孤立代理不产生无效 UTF-8', () => {
      assert.strictEqual(result.status, 0);
      for (const slug of ['enc-bom', 'enc-crlf', 'enc-mixed', 'enc-lone', 'enc-invalid', 'enc-nul']) {
        assert.ok(fs.existsSync(path.join(outDir, 'zh', slug, 'index.html')), '编码样本页面必须生成：' + slug);
      }
      const decoder = new TextDecoder('utf-8', { fatal: true });
      for (const file of collectFiles(outDir)) {
        if (!/\.(html?|xml|json|txt|css)$/i.test(file)) continue;
        const rel = path.relative(outDir, file).split(path.sep).join('/');
        assert.doesNotThrow(() => decoder.decode(fs.readFileSync(file)), '产物必须是合法 UTF-8：' + rel);
        const text = fs.readFileSync(file, 'utf-8');
        assert.ok(!hasLoneSurrogate(text), '产物不得含孤立代理：' + rel);
      }
      const pageText = fs.readFileSync(path.join(outDir, 'zh', 'enc-bom', 'index.html'), 'utf-8');
      assert.ok(pageText.includes('Enc BOM'), 'BOM 必须被剥离且标题保留');
    });

    it('类 7 损坏媒体：0 字节/非图片/超大图降级为告警并进入报告，引用缺失已在预校验 hard-fail', () => {
      assert.strictEqual(result.status, 0, '损坏媒体不得阻断构建：\n' + readOut(result).slice(-2000));
      const report = fs.readFileSync(path.join(outDir, 'report.txt'), 'utf-8').replace(/\\/g, '/');
      for (const name of ['zero.png', 'not-image.png', 'truncated.png', 'oversize.png']) {
        assert.ok(report.includes(name), 'report.txt 告警段必须包含损坏媒体条目：' + name);
      }
      assert.ok(report.includes('[media]'), '告警条目必须标注 media 阶段');
      assert.ok(report.includes('[告警]'), '报告必须包含告警段');
    });

    it('类 8 日期：未来日期按发布窗口排除，斜杠日期兼容保留', () => {
      assert.ok(readOut(result).includes('future-dated article(s) scheduled'), '构建日志必须提示定时发布排除');
      assert.ok(!fs.existsSync(path.join(outDir, 'zh', 'future-date', 'index.html')), '未来日期文章不得产出页面');
      assert.ok(fs.existsSync(path.join(outDir, 'zh', 'slash-date', 'index.html')), '斜杠日期属兼容路径，必须保留');
    });

    it('类 9 emoji/双向/组合字符：URL 编码合法、摘要截断不破坏代理对', () => {
      const sitemap = fs.readFileSync(path.join(outDir, 'zh', 'sitemap.xml'), 'utf-8');
      assert.ok(!/[\u{1F000}-\u{1FAFF}\u{3400}-\u{4DBF}]/u.test(sitemap), 'sitemap loc 不得含原始 emoji/扩展区字符（必须百分号编码）');
      const locs = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
      const encoded = locs.find((loc) => loc.includes('%'));
      assert.ok(encoded, '必须存在百分号编码的 loc');
      assert.doesNotThrow(() => decodeURIComponent(encoded), 'loc 必须可解码');
      for (const slug of ['uni-emoji', 'uni-zwj', 'uni-rtl', 'uni-combining', 'uni-truncate']) {
        assert.ok(fs.existsSync(path.join(outDir, 'zh', slug, 'index.html')), 'Unicode 样本页必须生成：' + slug);
      }
      const zhIndexHtml = fs.readFileSync(path.join(outDir, 'zh', 'index.html'), 'utf-8');
      const indexUrlMatch = /__SEARCH_INDEX_URL__\s*=\s*"([^"]+)"/.exec(zhIndexHtml);
      assert.ok(indexUrlMatch, 'zh 首页必须暴露 __SEARCH_INDEX_URL__');
      const indexFile = path.join(outDir, ...indexUrlMatch[1].replace(/^\//, '').split('/'));
      assert.ok(fs.existsSync(indexFile), '搜索索引文件必须存在：' + indexUrlMatch[1]);
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
      const doc = (index.docs || []).find((d) => String(d.url || '').includes('uni-truncate'));
      assert.ok(doc, '搜索索引必须包含 uni-truncate 文档');
      assert.ok(!hasLoneSurrogate(doc.excerpt), '摘要不得含孤立代理');
      assert.ok(Array.from(doc.excerpt).length <= 24 + 1, '摘要必须按码点截断：' + JSON.stringify(doc.excerpt));
      assert.ok(doc.excerpt.endsWith('…'), '发生截断时以省略号收尾：' + JSON.stringify(doc.excerpt));
    });

    it('类 9（续）feed 合法：DOMParser 可解析且无执行性构造', { skip: chromePath ? false : '未检测到 Chrome（DOMParser 断言跳过）' }, async () => {
      const rss = fs.readFileSync(path.join(outDir, 'zh', 'feed.xml'), 'utf-8');
      const parsed = await page.evaluate((xml) => {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const error = doc.querySelector('parsererror');
        return { parsererror: error ? error.textContent.slice(0, 200) : '', titles: Array.from(doc.querySelectorAll('item > title')).map((el) => el.textContent) };
      }, rss);
      assert.strictEqual(parsed.parsererror, '', 'RSS 必须可被 DOMParser 解析');
      assert.ok(parsed.titles.some((t) => t.includes('🎉')), 'feed 标题中的 emoji 必须往返一致');
      assert.deepStrictEqual(scanXmlForExecutable(rss), [], 'feed 不得含执行性构造');
    });
  });

  // =====================================================================
  // 2：XSS 全字段注入（构建成功，产物无执行性载荷）
  // =====================================================================
  describe('类 2 XSS 全字段注入', () => {
    let outDir = '';
    let result = null;

    before(() => {
      const M = XSS_MARKERS[0];
      const P_SCRIPT = '<script>' + M + 'alert(1)</script>';
      const P_IMG = '<img src=x onerror=' + M + 'alert(2)>';
      const P_URI = 'javascript:' + M + 'alert(3)';
      const P_SVG = '"><svg/onload=' + M + 'alert(4)>';
      const P_BREAK = '</script><script>' + M + 'alert(5)</script>';
      const P_ATTR = '" onmouseover="' + M + 'alert(6)';
      const site = makeSite({
        media: true,
        siteOverrides: {
          languages: ['zh', 'en'],
          title: 'Site ' + P_SCRIPT,
          description: 'Desc ' + P_SVG,
          author: 'Author ' + P_IMG,
          rss: { enabled: true, path: 'feed.xml', jsonFeed: { enabled: true, path: 'feed.json' } },
          sitemap: { enabled: true, path: 'sitemap.xml' },
          social: { enabled: true, items: { github: { enabled: true, type: 'link', url: 'https://example.test/?q=' + encodeURIComponent(P_URI) } } }
        },
        extraFiles: {
          'articles/zh/xss-all-fields.md': [
            '---',
            'title: ' + JSON.stringify('Title ' + P_SVG),
            'slug: xss-all-fields',
            'date: 2026-02-01',
            'excerpt: ' + JSON.stringify('Excerpt ' + P_SCRIPT),
            'author: ' + JSON.stringify('Author ' + P_IMG),
            'tags: ' + JSON.stringify(['tag ' + P_SVG, 'tag2 ' + P_ATTR]),
            'categories: ' + JSON.stringify(['cat ' + P_ATTR]),
            '---',
            '',
            articleBody('XSS 全字段', [P_SCRIPT, P_BREAK, '[危险链接](' + P_URI + ')', '![像素图](/media/test-pixel.png)'].join('\n\n'))
          ].join('\n')
        }
      });
      outDir = path.join(site.root, 'out');
      result = build(site, outDir);
    });

    it('构建成功且 HTML 无事件属性/危险协议/可执行 marker', () => {
      assert.strictEqual(result.status, 0, 'XSS 注入必须被消毒而非阻断：\n' + readOut(result).slice(-3000));
      for (const file of collectFiles(outDir)) {
        const rel = path.relative(outDir, file).split(path.sep).join('/');
        if (/\.html?$/i.test(rel)) {
          assert.deepStrictEqual(scanHtmlForExecutable(fs.readFileSync(file, 'utf-8')), [], 'HTML 含执行性构造：' + rel);
        }
      }
    });

    it('RSS/sitemap 无执行性构造，JSON Feed/搜索索引无可执行标签起始串', () => {
      for (const rel of ['zh/feed.xml', 'en/feed.xml', 'zh/sitemap.xml', 'en/sitemap.xml']) {
        assert.deepStrictEqual(scanXmlForExecutable(fs.readFileSync(path.join(outDir, rel), 'utf-8')), [], 'XML 含执行性构造：' + rel);
      }
      const jsonFiles = collectFiles(outDir).filter((f) => /(feed\.json|search-index\..*\.json)$/.test(f));
      assert.ok(jsonFiles.length >= 2, '必须产出 JSON Feed 与搜索索引');
      for (const file of jsonFiles) {
        assert.deepStrictEqual(scanJsonDocument(fs.readFileSync(file, 'utf-8')), [], 'JSON 含执行性构造：' + path.relative(outDir, file));
      }
    });

    it('产物无临时文件残留', () => {
      const leftovers = collectFiles(outDir).filter((f) => path.basename(f).includes('.tmp-'));
      assert.deepStrictEqual(leftovers, [], '不得残留 .tmp- 文件');
    });
  });

  // =====================================================================
  // 3 + 4 + 8：路径遍历/保留 slug/重复/非法日期 → hard-fail 且不污染产物
  // =====================================================================
  describe('类 3+8 hard-fail 内容场景', () => {
    let outDir = '';
    let result = null;
    let beforeSnapshot = null;
    const files = {
      'articles/zh/traversal-dotdot.md': frontmatterArticle({ title: 'Traversal Dotdot', slug: '../escape', date: '2026-01-01' }) + '# x\n',
      'articles/zh/traversal-win.md': frontmatterArticle({ title: 'Traversal Win', slug: '..\\windows\\system32', date: '2026-01-02' }) + '# x\n',
      'articles/zh/traversal-abs.md': frontmatterArticle({ title: 'Traversal Abs', slug: '/etc/shadow', date: '2026-01-03' }) + '# x\n',
      'articles/zh/traversal-drive.md': frontmatterArticle({ title: 'Traversal Drive', slug: 'C:\\Windows\\system.ini', date: '2026-01-04' }) + '# x\n',
      'articles/zh/traversal-encoded.md': frontmatterArticle({ title: 'Traversal Encoded', slug: '%2e%2e%2f', date: '2026-01-05' }) + '# x\n',
      'articles/zh/reserved-con.md': frontmatterArticle({ title: 'Reserved Con', slug: 'CON', date: '2026-01-06' }) + '# x\n',
      'articles/zh/reserved-derived.md': frontmatterArticle({ title: 'NUL', date: '2026-01-07' }) + '# x\n',
      'articles/zh/reserved-route.md': frontmatterArticle({ title: 'Reserved Route', slug: 'tags', date: '2026-01-08' }) + '# x\n',
      'articles/zh/reserved-route-derived.md': frontmatterArticle({ title: 'search', date: '2026-01-09' }) + '# x\n',
      'articles/zh/dup-a.md': frontmatterArticle({ title: 'Dup A', slug: 'dup-slug', date: '2026-01-10' }) + '# x\n',
      'articles/zh/dup-b.md': frontmatterArticle({ title: 'Dup B', slug: 'dup-slug', date: '2026-01-11' }) + '# x\n',
      'articles/zh/bad-date.md': frontmatterArticle({ title: 'Bad Date', slug: 'bad-date', date: '2026-13-45' }) + '# x\n',
      'articles/zh/missing-media.md': frontmatterArticle({ title: 'Missing Media', slug: 'missing-media', date: '2026-01-12' }) + '# x\n\n![缺图](/media/does-not-exist.png)\n'
    };

    before(() => {
      const site = makeSite({ extraFiles: files });
      outDir = path.join(site.root, 'out');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'legacy-artifact.html'), '<p>old build output</p>', 'utf-8');
      beforeSnapshot = snapshotDir(outDir);
      result = build(site, outDir);
    });

    it('非零退出且逐条给出文件定位', () => {
      assert.notStrictEqual(result.status, 0, '恶意内容必须阻断构建');
      const output = readOut(result);
      for (const file of Object.keys(files)) {
        assert.ok(output.includes(file), '错误清单必须包含文件：' + file);
      }
      assert.ok(output.includes('reserved OS device name'), '保留设备名必须给出明确原因');
      assert.ok(output.includes('collides with the generated'), '保留路由必须给出明确原因');
    });

    it('预校验先于 dist 清理：既有产物逐字节不变且无新增文件', () => {
      assert.deepStrictEqual(snapshotDir(outDir), beforeSnapshot, '预校验失败不得改动既有输出目录');
    });
  });

  // =====================================================================
  // 3+8 降级边界：slug 身份类错误不可降级；媒体缺失可降级继续
  // =====================================================================
  describe('类 3+8 降级模式边界', () => {
    it('--allow-degraded 不放行重复/保留路由/非法 slug（非零退出且不污染产物）', () => {
      const site = makeSite({
        extraFiles: {
          'articles/zh/dup-a.md': frontmatterArticle({ title: 'Dup A', slug: 'dup-slug', date: '2026-01-10' }) + '# x\n',
          'articles/zh/dup-b.md': frontmatterArticle({ title: 'Dup B', slug: 'dup-slug', date: '2026-01-11' }) + '# x\n',
          'articles/zh/reserved-route.md': frontmatterArticle({ title: 'Reserved Route', slug: 'tags', date: '2026-01-12' }) + '# x\n',
          'articles/zh/invalid-slug.md': frontmatterArticle({ title: 'Invalid', slug: '../escape', date: '2026-01-13' }) + '# x\n'
        }
      });
      const outDir = path.join(site.root, 'out');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'legacy-artifact.html'), '<p>old build output</p>', 'utf-8');
      const beforeSnapshot = snapshotDir(outDir);
      const result = build(site, outDir, ['--allow-degraded']);
      assert.notStrictEqual(result.status, 0, '降级模式必须仍阻断 slug 冲突：\n' + readOut(result).slice(-3000));
      const output = readOut(result);
      for (const file of ['dup-a.md', 'dup-b.md', 'reserved-route.md', 'invalid-slug.md']) {
        assert.ok(output.includes(file), '错误清单必须包含文件：' + file);
      }
      assert.ok(output.includes('critical'), '错误清单必须标注 critical 以解释降级为何无效');
      assert.ok(output.includes('never degraded'), 'FATAL 文案必须说明 slug 问题不可降级');
      assert.deepStrictEqual(snapshotDir(outDir), beforeSnapshot, 'critical 预校验失败不得改动既有输出目录');
    });

    it('--allow-degraded 仅豁免媒体引用缺失，构建继续并生成页面', () => {
      const site = makeSite({
        extraFiles: {
          'articles/zh/missing-media.md': frontmatterArticle({ title: 'Missing Media', slug: 'missing-media', date: '2026-01-14' }) + '# x\n\n![缺图](/media/does-not-exist.png)\n'
        }
      });
      const outDir = path.join(site.root, 'out');
      const result = build(site, outDir, ['--allow-degraded']);
      assert.strictEqual(result.status, 0, '媒体类失败可在降级模式继续：\n' + readOut(result).slice(-2000));
      assert.ok(readOut(result).includes('references missing media'), '构建日志必须保留媒体缺失告警');
      assert.ok(fs.existsSync(path.join(outDir, 'zh', 'missing-media', 'index.html')), '降级产物必须生成该文章页');
    });
  });

  // =====================================================================
  // 7 续：损坏 featuredImage 回退自动封面（页面/feed/索引无悬空引用）
  // =====================================================================
  describe('类 7 featuredImage 损坏回退自动封面', () => {
    let outDir = '';
    let result = null;

    before(() => {
      const site = makeSite({
        articles: 0,
        pages: 0,
        siteOverrides: {
          languages: ['zh', 'en'],
          rss: { enabled: true, path: 'feed.xml', jsonFeed: { enabled: true, path: 'feed.json' } },
          sitemap: { enabled: true, path: 'sitemap.xml' },
          build: { cleanDist: true, optimizeMedia: true, cjkFonts: { enabled: false } }
        },
        extraFiles: {
          'articles/zh/cover-broken.md': frontmatterArticle({ title: 'Cover Broken', slug: 'cover-broken', date: '2026-06-01', featuredImage: '/media/zero.png' }) + '# Cover Broken\n\n正文。\n',
          'media/zero.png': Buffer.alloc(0)
        }
      });
      outDir = path.join(site.root, 'out');
      result = build(site, outDir);
    });

    it('构建成功：文章页/卡片使用自动封面，无 /media/zero.png 悬空引用', () => {
      assert.strictEqual(result.status, 0, '损坏头图必须降级而非阻断：\n' + readOut(result).slice(-2000));
      const page = fs.readFileSync(path.join(outDir, 'zh', 'cover-broken', 'index.html'), 'utf-8');
      assert.ok(!page.includes('/media/zero.png'), '文章页不得残留损坏头图引用');
      assert.ok(page.includes('/og/cover-cover-broken.'), '文章页必须使用生成的自动封面');
      const home = fs.readFileSync(path.join(outDir, 'zh', 'index.html'), 'utf-8');
      assert.ok(!home.includes('/media/zero.png'), '首页卡片不得残留损坏头图引用');
      assert.ok(home.includes('/og/cover-cover-broken.'), '首页卡片必须使用生成的自动封面');
    });

    it('feeds 与搜索索引不残留悬空头图，报告含回退告警', () => {
      for (const rel of ['zh/feed.xml', 'zh/feed.json']) {
        assert.ok(!fs.readFileSync(path.join(outDir, rel), 'utf-8').includes('zero.png'), rel + ' 不得残留损坏头图');
      }
      const home = fs.readFileSync(path.join(outDir, 'zh', 'index.html'), 'utf-8');
      const indexUrl = /__SEARCH_INDEX_URL__\s*=\s*"([^"]+)"/.exec(home);
      assert.ok(indexUrl, '首页必须暴露搜索索引 URL');
      const indexText = fs.readFileSync(path.join(outDir, ...indexUrl[1].replace(/^\//, '').split('/')), 'utf-8');
      assert.ok(!indexText.includes('zero.png'), '搜索索引不得残留损坏头图');
      const report = fs.readFileSync(path.join(outDir, 'report.txt'), 'utf-8').replace(/\\/g, '/');
      assert.ok(report.includes('[media]'), '报告告警段必须包含 media 条目');
      assert.ok(report.includes('zero.png'), '报告必须点名损坏文件');
      assert.ok(report.includes('falling back to auto cover'), '报告必须说明回退行为');
    });
  });

  // =====================================================================
  // 4：坏 JSON5 / 断裂配置（语法/重复键/类型漂移/越界枚举）
  // =====================================================================
  describe('类 4 坏配置 hard-fail', () => {
    const cases = [
      { id: 'syntax', featuresContent: '{ search: { enabled: tru } }\n', expect: '解析失败' },
      { id: 'duplicate', featuresContent: '{\n  // 重复键\n  search: { enabled: true, enabled: false }\n}\n', expect: 'features.json5:3' },
      { id: 'type-drift', featuresContent: '{ search: { enabled: "yes" } }\n', expect: 'features.search.enabled' },
      { id: 'enum', featuresContent: '{ ogImageStyle: { enabled: true, template: "neon" } }\n', expect: 'features.ogImageStyle.template' }
    ];
    for (const testCase of cases) {
      it('配置变体「' + testCase.id + '」非零退出并定位', () => {
        const site = makeSite({ featuresContent: testCase.featuresContent });
        const outDir = path.join(site.root, 'out');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'legacy.txt'), 'keep', 'utf-8');
        const snapshot = snapshotDir(outDir);
        const result = build(site, outDir);
        assert.notStrictEqual(result.status, 0, '变体 ' + testCase.id + ' 必须阻断构建');
        assert.ok(readOut(result).includes(testCase.expect), '错误信息必须包含定位片段 ' + testCase.expect + '：\n' + readOut(result).slice(-1500));
        assert.deepStrictEqual(snapshotDir(outDir), snapshot, '配置校验失败不得改动输出目录');
      });
    }

    it('危险协议链接（社交/导航/页脚）被配置校验拒绝', () => {
      const site = makeSite({ siteOverrides: { social: { enabled: true, items: { bad: { enabled: true, type: 'link', url: 'javascript:alert(1)' } } } } });
      const outDir = path.join(site.root, 'out');
      const result = build(site, outDir);
      assert.notStrictEqual(result.status, 0, 'javascript: 社交链接必须阻断构建');
      assert.ok(readOut(result).includes('unsafe scheme'), '必须给出 unsafe scheme 原因：\n' + readOut(result).slice(-1200));
    });
  });

  // =====================================================================
  // 5：空站/极简站（0 文章、无媒体、无分类/标签）
  // =====================================================================
  describe('类 5 空站降级', () => {
    let outDir = '';
    let result = null;

    before(() => {
      const site = makeSite({
        articles: 0,
        pages: 0,
        media: false,
        siteOverrides: {
          languages: ['zh', 'en'],
          rss: { enabled: true, path: 'feed.xml', jsonFeed: { enabled: true, path: 'feed.json' } },
          sitemap: { enabled: true, path: 'sitemap.xml' }
        }
      });
      outDir = path.join(site.root, 'out');
      result = build(site, outDir);
    });

    it('构建成功且首页/404/feed 可用', () => {
      assert.strictEqual(result.status, 0, '空站必须构建成功：\n' + readOut(result).slice(-2000));
      for (const rel of ['zh/index.html', 'en/index.html', '404.html', 'zh/feed.xml', 'zh/feed.json', 'zh/sitemap.xml']) {
        assert.ok(fs.existsSync(path.join(outDir, rel)), '空站产物必须存在：' + rel);
      }
      const feed = fs.readFileSync(path.join(outDir, 'zh', 'feed.xml'), 'utf-8');
      assert.ok(feed.includes('<channel>'), '空站 RSS 必须仍有合法 channel');
      assert.strictEqual((feed.match(/<item>/g) || []).length, 0, '空站 RSS 不得含 item');
      assert.deepStrictEqual(scanXmlForExecutable(feed), []);
    });
  });

  // =====================================================================
  // 10：磁盘写失败 / 原子性
  // =====================================================================
  describe('类 10 磁盘写失败与原子性', () => {
    const { writeFileAtomicSync } = require('./lib/atomic-write');
    const os = require('node:os');

    it('允许写入失败时不覆盖旧文件、不残留 .tmp-（跨平台只读目标）', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-atomic-'));
      const target = path.join(dir, 'index.html');
      fs.writeFileSync(target, 'OLD', 'utf-8');
      try {
        if (process.platform === 'win32') {
          fs.chmodSync(target, 0o444);
          assert.throws(() => writeFileAtomicSync(target, 'NEW', 'utf-8'), /EPERM|EACCES|EBUSY/);
        } else {
          fs.chmodSync(dir, 0o555);
          assert.throws(() => writeFileAtomicSync(target, 'NEW', 'utf-8'), /EACCES|EPERM/);
        }
        assert.strictEqual(fs.readFileSync(target, 'utf-8'), 'OLD', '旧文件内容必须保留');
        const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp-'));
        assert.deepStrictEqual(leftovers, [], '失败后不得残留 .tmp- 文件');
      } finally {
        if (process.platform === 'win32') fs.chmodSync(target, 0o666);
        else fs.chmodSync(dir, 0o755);
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    });

    it('构建中途写失败：非零退出、旧产物保留、无半成品', () => {
      const site = makeSite({
        articles: 1,
        siteOverrides: {
          languages: ['zh', 'en'],
          build: { cleanDist: false, cjkFonts: { enabled: false } }
        }
      });
      const outDir = path.join(site.root, 'out');
      fs.mkdirSync(path.join(outDir, 'zh'), { recursive: true });
      const legacyPath = path.join(outDir, 'zh', 'index.html');
      fs.writeFileSync(legacyPath, 'OLD-INDEX', 'utf-8');
      if (process.platform === 'win32') fs.chmodSync(legacyPath, 0o444);
      else fs.chmodSync(path.join(outDir, 'zh'), 0o555);
      let result;
      try {
        result = build(site, outDir);
      } finally {
        if (process.platform === 'win32') fs.chmodSync(legacyPath, 0o666);
        else fs.chmodSync(path.join(outDir, 'zh'), 0o755);
      }
      assert.notStrictEqual(result.status, 0, '写失败必须使构建非零退出');
      assert.ok(readOut(result).includes('FATAL'), '必须输出可定位的 FATAL 信息：\n' + readOut(result).slice(-1500));
      assert.strictEqual(fs.readFileSync(legacyPath, 'utf-8'), 'OLD-INDEX', '旧产物必须逐字节保留');
      const leftovers = collectFiles(outDir).filter((f) => path.basename(f).includes('.tmp-'));
      assert.deepStrictEqual(leftovers, [], '失败构建不得残留 .tmp- 半成品');
    });
  });

  // =====================================================================
  // 3 的纯函数回归：保留路由/OS 设备名/超长派生 slug
  // =====================================================================
  describe('类 3 slug 纯函数回归', () => {
    it('Windows 保留设备名必须被 validateSlug 拒绝', () => {
      for (const name of ['CON', 'con', 'NUL', 'PRN.txt', 'COM1', 'lpt9', 'AUX']) {
        assert.strictEqual(validateSlug(name).ok, false, name + ' 必须被拒绝');
      }
    });
    it('safeSlug 输出长度受 120 上限约束且仍幂等', () => {
      const huge = '中'.repeat(20000);
      const slug = safeSlug(huge);
      assert.ok(slug.length <= 120, '派生 slug 长度必须 ≤ 120，实际 ' + slug.length);
      assert.strictEqual(safeSlug(slug), slug, '截断后必须幂等');
      assert.ok(safeSlug('中'.repeat(20000)) === slug, '必须确定性');
    });
    it('遍历载荷全部被拒绝（尾随空白按既定的 trim 归一化策略处理）', () => {
      for (const payload of TRAVERSAL_PAYLOADS) {
        const result = validateSlug(payload.value);
        if (payload.id === 'path-trailing-space') {
          assert.strictEqual(result.ok, true, '尾随空格按既定 trim 归一化策略接受');
          assert.strictEqual(result.slug, 'name');
        } else {
          assert.strictEqual(result.ok, false, payload.id + ' 必须被拒绝：' + payload.value);
        }
      }
    });
  });
});
