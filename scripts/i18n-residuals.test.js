// T4 i18n 残余回归：站点级文案本地化（description/keywords/bio/language）、
// 404 与 guard 锁屏文案的语言接线、默认值注册表同步。
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const readJson5 = (file) => json5.parse(fs.readFileSync(path.join(ROOT, file), 'utf-8'));

describe('site 默认值注册表与 site.json5 同步（T4）', () => {
  const { DEFAULT_CONFIG } = require('./lib/site-defaults.js');
  const site = DEFAULT_CONFIG.site;
  const userSite = readJson5('site.json5');

  it('默认值注册 descriptionEn/languageEn/metaKeywordsEn/bioEn', () => {
    assert.strictEqual(site.descriptionEn, '');
    assert.strictEqual(site.languageEn, '');
    assert.deepStrictEqual(site.seo.metaKeywordsEn, []);
    assert.strictEqual(site.authorProfile.bioEn, '');
  });

  it('site.json5 提供非空英文演示数据（中英均为自然文案）', () => {
    assert.ok(userSite.descriptionEn && /[A-Za-z]/.test(userSite.descriptionEn), 'descriptionEn 必须为非空英文');
    assert.ok(userSite.authorProfile.bio, 'authorProfile.bio 必须为非空');
    assert.ok(userSite.authorProfile.bioEn && /[A-Za-z]/.test(userSite.authorProfile.bioEn), 'authorProfile.bioEn 必须为非空英文');
    assert.ok(/^en(-|$)/i.test(userSite.languageEn), 'languageEn 必须是 en 开头的 BCP 47 标签');
    assert.ok(Array.isArray(userSite.seo.metaKeywordsEn) && userSite.seo.metaKeywordsEn.length > 0, 'metaKeywordsEn 必须非空');
    assert.ok(userSite.seo.metaKeywordsEn.every((k) => /^[\x20-\x7E]+$/.test(k)), 'metaKeywordsEn 必须为 ASCII 英文关键词');
  });
});

describe('localizeSite 按语言取站点级文案', () => {
  const { createPagesModule } = require('./build/pages.js');
  const { localizeSite } = createPagesModule({});
  const base = {
    title: 'S-ynapse',
    description: '中文描述',
    descriptionEn: 'English description',
    language: 'zh-CN',
    languageEn: 'en-US',
    seo: { metaKeywords: ['博客', '技术'], metaKeywordsEn: ['blog', 'tech'] },
    authorProfile: { bio: '中文简介', bioEn: 'English bio' }
  };

  it('en：替换为 *En 值', () => {
    const en = localizeSite(base, 'en');
    assert.strictEqual(en.description, 'English description');
    assert.strictEqual(en.language, 'en-US');
    assert.deepStrictEqual(en.seo.metaKeywords, ['blog', 'tech']);
    assert.strictEqual(en.authorProfile.bio, 'English bio');
    assert.strictEqual(base.description, '中文描述', '不得原地修改输入对象');
    assert.strictEqual(base.seo.metaKeywords[0], '博客');
  });

  it('en 且 En 值缺失：保持原值，language 回退 en-US', () => {
    const en = localizeSite({ description: '中文描述', language: 'zh-CN', seo: {}, authorProfile: {} }, 'en');
    assert.strictEqual(en.description, '中文描述');
    assert.strictEqual(en.language, 'en-US');
  });

  it('zh：原样返回（引用相等，无额外拷贝）', () => {
    assert.strictEqual(localizeSite(base, 'zh'), base);
  });
});

describe('404 与 guard 锁屏文案语言接线（T4）', () => {
  const ui = readJson5('ui-strings.json5');
  const guard = readJson5('guard.json5');

  it('ui-strings guard.lockTitle/lockText/close 中英齐备且非空', () => {
    for (const key of ['lockTitle', 'lockText', 'close']) {
      assert.ok(ui.guard[key], 'zh guard.' + key + ' 缺失');
      assert.ok(ui.en.guard[key], 'en guard.' + key + ' 缺失');
      assert.notStrictEqual(ui.guard[key], ui.en.guard[key], key + ' 中英不得相同');
    }
  });

  it('guard.json5 锁屏文案留空以走 ui-strings（英文页不再锁定为中文）', () => {
    assert.strictEqual(guard.devtoolsDetect.lockTitle, '');
    assert.strictEqual(guard.devtoolsDetect.lockText, '');
  });

  it('devtools-detect.js 通过 ctx.t 取锁屏文案，无中文硬编码回退缺失', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'guard', 'devtools-detect.js'), 'utf-8');
    assert.match(src, /ctx\.t\('lockTitle'/);
    assert.match(src, /ctx\.t\('lockText'/);
    assert.match(src, /ctx\.t\('close'/);
    assert.ok(!/btn\.textContent\s*=\s*'关闭'/.test(src), '关闭按钮不得硬编码中文');
  });

  it('guard/core.js 的 t() 按语言优先取 __I18N__.en.guard', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'guard', 'core.js'), 'utf-8');
    assert.match(src, /D\.en && D\.en\.guard/);
    assert.match(src, /isEnglishPage/);
  });

  it('404.ejs 的 notFound 文案经 ui() 服务端按语言渲染', () => {
    const src = fs.readFileSync(path.join(ROOT, 'templates', '404.ejs'), 'utf-8');
    for (const key of ['notFound.title', 'notFound.desc', 'notFound.backHome', 'notFound.searchSite', 'notFound.hotArticles']) {
      assert.ok(src.includes("ui('" + key + "'"), key + ' 未走 ui()');
    }
  });
});
