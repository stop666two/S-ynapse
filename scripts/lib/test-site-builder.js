'use strict';
// 临时站点夹具生成器（仅供测试使用，永不写入正式目录）：
// 在 <项目根>/.tmp-test/ 下创建随机命名的临时站点目录，生成最小可解析的
// articles/、pages/、site.json5、features.json5（可选坏配置）与 media/ 素材，
// 返回 { root, name, options, files, cleanup }。cleanup 幂等且只删除本夹具目录。

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TMP_ROOT = path.join(PROJECT_ROOT, '.tmp-test');

const VALID_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const BROKEN_PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49]);

/** @type {readonly ('utf8'|'utf8-bom'|'crlf'|'mixed'|'lone-surrogate')[]} */
const ENCODING_CHOICES = Object.freeze(['utf8', 'utf8-bom', 'crlf', 'mixed', 'lone-surrogate']);// 按 encoding 选项变换文本：BOM 前缀 / 换行风格 / 孤立代理（写盘后由 Node 转为 U+FFFD）。
function applyEncoding(text, encoding) {
  switch (encoding) {
    case 'utf8-bom':
      return '\uFEFF' + text;
    case 'crlf':
      return text.replace(/\n/g, '\r\n');
    case 'mixed': {
      const lines = text.split('\n');
      return lines.map((line, index) => (index % 2 === 0 ? line + '\n' : line + '\r\n')).join('');
    }
    case 'lone-surrogate':
      return text.replace('title:', 'title: front\uD800matter');
    default:
      return text;
  }
}

function articleMarkdown(index, options) {
  const { lang, media, mediaBroken, date } = options;
  const title = '测试文章 ' + index + ' ' + (lang === 'zh' ? '（中文）' : '(English)');
  const lines = [
    '---',
    'title: ' + title,
    'slug: test-article-' + index,
    'date: ' + date,
    'tags: [测试, fixture]',
    'categories: [测试分类]',
    '---',
    '',
    '# ' + title,
    '',
    '这是夹具生成的第 ' + index + ' 篇文章，用于随机与冒烟测试。',
    ''
  ];
  if (media) lines.push('![像素图](/media/test-pixel.png)');
  if (mediaBroken) lines.push('![损坏图](/media/broken.png)');
  lines.push('', '## 小节', '', '正文段落 ' + index + '。', '');
  return lines.join('\n');
}

function pageMarkdown(index, lang) {
  return [
    '---',
    'title: 夹具页面 ' + index,
    '---',
    '',
    '# 夹具页面 ' + index,
    '',
    '页面正文（' + lang + '）。',
    ''
  ].join('\n');
}

function siteConfig(options) {
  return [
    '{',
    '  // 夹具站点标题（测试用）',
    '  title: ' + JSON.stringify(options.siteName) + ',',
    '  description: ' + JSON.stringify('夹具站点 description') + ',',
    '  url: ' + JSON.stringify('https://example.test') + ',',
    '  lang: ' + JSON.stringify('zh') + ',',
    '}',
    ''
  ].join('\n');
}

function featuresConfig(badConfig) {
  if (badConfig) {
    // 故意语法非法（裸词值 + 未闭合括号）：配置校验必须显式报错。
    return '{ enabled: tru, broken: [ }\n';
  }
  return [
    '{',
    '  // 夹具 features：仅覆盖测试需要的开关，其余走注册表默认值',
    '  search: { enabled: true },',
    '}',
    ''
  ].join('\n');
}

/**
 * 校验目标路径必须位于 .tmp-test 内（防误写正式目录）。
 * @param {string} target
 */
function assertInsideTmp(target) {
  const resolved = path.resolve(target);
  if (resolved !== TMP_ROOT && !resolved.startsWith(TMP_ROOT + path.sep)) {
    throw new Error('夹具路径越出 .tmp-test：' + resolved);
  }
}

/**
 * 创建临时站点夹具。
 * @param {{
 *   articles?: number, pages?: number, langs?: string[], media?: boolean, mediaBroken?: boolean,
 *   badConfig?: boolean, encoding?: 'utf8'|'utf8-bom'|'crlf'|'mixed'|'lone-surrogate',
 *   siteName?: string, seed?: number, extraFiles?: Record<string, string>
 * }} [options]
 * @returns {{ root: string, name: string, options: object, files: string[], cleanup: () => boolean }}
 */
function createTestSite(options) {
  const opts = Object.assign({
    articles: 3,
    pages: 1,
    langs: ['zh', 'en'],
    media: false,
    mediaBroken: false,
    badConfig: false,
    encoding: 'utf8',
    siteName: '夹具站点',
    seed: 0,
    extraFiles: null
  }, options || {});
  if (!ENCODING_CHOICES.includes(opts.encoding)) {
    throw new Error('未知 encoding 选项：' + opts.encoding + '（可选：' + ENCODING_CHOICES.join('/') + '）');
  }
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const root = fs.mkdtempSync(path.join(TMP_ROOT, 'site-'));
  assertInsideTmp(root);
  const files = [];

  const write = (rel, content) => {
    const target = path.join(root, rel);
    assertInsideTmp(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const text = typeof content === 'string' ? applyEncoding(content, opts.encoding) : content;
    fs.writeFileSync(target, text);
    files.push(rel.split(path.sep).join('/'));
  };

  write('site.json5', siteConfig(opts));
  write('features.json5', featuresConfig(opts.badConfig));
  const langs = opts.langs.length ? opts.langs : ['zh'];
  for (const lang of langs) {
    for (let i = 1; i <= opts.articles; i++) {
      const day = String(((i - 1) % 27) + 1).padStart(2, '0');
      write(
        path.join('articles', lang, 'test-article-' + i + '.md'),
        articleMarkdown(i, { lang, media: opts.media, mediaBroken: opts.mediaBroken, date: '2026-01-' + day })
      );
    }
    for (let p = 1; p <= opts.pages; p++) {
      write(path.join('pages', 'fixture-page-' + p + '.md'), pageMarkdown(p, lang));
    }
  }
  if (opts.media) write(path.join('media', 'test-pixel.png'), VALID_PIXEL_PNG);
  if (opts.mediaBroken) write(path.join('media', 'broken.png'), BROKEN_PNG_HEAD);
  if (opts.extraFiles) {
    for (const rel of Object.keys(opts.extraFiles)) write(rel, opts.extraFiles[rel]);
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return true;
    cleaned = true;
    try {
      assertInsideTmp(root);
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      return true;
    } catch (err) {
      process.stderr.write('[test-site] 清理失败：' + root + ' (' + err.message + ')\n');
      return false;
    }
  };

  return { root, name: path.basename(root), options: opts, files, cleanup };
}

/**
 * 随机取值：供测试从夹具选项池中抽签（确定性由外部 rng 决定）。
 * @param {{ int: (min: number, max: number) => number, pick: <T>(items: readonly T[]) => T, bool: (p?: number) => boolean }} rng
 * @returns {Parameters<typeof createTestSite>[0]}
 */
function randomSiteOptions(rng) {
  return {
    articles: rng.int(1, 5),
    pages: rng.int(0, 2),
    langs: rng.pick([['zh'], ['zh', 'en']]),
    media: rng.bool(0.5),
    mediaBroken: rng.bool(0.3),
    badConfig: rng.bool(0.2),
    encoding: rng.pick(ENCODING_CHOICES),
    seed: rng.int(1, 0x7fffffff)
  };
}

module.exports = {
  PROJECT_ROOT,
  TMP_ROOT,
  ENCODING_CHOICES,
  VALID_PIXEL_PNG,
  BROKEN_PNG_HEAD,
  assertInsideTmp,
  createTestSite,
  randomSiteOptions
};
